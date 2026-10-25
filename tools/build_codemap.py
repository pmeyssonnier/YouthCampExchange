#!/usr/bin/env python3
"""Regenerate docs/codemap-data.js by scanning the actual source files.

Run from the repository root:  python3 tools/build_codemap.py
The visualisation docs/code_map.html reads the generated file.
"""
import json, os, re, subprocess, datetime

FILLER = ["js/assets.js", "js/zip.js", "js/xlsx.js", "js/docx.js", "js/signatures.js",
          "js/attachments.js", "js/storage.js",
          "js/club-signing.js", "js/sections.js", "js/country.js",
          "js/render.js", "js/form.js"]
TRACKER = ["js/zip.js", "js/tracker-storage.js", "js/tracker-parser.js",
           "js/tracker-export.js", "js/tracker-ui.js"]
VAULT = ["js/zip.js", "js/club-copy.js", "js/vault-api.js", "js/vault.js"]

ROLES = {
    "js/assets.js": "GENERATED — embedded templates (base64) + build version",
    "js/zip.js": "bounded ZIP reading (limits against booby-trapped archives) — shared",
    "js/xlsx.js": "ZIP writing + workbook cell read/write",
    "js/vault-api.js": "vault: the only layer talking to Supabase",
    "js/club-copy.js": "vault: reduced copy for the club president (AF without ID, religion, health + Commitment)",
    "js/vault.js": "vault UI: sign-in, dashboard, file, signatures, team, retention",
    "js/docx.js": "Commitment: text, validation, signed Word generation",
    "js/signatures.js": "signature pads + pasting signatures into the workbook",
    "js/attachments.js": "pass photo & payment proof",
    "js/storage.js": "local draft persistence",
    "js/club-signing.js": "?sign=club remote counter-signing",
    "js/sections.js": "declarative form definition (SECTIONS, camps list, mode flags)",
    "js/country.js": "default country, dial codes, phone normalisation",
    "js/render.js": "section/widget rendering, X-groups, counter",
    "js/form.js": "orchestration: generate() and init() — loaded last",
    "js/tracker-storage.js": "rows + localStorage persistence",
    "js/tracker-parser.js": "file ingestion: zip, xlsx forms, commitment, attachments",
    "js/tracker-export.js": "CSV export for Excel",
    "js/tracker-ui.js": "table, filters, sorting, stats — runs render()",
}

FN_ROLES = {
    "unzip": "parse a zip into [{name,data}] within ZIP_LIMITS", "zipDirectory": "validated central directory, no decompression",
    "zipNames": "file names of an archive without decompressing", "ZIP_LIMITS": "entries / size / ratio caps",
    "csvSafe": "neutralise spreadsheet formulas in CSV cells", "buildClubCopy": "full dossier ZIP → club copy ZIP", "redactApplicationForm": "empties ID / religion / health cells", "dropUnusedShared": "removes orphan Excel shared strings", "commitFiles": "atomic multi-file commit (Git Data API)",
    "validDmy": "real calendar date check", "DRAFT_MAX_DAYS": "local draft expiry", "buildZip": "rebuild a zip Blob",
    "crc32": "CRC-32 for zip writing", "inflateRaw": "native inflate", "deflateRaw": "native deflate",
    "getCellValue": "read one cell", "getCell": "read one cell", "setCell": "write/clear one cell keeping style",
    "parseShared": "sharedStrings table", "textOf": "concat <t> runs", "decodeEnt": "XML entities",
    "syncFromTemplate": "prefill inputs + X-groups from a workbook", "loadTemplate": "'Other template' input",
    "setStatus": "status bar helper", "collectValues": "gather all field values (+phone check)",
    "b64ToBuf": "base64 → ArrayBuffer", "escXml": "escape XML", "fmtDate": "ISO → dd-mm-yyyy",
    "commitShow": "sync validate button + card UI", "commitCardClick": "card: scroll or download",
    "commitToggle": "validate/cancel (needs applicant+parent sigs)",
    "commitTextShow": "refresh commitment text", "commitTextUpload": "admin: text from a Word doc",
    "commitTextReset": "restore official text", "docxReplaceRun": "swap a marker run",
    "docxSigRun": "inline image run XML", "buildCommitmentDoc": "fill + sign the Commitment",
    "sigInit": "canvas pads + auto date", "sigClear": "clear a pad", "sigUpload": "signature from an image",
    "dataUrlToBytes": "dataURL → bytes", "addSignatures": "anchor inked pads in the workbook",
    "photoPick": "photo upload + downscale 800px", "photoShow": "preview", "photoClear": "remove",
    "payPick": "proof upload (PDF as-is, images 1600px)", "payShow": "preview", "payClear": "remove",
    "saveDraft": "persist everything (debounced)", "restoreDraft": "restore everything", "clearForm": "wipe + reload",
    "mailPresident": "mailto club president (+?sign=club steps)", "mailCoordinator": "mailto district coordinator",
    "openMail": "navigation seam (testable)",
    "signCommitmentFile": "insert club signature at bookmark",
    "esc": "escape HTML", "render": "render all sections & widgets",
    "depShow": "conditional 'specify' fields", "xsel": "X-group selection",
    "initLists": "country/camp datalists", "syncCamps": "filter camps by country",
    "countryCfg": "current country config", "normPhone": "international normalisation",
    "validPhone": "phone validation", "wirePhones": "tel inputs wiring",
    "applyCountry": "prefill nationality/country", "setCountry": "admin selector",
    "ynClick": "Yes/No & pill buttons", "refreshYn": "sync button visuals",
    "updState": "State field visibility", "upd": "fields-completed counter",
    "generate": "orchestrator: cells, signatures, downloads, e-mails", "init": "mode setup + startup",
    "handleFiles": "dispatch dropped files (zip first-class)", "parseForm": "extract a form into a row",
    "findRowByName": "match a file to a row", "matchCommit": "commitment + club-signature detection",
    "matchAux": "photo / payment proof", "norm": "normalise for matching", "rowKey": "row identity",
    "save": "persist rows", "clearAll": "wipe rows", "log": "activity journal",
    "isComplete": "file completeness", "setDist": "district filter", "setSort": "column sort",
    "exportCsv": "24-column CSV (BOM + ;)",
}

def scan(path):
    src = open(path, encoding="utf-8").read()
    lines = src.split("\n")
    marks = []
    for i, ln in enumerate(lines):
        m = re.match(r'^(?:async )?function (\w+)|^const (\w+)\s*=|^let (\w+)\s*=|^(SECTIONS)\.push', ln)
        if m:
            name = next(g for g in m.groups() if g)
            kind = "fn" if ln.lstrip().startswith(("function", "async")) else "state"
            marks.append({"name": name, "line": i + 1, "kind": kind})
    for j, mk in enumerate(marks):
        end = marks[j + 1]["line"] - 1 if j + 1 < len(marks) else len(lines)
        mk["loc"] = max(1, end - mk["line"] + 1)
        mk["role"] = FN_ROLES.get(mk["name"], "")
    return {"file": path, "lines": len(lines), "bytes": os.path.getsize(path),
            "role": ROLES.get(path, ""), "defs": marks, "src": src}

def edges(mods):
    names = {m["file"]: {d["name"] for d in m["defs"]} for m in mods}
    out = []
    for m in mods:
        for g in mods:
            if g["file"] == m["file"]:
                continue
            used = sorted(n for n in names[g["file"]] - names[m["file"]]
                          if re.search(r"\b" + re.escape(n) + r"\b", m["src"]))
            if used:
                out.append({"from": g["file"], "to": m["file"], "names": used})
    return out

def pack(files):
    mods = [scan(f) for f in files]
    e = edges(mods)
    for m in mods:
        del m["src"]
        if m["file"].endswith("assets.js"):
            m["generated"] = True
    return {"modules": mods, "edges": e}

def _fl(path):
    return "%s (%d ln, %.1f KB)" % (path, len(open(path).read().split("\n")), os.path.getsize(path)/1024)

site = {"file": "index.html", "lines": len(open("index.html").read().split("\n")),
        "bytes": os.path.getsize("index.html"),
        "blocks": [
            {"name": _fl("index.html"), "role": "HTML shell: nav · hero · program · explorer · Brussels · apply · testimonials · team · footer"},
            {"name": _fl("css/site.css"), "role": "site + explorer + map + modal styles, light/dark, responsive"},
            {"name": _fl("js/site-data.js"), "role": "date helpers, CAMPS enrichment, season stats, HTML escaping (esc / jsArg / safeUrl / cleanHtml)"},
            {"name": _fl("js/site-explorer.js"), "role": "directory: getFiltered/getSorted/renderTable + all filters, tabs"},
            {"name": _fl("js/site-map.js"), "role": "world map (D3): initMap/renderWorldBubbles/zoomContinent/zoomCountry/showCountryCamps"},
            {"name": _fl("js/site-modal.js"), "role": "camp detail modal: showCampDetail/buildTimeline"},
            {"name": _fl("js/site-ui.js"), "role": "theme toggle, mobile nav, scroll-reveal, Belgium teaser — runs init"},
        ]}

data_files = [{"file": f, "bytes": os.path.getsize(f), "role": r} for f, r in [
    ("camps_data.js", "season data: SEASON + YEAR + RAW camps — common to every deployment"),
    ("districts_data.js", "per-deployment data: SITE_REPO + DISTRICTS coordinators"),
    ("js/version.js", "site version number (VERSION), shown on every page — bumped by each pull request"),
    ("CHANGELOG.md", "what changed in each version"),
    ("yce_form_filler.html", "filler HTML shell + styles"),
    ("yce_tracker.html", "tracker HTML shell + styles"),
    ("yce_admin.html", "administration HTML shell: tabs Site & season / Camps / Documents"),
    ("yce_camps.html", "old camp manager address — redirects to yce_admin.html#camps"),
    ("js/admin-core.js", "shared admin plumbing (token, passphrase, GitHub API, connect hooks)"),
    ("js/admin.js", "admin Site & Documents tabs: season, coordinators, home page, gallery, uploads"),
    ("js/camps-manager.js", "admin Camps tab: directory import, editing, backups, archive"),
    ("js/admin-tabs.js", "admin tab switching (#site, #camps, #docs)"),
    ("js/toolnav.js", "tool menu under the header of every tool page"),
    ("css/tools.css", "styles shared by the tool pages"),
    ("yce_vault.html", "application vault HTML shell (Supabase)"),
    ("js/vault-api.js", "vault: the only layer talking to Supabase"),
    ("js/vault.js", "vault UI: sign-in, dashboard, file, signatures, team, retention"),
    ("supabase/vault_schema.sql", "vault database: tables, row-level security, workflow, retention"),
    ("docs/VAULT_SETUP.md", "vault setup guide (Supabase project, SMTP, GDPR)"),
    ("tools/build_assets.py", "regenerates js/assets.js"),
    ("tools/build_codemap.py", "regenerates this visualisation's data and docs/CODE_MAP.md"),
    ("tests/", "security & regression tests run by GitHub Actions (npm test)"),
    ("documents/", "official documents: reference form, Commitment, host-family letter, Commitment template (markers)"),
]]

sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                     capture_output=True, text=True).stdout.strip() or "local"
codemap = {"generated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
           "commit": sha,
           "filler": pack(FILLER), "tracker": pack(TRACKER), "vault": pack(VAULT),
           "site": site, "data": data_files}

with open("docs/codemap-data.js", "w") as f:
    f.write("// FICHIER GENERE — python3 tools/build_codemap.py\n")
    f.write("const CODEMAP=" + json.dumps(codemap, ensure_ascii=False) + ";\n")
print("docs/codemap-data.js written,", sha)

# ---------- docs/CODE_MAP.md : même contenu, lisible sur GitHub (généré, ne pas éditer) ----------
PAGES = [
    ("index.html", "public site: programme, camp directory + world map, how to apply, district contacts"),
    ("yce_form_filler.html", "candidate form → Excel AF + Commitment + ZIP; ?sign=club / ?sign=district countersigning; ?district=X"),
    ("yce_tracker.html", "district coordinator tracker: drop received ZIPs, completeness, CSV export"),
    ("yce_admin.html", "administration, one token: Site & season (coordinators, home page, gallery) · Camps (directory import, edit, archive, JSON backup) · Documents"),
    ("yce_vault.html", "application vault (Supabase): central storage, sign-off workflow, retention"),
    ("docs/code_map.html", "interactive version of this map"),
]
def md_modules(title, group):
    out = ["## " + title, "", "| Module | Lines | Size | Role |", "|---|---:|---:|---|"]
    for m in group["modules"]:
        out.append("| `%s` | %d | %.1f KB | %s |" % (m["file"], m["lines"], m["bytes"] / 1024, m["role"]))
    out.append("")
    for m in group["modules"]:
        if m.get("generated"):
            continue
        fns = [d for d in m["defs"] if d["kind"] == "fn"]
        if not fns:
            continue
        out.append("**`%s`** — " % m["file"] + ", ".join(
            "`%s`%s" % (d["name"], " (" + d["role"] + ")" if d["role"] else "") for d in fns))
        out.append("")
    return out
md = ["# Code map — Lions YCE", "",
      "> **Generated file — do not edit by hand.** Rebuilt by `python3 tools/build_codemap.py` "
      "(run automatically on every push to `main`).",
      "> Commit `%s`, %s. Interactive version: [`code_map.html`](code_map.html)." % (sha, codemap["generated"]), "",
      "## Pages", "", "| Page | Role |", "|---|---|"]
md += ["| `%s` | %s |" % p for p in PAGES]
md += ["", "## Public site (`index.html`)", "", "| File | Role |", "|---|---|"]
md += ["| %s | %s |" % (b["name"], b["role"]) for b in site["blocks"]]
md += [""] + md_modules("Form filler modules", codemap["filler"]) + md_modules("Tracker modules", codemap["tracker"]) \
      + md_modules("Vault modules", codemap["vault"])
md += ["## Data, tools and other files", "", "| File | Size | Role |", "|---|---:|---|"]
md += ["| `%s` | %.1f KB | %s |" % (d["file"], d["bytes"] / 1024, d["role"]) for d in data_files]
md += ["", "## Who uses what (form filler)", "", "| Defined in | Used by | Names |", "|---|---|---|"]
md += ["| `%s` | `%s` | %s |" % (e["from"], e["to"], ", ".join(e["names"][:12]) + (" …" if len(e["names"]) > 12 else ""))
       for e in codemap["filler"]["edges"]]
with open("docs/CODE_MAP.md", "w") as f:
    f.write("\n".join(md) + "\n")
print("docs/CODE_MAP.md written")
