# Lions YCE Belgium — Youth Camp & Exchange

Web platform of the **Lions Clubs International Youth Camp & Exchange (YCE) programme for MD 112 Belgium** (districts A · B · C · D). The YCE programme has two major parts: international exchanges (typically 4–6 weeks, hosted by families with sponsor and host clubs) and international camps (1–2 weeks, run by the hosting Lions clubs).

Everything is served as **static pages** from GitHub Pages: no server of our own, no account needed to apply. All processing happens in the visitor's browser and personal data never leaves it — files are generated locally and exchanged by e-mail. The only exception is the optional **application vault** (Supabase, hosted in the EU), disabled until it is configured.

Current version: see [`CHANGELOG.md`](CHANGELOG.md) — the number is also shown in the site footer and in the header of every tool page.

## The pages

| Page | Audience | Purpose |
|---|---|---|
| `index.html` | Candidates & families | Public site: programme presentation, **camp explorer** (filterable table + interactive world map of the season's camps), how to apply, district contacts, photo gallery, document downloads |
| `yce_form_filler.html?district=A` (district code) | Candidates | **Online application form**: fills the official Excel *Application & Indemnity Form* |
| `yce_form_filler.html?sign=club` | Club presidents | **Remote counter-signing** of a candidate's application received by e-mail |
| `yce_form_filler.html?sign=district` | District coordinators | Counter-signing of the district boxes |
| `yce_form_filler.html?admin` | District coordinators | Unlocks the admin tools (see below) |
| `yce_tracker.html` | District coordinators | **Applications tracker**: drop the received files, get a live status table + CSV export |
| `yce_vault.html` | Everyone involved in a file | **Application vault** (optional): one central copy of each file, sign-off workflow, retention — see [`docs/VAULT_SETUP.md`](docs/VAULT_SETUP.md) |
| `yce_admin.html` | Site administrator | **Administration**, one token and one passphrase for three tabs — **Site & season**: season/year, district coordinators, home-page banner, photo gallery · **Camps** (`#camps`): import the official LCI directory (xlsx) with a reviewed merge, edit every camp, JSON backup/restore, archive old camps · **Documents**: official documents — committed straight to GitHub. The old `yce_camps.html` address opens the Camps tab |

Every tool page shows a menu under its header (site, form filler, tracker, vault, administration); the candidate and club-president screens of the form only show the link back to the site. The site footer links to the staff tools.

## The camp explorer

The public site lists every camp of the season with filters on **season, continent, country, state / province, age and presence period (month / fortnight / week, empty periods hidden)**, in a table or on a **D3 world map** that follows the same filters. Continent, country and state filters are collapsible lists. On a phone (≤ 900 px) the filters open in a **side drawer**, and active filters show as removable chips. Each camp opens a detail window with its dates, ages, fee and links. Camp names are displayed in title case; the non-refundable fee warning and the Belgian camps stand out.

## The application form filler

Opened from the site with `?district=<code>` (a letter, or up to 4 letters/digits such as `CC` or `A1`, as declared in the administration), it loads the **single reference form** and stamps the district into it (header letter and YCE coordinator name/e-mail/mobile, from the `DISTRICTS` constant in `districts_data.js` — the only cells that ever differed between the four district files). The candidate fills ~85 fields with proper controls (date pickers, Yes/No pill buttons, camp choices suggested from the season's camp list, international phone-number normalisation `+32 …`, conditional fields shown only when relevant), attaches the required documents and signs on screen.

**Identity document**: a **passport** scan is required when one of the camp choices is outside Europe (the United Kingdom also counts as passport-only); otherwise the **identity card** is enough. When the passport is being renewed, the candidate ticks *scan will follow* and sends it later.

**Generating the file** inserts every answer into the genuine `.xlsx` (formatting, logos and formulas fully preserved — age, signature names and footer are recomputed by Excel) and downloads the complete application file as **one ZIP archive** — a single attachment to e-mail around — `Dossier_YCE_2026_112X_Name_Firstname.zip` containing:

- `Application_form_2026_112X_….xlsx` — the official form, with the applicant & parent signatures pasted as images on their signature rows
- `Commitment_to_Reciprocity_2026_112X_….docx` — the reciprocity contract, read and validated in-form, generated with the candidate's name, date and signatures (an invisible slot is kept for the club chairman)
- `Pass_photo_…`, `Payment_proof_…`, `Letter_to_Host_Family_…` and `ID_document_…` — the uploaded attachments (photo, payment proof, completed "Dear Host Family" letter, passport or ID card scan), renamed consistently; when the scan will follow, an `ID_document_TO_FOLLOW_….txt` note takes its place

Entries are saved automatically in the browser (survive a refresh; erased after 30 days without change, or at once with "Clear form"). The ID scan is never kept in the browser. Two buttons then open prefilled e-mails: **to the club president** (with the signing instructions below) and **to the district coordinator** (final submission).

### Signature workflow

1. **Applicant & parent/guardian** sign on screen (finger, mouse, or an uploaded image of the signature); the matching date fills in automatically.
2. **Club chairman** — either in person on the candidate's device (admin mode), or remotely: they open *Sign it online* (`?sign=club`) — a **minimal signing screen** (candidate summary + signature box, the full form one click away) — load the candidate's **ZIP** received by e-mail, sign and download the counter-signed ZIP to send back. The signature lands on the form's club row and in the Commitment's club column.
3. The candidate e-mails the **counter-signed ZIP** to the district YCE coordinator, who can drop it into the tracker and counter-sign the district boxes the same way with `?sign=district` (linked from the tracker; the Commitment passes through untouched — the district does not sign it).

### Admin mode (`?admin`)

- MD/District and authorized-chairperson signature pads
- Load another Excel template (new season / other district)
- Default country selector (drives phone prefix and nationality — also per-link with `?country=FR`)
- Update the Commitment text from a Word document (per browser; the embedded default stays the official text)
- Link to the applications tracker

## The applications tracker

The coordinator drops the files received from candidates — a whole **.zip** at once (e.g. the "download all attachments" archive from the mailbox; forms are processed first so the other pieces attach correctly) or individual files, several candidates at a time:

- each **application form** creates/updates a row: identity, age on 01/07/2026, club, contacts, camp choices, presence of the three on-form signatures, completeness of 27 key fields (missing ones listed)
- **Commitment** documents are matched by name, with club counter-signature detection
- **photos**, **payment proofs**, **host-family letters** and **passport / ID scans** tick their boxes (⏳ when the scan is announced to follow; the file is only *complete* once the scan is in)

District/status/search filters, sortable columns, per-candidate status (`Received → Under review → Incomplete → Complete — sent to MD → Placed`, or `Withdrawn`) and notes, summary stats and a **CSV export** ready for Excel (cells protected against spreadsheet formulas). Data persists in the coordinator's browser only.

## The application vault (optional)

`yce_vault.html` replaces e-mailed ZIPs with **one stored copy per file** in a Supabase project (EU region), MD 112 being the data controller. Candidate, parent, club president, district coordinator and national team open the same file through an e-mailed sign-in link:

- workflow `draft → parent review → submitted → club signed → district validated → national validated → sent to host → accepted / refused → archived`, every step timestamped with the SHA-256 fingerprint of the exact ZIP signed (simple electronic signature); the signer's browser recomputes that fingerprint from the stored file before signing, and a signed version can no longer be deleted until the end of the retention period
- the club president only sees an automatically **redacted copy** (no ID scan, religion or health section)
- coordinators, national team and administrators must use **two-factor sign-in** (authenticator app)
- files are kept **2 years after the season** (the family hosts the following year), 90 days after a refusal, then purged
- all access rules live in the database (row-level security, `supabase/vault_schema.sql`); identity is the account's **confirmed** e-mail address, internal functions cannot be called through the API, and every signature records how the signer proved their identity (e-mail link, two-step code, session) and the exact statement approved
- `supabase/security_check.sql`, run in the Supabase SQL editor, checks on the real project that nobody outside a file's candidate, parent, president, district coordinator and national team can read or change it (all rows must be `true`); the tests run the same file

As long as `SUPABASE_URL` is empty in `districts_data.js`, the page says "Vault not configured yet" and the rest of the site works as before. Setup steps (in French): [`docs/VAULT_SETUP.md`](docs/VAULT_SETUP.md).

## Repository layout

```
index.html                            public site HTML shell (loads css/site.css + the js/site-* modules)
css/site.css                          public site styles (nav, hero, explorer, filter drawer, map, modal, light/dark)
css/tools.css                         styles shared by the tool pages (theme colours, header, tool menu, sections)
css/fonts.css                         home-page fonts (served from vendor/fonts/)
camps_data.js                         season camp data (SEASON + YEAR + RAW array) — common to every deployment
districts_data.js                     per-deployment data: MD number, country, coordinators, home-page texts (SITE), national team (TEAM), fee & bank details (PAYMENT), photo gallery (GALLERY), SITE_REPO, Supabase settings
camps.json                            GENERATED — plain-JSON export of the camp data ({season, camps})
camps_archive.json                    archived camps — created by the camp manager at the first archive
yce_form_filler.html                  form filler HTML shell (loads the js/ modules below)
yce_tracker.html                      tracker HTML shell
yce_admin.html                        administration HTML shell (tabs Site & season / Camps / Documents)
yce_camps.html                        old camp manager address, redirects to yce_admin.html#camps
yce_vault.html                        application vault HTML shell (Supabase — disabled until configured)
CHANGELOG.md                          what changed in each version
CLAUDE.md                             working rules for changes to this repository
js/
  version.js                          site version number (VERSION), shown on every page
  theme.js                            light/dark theme toggle shared by the tool pages
  toolnav.js                          tool menu under the header of every tool page
  site-data.js                        site: date helpers, CAMPS enrichment, season stats, HTML escaping (esc/safeUrl/cleanHtml)
  site-explorer.js                    site: camp directory (filters, drawer, sort, table, tabs)
  site-map.js                         site: D3 world map (bubbles, zooms, country panel) following the filters
  site-modal.js                       site: camp detail modal + timeline
  site-ui.js                          site: theme, mobile nav, scroll-reveal, gallery — loaded last
  assets.js                           GENERATED — embedded templates (base64) + build stamp
  noframe.js                          sensitive pages stay hidden when framed by another site (clickjacking)
  zip.js                              bounded ZIP reading shared by every page: archive ≤ 100 MB, ≤ 500 files, ≤ 60 MB per file and 150 MB in all once unpacked, compression ratio ≤ 200, no overlapping, duplicate, encrypted or disguised entries, one unpacking budget per dropped file and the Office files inside it
  xlsx.js                             ZIP writing + workbook cell read/write
  docx.js                             Commitment: text, validation, signed Word generation
  signatures.js                       signature pads + pasting signatures into the workbook
  attachments.js                      pass photo, payment proof, passport / ID card scan
  storage.js                          local draft persistence (30-day expiry)
  email.js                            prefilled e-mails (club president, district coordinator)
  club-signing.js                     ?sign=club / ?sign=district remote counter-signing mode
  sections.js                         declarative form definition (SECTIONS, camps list, mode flags)
  country.js                          default country, dial codes, phone normalisation
  render.js                           section/widget rendering, X-groups, counter
  form.js                             orchestration: generate() and init() — loaded last
  admin-core.js                       admin plumbing: passphrase-encrypted token, GitHub API, atomic commits, connect hooks
  admin.js                            admin Site & season and Documents tabs
  camps-manager.js                    admin Camps tab: directory import, editing, backups, archive
  admin-tabs.js                       admin tab switching (#site, #camps, #docs)
  tracker-storage.js / -parser.js / -export.js / -ui.js   tracker modules
  club-copy.js                        vault: redacted copy for the club president
  vault-api.js / vault.js             vault: Supabase access layer + interface
supabase/vault_schema.sql             vault database: tables, row-level security, workflow, retention
docs/
  CODE_MAP.md, code_map.html          GENERATED code map (with docs/codemap-data.js)
  SEASON_UPDATE.md                    yearly season checklist
  VAULT_SETUP.md                      vault setup guide (Supabase project, e-mail, two-factor, GDPR)
tests/                                security & regression tests (npm test)
documents/                            official documents, replaced from the admin page
  Application_form_2026_MD112.xlsx    single neutral reference form (embedded via js/assets.js, downloadable)
  Commitment to Reciprocity.docx      official reciprocity contract (downloadable)
  Letter_to_Host_Family_2026.docx     "Dear Host Family" letter template (downloadable)
  commit_template.docx                Commitment generation template with §CAND§/§DATE§/[BODY]/[SIG*] markers
tools/
  build_assets.py                     regenerates js/assets.js and camps.json
  build_codemap.py                    regenerates docs/codemap-data.js and docs/CODE_MAP.md
  stamp_version.py                    stamps ?v=VERSION on every page's scripts and stylesheets (cache busting)
  scraper/                            Lions Camp Scraper.ipynb (camps from the LCI directory) + enriched_lions_camps.py (details from lions-yce-belgium.be)
.github/workflows/
  tests.yml                           runs the tests on every push and pull request
  rebuild.yml                         regenerates the generated files after each change on main
assets/                               logos, favicon, gallery photos
vendor/                               third-party libraries, map data and fonts served by the site itself (pinned versions + licences)
```

All pages are plain-JavaScript **classic scripts sharing the global scope**, loaded in dependency order by their HTML shells; every module is directly editable in the repository. The generated files (`js/assets.js`, `camps.json`, `docs/codemap-data.js`, `docs/CODE_MAP.md`) are never edited by hand: `python3 tools/build_assets.py` and `python3 tools/build_codemap.py` recompute them, and the `Rebuild generated files` action does it after every change on `main`.

A code map (modules, business functions, sizes, dependencies) is in [`docs/CODE_MAP.md`](docs/CODE_MAP.md), with an interactive version in `docs/code_map.html`.

## Contributing

- Every change goes through a **pull request to `main`**, one subject per pull request; the site only changes when it is merged. The rules are in [`CLAUDE.md`](CLAUDE.md).
- Every pull request raises the version in `js/version.js` (`MAJOR.MINOR.PATCH`: patch for a fix, minor for a new feature, major for a change that requires users to redo something) and adds its entry at the top of [`CHANGELOG.md`](CHANGELOG.md), then runs `python3 tools/stamp_version.py` so every page loads its scripts and stylesheets as `file.js?v=VERSION` — browsers then never mix a new page with old cached scripts.
- **Tests**: `cd tests && npm ci && npx playwright install chromium && npm test` — XSS escaping with booby-trapped data, ZIP bombs, admin token handling, atomic commits, ID document rules, vault access rules on a real PostgreSQL, version consistency, and every page loading without script error or CSP violation. The `Tests` action runs them on every pull request, which must be green.
- Visible changes are checked on a phone width (390 px).
- The repository is public: never commit a real application file, filled form, scan or photo of a young person — tests use made-up data.

## International deployments

The programme can be deployed for another country as a **fork of this repository**:
everything is common except `districts_data.js` (MD number, country, district
coordinators and the `SITE_REPO` constant pointing at the fork). The reference
form itself is MD-neutral: the multiple-district identity is stamped into it at load. Set up GitHub Pages and a custom domain
on the fork, edit that single file (the admin page does it too — it detects the
repository automatically on `*.github.io`), and sync with the original repository
whenever you want to pick up improvements. Multiple domains for the *same* site
need no fork at all: a registrar-level redirect to the canonical domain is enough.

## Site administration (`yce_admin.html`)

The platform stays server-less: **GitHub is the back end**. The admin page edits the
repository through the GitHub API — the administrator "account" is a GitHub account
with write access plus a fine-grained personal access token (this repository only,
permission *Contents: Read and write*; the token never leaves the admin's browser, where it is
stored only encrypted with a passphrase of 8+ characters). The three tabs share this single token, so the passphrase is typed once per visit; once unlocked, the token stays in the browser tab's session (it survives a refresh or a phone reloading the tab, and is dropped when the tab is closed or after 1 hour without activity).
On connection the page reloads the current data from GitHub, so a stale browser cache
can never overwrite recent changes. From the page you can change the season label and camp year, manage the districts and
their YCE coordinators — list with an Edit button per district, add or remove a district (form stamping,
site cards, tracker filters and e-mails follow) —, set the multiple district number (MD, used in district badges, team titles, the form and file names), edit the national team (National Commission and Outgoing Secretaries, same list editor) and the administration fee with the bank details (IBAN check digits verified) — manage the camp list in the
Camps tab, edit the home-page announcement banner, manage the animated
photo gallery (large previews, reordering; images are resized and committed to `assets/gallery/`), and upload
new official documents (reference form, Commitment,
host-family letter, generation template). Every save is **one atomic commit** on `main` (all files or nothing; a file changed on GitHub in the meantime is never overwritten); the
`Rebuild generated files` GitHub Action then regenerates `js/assets.js`, `camps.json`
and the code-map data, and GitHub Pages republishes the site — live in 2–3 minutes,
with the full change history in git.

## Technical notes

- **Zero dependencies at runtime** for the filler and tracker: zip read/write is implemented in plain JavaScript (uncompressed embedded templates + the browser's native `CompressionStream`/`DecompressionStream`); the Excel/Word files are edited at the XML level, which preserves their formatting and formulas exactly. The public site uses D3/TopoJSON and the world-atlas map data, the vault the Supabase client: all are served from `vendor/` (pinned versions, licences in `vendor/licenses/`), and the home-page fonts from `vendor/fonts/` — no page loads anything from another site, which the smoke test checks.
- Values are written as cells (`inlineStr`/numeric), X-choices as `X` marks, signatures and photo as anchored images; `fullCalcOnLoad` makes Excel refresh the computed cells on open.
- **Security**: every page carries a Content-Security-Policy limiting scripts and network destinations to what it uses; camp and configuration data are always escaped before display; archives are read within size/count/ratio limits; the admin token is encrypted with PBKDF2 (600 000 iterations).
- **Version**: the site version (`js/version.js`) is shown on every page; the filler header also shows the build stamp (`build YYYY.MM.DD-commit`) to spot stale browser caches.
- **Season update**: replace `SEASON`/`RAW`/`YEAR`/`DISTRICTS` in `camps_data.js`, update the single reference form, and run `python3 tools/build_assets.py` — it also re-exports `camps.json` (the plain-JSON version of the camp data, for Excel or any external tool). The complete annual checklist is in [`docs/SEASON_UPDATE.md`](docs/SEASON_UPDATE.md).

## Privacy

Candidate data is only ever inside: the browser's local storage (on the device used — erased after 30 days without change, or at once with *Clear form*; the ID scan is never stored), the generated files, and the e-mails the candidate chooses to send. Nothing is uploaded to any server — the vault, once configured, is the only exception (EU hosting, redacted club copy, two-factor staff access, 2-year retention; see `docs/VAULT_SETUP.md`). The blank template embedded in the filler was sanitized (all personal data of the original example removed).
