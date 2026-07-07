import fs from "fs-extra";
import path from "node:path";

export default class ConfigManager {

    static load(date) {

        const year = date.substring(0,4);

        const file = path.join("config","periods",`${year}.json`);

        if(!fs.existsSync(file))
            throw new Error(`Aucune configuration trouvée pour ${year}`);

        return fs.readJsonSync(file);

    }

}