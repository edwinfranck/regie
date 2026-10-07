# Sécurité

## Signaler une faille

N'ouvrez pas d'issue publique. Utilisez les
[avis de sécurité privés de GitHub](https://github.com/edwinfranck/regie/security/advisories/new) :
décrivez la faille, comment la reproduire et son impact. Vous recevrez une
réponse dès que possible, et un correctif sera publié avant toute divulgation.

## Ce que régie protège

- Les clés des fournisseurs d'IA sont chiffrées en base (AES-256-GCM, clé
  `ENCRYPTION_KEY`) et ne sont jamais renvoyées au navigateur.
- Le stockage est privé : les fichiers sont servis par des URLs signées de
  courte durée, après contrôle des droits.
- Chaque route d'API vérifie la session, le rôle sur le projet (RBAC) et
  valide son entrée ; les requêtes qui modifient vérifient leur origine (CSRF).

## Bonnes pratiques d'hébergement

- Générez vos propres `AUTH_SECRET` et `ENCRYPTION_KEY` ; ne les committez jamais.
- Servez l'application en HTTPS derrière un proxy.
- Le premier compte créé devient administrateur : créez-le vous-même dès
  l'installation, ou fixez `ADMIN_EMAILS`.
