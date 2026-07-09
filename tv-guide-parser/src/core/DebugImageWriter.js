import fs from "fs-extra";
import path from "node:path";

export default class DebugImageWriter {

    static ensure() {

        fs.ensureDirSync("debug");

    }

    /**
     * Vide le dossier debug/ (le crée s'il n'existe pas). À appeler une
     * seule fois en début de traitement, avant les écritures, pour ne pas
     * mélanger les images d'un run précédent avec les nouvelles.
     */
    static clean() {

        fs.emptyDirSync("debug");

    }

    static write(filename, buffer) {

        this.ensure();

        fs.writeFileSync(path.join("debug", filename), buffer);

    }

}
