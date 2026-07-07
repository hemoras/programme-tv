#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";

import Engine from "./core/Engine.js";

const program = new Command();

program
    .name("tv-guide-parser")
    .description("TV Guide Parser")
    .version("0.1.0")
    .argument("[image]", "Image à analyser")
    .option("-d, --debug", "Mode debug")
    .parse();

const options = program.opts();
const image = program.args[0];

console.log();

console.log(chalk.cyan("==================================="));
console.log(chalk.cyan("        TV Guide Parser"));
console.log(chalk.cyan("             v0.1.0"));
console.log(chalk.cyan("==================================="));
console.log();

if (!image) {

    console.log(chalk.yellow("Aucune image fournie."));
    console.log();
    console.log("npm start samples/2001-01-01-Page1.jpg");

    process.exit(0);

}

const filename = path.basename(image);

const match = filename.match(/^(\d{4}-\d{2}-\d{2})-Page(\d+)\.(jpg|jpeg)$/i);

if (!match) {

    console.log(chalk.red("Nom de fichier invalide."));
    process.exit(1);

}

const date = match[1];
const page = Number(match[2]);

const engine = new Engine();

const context = await engine.run(
    date,
    page,
    image,
    { debug: options.debug }
);

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

    console.log("•", channel.name);

}

console.log();

console.log(chalk.green("Pipeline"));
console.log("----------------------------");

for (const [step, duration] of Object.entries(context.timings)) {

    console.log(`${step.padEnd(20)} ${duration} ms`);

}

console.log();

console.log(chalk.blue("Pipeline exécutée avec succès."));