import fs from "fs-extra";
import path from "node:path";

import slugify from "./slugify.js";

const MAPPING_FILE = path.join("config", "chaines.json");

/**
 * Résout l'identifiant de fichier normalisé d'une chaîne (voir
 * config/chaines.json, généré par scripts/generateChainesMapping.js) à
 * partir de son nom tel qu'il apparaît dans la configuration de période.
 *
 * Si le nom n'est pas (encore) présent dans le mapping — ex. nouvelle
 * chaîne ajoutée à une période sans avoir relancé `npm run
 * generate-chaines` — on retombe sur un slug calculé à la volée plutôt que
 * d'échouer, avec un avertissement pour inciter à régénérer le fichier.
 */
export default class ChannelSlugs {

    constructor(mappingFile = MAPPING_FILE) {

        this.mappingFile = mappingFile;
        this.mapping = fs.existsSync(mappingFile) ? fs.readJsonSync(mappingFile) : {};

    }

    resolve(channelName) {

        if (this.mapping[channelName]) {
            return this.mapping[channelName];
        }

        console.warn(
            `ChannelSlugs: "${channelName}" absent de ${this.mappingFile} ` +
            `(pensez à relancer "npm run generate-chaines"). Slug calculé à la volée.`
        );

        return slugify(channelName);

    }

}
