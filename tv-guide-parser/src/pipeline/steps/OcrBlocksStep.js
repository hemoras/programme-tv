import PipelineStep from "../PipelineStep.js";

import ImageProcessor from "../../image/ImageProcessor.js";
import OcrEngine from "../../ocr/OcrEngine.js";
import cleanOcrText from "../../ocr/cleanOcrText.js";
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

            const { text, confidence } = await this.ocr.recognize(preprocessed);

            block.text = cleanOcrText(text);
            block.confidence = confidence;

            if (context.debug) {

                const name = `${String(index).padStart(2, "0")}-${safeFilename(block.name)}`;

                DebugImageWriter.write(`${name}-ocr.png`, preprocessed);
                DebugImageWriter.write(`${name}.txt`, text);

            }

        }

        await this.ocr.terminate();

    }

}
