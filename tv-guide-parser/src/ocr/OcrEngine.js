import { createWorker } from "tesseract.js";

import fraTrainedData from "@tesseract.js-data/fra";

/**
 * OcrEngine
 *
 * Enveloppe Tesseract.js. Le worker est créé paresseusement (au premier
 * appel) puis réutilisé pour tous les blocs d'une même page, plutôt que
 * recréé à chaque bloc (le démarrage d'un worker Tesseract est coûteux).
 *
 * Les données d'entraînement françaises sont chargées depuis le paquet npm
 * @tesseract.js-data/fra (fichier local) plutôt que téléchargées depuis le
 * CDN par défaut de Tesseract.js au runtime — plus fiable pour un traitement
 * par lot (pas de dépendance réseau externe à chaque exécution).
 */
export default class OcrEngine {

    constructor(options = {}) {

        this.lang = options.lang ?? "fra";
        this.worker = null;

    }

    async init() {

        if (this.worker) return;

        this.worker = await createWorker(this.lang, 1, {
            langPath: fraTrainedData.langPath,
            gzip: fraTrainedData.gzip
        });

    }

    /**
     * @param {Buffer|string} image chemin ou buffer d'image (idéalement déjà prétraitée)
     * @returns {Promise<{text: string, confidence: number, words: {text: string, confidence: number}[]}>}
     *   `words` liste les mots reconnus dans l'ordre de lecture avec leur
     *   confiance individuelle (issue du TSV Tesseract) — utilisé pour
     *   repérer les zones mal reconnues (voir garbledText.js).
     */
    async recognize(image) {

        await this.init();

        const { data } = await this.worker.recognize(image, {}, { tsv: true });

        return {
            text: data.text.trim(),
            confidence: data.confidence,
            words: parseWords(data.tsv)
        };

    }

    async terminate() {

        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }

    }

}

/**
 * Extrait la liste des mots (niveau 5 du TSV Tesseract) avec leur confiance,
 * dans l'ordre de lecture.
 */
function parseWords(tsv) {

    const words = [];

    for (const line of tsv.split("\n")) {

        if (!line) continue;

        const cols = line.split("\t");

        if (cols[0] !== "5") continue; // niveau 5 = mot

        const confidence = parseFloat(cols[10]);
        const text = cols[11];

        if (!text) continue;

        words.push({ text, confidence });

    }

    return words;

}
