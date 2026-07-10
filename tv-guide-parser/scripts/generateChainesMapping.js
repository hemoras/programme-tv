#!/usr/bin/env node

/**
 * Régénère config/chaines.json : la correspondance entre le nom de chaîne
 * tel qu'il apparaît dans config/periods/*.json et son identifiant de
 * fichier normalisé (voir src/core/slugify.js), utilisé pour nommer les
 * fichiers CSV exportés (voir CsvExporter.js).
 *
 * À relancer après ajout d'une nouvelle période/chaîne dans
 * config/periods/*.json :
 *
 *   npm run generate-chaines
 */

import fs from "fs-extra";
import path from "node:path";
import { glob } from "glob";

import slugify from "../src/core/slugify.js";

const periodsDir = path.join("config", "periods");
const outputFile = path.join("config", "chaines.json");

const files = await glob("*.json", { cwd: periodsDir });

const names = new Set();

for (const file of files) {

    const { periods } = fs.readJsonSync(path.join(periodsDir, file));

    for (const period of periods) {
        for (const page of Object.values(period.pages)) {
            for (const block of page.blocks) {
                names.add(block.name);
            }
        }
    }

}

const sortedNames = [...names].sort((a, b) => a.localeCompare(b, "fr"));

const mapping = {};

for (const name of sortedNames) {
    mapping[name] = slugify(name);
}

fs.writeJsonSync(outputFile, mapping, { spaces: 4 });

console.log(`${sortedNames.length} chaîne(s) écrite(s) dans ${outputFile}`);
