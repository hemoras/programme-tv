import sharp from "sharp";

export default class ImageProcessor {

    async grayscale(input, output) {

        await sharp(input)

            .grayscale()

            .toFile(output);

    }

    /**
     * Prépare une image (buffer ou chemin) pour l'OCR : agrandissement,
     * niveaux de gris, étirement du contraste et renforcement de la
     * netteté. Validé empiriquement sur l'échantillon 2001 : améliore la
     * confiance Tesseract (80 → 86) et permet de récupérer du texte sur
     * fond surligné (jaune) qui était sinon perdu. La binarisation
     * (seuillage noir/blanc) a été testée mais dégrade les résultats ici
     * (bruit accru autour des zones photo) — volontairement absente.
     */
    async prepareForOcr(input, options = {}) {

        const scale = options.scale ?? 2;

        const metadata = await sharp(input).metadata();

        return sharp(input)
            .resize({ width: Math.round(metadata.width * scale) })
            .grayscale()
            .normalize()
            .sharpen()
            .toBuffer();

    }

}
