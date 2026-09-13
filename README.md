# régie

**Une bible, un découpage, N moteurs.**

régie ne génère rien. Il compile. Tu décris ton univers une seule fois dans
`bible.yaml`, tu découpes ton épisode dans `plans.yaml`, et l'outil en sort les
prompts de chaque plan pour chaque moteur — image fixe, planche storyboard,
Veo, Kling, Wan — avec les bonnes images de référence à charger et la bonne
liste de négatifs.

La règle qui justifie l'outil :

> Un modèle n'a aucune mémoire entre deux générations. Tout ce qui n'est ni
> écrit ni montré en image sera réinventé, différemment à chaque fois.

Donc : une seule source de vérité, jamais deux. Une bible papier et des prompts
écrits à la main, ce sont déjà deux sources — elles divergent en une semaine.

## Installer

```sh
npm install
npm link          # rend la commande `regie` disponible partout
```

## L'outil dans le navigateur

```sh
regie serve --film ~/films/penitencier      # http://localhost:4173
```

Rien à installer, rien à compiler : un serveur Node et du HTML. À gauche les
plans et les planches, marqués de leurs problèmes. À droite la fiche de plan, la
caméra modifiable, les images de référence en vignettes, et les prompts compilés
en onglets avec un bouton de copie.

Chaque plan a son URL (`#plan-14`, `#planche-SB5`) : rafraîchir retombe au bon
endroit. Modifier la caméra ou la durée réécrit `plans.yaml` sans reformater le
reste du fichier ni perdre un commentaire. La bible, elle, ne se modifie pas
depuis l'interface — un bloc gelé ne se change pas d'un clic.

Les YAML sont relus à chaque requête : tu peux les éditer dans ton éditeur et
rafraîchir la page. Seul un changement dans le code de `regie` demande un
redémarrage du serveur.

### Et Tauri ?

L'interface est déjà du web pur, sans build. L'emballer en application de bureau
Tauri ne demandera que d'ajouter la coquille Rust autour de `public/` — aucune
réécriture. À faire quand le besoin sera réel : ouvrir un film sans passer par le
terminal, et lire des images hors du dossier du projet.

## En ligne de commande

```sh
regie check --film ~/films/penitencier   # vérifie la bible et le découpage
regie list                               # la feuille de plans
regie shot 14                            # la fiche de plan et tous ses prompts
regie shot 14 --target veo               # un seul moteur
regie sheet SB5                          # une planche storyboard multi-cases
regie build                              # écrit tout dans <film>/regie/out/
regie serve                              # l'interface
```

`--film` peut être remplacé par la variable `REGIE_FILM`, ou omis si tu es déjà
dans le dossier du film.

## Le dossier d'un film

```
mon-film/
  01-refs/            les images gelées : feuilles perso, plaques de décor, planche d'objets
  regie/
    bible.yaml        l'univers : LOOK, règles, lumière, personnages, lieux, accessoires
    plans.yaml        l'épisode : les plans, la caméra, les dialogues, les planches
    out/              les prompts compilés
```

## Ce que `check` attrape

Avant de brûler le moindre crédit :

- un mouvement de caméra interdit par le bloc `MOTION` ;
- un plan plus long que la durée max, là où le style dérive ;
- plus de personnages dans un plan que la règle ne l'autorise ;
- deux personnages que la bible déclare trop ressemblants pour partager un plan ;
- une entité utilisée dont l'image de référence n'existe pas encore — bloquant :
  aucun plan ne se génère avant ses références ;
- un bloc gelé sans ref, un personnage sans ligne `NEVER`.

## Ajouter un moteur

Un fichier dans `src/targets/`, une ligne dans `src/targets/index.mjs`. Un
moteur reçoit un plan déjà résolu — personnages, lieu, lumière, caméra,
négatifs, références — et ne fait que le mettre en forme à sa grammaire.

## État

v0.1 — le compilateur. Pas d'interface, pas d'appel à une API de génération :
tu copies le prompt dans l'outil de ton choix. La suite (interface locale,
bibliothèque d'actifs, génération branchée) vient après un épisode complet
produit avec celui-ci.
