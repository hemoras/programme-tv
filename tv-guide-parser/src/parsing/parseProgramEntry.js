import { findGenreMarker } from "./genreKeywords.js";
import { cutGarbledTail } from "../ocr/garbledText.js";

const LEADING_TIME_PATTERN = /^([01]?\d|2[0-3])[.,]([0-5]\d)\s*/;

// Numéro d'épisode entre parenthèses en fin de titre, ex. "(3/6)".
const EPISODE_PATTERN = /\s*\((\d{1,2})\s*\/\s*(\d{1,2})\)\s*$/;

/**
 * Parse une entrée normalisée ("HH.MM texte...", voir splitIntoEntries) en
 * {startTime, title, subtitle, genre, unparsedTail, rawText}. Voir
 * docs/PARSING_RULES.md pour le détail des règles.
 *
 * @param {string} entryText
 * @param {string[]} [garbledAnchors] repères de zones mal reconnues (voir
 *   ocr/garbledText.js). On coupe la partie mal reconnue AVANT de chercher
 *   le titre/sous-titre/genre, pour ne pas laisser un mot-clé de genre
 *   trouvé dans du texte parasite (ou appartenant à un autre programme
 *   fusionné) polluer le résultat. La partie retirée est renvoyée dans
 *   `unparsedTail`.
 */
export default function parseProgramEntry(entryText, garbledAnchors = []) {

    const timeMatch = entryText.match(LEADING_TIME_PATTERN);

    if (!timeMatch) {

        const { clean, tail } = cutGarbledTail(entryText, garbledAnchors);
        const { title, subtitle } = extractEpisodeNumber(cleanFragment(clean), "");

        return {
            startTime: "",
            title,
            subtitle,
            genre: "",
            unparsedTail: tail,
            rawText: entryText
        };

    }

    const hour = timeMatch[1].padStart(2, "0");
    const minute = timeMatch[2];
    const startTime = `${hour}:${minute}`;

    const rawRemainder = entryText.slice(timeMatch[0].length);

    const { clean: remainder, tail } = cutGarbledTail(rawRemainder, garbledAnchors);

    const marker = findGenreMarker(remainder);

    if (marker) {

        // Le mot-clé lui-même (ex. "Magazine", "Série") ne fait pas partie
        // du sous-titre : il est déjà porté par la colonne Genre (ou, pour
        // les mots-clés de format sans genre assigné comme "Feuilleton",
        // n'apporte pas d'information utile en plus).
        const { title, subtitle } = extractEpisodeNumber(
            cleanFragment(remainder.slice(0, marker.index)),
            cleanFragment(remainder.slice(marker.index + marker.length))
        );

        // Pour un "Film", on ne renseigne pas le sous-titre (consigne
        // explicite de Charles) : le titre reste nettoyé (numéro d'épisode
        // retiré s'il y en avait un), mais rien n'est mis en sous-titre.
        const finalSubtitle = marker.genre === "Film" ? "" : subtitle;

        return {
            startTime,
            title,
            subtitle: finalSubtitle,
            genre: marker.genre,
            unparsedTail: tail,
            rawText: entryText
        };

    }

    const dotIndex = remainder.indexOf(".");

    if (dotIndex === -1) {

        const { title, subtitle } = extractEpisodeNumber(cleanFragment(remainder), "");

        return {
            startTime,
            title,
            subtitle,
            genre: "",
            unparsedTail: tail,
            rawText: entryText
        };

    }

    const { title, subtitle } = extractEpisodeNumber(
        cleanFragment(remainder.slice(0, dotIndex)),
        cleanFragment(remainder.slice(dotIndex + 1))
    );

    return {
        startTime,
        title,
        subtitle,
        genre: "",
        unparsedTail: tail,
        rawText: entryText
    };

}

/**
 * Détecte un numéro d'épisode entre parenthèses en fin de titre (ex.
 * "Voyage en Antarctique (3/6)") et le déplace vers le sous-titre :
 * - s'il y a déjà un sous-titre, "(N/M)" est ajouté à la fin
 *   ("La station Wilkes" -> "La station Wilkes (3/6)") ;
 * - sinon, le sous-titre devient "Episode N/M".
 */
function extractEpisodeNumber(title, subtitle) {

    const match = title.match(EPISODE_PATTERN);

    if (!match) {
        return { title, subtitle };
    }

    const [, episode, total] = match;
    const cleanTitle = cleanFragment(title.slice(0, match.index));

    if (subtitle) {
        // On retire un point final avant d'ajouter "(N/M)" : cleanFragment
        // préserve volontairement le point de fin de phrase pour un
        // sous-titre normal ("...détective."), mais ici on va lui accoler
        // "(3/6)" et "Wilkes. (3/6)" serait maladroit — Charles attend
        // "Wilkes (3/6)".
        const trimmedSubtitle = subtitle.replace(/\.\s*$/, "");
        return { title: cleanTitle, subtitle: `${trimmedSubtitle} (${episode}/${total})` };
    }

    return { title: cleanTitle, subtitle: `Episode ${episode}/${total}` };

}

/**
 * Nettoie un fragment de titre/sous-titre : espaces superflus, ponctuation
 * résiduelle en début/fin de fragment.
 */
function cleanFragment(fragment) {

    return fragment
        // Le pictogramme de notation ("▶▶▶") est mal OCRisé sous forme de
        // "#" isolés (ex. "L'Affaire Thomas Crown # ##") : on les retire,
        // où qu'ils apparaissent dans le fragment.
        .replace(/#+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/^[.,;:\s]+/, "")
        .replace(/[,;:\s]+$/, "")
        .trim();

}
