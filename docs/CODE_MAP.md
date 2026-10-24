# Code map — Lions YCE

> **Generated file — do not edit by hand.** Rebuilt by `python3 tools/build_codemap.py` (run automatically on every push to `main`).
> Commit `1509c13`, 2026-10-24 17:30 UTC. Interactive version: [`code_map.html`](code_map.html).

## Pages

| Page | Role |
|---|---|
| `index.html` | public site: programme, camp directory + world map, how to apply, district contacts |
| `yce_form_filler.html` | candidate form → Excel AF + Commitment + ZIP; ?sign=club / ?sign=district countersigning; ?district=X |
| `yce_tracker.html` | district coordinator tracker: drop received ZIPs, completeness, CSV export |
| `yce_admin.html` | administration: season, coordinators, home page, gallery, documents (commits to GitHub) |
| `yce_camps.html` | camp manager: import the YCE directory, edit, archive, JSON backup (commits to GitHub) |
| `yce_vault.html` | application vault (Supabase): central storage, sign-off workflow, retention |
| `docs/code_map.html` | interactive version of this map |

## Public site (`index.html`)

| File | Role |
|---|---|
| index.html (374 ln, 26.4 KB) | HTML shell: nav · hero · program · explorer · Brussels · apply · testimonials · team · footer |
| css/site.css (450 ln, 36.4 KB) | site + explorer + map + modal styles, light/dark, responsive |
| js/site-data.js (97 ln, 5.4 KB) | date helpers, CAMPS enrichment, season stats, HTML escaping (esc / jsArg / safeUrl / cleanHtml) |
| js/site-explorer.js (265 ln, 15.1 KB) | directory: getFiltered/getSorted/renderTable + all filters, tabs |
| js/site-map.js (195 ln, 18.2 KB) | world map (D3): initMap/renderWorldBubbles/zoomContinent/zoomCountry/showCountryCamps |
| js/site-modal.js (125 ln, 8.1 KB) | camp detail modal: showCampDetail/buildTimeline |
| js/site-ui.js (94 ln, 5.8 KB) | theme toggle, mobile nav, scroll-reveal, Belgium teaser — runs init |

## Form filler modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/assets.js` | 6 | 504.5 KB | GENERATED — embedded templates (base64) + build version |
| `js/zip.js` | 83 | 4.3 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/xlsx.js` | 211 | 9.6 KB | ZIP writing + workbook cell read/write |
| `js/docx.js` | 173 | 9.5 KB | Commitment: text, validation, signed Word generation |
| `js/signatures.js` | 141 | 7.5 KB | signature pads + pasting signatures into the workbook |
| `js/attachments.js` | 147 | 7.0 KB | pass photo & payment proof |
| `js/storage.js` | 75 | 3.6 KB | local draft persistence |
| `js/email.js` | 49 | 3.4 KB | prefilled e-mails (club president, district coordinator) |
| `js/club-signing.js` | 83 | 4.6 KB | ?sign=club remote counter-signing |
| `js/sections.js` | 165 | 10.6 KB | declarative form definition (SECTIONS, camps list, mode flags) |
| `js/country.js` | 87 | 4.0 KB | default country, dial codes, phone normalisation |
| `js/render.js` | 238 | 13.7 KB | section/widget rendering, X-groups, counter |
| `js/form.js` | 225 | 14.6 KB | orchestration: generate() and init() — loaded last |

**`js/zip.js`** — `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/xlsx.js`** — `crc32` (CRC-32 for zip writing), `deflateRaw` (native deflate), `buildZip` (rebuild a zip Blob), `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCellValue` (read one cell), `syncFromTemplate` (prefill inputs + X-groups from a workbook), `b64ToBuf` (base64 → ArrayBuffer), `loadTemplate` ('Other template' input), `setStatus` (status bar helper), `escXml` (escape XML), `fmtDate` (ISO → dd-mm-yyyy), `setCell` (write/clear one cell keeping style), `collectValues` (gather all field values (+phone check))

**`js/docx.js`** — `commitShow` (sync validate button + card UI), `commitCardClick` (card: scroll or download), `commitToggle` (validate/cancel (needs applicant+parent sigs)), `commitTextShow` (refresh commitment text), `commitTextUpload` (admin: text from a Word doc), `commitTextReset` (restore official text), `docxReplaceRun` (swap a marker run), `docxSigRun` (inline image run XML), `buildCommitmentDoc` (fill + sign the Commitment)

**`js/signatures.js`** — `sigInit` (canvas pads + auto date), `sigClear` (clear a pad), `sigUpload` (signature from an image), `sigsFromWorkbook`, `dataUrlToBytes` (dataURL → bytes), `addSignatures` (anchor inked pads in the workbook)

**`js/attachments.js`** — `photoPick` (photo upload + downscale 800px), `photoShow` (preview), `photoClear` (remove), `readDoc`, `docShow`, `payPick` (proof upload (PDF as-is, images 1600px)), `payShow` (preview), `payClear` (remove), `idRequirement`, `idLabel`, `idPick`, `idShow`, `idClear`, `idLaterToggle`, `letterPick`, `letterShow`, `letterClear`

**`js/storage.js`** — `saveDraft` (persist everything (debounced)), `restoreDraft` (restore everything), `clearForm` (wipe + reload)

**`js/email.js`** — `openMail` (navigation seam (testable)), `mailPresident` (mailto club president (+?sign=club steps)), `mailCoordinator` (mailto district coordinator)

**`js/club-signing.js`** — `loadDossier`, `commitPreview`, `signCommitmentFile` (insert club signature at bookmark)

**`js/country.js`** — `countryCfg` (current country config), `normPhone` (international normalisation), `validPhone` (phone validation), `wirePhones` (tel inputs wiring), `applyCountry` (prefill nationality/country), `setCountry` (admin selector)

**`js/render.js`** — `esc` (escape HTML), `render` (render all sections & widgets), `depShow` (conditional 'specify' fields), `xsel` (X-group selection), `initLists` (country/camp datalists), `syncCamps` (filter camps by country), `ynClick` (Yes/No & pill buttons), `refreshYn` (sync button visuals), `updState` (State field visibility), `attChecklist`, `upd` (fields-completed counter)

**`js/form.js`** — `signSummary`, `generate` (orchestrator: cells, signatures, downloads, e-mails), `init` (mode setup + startup)

## Tracker modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/zip.js` | 83 | 4.3 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/tracker-storage.js` | 14 | 0.6 KB | rows + localStorage persistence |
| `js/tracker-parser.js` | 146 | 8.2 KB | file ingestion: zip, xlsx forms, commitment, attachments |
| `js/tracker-export.js` | 29 | 1.8 KB | CSV export for Excel |
| `js/tracker-ui.js` | 66 | 5.2 KB | table, filters, sorting, stats — runs render() |

**`js/zip.js`** — `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/tracker-storage.js`** — `save` (persist rows), `clearAll` (wipe rows)

**`js/tracker-parser.js`** — `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCell` (read one cell), `norm` (normalise for matching), `rowKey` (row identity), `handleFiles` (dispatch dropped files (zip first-class)), `parseForm` (extract a form into a row), `findRowByName` (match a file to a row), `matchCommit` (commitment + club-signature detection), `matchAux` (photo / payment proof)

**`js/tracker-export.js`** — `csvSafe` (neutralise spreadsheet formulas in CSV cells), `exportCsv` (24-column CSV (BOM + ;))

**`js/tracker-ui.js`** — `log` (activity journal), `isComplete` (file completeness), `setDist` (district filter), `setSort` (column sort), `esc` (escape HTML), `render` (render all sections & widgets)

## Vault modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/zip.js` | 83 | 4.3 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/club-copy.js` | 48 | 2.7 KB | vault: reduced copy for the club president (AF without ID, religion, health + Commitment) |
| `js/vault-api.js` | 82 | 4.9 KB | vault: the only layer talking to Supabase |
| `js/vault.js` | 498 | 29.0 KB | vault UI: sign-in, dashboard, file, signatures, team, retention |

**`js/zip.js`** — `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/club-copy.js`** — `zipBase`, `u8buf`, `dropUnusedShared` (removes orphan Excel shared strings), `redactApplicationForm` (empties ID / religion / health cells), `buildClubCopy` (full dossier ZIP → club copy ZIP)

**`js/vault-api.js`** — `makeVaultApi`

**`js/vault.js`** — `esc` (escape HTML), `show`, `msg`, `fmtDT`, `fmtD`, `isStaff`, `selfLink`, `sha256Hex`, `isMinor`, `validBirth`, `latestFile`, `idPending`, `applicationSeason`, `vaultInit`, `fillStaticLists`, `sendLink`, `startSession`, `mfaNeeded`, `mfaVerify`, `continueSession`, `signOut`, `myTurn`, `loadDashboard`, `renderList`, `createDossier`, `openDossier`, `closeDossier`, `canUpload`, `renderDossier`, `renderActions`, `saveEdit`, `uploadZip`, `uploadIdLater`, `downloadFile`, `signedDoc`, `act`, `offerNotify`, `copyLink`, `withdraw`, `addComment`, `loadStaff`, `staffAdd`, `staffDelete`, `loadPurge`, `runPurge`

## Data, tools and other files

| File | Size | Role |
|---|---:|---|
| `camps_data.js` | 92.6 KB | season data: SEASON + YEAR + RAW camps — common to every deployment |
| `districts_data.js` | 3.8 KB | per-deployment data: SITE_REPO + DISTRICTS coordinators |
| `yce_form_filler.html` | 13.9 KB | filler HTML shell + styles |
| `yce_tracker.html` | 10.2 KB | tracker HTML shell + styles |
| `yce_camps.html` | 11.7 KB | camp manager HTML shell |
| `js/admin-core.js` | 10.9 KB | shared admin plumbing (token, PIN, GitHub API) |
| `js/camps-manager.js` | 26.2 KB | camp manager: directory import, editing, backups, archive |
| `yce_vault.html` | 21.1 KB | application vault HTML shell (Supabase) |
| `js/vault-api.js` | 4.9 KB | vault: the only layer talking to Supabase |
| `js/vault.js` | 29.0 KB | vault UI: sign-in, dashboard, file, signatures, team, retention |
| `supabase/vault_schema.sql` | 25.9 KB | vault database: tables, row-level security, workflow, retention |
| `docs/VAULT_SETUP.md` | 9.5 KB | vault setup guide (Supabase project, SMTP, GDPR) |
| `tools/build_assets.py` | 2.2 KB | regenerates js/assets.js |
| `tools/build_codemap.py` | 13.1 KB | regenerates this visualisation's data and docs/CODE_MAP.md |
| `tests/` | 4.0 KB | security & regression tests run by GitHub Actions (npm test) |
| `tools/commit_template.docx` | 33.0 KB | Commitment template (markers) |

## Who uses what (form filler)

| Defined in | Used by | Names |
|---|---|---|
| `js/zip.js` | `js/xlsx.js` | inflateRaw, unzip |
| `js/signatures.js` | `js/xlsx.js` | sigsFromWorkbook |
| `js/sections.js` | `js/xlsx.js` | SECTIONS, SIGN_MODE |
| `js/country.js` | `js/xlsx.js` | normPhone, validPhone |
| `js/render.js` | `js/xlsx.js` | XSTATE, depShow, upd |
| `js/assets.js` | `js/docx.js` | COMMIT_B64 |
| `js/zip.js` | `js/docx.js` | unzip |
| `js/xlsx.js` | `js/docx.js` | b64ToBuf, buildZip, currentDistrict, decodeEnt, escXml, setStatus |
| `js/signatures.js` | `js/docx.js` | SIGS, dataUrlToBytes |
| `js/render.js` | `js/docx.js` | esc, upd |
| `js/sections.js` | `js/signatures.js` | SECTIONS |
| `js/render.js` | `js/signatures.js` | upd |
| `js/xlsx.js` | `js/attachments.js` | setStatus |
| `js/render.js` | `js/attachments.js` | esc, upd |
| `js/docx.js` | `js/storage.js` | COMMIT, commitShow |
| `js/signatures.js` | `js/storage.js` | SIGS |
| `js/attachments.js` | `js/storage.js` | IDLATER, LETTER, PAY, PHOTO, idShow, letterShow, payShow, photoShow |
| `js/sections.js` | `js/storage.js` | SECTIONS, SIGN_MODE |
| `js/render.js` | `js/storage.js` | XSTATE, depShow, upd |
| `js/xlsx.js` | `js/email.js` | currentDistrict, setStatus |
| `js/zip.js` | `js/club-signing.js` | unzip |
| `js/xlsx.js` | `js/club-signing.js` | buildZip, decodeEnt, setStatus, syncFromTemplate, templateBuf |
| `js/docx.js` | `js/club-signing.js` | docxSigRun |
| `js/signatures.js` | `js/club-signing.js` | SIGS, dataUrlToBytes |
| `js/sections.js` | `js/club-signing.js` | SIGN_CLUB, SIGN_MODE |
| `js/render.js` | `js/club-signing.js` | esc |
| `js/render.js` | `js/sections.js` | syncCamps |
| `js/render.js` | `js/country.js` | upd |
| `js/docx.js` | `js/render.js` | COMMIT, COMMIT_TEXT, commitCardClick, commitTextReset, commitTextUpload, commitToggle |
| `js/signatures.js` | `js/render.js` | SIGS, sigClear, sigUpload |
| `js/attachments.js` | `js/render.js` | IDDOC, IDLATER, LETTER, PAY, PHOTO, idClear, idLabel, idLaterToggle, idPick, idShow, letterClear, letterPick … |
| `js/storage.js` | `js/render.js` | saveDraft, saveTimer |
| `js/sections.js` | `js/render.js` | CAMPS, IS_ADMIN, SECTIONS, SIGN_CLUB, SIGN_DISTRICT |
| `js/form.js` | `js/render.js` | signSummary |
| `js/assets.js` | `js/form.js` | BUILD, TEMPLATE_B64 |
| `js/zip.js` | `js/form.js` | unzip |
| `js/xlsx.js` | `js/form.js` | b64ToBuf, buildZip, collectValues, currentDistrict, setCell, setStatus, syncFromTemplate, templateBuf |
| `js/docx.js` | `js/form.js` | COMMIT, buildCommitmentDoc, commitShow |
| `js/signatures.js` | `js/form.js` | FILE_SIGS, SIGS, addSignatures, dataUrlToBytes, sigInit |
| `js/attachments.js` | `js/form.js` | IDDOC, IDLATER, LETTER, PAY, PHOTO, idRequirement |
| `js/storage.js` | `js/form.js` | DRAFT_INFO, restoreDraft |
| `js/email.js` | `js/form.js` | MAIL_INFO |
| `js/club-signing.js` | `js/form.js` | COMMIT_FILE, SIGN_EXTRAS, signCommitmentFile |
| `js/sections.js` | `js/form.js` | IS_ADMIN, SIGN_CLUB, SIGN_DISTRICT, SIGN_MODE |
| `js/country.js` | `js/form.js` | COUNTRIES, CTRY, applyCountry, countryCfg, wirePhones |
| `js/render.js` | `js/form.js` | esc, initLists, render, upd |
