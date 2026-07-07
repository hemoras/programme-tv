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

        page.profile = pageConfig;

        page.blocks = [];
        page.ignoredBlocks = [];

        for (const block of pageConfig.blocks) {

            if (block.type === "ignored") {
                page.ignoredBlocks.push(block);
            } else {
                page.blocks.push(block);
            }

        }

        page.statistics.detectedBlocks = page.blocks.length;

    }

}