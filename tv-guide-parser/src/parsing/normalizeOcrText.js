/**
 * Normalise le texte OCR brut d'un bloc pour préparer le découpage en
 * programmes (voir docs/PARSING_RULES.md, étape 1) :
 *
 * 1. Recolle les césures typographiques de fin de ligne
 *    ("fantas-\ntiques" -> "fantastiques").
 * 2. Aplatit le texte : les retours à la ligne restants ne sont que des
 *    retours à la ligne d'affichage (pas de séparateurs sémantiques), donc
 *    remplacés par un espace. Le texte obtenu est un flux continu, prêt à
 *    être découpé par occurrence d'heure (voir splitIntoEntries).
 */
export default function normalizeOcrText(text) {

    // Bruit OCR récurrent : un caractère "|" isolé (probablement une marque
    // de marge/filet mal interprété) apparaît parfois en début ou fin de
    // ligne. Il casse le recollage des césures (ex. "Elisa-" / "| beth" ne
    // se recolle pas) et laisse un pipe résiduel dans le texte final. On le
    // remplace par un espace avant tout le reste du traitement.
    const withoutPipes = text.replace(/\|/g, " ");

    // Autre confusion OCR récurrente : le ":" est parfois lu comme un ";"
    // (ex. "Cap-Vert : Descente..." lu "Cap-Vert ; Descente..."). Comme ";"
    // est aussi le séparateur du CSV de sortie, un ";" resté dans le texte
    // décale les colonnes. On remplace systématiquement ";" par ":" (le
    // caractère qu'il représente le plus souvent ici).
    const withoutSemicolons = withoutPipes.replace(/;/g, ":");

    const joined = withoutSemicolons.replace(
        /([a-zàâäéèêëïîôöùûüç])-\s*\n\s*([a-zàâäéèêëïîôöùûüç])/gi,
        "$1$2"
    );

    const flat = joined
        .replace(/\n+/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

    return flat;

}
