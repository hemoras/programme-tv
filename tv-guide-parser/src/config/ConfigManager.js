import fs from "fs-extra";
import path from "node:path";

import Block from "../core/Block.js";

export default class ConfigManager {

    static load(date) {

        const year = date.substring(0, 4);

        const file = path.join("config", "periods", `${year}.json`);

        if (!fs.existsSync(file)) {
            throw new Error(`Aucune configuration trouvée pour ${year}`);
        }

        const config = fs.readJsonSync(file);

        return this.normalize(config);

    }

    static normalize(config) {

        const normalized = structuredClone(config);

        for (const pageNumber of Object.keys(normalized.pages)) {

            const page = normalized.pages[pageNumber];

            page.blocks = page.blocks.map(block => new Block(block));

        }

        return normalized;

    }

}