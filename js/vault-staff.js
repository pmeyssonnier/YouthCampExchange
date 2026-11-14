// vault-staff.js — coffre : administration des intervenants (coordinateurs de district, équipe nationale, administrateurs)
// et purge des dossiers arrivés au terme de leur conservation.
// Chargé par yce_vault.html après js/vault.js ; scripts classiques partageant la portée globale.
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
