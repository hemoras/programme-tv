import ProcessingContext from "./ProcessingContext.js";

import ConfigManager from "../config/ConfigManager.js";

import Page from "./Page.js";

import Pipeline from "../pipeline/Pipeline.js";

import LoadConfigStep from "../pipeline/steps/LoadConfigStep.js";
import LoadImageStep from "../pipeline/steps/LoadImageStep.js";
import DetectBlocksStep from "../pipeline/steps/DetectBlocksStep.js";
import CropBlocksStep from "../pipeline/steps/CropBlocksStep.js";
import SaveChannelImagesStep from "../pipeline/steps/SaveChannelImagesStep.js";
import OcrBlocksStep from "../pipeline/steps/OcrBlocksStep.js";
import BuildChannelsStep from "../pipeline/steps/BuildChannelsStep.js";
import ParseProgramsStep from "../pipeline/steps/ParseProgramsStep.js";
import ExportCsvStep from "../pipeline/steps/ExportCsvStep.js";

export default class Engine {

    constructor() {

        this.pipeline = new Pipeline();

        this.ocrBlocksStep = new OcrBlocksStep();

        this.pipeline
            .add(new LoadConfigStep())
            .add(new LoadImageStep())
            .add(new DetectBlocksStep())
            .add(new CropBlocksStep())
            .add(new SaveChannelImagesStep())
            .add(this.ocrBlocksStep)
            .add(new BuildChannelsStep())
            .add(new ParseProgramsStep())
            .add(new ExportCsvStep());

    }

    /**
     * @param {string} date "YYYY-MM-DD"
     * @param {number} pageNumber
     * @param {string} imagePath
     * @param {{debug?: boolean}} [options]
     *
     * Le worker OCR est réutilisé d'un appel à l'autre (utile pour traiter
     * plusieurs pages avec la même instance d'Engine, voir
     * YearBatchRunner) — penser à appeler terminate() une fois tous les
     * appels à run() terminés pour libérer le worker et laisser le
     * processus Node se terminer proprement.
     */
    async run(date, pageNumber, imagePath, options = {}) {

        const context = new ProcessingContext();

        context.debug = options.debug ?? false;

        context.config = ConfigManager.load(date);

        context.page = new Page(
            date,
            pageNumber,
            imagePath
        );

        await this.pipeline.execute(context);

        return context;

    }

    async terminate() {

        await this.ocrBlocksStep.terminate();

    }

}
