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

### Contrôle de sécurité (obligatoire avant d'ouvrir le coffre)

Toujours dans le SQL Editor, nouvelle requête : copiez-collez **tout** `supabase/security_check.sql`,
puis **Run**. Le contrôle se met dans la peau de chaque profil : candidat, président et coordinateur
d'un autre district, coordinateur sans double authentification, administrateur, visiteur anonyme,
comptes non confirmés utilisant l'adresse d'un autre. Chaque profil tente de lire et de modifier un
dossier du district C par toutes les voies : tables, fichiers stockés, fonctions de l'API.

- Le résultat est un tableau dont **toutes les lignes doivent être `true`**. Une ligne `false` nomme
  la fuite : ne pas ouvrir le coffre tant qu'elle n'est pas corrigée.
- Rien n'est enregistré : le contrôle travaille dans une transaction annulée à la fin.
- Relancez-le après toute modification du projet : politiques, stockage, mise à jour du schéma.

## 3. Connexion par lien magique

Menu **Authentication** → **URL Configuration** :

- **Site URL** : `https://pmeyssonnier.github.io/YouthCampExchange/yce_vault.html`
- **Redirect URLs** → Add : `https://pmeyssonnier.github.io/YouthCampExchange/yce_vault.html**`

Adaptez ces adresses si vous passez sur un nom de domaine propre (par exemple `.be`).

### Envoi des e-mails : obligatoire avant d'ouvrir aux candidats

Le service d'e-mail intégré à Supabase est réservé aux tests. Il n'envoie qu'aux membres de
l'équipe du projet Supabase, et seulement quelques messages par heure. Pour les candidats,
il faut brancher un serveur d'envoi (SMTP) :

1. **Compte Gmail du MD** (gratuit, environ 500 e-mails par jour), par exemple `yce.md112@gmail.com`,
   distinct des adresses personnelles pour faciliter la passation :
   - Compte Google → **Sécurité** → activez la **validation en deux étapes** (obligatoire pour l'étape suivante) ;
   - Compte Google → recherchez **Mots de passe des applications** → nom `Supabase YCE` → **Créer** ;
   - notez le mot de passe de 16 lettres affiché (une seule fois) dans le gestionnaire de mots de passe du MD.
     Il sert ici **et** pour les e-mails automatiques (§ 4 bis). Ne le donnez à personne d'autre.
2. Supabase → **Authentication** → **Emails** → **SMTP Settings** → activez **Custom SMTP** :
   - Sender email : l'adresse Gmail du MD ; Sender name : `Lions YCE MD 112` ;
   - Host : `smtp.gmail.com` ; Port : `465` ;
   - Username : l'adresse Gmail du MD ; Password : le mot de passe d'application (sans espaces) ;
   - **Save**.
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

## 4 bis. E-mails automatiques à chaque étape (recommandé)

Sans cette étape, la page propose à chaque intervenant d'écrire lui-même l'e-mail à la personne suivante.
Avec elle, le coffre prévient automatiquement :

- le parent quand le candidat envoie le dossier (moins de 18 ans) ;
- le président de club quand le dossier lui parvient ;
- le ou les coordinateurs du district (table `staff`) après la signature du club ;
- l'équipe nationale après le district ;
- le candidat en cas de renvoi, d'envoi au pays d'accueil et de réponse de celui-ci.

L'e-mail ne contient que le nom du candidat, l'étape et le lien vers le dossier : aucune pièce jointe.
Les e-mails partent du compte Gmail du MD (port 465 chiffré : Supabase bloque le port 587 dans ses fonctions).
L'envoi est noté dans l'historique du dossier (« Automatic e-mail sent to … »).

1. **Gmail** : utilisez le compte Gmail du MD et son mot de passe d'application (étape 3).
2. **Créer la fonction** : Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Nom : `vault-notify`.
   - Remplacez tout le contenu par celui de `supabase/functions/vault-notify/index.ts`, puis **Deploy function**.
3. **Secrets** : **Edge Functions** → **Secrets**, ajoutez :

   | Nom | Valeur |
   |---|---|
   | `SMTP_USER` | l'adresse Gmail du MD |
   | `SMTP_PASS` | le mot de passe d'application Google (16 lettres) |
   | `SENDER_NAME` | `Lions YCE MD 112` (facultatif) |
   | `VAULT_URL` | `https://pmeyssonnier.github.io/YouthCampExchange/yce_vault.html` |
   | `NOTIFY_SECRET` | une longue suite de caractères au hasard, par exemple tirée d'un gestionnaire de mots de passe |

4. **Déclencheur** : **Database** → **Webhooks** → **Create a new hook** (activez les webhooks si demandé).
   - Name : `vault_notify`. Table : `events`. Events : **Insert** uniquement.
   - Type : **Supabase Edge Functions** → `vault-notify`, méthode `POST`, timeout `5000`.
   - HTTP Headers : ajoutez `x-notify-secret` avec **la même valeur** que le secret `NOTIFY_SECRET`
     (gardez l'en-tête `Authorization` proposé par Supabase).
   - **Create webhook**.
5. **Activer l'affichage** : passez `const VAULT_AUTO_EMAIL = true;` dans `districts_data.js` (par une PR).
   La page dit alors « … will receive an e-mail from the vault » au lieu de proposer un e-mail à écrire.
6. **Tester** : faites avancer un dossier de test. L'e-mail doit arriver, et l'historique indiquer
   « Automatic e-mail sent to … ». Sinon : **Edge Functions** → `vault-notify` → **Logs**.

Sans le bon en-tête `x-notify-secret`, la fonction refuse tout appel : personne d'autre ne peut l'utiliser pour envoyer des e-mails.

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
- le coordinateur et le national voient, à côté de l'adresse du président qui signe dans le coffre,
  la section V de l'application form (club, président, mobile, e-mail), lue dans le dossier déposé ;
  si l'e-mail diffère, la fiche le signale « à vérifier » — rien n'est bloqué, le circuit reste fondé
  sur la confiance entre candidat, parent, président et coordinateur ;
- chaque signature est liée à l'empreinte du ZIP signé : si le dossier est remplacé, il faut signer à nouveau ;
  au moment de signer, le navigateur du signataire recalcule l'empreinte du fichier réellement stocké
  et refuse la signature si elle ne correspond pas ;
- une version signée ne peut plus être effacée (ni le fichier, ni sa trace) avant la purge de fin de
  conservation ; seul un brouillon jamais envoyé peut perdre un dépôt erroné ;
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
