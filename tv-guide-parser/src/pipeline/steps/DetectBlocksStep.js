import PipelineStep from "../PipelineStep.js";

import GridDetector from "../../image/GridDetector.js";

export default class DetectBlocksStep extends PipelineStep {

    constructor() {

        super("DetectBlocks");

        this.detector = new GridDetector();

    }

    async execute(context) {

        const page = context.page;

        // La stratégie de séparation de ligne dépend de la maquette du
        // magazine à l'époque de la page traitée (ex. trait plein en 2001,
        // potentiellement autre chose sur d'autres périodes 1960-2007).
        // Elle peut être précisée par page ou, plus généralement, au niveau
        // de la période entière dans config/periods/<année>.json.
        const rowSeparator = page.profile.rowSeparator ?? context.config.rowSeparator;

        const bounds = await this.detector.detect(
            page.imagePath,
            page.blocks.length,
            { rowSeparator }
        );

        if (bounds.length !== page.blocks.length) {

            page.debug.messages.push(
                `DetectBlocks: ${bounds.length} zones détectées pour ${page.blocks.length} blocs attendus (config).`
            );

        }

        const count = Math.min(bounds.length, page.blocks.length);

        for (let i = 0; i < count; i++) {
            page.blocks[i].bounds = bounds[i];
        }

    }

}
