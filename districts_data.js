// Lions YCE - données propres à CE déploiement (les autres fichiers sont communs à tous les pays).
// Pour déployer le programme dans un autre pays : forker le dépôt, puis n'éditer QUE ce fichier
// (via la page d'administration ou à la main) : dépôt GitHub du déploiement + responsables de district.

// Dépôt GitHub servi par ce déploiement (owner/repo) — utilisé par la page d'administration.
// Sur *.github.io il est détecté automatiquement ; cette valeur sert pour un domaine personnalisé.
const SITE_REPO = "pmeyssonnier/YouthCampExchange";

// Multiple District et pays de CE déploiement — écrits dans le formulaire à l'ouverture
// (le fichier de référence est neutre : aucune référence au MD ni au pays).
const MD = "112";
const MD_COUNTRY = "Belgium";

// Responsables YCE par district — écrits dans le formulaire (AF1, AH78, I78, E79, E80),
// affichés sur les cartes du site et utilisés par les e-mails pré-rédigés.
// Personnalisation de la page d'accueil de CE déploiement (textes selon le pays).
// Une clé absente/vide laisse le texte par défaut écrit dans index.html.
const SITE = {
  label: "MD112 Belgium",
  announce: "📢 <strong>Registrations for 2026 are closed.</strong> Next info session in November — date to be announced. Follow us on Facebook for updates.",
  heroTitle: "Bringing youth together, <em>worldwide</em>",
  heroLead: "Live with a host family, join an international camp, and share ideas with young people from every continent. Lions Youth Camp & Exchange sends Belgian youth aged 16–22 abroad for 2 to 4 unforgettable weeks — and welcomes the world to Belgium.",
  welcomeNav: "Come to Belgium",
  welcomeKicker: "Do you want to come?",
  welcomeTitle: "Discover Belgium with us",
  welcomeText: "Every summer, MD112 Belgium welcomes young people from all over the world for its own camp — the perfect mirror of what our Belgian participants experience abroad.",
  welcomeList: ["Stay with a warm Belgian host family","Visit Brussels, Bruges, Antwerp, Ghent and more","Sports, games and team activities with youth from 20+ countries","Discover Belgian culture — chocolate, fries and all"],
  welcomeButton: "🇧🇪 See the Belgian camp",
  galleryTitle: "The programme in pictures",
  address: "📍 Houba de Strooperlaan 90, 1020 Brussels",
  phone: "+32 2 478 17 31"
};

// Galerie photos animée de la page d'accueil — gérée depuis la page d'administration.
// Chaque entrée : {"src": "assets/gallery/….jpg", "caption": "…"}. Vide = section masquée.
const GALLERY = [{"src":"assets/gallery/37361.jpg","caption":""},{"src":"assets/gallery/37358.jpg","caption":""},{"src":"assets/gallery/37360.jpg","caption":""},{"src":"assets/gallery/37269.jpg","caption":""},{"src":"assets/gallery/37360.jpg","caption":""}];

const DISTRICTS = {
  A: {name: "Harboort Jan", club: "LC Zottegem", email: "jan@harboort.com", mobile: "+32 473 40 01 10"},
  B: {name: "De Beule Dirk", club: "LC Antwerpen Voorkempen", email: "d.debeule@a-law.eu", mobile: "+32 478 44 69 98"},
  C: {name: "Meyssonnier Pierre", club: "LC Schaerbeek Les Cerisiers", email: "pmeyssonnier@gmail.com", mobile: "+32 477 20 08 88"},
  D: {name: "Loix George", club: "LC Hannut", email: "loixgeorges@hotmail.com", mobile: "+32 497 05 89 40"}
};
