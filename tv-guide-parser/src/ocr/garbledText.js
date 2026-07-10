/**
 * Détecte les zones de texte mal reconnues par l'OCR (confiance très basse
 * sur plusieurs mots consécutifs) — signe typique d'un encart dont l'heure
 * n'a pas pu être lue (voir docs/PARSING_RULES.md, limitation connue) et
 * dont le contenu se retrouve fusionné, sans séparateur, à la suite du
 * programme précédent.
 *
 * On ne cherche pas à isoler précisément toute la zone mal reconnue (la
 * confiance remonte souvent au milieu du texte parasite, une fois l'OCR
 * "raccroché" sur du texte réel — mais appartenant au mauvais programme).
 * On repère seulement le point de départ de l'anomalie ; tout ce qui suit,
 * dans la même entrée, est considéré comme peu fiable et retiré du
 * sous-titre (voir cutGarbledTail).
 */

const DEFAULT_CONFIDENCE_THRESHOLD = 40;
const DEFAULT_MIN_RUN = 2;

// Mots français très courants : jamais utilisés comme repère, même à
// confiance nulle. Un mot aussi fréquent a de très fortes chances d'avoir
// aussi une occurrence parfaitement lue (confiance normale) ailleurs dans
// le même bloc — la confiance basse ici tient souvent au bruit visuel
// alentour (voir "Un parent des victimes", "des" à confiance 0 alors que
// le mot est correctement reconnu), pas à une vraie erreur de lecture. Le
// prendre comme repère de coupure risquerait de couper un programme
// parfaitement lisible sans rapport.
const COMMON_WORDS = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "à", "a",
    "en", "ce", "cet", "cette", "ces", "il", "elle", "ils", "elles",
    "on", "se", "sa", "son", "ses", "ne", "pas", "que", "qui", "quoi",
    "dans", "pour", "sur", "avec", "sans", "ou", "au", "aux", "nous",
    "vous", "est", "sont", "y", "au", "par", "plus", "ainsi",
    // Codes pays/langue à 2 lettres fréquents dans les synopsis (ex. "US
    // 1993") : sans cette exception, la règle "2 lettres majuscules = bruit"
    // juste en dessous les prendrait à tort pour du bruit OCR.
    "us", "gb", "rf"
]);

/**
 * @param {{text: string, confidence: number}[]} words mots dans l'ordre de lecture (voir OcrEngine.recognize)
 * @returns {string[]} le mot de départ de chaque zone suspecte détectée (dans l'ordre)
 */
export function findGarbledAnchors(words, options = {}) {

    const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const minRun = options.minRun ?? DEFAULT_MIN_RUN;

    // Le caractère "|" isolé est un bruit OCR fréquent et sans rapport (voir
    // normalizeOcrText.js) qui apparaît aussi bien dans du texte parfaitement
    // lisible que dans une zone illisible : on l'ignore pour ne pas fausser
    // la détection de run.
    words = words.filter(w => w.text !== "|");

    const anchors = [];

    let runStart = -1;
    let runLength = 0;

    const closeRun = (start, length) => {

        if (length < minRun) return;

        const anchor = pickAnchor(words.slice(start, start + length));

        if (anchor) anchors.push(anchor);

    };

    for (let i = 0; i < words.length; i++) {

        const isLowConfidence = words[i].confidence >= 0 && words[i].confidence < threshold;

        if (isLowConfidence) {

            if (runStart === -1) runStart = i;
            runLength++;

        } else {

            closeRun(runStart, runLength);
            runStart = -1;
            runLength = 0;

        }

    }

    closeRun(runStart, runLength);

    return anchors;

}

/**
 * Choisit, parmi les mots d'une zone à confiance basse, celui à utiliser
 * comme repère de coupure : le premier qui n'est ni un mot français très
 * courant, ni trop court pour être distinctif (sauf s'il contient un
 * chiffre ou un symbole, typique du bruit OCR). Retourne null si aucun mot
 * de la zone n'est assez distinctif — dans ce cas on préfère ne pas couper
 * plutôt que de risquer un faux positif.
 */
function pickAnchor(runWords) {

    for (const word of runWords) {

        const text = word.text;

        if (COMMON_WORDS.has(text.toLowerCase())) continue;

        // Chiffres/symboles typiques du bruit OCR, ou un mot de 2 lettres
        // tout en majuscules (jamais un vrai mot français dans une synopsis,
        // presque toujours un artefact type "BA", "CS", "QE"...).
        const looksLikeNoise = /\d|[%{}=]/.test(text) || /^[A-ZÀ-Ü]{2}$/.test(text);

        if (text.length < 3 && !looksLikeNoise) continue;

        return text;

    }

    return null;

}

/**
 * Coupe `text` au premier point où l'un des `anchors` apparaît (recherché
 * comme mot isolé, pas comme sous-chaîne d'un autre mot). Retourne le texte
 * propre et la partie retirée (vide si aucun repère trouvé).
 */
export function cutGarbledTail(text, anchors) {

    let cutIndex = -1;

    for (const anchor of anchors) {

        if (!anchor) continue;

        const pattern = new RegExp(`(^|\\s)${escapeRegExp(anchor)}(\\s|$|[.,;:!?])`);
        const match = text.match(pattern);

        if (!match) continue;

        const index = match.index + match[1].length;

        if (cutIndex === -1 || index < cutIndex) {
            cutIndex = index;
        }

    }

    if (cutIndex === -1) {
        return { clean: text, tail: "" };
    }

    return {
        clean: text.slice(0, cutIndex).trim(),
        tail: text.slice(cutIndex).trim()
    };

}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
