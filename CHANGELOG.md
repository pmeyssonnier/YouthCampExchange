# Changelog

Every pull request raises the version in `js/version.js` and adds its entry at the top of this file.
Numbering is `MAJOR.MINOR.PATCH`: PATCH for a fix, MINOR for a new feature,
MAJOR for a change that requires users or coordinators to redo something.
The version is shown on every page (site footer, tool headers).

## 1.8.0 — 2026-10-25

- Vault (not activated yet): the file view shows the district coordinator and the national team the club section of the application form — club, president, mobile, e-mail — read from the file actually uploaded, next to the club president who signs in the vault. When the two e-mails differ, it is flagged "to check"; nothing is blocked, the circuit stays based on trust between candidate, parent, club president and coordinator.

## 1.7.7 — 2026-10-25

- Vault (not activated yet), access between districts and identity of signers, checked on a real PostgreSQL:
  - **leak fixed**: three internal functions could be called by anyone through the Supabase API, even without signing in, and one of them returned the stored path, file name and list of documents of any application file whose identifier was known (identifiers travel in e-mail links). They can no longer be called from outside.
  - **identity**: a user's identity is now their account's *confirmed* e-mail address, read from Supabase's user table. Before, it was the address written in the session token, so if sign-up without confirmation had been switched on by mistake, an account created with a president's or coordinator's address could have read, commented, uploaded and sent back their files.
  - **signatures**: each one now records, as observed by the database, how the signer proved their identity (e-mail link, two-step code for coordinators and the national team), the session, and the exact statement approved (who, as what, which file, which version). Signing requires a sign-in less than 24 hours old. The file view shows how each signer was identified.
  - **`supabase/security_check.sql`**: a check to run in the Supabase SQL editor on the real project. It plays every profile (other district's candidate, president and coordinator, coordinator without two-step verification, administrator, anonymous visitor, unconfirmed accounts using someone else's address) against a district C file, through tables, storage and API functions, inside a transaction that is rolled back. All rows must be `true`; with the previous schema, 11 of its 22 checks failed.

## 1.7.6 — 2026-10-25

- Personal data of past seasons no longer stays in the browser forever:
  - form filler: drafts of other seasons (full application, photo, passport scan, signatures) are erased. They were never read again once the season changed, so the 30-day expiry never applied to them.
  - tracker: rows of seasons older than the previous one (candidates' names, dates of birth, e-mails, notes) are erased; the previous season is kept.

## 1.7.5 — 2026-10-25

- The administration, vault, tracker and form filler pages no longer display inside a frame of another site (protection against "clickjacking", where a booby-trapped page lays invisible buttons over them to make someone sign, validate or save without knowing). GitHub Pages cannot send the usual header for this, so the page stays hidden until it has checked that it is not framed, and tries to open itself full-window otherwise.

## 1.7.4 — 2026-10-25

- No more code or fonts loaded from other sites:
  - the world map libraries (D3, TopoJSON) and its map data, and the vault's Supabase client, are now served by the site itself from `vendor/` (same pinned versions, licences in `vendor/licenses/`). Before, they came from three CDNs (cdnjs, unpkg, jsDelivr) without any integrity check: a compromised CDN could have run code on the home page — or in the vault, where it could read application files and sessions. The map data was even fetched as "latest 2.x".
  - the home-page fonts are served from `vendor/fonts/` instead of Google Fonts, which received every visitor's IP address (a GDPR concern in the EU).
  - the content security policy of the home page and the vault no longer allows any of these sites.

## 1.7.3 — 2026-10-24

- Stricter limits when reading ZIP archives (application files, Excel and Word documents, camp directory):
  - archives larger than 100 MB are refused before being loaded (50 MB for the vault, its storage limit);
  - "non-recursive" ZIP bombs — hundreds of entries pointing at the same compressed bytes — are refused without unpacking anything;
  - two files with the same name, encrypted entries, and names with control characters or right-to-left override characters (which can disguise an extension, e.g. `photo‮gpj.exe`) are refused;
  - a file whose compression ratio is suspicious is stopped as soon as the limit is crossed, instead of after unpacking up to 60 MB;
  - one unpacking budget per dropped file, shared with the Excel / Word files it contains: a ZIP full of small Office files can no longer make the browser unpack tens of GB.

## 1.7.2 — 2026-10-24

- Vault signatures (not activated yet), stronger link between a signature and the file signed:
  - before signing, the signer's browser downloads the stored file and recomputes its SHA-256 fingerprint; the signature is refused if it does not match the fingerprint recorded at upload (file altered, or declared with a false fingerprint). The fingerprint sent with the signature is the one computed from the real file.
  - a signed version can no longer be deleted — neither the stored file nor its record — by the candidate, the coordinator or the national team, until the end of the retention period. Only a draft that was never sent and never signed can lose a wrong upload. Before, the candidate (file sent back for correction) or the coordinator / national team at their step could delete the stored copy of a version already signed.

## 1.7.1 — 2026-10-24

- Tracker CSV export: the protection against spreadsheet formulas (a cell starting with `=`, `+`, `-` or `@` is prefixed with an apostrophe) now also catches formulas hidden behind leading spaces, non-breaking spaces or line breaks, and the full-width signs `＝ ＋ － ＠`. Phone numbers and plain numbers stay unchanged.

## 1.7.0 — 2026-10-24

- Administration, Site & season tab: the national team section is titled **Multi District 112** and starts with an editable **multiple district number** (`MD` in `districts_data.js`, published with "Save the data"). The number is used in the district badges ("112 A"), the team titles, the application form and the generated file names.
- The team lists are titled **National Commission MD 112** and **Outgoing Secretaries MD 112**, in the administration and on the home page.
- National team list in the administration: role, club, e-mail and phone each on their own line.

## 1.6.0 — 2026-10-24

- District codes can now have several characters: a letter, then letters or digits, up to 4 (`A`, `CC`, `A1`), for multiple districts whose districts are not single letters. The administration accepts them when adding a district, and the form filler (`?district=CC`), the tracker, the generated file names and the vault follow.
- Tracker: each district filter shows its YCE coordinator (from the administration's district list) when hovered.
- Administration: in the district and national team lists, the phone number is on its own line.
- The Commitment file name used a fixed "2026_112"; it now follows the season year and the multiple district.

## 1.5.1 — 2026-10-24

- After an update, pages no longer mix the new page with old scripts kept by the browser (which could show, for example, empty "National team" lists in the administration with the header still at the previous version). Every page now loads its scripts and stylesheets with the version number in their address (`js/admin.js?v=1.5.1`), so a new version is picked up at once.
- `tools/stamp_version.py` writes these numbers; the `version` test checks them.

## 1.5.0 — 2026-10-24

- Administration, Site & season tab: the **National Commission** and the **Outgoing Secretaries** shown in "The Team" are managed like the districts — list with an Edit button per member, add, remove, ▲ ▼ to change the display order.
- New **Administration fee & bank details** section: fee, IBAN (check digits verified before saving), BIC, beneficiary, communication. The home page shows these values in "How to Apply" (fee amount everywhere it appears).
- Both are stored in `districts_data.js` (`TEAM`, `PAYMENT`) and published with "Save the data".

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
