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
    console.log("Exemple :");
    console.log();
    console.log("npm start samples/2001-06-01-Page5.jpg");
    process.exit(0);
}

const filename = path.basename(image);

const regex = /^(\d{4}-\d{2}-\d{2})-Page(\d+)\.(jpg|jpeg)$/i;

const match = filename.match(regex);

if (!match) {
    console.log(chalk.red("Nom de fichier invalide."));
    console.log();
    console.log("Format attendu :");
    console.log("2001-06-01-Page5.jpg");
    process.exit(1);
}

const date = match[1];
const page = Number(match[2]);

console.log(chalk.green("Image détectée"));
console.log("----------------------------");
console.log("Date :", date);
console.log("Page :", page);
console.log("Debug :", options.debug ? "Oui" : "Non");
console.log();

const engine = new Engine();

const pageObject = await engine.run(date,page,image);

console.log(chalk.green("Configuration"));

console.log("----------------------------");

console.log("Layout :",pageObject.layout);

console.log();

console.log("Image");

console.log("----------------------------");

console.log(pageObject.image.width+" x "+pageObject.image.height);

console.log();

console.log();

console.log("Chaînes attendues :");

pageObject.channels.forEach(channel=>{

    console.log(" •",channel.name);

});

console.log();

console.log(chalk.blue("Sprint 1"));

console.log("Le moteur est opérationnel.");
console.log();