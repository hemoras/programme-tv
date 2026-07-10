import PipelineStep from "../PipelineStep.js";

import ImageProcessor from "../../image/ImageProcessor.js";
import OcrEngine from "../../ocr/OcrEngine.js";
import cleanOcrText from "../../ocr/cleanOcrText.js";
import { findGarbledAnchors } from "../../ocr/garbledText.js";
import DebugImageWriter from "../../core/DebugImageWriter.js";
import safeFilename from "../../core/safeFilename.js";

export default class OcrBlocksStep extends PipelineStep {

    constructor() {

        super("OcrBlocks");

        this.processor = new ImageProcessor();
        this.ocr = new OcrEngine();

    }

    async execute(context) {

        const page = context.page;

        let index = 0;

        for (const block of page.blocks) {

            if (!block.image) continue;

            index++;

            const preprocessed = await this.processor.prepareForOcr(block.image);

            const { text, confidence, words } = await this.ocr.recognize(preprocessed);

            block.text = cleanOcrText(text);
            block.confidence = confidence;

            // Repères de zones mal reconnues (voir garbledText.js) : utilisés
            // par ParsePrograms pour ne pas laisser un encart illisible
            // (heure non détectée) polluer le sous-titre du programme
            // précédent.
            block.garbledAnchors = findGarbledAnchors(words);

            if (context.debug) {

                const name = `${String(index).padStart(2, "0")}-${safeFilename(block.name)}`;

                DebugImageWriter.write(`${name}-ocr.png`, preprocessed);
                DebugImageWriter.write(`${name}.txt`, text);

            }

        }

    }

    /**
     * Termine le worker Tesseract. Le worker est réutilisé d'un appel à
     * l'autre de execute() (pas de redémarrage par page) — utile pour un
     * traitement par lot (voir YearBatchRunner) où recréer le worker à
     * chaque page serait coûteux. À appeler explicitement une fois le
     * traitement terminé (voir Engine.terminate()).
     */
    async terminate() {

        await this.ocr.terminate();

    }

}
