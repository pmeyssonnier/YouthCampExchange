# Season update — annual checklist

How to switch the whole platform (site, form filler, tracker) to a new YCE season.
Everything derives from a handful of source files; the generated files are rebuilt by scripts.

## 1. Collect the new camp list

1. Run `Lions Camp Scraper.ipynb` — it collects the season's camps from the LCI camp
   directory and writes `lions_camps.json` (raw list: continent, country, name, ages,
   fee, dates).
2. Run `python3 enriched_lions_camps.py` — it visits each camp's page on
   `lions-yce-belgium.be/destinations/…` and writes `lions_camps_enriched.json`
   (adds `detail`: location, description, host-family activities, languages,
   contacts, links). Camps whose page is not found keep their raw record —
   check the script's console summary and fix slugs manually if needed.

## 2. Update the data source

`camps_data.js` is the **single source of truth** for camp data.

1. Replace the `SEASON` constant (e.g. `"2026–2027"`).
2. Replace the `RAW = [...]` array with the enriched list. `RAW` is standard JSON —
   each record: `continent, country, camp_name, age_requirements, fee, camp_starts,
   camp_ends, family_stay_starts, family_stay_ends, detail{…}` (dates `dd-mm-yyyy`).

Everything that displays camp data updates itself from this file: the site's hero
stats, explorer table, map bubble counts, the filler's camp suggestions, and the
season labels (`.season-lbl`). **Exception**: if a camp appears in a country never
mapped before, add its coordinates in `js/site-map.js` (`COUNTRY_COORDS` +
`COUNTRY_ZOOM` — many extra countries are already pre-mapped there).

## 3. Update the official documents

1. Drop the four new district forms at the repository root, named like
   `Application form 20XX Distr A 1.xlsx` (A–D), and update the download links
   in `index.html` (the four `.dist-card` blocks) if the file names change.
2. Produce the new **sanitized blank template** (district C form with every
   personal-data cell empty) as `Application_form_20XX_Distr_C_vierge.xlsx`
   and verify it contains no personal data. It becomes the template embedded
   in the filler.
3. Update `Commitment to Reciprocity.docx`, `tools/commit_template.docx`
   (keep the `§CAND§ / §DATE§ / [BODY] / [SIG1-3]` markers) and
   `Letter_to_Host_Family_2026.docx` if their official text changed.

## 4. Update the season year

The camp year lives in a **single constant**, next to `SEASON` in `camps_data.js`:

```js
const YEAR = "2026";
```

Changing it updates everywhere at once: generated file names
(`Dossier_YCE_20XX_…`), e-mail subjects and signatures, the on-screen labels
and page titles, the tracker's age-reference date (July 1st of the camp year)
and the browser storage keys. New storage keys are deliberate: every browser
gets a clean start for the new season instead of resurrecting last year's
drafts and tracker rows.

Two things stay manual because they are real file names or editorial text:
the download links and announcement banner in `index.html` (checked in step 3),
and the template files' own names (`Letter_to_Host_Family_20XX.docx` must be
renamed to match the new year — the filler links to it by `YEAR`). A final
`grep -rn "20XX-1"` (previous year) across the repo catches anything left.

If a field's cell reference changed in the new official form (rare), fix it in
`js/sections.js` (form definition), `js/form.js` (`REQUIRED_FIELDS`) and
`js/tracker-parser.js` (`REQUIRED`) — the three lists must stay aligned.

## 5. Rebuild the generated files

```bash
python3 tools/build_assets.py     # embeds the new blank form + Commitment template,
                                  # bumps the build version, re-exports camps.json
python3 tools/build_codemap.py    # refreshes the interactive code map data
```

Never edit `js/assets.js`, `camps.json` or `docs/codemap-data.js` by hand.

## 6. Verify and publish

1. Open `index.html` — hero stats, explorer, map and the Belgium card must show
   the new season; open `yce_form_filler.html?district=C` — camp suggestions,
   labels and the generated file names must carry the new year.
2. Run through the full circuit once: fill a test application → generate the ZIP →
   counter-sign it via `?sign=club` → `?sign=district` → drop it in the tracker.
3. Commit and push to `main` (GitHub Pages serves from `main`). The build version
   in the filler header (`vYYYY.MM.DD-commit`) confirms browsers pick up the update.
