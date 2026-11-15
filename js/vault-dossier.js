// vault-dossier.js — coffre : fiche d'un dossier (affichage, actions de l'étape, dépôt du ZIP et du scan d'identité, téléchargement,
// signature / validation, notification, retrait, commentaires) et lecture du club déclaré dans le formulaire de candidature.
// Chargé par yce_vault.html après js/vault.js ; scripts classiques partageant la portée globale.
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
    return "<li" + (f !== latestFile(f.kind) ? ' class="old"' : "") + "><button class=\"lnk\" onclick=\"downloadFile(" + jsArg(f.id) + ")\">⬇ " + esc(f.file_name) + "</button>" +
      ' <span class="sub">' + (f.size_bytes / 1048576).toFixed(1) + " MB · " + esc(f.uploaded_by) + " · " + fmtDT(f.uploaded_at) +
      " · <code>" + esc(String(f.sha256).slice(0, 10)) + "</code> · " + ({ club: "club copy", id: "passport / ID scan sent later" }[f.kind] || "full file") +
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
      " · version <code>" + esc(String(s.doc_sha256).slice(0, 10)) + "</code>" + ' <span class="sub">· identity: ' + how + "</span></li>";
  }).join("") : '<li class="sub">No signature yet.</li>';

  // actions possibles à cette étape
  renderActions(d);

  // historique
  const items = events.map(function(e){
    let t = esc(e.action); // action inconnue : affichée telle quelle, échappée
    if(e.action === "status") t = "Status: " + esc((STATUS[e.detail.from] || {}).label || e.detail.from) + " → <b>" + esc((STATUS[e.detail.to] || {}).label || e.detail.to) + "</b>";
    else if(e.action === "upload") t = "Uploaded " + esc(e.detail.file);
    else if(e.action === "download") t = "Downloaded " + esc(e.detail.file);
    else if(e.action === "email") t = "📧 Automatic e-mail sent to " + esc({ parent: "the parent / guardian", president: "the club president", district: "the district coordinator", national: "the national YCE team", candidate: "the candidate" }[e.detail.to] || e.detail.to);
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
      (doc && doc.kind === "club" ? "club copy" : "version") + (doc ? " (<code>" + esc(String(doc.sha256).slice(0, 10)) + "</code>)" : "") + "</label>");
    A.push('<button class="btn" onclick="act(' + jsArg(signStep[0]) + ',true)">✍ ' + esc(signStep[1]) + "</button>");
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
  if(typeof VAULT_AUTO_EMAIL !== "undefined" && VAULT_AUTO_EMAIL){ // le coffre prévient lui-même (fonction vault-notify)
    $("notify").innerHTML = "📧 <b>" + esc(who ? who.charAt(0).toUpperCase() + who.slice(1) : "The next person") + " will receive an e-mail from the vault</b>" +
      (to ? " (" + esc(to) + ")" : "") + " with the link to this file. " + '<button class="btn2" onclick="copyLink()">Copy the link</button>';
    show("notify", true);
    return;
  }
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
