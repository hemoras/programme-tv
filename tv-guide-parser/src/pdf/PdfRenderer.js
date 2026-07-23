import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const PDFJS_DIR = path.dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")));
const STANDARD_FONT_DATA_URL = path.join(PDFJS_DIR, "standard_fonts").replace(/\\/g, "/") + "/";
const CMAP_URL = path.join(PDFJS_DIR, "cmaps").replace(/\\/g, "/") + "/";

export default class PdfRenderer {

    constructor(options = {}) {

        this.scale = options.scale ?? 1.5;
        this.doc = null;
        this.loadingTask = null;

    }

    async open(filePath) {

        const data = new Uint8Array(fs.readFileSync(filePath));

        this.loadingTask = pdfjsLib.getDocument({
            data,
            standardFontDataUrl: STANDARD_FONT_DATA_URL,
            cMapUrl: CMAP_URL,
            cMapPacked: true
        });

        this.doc = await this.loadingTask.promise;

        return this.doc.numPages;

    }

    async renderPage(pageNumber) {

        if (!this.doc) {
            throw new Error("PdfRenderer.renderPage() appelé avant open().");
        }

        const page = await this.doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: this.scale });

        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        return {
            buffer: canvas.toBuffer("image/png"),
            width,
            height
        };

    }

    async close() {

        if (this.loadingTask) {
            await this.loadingTask.destroy();
            this.loadingTask = null;
            this.doc = null;
        }

    }

}
