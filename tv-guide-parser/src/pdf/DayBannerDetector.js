import sharp from "sharp";

const DAYS = ["samedi", "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];

const BAND_HEIGHT_RATIO = 0.06;
const BAND_LEFT_MARGIN_RATIO = 0.35;
const BAND_RIGHT_MARGIN_RATIO = 0.1;

const TEXT_MIN_LIGHTNESS = 150;
const TEXT_MAX_SATURATION = 45;

const COLORED_MIN_SATURATION = 30;
const COLORED_MIN_LIGHTNESS = 100;
const MIN_COLORED_RATIO = 0.5;

const UPSCALE_FACTOR = 3;

export default class DayBannerDetector {

    constructor(ocrEngine) {

        this.ocrEngine = ocrEngine;

    }

    async detect(pageImageBuffer, width, height) {

        const left = Math.round(width * BAND_LEFT_MARGIN_RATIO);
        const right = Math.round(width * (1 - BAND_RIGHT_MARGIN_RATIO));

        const bandRegion = {
            left,
            top: 0,
            width: right - left,
            height: Math.round(height * BAND_HEIGHT_RATIO)
        };

        const { data, info } = await sharp(pageImageBuffer)
            .extract(bandRegion)
            .raw()
            .toBuffer({ resolveWithObject: true });

        if (!isColoredEnough(data, info)) {
            return { day: null, text: "" };
        }

        const maskBuffer = await this.buildTextMask(data, info);

        const { text } = await this.ocrEngine.recognize(maskBuffer);

        return { day: matchSingleDay(text), text };

    }

    async buildTextMask(data, info) {

        const { width, height, channels } = info;

        const out = Buffer.alloc(width * height);

        for (let i = 0; i < width * height; i++) {

            const r = data[i * channels];
            const g = data[i * channels + 1];
            const b = data[i * channels + 2];

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);

            const isText = min > TEXT_MIN_LIGHTNESS && (max - min) < TEXT_MAX_SATURATION;

            out[i] = isText ? 0 : 255;

        }

        return sharp(out, { raw: { width, height, channels: 1 } })
            .resize({ width: width * UPSCALE_FACTOR, kernel: "nearest" })
            .png()
            .toBuffer();

    }

}

function isColoredEnough(data, info) {

    const { width, height, channels } = info;
    const total = width * height;

    let colored = 0;

    for (let i = 0; i < total; i++) {

        const r = data[i * channels];
        const g = data[i * channels + 1];
        const b = data[i * channels + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        if ((max - min) > COLORED_MIN_SATURATION && max > COLORED_MIN_LIGHTNESS) {
            colored++;
        }

    }

    return (colored / total) >= MIN_COLORED_RATIO;

}

function matchSingleDay(text) {

    const normalized = text.toLowerCase();

    const words = normalized.split(/[^a-zàâäéèêëïîôöùûüç]+/i).filter(word => word.length >= 4);
    const compact = normalized.replace(/[^a-zàâäéèêëïîôöùûüç]+/gi, "");

    const found = new Set();

    for (const day of DAYS) {

        const maxDistance = day.length <= 5 ? 1 : 2;

        const wordMatch = words.some(word =>
            Math.abs(word.length - day.length) <= maxDistance && levenshtein(word, day) <= maxDistance
        );

        const substringMatch = !wordMatch && slidingMinDistance(compact, day) <= maxDistance;

        if (wordMatch || substringMatch) {
            found.add(day);
        }

    }

    if (found.size !== 1) return null;

    return [...found][0];

}

function slidingMinDistance(haystack, needle) {

    let min = Infinity;

    for (let len = needle.length - 1; len <= needle.length + 1; len++) {

        if (len < 1) continue;

        for (let i = 0; i + len <= haystack.length; i++) {
            min = Math.min(min, levenshtein(haystack.slice(i, i + len), needle));
        }

    }

    return min;

}

function levenshtein(a, b) {

    const rows = a.length + 1;
    const cols = b.length + 1;
    const dist = Array.from({ length: rows }, (_, i) => [i, ...new Array(cols - 1).fill(0)]);

    for (let j = 0; j < cols; j++) dist[0][j] = j;

    for (let i = 1; i < rows; i++) {

        for (let j = 1; j < cols; j++) {

            const cost = a[i - 1] === b[j - 1] ? 0 : 1;

            dist[i][j] = Math.min(
                dist[i - 1][j] + 1,
                dist[i][j - 1] + 1,
                dist[i - 1][j - 1] + cost
            );

        }

    }

    return dist[rows - 1][cols - 1];

}
