# YouthCampExchange — Guide de déploiement pour les Multi Districts Lions

> Document de travail — 25 octobre 2026. Guide de distribution, d'installation et de maintenance. Les étapes proposées ne sont pas toutes automatisées dans la version actuelle.

## 1. Recommandation

Conserver l'application web actuelle, GitHub et son architecture JavaScript. Prévoir **un logiciel commun, mais un déploiement, une configuration, un domaine et un coffre documentaire indépendants pour chaque Multi District (MD)**. Il n'est pas nécessaire de réécrire l'application dans un autre framework.

Le dépôt central gère les évolutions et les correctifs. Chaque MD conserve la maîtrise de ses données et de son identité.

## 2. Architecture cible

| Composant | Rôle |
|---|---|
| YouthCampExchange Core | Code commun, tests, correctifs et versions |
| Déploiement du MD | Site indépendant et configuration locale |
| Domaine du MD | Exemple fictif : `yce.domaine-du-md.org`, avec HTTPS |
| Hébergement | GitHub Pages ou hébergement web existant du MD |
| Supabase du MD | Base et stockage privés : candidatures, documents, signatures |
| Administration locale | Districts, responsables, contenus, frais, coordonnées bancaires |

**Ne jamais stocker les candidatures ou scans d'identité dans le dépôt GitHub.**

## 3. Fork, template ou SaaS ?

| Option | Atout | Limite |
|---|---|---|
| Fork GitHub | Rapide pour un pilote ; historique lié à l'origine | Risque de conflits lors des mises à jour |
| Dépôt issu d'un template | Installation initiale simple | Pas de synchronisation automatique avec le modèle |
| Code commun et déploiements indépendants | Mises à jour maîtrisées, données isolées | Nécessite un mécanisme de distribution des versions |
| SaaS multitenant | Une seule plateforme à exploiter | Complexité accrue des droits, de l'isolation et de la gouvernance |

**Choix conseillé :** commencer avec un deuxième MD en fork ou template, puis mettre en place une distribution de versions stables qui ne modifie jamais les configurations locales.

## 4. Prérequis

- Un responsable YCE et un référent technique pour l'installation.
- Un compte ou une organisation GitHub avec les droits nécessaires.
- Un sous-domaine officiel du MD et un accès à sa configuration DNS.
- Les informations locales : numéro du MD, pays, districts, responsables, équipe, frais et banque.
- Une décision sur le responsable du traitement des données, les règles RGPD, la conservation et les accès.
- Pour activer le coffre : un projet Supabase propre au MD, une configuration d'authentification et des sauvegardes.

## 5. Installation initiale

### Étape 1 — Créer le dépôt du MD

Créer un fork du dépôt [YouthCampExchange](https://github.com/pmeyssonnier/YouthCampExchange) ou utiliser un dépôt modèle lorsqu'il sera disponible. Conserver les modules applicatifs communs inchangés autant que possible.

### Étape 2 — Personnaliser le MD

Adapter `districts_data.js` :

- `SITE_REPO` : propriétaire et nom du dépôt GitHub du MD ;
- `MD` et `MD_COUNTRY` : identifiant et pays ;
- `SITE` : nom, annonces, textes et coordonnées ;
- `TEAM` : équipe nationale / multidistrict ;
- `PAYMENT` : frais et coordonnées bancaires ;
- `DISTRICTS` : responsables des districts.

Vérifier également les langues, les modèles de documents et les règles locales. Les fichiers actuels contiennent encore des éléments propres à la Belgique : ils doivent être adaptés avant une distribution internationale.

### Étape 3 — Publier le site

Activer GitHub Pages dans les paramètres du dépôt et vérifier le site sur son adresse `github.io`. Tester les liens, ressources statiques, formulaires et pages d'administration.

### Étape 4 — Configurer le domaine officiel

Le MD peut utiliser un sous-domaine comme `yce.domaine-du-md.org` :

1. Déclarer le domaine dans **GitHub → Settings → Pages → Custom domain**.
2. Créer les enregistrements DNS demandés par GitHub (leur type dépend du domaine choisi).
3. Attendre la validation DNS et activer **Enforce HTTPS**.
4. Vérifier tous les chemins et redirections sur le nouveau domaine.

Le paramètre `SITE_REPO` permet notamment à l'administration de retrouver son dépôt lorsqu'un domaine personnalisé est utilisé.

### Étape 5 — Installer le coffre privé

Suivre [docs/VAULT_SETUP.md](VAULT_SETUP.md) et appliquer [supabase/vault_schema.sql](../supabase/vault_schema.sql) dans un **projet Supabase indépendant pour chaque MD**.

Configurer `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `districts_data.js`, ainsi que les URL de redirection d'authentification autorisées. La clé anonyme est publique par conception : la protection doit venir des règles RLS et des politiques de stockage. Ne jamais publier de clé `service_role`.

Tant que les valeurs Supabase sont vides, le coffre n'est pas activé.

### Étape 6 — Définir les accès

Attribuer les rôles candidat, parent/tuteur, président de club, coordinateur de district et équipe nationale. Imposer la MFA aux responsables concernés. Vérifier l'isolation des districts et la restriction des documents sensibles, notamment la copie réduite visible par le président de club.

### Étape 7 — Tester avant ouverture

Utiliser des **données fictives** pour valider :

- le choix des camps et la création de l'AF ;
- les documents obligatoires, le scan d'identité et la preuve de paiement ;
- le parcours candidat → parent → club → district → national ;
- les signatures, empreintes SHA-256 et versions conservées ;
- les accès refusés entre districts et entre rôles ;
- les emails, les exports, la gestion des archives ZIP et les sauvegardes ;
- le comportement sur mobile et sur le domaine personnalisé.

Ne pas recueillir de dossiers réels de mineurs avant la validation de la sécurité du coffre déployé.

### Étape 8 — Exploitation et mises à jour

Documenter la version installée, les responsables, la politique de sauvegarde, la gestion des incidents et la procédure de mise à jour. Tester les nouvelles versions avant de les appliquer en production.

## 6. Sécurité et protection des mineurs

- Garder les pièces personnelles dans un stockage privé, jamais dans GitHub ou GitHub Pages.
- Faire appliquer les autorisations côté Supabase (RLS et stockage), pas seulement dans l'interface.
- Vérifier l'identité du signataire ; une empreinte SHA-256 relie une signature au fichier mais ne prouve pas, seule, l'identité de la personne.
- Tester l'impossibilité d'accéder aux dossiers d'un autre district.
- Limiter l'accès aux données de santé et aux pièces d'identité selon le besoin réel.
- Définir et documenter la base légale, l'information des familles, les durées de conservation et la purge.
- Prévoir des sauvegardes, une procédure de récupération et un responsable du traitement identifié.

## 7. Répartition des responsabilités

| Équipe du logiciel commun | Chaque MD |
|---|---|
| Maintenance du code, tests, versions et correctifs | Domaine, contenus, utilisateurs et procédures |
| Documentation d'installation et de mise à jour | Supabase, sauvegardes, gestion des accès |
| Modèles génériques et compatibilité | Conformité locale et responsabilité des données |

## 8. Ce qui existe et ce qui reste à développer

**Déjà présent :** configuration locale dans `districts_data.js`, interface d'administration, pages statiques, schéma Supabase, guide de mise en service du coffre, tests, automatisations GitHub et carte du code.

**À finaliser :** dépôt modèle réellement générique, assistant de première configuration, séparation stricte code/configuration, mécanisme de mises à jour versionnées, traductions et modèles par pays, recette de sécurité du coffre et documentation des migrations.

## 9. Proposition de pilote

Sélectionner un deuxième MD volontaire, lui créer un site sous son domaine, utiliser sa configuration et son propre projet Supabase, puis effectuer une recette complète avec des données fictives. Mesurer les difficultés d'installation et de mise à jour avant de généraliser.

## Références

- [Dépôt YouthCampExchange](https://github.com/pmeyssonnier/YouthCampExchange)
- [Carte du code](CODE_MAP.md)
- [Configuration du coffre](VAULT_SETUP.md)
- [Schéma Supabase](../supabase/vault_schema.sql)
- [Documentation GitHub Pages : domaine personnalisé](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
