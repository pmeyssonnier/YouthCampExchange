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
VAULT = ["js/zip.js", "js/xlsx.js", "js/club-copy.js", "js/vault-api.js", "js/vault.js",
         "js/vault-dashboard.js", "js/vault-dossier.js", "js/vault-staff.js"]
# administration (yce_admin.html) and public site (index.html), in load order
ADMIN = ["js/zip.js", "js/xlsx.js", "js/admin-core.js", "js/clean-html.js", "js/upload-limits.js",
         "js/admin-people.js", "js/admin-gallery.js", "js/admin.js",
         "js/camps-manager.js", "js/camps-match.js", "js/camps-import.js", "js/camps-geo.js", "js/admin-tabs.js"]
PUBLIC = ["js/clean-html.js", "js/site-data.js", "js/site-explorer.js", "js/site-map.js", "js/site-modal.js", "js/site-ui.js"]

ROLES = {
    "js/assets.js": "GENERATED — embedded templates (base64) + build version",
    "js/zip.js": "bounded ZIP reading (limits against booby-trapped archives) — shared",
    "js/xlsx.js": "ZIP writing + workbook cell read/write",
    "js/vault-api.js": "vault: the only layer talking to Supabase",
    "js/club-copy.js": "vault: reduced copy for the club president (AF without ID, religion, health + Commitment)",
    "js/vault.js": "vault UI core: constants, helpers, start-up, sign-in link, two-step verification",
    "js/vault-dashboard.js": "vault UI: dashboard — list of files, whose turn, new file",
    "js/vault-dossier.js": "vault UI: one file — display, upload, sign-off, notify, comments, club declared in the form",
    "js/vault-staff.js": "vault UI: staff (coordinators, national team) and retention purge",
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
    "js/admin-core.js": "shared admin plumbing: passphrase-encrypted token, GitHub API, atomic commits, connect hooks",
    "js/admin.js": "Site & season and Documents tabs: form, fees and bank details, save, official documents, start-up",
    "js/admin-people.js": "Site & season tab: district coordinators, multiple district number, national team",
    "js/admin-gallery.js": "Site & season tab: home page photo gallery",
    "js/camps-manager.js": "Camps tab: list, camp sheet, archive, JSON backup, save to the site",
    "js/camps-match.js": "Camps tab: is it the same camp? name/place similarity, renamed camps, duplicates",
    "js/camps-import.js": "Camps tab: official YCE directory (xlsx) import — parse, review, apply",
    "js/camps-geo.js": "Camps tab: map coordinates from a NextGIS GeoJSON export",
    "js/admin-tabs.js": "admin tab switching (#site, #camps, #docs)",
    "js/clean-html.js": "cleanHtml: the few formatting tags allowed in customisable texts — shared",
    "js/upload-limits.js": "upload size limits — shared",
    "js/site-data.js": "date helpers, CAMPS enrichment, season stats, HTML escaping",
    "js/site-explorer.js": "camp directory: filters with live counts, sorting, table, phone cards",
    "js/site-map.js": "world map (D3): continents, countries, one dot per camp",
    "js/site-modal.js": "camp sheet (modal) with its timeline",
    "js/site-ui.js": "team, payment and district cards, theme, mobile menu — runs init",
}
# a role that only holds in one file (the same function name exists elsewhere with another job)
FILE_FN_ROLES = {
    "js/admin-core.js": {"log": "activity journal of the page", "esc": "escape HTML", "gh": "GitHub API call with the token",
        "getFile": "read a file of the repository", "putFile": "write one file", "connect": "check the token, then unlock the page",
        "encryptToken": "token encrypted with the passphrase (kept in this browser)", "decryptToken": "unlock with the passphrase",
        "rawSpan": "position of the RAW camp array in camps_data.js", "logout": "forget the token", "initAccess": "choose token / passphrase screen"},
    "js/admin.js": {"fillForm": "show the site data in the form", "saveData": "save season, coordinators, home page in one commit",
        "parseSiteData": "read camps_data.js / districts_data.js as text", "buildDistrictsLiteral": "DISTRICTS block as written in the file",
        "uploadPick": "replace an official document", "ibanOk": "IBAN checksum", "upsertConst": "set a constant in a data file",
        "limShow": "attachment size limits fields", "paymentValues": "fee and bank details from the form", "annMode": "announcement: edit / preview"},
    "js/admin-people.js": {"distShow": "district coordinators list", "distApply": "validate a coordinator", "distRemove": "remove a district",
        "mdShow": "multiple district number", "teamShow": "national team list", "teamApply": "validate a member", "teamMove": "change the order"},
    "js/admin-gallery.js": {"galShow": "gallery thumbnails", "galPick": "add photos (reduced before upload)", "galMove": "change the order", "galZoom": "full-size preview"},
    "js/camps-manager.js": {"render": "camp table (search, continent, sort)", "setSort": "column sort", "openEdit": "open a camp sheet",
        "saveEdit": "validate and apply the sheet", "editIndex": "position of the open sheet's camp (followed by object)",
        "newCamp": "empty sheet", "deleteEditing": "delete the open camp", "archiveCamp": "move to the archive", "restoreCamp": "back from the archive",
        "exportJson": "JSON backup", "jsonPick": "restore a JSON backup", "saveSite": "write camps_data.js + camps_archive.json in one commit",
        "seasonOf": "YCE season of a camp (September to August)", "simple": "lower case, no accents, letters and digits only",
        "markDirty": "unsaved changes flag"},
    "js/camps-match.js": {"sim": "bigram similarity of two texts (0 to 1)", "stripNoise": "drop years and words like Lions / camp / YCE",
        "alike": "same camp? returns the reason (exact, same dates and place, …)", "likeness": "similarity percentage of two sheets",
        "matchCamp": "find a directory camp in a list", "findDuplicates": "possible duplicate pairs", "showDuplicates": "🔎 Check duplicates list",
        "factsOf": "facts of a saved camp used for matching", "factsOfT": "same facts for a directory line"},
    "js/camps-import.js": {"parseDirectory": "read the Approved Camps sheet of the xlsx (browser XML parser)", "xmlDoc": "parse an XML part, clear error if damaged",
        "xmlText": "text of a cell or shared string", "continentFor": "continent of a country (known camp, else table, else unknown)", "dirPick": "directory file chosen → review",
        "mdyToDmy": "MM-DD-YYYY or Excel serial → dd-mm-yyyy", "feeOf": "fee with its currency", "changesFor": "fields the directory would change",
        "replacesFor": "earlier camp a new one may replace", "buildReview": "review list: updates, renames, new camps",
        "applyReview": "apply the ticked lines all together, or nothing (directory or coordinates)", "snapshotCamps": "state of the camps before applying",
        "restoreCamps": "put that state back (same objects)", "checkCamp": "last check of an imported camp; an anomaly cancels everything",
        "showReport": "final report: read, applied, ignored, rejected", "reportLines": "row · country — camp: reason", "cancelReview": "close the review"},
    "js/camps-geo.js": {"mercToLonLat": "EPSG:3857 → longitude, latitude", "geoPick": "GeoJSON file chosen", "geoPoints": "points with a country and a camp name",
        "buildGeoReview": "match points to camps, review list"},
    "js/site-data.js": {"esc": "escape HTML (every camp value goes through it)", "parseDate": "dd-mm-yyyy → Date (real dates only)",
        "feeEuro": "fee in euros, for sorting", "titleCase": "uniform display of camp names", "countryFlag": "flag emoji of a country",
        "periodRows": "family stay / camp date lines", "safeMail": "valid e-mail or null", "jsArg": "safe text argument of an onclick"},
    "js/site-explorer.js": {"campMatches": "does a camp pass the filters (some may be skipped for counts)", "facetCounts": "count per chip value",
        "refreshFacets": "recount every filter chip", "getFiltered": "camps passing all filters", "getSorted": "sort for table and cards",
        "renderTable": "table + phone cards + map refresh", "renderMobileCards": "phone cards", "renderFilterChips": "active filter chips",
        "applyFilters": "read age / period, then redraw", "resetFilters": "clear every filter", "populatePeriodSelect": "month / half-month / week choices"},
    "js/vault.js": {"esc": "escape HTML", "msg": "message banner", "isStaff": "does my account hold this role", "isMinor": "under 18 at the reference date",
        "vaultInit": "create the Supabase client, resume the session", "sendLink": "e-mail sign-in link", "startSession": "after sign-in: roles, then dashboard",
        "mfaNeeded": "two-step code required for staff", "mfaVerify": "check the code", "applicationSeason": "season being applied for", "sha256Hex": "fingerprint of a file"},
    "js/vault-dashboard.js": {"myTurn": "is this file waiting for me", "waitingFor": "who must act next", "renderNext": "next-step line of a file",
        "loadDashboard": "read my files", "renderList": "files table", "createDossier": "new file (consent recorded)", "renderWelcome": "welcome text by role"},
    "js/vault-dossier.js": {"openDossier": "load one file", "renderDossier": "file page: checklist, signatures, history, comments", "renderActions": "buttons allowed at this step",
        "uploadZip": "store the application ZIP (and the club copy)", "uploadIdLater": "passport scan sent later", "downloadFile": "signed download link",
        "act": "sign / validate / refuse: move to the next step", "offerNotify": "prepare the e-mail to the next person", "withdraw": "delete my file",
        "addComment": "comment on the file", "readAfClub": "club cells of the application form", "showAfClub": "compare the declared club with the file",
        "saveEdit": "save the file's identity fields", "canUpload": "may this account upload", "signedDoc": "document the signature refers to"},
    "js/vault-staff.js": {"loadStaff": "staff list", "staffAdd": "add a coordinator / national member", "staffDelete": "remove one",
        "loadPurge": "files past their retention", "runPurge": "delete them (logged)"},
    "js/site-modal.js": {"showCampDetail": "open the camp sheet", "buildTimeline": "family stay and camp on a time line"},
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
        mk["role"] = FILE_FN_ROLES.get(path, {}).get(mk["name"]) or FN_ROLES.get(mk["name"], "")
        # comment written just above the definition in the source (shown when a line of the map is opened)
        doc, k = [], mk["line"] - 2
        while k >= 0 and lines[k].lstrip().startswith("//") and not re.match(r"\s*// ?-{4,}", lines[k]):
            doc.insert(0, lines[k].lstrip()[2:].strip())
            k -= 1
        if doc:
            mk["doc"] = " ".join(doc)[:600]
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

def links(mods):
    """Per definition: the names of the page it uses, and where it is used (file · function)."""
    bodies = []
    for m in mods:
        if m["file"].endswith("assets.js"):
            continue
        ls = m["src"].split("\n")
        for d in m["defs"]:
            bodies.append((m, d, "\n".join(ls[d["line"] - 1:d["line"] - 1 + d["loc"]])))
    owner = {}
    for m, d, _ in bodies:
        owner.setdefault(d["name"], m["file"])
    for m, d, body in bodies:
        words = set(re.findall(r"[A-Za-z_$][\w$]*", body))
        d["calls"] = sorted(n for n in words if n in owner and n != d["name"]
                            and (owner[n] == m["file"] or n not in {x["name"] for x in m["defs"]}))[:40]
    for m, d, _ in bodies:
        used = sorted({m2["file"][3:-3] + " · " + d2["name"] for m2, d2, _ in bodies
                       if d2 is not d and d["name"] in d2.get("calls", [])
                       and (m2["file"] == m["file"] or owner[d["name"]] == m["file"])})
        d["usedBy"] = used[:40]

def pack(files):
    mods = [scan(f) for f in files]
    e = edges(mods)
    links(mods)
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
    ("js/toolnav.js", "tool menu under the header of every tool page"),
    ("css/tools.css", "styles shared by the tool pages"),
    ("yce_vault.html", "application vault HTML shell (Supabase)"),
    ("supabase/vault_schema.sql", "vault database: tables, row-level security, workflow, retention"),
    ("supabase/security_check.sql", "vault security self-check to run on the real project (every line must be true)"),
    ("supabase/vault_hardening_2026_11.sql", "one-off upgrade of a vault installed before version 1.39.0"),
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
           "admin": pack(ADMIN), "public": pack(PUBLIC),
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
      + md_modules("Vault modules", codemap["vault"]) + md_modules("Administration modules", codemap["admin"]) \
      + md_modules("Public site modules", codemap["public"])
md += ["## Data, tools and other files", "", "| File | Size | Role |", "|---|---:|---|"]
md += ["| `%s` | %.1f KB | %s |" % (d["file"], d["bytes"] / 1024, d["role"]) for d in data_files]
for _title, _key in [("form filler", "filler"), ("tracker", "tracker"), ("vault", "vault"), ("administration", "admin"), ("public site", "public")]:
    md += ["", "## Who uses what (%s)" % _title, "", "| Defined in | Used by | Names |", "|---|---|---|"]
    md += ["| `%s` | `%s` | %s |" % (e["from"], e["to"], ", ".join(e["names"][:12]) + (" …" if len(e["names"]) > 12 else ""))
           for e in codemap[_key]["edges"]]
with open("docs/CODE_MAP.md", "w") as f:
    f.write("\n".join(md) + "\n")
print("docs/CODE_MAP.md written")
