# Contribuer à régie

Merci de vouloir améliorer régie. Le projet est né d'un besoin simple : faire
un film avec des outils d'IA sans que les personnages changent de visage d'un
plan à l'autre. Toute contribution qui sert ce but est bienvenue — code,
documentation, traductions, retours d'usage, projets d'exemple.

## Avant de commencer

- **Une question, une idée ?** Ouvrez une discussion ou une issue avant de
  coder quelque chose d'important : on évite ainsi un travail en double ou une
  direction que le projet ne prendra pas.
- **Un bug ?** Une issue avec les étapes pour le reproduire, ce que vous
  attendiez et ce qui s'est passé (le modèle d'issue vous guide).
- **Une faille de sécurité ?** Pas d'issue publique : voir [SECURITY.md](SECURITY.md).

## Installer l'environnement

Prérequis : Node 20.11+, pnpm 10, Docker, FFmpeg (pour le rendu du montage).

```sh
git clone https://github.com/edwinfranck/regie.git && cd regie
cp .env.example .env    # puis générer AUTH_SECRET et ENCRYPTION_KEY (voir README)
pnpm install
pnpm services           # Postgres, Redis, MinIO
pnpm db:deploy && pnpm db:seed
pnpm dev                # web sur :3000 + worker
```

Créez un compte, puis `pnpm db:seed:demo -- --email vous@exemple.com` pour
charger le projet de démonstration.

## Les principes à respecter

Ils ne sont pas négociables, parce qu'ils sont la raison d'être de l'outil :

1. **Aucune génération simulée.** Sans provider configuré, l'interface le dit
   et propose de le configurer. Jamais de faux résultat, jamais de mock silencieux.
2. **Aucun fournisseur câblé.** Tout appel à une IA passe par un adapter de
   `packages/providers`. Ajouter un fournisseur = un fichier, pas une modification
   du reste de l'application.
3. **Contrôler avant de brûler des crédits.** Le linter bloque les plans sans
   référence ; on ne le contourne pas, on l'améliore.
4. **La bible est la seule source de vérité.** Un prompt se compile, il ne
   s'écrit pas à la main — sauf réécriture explicite et visible par l'auteur.

## Où mettre quoi

| Changement | Où |
|---|---|
| Logique pure (caméra, compilateur, linter, Fountain, montage) | `packages/core`, avec ses tests |
| Nouveau fournisseur d'IA | `packages/providers/src/adapters/` + `registry.ts` (voir `docs/providers.md`) |
| Logique serveur (base, génération, IA) | `packages/studio` |
| Schéma de données | `packages/db/prisma/schema.prisma` puis `pnpm db:migrate` |
| Interface et API | `apps/web` |
| Exécution des générations et rendus | `apps/worker` |
| Documentation | `apps/site/content/docs` (site) et `docs/` |

## Style

- **TypeScript strict**, code et identifiants en anglais.
- **Interface et documentation en français**, sobres. Commentaires rares, en
  français, qui expliquent le *pourquoi*.
- **Design** : couleurs uniquement via les tokens de `globals.css`, icônes
  Lucide, pas d'emojis, pas de `<select>` natif (composants `Choice` /
  `ComboField`). Inspirez-vous des pages existantes.
- Petites PR ciblées plutôt qu'une grosse.

## Avant d'ouvrir une PR

```sh
pnpm typecheck
pnpm test                # unitaires
pnpm test:integration    # pipeline complet (services lancés)
pnpm test:e2e            # parcours navigateur (serveur lancé)
```

La CI lance `typecheck` et `test` sur chaque PR. Décrivez ce que la PR change
et comment vous l'avez vérifié ; ajoutez une capture si elle touche l'interface.

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la
[licence MIT](LICENSE) du projet.
