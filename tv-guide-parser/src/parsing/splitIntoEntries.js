// Le séparateur heure/minute est un point, mais l'OCR le confond parfois
// avec une virgule (ex. "12,35" au lieu de "12.35") : on accepte les deux.
const TIME_PATTERN = /\b([01]?\d|2[0-3])[.,]([0-5]\d)\b/g;

/**
 * Découpe un texte aplati (voir normalizeOcrText) en une entrée par
 * programme, chaque entrée démarrant à une occurrence d'heure ("H.MM" ou
 * "HH.MM") et s'arrêtant juste avant la suivante.
 *
 * Le texte avant la toute première heure trouvée (bruit OCR du bandeau/logo
 * en haut du bloc) est ignoré.
 */
export default function splitIntoEntries(flatText) {

    const matches = [...flatText.matchAll(TIME_PATTERN)];

    const entries = [];

    for (let i = 0; i < matches.length; i++) {

        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : flatText.length;

        const entry = flatText.slice(start, end).trim();

        if (entry) entries.push(entry);

    }

    return entries;

}
