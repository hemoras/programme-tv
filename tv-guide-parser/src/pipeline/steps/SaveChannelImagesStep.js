import sharp from "sharp";
import fs from "fs-extra";
import path from "node:path";

import PipelineStep from "../PipelineStep.js";

import ChannelSlugs from "../../core/ChannelSlugs.js";

export default class SaveChannelImagesStep extends PipelineStep {

    constructor(rootDir = "decoupage-chaines") {

        super("SaveChannelImages");

        this.rootDir = rootDir;
        this.channelSlugs = new ChannelSlugs();

    }

    /**
     * Sauvegarde une copie couleur du découpage de chaque chaîne (le crop
     * tel qu'extrait par CropBlocksStep, avant tout prétraitement pour
     * l'OCR) dans decoupage-chaines/<année>/<date>/<slug-chaîne>.jpg — sert
     * d'archive pour vérifier visuellement le découpage a posteriori. Le nom
     * de fichier est l'identifiant normalisé de la chaîne (voir
     * config/chaines.json, ChannelSlugs.js), comme pour l'export CSV.
     *
     * Contrairement aux images de debug (DebugImageWriter, mode --debug
     * uniquement), ce dossier n'est jamais nettoyé automatiquement : chaque
     * exécution écrase seulement les fichiers de la chaîne/date concernées.
     */
    async execute(context) {

        const page = context.page;

        const year = page.date.slice(0, 4);
        const dir = path.join(this.rootDir, year, page.date);

        fs.ensureDirSync(dir);

        for (const block of page.blocks) {

            if (!block.image) continue;

            const filePath = path.join(dir, `${this.channelSlugs.resolve(block.name)}.jpg`);

            const jpeg = await sharp(block.image).jpeg().toBuffer();

            fs.writeFileSync(filePath, jpeg);

        }

    }

}
