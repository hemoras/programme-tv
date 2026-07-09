/**
 * Mots-clés de genre/format reconnus dans le texte (voir
 * docs/PARSING_RULES.md). Chaque mot-clé sert de repère pour marquer le
 * début du sous-titre, mais seuls certains d'entre eux définissent aussi le
 * champ Genre ("Film", "Magazine", "Série") — les autres (Feuilleton,
 * Divertissement, Documentaire) marquent bien une frontière Titre/Sous-titre
 * mais laissent Genre vide, conformément à la consigne de ne renseigner le
 * genre que dans des cas très précis.
 *
 * "Aventures", "Journal" et "Jeu" sont volontairement exclus : ce sont des
 * mots trop fréquents dans des titres réels pour servir de repère fiable
 * (ex. "Les Aventures fantastiques de Tarzan", "Journal d'un globe-trotter"
 * — ce dernier est le TITRE réel d'un programme observé dans l'échantillon,
 * et non un marqueur de format "journal télévisé"). Les inclure causerait
 * des titres tronqués à tort plus souvent qu'ils n'apporteraient de valeur.
 *
 * L'ordre n'a pas d'incidence sur le résultat : pour un texte donné, seule
 * l'occurrence la plus proche du début (toutes entrées confondues) est
 * retenue par findGenreMarker.
 */
const GENRE_KEYWORDS = [
    { pattern: /\bFilm fantastique\b/i, genre: "Film" },
    { pattern: /\bFilm policier\b/i, genre: "Film" },
    { pattern: /\bComédie dramatique\b/i, genre: "Film" },
    { pattern: /\bComédie\b/i, genre: "Film" },
    { pattern: /\bDrame\b/i, genre: "Film" },
    { pattern: /\bPolicier\b/i, genre: "Film" },
    { pattern: /\bWestern\b/i, genre: "Film" },
    { pattern: /\bTéléfilm\b/i, genre: "Film" },
    { pattern: /\bFilm\b/i, genre: "Film" },
    { pattern: /\bMagazine\b/i, genre: "Magazine" },
    { pattern: /\bSérie\b/i, genre: "Série" },
    { pattern: /\bFeuilleton\b/i, genre: "" },
    { pattern: /\bDivertissement\b/i, genre: "" },
    { pattern: /\bDocumentaire\b/i, genre: "" }
];

/**
 * Cherche, dans le texte fourni, le mot-clé de genre qui apparaît le plus
 * tôt. Retourne { index, length, genre } ou null si aucun trouvé.
 */
export function findGenreMarker(text) {

    let best = null;

    for (const { pattern, genre } of GENRE_KEYWORDS) {

        const match = text.match(pattern);

        if (!match) continue;

        if (best === null || match.index < best.index) {
            best = { index: match.index, length: match[0].length, genre };
        }

    }

    return best;

}

export default GENRE_KEYWORDS;
