// Marques diacritiques combinantes (accents) une fois le nom décomposé en
// forme NFD (ex. "é" -> "e" + accent aigu combinant).
const DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Normalise un nom de chaîne en identifiant de fichier : minuscules, sans
 * accents, tirets à la place des espaces/ponctuation.
 *
 * Exemples : "Paris Première" -> "paris-premiere",
 * "Canal+ Bleu" -> "canal-bleu", "13ème Rue" -> "13eme-rue".
 */
export default function slugify(name) {

    return name
        .normalize("NFD")
        .replace(DIACRITICS_PATTERN, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}
