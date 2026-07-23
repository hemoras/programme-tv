import fs from "fs-extra";
import path from "node:path";

import Block from "../core/Block.js";

export default class ConfigManager {

    /**
     * Charge la configuration (découpage des chaînes par page) applicable à
     * `date` (format "YYYY-MM-DD").
     *
     * Les configurations sont regroupées par décennie plutôt que par année
     * (un fichier config/periods/<décennie>.json, ex. "2000.json" pour
     * 2000-2009), chacune contenant une liste de `periods` avec leurs
     * propres startDate/endDate. Cela permet de représenter un changement
     * de grille en cours d'année (ex. 31/03/2001) sans avoir à dupliquer la
     * configuration entre deux fichiers annuels quand une période à cheval
     * sur le 1er janvier reste identique. Une période à cheval sur une
     * frontière de décennie doit en revanche être dupliquée dans les deux
     * fichiers de décennie concernés (cas plus rare, accepté).
     */
    static load(date) {

        const year = Number(date.substring(0, 4));
        const decade = Math.floor(year / 10) * 10;

        const file = path.join("config", "periods", `${decade}.json`);

        if (!fs.existsSync(file)) {
            throw new Error(`Aucune configuration de décennie trouvée pour ${decade} (${file} introuvable).`);
        }

        const { periods } = fs.readJsonSync(file);

        const period = periods.find(p => p.startDate <= date && date <= p.endDate);

        if (!period) {
            throw new Error(
                `Aucune période ne couvre la date ${date} dans ${file}. ` +
                `Périodes disponibles : ${periods.map(p => `${p.startDate} → ${p.endDate}`).join(", ")}`
            );
        }

        return this.normalize(period, date);

    }

    static normalize(config, date) {

        const normalized = structuredClone(config);

        for (const pageNumber of Object.keys(normalized.pages)) {

            const page = normalized.pages[pageNumber];

            page.blocks = page.blocks.map(block => new Block(this.resolveBlock(block, date)));

        }

        return normalized;

    }

    /**
     * Résout un bloc de configuration pour `date`. La plupart des blocs sont
     * fixes sur toute la période et sont retournés tels quels. Un bloc peut
     * en revanche varier en cours de période (ex. la chaîne "AB Moteurs"
     * devenant "Equidia" le 10/12/2001 — voir config/periods/2000.json) : il
     * porte alors un tableau `versions` de `{ name, from, to }` à la place
     * de `name`, et on sélectionne la version dont l'intervalle [from, to]
     * couvre `date`.
     */
    static resolveBlock(block, date) {

        if (!block.versions) {
            return block;
        }

        const version = block.versions.find(v => v.from <= date && date <= v.to);

        if (!version) {
            throw new Error(
                `Aucune version ne couvre la date ${date} pour le bloc versionné ` +
                `${block.versions.map(v => `${v.name} (${v.from} → ${v.to})`).join(", ")}.`
            );
        }

        return { ...block, ...version };

    }

}
