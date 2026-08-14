#!/usr/bin/env python3
"""Regenerate js/assets.js (embedded templates + build version)
and camps.json (plain-JSON export of the season's camp data).

Run from the repository root after changing:
  - Application_form_2026_MD112.xlsx           (single neutral reference form embedded in the filler)
  - tools/commit_template.docx                 (Commitment template with §CAND§/§DATE§/[BODY]/[SIG*] markers)
  - camps_data.js                              (SEASON + RAW camp data → re-exports camps.json)

Both templates are repacked without compression (STORE) so the browser can
read them without inflating, then embedded as base64.
"""
import base64, datetime, io, json, re, subprocess, zipfile

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
    f.write('const TEMPLATE_B64="%s";\n' % stored_b64("Application_form_2026_MD112.xlsx"))
    f.write('const COMMIT_B64="%s";\n' % stored_b64("tools/commit_template.docx"))
print("js/assets.js written,", version)

# camps.json — export JSON pur des données de camps_data.js (source unique)
src = open("camps_data.js", encoding="utf-8").read()
season = re.search(r'const SEASON\s*=\s*"([^"]*)"', src).group(1)
raw = re.search(r'const RAW\s*=\s*(\[.*\]);', src, re.S).group(1)
camps = json.loads(raw)  # RAW est du JSON standard : toute erreur de syntaxe casse le build ici
with open("camps.json", "w", encoding="utf-8") as f:
    json.dump({"season": season, "camps": camps}, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("camps.json written, %d camps, season %s" % (len(camps), season))
