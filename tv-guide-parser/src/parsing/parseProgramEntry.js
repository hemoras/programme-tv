import { findGenreMarker } from "./genreKeywords.js";

const LEADING_TIME_PATTERN = /^([01]?\d|2[0-3])[.,]([0-5]\d)\s*/;

// Numéro d'épisode entre parenthèses en fin de titre, ex. "(3/6)".
const EPISODE_PATTERN = /\s*\((\d{1,2})\s*\/\s*(\d{1,2})\)\s*$/;

/**
 * Parse une entrée normalisée ("HH.MM texte...", voir splitIntoEntries) en
 * {startTime, title, subtitle, genre, rawText}. Voir docs/PARSING_RULES.md
 * pour le détail des règles.
 */
export default function parseProgramEntry(entryText) {

    const timeMatch = entryText.match(LEADING_TIME_PATTERN);

    if (!timeMatch) {

        const { title, subtitle } = extractEpisodeNumber(cleanFragment(entryText), "");

        return {
            startTime: "",
            title,
            subtitle,
            genre: "",
            rawText: entryText
        };

    }

    const hour = timeMatch[1].padStart(2, "0");
    const minute = timeMatch[2];
    const startTime = `${hour}:${minute}`;

    const remainder = entryText.slice(timeMatch[0].length);

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

        return {
            startTime,
            title,
            subtitle,
            genre: marker.genre,
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
        return { title: cleanTitle, subtitle: `${subtitle} (${episode}/${total})` };
    }

    return { title: cleanTitle, subtitle: `Episode ${episode}/${total}` };

}

/**
 * Nettoie un fragment de titre/sous-titre : espaces superflus, ponctuation
 * résiduelle en début/fin de fragment.
 */
function cleanFragment(fragment) {

    return fragment
        .trim()
        .replace(/^[.,;:\s]+/, "")
        .replace(/[,;:\s]+$/, "")
        .trim();

}
