import fs from "fs-extra";
import path from "node:path";

import ChannelSlugs from "../core/ChannelSlugs.js";

const COLUMNS = ["Chaine", "Heure", "Titre Programme", "Sous-titre", "Genre"];

/**
 * Écrit un programme par ligne (CSV point-virgule) dans
 * csv/<Année>/<Date>/<slug-chaîne>.txt (voir docs/PARSING_RULES.md).
 * Un fichier par chaîne, écrasé à chaque exécution. Le nom de fichier est
 * l'identifiant normalisé de la chaîne (voir config/chaines.json,
 * ChannelSlugs.js) — ex. "Paris Première" -> "paris-premiere.txt" — pas le
 * nom brut, pour avoir des noms de fichiers stables et sans accents/espaces.
 */
export default class CsvExporter {

    constructor(rootDir = "csv") {

        this.rootDir = rootDir;
        this.channelSlugs = new ChannelSlugs();

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

            const filePath = path.join(dir, `${this.channelSlugs.resolve(channel.name)}.txt`);

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

            // Segments qu'on n'a pas pu rattacher de façon fiable à un
            // programme (encart dont l'heure n'a pas pu être lue, cf.
            // garbledText.js) : on garde une trace en fin de fichier, en
            // texte brut, sans essayer de les structurer en colonnes — pour
            // ne pas polluer les lignes de programmes normales avec du
            // contenu non fiable/mal reconnu.
            if (channel.unparsedSegments?.length) {

                lines.push("");
                lines.push("# Segments non reconnus (heure illisible, fusionnés avec le programme précédent) :");

                for (const segment of channel.unparsedSegments) {

                    const after = segment.afterStartTime ? ` [après ${segment.afterStartTime}]` : "";

                    lines.push(`#${after} ${segment.text}`);

                }

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
