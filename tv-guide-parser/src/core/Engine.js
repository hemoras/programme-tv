import ProcessingContext from "./ProcessingContext.js";

import ConfigManager from "../config/ConfigManager.js";

import Page from "./Page.js";

import Pipeline from "../pipeline/Pipeline.js";

import LoadConfigStep from "../pipeline/steps/LoadConfigStep.js";
import BuildChannelsStep from "../pipeline/steps/BuildChannelsStep.js";

export default class Engine {

    constructor() {

        this.pipeline = new Pipeline();

        this.pipeline
            .add(new LoadConfigStep())
            .add(new BuildChannelsStep());

    }

    async run(date, pageNumber, imagePath) {

        const context = new ProcessingContext();

        context.config = ConfigManager.load(date);

        context.page = new Page(
            date,
            pageNumber,
            imagePath
        );

        await this.pipeline.execute(context);

        return context;

    }

}