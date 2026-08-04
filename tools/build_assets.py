#!/usr/bin/env python3
"""Regenerate js/assets.js (embedded templates + build version).

Run from the repository root after changing:
  - Application_form_2026_Distr_C_vierge.xlsx  (blank form embedded in the filler)
  - tools/commit_template.docx                 (Commitment template with §CAND§/§DATE§/[BODY]/[SIG*] markers)

Both files are repacked without compression (STORE) so the browser can read
them without inflating, then embedded as base64.
"""
import base64, datetime, io, subprocess, zipfile

def stored_b64(path):
    src = zipfile.ZipFile(path)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as out:
        for name in src.namelist():
            out.writestr(name, src.read(name))
    return base64.b64encode(buf.getvalue()).decode()

sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                     capture_output=True, text=True).stdout.strip() or "local"
version = "v" + datetime.datetime.utcnow().strftime("%Y.%m.%d") + "-" + sha

with open("js/assets.js", "w") as f:
    f.write("// FICHIER GENERE — ne pas éditer à la main.\n")
    f.write("// Regénérer avec :  python3 tools/build_assets.py  (depuis la racine du dépôt)\n")
    f.write('const BUILD="%s";\n' % version)
    f.write('const TEMPLATE_B64="%s";\n' % stored_b64("Application_form_2026_Distr_C_vierge.xlsx"))
    f.write('const COMMIT_B64="%s";\n' % stored_b64("tools/commit_template.docx"))
print("js/assets.js written,", version)
