# Changelog

Every pull request raises the version in `js/version.js` and adds its entry at the top of this file.
Numbering is `MAJOR.MINOR.PATCH`: PATCH for a fix, MINOR for a new feature,
MAJOR for a change that requires users or coordinators to redo something.
The version is shown on every page (site footer, tool headers).

## 1.4.2 — 2026-10-24

- Form filler (admin mode): the bottom bar no longer repeats the tool menu — the "Applications tracker", "Camps", "Site admin" buttons are gone (use the menu under the header). "Other template" and "Country" are grouped behind an **⚙ Admin options** button. The code map link moved to the administration page's **?** help.
- Smaller bottom bar on phones.

## 1.4.1 — 2026-10-24

- Compact header on phones for the tool pages (form filler, tracker, vault, administration): smaller logo and title on a single line, subtitle hidden, buttons kept on the same line. The version number now sits next to the page title.

## 1.4.0 — 2026-10-24

- Administration, Site & season tab: districts are shown as a list (district, coordinator, club, e-mail, mobile) with an **Edit** button on each row, an **Add a district** button (one letter A–Z) and a **Remove district** button in the edit panel. Changes are published with "Save the data", in one commit.
- The pages follow the list of districts instead of assuming A–D: tracker filters, form filler header and district stamping (`?district=E`), application forms read back by the tracker and the form. The site's contact cards already did.
- In the vault (once activated), the coordinator of a new district is added in its Team panel.

## 1.3.0 — 2026-10-24

- Administration: once unlocked, the passphrase is no longer asked again after a refresh, or when a phone reloads the page after switching apps or browser tabs. The unlocked token is kept in the browser tab's session only: it disappears when the tab is closed, after 1 hour without activity, or with "Forget on this device".

## 1.2.2 — 2026-10-24

- Administration page: the "How it works" explanation no longer takes the top of the page; it opens in a window from the **?** button of the header (or the "Which token?" link on first connection).

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
