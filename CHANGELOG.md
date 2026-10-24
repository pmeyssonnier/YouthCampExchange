# Changelog

Every pull request raises the version in `js/version.js` and adds its entry at the top of this file.
Numbering is `MAJOR.MINOR.PATCH`: PATCH for a fix, MINOR for a new feature,
MAJOR for a change that requires users or coordinators to redo something.
The version is shown on every page (site footer, tool headers).

## 1.2.1 — 2026-10-24

- Shared look of the tool pages (form filler, tracker, vault, administration) moved to `css/tools.css`: theme colours, header, tool menu, sections, labels. Each page keeps only its own styles.
- Small harmonisation: same header size and section spacing on every tool; secondary text slightly more readable (the higher-contrast grey of the vault is now used everywhere); the orange warning colour was missing in the form filler's dark theme.
- The form filler's "Camps" admin button opens the Camps tab of the administration page directly.

## 1.2.0 — 2026-10-24

- One administration page with three tabs — Site & season, Camps, Documents — sharing a single GitHub token: the passphrase is typed once per visit instead of once per page.
- The camp manager is now the Camps tab (`yce_admin.html#camps`); the old `yce_camps.html` address redirects there. The duplicate "replace the camp list (JSON)" upload of the old admin page is gone: use "Import JSON backup" in the Camps tab.
- Tool menu under the header of the form filler (admin mode), tracker, vault and administration pages; candidates and club presidents only see the link back to the site.
- "Staff tools" link in the site footer.

## 1.1.0 — 2026-10-24

- Official documents (reference application form, Commitment to Reciprocity, host-family letter, Commitment generation template) moved to the `documents/` folder; the site's download links, the form filler and the admin uploads follow.
- Camp scraper (notebook + enrichment script) moved to `tools/scraper/`.
- Old direct links to the documents at the root of the site no longer work: use the links on the home page.

## 1.0.1 — 2026-10-24

- README brought up to date: application vault, passport / ID card rule, camp explorer filters and mobile drawer, version number, contribution rules (one pull request per change), current repository layout.

## 1.0.0 — 2026-10-24

First numbered version, covering the platform as it stands:

- Public site: camp explorer with filters (season, continent, country, state, period, age), world map following the filters, mobile filter drawer, photo gallery, district contacts.
- Application form filler: Excel application form, Commitment to Reciprocity, signatures, photo, payment proof, passport / ID card scan (passport outside Europe, scan may follow during renewal), ZIP for the club and district.
- District tracker: received ZIPs, completeness check, CSV export.
- Administration and camp manager: season, coordinators, home page, gallery, camp directory, saved as atomic commits to GitHub.
- Application vault (Supabase, not yet activated): central storage, parent approval, club / district / national sign-off, redacted club copy, two-factor sign-in for staff, 2-year retention.
- Security: escaped output and content security policy on every page, bounded ZIP reading, admin passphrase, automated tests on every pull request.
