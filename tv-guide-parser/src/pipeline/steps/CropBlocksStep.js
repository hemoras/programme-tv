import sharp from "sharp";

import PipelineStep from "../PipelineStep.js";

import DebugImageWriter from "../../core/DebugImageWriter.js";

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

                // On ne remplace que les caractères réellement invalides dans
                // un nom de fichier (Windows/Linux) et les espaces ; les
                // lettres accentuées (é, è, ô...) sont conservées telles quelles.
                const safeName = block.name
                    .replace(/\s+/g, "_")
                    .replace(/[\\/:*?"<>|]+/g, "_");

                DebugImageWriter.write(
                    `${String(index).padStart(2, "0")}-${safeName}.png`,
                    block.image
                );

            }

        }

    }

}
