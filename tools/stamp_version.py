#!/usr/bin/env python3
"""Stamp the site version on the local scripts and stylesheets of every page.

Each page loads its files as  src="js/x.js?v=1.5.1"  /  href="css/x.css?v=1.5.1".
When the version changes the addresses change too, so a browser never mixes a new
page with old cached scripts. Run after raising VERSION in js/version.js:

    python3 tools/stamp_version.py

The "version" test checks that every page is stamped with the current version.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = re.search(r'const VERSION = "([^"]+)"', (ROOT / "js/version.js").read_text()).group(1)
# local .js / .css only (no scheme, no leading slash), with or without an existing ?v=
REF = re.compile(r'((?:src|href)=")((?![a-z]+:|/)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?"')

for page in sorted(ROOT.glob("*.html")):
    old = page.read_text(encoding="utf-8")
    new = REF.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={VERSION}"', old)
    if new != old:
        page.write_text(new, encoding="utf-8")
        print(f"{page.name}: v{VERSION}")
