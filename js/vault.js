// vault.js — coffre des dossiers (yce_vault.html) : constantes, utilitaires, démarrage, connexion et double authentification.
// Les droits réels sont appliqués par la base ; l'interface n'affiche que les actions que la base acceptera pour ce compte et cette étape.
// Fichiers compagnons (chargés ensuite, même portée globale : API, ME, ROLES, DOSSIERS, CUR, CUR_FILES) :
//   js/vault-dashboard.js — tableau de bord : liste des dossiers, « à qui le tour », création
//   js/vault-dossier.js   — fiche d'un dossier : affichage, dépôt, signatures, commentaires, club déclaré dans le formulaire
//   js/vault-staff.js     — intervenants (coordinateurs, équipe nationale) et purge de conservation
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

document.addEventListener("DOMContentLoaded", vaultInit);
