import PipelineStep from "../PipelineStep.js";

import Program from "../../core/Program.js";

import normalizeOcrText from "../../parsing/normalizeOcrText.js";
import splitIntoEntries from "../../parsing/splitIntoEntries.js";
import parseProgramEntry from "../../parsing/parseProgramEntry.js";

/**
 * Transforme le texte OCR brut de chaque chaîne (channel.block.text) en une
 * liste de programmes structurés (channel.programs, page.programs). Voir
 * docs/PARSING_RULES.md pour le détail des règles de découpage.
 */
export default class ParseProgramsStep extends PipelineStep {

    constructor() {

        super("ParsePrograms");

    }

    async execute(context) {

        const page = context.page;

        page.programs = [];

        for (const channel of page.channels) {

            channel.programs = [];

            const rawText = channel.block?.text;

            if (!rawText) continue;

            const flatText = normalizeOcrText(rawText);
            const entries = splitIntoEntries(flatText);

            for (const entryText of entries) {

                const parsed = parseProgramEntry(entryText);

                const program = new Program();

                program.channel = channel.name;
                program.startTime = parsed.startTime;
                program.title = parsed.title;
                program.subtitle = parsed.subtitle;
                program.genre = parsed.genre;
                program.rawText = parsed.rawText;
                program.confidence = channel.block.confidence ?? 1.0;

                channel.programs.push(program);
                page.programs.push(program);

            }

        }

        page.statistics.detectedPrograms = page.programs.length;

    }

}
