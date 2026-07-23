#!/usr/bin/env node

import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { PSM } from "tesseract.js";

import OcrEngine from "./ocr/OcrEngine.js";
import PdfDayIndexRunner, { DAY_ORDER } from "./pdf/PdfDayIndexRunner.js";

try {
    process.loadEnvFile();
} catch {
}

const FILENAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\.pdf$/i;

const program = new Command();

program
    .name("index-pdf-pages")
    .description(
        "Repère, pour chaque numéro PDF de Télé 7 Jours d'une année, le numéro " +
        "de page de la première page de programme de chacun des 7 jours " +
        "(samedi à vendredi)."
    )
    .argument("<année>", "Année à traiter (ex. 2001)")
    .parse();

const [year] = program.args;

console.log();
console.log(chalk.cyan("==================================="));
console.log(chalk.cyan("     Index des pages PDF par jour"));
console.log(chalk.cyan("==================================="));
console.log();

const pdfDir = process.env.PDF_DIR;

if (!pdfDir) {

    console.log(chalk.red("PDF_DIR n'est pas défini."));
    console.log();
    console.log("Copier .env.example en .env et renseigner le chemin du dossier des PDF :");
    console.log(chalk.gray('PDF_DIR=F:\\programmes-tv\\Télé 7 jours\\pdf'));

    process.exit(1);

}

const yearDir = path.join(pdfDir, String(year));

if (!fs.existsSync(yearDir)) {

    console.log(chalk.red(`Dossier introuvable : ${yearDir}`));
    process.exit(1);

}

const files = fs.readdirSync(yearDir)
    .filter(name => FILENAME_PATTERN.test(name))
    .sort();

if (files.length === 0) {

    console.log(chalk.red(`Aucun PDF trouvé dans ${yearDir} (nom attendu : YYYY-MM-DD.pdf).`));
    process.exit(1);

}

console.log(chalk.cyan(`${files.length} PDF trouvé(s) pour ${year} dans ${yearDir}`));
console.log();

const runner = new PdfDayIndexRunner();
const ocrEngine = new OcrEngine({ psm: PSM.SPARSE_TEXT });
await ocrEngine.init();

const rows = [];
const allWarnings = [];

for (const [index, filename] of files.entries()) {

    const date = filename.match(FILENAME_PATTERN).slice(1, 4).join("-");
    const pdfPath = path.join(yearDir, filename);

    const progress = `[${index + 1}/${files.length}]`;

    process.stdout.write(`${progress} ${filename} ... `);

    try {

        const { pages, warnings } = await runner.run(pdfPath, ocrEngine);

        rows.push({ date, ...pages });
        allWarnings.push(...warnings.map(w => `${filename} : ${w}`));

        const summary = DAY_ORDER.map(day => pages[day] ?? "?").join(", ");

        console.log(warnings.length === 0 ? chalk.green(`OK (${summary})`) : chalk.yellow(`INCOMPLET (${summary})`));

    } catch (error) {

        console.log(chalk.red(`ÉCHEC — ${error.message}`));

        allWarnings.push(`${filename} : échec — ${error.message}`);

    }

}

await ocrEngine.terminate();

const outDir = "pdf-index";
fs.ensureDirSync(outDir);
const outPath = path.join(outDir, `${year}.csv`);

const columns = ["Date", ...DAY_ORDER.map(capitalize)];
const lines = [columns.join(";")];

for (const row of rows) {
    lines.push([row.date, ...DAY_ORDER.map(day => row[day] ?? "")].join(";"));
}

fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");

console.log();
console.log(chalk.green("Résumé"));
console.log("----------------------------");
console.log("PDF traités :", rows.length, "/", files.length);
console.log("CSV :", outPath);

if (allWarnings.length > 0) {

    console.log();
    console.log(chalk.yellow(`Avertissements (${allWarnings.length}) :`));

    for (const warning of allWarnings) {
        console.log(`  ${warning}`);
    }

}

console.log();

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}
