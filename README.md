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
regie serve            # http://localhost:4173
```

Aucun projet n'est câblé dans l'outil : au premier lancement la liste est vide.
On crée un projet (un titre, un dossier, un format) ou on importe un dossier qui
contient déjà `regie/bible.yaml`. Tout le reste s'écrit dans l'interface.

| | |
|---|---|
| **Script** | l'éditeur du script, enregistré dans `Script.md` |
| **Personnages · Lieux · Objets** | la bible : description gelée, forme courte, costume, marqueur de silhouette, liste d'interdits, image de référence à importer |
| **Plans** | le découpage : durée, lieu, casting, objets, caméra, action |
| **Planches** | les regroupements multi-cases |
| **Réglages** | format, épisode, styles, contraintes de production |

Chaque fiche affiche le prompt compilé correspondant, prêt à copier : prompt de
feuille de personnage, de plaque de décor, de planche d'objets, d'alignement, et
pour un plan l'image fixe plus un prompt par moteur vidéo.

Le contrôle tourne en permanence dans la colonne de droite. Rien n'est généré par
l'outil : il écrit des fichiers YAML lisibles, que tu peux éditer à la main sans
que l'interface les reformate.

### Et Tauri ?

L'interface est du web sans build : l'emballer en application de bureau ne
demandera que la coquille Rust autour de `public/`. À faire quand ouvrir un
dossier sans passer par le terminal deviendra gênant.

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
