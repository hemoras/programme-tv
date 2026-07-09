import fs from "fs-extra";
import path from "node:path";

import safeFilename from "../core/safeFilename.js";

const COLUMNS = ["Chaine", "Heure", "Titre Programme", "Sous-titre", "Genre"];

/**
 * Écrit un programme par ligne (CSV point-virgule) dans
 * csv/<Année>/<Date>/<Nom chaîne>.txt (voir docs/PARSING_RULES.md).
 * Un fichier par chaîne, écrasé à chaque exécution.
 */
export default class CsvExporter {

    constructor(rootDir = "csv") {

        this.rootDir = rootDir;

    }

    /**
     * @param {string} date "YYYY-MM-DD"
     * @param {import("../core/Channel.js").default[]} channels
     * @returns {string[]} chemins des fichiers écrits
     */
    export(date, channels) {

        const year = date.slice(0, 4);
        const dir = path.join(this.rootDir, year, date);

        fs.ensureDirSync(dir);

        const written = [];

        for (const channel of channels) {

            const filePath = path.join(dir, `${safeFilename(channel.name)}.txt`);

            const lines = [COLUMNS.join(";")];

            for (const program of channel.programs) {

                lines.push([
                    channel.name,
                    program.startTime,
                    program.title,
                    program.subtitle,
                    program.genre
                ].map(escapeField).join(";"));

            }

            fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");

            written.push(filePath);

        }

        return written;

    }

}

function escapeField(value) {

    const str = String(value ?? "");

    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;

}
