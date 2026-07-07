import PipelineStep from "../PipelineStep.js";

import Channel from "../../core/Channel.js";

export default class BuildChannelsStep extends PipelineStep {

    constructor() {

        super("BuildChannels");

    }

    async execute(context) {

        const page = context.page;

        page.channels = [];

        for (const block of page.blocks) {

            if (block.type !== "channel") {
                continue;
            }

            page.channels.push(new Channel(block));

        }

        page.statistics.detectedChannels = page.channels.length;

    }

}