# Consignes de travail — Lions YCE

Lu au début de chaque session. Les échanges avec le responsable du projet se font en **français** ;
le site, les formulaires et les messages de commit sont en anglais.

## Une Pull Request par modification

- Ne jamais pousser directement sur `main`. Chaque modification part d'une branche à jour avec
  `main`, est poussée, puis proposée dans une **Pull Request vers `main`**. C'est le responsable
  du projet qui relit et fusionne : le site (GitHub Pages) ne change qu'à la fusion.
- Une PR = un sujet. Titre court en anglais ; description qui explique le besoin, ce qui change
  pour les utilisateurs et comment c'est testé.
- Chaque PR augmente le numéro de version dans `js/version.js` (`MAJEUR.MINEUR.CORRECTIF` :
  correctif = correction, mineur = nouveauté, majeur = changement qui oblige à refaire quelque chose)
  et ajoute en tête de `CHANGELOG.md` une entrée en anglais pour cette version, puis lancer
  `python3 tools/stamp_version.py` (ajoute `?v=VERSION.empreinte` aux scripts et styles de chaque page — l'empreinte suit le contenu du fichier, pour
  que les navigateurs ne gardent pas d'anciens fichiers en cache). Le test `version` vérifie le tout.
- Une PR déjà fusionnée est terminée : la modification suivante repart de `main` dans une nouvelle PR.
- Les commits automatiques sur `main` restent normaux : régénération par le robot
  (`Rebuild generated files [skip ci]`) et sauvegardes faites depuis les pages d'administration.

## Avant d'ouvrir la PR

- Lancer les tests : `cd tests && npm ci && npx playwright install chromium && npm test`.
  Le workflow « Tests » les relance sur chaque PR ; une PR doit être verte.
- Ne pas modifier à la main les fichiers générés (`js/assets.js`, `camps.json`,
  `docs/codemap-data.js`, `docs/CODE_MAP.md`) : `python3 tools/build_assets.py` et
  `python3 tools/build_codemap.py` les recalculent, et le robot le fait après chaque fusion.
- Vérifier l'affichage sur mobile (largeur 390 px) pour tout changement visible.

## Données personnelles

- Le dépôt est public : jamais de dossier de candidat, de formulaire rempli, de scan ou de photo
  de jeune dans le dépôt, les tests ou les PR. Les tests utilisent des données fictives.
- Toute donnée de camp ou de configuration affichée en HTML passe par `esc()` / `safeUrl()` /
  `cleanHtml()` ; toute archive reçue est lue avec `js/zip.js` (lecture bornée).
