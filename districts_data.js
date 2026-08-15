// Lions YCE - données propres à CE déploiement (les autres fichiers sont communs à tous les pays).
// Pour déployer le programme dans un autre pays : forker le dépôt, puis n'éditer QUE ce fichier
// (via la page d'administration ou à la main) : dépôt GitHub du déploiement + responsables de district.

// Dépôt GitHub servi par ce déploiement (owner/repo) — utilisé par la page d'administration.
// Sur *.github.io il est détecté automatiquement ; cette valeur sert pour un domaine personnalisé.
const SITE_REPO = "pmeyssonnier/YouthCampExchange";

// Responsables YCE par district — écrits dans le formulaire (AF1, AH78, I78, E79, E80),
// affichés sur les cartes du site et utilisés par les e-mails pré-rédigés.
const DISTRICTS = {
  A: {name: "Harboort Jan", club: "LC Zottegem", email: "jan@harboort.com", mobile: "+32 473 40 01 10"},
  B: {name: "De Beule Dirk", club: "LC Antwerpen Voorkempen", email: "d.debeule@a-law.eu", mobile: "+32 478 44 69 98"},
  C: {name: "Meyssonnier Pierre", club: "LC Schaerbeek Les Cerisiers", email: "pmeyssonnier@gmail.com", mobile: "+32 477 20 08 88"},
  D: {name: "Loix George", club: "LC Hannut", email: "loixgeorges@hotmail.com", mobile: "+32 497 05 89 40"}
};
