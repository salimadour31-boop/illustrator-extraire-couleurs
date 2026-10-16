# illustrator-extraire-couleurs

**ExtraireCouleursUtilisees.jsx** — extrait toutes les couleurs réellement utilisées dans le document (fonds, contours, textes, dégradés en option) et les ajoute dans un nouveau groupe de nuances nommé, pour Adobe Illustrator (ExtendScript, FR/EN).
*Extract every colour actually used in the document (fills, strokes, text, optional gradients) into a new named swatch group in Adobe Illustrator.*

> **Statut : non testé dans Illustrator.** La syntaxe ES3 a été vérifiée automatiquement (acorn) et la logique a été relue. Le script n'a pas encore été exécuté dans Illustrator. Travaillez sur une **copie** de votre fichier.
> *Status: not tested in Illustrator. ES3 syntax checked (acorn) and logic reviewed. Work on a copy of your file.*

## Pourquoi / Why

Après une vectorisation, un import ou un fichier client, le document contient souvent des dizaines de couleurs « vivantes » (fonds, contours, caractères de texte, arrêts de dégradé) qui ne figurent pas encore dans le panneau Nuancier — ou qui y sont dispersées hors d'un groupe clair. *AimanterCouleursNuancier* mappe vers un nuancier **existant** ; ce script fait l'inverse : il **collecte** les couleurs réellement utilisées et les range dans un groupe dédié (ex. « Couleurs extraites » / « Extracted Colors »).

Fonctionnalités :

- **Portée** : document entier, calque actif ou sélection.
- **Sources** : fonds, contours, textes (remplissage / contour de chaque caractère), arrêts de dégradé (option).
- **Déduplication** RVB / CMJN / Gris / Lab / tons directs ; **tolérance** optionnelle (0 = stricte, jusqu'à 1).
- **Groupe de nuances** nommé ; option pour **écraser / vider** un groupe du même nom.
- **Noms** : automatiques (RVB / CMJN / …) ou préfixe + index ; **noms de tons directs conservés**.
- Bouton **Analyser** : compte les couleurs uniques et affiche un aperçu **sans rien modifier**.
- Option pour **ignorer** objets / calques verrouillés ou masqués.
- Une seule opération annulable (`beginUndoGroup` / `endUndoGroup`).
- Résumé final : N nuances ajoutées.

Les images, symboles, maillages et objets de plug-in sont ignorés (et comptés dans le bilan).

## Installation

- **Ponctuelle** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl+F12 / Cmd+F12), puis choisir `ExtraireCouleursUtilisees.jsx`.
- **Permanente** : copier `ExtraireCouleursUtilisees.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator, puis redémarrer Illustrator :
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`

  Le script apparaît alors dans *Fichier > Scripts*.

Le fichier est en UTF-8. Si les accents s'affichent mal (surtout sous Windows), réenregistrez-le en « UTF-8 avec BOM » dans votre éditeur de texte.

## Utilisation / Usage

1. Ouvrez votre document (un message s'affiche si aucun document n'est ouvert) et faites-en une **copie**.
2. Lancez le script, choisissez la portée, les sources, le nom du groupe et les options de nommage.
3. Cliquez sur **Analyser** pour voir combien de couleurs uniques seraient extraites, puis sur **Extraire**.
4. Les nuances apparaissent dans le panneau Nuancier, dans le groupe choisi.
5. Pour revenir en arrière : Ctrl+Z / Cmd+Z (une opération).

L'interface est en français si Illustrator est en français, sinon en anglais.

## Version ciblée / Target

Illustrator CC 2018–2026 (ExtendScript ES3, ScriptUI). Pas d'UXP nécessaire.

## Limites connues / Known limits

- Non testé dans Illustrator : signalez tout problème dans les *Issues*.
- Les couleurs à l'intérieur des symboles, maillages, motifs, images et effets (Aspect) ne sont pas extraites.
- Les teintes d'un même ton direct sont regroupées en une seule nuance (spot à 100 %).
- Sur un très long texte, le parcours caractère par caractère peut être lent.
- Distinct de [AimanterCouleursNuancier](https://github.com/salimadour31-boop/illustrator-couleurs-vers-nuancier) (mapping vers un nuancier existant).

## Confidentialité / Privacy

Aucun appel réseau, aucune collecte de données, aucun fichier écrit hors du document Illustrator ouvert.

## Licence

MIT — © 2026 Amirouche Amwanes. Voir `LICENSE`.
