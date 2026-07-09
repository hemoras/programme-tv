import sharp from "sharp";

import PipelineStep from "../PipelineStep.js";

import DebugImageWriter from "../../core/DebugImageWriter.js";
import safeFilename from "../../core/safeFilename.js";

export default class CropBlocksStep extends PipelineStep {

    constructor() {

        super("CropBlocks");

    }

    async execute(context) {

        const page = context.page;

        if (context.debug) {
            DebugImageWriter.clean();
        }

        let index = 0;

        for (const block of page.blocks) {

            if (!block.bounds) continue;

            index++;

            const { x, y, width, height } = block.bounds;

            block.image = await sharp(page.imagePath)
                .extract({
                    left: Math.round(x),
                    top: Math.round(y),
                    width: Math.round(width),
                    height: Math.round(height)
                })
                .toBuffer();

            if (context.debug) {

                const safeName = safeFilename(block.name);

                DebugImageWriter.write(
                    `${String(index).padStart(2, "0")}-${safeName}.png`,
                    block.image
                );

            }

        }

    }

}
