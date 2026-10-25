// vault.js — interface du coffre des dossiers (yce_vault.html).
// Les droits réels sont appliqués par la base ; ici on n'affiche que les actions
// que la base acceptera pour ce compte et cette étape.
const CONSENT_VERSION = "2026-10-v2"; // à augmenter quand le texte de l'avis change
const STATUS = {
  draft:              { label: "Draft",                            cls: "st-draft" },
  parent_review:      { label: "Awaiting parent / guardian",       cls: "st-wait" },
  submitted:          { label: "Awaiting club president",          cls: "st-wait" },
  club_signed:        { label: "Awaiting district coordinator",    cls: "st-wait" },
  district_validated: { label: "Awaiting national YCE team",       cls: "st-wait" },
  national_validated: { label: "Ready to send to host country",    cls: "st-wait" },
  sent_host:          { label: "Sent to host country",             cls: "st-host" },
  accepted:           { label: "Accepted",                         cls: "st-ok" },
  refused:            { label: "Refused",                          cls: "st-ko" },
  archived:           { label: "Archived",                         cls: "st-draft" }
};
const CHECKLIST = [
  { label: "Application form (Excel)",         re: /\.xlsx$/i },
  { label: "Commitment to Reciprocity",        re: /^Commitment.*\.docx$/i },
  { label: "Passport-style photo",             re: /^Pass_photo/i },
  { label: "Proof of payment",                 re: /^Payment_proof/i },
  { label: "Passport / ID card scan",          re: /^ID_document/i },
  { label: "Letter to the host family",        re: /^Letter_to_Host_Family/i }
];

let API = null, ME = "", ROLES = [], DOSSIERS = [], CUR = null, CUR_FILES = [], MFA_FACTOR = null;

// ---------- utilitaires ----------
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
  return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function show(id, on){ $(id).hidden = !on; }
function msg(text, kind){ const el = $("msg"); el.textContent = text; el.className = "msg " + (kind || "info"); el.hidden = !text; }
function fmtDT(s){ return s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; }
function fmtD(s){ return s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""; }
function isStaff(role, district){ return ROLES.some(function(r){ return r.role === role && (!district || r.district === district); }); }
function selfLink(id){ return location.origin + location.pathname + "?d=" + id; }
async function sha256Hex(buf){
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(function(b){ return b.toString(16).padStart(2, "0"); }).join("");
}
// moins de 18 ans aujourd'hui : l'approbation d'un parent est requise (même règle que la base)
function isMinor(birth){
  if(!birth) return false;
  const b = new Date(birth), lim = new Date(); lim.setFullYear(lim.getFullYear() - 18);
  return b > lim;
}
function validBirth(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1980-01-01" && v <= new Date().toISOString().slice(0, 10); }
function latestFile(kind){ return CUR_FILES.find(function(f){ return f.kind === kind; }); }
// passeport « à suivre » (note dans le dossier) et pas encore reçu — même règle que id_pending() en base
function idPending(){
  const z = latestFile("zip"); if(!z) return false;
  const names = (z.contents || []).map(function(n){ return n.split("/").pop(); });
  return names.some(function(n){ return /^ID_document_TO_FOLLOW/i.test(n); })
      && !names.some(function(n){ return /^ID_document_(?!TO_FOLLOW)/i.test(n); })
      && !latestFile("id");
}
// saison de candidature : de septembre à août (en octobre 2026 on postule pour 2026-2027)
function applicationSeason(){
  const d = new Date(), y = d.getFullYear();
  return d.getMonth() >= 8 ? y + "-" + (y + 1) : (y - 1) + "-" + y;
}

// ---------- démarrage ----------
async function vaultInit(){
  const configured = typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY;
  if(!configured || typeof makeVaultApi !== "function"){ show("cfg-missing", true); return; }
  if(typeof supabase === "undefined"){ msg("The secure vault library could not be loaded. Check your connection and reload.", "err"); return; }
  API = makeVaultApi(supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  fillStaticLists();
  // Supabase annonce aussi la session au démarrage : une seule ouverture (sinon deux inscriptions
  // à la double authentification se suppriment l'une l'autre → « Factor not found »)
  API.onAuth(function(s){ if(s && !ME) startSession(s); });
  const s = await API.session();
  if(s){ if(!ME) startSession(s); }else if(!ME) show("login", true);
}

function fillStaticLists(){
  const dists = Object.keys(typeof DISTRICTS !== "undefined" ? DISTRICTS : {});
  const opts = dists.map(function(k){ return '<option value="' + k + '">' + esc((typeof MD !== "undefined" ? MD : "") + k) + " — " + esc(DISTRICTS[k].name || "") + "</option>"; }).join("");
  ["n-district", "e-district"].forEach(function(id){ if($(id)) $(id).innerHTML = opts; });
  if($("s-district")) $("s-district").innerHTML = '<option value="">—</option>' + dists.map(function(k){ return '<option value="' + k + '">' + k + "</option>"; }).join("");
  const s = applicationSeason(), y = +s.slice(0, 4);
  $("n-season").innerHTML = [s, (y - 1) + "-" + y].map(function(v){ return '<option value="' + v + '">' + v + "</option>"; }).join("");
  if(typeof RAW !== "undefined"){
    const names = Array.from(new Set(RAW.map(function(c){ return c.country + " — " + c.camp_name; }))).sort();
    $("camp-list").innerHTML = names.map(function(n){ return '<option value="' + esc(n) + '">'; }).join("");
  }
}

async function sendLink(){
  const email = $("l-email").value.trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg("Enter a valid e-mail address.", "err"); return; }
  $("l-btn").disabled = true;
  try{
    await API.sendLink(email, location.origin + location.pathname + location.search);
    msg("Check your inbox: we sent a sign-in link to " + email + ". Open it on this device or any other.", "ok");
  }catch(e){ msg("Could not send the link: " + e.message, "err"); }
  $("l-btn").disabled = false;
}

async function startSession(s){
  ME = (s.user && s.user.email || "").toLowerCase();
  show("login", false); show("app", true);
  $("me").textContent = ME;
  try{ ROLES = await API.myRoles() || []; }catch(e){ ROLES = []; }
  $("me-roles").textContent = ROLES.map(function(r){ return r.role === "district" ? "District " + r.district + " coordinator" : r.role === "national" ? "National YCE team" : "Administrator"; }).join(" · ");
  if(await mfaNeeded()){ show("work", false); return; }
  continueSession();
}

// ---------- double authentification (coordinateurs, national, admin) ----------
// Sans elle, la base ne leur donne aucun droit : on la demande avant d'afficher le travail.
async function mfaNeeded(){
  if(!ROLES.length) return false;
  let st;
  try{ st = await API.mfaStatus(); }catch(e){ msg("Could not check two-step verification: " + e.message, "err"); return true; }
  if(st.current === "aal2") return false;
  show("mfa", true);
  if(st.verified.length){
    MFA_FACTOR = st.verified[0].id;
    show("mfa-setup", false);
    $("mfa-intro").textContent = "Enter the 6-digit code shown by your authenticator app.";
  }else{
    try{
      const e = await API.mfaEnroll();
      MFA_FACTOR = e.factorId; $("mfa-qr").src = e.qr; $("mfa-secret").textContent = e.secret;
      show("mfa-setup", true);
      $("mfa-intro").textContent = "Coordinators and the national team protect the files with two-step verification. "
        + "Scan this QR code once with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code it shows.";
    }catch(e){ msg("Could not start two-step verification: " + e.message, "err"); }
  }
  setTimeout(function(){ $("mfa-code").focus(); }, 50);
  return true;
}
async function mfaVerify(){
  const code = $("mfa-code").value.replace(/\s+/g, "");
  if(!/^\d{6}$/.test(code)){ msg("Enter the 6-digit code from your authenticator app.", "err"); return; }
  try{
    await API.mfaVerify(MFA_FACTOR, code);
    $("mfa-code").value = ""; show("mfa", false); msg("Two-step verification done.", "ok");
    continueSession();
  }catch(e){ msg("Wrong or expired code — try the next one. (" + e.message + ")", "err"); }
}

async function continueSession(){
  show("work", true);
  show("admin", isStaff("admin"));
  show("purge", isStaff("national"));
  await loadDashboard();
  if(isStaff("admin")) loadStaff();
  if(isStaff("national")) loadPurge();
  const deep = new URLSearchParams(location.search).get("d");
  if(deep) openDossier(deep);
}

async function signOut(){ await API.signOut(); location.href = location.pathname; }

// ---------- tableau de bord ----------
function myTurn(d){
  if(d.status === "draft") return d.candidate_email === ME;
  if(d.status === "parent_review") return d.parent_email === ME;
  if(d.status === "submitted") return d.president_email === ME;
  if(d.status === "club_signed") return isStaff("district", d.district);
  if(["district_validated", "national_validated", "sent_host"].indexOf(d.status) >= 0) return isStaff("national");
  return false;
}

// qui doit agir maintenant, et pour faire quoi : affiché sur la fiche et dans la liste
function waitingFor(d){
  const dist = typeof DISTRICTS !== "undefined" && DISTRICTS[d.district] || {};
  return { draft: ["the candidate", d.candidate_email, "upload the ZIP, then send the file"],
    parent_review: ["the parent / guardian", d.parent_email, "sign in to the vault with this address and approve the file"],
    submitted: ["the club president", d.president_email, "sign in to the vault with this address, download the club copy and sign"],
    club_signed: ["the district coordinator", dist.email || "", "countersign the file"],
    district_validated: ["the national YCE team", "", "validate the file"],
    national_validated: ["the national YCE team", "", "send the file to the host country"],
    sent_host: ["the host country", "", "accept or refuse the candidate"] }[d.status] || null;
}

function renderNext(d){
  const w = waitingFor(d), box = $("d-next");
  box.className = "next" + (myTurn(d) ? " mine" : "");
  if(myTurn(d)){
    box.innerHTML = "👉 <b>Your turn.</b> " + ({ draft: "Upload the ZIP generated by the application form, then send the file" +
        (isMinor(d.candidate_birth_date) ? " — under 18, it goes to your parent / guardian first, then to your club president." : " to your club president.") }[d.status]
      || "Review the file, then use the button below.");
  }else if(w){
    box.innerHTML = "⏳ <b>Waiting for " + esc(w[0]) + "</b>" + (w[1] ? " (" + esc(w[1]) + ")" : "") + ": " + esc(w[2]) + ".";
  }else box.innerHTML = "✔ This file is closed: " + esc((STATUS[d.status] || {}).label || d.status) + ".";
  box.hidden = false;
}

// pas encore de dossier : candidat qui commence, ou président / parent qui arrive trop tôt
function renderWelcome(){
  $("welcome-body").innerHTML = "Signed in as <b>" + esc(ME) + "</b>.<ul>" +
    "<li><b>Candidate?</b> Start your application file below.</li>" +
    "<li><b>Club president or parent / guardian?</b> No file is waiting for you yet. It appears here as soon as the candidate has sent it — " +
    "for a candidate under 18, once the parent or guardian has approved it. Check that you signed in with the exact address the candidate entered.</li></ul>";
}

async function loadDashboard(){
  try{ DOSSIERS = await API.listDossiers() || []; }
  catch(e){ msg("Could not load the files: " + e.message, "err"); return; }
  // un président de club ou un parent voit déjà des dossiers : pas de formulaire de création pour eux
  show("create", !ROLES.length && !DOSSIERS.length);
  show("welcome", !ROLES.length && !DOSSIERS.length);
  if(!ROLES.length && !DOSSIERS.length) renderWelcome();
  renderList();
}

function renderList(){
  const f = $("f-status").value;
  const rows = DOSSIERS.filter(function(d){ return !f || (f === "todo" ? myTurn(d) : d.status === f); });
  $("count").textContent = rows.length + " / " + DOSSIERS.length;
  $("list").innerHTML = rows.length ? rows.map(function(d){
    const st = STATUS[d.status] || { label: d.status, cls: "" };
    return '<tr onclick="openDossier(\'' + d.id + '\')" class="' + (myTurn(d) ? "todo" : "") + '">' +
      "<td><b>" + esc(d.candidate_name) + "</b><div class=\"sub\">" + esc(d.candidate_email) + "</div></td>" +
      "<td>" + esc((typeof MD !== "undefined" ? MD : "") + d.district) + "<div class=\"sub\">" + esc(d.club || "") + "</div></td>" +
      "<td>" + esc(d.season) + "</td>" +
      '<td><span class="st ' + st.cls + '">' + esc(st.label) + "</span>" + (myTurn(d) ? ' <span class="turn">your turn</span>'
        : waitingFor(d) ? '<div class="sub">waiting for ' + esc(waitingFor(d)[0]) + "</div>" : "") + "</td>" +
      '<td class="sub">' + fmtD(d.updated_at) + "</td></tr>";
  }).join("") : '<tr><td colspan="5" class="empty">No application file to show.</td></tr>';
}

async function createDossier(){
  const name = $("n-name").value.trim(), pres = $("n-president").value.trim().toLowerCase(), birth = $("n-birth").value;
  const parent = $("n-parent").value.trim().toLowerCase();
  if(name.length < 2){ msg("Enter the candidate's first and last name.", "err"); return; }
  if(!validBirth(birth)){ msg("Enter the candidate's date of birth.", "err"); return; }
  if(isMinor(birth) && !parent){ msg("The candidate is under 18: enter the e-mail of a parent or legal guardian, who will approve the file.", "err"); return; }
  if(pres && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pres)){ msg("The club president e-mail is not valid.", "err"); return; }
  if(!$("n-consent").checked){ msg("Please read and accept the data protection notice.", "err"); return; }
  try{
    const d = await API.createDossier({
      season: $("n-season").value, candidate_name: name, candidate_birth_date: birth, district: $("n-district").value,
      club: $("n-club").value.trim() || null, president_email: pres || null,
      parent_email: parent || null,
      camp_choice: $("n-camp").value.trim() || null,
      consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION
    });
    msg("Your application file is created. Next step: upload the ZIP generated by the application form.", "ok");
    await loadDashboard();
    openDossier(d.id);
  }catch(e){ msg("Could not create the file: " + e.message, "err"); }
}

// ---------- fiche dossier ----------
async function openDossier(id){
  try{
    CUR = await API.getDossier(id);
    if(!CUR){ msg("This application file is not open to you (yet). It opens to the club president once the candidate has sent it — under 18, once the parent has approved it. Check that you signed in with the address the candidate entered (you are " + ME + ").", "err"); return; }
    const res = await Promise.all([API.files(id), API.signatures(id), API.events(id), API.comments(id)]);
    CUR_FILES = res[0] || [];
    renderDossier(res[1] || [], res[2] || [], res[3] || []);
    show("dossier", true);
    $("dossier").scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "?d=" + id);
  }catch(e){ msg("Could not open the file: " + e.message, "err"); }
}

function closeDossier(){ CUR = null; show("dossier", false); history.replaceState(null, "", location.pathname); }

function canUpload(d){ // le président ne dépose jamais : il ne reçoit que la copie club
  return (d.status === "draft" && d.candidate_email === ME) ||
         (d.status === "club_signed" && isStaff("district", d.district)) ||
         ((d.status === "district_validated" || d.status === "national_validated") && isStaff("national"));
}

function renderDossier(sigs, events, comments){
  const d = CUR, st = STATUS[d.status] || { label: d.status, cls: "" };
  const editable = d.status === "draft" && d.candidate_email === ME;
  $("d-title").textContent = d.candidate_name;
  $("d-status").className = "st " + st.cls; $("d-status").textContent = st.label;
  $("d-meta").textContent = "Season " + d.season + " · kept until " + fmtD(d.purge_after);
  renderNext(d);

  // informations
  show("d-edit", editable); show("d-info", !editable);
  if(editable){
    $("e-name").value = d.candidate_name; $("e-district").value = d.district; $("e-birth").value = d.candidate_birth_date || "";
    $("e-club").value = d.club || ""; $("e-president").value = d.president_email || "";
    $("e-parent").value = d.parent_email || ""; $("e-camp").value = d.camp_choice || "";
  }else{
    const rows = [["Candidate", d.candidate_email], ["Date of birth", d.candidate_birth_date ? fmtD(d.candidate_birth_date) + (isMinor(d.candidate_birth_date) ? " (under 18)" : "") : ""],
      ["District", (typeof MD !== "undefined" ? MD : "") + d.district],
      ["Club", d.club], ["Club president", d.president_email], ["Parent / guardian", d.parent_email], ["Preferred camp", d.camp_choice]];
    $("d-info").innerHTML = rows.map(function(r){ return "<div><span>" + r[0] + "</span><b>" + esc(r[1] || "—") + "</b></div>"; }).join("") +
      '<div id="d-afclub" hidden></div>';
    showAfClub(d);
  }

  // fichiers et checklist (sur le dossier complet ; le président ne voit que la copie club)
  const last = latestFile("zip");
  $("d-check").innerHTML = !last && latestFile("club")
    ? '<li class="sub">You have the club copy: the application form without health, religion and ID data, and the Commitment.</li>'
    : CHECKLIST.map(function(c){
    const hit = last && (last.contents || []).some(function(n){ return c.re.test(n.split("/").pop()); });
    if(/ID_document/.test(c.re.source) && hit && idPending()) return '<li class="later">⏳ ' + c.label + " — to follow (passport being renewed)</li>";
    return '<li class="' + (hit ? "yes" : "no") + '">' + (hit ? "✔" : "✖") + " " + c.label + "</li>";
  }).join("") + (last && (last.contents || []).some(function(n){ return /_club-signed\.docx$/i.test(n); })
    ? '<li class="yes">✔ Commitment countersigned by the club</li>' : "");
  $("d-files").innerHTML = CUR_FILES.length ? CUR_FILES.map(function(f, i){
    return "<li" + (f !== latestFile(f.kind) ? ' class="old"' : "") + "><button class=\"lnk\" onclick=\"downloadFile('" + f.id + "')\">⬇ " + esc(f.file_name) + "</button>" +
      ' <span class="sub">' + (f.size_bytes / 1048576).toFixed(1) + " MB · " + esc(f.uploaded_by) + " · " + fmtDT(f.uploaded_at) +
      " · <code>" + f.sha256.slice(0, 10) + "</code> · " + ({ club: "club copy", id: "passport / ID scan sent later" }[f.kind] || "full file") +
      (f === latestFile(f.kind) ? " · <b>current</b>" : " · previous") + "</span></li>";
  }).join("") : '<li class="sub">No file yet.</li>';
  show("d-upload", canUpload(d));
  // passeport à suivre : le candidat le dépose à tout moment avant l'envoi au pays d'accueil
  show("d-idupload", d.candidate_email === ME && d.status !== "draft" && idPending()
    && ["sent_host", "accepted", "refused", "archived"].indexOf(d.status) < 0);

  // signatures
  $("d-sigs").innerHTML = sigs.length ? sigs.map(function(s){
    const role = { parent: "Parent / guardian", president: "Club president", district: "District coordinator", national: "National YCE team" }[s.signer_role] || s.signer_role;
    // preuves relevées par la base au moment de signer : connexion par lien e-mail, double authentification
    const how = (s.auth_methods || []).some(function(m){ return m.method === "totp"; }) || s.aal === "aal2" ? "e-mail link + two-step code" : "e-mail link";
    return '<li title="' + esc(s.statement || "") + '">✍ <b>' + esc(role) + "</b> — " + esc(s.signer_email) + " · " + fmtDT(s.signed_at) +
      " · version <code>" + s.doc_sha256.slice(0, 10) + "</code>" + ' <span class="sub">· identity: ' + how + "</span></li>";
  }).join("") : '<li class="sub">No signature yet.</li>';

  // actions possibles à cette étape
  renderActions(d);

  // historique
  const items = events.map(function(e){
    let t = e.action;
    if(e.action === "status") t = "Status: " + (STATUS[e.detail.from] || {}).label + " → <b>" + (STATUS[e.detail.to] || {}).label + "</b>";
    else if(e.action === "upload") t = "Uploaded " + esc(e.detail.file);
    else if(e.action === "download") t = "Downloaded " + esc(e.detail.file);
    return { at: e.at, who: e.actor_email, html: t };
  }).concat(comments.map(function(c){ return { at: c.created_at, who: c.author_email, html: "💬 " + esc(c.body), cmt: true }; }));
  items.sort(function(a, b){ return a.at < b.at ? 1 : -1; });
  $("d-history").innerHTML = items.map(function(i){
    return '<li class="' + (i.cmt ? "cmt" : "") + '"><span class="sub">' + fmtDT(i.at) + " · " + esc(i.who) + "</span><div>" + i.html + "</div></li>";
  }).join("") || '<li class="sub">Nothing yet.</li>';
}

function renderActions(d){
  const A = [];
  const signStep = { parent_review: d.parent_email === ME ? ["submitted", "Approve as parent / guardian"] : null,
                     submitted: d.president_email === ME ? ["club_signed", "Sign as club president"] : null,
                     club_signed: isStaff("district", d.district) ? ["district_validated", "Validate & countersign (district)"] : null,
                     district_validated: isStaff("national") ? ["national_validated", "Validate (national YCE team)"] : null }[d.status];
  if(d.status === "draft" && d.candidate_email === ME){
    A.push(isMinor(d.candidate_birth_date)
      ? '<button class="btn" onclick="act(\'parent_review\')">📤 Send to my parent / guardian for approval</button>'
      : '<button class="btn" onclick="act(\'submitted\')">📤 Send to my club president</button>');
    if(!d.first_submitted_at) A.push('<button class="btn2 danger" onclick="withdraw()">Delete this draft</button>');
  }
  if((d.status === "submitted" || d.status === "parent_review") && d.candidate_email === ME) A.push('<button class="btn2" onclick="act(\'draft\')">↩ Take back to edit</button>');
  if(signStep){
    const doc = signedDoc(d);
    A.push('<label class="chk"><input type="checkbox" id="a-reviewed"> I have downloaded and reviewed the current ' +
      (doc && doc.kind === "club" ? "club copy" : "version") + (doc ? " (<code>" + doc.sha256.slice(0, 10) + "</code>)" : "") + "</label>");
    A.push('<button class="btn" onclick="act(\'' + signStep[0] + '\',true)">✍ ' + signStep[1] + "</button>");
  }
  if(d.status === "national_validated" && isStaff("national")) A.push(idPending()
    ? '<span class="sub">⏳ The passport scan is still to follow: the file can go to the host country once the candidate has uploaded it.</span>'
    : '<button class="btn" onclick="act(\'sent_host\')">✈ Mark as sent to the host country</button>');
  if(d.status === "sent_host" && isStaff("national")){
    A.push('<button class="btn" onclick="act(\'accepted\')">✔ Accepted by the host country</button>');
    A.push('<button class="btn2 danger" onclick="act(\'refused\')">✖ Refused</button>');
  }
  if((d.status === "accepted" || d.status === "refused") && isStaff("national")) A.push('<button class="btn2" onclick="act(\'archived\')">Archive</button>');
  const canReturn = (d.status === "parent_review" && d.parent_email === ME) ||
                    (d.status === "submitted" && d.president_email === ME) || (d.status === "club_signed" && isStaff("district", d.district)) ||
                    ((d.status === "district_validated" || d.status === "national_validated") && isStaff("national"));
  if(canReturn) A.push('<button class="btn2" onclick="act(\'draft\')">↩ Send back to the candidate for correction</button>');
  $("d-actions").innerHTML = A.length ? A.join("") : '<span class="sub">No action expected from you at this step.</span>';
}

async function saveEdit(){
  const pres = $("e-president").value.trim().toLowerCase(), birth = $("e-birth").value;
  if(pres && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pres)){ msg("The club president e-mail is not valid.", "err"); return; }
  if(!validBirth(birth)){ msg("Enter a valid date of birth.", "err"); return; }
  try{
    await API.updateDossier(CUR.id, { candidate_name: $("e-name").value.trim(), candidate_birth_date: birth, district: $("e-district").value,
      club: $("e-club").value.trim() || null, president_email: pres || null,
      parent_email: $("e-parent").value.trim().toLowerCase() || null, camp_choice: $("e-camp").value.trim() || null });
    msg("Saved.", "ok"); await loadDashboard(); openDossier(CUR.id);
  }catch(e){ msg("Could not save: " + e.message, "err"); }
}

async function uploadZip(input){
  const file = input.files[0]; input.value = "";
  if(!file) return;
  if(!/\.zip$/i.test(file.name)){ msg("Upload the ZIP file generated by the application form.", "err"); return; }
  if(file.size > 50 * 1048576){ msg("The file is too large (50 MB maximum).", "err"); return; }
  $("up-status").textContent = "Checking " + file.name + "…";
  try{
    const buf = await file.arrayBuffer();
    let names; // liste des fichiers lue sans décompression : une archive piégée ne coûte rien
    try{ names = zipNames(buf); }
    catch(e){ throw new Error("this file is not a valid ZIP (" + e.message + ")"); }
    const sha = await sha256Hex(buf);
    // copie pour le président : AF sans santé, religion ni pièce d'identité + Commitment
    $("up-status").textContent = "Preparing the club copy…";
    const clubBlob = await buildClubCopy(buf);
    const clubBuf = await clubBlob.arrayBuffer();
    const clubFile = new File([clubBuf], file.name.replace(/\.zip$/i, "") + "_CLUB-COPY.zip", { type: "application/zip" });
    $("up-status").textContent = "Uploading…";
    await API.upload(CUR.id, file, sha, names, "zip");
    await API.upload(CUR.id, clubFile, await sha256Hex(clubBuf), zipNames(clubBuf), "club", sha);
    $("up-status").textContent = "";
    msg("Uploaded: " + file.name + " (" + names.length + " files inside) and its club copy for the president.", "ok");
    openDossier(CUR.id);
  }catch(e){ $("up-status").textContent = ""; msg("Upload failed: " + e.message, "err"); }
}

// scan du passeport envoyé après coup (PDF ou image)
async function uploadIdLater(input){
  const file = input.files[0]; input.value = "";
  if(!file) return;
  if(!/\.(pdf|jpe?g|png)$/i.test(file.name)){ msg("Upload the passport scan as a PDF, JPG or PNG file.", "err"); return; }
  if(file.size > 15 * 1048576){ msg("The scan is too large (15 MB maximum).", "err"); return; }
  try{
    const buf = await file.arrayBuffer();
    const name = "ID_document_" + file.name.replace(/^ID_document_/i, "");
    await API.upload(CUR.id, new File([buf], name, { type: file.type }), await sha256Hex(buf), [name], "id");
    msg("Passport scan uploaded — thank you.", "ok");
    openDossier(CUR.id);
  }catch(e){ msg("Upload failed: " + e.message, "err"); }
}

async function downloadFile(fid){
  const f = CUR_FILES.find(function(x){ return x.id === fid; });
  try{ location.href = await API.downloadUrl(f); }
  catch(e){ msg("Download failed: " + e.message, "err"); }
}

// document approuvé à l'étape en cours : la copie club pour le président, le dossier complet sinon
function signedDoc(d){ return d.status === "submitted" && d.president_email === ME ? latestFile("club") : latestFile("zip"); }

async function act(target, needsReview){
  const d = CUR, doc = signedDoc(d);
  let note = null;
  if(needsReview && !$("a-reviewed").checked){ msg("Download and review the current version, then tick the box before signing.", "err"); return; }
  if(target === "draft" && d.candidate_email !== ME){
    note = prompt("What must the candidate correct? (this comment is visible in the file history)");
    if(!note || !note.trim()) return;
  }
  if(target === "refused"){ note = prompt("Reason for the refusal (optional, visible in the history):") || null; }
  try{
    // la signature porte sur l'empreinte du fichier réellement stocké, recalculée ici :
    // un fichier altéré ou déclaré avec une fausse empreinte ne peut pas être signé
    let sha = null;
    if(needsReview && doc){
      msg("Checking the file fingerprint…", "info");
      sha = await sha256Hex(await API.fileBytes(doc));
      if(sha !== doc.sha256){
        msg("The stored file does not match its recorded fingerprint: do not sign. Send the file back to the candidate or contact the national YCE team.", "err");
        return;
      }
    }
    await API.transition(d.id, target, note, sha);
    msg("Done: " + (STATUS[target] || {}).label + ".", "ok");
    await loadDashboard();
    await openDossier(d.id);
    offerNotify(target);
  }catch(e){ msg(e.message, "err"); }
}

// e-mail de notification : un lien vers le coffre, jamais de pièce jointe
function offerNotify(target){
  const d = CUR;
  let to = "", who = "";
  if(target === "parent_review"){ to = d.parent_email; who = "your parent / guardian"; }
  else if(target === "submitted"){ to = d.president_email; who = "the club president"; }
  else if(target === "club_signed" && typeof DISTRICTS !== "undefined" && DISTRICTS[d.district]){ to = DISTRICTS[d.district].email; who = "the district coordinator"; }
  else if(target === "draft" || target === "accepted" || target === "refused"){ to = d.candidate_email; who = "the candidate"; }
  const link = selfLink(d.id);
  const body = "Hello,\n\nThe Lions YCE application file of " + d.candidate_name + " has moved to a new step: " +
    (STATUS[target] || {}).label + ".\n\nOpen it in the secure vault (sign in with your e-mail address):\n" + link +
    "\n\nThe file itself is not attached: it stays in the vault.\n";
  $("notify").innerHTML = "📧 <b>Now let " + esc(who || "the next person") + " know</b>" + (to ? " (" + esc(to) + ")" : "") + " — the vault does not send this e-mail for you: " +
    (to ? '<a class="btn2" href="mailto:' + encodeURIComponent(to) + "?subject=" + encodeURIComponent("Lions YCE — application of " + d.candidate_name) +
      "&body=" + encodeURIComponent(body) + '">Write the e-mail</a> ' : "") +
    '<button class="btn2" onclick="copyLink()">Copy the link</button>';
  show("notify", true);
}
function copyLink(){
  const link = selfLink(CUR.id);
  if(navigator.clipboard) navigator.clipboard.writeText(link).then(function(){ msg("Link copied: " + link, "ok"); }, function(){ msg(link, "info"); });
  else msg(link, "info");
}

async function withdraw(){
  if(!confirm("Delete this draft and its files? This cannot be undone.")) return;
  try{
    await API.deleteDossier(CUR.id, CUR_FILES.map(function(f){ return f.path; }));
    msg("Draft deleted.", "ok");
    closeDossier(); loadDashboard();
  }catch(e){ msg("Could not delete: " + e.message, "err"); }
}

async function addComment(){
  const body = $("c-body").value.trim();
  if(!body) return;
  try{ await API.addComment(CUR.id, body); $("c-body").value = ""; openDossier(CUR.id); }
  catch(e){ msg("Could not add the comment: " + e.message, "err"); }
}

// ---------- club déclaré dans le formulaire de candidature ----------
// Section V de l'application form (club, président, mobile, e-mail), lue dans le dossier complet
// réellement déposé et montrée au coordinateur et au national à côté de l'adresse du président qui
// signe dans le coffre : rien n'est bloqué, une différence d'e-mail est simplement signalée.
const AF_CLUB_CELLS = [["club", "F67"], ["chair", "H68"], ["mobile", "AE68"], ["email", "E69"]];
async function readAfClub(zipBuf){
  const budget = zipBudget(); // partagé entre le ZIP et le formulaire .xlsx qu'il contient
  const outer = await unzip(zipBuf, budget);
  const af = outer.find(function(e){ return /\.xlsx$/i.test(e.name.split("/").pop()); });
  if(!af) return null;
  const entries = await unzip(af.data.buffer.slice(af.data.byteOffset, af.data.byteOffset + af.data.byteLength), budget);
  const sheet = entries.find(function(e){ return e.name === "xl/worksheets/sheet1.xml"; });
  if(!sheet) return null;
  const xml = new TextDecoder().decode(sheet.data), sst = parseShared(entries), out = {};
  AF_CLUB_CELLS.forEach(function(c){ out[c[0]] = getCellValue(xml, sst, c[1]); });
  return out;
}
async function showAfClub(d){
  const doc = latestFile("zip"), box = $("d-afclub");
  if(!doc || !box || !(isStaff("district", d.district) || isStaff("national"))) return;
  try{
    const c = await readAfClub(await API.fileBytes(doc));
    if(!c || CUR !== d) return;
    const differs = c.email && d.president_email && c.email.toLowerCase() !== d.president_email;
    box.innerHTML = "<span>Application form (club)</span><b>" + esc([c.club, c.chair, c.mobile, c.email].filter(Boolean).join(" · ") || "—") + "</b>" +
      (differs ? ' <span class="sub" style="color:var(--orange)">⚠ e-mail differs from the club president who signs here — to check</span>'
        : c.email && d.president_email ? ' <span class="sub">✔ same e-mail as the club president who signs here</span>' : "");
    box.hidden = false;
  }catch(e){ /* formulaire illisible : la ligne reste masquée */ }
}

// ---------- administration des intervenants ----------
async function loadStaff(){
  try{
    const rows = await API.staffList() || [];
    $("staff-list").innerHTML = rows.map(function(r){
      return "<tr><td>" + esc(r.email) + "</td><td>" + esc(r.full_name || "") + "</td><td>" + esc(r.role) + (r.district ? " " + esc(r.district) : "") +
        '</td><td><button class="btn2 danger" onclick="staffDelete(' + r.id + ')">Remove</button></td></tr>';
    }).join("") || '<tr><td colspan="4" class="empty">Nobody yet.</td></tr>';
  }catch(e){ msg("Could not load the team: " + e.message, "err"); }
}
async function staffAdd(){
  const role = $("s-role").value, district = $("s-district").value || null;
  const email = $("s-email").value.trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg("Enter a valid e-mail address.", "err"); return; }
  if(role === "district" && !district){ msg("Choose the district of this coordinator.", "err"); return; }
  try{
    await API.staffAdd({ email: email, role: role, district: role === "district" ? district : null, full_name: $("s-name").value.trim() || null });
    $("s-email").value = ""; $("s-name").value = ""; loadStaff();
    msg(email + " added as " + role + (role === "district" ? " " + district : "") + ".", "ok");
  }catch(e){ msg("Could not add: " + e.message, "err"); }
}
async function staffDelete(id){
  if(!confirm("Remove this person's role?")) return;
  try{ await API.staffDelete(id); loadStaff(); }catch(e){ msg("Could not remove: " + e.message, "err"); }
}

// ---------- purge (conservation : 2 ans après la saison, 90 jours après un refus) ----------
let PURGE = [];
async function loadPurge(){
  try{ PURGE = await API.purgeCandidates() || []; }catch(e){ PURGE = []; }
  $("purge-info").textContent = PURGE.length
    ? PURGE.length + " file(s) reached the end of their retention period and must be deleted."
    : "No file has reached the end of its retention period.";
  $("purge-btn").hidden = !PURGE.length;
}
async function runPurge(){
  if(!confirm("Permanently delete " + PURGE.length + " expired file(s) and all their documents?")) return;
  let n = 0;
  for(const c of PURGE){
    try{ await API.purge(c); n++; }catch(e){ msg("Purge stopped: " + e.message, "err"); break; }
  }
  if(n) msg(n + " expired file(s) deleted.", "ok");
  loadPurge(); loadDashboard();
}

document.addEventListener("DOMContentLoaded", vaultInit);
