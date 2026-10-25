// vault-notify — fonction Supabase (Edge Function) : à chaque changement d'étape d'un dossier du coffre,
// envoie un e-mail à la personne qui doit agir (parent, président de club, coordinateur, national, candidat).
// Appelée par un « Database Webhook » sur l'insertion dans public.events (voir docs/VAULT_SETUP.md).
// L'e-mail ne contient que le nom du candidat, l'étape et un lien : le dossier reste dans le coffre.
// Envoi par l'API de Brevo. Aucune bibliothèque : lecture de la base par l'API REST avec la clé
// service_role, fournie par Supabase à la fonction et jamais au site.
//
// Secrets (Edge Functions → Secrets) : BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME (facultatif),
// VAULT_URL (adresse de yce_vault.html), NOTIFY_SECRET (même valeur que l'en-tête x-notify-secret du webhook).

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

// traitement d'un appel du webhook ; env et fetchFn sont injectés pour les tests
export async function handle(req, env, fetchFn) {
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
    const r = await fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "Lions YCE" }, to: [{ email: to }], subject: m.subject, textContent: m.text }),
    });
    if (r.ok) sent.push(to); else console.error("Brevo", r.status, await r.text());
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

if (typeof Deno !== "undefined") Deno.serve((req) => handle(req, Deno.env.toObject(), fetch));
