# Lions YCE Belgium — Youth Camp & Exchange

Web platform of the **Lions Clubs International Youth Camp & Exchange (YCE) programme for MD 112 Belgium** (districts A · B · C · D). The YCE programme has two major parts: international exchanges (typically 4–6 weeks, hosted by families with sponsor and host clubs) and international camps (1–2 weeks, run by the hosting Lions clubs).

Everything is served as **static pages** (GitHub Pages ready): no backend, no database, no account. All processing happens in the visitor's browser and personal data never leaves it — files are generated locally and exchanged by e-mail.

## The pages

| Page | Audience | Purpose |
|---|---|---|
| `index.html` | Candidates & families | Public site: programme presentation, **camp explorer** (filterable table + interactive world map of the ~91 camps of the season), how to apply, district contacts, document downloads |
| `yce_form_filler.html` | Candidates | **Online application form**: fills the official Excel *Application & Indemnity Form* |
| `yce_form_filler.html?sign=club` | Club presidents | **Remote counter-signing** of a candidate's application received by e-mail |
| `yce_form_filler.html?admin` | District coordinators | Unlocks the admin tools (see below) |
| `yce_tracker.html` | District coordinators | **Applications tracker**: drop the received files, get a live status table + CSV export |

## The application form filler

Opened from the site with `?district=A/B/C/D`, it loads the official Excel form of that district and prefills the district data from the file itself. The candidate fills ~85 fields with proper controls (date pickers, Yes/No pill buttons, camp choices suggested from the season's camp list, international phone-number normalisation `+32 …`, conditional fields shown only when relevant), attaches the required documents and signs on screen.

**Generating the file** inserts every answer into the genuine `.xlsx` (formatting, logos and formulas fully preserved — age, signature names and footer are recomputed by Excel) and downloads the complete application file:

- `Application_form_2026_112X_Name_Firstname.xlsx` — the official form, with the applicant & parent signatures pasted as images on their signature rows
- `Commitment_to_Reciprocity_2026_112X_….docx` — the reciprocity contract, read and validated in-form, generated with the candidate's name, date and signatures (an invisible slot is kept for the club chairman)
- `Pass_photo_2026_112X_….jpg` and `Payment_proof_2026_112X_….pdf/jpg` — the uploaded attachments, renamed consistently

Entries are saved automatically in the browser (survive a refresh, "Clear form" restarts blank). Two buttons then open prefilled e-mails: **to the club president** (with the signing instructions below) and **to the district coordinator** (final submission).

### Signature workflow

1. **Applicant & parent/guardian** sign on screen (finger, mouse, or an uploaded image of the signature); the matching date fills in automatically.
2. **Club chairman** — either in person on the candidate's device (admin mode), or remotely: he opens *Sign it online* (`?sign=club`), loads the `.xlsx` and Commitment received by e-mail, checks the data (values, choices and existing signatures are read back from the files), signs his box and regenerates both counter-signed documents to send back.
3. The candidate e-mails the **complete file** (form + Commitment, both club-signed + photo + payment proof) to the district YCE coordinator.

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
- **photos** and **payment proofs** tick their boxes

District/status/search filters, sortable columns, per-candidate status (`Received → … → Complete — sent to MD → Placed`) and notes, summary stats and a **CSV export** ready for Excel. Data persists in the coordinator's browser only.

## Repository layout

```
index.html                            public site + camp explorer
camps_data.js                         season camp data (SEASON constant + RAW array, shared with the filler)
yce_form_filler.html                  form filler HTML shell (loads the js/ modules below)
yce_tracker.html                      tracker HTML shell
js/
  assets.js                           GENERATED — embedded templates (base64) + build version
  xlsx.js                             zip library + workbook cell read/write
  docx.js                             Commitment: text, validation, signed Word generation
  signatures.js                       signature pads + pasting signatures into the workbook
  attachments.js                      pass photo & payment proof
  storage.js                          local draft persistence
  email.js                            prefilled e-mails (club president, district coordinator)
  club-signing.js                     ?sign=club remote counter-signing mode
  sections.js                         declarative form definition (SECTIONS, camps list, mode flags)
  country.js                          default country, dial codes, phone normalisation
  render.js                           section/widget rendering, X-groups, counter
  form.js                             orchestration: generate() and init() — loaded last
  tracker-storage.js / -parser.js / -export.js / -ui.js   tracker modules
tools/
  build_assets.py                     regenerates js/assets.js from the templates below
  commit_template.docx                Commitment template with §CAND§/§DATE§/[BODY]/[SIG*] markers
Application form 2026 Distr X 1.xlsx  official district forms (A–D), downloadable & fetched by ?district=
Application_form_2026_Distr_C_vierge.xlsx  sanitized blank template (embedded via js/assets.js)
Commitment to Reciprocity.docx        official reciprocity contract (downloadable)
Letter_to_Host_Family_2026.docx       "Dear Host Family" letter template (downloadable)
Lions Camp Scraper.ipynb              notebook collecting the camps from the LCI directory
enriched_lions_camps.py               scraper enriching each camp from lions-yce-belgium.be
assets/                               logos & favicon
```

The filler and tracker are plain-JavaScript **classic scripts sharing the global scope**, loaded in dependency order by their HTML shells; every module is directly editable in the repository. Only `js/assets.js` is generated — run `python3 tools/build_assets.py` after changing the blank form or the Commitment template.

A detailed code map (modules, business functions with line numbers and sizes, dependency graphs) is maintained in [`docs/CODE_MAP.md`](docs/CODE_MAP.md).

## Technical notes

- **Zero dependencies at runtime** for the filler and tracker: zip read/write is implemented in plain JavaScript (uncompressed embedded templates + the browser's native `CompressionStream`/`DecompressionStream`); the Excel/Word files are edited at the XML level, which preserves their formatting and formulas exactly. The public site uses D3/TopoJSON from CDN for the world map.
- Values are written as cells (`inlineStr`/numeric), X-choices as `X` marks, signatures and photo as anchored images; `fullCalcOnLoad` makes Excel refresh the computed cells on open.
- The build version is shown in the filler header (`vYYYY.MM.DD-commit`) to spot stale browser caches.
- **Season update**: replace `SEASON`/`RAW` in `camps_data.js` (the filler derives its camp suggestions from it), drop in the new district forms, update the blank template, and run `python3 tools/build_assets.py`.

## Privacy

Candidate data is only ever inside: the browser's local storage (on the device used), the generated files, and the e-mails the candidate chooses to send. Nothing is uploaded to any server. The blank template embedded in the filler was sanitized (all personal data of the original example removed).
