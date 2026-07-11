#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";

import Engine from "./core/Engine.js";
import YearBatchRunner from "./core/YearBatchRunner.js";

// Charge .env (PAGES_DIR notamment) s'il existe — voir .env.example.
// Silencieux si le fichier est absent (ex. utilisation sans variable
// d'environnement, image passée directement en argument).
try {
    process.loadEnvFile();
} catch {
    // .env absent : pas grave, seule la commande --year en a besoin.
}

const program = new Command();

program
    .name("tv-guide-parser")
    .description("TV Guide Parser")
    .version("0.1.0")
    .argument("[image]", "Image à analyser")
    .option("-d, --debug", "Mode debug")
    .option("-y, --year <année>", "Traite toutes les pages de l'année trouvées dans PAGES_DIR")
    .option("--from <date>", "Avec --year : date de début (YYYY-MM-DD), incluse (défaut : 1er janvier)")
    .option("--to <date>", "Avec --year : date de fin (YYYY-MM-DD), incluse (défaut : 31 décembre)")
    .parse();

const options = program.opts();
const image = program.args[0];

console.log();

console.log(chalk.cyan("==================================="));
console.log(chalk.cyan("        TV Guide Parser"));
console.log(chalk.cyan("             v0.1.0"));
console.log(chalk.cyan("==================================="));
console.log();

if (options.year) {

    await runYear(options.year, { from: options.from, to: options.to });

} else if (image) {

    await runSingleImage(image, options.debug);

} else {

    console.log(chalk.yellow("Aucune image fournie."));
    console.log();
    console.log("npm start -- samples/2001-01-01-Page1.jpg");
    console.log("npm start -- --year 2001", chalk.gray("(nécessite PAGES_DIR, voir .env.example)"));

    process.exit(0);

}

async function runSingleImage(image, debug) {

    const filename = path.basename(image);

    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-Page(\d+)\.(jpg|jpeg)$/i);

    if (!match) {

        console.log(chalk.red("Nom de fichier invalide."));
        process.exit(1);

    }

    const date = match[1];
    const page = Number(match[2]);

    const engine = new Engine();

    const context = await engine.run(date, page, image, { debug });

    await engine.terminate();

    console.log(chalk.green("Image détectée"));
    console.log("----------------------------");
    console.log("Date :", context.page.date);
    console.log("Page :", context.page.pageNumber);
    console.log();

    console.log(chalk.green("Configuration"));
    console.log("----------------------------");
    console.log("Profil :", context.page.profile.name);
    console.log("Layout :", context.page.profile.layout);
    console.log();

    console.log(chalk.green("Blocs"));
    console.log("----------------------------");
    console.log("Détectés :", context.page.statistics.detectedBlocks);
    console.log("Blocs ignorés :", context.page.ignoredBlocks.length);
    console.log();

    console.log(chalk.green("Chaînes"));
    console.log("----------------------------");

    for (const channel of context.page.channels) {

        const block = channel.block;
        const confidence = block.confidence != null ? `${Math.round(block.confidence)}%` : "-";
        const chars = block.text ? block.text.length : 0;
        const programs = channel.programs ? channel.programs.length : 0;

        console.log("•", channel.name.padEnd(20), `OCR: ${confidence}`.padEnd(10), `${chars} caractères`.padEnd(16), `${programs} programmes`);

    }

    console.log();

    console.log(chalk.green("Programmes"));
    console.log("----------------------------");
    console.log("Total :", context.page.statistics.detectedPrograms);
    console.log();

    console.log(chalk.green("Export CSV"));
    console.log("----------------------------");

    for (const file of context.page.csvFiles ?? []) {
        console.log("•", file);
    }

    console.log();

    console.log(chalk.green("Pipeline"));
    console.log("----------------------------");

    for (const [step, duration] of Object.entries(context.timings)) {

        console.log(`${step.padEnd(20)} ${duration} ms`);

    }

    console.log();

    console.log(chalk.blue("Pipeline exécutée avec succès."));

}

async function runYear(year, { from, to } = {}) {

    const pagesDir = process.env.PAGES_DIR;

    if (!pagesDir) {

        console.log(chalk.red("PAGES_DIR n'est pas défini."));
        console.log();
        console.log("Copier .env.example en .env et renseigner le chemin du dossier des scans :");
        console.log(chalk.gray('PAGES_DIR=F:\\programmes-tv\\Télé 7 jours\\Pages'));

        process.exit(1);

    }

    const runner = new YearBatchRunner();

    let results;

    try {
        results = await runner.run(year, pagesDir, { from, to });
    } catch (error) {
        console.log(chalk.red(error.message));
        process.exit(1);
    }

    console.log();
    console.log(chalk.green("Résumé"));
    console.log("----------------------------");
    console.log("Réussies :", chalk.green(results.success.length));
    console.log("Échouées :", results.failed.length > 0 ? chalk.red(results.failed.length) : results.failed.length);

    if (results.failed.length > 0) {

        console.log();
        console.log(chalk.red("Détail des échecs :"));

        for (const { filename, error } of results.failed) {
            console.log(`  ${filename} — ${error}`);
        }

    }

    console.log();

}
