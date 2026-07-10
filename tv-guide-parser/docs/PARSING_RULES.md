# Règles de parsing des programmes

Ce document décrit les règles utilisées pour transformer le texte brut issu
de l'OCR (un bloc de texte par chaîne, cf. `docs/OCR.md` si existant) en
programmes structurés, puis pour les exporter en CSV.

Ces règles ont été dictées par Charles le 8 juillet 2026 et serviront de
référence pour l'implémentation (`src/parsing/`). Elles sont amenées à
évoluer au fur et à mesure des tests sur d'autres échantillons.

---

## Format de sortie

Un fichier par chaîne et par date, au format CSV avec point-virgule comme
séparateur :

```
csv/<Année>/<Date>/<Nom chaîne>.txt
```

Exemple :

```
csv/2001/2001-01-01/TMC.txt
```

Colonnes (dans cet ordre), une ligne par programme :

```
Chaine;Heure;Titre Programme;Sous-titre;Genre
```

- **Chaine** : nom de la chaîne tel qu'il apparaît dans la configuration de
  page (ex. "RTL 9"). Redondant avec le nom de fichier, mais conservé dans
  chaque ligne.
- **Heure** : heure de diffusion, au format `HH:MM` (ex. `06:35`, `20:45`).
- **Titre Programme** : titre du programme.
- **Sous-titre** : informations complémentaires (voir ci-dessous).
- **Genre** : voir règles ci-dessous. Vide dans la grande majorité des cas.

Pas de colonne Date dans le fichier : elle est portée par le chemin du
fichier, pas par son contenu.

Le fichier commence par une ligne d'en-tête (`Chaine;Heure;Titre
Programme;Sous-titre;Genre`), une ligne par programme ensuite. Un champ
contenant un point-virgule, un guillemet ou un retour à la ligne est
encadré de guillemets (échappement CSV standard) ; en pratique ce cas ne
s'est pas encore présenté dans les échantillons testés.

---

## Étape 1 — Normalisation du texte OCR brut

Le texte brut d'un bloc contient les programmes d'une chaîne mis bout à
bout, avec deux problèmes récurrents à corriger avant tout découpage :

### 1.1 Recollage des césures

L'OCR reproduit les césures typographiques de fin de ligne. Exemple observé :

```
place. 10.35 Les Aventures fantas-
tiques de Tarzan. 11.25 Sydney Fox,
```

Doit être recollé en "Les Aventures fantastiques de Tarzan" (sans le tiret,
sans espace introduit).

Règle : si une ligne se termine par un tiret directement collé à une lettre
(pas d'espace avant le tiret), et que la ligne suivante commence par une
lettre minuscule, on considère qu'il s'agit d'une césure et on recolle les
deux fragments.

Bruit additionnel observé : un caractère `|` isolé (probablement une marque
de marge ou un filet mal interprété par l'OCR) apparaît parfois en début ou
fin de ligne juste à l'endroit d'une césure (ex. `Elisa-` / `| beth`), ce
qui empêchait le recollage. Ce `|` est retiré (remplacé par un espace) avant
le recollage des césures.

Autre confusion OCR récurrente : le caractère `:` est parfois lu comme un
`;` (ex. "Cap-Vert : Descente au cœur du volcan" lu "Cap-Vert ; Descente...").
Comme `;` est aussi le séparateur du CSV de sortie, un `;` resté dans le
texte décale les colonnes. Tous les `;` du texte OCR sont donc systématiquement
remplacés par des `:` dès la normalisation.

### 1.2 Un programme par ligne

Plusieurs programmes peuvent apparaître sur la même ligne de texte OCR,
séparés uniquement par leur heure de début. Exemple observé :

```
te. 6.35 Music Place. 7.15 Riviera.
```

Règle : on force un retour à la ligne avant chaque heure détectée
(motif `H.MM` ou `HH.MM`), sauf si l'heure est déjà en tout début de ligne.
Après cette étape, chaque ligne du texte correspond à un seul programme
(heure + contenu).

---

## Étape 2 — Découpage Titre / Sous-titre / Genre

Pour chaque entrée normalisée (une heure + le texte qui suit, jusqu'à la
prochaine heure) :

1. **Heure** : l'heure en tête d'entrée, convertie de `H.MM`/`HH.MM` vers
   `HH:MM` (heure sur deux chiffres, complétée par un zéro si besoin :
   `6.35` → `06:35`).

2. **Titre** : le texte qui suit l'heure, jusqu'au premier repère de
   sous-titre trouvé (voir ci-dessous), ou jusqu'au premier point si aucun
   repère n'est trouvé.

3. **Sous-titre** : destiné à recevoir les informations complémentaires :
   - l'invité d'une émission de variétés,
   - le titre d'un épisode de série,
   - des informations complémentaires pour une rencontre sportive
     (exemple : Titre = "PSG - Monaco", Sous-titre = "Finale de la coupe de
     la ligue"),
   - plus généralement, tout ce qui suit le titre (résumé, casting, année,
     pays de production...).

   Repère de découpage : un mot-clé de genre/format reconnu (voir liste
   ci-dessous — elle inclut aussi des mots qui ne définissent pas de Genre,
   comme "Feuilleton") qui suit immédiatement le titre marque le début du
   sous-titre. Le mot-clé lui-même n'est **pas** inclus dans le sous-titre
   (il est déjà porté par la colonne Genre, ou n'apporte rien si aucun genre
   n'y est associé) : `22.30 Détours du monde Magazine, Spécial Pèlerinage
   à Rome` donne Titre = "Détours du monde", Sous-titre = "Spécial
   Pèlerinage à Rome" (pas "Magazine, Spécial..."), Genre = "Magazine".
   S'il n'y a pas de mot-clé reconnu, on découpe au premier point rencontré
   après le titre.

4. **Numéro d'épisode.** Un numéro entre parenthèses en fin de titre (ex.
   "Voyage en Antarctique (3/6)") est retiré du titre et déplacé en fin de
   sous-titre :
   - s'il y a déjà un sous-titre : `(N/M)` est ajouté à la fin
     ("Voyage en Antarctique (3/6). La station Wilkes" → Titre = "Voyage en
     Antarctique", Sous-titre = "La station Wilkes (3/6)") ;
   - sinon, le sous-titre devient "Episode N/M" ("Voyage en Antarctique
     (3/6)" seul → Titre = "Voyage en Antarctique", Sous-titre =
     "Episode 3/6").

5. **Genre** : laissé **vide dans la grande majorité des cas**. Le genre
   réel d'un programme (ex. "Derrick" est une série) ne peut être déterminé
   de façon fiable qu'en croisant avec une base de données externe — ce
   travail est reporté à plus tard.

   **Exception** : si le texte contient une mention explicite reconnaissable
   comme un marqueur de genre cinématographique (voir liste ci-dessous :
   "Film", "Comédie dramatique", "Comédie", "Film policier", "Aventures",
   etc. — motif typique : `<mot-clé> de <réalisateur>, <pays> <année>`),
   alors `Genre = "Film"` (toujours "Film", quel que soit le sous-genre
   précis mentionné).

   Si le texte contient explicitement "Magazine" ou "Série", `Genre` prend
   respectivement la valeur `"Magazine"` ou `"Série"`.

   **Cas particulier "Film" : le Sous-titre reste vide.** Contrairement aux
   autres genres, quand `Genre = "Film"`, on ne renseigne pas le Sous-titre
   (consigne de Charles, 10 juillet 2026) — le réalisateur/casting/résumé
   qui suit habituellement n'y est pas conservé. Le Titre est tout de même
   nettoyé normalement (numéro d'épisode entre parenthèses retiré s'il y en
   avait un, mais sans être déplacé en "Episode N/M" comme pour les autres
   genres, puisque le Sous-titre reste vide) :
   ```
   RTL 9;22:25;L'Affaire Thomas Crown;;Film
   ```

   Dans tous les autres cas (aucun mot-clé reconnu, ou mot-clé hors liste
   comme "Feuilleton", "Divertissement", "Documentaire", "Journal", "Jeu"),
   `Genre` reste vide.

### Liste des mots-clés de genre reconnus (état actuel, évolutif)

| Mot-clé détecté (dans le texte)                          | Genre assigné |
|------------------------------------------------------------|---------------|
| Film, Comédie, Comédie dramatique, Drame, Policier, Western, Film fantastique, Film policier, Téléfilm | `Film` |
| Magazine                                                    | `Magazine`    |
| Série                                                       | `Série`       |
| Feuilleton, Divertissement, Documentaire, ou aucun mot-clé  | *(vide)*      |

Cette liste est volontairement restrictive au départ ; elle sera étendue au
fil des tests sur d'autres échantillons.

**Cas exclus volontairement : "Aventures", "Journal", "Jeu".** Ces mots sont
structurellement ambigus dans ce corpus : ils servent de marqueur de
genre/format dans certains cas ("Aventures de Kurt Anderson, US 1993.") mais
apparaissent aussi très fréquemment *dans des titres réels*. Exemples
rencontrés sur l'échantillon 2001-01-01 :
- "Les Aventures fantastiques de Tarzan", "Les Nouvelles Aventures de
  Lassie" (le motif "Aventures de" ne suffit pas à distinguer : "Les
  Nouvelles Aventures de Lassie" le contient aussi) ;
- "Journal d'un globe-trotter" est le **titre réel** d'un programme
  (Odyssée, 19.55), pas une mention de format "journal télévisé" — avec
  "Journal" dans la liste, ce titre était tronqué à tort (Titre vide,
  tout basculé en Sous-titre).

Pour éviter de tronquer des titres à tort, ces mots ne sont donc pas dans la
liste des mots-clés reconnus, au prix de rater ce marqueur quand il est
effectivement utilisé comme genre/format.

---

## Cas non couverts / limites connues

- Le pictogramme de notation (ex. "▶▶▶") est mal reconnu par l'OCR sous des
  formes imprévisibles ("77", "# ##"...). Les "#" isolés sont retirés du
  Titre/Sous-titre (10 juillet 2026, voir `cleanFragment` dans
  `parseProgramEntry.js`) ; les autres formes (ex. "77") ne sont pas
  filtrées à ce stade.
- L'heure imprimée en blanc sur fond coloré (dans certains encarts "prime
  time") n'est pas toujours lue correctement par l'OCR (voir limitations
  connues de l'étape OCR) ; le programme correspondant peut donc avoir une
  heure manquante ou erronée dans ces cas précis.
- Le découpage Titre/Sous-titre par mot-clé de genre est une heuristique :
  il peut échouer sur des formulations non rencontrées dans les échantillons
  testés à ce jour (uniquement 2001-01-01-Page1.jpg).
- Les exemples de type sport ("PSG - Monaco") n'ont pas encore été
  rencontrés dans un échantillon réel ; la règle est documentée par
  anticipation mais pas testée.

- **Encarts fusionnés dont l'heure n'a pas pu être lue : isolés du CSV
  propre (résolu partiellement, 10 juillet 2026).** Quand l'heure d'un
  encart n'est pas reconnue (cf. limitation ci-dessus), son contenu se
  retrouvait fusionné, sans séparateur, dans le Sous-titre du programme
  précédent — polluant une ligne autrement propre avec plusieurs
  centaines de caractères de texte parasite et/ou appartenant à un tout
  autre programme (voir `src/ocr/garbledText.js`).

  Détection : la confiance mot-par-mot renvoyée par Tesseract (TSV) permet
  de repérer une zone anormalement mal reconnue (plusieurs mots consécutifs
  sous 40% de confiance). Le premier mot suffisamment distinctif de cette
  zone (pas un mot français courant type "de", "des", "le" — qui a
  presque toujours une autre occurrence bien lue ailleurs dans le bloc, ce
  qui causerait une coupe au mauvais endroit ; pas un mot de moins de 3
  lettres sauf s'il contient un chiffre/symbole ou est tout en majuscules)
  sert de repère. Tout ce qui suit ce repère, dans la même entrée, est
  retiré du Sous-titre et déplacé en fin de fichier CSV, en texte brut,
  sans tenter de le structurer en colonnes (précédé d'un commentaire `#`
  et de l'heure du programme précédent, pour garder une trace) :

  ```
  Planète;20:00;Voyage en Antarctique;Les Vestiges de la station Wilkes (3/6);
  ...
  # Segments non reconnus (heure illisible, fusionnés avec le programme précédent) :
  # [après 20:00] 10% {1 document re il A 0% ... constructions.
  ```

  Limites connues de cette détection (acceptées comme compromis
  raisonnable — rien n'est perdu, tout reste tracé en fin de fichier) :
  - la coupe n'est pas toujours pile au bon endroit : quelques mots
    parasites courts (2-3 caractères) peuvent occasionnellement rester
    dans le Sous-titre juste avant la coupe, si leur confiance OCR
    individuelle n'était pas assez basse pour être repérée ;
  - si le texte mal reconnu se trouve *au milieu* du synopsis d'un même
    programme (pas un second programme fusionné), la coupe retire aussi
    la suite légitime du synopsis (déplacée dans les segments non reconnus
    plutôt que conservée dans le Sous-titre) — cas plus rare, observé une
    fois sur l'échantillon (Odyssée, 19.55) ;
  - un mot-clé de genre (Film/Magazine/Série) trouvé juste avant la coupe
    peut occasionnellement être erronément attribué au programme
    précédent s'il appartenait en réalité à l'encart fusionné (observé une
    fois sur l'échantillon, TMC 20.35).

- **Encarts thématiques sans heure propre (ex. "Long courrier"), différé.**
  Certaines chaînes (ex. Voyage) intercalent, sans heure de diffusion
  associée, un encart thématique (ex. "Long courrier / Canada : les îles de
  la Reine-Charlotte. [description...]"). Visuellement, sur le magazine
  original, le titre de l'encart est dans une police plus grande et le
  sous-titre en gras, ce qui permettrait de les distinguer du descriptif (à
  ne pas conserver). Deux pistes de détection automatique ont été testées
  sur l'échantillon réel (crop Planète / "Voyage en Antarctique") et n'ont
  rien donné d'exploitable à la résolution de scan actuelle (JPEG,
  upscale 2x) :
  - taille de ligne estimée par Tesseract (`x_size`) : titre 63, sous-titre
    64, corps de texte normal 62 — aucune différence significative ;
  - densité d'encre (proxy pour le gras) : titre 0.30, sous-titre 0.29,
    descriptif 0.34 — le descriptif ressort *plus* dense que le titre,
    contraire à ce qu'on cherche.
  Ce n'est pas un problème d'algorithme mais de résolution d'entrée : les
  nuances visuelles de taille/graisse sont lissées par la compression JPEG
  et l'upscale. Par ailleurs, même avec une distinction titre/sous-titre/
  descriptif fiable, il resterait à détecter *où commence* un tel encart
  dans le texte plat (aucune heure, aucun mot-clé de genre à proximité).
  **Décision (Charles, 8 juillet 2026) : mis de côté pour l'instant**,
  comme la limitation OCR de la tâche #11. En l'état, ces encarts restent
  fusionnés (Sous-titre) dans l'entrée précédente. À reprendre plus tard,
  éventuellement avec des scans en meilleure résolution ou une liste de
  rubriques connues à détecter par mot-clé.
