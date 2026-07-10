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
        // de la période entière dans config/periods/<décennie>.json.
        const rowSeparator = page.profile.rowSeparator ?? context.config.rowSeparator;

        // Important : on utilise page.profile.blocks (la liste COMPLETE de
        // la config, ignorés compris) et non page.blocks (déjà filtré par
        // LoadConfigStep), car un bloc "ignored" occupe quand même une case
        // de la grille physique de la page, et l'ordre de lecture de la
        // grille complète doit être préservé pour affecter correctement les
        // zones aux bons blocs. page.blocks et page.ignoredBlocks
        // contiennent les MÊMES objets (mêmes références) que
        // page.profile.blocks (voir LoadConfigStep), donc assigner .bounds
        // ici sur la liste complète suffit à le rendre disponible sur les
        // deux listes filtrées.
        const allBlocks = page.profile.blocks;

        // Un bloc peut occuper plusieurs rangées d'affilée dans sa colonne
        // (ex. Page4/2001 : Pathé Sport occupe les rangées 2 et 3 alors que
        // ses voisines n'en occupent qu'une, cf. "rowSpan" dans
        // config/periods/*.json). Le nombre de cases de la grille physique
        // à détecter est donc la somme des rowSpan, pas le nombre de blocs.
        const cellCount = allBlocks.reduce((sum, block) => sum + (block.rowSpan ?? 1), 0);

        const { columns, rowBands, warnings } = await this.detector.detect(
            page.imagePath,
            cellCount,
            { rowSeparator }
        );

        for (const message of warnings) {
            page.debug.messages.push(message);
        }

        const totalCells = columns.length * rowBands.length;

        if (totalCells !== cellCount) {

            page.debug.messages.push(
                `DetectBlocks: grille ${rowBands.length}x${columns.length} (${totalCells} cases) détectée ` +
                `pour ${cellCount} cases attendues (config, ignorés et rowSpan compris).`
            );

        }

        this.assignBounds(allBlocks, columns, rowBands);

    }

    /**
     * Affecte à chaque bloc de "blocks" (dans l'ordre de lecture de la
     * config : rangée par rangée, colonne par colonne) la zone de la
     * grille (columns × rowBands) qui lui correspond, façon "rowspan" HTML :
     * on avance dans la grille case par case, et un bloc dont "rowSpan" est
     * supérieur à 1 réserve les cases situées juste en dessous, dans la même
     * colonne, pour lui (bounds = union verticale de ces cases).
     */
    assignBounds(blocks, columns, rowBands) {

        const rowsCount = rowBands.length;
        const colsCount = columns.length;

        const occupied = Array.from({ length: rowsCount }, () => new Array(colsCount).fill(false));

        let blockIndex = 0;

        for (let row = 0; row < rowsCount && blockIndex < blocks.length; row++) {

            for (let col = 0; col < colsCount && blockIndex < blocks.length; col++) {

                if (occupied[row][col]) continue;

                const block = blocks[blockIndex];
                const span = Math.max(1, Math.min(block.rowSpan ?? 1, rowsCount - row));

                let height = 0;

                for (let r = row; r < row + span; r++) {
                    height += rowBands[r].height;
                    occupied[r][col] = true;
                }

                block.bounds = {
                    x: columns[col].x,
                    y: rowBands[row].y,
                    width: columns[col].width,
                    height
                };

                blockIndex++;

            }

        }

    }

}
