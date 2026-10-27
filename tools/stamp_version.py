#!/usr/bin/env python3
"""Stamp the site version and a content fingerprint on the local scripts and stylesheets of every page.

Each page loads its files as  src="js/x.js?v=1.5.1.3fa2b7c0"  /  href="css/x.css?v=1.5.1.9e01d4aa":
the site version, then the first 8 hex digits of the file's SHA-256. The address changes as soon as
the file changes, so a browser never keeps an old copy: neither after a new version, nor after the
administration page saves new camps or coordinators (camps_data.js, districts_data.js), which
changes the data without changing the version. Run after raising VERSION in js/version.js:

    python3 tools/stamp_version.py

The "Rebuild generated files" workflow runs it after every push to main (administration saves
included). The "version" test checks that every page is stamped with the current version and the
current fingerprint of each file.
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = re.search(r'const VERSION = "([^"]+)"', (ROOT / "js/version.js").read_text()).group(1)
# local .js / .css only (no scheme, no leading slash), with or without an existing ?v=
REF = re.compile(r'((?:src|href)=")((?![a-z]+:|/)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?"')


def stamp(path):
    f = ROOT / path
    if not f.is_file():
        return VERSION
    return VERSION + "." + hashlib.sha256(f.read_bytes()).hexdigest()[:8]


for page in sorted(ROOT.glob("*.html")):
    old = page.read_text(encoding="utf-8")
    new = REF.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={stamp(m.group(2))}"', old)
    if new != old:
        page.write_text(new, encoding="utf-8")
        print(f"{page.name}: stamped v{VERSION}")
