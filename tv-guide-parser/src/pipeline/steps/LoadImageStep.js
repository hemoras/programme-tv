import PipelineStep from "../PipelineStep.js";

import ImageLoader from "../../image/ImageLoader.js";

export default class LoadImageStep extends PipelineStep {

    constructor() {

        super("LoadImage");

        this.loader = new ImageLoader();

    }

    async execute(context) {

        const page = context.page;

        page.image = await this.loader.load(page.imagePath);

    }

}
