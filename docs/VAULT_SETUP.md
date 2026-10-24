# Coffre des dossiers YCE — mise en service

Le coffre (`yce_vault.html`) remplace la circulation des dossiers ZIP par e-mail.
Chaque dossier est stocké **une seule fois**, dans une base hébergée dans l'UE.
Le candidat, son parent, son président de club, son coordinateur de district et l'équipe
nationale l'ouvrent au même endroit pour le consulter, le signer et le valider.
Les e-mails ne contiennent plus qu'un lien.

- **Responsable du traitement** : le Multiple District (MD 112 Belgium).
- **Conservation** : 2 ans après la fin de la saison, parce que la famille du jeune
  accueille l'année suivante (réciprocité). Après un refus, 90 jours.
- **Signature** : signature électronique simple. Identité vérifiée par le lien envoyé par e-mail,
  horodatage, et empreinte SHA-256 de la version exacte du ZIP signée.
- **Candidat mineur** : un parent ou tuteur approuve le dossier avant qu'il parte au club.
- **Président de club** : il ne reçoit qu'une **copie réduite**, générée automatiquement au dépôt.
  Elle contient l'AF sans la pièce d'identité, la religion ni la section santé, plus le Commitment.
  Le dossier complet (avec le scan de la pièce d'identité) n'est visible que du candidat, du parent,
  du district et du national.
- **Double authentification** obligatoire pour les coordinateurs, l'équipe nationale et les
  administrateurs : sans elle, la base ne leur donne aucun droit.

Tant que `SUPABASE_URL` est vide dans `districts_data.js`, la page affiche
« Vault not configured yet » et le reste du site fonctionne comme avant.

---

## 1. Créer le projet Supabase (10 minutes)

1. Créez un compte sur <https://supabase.com>, de préférence avec une adresse du MD
   plutôt qu'une adresse personnelle, pour faciliter la passation.
2. **New project** :
   - Name : `lions-yce-md112`
   - Database password : un mot de passe long, à conserver dans le gestionnaire de mots de passe du MD
   - **Region : Central EU (Frankfurt)**. C'est important pour le RGPD.
3. Attendez que le projet soit prêt (1 à 2 minutes).

## 2. Installer le schéma

1. Menu **SQL Editor** → **New query**.
2. Copiez-collez **tout** le contenu de `supabase/vault_schema.sql`, puis cliquez sur **Run**.
   Le message attendu est « Success. No rows returned ».
3. Toujours dans le SQL Editor, déclarez les premiers intervenants en remplaçant les adresses :

```sql
insert into staff (email, role, district, full_name) values
  ('admin@example.org',       'admin',    null, 'Administrateur'),
  ('national@example.org',    'national', null, 'Responsable national YCE'),
  ('coordinateur.a@example.org', 'district', 'A', 'Coordinateur district A'),
  ('coordinateur.b@example.org', 'district', 'B', 'Coordinateur district B'),
  ('coordinateur.c@example.org', 'district', 'C', 'Coordinateur district C'),
  ('coordinateur.d@example.org', 'district', 'D', 'Coordinateur district D');
```

Les adresses doivent être en **minuscules**. Une même personne peut avoir plusieurs rôles
(par exemple administrateur et national). Par la suite, l'administrateur gère l'équipe
depuis le panneau **Team** de la page, sans repasser par le SQL.

Les présidents de club et les parents n'ont **pas** besoin d'être déclarés. Le candidat indique l'adresse de son
président dans son dossier, et seul ce président voit ce dossier.

## 3. Connexion par lien magique

Menu **Authentication** → **URL Configuration** :

- **Site URL** : `https://pmeyssonnier.github.io/YouthCampExchange/yce_vault.html`
- **Redirect URLs** → Add : `https://pmeyssonnier.github.io/YouthCampExchange/yce_vault.html**`

Adaptez ces adresses si vous passez sur un nom de domaine propre (par exemple `.be`).

### Envoi des e-mails : obligatoire avant d'ouvrir aux candidats

Le service d'e-mail intégré à Supabase est réservé aux tests. Il n'envoie qu'aux membres de
l'équipe du projet Supabase, et seulement quelques messages par heure. Pour les candidats,
il faut brancher un serveur d'envoi (SMTP) :

1. Créez un compte gratuit chez un service d'envoi européen, par exemple **Brevo**
   (300 e-mails par jour gratuits). Vérifiez l'adresse d'expédition, par exemple `yce@votre-domaine`.
2. Supabase → **Authentication** → **Emails** → **SMTP Settings** → activez **Custom SMTP**
   et recopiez l'hôte, le port, l'identifiant et le mot de passe fournis par le service.
3. Avec un SMTP personnalisé, Supabase limite d'abord l'envoi à 30 e-mails par heure. C'est suffisant pour
   le YCE, et ajustable dans **Authentication** → **Rate Limits**.
4. Dans **Email Templates** → **Magic Link**, si votre offre permet de modifier les modèles, mettez un texte en anglais, par exemple :
   *Subject* : `Your Lions YCE sign-in link`, *Body* : `<p>Click to open the Lions YCE application vault:</p><p><a href="{{ .ConfirmationURL }}">Sign in</a></p><p>This link works once and expires in one hour.</p>`

### Double authentification (TOTP)

Vérifiez dans **Authentication** → **Multi-Factor** (ou *Sign In / Providers*, selon la version du
tableau de bord) que *TOTP (App Authenticator)* est **activé**.
Chaque coordinateur l'installe lui-même à sa première connexion. Le coffre affiche un QR code à
scanner avec une application d'authentification (Google Authenticator, Microsoft Authenticator,
1Password…), puis demande le code à 6 chiffres. Aux connexions suivantes, seul le code est demandé.
Supabase ne fournit pas de codes de secours. **En cas de téléphone perdu**, l'administrateur
supprime l'ancien facteur dans le SQL Editor (en remplaçant l'adresse) ; à sa prochaine connexion,
la personne scanne un nouveau QR code :

```sql
delete from auth.mfa_factors
 where user_id = (select id from auth.users where email = 'coordinateur.a@example.org');
```

## 4. Relier le site au coffre

Menu **Project Settings** → **API** :

- copiez **Project URL** et la clé **anon public** ;
- dans `districts_data.js`, renseignez :

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi…";
```

La clé **anon** est publique par conception : c'est la base qui protège les données, grâce aux
règles d'accès installées à l'étape 2.
**Ne copiez jamais la clé `service_role`** dans le site : elle contourne toutes les protections.

## 5. Offre et sauvegardes

- **Offre gratuite** : suffisante en volume (environ 40 dossiers de 5 Mo par saison). Mais un projet
  gratuit **se met en pause après 7 jours sans activité**, et n'a pas de sauvegarde quotidienne.
- **Recommandé** : passer en **Pro** (environ 25 $/mois) au moins pendant la période des candidatures
  (novembre à juin), pour les sauvegardes quotidiennes et l'absence de mise en pause.

## 6. RGPD : à faire une fois

- Accepter le **contrat de sous-traitance (DPA)** de Supabase :
  Organization → **Legal documents**.
- Inscrire le traitement au **registre des traitements** du MD : finalité « sélection et échanges YCE »,
  base légale « consentement et exécution du programme », durée « 2 ans après la saison »,
  destinataires « club, district, national, pays d'accueil ».
- L'avis affiché au candidat à la création de son dossier mentionne le responsable (le MD),
  la durée de conservation et la personne à contacter (le coordinateur de district).
  Si le texte change, augmentez `CONSENT_VERSION` dans `js/vault.js`.

## 7. Chaque saison

- Panneau **Team** : retirer les coordinateurs sortants et ajouter les nouveaux.
- Panneau **Retention** (équipe nationale) : supprimer les dossiers arrivés à échéance.
  La page affiche combien de dossiers ont dépassé leur date de conservation.

## Circuit d'un dossier

| Étape | Qui agit | Action |
|---|---|---|
| Draft | Candidat | crée son dossier, dépose le ZIP du formulaire (la copie club est générée automatiquement), l'envoie |
| Awaiting parent / guardian | Parent (candidat de moins de 18 ans) | vérifie le dossier complet, **approuve**, ou renvoie avec un commentaire |
| Awaiting club president | Président de club | télécharge la **copie club**, vérifie, **signe**, ou renvoie avec un commentaire |
| Awaiting district coordinator | Coordinateur du district | vérifie, **contre-signe**, ou renvoie |
| Awaiting national YCE team | Équipe nationale | **valide**, ou renvoie |
| Ready to send to host country | Équipe nationale | marque « envoyé au pays d'accueil » |
| Sent to host country | Équipe nationale | accepté ou refusé |
| Accepted / Refused | Équipe nationale | archive |

À chaque étape :

- la page propose d'écrire l'e-mail à la personne suivante, avec **un lien et jamais de pièce jointe** ;
- l'historique garde la trace de qui a déposé, téléchargé, signé ou renvoyé, et quand ;
- chaque signature est liée à l'empreinte du ZIP signé : si le dossier est remplacé, il faut signer à nouveau ;
- l'envoi est refusé tant qu'il manque une pièce : AF, Commitment, photo, preuve de paiement,
  scan du passeport ou de la carte d'identité, lettre à la famille d'accueil.
- pièce d'identité : **passeport** si l'un des pays choisis est hors d'Europe (Royaume-Uni compris),
  sinon la carte d'identité belge suffit. Si le passeport est en renouvellement, le candidat coche
  « scan à suivre » dans le formulaire : le dossier peut être envoyé et validé, le candidat dépose le
  scan plus tard dans le coffre, et le national ne peut pas transmettre le dossier au pays d'accueil
  avant de l'avoir reçu.

## Déploiement dans un autre pays

Chaque Multiple District crée **son propre** projet Supabase (étapes 1 à 6) et renseigne sa
propre adresse dans **son** `districts_data.js`. Le code reste commun à tous les pays.
