# Changelog

Every pull request raises the version in `js/version.js` and adds its entry at the top of this file.
Numbering is `MAJOR.MINOR.PATCH`: PATCH for a fix, MINOR for a new feature,
MAJOR for a change that requires users or coordinators to redo something.
The version is shown on every page (site footer, tool headers).

## 1.0.0 — 2026-10-24

First numbered version, covering the platform as it stands:

- Public site: camp explorer with filters (season, continent, country, state, period, age), world map following the filters, mobile filter drawer, photo gallery, district contacts.
- Application form filler: Excel application form, Commitment to Reciprocity, signatures, photo, payment proof, passport / ID card scan (passport outside Europe, scan may follow during renewal), ZIP for the club and district.
- District tracker: received ZIPs, completeness check, CSV export.
- Administration and camp manager: season, coordinators, home page, gallery, camp directory, saved as atomic commits to GitHub.
- Application vault (Supabase, not yet activated): central storage, parent approval, club / district / national sign-off, redacted club copy, two-factor sign-in for staff, 2-year retention.
- Security: escaped output and content security policy on every page, bounded ZIP reading, admin passphrase, automated tests on every pull request.
