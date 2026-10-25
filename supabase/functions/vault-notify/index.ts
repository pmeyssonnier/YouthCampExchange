// vault-notify — fonction Supabase (Edge Function) : à chaque changement d'étape d'un dossier du coffre,
// envoie un e-mail à la personne qui doit agir (parent, président de club, coordinateur, national, candidat).
// Appelée par un « Database Webhook » sur l'insertion dans public.events (voir docs/VAULT_SETUP.md).
// L'e-mail ne contient que le nom du candidat, l'étape et un lien : le dossier reste dans le coffre.
// Envoi par le compte Gmail du MD (SMTP chiffré, port 465 : Supabase bloque le port 587 dans ses fonctions).
// Aucune bibliothèque : lecture de la base par l'API REST avec la clé service_role, fournie par Supabase
// à la fonction et jamais au site.
//
// Secrets (Edge Functions → Secrets) : SMTP_USER (adresse Gmail du MD), SMTP_PASS (mot de passe
// d'application Google), SENDER_NAME (facultatif), VAULT_URL (adresse de yce_vault.html),
// NOTIFY_SECRET (même valeur que l'en-tête x-notify-secret du webhook).
// Facultatifs : SMTP_HOST (smtp.gmail.com), SMTP_PORT (465) pour un autre fournisseur.

// ce que doit faire la personne prévenue, selon l'étape atteinte par le dossier
export const STEPS = {
  parent_review: { who: "parent", subject: "approval needed", what: "it is waiting for your approval as parent / guardian" },
  submitted: { who: "president", subject: "club signature needed", what: "it is waiting for your signature as club president — download the club copy, check it and sign" },
  club_signed: { who: "district", subject: "district countersignature needed", what: "it is waiting for your countersignature as district YCE coordinator" },
  district_validated: { who: "national", subject: "national validation needed", what: "it is waiting for the validation of the national YCE team" },
  draft: { who: "candidate", subject: "file sent back to you", what: "it has been sent back to you: read the comment in the vault, correct the file and send it again" },
  sent_host: { who: "candidate", subject: "file sent to the host country", what: "it has been sent to the host country" },
  accepted: { who: "candidate", subject: "answer from the host country", what: "the host country has answered — see the vault" },
  refused: { who: "candidate", subject: "answer from the host country", what: "the host country has answered — see the vault" },
};

// destinataires : adresses du dossier, ou équipe déclarée dans la table staff (coordinateurs, national)
export function recipients(step, d, staff) {
  const s = STEPS[step];
  if (!s || !d) return [];
  const list = s.who === "parent" ? [d.parent_email]
    : s.who === "president" ? [d.president_email]
    : s.who === "candidate" ? [d.candidate_email]
    : s.who === "district" ? staff.filter((r) => r.role === "district" && r.district === d.district).map((r) => r.email)
    : staff.filter((r) => r.role === "national").map((r) => r.email);
  return [...new Set(list.filter((e) => typeof e === "string" && /^[^@\s]+@[^@\s]+$/.test(e)))];
}

export function message(step, d, to, vaultUrl) {
  const s = STEPS[step];
  const link = vaultUrl + "?d=" + encodeURIComponent(d.id);
  return {
    subject: "Lions YCE — application of " + d.candidate_name + ": " + s.subject,
    text: "Hello,\n\n"
      + "The Lions Youth Camp & Exchange application file of " + d.candidate_name + " has moved on: " + s.what + ".\n\n"
      + "Open it in the secure vault — sign in with this e-mail address (" + to + "):\n" + link + "\n\n"
      + "The file is not attached to this e-mail: it stays in the vault.\n"
      + "This message was sent automatically; please do not reply to it.\n\n"
      + "Lions Youth Camp & Exchange\n",
  };
}

// en-tête encodé (RFC 2047) : accents et tirets du nom, et aucun retour à la ligne possible
const encWord = (s) => "=?UTF-8?B?" + b64(s) + "?=";
function b64(s) {
  let bin = "";
  for (const c of new TextEncoder().encode(s)) bin += String.fromCharCode(c);
  return btoa(bin);
}

// dialogue SMTP minimal sur une connexion déjà chiffrée (conn : read(Uint8Array) / write(Uint8Array))
export async function smtpSend(conn, o) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "";
  const reply = async () => { // une réponse complète : sa dernière ligne est « 250 … » (sans tiret)
    for (;;) {
      const m = buf.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n/);
      if (m) { const end = m.index + m[0].length, text = buf.slice(0, end); buf = buf.slice(end); return { code: +m[1], text: text }; }
      const chunk = new Uint8Array(4096), n = await conn.read(chunk);
      if (n === null) throw new Error("SMTP connection closed");
      buf += dec.decode(chunk.subarray(0, n));
    }
  };
  const cmd = async (line, ok) => {
    if (line !== null) await conn.write(enc.encode(line + "\r\n"));
    const r = await reply();
    if (ok.indexOf(r.code) < 0) throw new Error("SMTP " + r.text.trim().split("\r\n").pop());
  };
  await cmd(null, [220]);
  await cmd("EHLO yce-vault", [250]);
  await cmd("AUTH LOGIN", [334]);
  await cmd(b64(o.user), [334]);
  await cmd(b64(o.pass), [235]);
  await cmd("MAIL FROM:<" + o.from + ">", [250]);
  await cmd("RCPT TO:<" + o.to + ">", [250, 251]);
  await cmd("DATA", [354]);
  const msg = ["From: " + encWord(o.fromName) + " <" + o.from + ">", "To: <" + o.to + ">", "Subject: " + encWord(o.subject),
    "Date: " + new Date().toUTCString(), "Message-ID: <" + crypto.randomUUID() + "@yce-vault>", "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "",
    b64(o.text).replace(/.{1,76}/g, "$&\r\n")].join("\r\n"); // base64 : aucune ligne ne commence par « . »
  await cmd(msg + ".", [250]);
  await conn.write(enc.encode("QUIT\r\n")).catch(() => {});
}

// envoi réel depuis Supabase : une connexion chiffrée par e-mail
async function smtpMail(env, to, m) {
  const conn = await Deno.connectTls({ hostname: env.SMTP_HOST || "smtp.gmail.com", port: +(env.SMTP_PORT || 465) });
  try {
    await smtpSend(conn, { user: env.SMTP_USER, pass: (env.SMTP_PASS || "").replace(/\s/g, ""), from: env.SMTP_USER,
      fromName: env.SENDER_NAME || "Lions YCE", to: to, subject: m.subject, text: m.text });
  } finally { try { conn.close(); } catch (_) { /* déjà fermée */ } }
}

// traitement d'un appel du webhook ; env, fetchFn et mailFn sont injectés pour les tests
export async function handle(req, env, fetchFn, mailFn) {
  if (!env.NOTIFY_SECRET || req.headers.get("x-notify-secret") !== env.NOTIFY_SECRET) return new Response("forbidden", { status: 403 });
  const p = await req.json().catch(() => null);
  const e = p && p.record;
  if (!p || p.type !== "INSERT" || p.table !== "events" || !e || e.action !== "status") return new Response("ignored");
  const step = e.detail && e.detail.to;
  if (!STEPS[step]) return new Response("no e-mail for this step");

  const db = (path) => fetchFn(env.SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
  }).then((r) => r.ok ? r.json() : Promise.reject(new Error("database " + r.status)));
  const rows = await db("dossiers?select=id,candidate_name,candidate_email,parent_email,president_email,district,status&id=eq." + encodeURIComponent(e.dossier_id));
  const d = rows[0];
  if (!d || d.status !== step) return new Response("file has moved on"); // appel en retard : on ne prévient pas à tort
  const staff = STEPS[step].who === "district" || STEPS[step].who === "national" ? await db("staff?select=email,role,district") : [];

  const sent = [];
  for (const to of recipients(step, d, staff)) {
    const m = message(step, d, to, env.VAULT_URL);
    try { await mailFn(env, to, m); sent.push(to); } catch (err) { console.error("e-mail to " + to + " failed: " + err.message); }
  }
  if (sent.length) { // trace dans l'historique du dossier : « e-mail sent to the club president »
    await fetchFn(env.SUPABASE_URL + "/rest/v1/events", {
      method: "POST",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ dossier_id: d.id, actor_email: "vault (automatic e-mail)", action: "email", detail: { step: step, to: STEPS[step].who, count: sent.length } }),
    });
  }
  return new Response(JSON.stringify({ sent: sent.length }), { headers: { "content-type": "application/json" } });
}

if (typeof Deno !== "undefined") Deno.serve((req) => handle(req, Deno.env.toObject(), fetch, smtpMail));
