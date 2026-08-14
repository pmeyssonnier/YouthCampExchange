#!/usr/bin/env python3
"""Regenerate docs/codemap-data.js by scanning the actual source files.

Run from the repository root:  python3 tools/build_codemap.py
The visualisation docs/code_map.html reads the generated file.
"""
import json, os, re, subprocess, datetime

FILLER = ["js/assets.js", "js/xlsx.js", "js/docx.js", "js/signatures.js",
          "js/attachments.js", "js/storage.js", "js/email.js",
          "js/club-signing.js", "js/sections.js", "js/country.js",
          "js/render.js", "js/form.js"]
TRACKER = ["js/tracker-storage.js", "js/tracker-parser.js",
           "js/tracker-export.js", "js/tracker-ui.js"]

ROLES = {
    "js/assets.js": "GENERATED — embedded templates (base64) + build version",
    "js/xlsx.js": "zip library + workbook cell read/write",
    "js/docx.js": "Commitment: text, validation, signed Word generation",
    "js/signatures.js": "signature pads + pasting signatures into the workbook",
    "js/attachments.js": "pass photo & payment proof",
    "js/storage.js": "local draft persistence",
    "js/email.js": "prefilled e-mails (club president, district coordinator)",
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
    "unzip": "parse a zip into [{name,data}]", "buildZip": "rebuild a zip Blob",
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
            {"name": _fl("js/site-data.js"), "role": "date helpers, CAMPS enrichment, season stats, camp counts"},
            {"name": _fl("js/site-explorer.js"), "role": "directory: getFiltered/getSorted/renderTable + all filters, tabs"},
            {"name": _fl("js/site-map.js"), "role": "world map (D3): initMap/renderWorldBubbles/zoomContinent/zoomCountry/showCountryCamps"},
            {"name": _fl("js/site-modal.js"), "role": "camp detail modal: showCampDetail/buildTimeline"},
            {"name": _fl("js/site-ui.js"), "role": "theme toggle, mobile nav, scroll-reveal, Belgium teaser — runs init"},
        ]}

data_files = [{"file": f, "bytes": os.path.getsize(f), "role": r} for f, r in [
    ("camps_data.js", "season data: SEASON + RAW (91 camps), shared site/filler"),
    ("yce_form_filler.html", "filler HTML shell + styles"),
    ("yce_tracker.html", "tracker HTML shell + styles"),
    ("tools/build_assets.py", "regenerates js/assets.js"),
    ("tools/build_codemap.py", "regenerates this visualisation's data"),
    ("tools/commit_template.docx", "Commitment template (markers)"),
]]

sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                     capture_output=True, text=True).stdout.strip() or "local"
codemap = {"generated": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
           "commit": sha,
           "filler": pack(FILLER), "tracker": pack(TRACKER),
           "site": site, "data": data_files}

with open("docs/codemap-data.js", "w") as f:
    f.write("// FICHIER GENERE — python3 tools/build_codemap.py\n")
    f.write("const CODEMAP=" + json.dumps(codemap, ensure_ascii=False) + ";\n")
print("docs/codemap-data.js written,", sha)
