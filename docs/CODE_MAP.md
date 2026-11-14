# Code map — Lions YCE

> **Generated file — do not edit by hand.** Rebuilt by `python3 tools/build_codemap.py` (run automatically on every push to `main`).
> Commit `d5eedd9`, 2026-11-14 23:54 UTC. Interactive version: [`code_map.html`](code_map.html).

## Pages

| Page | Role |
|---|---|
| `index.html` | public site: programme, camp directory + world map, how to apply, district contacts |
| `yce_form_filler.html` | candidate form → Excel AF + Commitment + ZIP; ?sign=club / ?sign=district countersigning; ?district=X |
| `yce_tracker.html` | district coordinator tracker: drop received ZIPs, completeness, CSV export |
| `yce_admin.html` | administration, one token: Site & season (coordinators, home page, gallery) · Camps (directory import, edit, archive, JSON backup) · Documents |
| `yce_vault.html` | application vault (Supabase): central storage, sign-off workflow, retention |
| `docs/code_map.html` | interactive version of this map |

## Public site (`index.html`)

| File | Role |
|---|---|
| index.html (387 ln, 27.8 KB) | HTML shell: nav · hero · program · explorer · Brussels · apply · testimonials · team · footer |
| css/site.css (465 ln, 37.6 KB) | site + explorer + map + modal styles, light/dark, responsive |
| js/site-data.js (103 ln, 7.4 KB) | date helpers, CAMPS enrichment, season stats, HTML escaping (esc / jsArg / safeUrl / cleanHtml) |
| js/site-explorer.js (316 ln, 19.3 KB) | directory: getFiltered/getSorted/renderTable + all filters, tabs |
| js/site-map.js (209 ln, 19.2 KB) | world map (D3): initMap/renderWorldBubbles/zoomContinent/zoomCountry/showCountryCamps |
| js/site-modal.js (112 ln, 7.6 KB) | camp detail modal: showCampDetail/buildTimeline |
| js/site-ui.js (122 ln, 7.4 KB) | theme toggle, mobile nav, scroll-reveal, Belgium teaser — runs init |

## Form filler modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/assets.js` | 6 | 504.5 KB | GENERATED — embedded templates (base64) + build version |
| `js/zip.js` | 126 | 7.5 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/xlsx.js` | 258 | 13.0 KB | ZIP writing + workbook cell read/write |
| `js/docx.js` | 173 | 9.5 KB | Commitment: text, validation, signed Word generation |
| `js/signatures.js` | 141 | 7.5 KB | signature pads + pasting signatures into the workbook |
| `js/attachments.js` | 179 | 9.6 KB | pass photo & payment proof |
| `js/storage.js` | 144 | 6.4 KB | local draft persistence |
| `js/club-signing.js` | 84 | 4.7 KB | ?sign=club remote counter-signing |
| `js/sections.js` | 164 | 10.5 KB | declarative form definition (SECTIONS, camps list, mode flags) |
| `js/country.js` | 129 | 6.8 KB | default country, dial codes, phone normalisation |
| `js/render.js` | 320 | 18.7 KB | section/widget rendering, X-groups, counter |
| `js/form.js` | 249 | 16.6 KB | orchestration: generate() and init() — loaded last |

**`js/zip.js`** — `zipBudget`, `zipCheckSize`, `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/xlsx.js`** — `crc32` (CRC-32 for zip writing), `deflateRaw` (native deflate), `buildZip` (rebuild a zip Blob), `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCellValue` (read one cell), `syncFromTemplate` (prefill inputs + X-groups from a workbook), `b64ToBuf` (base64 → ArrayBuffer), `loadTemplate` ('Other template' input), `setStatus` (status bar helper), `escXml` (escape XML), `fmtDate` (ISO → dd-mm-yyyy), `dmyToSerial`, `serialToDmy`, `addDateStyle`, `setCellDate`, `yearizeTemplate`, `setCell` (write/clear one cell keeping style), `collectValues` (gather all field values (+phone check))

**`js/docx.js`** — `commitShow` (sync validate button + card UI), `commitCardClick` (card: scroll or download), `commitToggle` (validate/cancel (needs applicant+parent sigs)), `commitTextShow` (refresh commitment text), `commitTextUpload` (admin: text from a Word doc), `commitTextReset` (restore official text), `docxReplaceRun` (swap a marker run), `docxSigRun` (inline image run XML), `buildCommitmentDoc` (fill + sign the Commitment)

**`js/signatures.js`** — `sigInit` (canvas pads + auto date), `sigClear` (clear a pad), `sigUpload` (signature from an image), `sigsFromWorkbook`, `dataUrlToBytes` (dataURL → bytes), `addSignatures` (anchor inked pads in the workbook)

**`js/attachments.js`** — `fmtSize`, `dataUrlBytes`, `shrinkImage`, `tooSmallMsg`, `reducedNote`, `photoPick` (photo upload + downscale 800px), `photoShow` (preview), `photoClear` (remove), `readDoc`, `docShow`, `payPick` (proof upload (PDF as-is, images 1600px)), `payShow` (preview), `payClear` (remove), `idRequirement`, `idLabel`, `idPick`, `idShow`, `idClear`, `idLaterToggle`, `letterPick`, `letterShow`, `letterClear`

**`js/storage.js`** — `saveDraft` (persist everything (debounced)), `filesOp`, `saveFile`, `restoreFiles`, `restoreDraft` (restore everything), `restoreDraftText`, `clearForm` (wipe + reload)

**`js/club-signing.js`** — `loadDossier`, `commitPreview`, `signCommitmentFile` (insert club signature at bookmark)

**`js/country.js`** — `countryCfg` (current country config), `dialOf`, `phoneGroups`, `normPhone` (international normalisation), `phoneProblem`, `validPhone` (phone validation), `wirePhones` (tel inputs wiring), `applyCountry` (prefill nationality/country), `setCountry` (admin selector)

**`js/render.js`** — `esc` (escape HTML), `render` (render all sections & widgets), `depShow` (conditional 'specify' fields), `xsel` (X-group selection), `initLists` (country/camp datalists), `syncCamps` (filter camps by country), `ynClick` (Yes/No & pill buttons), `refreshYn` (sync button visuals), `updState` (State field visibility), `attChecklist`, `formItems`, `upd` (fields-completed counter), `emailProblem`, `formProblems`, `missingClose`, `missingGo`, `checkMissing`

**`js/form.js`** — `signSummary`, `generate` (orchestrator: cells, signatures, downloads, e-mails), `openVault`, `adminOptions`, `init` (mode setup + startup)

## Tracker modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/zip.js` | 126 | 7.5 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/tracker-storage.js` | 22 | 1.0 KB | rows + localStorage persistence |
| `js/tracker-parser.js` | 158 | 9.1 KB | file ingestion: zip, xlsx forms, commitment, attachments |
| `js/tracker-export.js` | 31 | 2.0 KB | CSV export for Excel |
| `js/tracker-ui.js` | 69 | 5.6 KB | table, filters, sorting, stats — runs render() |

**`js/zip.js`** — `zipBudget`, `zipCheckSize`, `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/tracker-storage.js`** — `save` (persist rows), `clearAll` (wipe rows)

**`js/tracker-parser.js`** — `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCell` (read one cell), `norm` (normalise for matching), `rowKey` (row identity), `handleFiles` (dispatch dropped files (zip first-class)), `serialToDmy`, `parseForm` (extract a form into a row), `findRowByName` (match a file to a row), `matchCommit` (commitment + club-signature detection), `matchAux` (photo / payment proof)

**`js/tracker-export.js`** — `csvSafe` (neutralise spreadsheet formulas in CSV cells), `exportCsv` (24-column CSV (BOM + ;))

**`js/tracker-ui.js`** — `log` (activity journal), `isComplete` (file completeness), `setDist` (district filter), `setSort` (column sort), `esc` (escape HTML), `render` (render all sections & widgets)

## Vault modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/zip.js` | 126 | 7.5 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/xlsx.js` | 258 | 13.0 KB | ZIP writing + workbook cell read/write |
| `js/club-copy.js` | 49 | 2.8 KB | vault: reduced copy for the club president (AF without ID, religion, health + Commitment) |
| `js/vault-api.js` | 91 | 5.4 KB | vault: the only layer talking to Supabase |
| `js/vault.js` | 163 | 9.5 KB | vault UI core: constants, helpers, start-up, sign-in link, two-step verification |
| `js/vault-dashboard.js` | 93 | 5.8 KB | vault UI: dashboard — list of files, whose turn, new file |
| `js/vault-dossier.js` | 298 | 19.2 KB | vault UI: one file — display, upload, sign-off, notify, comments, club declared in the form |
| `js/vault-staff.js` | 48 | 2.6 KB | vault UI: staff (coordinators, national team) and retention purge |

**`js/zip.js`** — `zipBudget`, `zipCheckSize`, `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/xlsx.js`** — `crc32` (CRC-32 for zip writing), `deflateRaw` (native deflate), `buildZip` (rebuild a zip Blob), `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCellValue` (read one cell), `syncFromTemplate` (prefill inputs + X-groups from a workbook), `b64ToBuf` (base64 → ArrayBuffer), `loadTemplate` ('Other template' input), `setStatus` (status bar helper), `escXml` (escape XML), `fmtDate` (ISO → dd-mm-yyyy), `dmyToSerial`, `serialToDmy`, `addDateStyle`, `setCellDate`, `yearizeTemplate`, `setCell` (write/clear one cell keeping style), `collectValues` (gather all field values (+phone check))

**`js/club-copy.js`** — `zipBase`, `u8buf`, `dropUnusedShared` (removes orphan Excel shared strings), `redactApplicationForm` (empties ID / religion / health cells), `buildClubCopy` (full dossier ZIP → club copy ZIP)

**`js/vault-api.js`** — `makeVaultApi`

**`js/vault.js`** — `esc` (escape HTML), `show`, `msg` (message banner), `fmtDT`, `fmtD`, `isStaff` (does my account hold this role), `selfLink`, `sha256Hex` (fingerprint of a file), `isMinor` (under 18 at the reference date), `validBirth`, `latestFile`, `idPending`, `applicationSeason` (season being applied for), `vaultInit` (create the Supabase client, resume the session), `fillStaticLists`, `sendLink` (e-mail sign-in link), `startSession` (after sign-in: roles, then dashboard), `mfaNeeded` (two-step code required for staff), `mfaVerify` (check the code), `continueSession`, `signOut`

**`js/vault-dashboard.js`** — `myTurn` (is this file waiting for me), `waitingFor` (who must act next), `renderNext` (next-step line of a file), `renderWelcome` (welcome text by role), `loadDashboard` (read my files), `renderList` (files table), `createDossier` (new file (consent recorded))

**`js/vault-dossier.js`** — `openDossier` (load one file), `closeDossier`, `canUpload` (may this account upload), `renderDossier` (file page: checklist, signatures, history, comments), `renderActions` (buttons allowed at this step), `saveEdit` (save the file's identity fields), `uploadZip` (store the application ZIP (and the club copy)), `uploadIdLater` (passport scan sent later), `downloadFile` (signed download link), `signedDoc` (document the signature refers to), `act` (sign / validate / refuse: move to the next step), `offerNotify` (prepare the e-mail to the next person), `copyLink`, `withdraw` (delete my file), `addComment` (comment on the file), `readAfClub` (club cells of the application form), `showAfClub` (compare the declared club with the file)

**`js/vault-staff.js`** — `loadStaff` (staff list), `staffAdd` (add a coordinator / national member), `staffDelete` (remove one), `loadPurge` (files past their retention), `runPurge` (delete them (logged))

## Administration modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/zip.js` | 126 | 7.5 KB | bounded ZIP reading (limits against booby-trapped archives) — shared |
| `js/xlsx.js` | 258 | 13.0 KB | ZIP writing + workbook cell read/write |
| `js/admin-core.js` | 238 | 13.8 KB | shared admin plumbing: passphrase-encrypted token, GitHub API, atomic commits, connect hooks |
| `js/clean-html.js` | 32 | 1.7 KB | cleanHtml: the few formatting tags allowed in customisable texts — shared |
| `js/upload-limits.js` | 19 | 1.1 KB | upload size limits — shared |
| `js/admin-people.js` | 117 | 8.4 KB | Site & season tab: district coordinators, multiple district number, national team |
| `js/admin-gallery.js` | 80 | 4.3 KB | Site & season tab: home page photo gallery |
| `js/admin.js` | 232 | 14.5 KB | Site & season and Documents tabs: form, fees and bank details, save, official documents, start-up |
| `js/camps-manager.js` | 320 | 19.5 KB | Camps tab: list, camp sheet, archive, JSON backup, save to the site |
| `js/camps-match.js` | 71 | 4.2 KB | Camps tab: is it the same camp? name/place similarity, renamed camps, duplicates |
| `js/camps-import.js` | 272 | 18.5 KB | Camps tab: official YCE directory (xlsx) import — parse, review, apply |
| `js/camps-geo.js` | 77 | 4.4 KB | Camps tab: map coordinates from a NextGIS GeoJSON export |
| `js/admin-tabs.js` | 21 | 1.2 KB | admin tab switching (#site, #camps, #docs) |

**`js/zip.js`** — `zipBudget`, `zipCheckSize`, `zipDirectory` (validated central directory, no decompression), `zipNames` (file names of an archive without decompressing), `inflateRaw` (native inflate), `unzip` (parse a zip into [{name,data}] within ZIP_LIMITS)

**`js/xlsx.js`** — `crc32` (CRC-32 for zip writing), `deflateRaw` (native deflate), `buildZip` (rebuild a zip Blob), `decodeEnt` (XML entities), `textOf` (concat <t> runs), `parseShared` (sharedStrings table), `getCellValue` (read one cell), `syncFromTemplate` (prefill inputs + X-groups from a workbook), `b64ToBuf` (base64 → ArrayBuffer), `loadTemplate` ('Other template' input), `setStatus` (status bar helper), `escXml` (escape XML), `fmtDate` (ISO → dd-mm-yyyy), `dmyToSerial`, `serialToDmy`, `addDateStyle`, `setCellDate`, `yearizeTemplate`, `setCell` (write/clear one cell keeping style), `collectValues` (gather all field values (+phone check))

**`js/admin-core.js`** — `sessionSave`, `sessionClear`, `sessionToken`, `b64e`, `b64d`, `pinKey`, `encryptToken` (token encrypted with the passphrase (kept in this browser)), `decryptToken` (unlock with the passphrase), `hasEnc`, `accessMode`, `log` (activity journal of the page), `esc` (escape HTML), `token`, `gh` (GitHub API call with the token), `getFile` (read a file of the repository), `putFile` (write one file), `commitFiles` (atomic multi-file commit (Git Data API)), `b64ToUtf8`, `utf8ToB64`, `bufToB64`, `connect` (check the token, then unlock the page), `finishConnect`, `resumeSession`, `logout` (forget the token), `initAccess` (choose token / passphrase screen), `rawSpan` (position of the RAW camp array in camps_data.js)

**`js/clean-html.js`** — `safeUrl`, `cleanHtml`

**`js/upload-limits.js`** — `uploadLimits`

**`js/admin-people.js`** — `distShow` (district coordinators list), `distEdit`, `distNew`, `distCancel`, `distApply` (validate a coordinator), `distRemove` (remove a district), `mdShow` (multiple district number), `mdInput`, `teamForm`, `teamShow` (national team list), `teamEdit`, `teamCancel`, `teamApply` (validate a member), `teamRemove`, `teamMove` (change the order)

**`js/admin-gallery.js`** — `galShow` (gallery thumbnails), `galMove` (change the order), `galZoom` (full-size preview), `galPick` (add photos (reduced before upload))

**`js/admin.js`** — `limShow` (attachment size limits fields), `limValues`, `fillForm` (show the site data in the form), `ibanOk` (IBAN checksum), `paymentValues` (fee and bank details from the form), `upsertConst` (set a constant in a data file), `updPaths`, `buildDistrictsLiteral` (DISTRICTS block as written in the file), `saveData` (save season, coordinators, home page in one commit), `uploadPick` (replace an official document), `parseSiteData` (read camps_data.js / districts_data.js as text), `annMode` (announcement: edit / preview)

**`js/camps-manager.js`** — `markDirty` (unsaved changes flag), `updSave`, `simple` (lower case, no accents, letters and digits only), `seasonOf` (YCE season of a camp (September to August)), `dmyKey`, `setSort` (column sort), `setContinent`, `setView`, `render` (camp table (search, continent, sort)), `fldHtml`, `editIndex` (position of the open sheet's camp (followed by object)), `openEdit` (open a camp sheet), `newCamp` (empty sheet), `deleteEditing` (delete the open camp), `closeEdit`, `gv`, `saveEdit` (validate and apply the sheet), `today`, `archiveCamp` (move to the archive), `restoreCamp` (back from the archive), `deleteCamp`, `exportJson` (JSON backup), `jsonPick` (restore a JSON backup), `validDmy` (real calendar date check), `saveSite` (write camps_data.js + camps_archive.json in one commit)

**`js/camps-match.js`** — `sim` (bigram similarity of two texts (0 to 1)), `stripNoise` (drop years and words like Lions / camp / YCE), `factsOf` (facts of a saved camp used for matching), `factsOfT` (same facts for a directory line), `alike` (same camp? returns the reason (exact, same dates and place, …)), `likeness` (similarity percentage of two sheets), `matchCamp` (find a directory camp in a list), `findDuplicates` (possible duplicate pairs), `showDuplicates` (🔎 Check duplicates list)

**`js/camps-import.js`** — `colIdx`, `serialToDmy`, `mdyToDmy` (MM-DD-YYYY or Excel serial → dd-mm-yyyy), `xmlDoc` (parse an XML part, clear error if damaged), `xmlEls`, `xmlText` (text of a cell or shared string), `parseDirectory` (read the Approved Camps sheet of the xlsx (browser XML parser)), `continentFor` (continent of a country (known camp, else table, else unknown)), `feeOf` (fee with its currency), `dirPick` (directory file chosen → review), `changesFor` (fields the directory would change), `replacesFor` (earlier camp a new one may replace), `buildReview` (review list: updates, renames, new camps), `applyReview` (apply the ticked lines (directory or coordinates)), `cancelReview` (close the review)

**`js/camps-geo.js`** — `mercToLonLat` (EPSG:3857 → longitude, latitude), `geoPick` (GeoJSON file chosen), `geoPoints` (points with a country and a camp name), `buildGeoReview` (match points to camps, review list)

**`js/admin-tabs.js`** — `showTab`

## Public site modules

| Module | Lines | Size | Role |
|---|---:|---:|---|
| `js/clean-html.js` | 32 | 1.7 KB | cleanHtml: the few formatting tags allowed in customisable texts — shared |
| `js/site-data.js` | 103 | 7.4 KB | date helpers, CAMPS enrichment, season stats, HTML escaping |
| `js/site-explorer.js` | 316 | 19.3 KB | camp directory: filters with live counts, sorting, table, phone cards |
| `js/site-map.js` | 209 | 19.2 KB | world map (D3): continents, countries, one dot per camp |
| `js/site-modal.js` | 112 | 7.6 KB | camp sheet (modal) with its timeline |
| `js/site-ui.js` | 122 | 7.4 KB | team, payment and district cards, theme, mobile menu — runs init |

**`js/clean-html.js`** — `safeUrl`, `cleanHtml`

**`js/site-data.js`** — `parseDate` (dd-mm-yyyy → Date (real dates only)), `fmtDate` (ISO → dd-mm-yyyy), `fmtDate2`, `fmtFull`, `parseAge`, `titleCase` (uniform display of camp names), `feeEuro` (fee in euros, for sorting), `countryFlag` (flag emoji of a country), `flagged`, `typeChips`, `periodRows` (family stay / camp date lines), `esc` (escape HTML (every camp value goes through it)), `jsArg` (safe text argument of an onclick), `safeMail` (valid e-mail or null)

**`js/site-explorer.js`** — `campMatches` (does a camp pass the filters (some may be skipped for counts)), `facetCounts` (count per chip value), `renderSeasonPills`, `initSeasonPills`, `renderInclusivePill`, `renderWinterPill`, `toggleWinter`, `toggleInclusive`, `refreshFacets` (recount every filter chip), `toggleSeason`, `renderStateList`, `toggleState`, `getFiltered` (camps passing all filters), `getSorted` (sort for table and cards), `sortBy`, `renderTable` (table + phone cards + map refresh), `renderMobileSort`, `mobileSort`, `mobileSortDir`, `renderMobileCards` (phone cards), `renderFilterChips` (active filter chips), `openFilters`, `closeFilters`, `renderContinentPills`, `initContinentPills`, `toggleContinent`, `renderCountryList`, `toggleCountry`, `toggleAcc`, `setPeriodType`, `populatePeriodSelect` (month / half-month / week choices), `applyFilters` (read age / period, then redraw), `resetFilters` (clear every filter), `switchTab`, `focusBelgium`

**`js/site-map.js`** — `mapCamps`, `mapFiltersChanged`, `initMap`, `renderWorldBubbles`, `zoomContinent`, `renderContInfo`, `refreshContinent`, `renderCountryBubbles`, `zoomCountry`, `showCountryCamps`, `renderCampDots`, `clearCampDots`, `closeCountryPanel`, `goBack`, `zoomContFromCrumb`, `zoomWorld`, `renderLegend`

**`js/site-modal.js`** — `showCampDetail` (open the camp sheet), `closeModal`

**`js/site-ui.js`** — `toggleTheme`

## Data, tools and other files

| File | Size | Role |
|---|---:|---|
| `camps_data.js` | 72.2 KB | season data: SEASON + YEAR + RAW camps — common to every deployment |
| `districts_data.js` | 6.1 KB | per-deployment data: SITE_REPO + DISTRICTS coordinators |
| `js/version.js` | 0.5 KB | site version number (VERSION), shown on every page — bumped by each pull request |
| `CHANGELOG.md` | 44.2 KB | what changed in each version |
| `yce_form_filler.html` | 13.8 KB | filler HTML shell + styles |
| `yce_tracker.html` | 9.0 KB | tracker HTML shell + styles |
| `yce_admin.html` | 26.5 KB | administration HTML shell: tabs Site & season / Camps / Documents |
| `yce_camps.html` | 1.0 KB | old camp manager address — redirects to yce_admin.html#camps |
| `js/toolnav.js` | 1.3 KB | tool menu under the header of every tool page |
| `css/tools.css` | 6.9 KB | styles shared by the tool pages |
| `yce_vault.html` | 20.3 KB | application vault HTML shell (Supabase) |
| `supabase/vault_schema.sql` | 29.7 KB | vault database: tables, row-level security, workflow, retention |
| `docs/VAULT_SETUP.md` | 14.3 KB | vault setup guide (Supabase project, SMTP, GDPR) |
| `tools/build_assets.py` | 2.2 KB | regenerates js/assets.js |
| `tools/build_codemap.py` | 23.9 KB | regenerates this visualisation's data and docs/CODE_MAP.md |
| `tests/` | 4.0 KB | security & regression tests run by GitHub Actions (npm test) |
| `documents/` | 4.0 KB | official documents: reference form, Commitment, host-family letter, Commitment template (markers) |

## Who uses what (form filler)

| Defined in | Used by | Names |
|---|---|---|
| `js/zip.js` | `js/xlsx.js` | inflateRaw, unzip |
| `js/signatures.js` | `js/xlsx.js` | sigsFromWorkbook |
| `js/sections.js` | `js/xlsx.js` | SECTIONS, SIGN_MODE |
| `js/country.js` | `js/xlsx.js` | normPhone, validPhone |
| `js/render.js` | `js/xlsx.js` | XSTATE, depShow, upd |
| `js/assets.js` | `js/docx.js` | COMMIT_B64 |
| `js/zip.js` | `js/docx.js` | unzip, zipCheckSize |
| `js/xlsx.js` | `js/docx.js` | b64ToBuf, buildZip, currentDistrict, decodeEnt, escXml, setStatus |
| `js/signatures.js` | `js/docx.js` | SIGS, dataUrlToBytes |
| `js/render.js` | `js/docx.js` | esc, upd |
| `js/sections.js` | `js/signatures.js` | SECTIONS |
| `js/render.js` | `js/signatures.js` | upd |
| `js/xlsx.js` | `js/attachments.js` | setStatus |
| `js/render.js` | `js/attachments.js` | esc, upd |
| `js/docx.js` | `js/storage.js` | COMMIT, commitShow |
| `js/signatures.js` | `js/storage.js` | SIGS |
| `js/attachments.js` | `js/storage.js` | IDDOC, IDLATER, LETTER, PAY, PHOTO, idShow, letterShow, payShow, photoShow |
| `js/sections.js` | `js/storage.js` | SECTIONS, SIGN_MODE |
| `js/render.js` | `js/storage.js` | XSTATE, depShow, upd |
| `js/zip.js` | `js/club-signing.js` | unzip, zipCheckSize |
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
| `js/country.js` | `js/render.js` | countryCfg, normPhone, phoneProblem |
| `js/form.js` | `js/render.js` | REQUIRED_FIELDS, generate, signSummary |
| `js/assets.js` | `js/form.js` | BUILD, TEMPLATE_B64 |
| `js/zip.js` | `js/form.js` | unzip |
| `js/xlsx.js` | `js/form.js` | addDateStyle, b64ToBuf, buildZip, collectValues, currentDistrict, dmyToSerial, setCell, setCellDate, setStatus, syncFromTemplate, templateBuf, yearizeTemplate |
| `js/docx.js` | `js/form.js` | COMMIT, buildCommitmentDoc, commitShow |
| `js/signatures.js` | `js/form.js` | FILE_SIGS, SIGS, addSignatures, dataUrlToBytes, sigInit |
| `js/attachments.js` | `js/form.js` | IDDOC, IDLATER, LETTER, PAY, PHOTO, idRequirement |
| `js/storage.js` | `js/form.js` | DRAFT_INFO, restoreDraft |
| `js/club-signing.js` | `js/form.js` | COMMIT_FILE, SIGN_EXTRAS, signCommitmentFile |
| `js/sections.js` | `js/form.js` | IS_ADMIN, SIGN_CLUB, SIGN_DISTRICT, SIGN_MODE |
| `js/country.js` | `js/form.js` | COUNTRIES, CTRY, applyCountry, countryCfg, wirePhones |
| `js/render.js` | `js/form.js` | esc, formProblems, initLists, missingGo, render, upd |

## Who uses what (tracker)

| Defined in | Used by | Names |
|---|---|---|
| `js/tracker-ui.js` | `js/tracker-storage.js` | render |
| `js/zip.js` | `js/tracker-parser.js` | unzip, zipBudget, zipCheckSize |
| `js/tracker-storage.js` | `js/tracker-parser.js` | ROWS, save |
| `js/tracker-ui.js` | `js/tracker-parser.js` | log, render |
| `js/tracker-storage.js` | `js/tracker-export.js` | ROWS |
| `js/tracker-storage.js` | `js/tracker-ui.js` | ROWS, STATUSES, save |
| `js/tracker-parser.js` | `js/tracker-ui.js` | handleFiles, norm |

## Who uses what (vault)

| Defined in | Used by | Names |
|---|---|---|
| `js/zip.js` | `js/xlsx.js` | inflateRaw, unzip |
| `js/vault.js` | `js/xlsx.js` | API, msg |
| `js/zip.js` | `js/club-copy.js` | unzip, zipBudget |
| `js/xlsx.js` | `js/club-copy.js` | buildZip, setCell |
| `js/vault.js` | `js/vault-api.js` | mfaVerify, sendLink, signOut |
| `js/vault-dashboard.js` | `js/vault-api.js` | createDossier |
| `js/vault-dossier.js` | `js/vault-api.js` | addComment |
| `js/vault-staff.js` | `js/vault-api.js` | staffAdd, staffDelete |
| `js/vault-api.js` | `js/vault.js` | makeVaultApi |
| `js/vault-dashboard.js` | `js/vault.js` | loadDashboard |
| `js/vault-dossier.js` | `js/vault.js` | openDossier |
| `js/vault-staff.js` | `js/vault.js` | loadPurge, loadStaff |
| `js/vault.js` | `js/vault-dashboard.js` | API, CONSENT_VERSION, STATUS, esc, fmtD, isMinor, isStaff, msg, show, validBirth |
| `js/vault-dossier.js` | `js/vault-dashboard.js` | openDossier |
| `js/zip.js` | `js/vault-dossier.js` | unzip, zipBudget, zipNames |
| `js/xlsx.js` | `js/vault-dossier.js` | getCellValue, parseShared |
| `js/club-copy.js` | `js/vault-dossier.js` | buildClubCopy |
| `js/vault.js` | `js/vault-dossier.js` | API, CHECKLIST, STATUS, esc, fmtD, fmtDT, idPending, isMinor, isStaff, latestFile, msg, selfLink … |
| `js/vault-dashboard.js` | `js/vault-dossier.js` | loadDashboard, renderNext |
| `js/vault.js` | `js/vault-staff.js` | API, esc, msg |
| `js/vault-dashboard.js` | `js/vault-staff.js` | loadDashboard |

## Who uses what (administration)

| Defined in | Used by | Names |
|---|---|---|
| `js/zip.js` | `js/xlsx.js` | inflateRaw, unzip |
| `js/admin-core.js` | `js/admin-people.js` | esc, log |
| `js/admin.js` | `js/admin-people.js` | DIST_EDIT, DIST_W, MD_W, TEAM_EDIT, TEAM_W |
| `js/admin-core.js` | `js/admin-gallery.js` | esc, getFile, log, putFile |
| `js/admin.js` | `js/admin-gallery.js` | GAL |
| `js/admin-core.js` | `js/admin.js` | ON_CONNECT, b64ToUtf8, bufToB64, commitFiles, esc, getFile, initAccess, log, putFile, rawSpan, utf8ToB64 |
| `js/clean-html.js` | `js/admin.js` | cleanHtml |
| `js/upload-limits.js` | `js/admin.js` | uploadLimits |
| `js/admin-people.js` | `js/admin.js` | distShow, mdShow, teamShow |
| `js/admin-gallery.js` | `js/admin.js` | galShow |
| `js/admin-core.js` | `js/camps-manager.js` | ON_CONNECT, b64ToUtf8, commitFiles, esc, getFile, initAccess, log, rawSpan, utf8ToB64 |
| `js/camps-match.js` | `js/camps-manager.js` | showDuplicates |
| `js/admin-core.js` | `js/camps-match.js` | esc |
| `js/camps-manager.js` | `js/camps-match.js` | CAMPS_W, openEdit, simple |
| `js/zip.js` | `js/camps-import.js` | unzip, zipCheckSize |
| `js/admin-core.js` | `js/camps-import.js` | esc, log |
| `js/camps-manager.js` | `js/camps-import.js` | ARCH, CAMPS_W, CONTINENTS, DET_KEYS, markDirty, render, seasonOf, simple, today, validDmy |
| `js/camps-match.js` | `js/camps-import.js` | factsOf, factsOfT, likeness, matchCamp, sim, stripNoise |
| `js/admin-core.js` | `js/camps-geo.js` | esc, log |
| `js/camps-manager.js` | `js/camps-geo.js` | CAMPS_W, simple |
| `js/camps-match.js` | `js/camps-geo.js` | sim, stripNoise |
| `js/camps-import.js` | `js/camps-geo.js` | applyReview |
| `js/admin-core.js` | `js/admin-tabs.js` | ON_CONNECT, connect |

## Who uses what (public site)

| Defined in | Used by | Names |
|---|---|---|
| `js/site-data.js` | `js/site-explorer.js` | CAMPS, MULTI_SEASON, esc, flagged, fmtDate, fmtDate2, jsArg, periodRows, titleCase, typeChips |
| `js/site-map.js` | `js/site-explorer.js` | initMap, mapFiltersChanged, mapInited |
| `js/site-modal.js` | `js/site-explorer.js` | showCampDetail |
| `js/site-data.js` | `js/site-map.js` | CAMPS, CONT_CAMP_COUNTS, MULTI_SEASON, esc, fmtDate2, jsArg, periodRows, titleCase, typeChips |
| `js/site-explorer.js` | `js/site-map.js` | getFiltered, renderTable |
| `js/site-modal.js` | `js/site-map.js` | showCampDetail |
| `js/clean-html.js` | `js/site-modal.js` | safeUrl |
| `js/site-data.js` | `js/site-modal.js` | CAMPS, esc, fmtDate, fmtFull, titleCase |
| `js/clean-html.js` | `js/site-ui.js` | cleanHtml, safeUrl |
| `js/site-data.js` | `js/site-ui.js` | CAMPS, esc, fmtDate2, safeMail, titleCase |
| `js/site-explorer.js` | `js/site-ui.js` | initContinentPills, initSeasonPills, renderCountryList, renderInclusivePill, renderStateList, renderTable, renderWinterPill |
