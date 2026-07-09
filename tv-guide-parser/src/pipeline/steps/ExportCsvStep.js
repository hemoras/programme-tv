import PipelineStep from "../PipelineStep.js";

import CsvExporter from "../../export/CsvExporter.js";

/**
 * Exporte les programmes parsés en CSV, un fichier par chaîne
 * (csv/<Année>/<Date>/<Nom chaîne>.txt). Voir docs/PARSING_RULES.md.
 */
export default class ExportCsvStep extends PipelineStep {

    constructor() {

        super("ExportCsv");

        this.exporter = new CsvExporter();

    }

    async execute(context) {

        const page = context.page;

        page.csvFiles = this.exporter.export(page.date, page.channels);

    }

}
