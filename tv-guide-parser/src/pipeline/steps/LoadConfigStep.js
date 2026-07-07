import PipelineStep from "../PipelineStep.js";

export default class LoadConfigStep extends PipelineStep {

    constructor() {

        super("LoadConfig");

    }

    async execute(context) {

        const page = context.page;

        const pageConfig = context.config.pages[String(page.pageNumber)];

        if (!pageConfig) {

            throw new Error(`Configuration absente pour la page ${page.pageNumber}`);

        }

        page.layout = pageConfig.layout;

        page.blocks = pageConfig.blocks.map(block => ({

            type: block.type ?? "channel",

            ...block

        }));

        page.statistics.detectedBlocks = page.blocks.length;

    }

}