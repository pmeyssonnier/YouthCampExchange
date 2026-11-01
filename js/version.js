// version.js — numéro de version du site, source unique, affiché sur toutes les pages
// Chaque Pull Request l'augmente (MAJEUR.MINEUR.CORRECTIF) et ajoute une entrée en tête de CHANGELOG.md.
// Chargé par index.html et toutes les pages yce_*.html ; remplit chaque élément de classe app-ver.
"use strict";
const VERSION = "1.16.0";
document.querySelectorAll(".app-ver").forEach(function(s){ s.textContent = "v" + VERSION; s.title = "site version"; });
