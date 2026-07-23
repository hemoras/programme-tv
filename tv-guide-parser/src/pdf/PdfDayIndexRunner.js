import PdfRenderer from "./PdfRenderer.js";
import DayBannerDetector from "./DayBannerDetector.js";

export const DAY_ORDER = ["samedi", "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];

// Les toutes premières pages d'un numéro (sommaire, publicités, éditos...)
// ne contiennent jamais de grille de programmes (voir Charles) : inutile de
// les rendre/analyser. Marge de sécurité incluse (la première page trouvée
// sur l'échantillon de référence est 40 — on démarre à 36 plutôt que pile
// dessus, au cas où une année ait un sommaire un peu plus court).
const FIRST_SCANNED_PAGE = 36;

// Un jour occupe toujours au moins 8 pages (voir Charles) : une fois sa
// première page trouvée, les MIN_DAY_SPAN_PAGES suivantes sont donc
// forcément encore le même jour — inutile de les rendre/analyser, on peut
// directement sauter dessus.
const MIN_DAY_SPAN_PAGES = 7;

/**
 * PdfDayIndexRunner
 *
 * Pour un PDF de numéro complet de Télé 7 Jours (7 jours de programmes, du
 * samedi au vendredi — voir Charles), détermine le numéro de la première
 * page de chacun des 7 jours en repérant le bandeau coloré identifié par
 * DayBannerDetector.
 *
 * Machine séquentielle : les jours du magazine se succèdent toujours dans
 * l'ordre samedi -> vendredi, jamais dans le désordre. On parcourt donc les
 * pages en attendant à chaque instant UN SEUL jour précis (le prochain de la
 * séquence) ; dès qu'il est détecté, on note son numéro de page et on passe
 * au jour suivant. Toute détection d'un autre jour que celui attendu (faux
 * positif résiduel, ou jour déjà noté) est ignorée sans faire reculer ni
 * avancer l'état.
 *
 * Deux optimisations réduisent le nombre de pages effectivement rendues/
 * analysées (le rendu d'une page PDF, dominé par le décodage des photos
 * qu'elle contient, est l'étape la plus coûteuse — voir FIRST_SCANNED_PAGE
 * et MIN_DAY_SPAN_PAGES) sans changer le résultat : le sommaire en début de
 * numéro est ignoré d'office, et une fois la première page d'un jour
 * trouvée, les quelques pages suivantes (forcément encore le même jour) ne
 * sont pas ré-analysées.
 */
export default class PdfDayIndexRunner {

    constructor(options = {}) {

        this.scale = options.scale ?? 1.5;

    }

    /**
     * @param {string} pdfPath
     * @param {import("../ocr/OcrEngine.js").default} ocrEngine worker Tesseract
     *   déjà initialisé, réutilisé sur tout le lot par l'appelant (voir
     *   indexPdfPages.js).
     * @returns {Promise<{pages: Record<string, number|null>, warnings: string[]}>}
     */
    async run(pdfPath, ocrEngine) {

        const renderer = new PdfRenderer({ scale: this.scale });
        const detector = new DayBannerDetector(ocrEngine);

        const warnings = [];
        const pages = Object.fromEntries(DAY_ORDER.map(day => [day, null]));

        try {

            const numPages = await renderer.open(pdfPath);

            let dayIndex = 0;

            for (let pageNumber = FIRST_SCANNED_PAGE; pageNumber <= numPages && dayIndex < DAY_ORDER.length; pageNumber++) {

                const { buffer, width, height } = await renderer.renderPage(pageNumber);

                const result = await detector.detect(buffer, width, height);

                if (!result.day) continue;

                const expected = DAY_ORDER[dayIndex];

                if (result.day === expected) {
                    pages[expected] = pageNumber;
                    dayIndex++;
                    pageNumber += MIN_DAY_SPAN_PAGES;
                }

            }

        } finally {

            await renderer.close();

        }

        for (const day of DAY_ORDER) {

            if (pages[day] == null) {
                warnings.push(`Jour "${day}" non trouvé dans ${pdfPath}.`);
            }

        }

        return { pages, warnings };

    }

}
