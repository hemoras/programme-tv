import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";

import Engine from "./Engine.js";

const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-Page(\d+)\.(jpg|jpeg)$/i;

/**
 * Traite toutes les pages d'une année en une fois : scanne
 * <pagesDir>/<année>/ à la recherche de fichiers "YYYY-MM-DD-PageN.jpg" et
 * lance le pipeline sur chacun (voir Engine).
 *
 * Le worker OCR est réutilisé sur tout le lot (pas de redémarrage par page,
 * coûteux — voir OcrEngine) : une seule instance d'Engine est utilisée pour
 * l'ensemble du traitement, terminée explicitement à la fin.
 *
 * Un échec sur une page (config de période absente pour sa date, image
 * illisible...) n'interrompt pas le traitement des autres pages : chaque
 * échec est capturé et reporté dans le résumé final.
 */
export default class YearBatchRunner {

    async run(year, pagesDir) {

        const yearDir = path.join(pagesDir, String(year));

        if (!fs.existsSync(yearDir)) {
            throw new Error(`Dossier introuvable : ${yearDir}`);
        }

        const files = fs.readdirSync(yearDir)
            .filter(name => FILENAME_PATTERN.test(name))
            .sort();

        if (files.length === 0) {
            throw new Error(`Aucune page trouvée dans ${yearDir} (nom attendu : YYYY-MM-DD-PageN.jpg).`);
        }

        console.log(chalk.cyan(`${files.length} page(s) trouvée(s) pour ${year} dans ${yearDir}`));
        console.log();

        const engine = new Engine();

        const results = { success: [], failed: [] };

        for (const [index, filename] of files.entries()) {

            const match = filename.match(FILENAME_PATTERN);
            const date = match[1];
            const pageNumber = Number(match[2]);
            const imagePath = path.join(yearDir, filename);

            const progress = `[${index + 1}/${files.length}]`;

            process.stdout.write(`${progress} ${filename} ... `);

            try {

                const context = await engine.run(date, pageNumber, imagePath, { debug: false });

                console.log(chalk.green(`OK (${context.page.statistics.detectedPrograms} programmes)`));

                results.success.push(filename);

            } catch (error) {

                console.log(chalk.red(`ÉCHEC — ${error.message}`));

                results.failed.push({ filename, error: error.message });

            }

        }

        await engine.terminate();

        return results;

    }

}
