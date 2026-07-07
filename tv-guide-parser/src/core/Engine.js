import ConfigManager from "../config/ConfigManager.js";

import Page from "./Page.js";
import Channel from "./Channel.js";
import ImageLoader from "../image/ImageLoader.js";

export default class Engine {

    async run(date, pageNumber, imagePath) {

        const config = ConfigManager.load(date);

        const page = new Page(date, pageNumber, imagePath);

        const loader=new ImageLoader();

        page.image=await loader.load(imagePath);

        const pageConfig = config.pages[String(pageNumber)];

        if (!pageConfig) {
            throw new Error(`La page ${pageNumber} n'existe pas dans la configuration.`);
        }

        page.layout = pageConfig.layout;

        for (const block of pageConfig.blocks) {

            const type = block.type ?? "channel";

            if (type !== "channel") {
                continue;
            }

            page.channels.push(new Channel(block));

        }

        return page;

    }

}