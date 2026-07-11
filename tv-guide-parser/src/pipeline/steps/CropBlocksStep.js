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

            const extract = this.clampBounds(block.bounds, page.image);

            block.image = await sharp(page.imagePath)
                .extract(extract)
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

    /**
     * Convertit block.bounds (potentiellement non entier, ex. issu d'une
     * rangée partagée entre plusieurs bandes) en région d'extraction sharp
     * valide : arrondit les bords gauche/haut puis dérive largeur/hauteur à
     * partir des bords arrondis (plutôt que d'arrondir largeur/hauteur
     * indépendamment, ce qui peut faire dépasser l'image de 1px si les
     * arrondis vont dans des sens opposés — cf. bug réel sur
     * Page4/2001-01-02, voir docs/PARSING_RULES.md), et referme la région
     * dans les limites réelles de l'image (filet de sécurité en cas de
     * géométrie amont malgré tout incohérente, pour ne pas interrompre tout
     * le traitement de la page pour un seul bloc).
     */
    clampBounds(bounds, image) {

        const left = Math.max(0, Math.round(bounds.x));
        const top = Math.max(0, Math.round(bounds.y));
        const right = Math.min(image.width, Math.round(bounds.x + bounds.width));
        const bottom = Math.min(image.height, Math.round(bounds.y + bounds.height));

        return {
            left,
            top,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top)
        };

    }

}
