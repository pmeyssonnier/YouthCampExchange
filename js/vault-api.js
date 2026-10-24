// vault-api.js — accès au coffre Supabase : seul fichier qui parle au serveur.
// Toutes les règles d'accès sont appliquées côté base (supabase/vault_schema.sql) ;
// l'interface ne fait que refléter ce que la base autorise.
const VAULT_BUCKET = "dossiers";

function makeVaultApi(sb){
  async function x(p){
    const r = await p;
    if(r.error) throw new Error(r.error.message || String(r.error));
    return r.data;
  }
  function safeName(n){ return n.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9._-]+/g,"_"); }

  return {
    async session(){ const r = await sb.auth.getSession(); return r.data.session; },
    onAuth(cb){ sb.auth.onAuthStateChange(function(ev, s){ cb(s); }); },
    sendLink(email, redirect){
      return x(sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } }));
    },
    signOut(){ return sb.auth.signOut(); },

    myRoles(){ return x(sb.rpc("my_roles")); },
    listDossiers(){ return x(sb.from("dossiers").select("*").order("updated_at", { ascending: false })); },
    getDossier(id){ return x(sb.from("dossiers").select("*").eq("id", id).maybeSingle()); },
    createDossier(d){ return x(sb.from("dossiers").insert(d).select().single()); },
    updateDossier(id, patch){ return x(sb.from("dossiers").update(patch).eq("id", id).select().single()); },
    async deleteDossier(id, paths){ // fichiers du stockage d'abord : la ligne seule les laisserait orphelins
      if(paths && paths.length) await x(sb.storage.from(VAULT_BUCKET).remove(paths));
      return x(sb.from("dossiers").delete().eq("id", id));
    },

    files(id){ return x(sb.from("dossier_files").select("*").eq("dossier_id", id).order("uploaded_at", { ascending: false })); },
    // kind "zip" = dossier complet (dossier full/) ; "club" = copie du président (dossier club/),
    // qui indique l'empreinte du dossier complet dont elle est tirée
    async upload(id, file, sha256, contents, kind, sourceSha){
      kind = kind || "zip";
      const path = id + "/" + (kind === "zip" ? "full" : "club") + "/" + Date.now() + "_" + safeName(file.name);
      await x(sb.storage.from(VAULT_BUCKET).upload(path, file, { contentType: file.type || "application/zip", upsert: false }));
      return x(sb.from("dossier_files").insert({ dossier_id: id, kind: kind, path: path, file_name: file.name,
        sha256: sha256, size_bytes: file.size, contents: contents || [], source_sha: sourceSha || null }).select().single());
    },
    async downloadUrl(f){ // lien de téléchargement valable 5 minutes, journalisé
      const d = await x(sb.storage.from(VAULT_BUCKET).createSignedUrl(f.path, 300, { download: f.file_name }));
      await x(sb.rpc("dossier_log", { did: f.dossier_id, what: "download", info: { file: f.file_name } }));
      return d.signedUrl;
    },

    transition(id, target, note, sha){
      return x(sb.rpc("dossier_transition", { did: id, target: target, note: note || null, doc_sha256: sha || null }));
    },
    comments(id){ return x(sb.from("comments").select("*").eq("dossier_id", id).order("created_at")); },
    addComment(id, body){ return x(sb.from("comments").insert({ dossier_id: id, body: body })); },
    events(id){ return x(sb.from("events").select("*").eq("dossier_id", id).order("at")); },
    signatures(id){ return x(sb.from("signatures").select("*").eq("dossier_id", id).order("signed_at")); },

    // double authentification (TOTP) — exigée par la base pour les coordinateurs, le national et l'admin
    async mfaStatus(){
      const a = await x(sb.auth.mfa.getAuthenticatorAssuranceLevel());
      const f = await x(sb.auth.mfa.listFactors());
      return { current: a.currentLevel, verified: (f.totp || []).filter(function(t){ return t.status === "verified"; }),
               pending: (f.all || []).filter(function(t){ return t.factor_type === "totp" && t.status !== "verified"; }) };
    },
    async mfaEnroll(){ // supprime une inscription restée inachevée, puis en crée une (QR code à scanner)
      const st = await this.mfaStatus();
      for(const p of st.pending) await x(sb.auth.mfa.unenroll({ factorId: p.id }));
      const d = await x(sb.auth.mfa.enroll({ factorType: "totp", issuer: "Lions YCE", friendlyName: "Lions YCE " + Date.now() }));
      return { factorId: d.id, qr: d.totp.qr_code, secret: d.totp.secret };
    },
    mfaVerify(factorId, code){ return x(sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code })); },

    staffList(){ return x(sb.from("staff").select("*").order("role").order("district")); },
    staffAdd(row){ return x(sb.from("staff").insert(row)); },
    staffDelete(id){ return x(sb.from("staff").delete().eq("id", id)); },

    purgeCandidates(){ return x(sb.rpc("purge_candidates")); },
    async purge(c){ // fichiers du stockage d'abord, puis la ligne (et tout son historique)
      if(c.paths && c.paths.length) await x(sb.storage.from(VAULT_BUCKET).remove(c.paths));
      return x(sb.rpc("dossier_purge", { did: c.id }));
    }
  };
}
