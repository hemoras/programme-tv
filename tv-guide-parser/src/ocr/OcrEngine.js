import { createWorker } from "tesseract.js";

import fraTrainedData from "@tesseract.js-data/fra";

export default class OcrEngine {

    constructor(options = {}) {

        this.lang = options.lang ?? "fra";
        this.psm = options.psm ?? null;
        this.worker = null;

    }

    async init() {

        if (this.worker) return;

        this.worker = await createWorker(this.lang, 1, {
            langPath: fraTrainedData.langPath,
            gzip: fraTrainedData.gzip
        });

        if (this.psm != null) {
            await this.worker.setParameters({ tessedit_pageseg_mode: this.psm });
        }

    }

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

function parseWords(tsv) {

    const words = [];

    for (const line of tsv.split("\n")) {

        if (!line) continue;

        const cols = line.split("\t");

        if (cols[0] !== "5") continue;

        const left = parseFloat(cols[6]);
        const top = parseFloat(cols[7]);
        const width = parseFloat(cols[8]);
        const height = parseFloat(cols[9]);
        const confidence = parseFloat(cols[10]);
        const text = cols[11];

        if (!text) continue;

        words.push({ text, confidence, left, top, width, height });

    }

    return words;

}
