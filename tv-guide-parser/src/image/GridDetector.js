import sharp from "sharp";

/**
 * GridDetector
 *
 * Détecte dynamiquement la grille de blocs (chaînes) d'une page de grille TV
 * en analysant la densité d'encre (pixels sombres) de l'image, sans coordonnées
 * codées en dur dans la configuration.
 *
 * Principe :
 *  1. Colonnes : on cherche les bandes verticales à très faible encre — ce
 *     sont des gouttières entre colonnes de chaînes. Une petite tolérance de
 *     bruit (JPEG, filets fins) est acceptée et les segments proches sont
 *     fusionnés. Ce principe a l'air stable sur les époques testées jusqu'ici.
 *
 *  2. Lignes : la façon dont deux rangées de chaînes sont séparées
 *     verticalement varie selon l'époque / la maquette du magazine :
 *       - "line" (par défaut) : un trait noir plein imprimé sur (quasi)
 *         toute la largeur de la page (cas Télé 7 Jours ~2001). On cherche
 *         une bande horizontale à très forte densité d'encre.
 *       - "whitespace" : un espace blanc franc entre les deux rangées,
 *         cohérent à travers toutes les colonnes (pas de trait imprimé).
 *       - "even" : repli sans analyse d'image — répartition strictement
 *         proportionnelle (utile en attendant de valider un vrai algorithme
 *         pour une époque donnée, ou si la maquette n'a aucun repère fiable).
 *     La stratégie à utiliser est choisie par période (voir le champ
 *     "rowSeparator" dans config/periods/*.json), car elle dépend de la
 *     maquette du magazine à cette époque, pas du contenu de la page.
 *
 * Limite connue : la stratégie "line" est validée sur l'échantillon page 1
 * de 2001 (grille 5x2, 10 blocs, 2 lignes). Les stratégies "whitespace" et
 * "even" sont fournies comme points d'extension mais n'ont pas encore été
 * validées sur un échantillon réel — à faire au fur et à mesure que des
 * scans d'autres époques (1960-2007) sont disponibles. Toutes les stratégies
 * supposent par ailleurs une grille rectangulaire régulière (nombre de
 * colonnes constant par ligne) ; une page avec un nombre de blocs non
 * multiple du nombre de colonnes détecté (ex. page 3 = 11 blocs, page 4 = 14
 * blocs dans 2001.json) nécessitera une évolution de l'algorithme.
 */
export default class GridDetector {

    constructor(options = {}) {

        // Seuil de niveau de gris en dessous duquel un pixel est considéré "encre"
        this.inkThreshold = options.inkThreshold ?? 180;

        // Marges (en fraction de la hauteur) exclues du calcul : le bandeau
        // du haut (titre du jour) et le pied de page (légende, numéro de
        // page) contiennent de l'encre sur toute la largeur et fausseraient
        // sinon la détection des gouttières de colonnes et des lignes.
        this.topMarginRatio = options.topMarginRatio ?? 0.08;
        this.bottomMarginRatio = options.bottomMarginRatio ?? 0.02;

        // Tolérance d'encre résiduelle (bruit JPEG / filets fins) acceptée dans
        // une gouttière de colonne, en fraction de la hauteur scannée.
        this.columnNoiseRatio = options.columnNoiseRatio ?? 0.02;

        // Largeur minimale (px) d'une bande à faible encre pour être candidate
        this.minColumnGutter = options.minColumnGutter ?? 5;

        // Distance (px) sous laquelle deux segments à faible encre proches
        // sont fusionnés en une seule gouttière (comble les trous dus au bruit)
        this.columnMergeGap = options.columnMergeGap ?? 20;

        // Largeur minimale (px) d'une colonne réelle (filtre les faux positifs)
        this.minColumnWidth = options.minColumnWidth ?? 20;

        // Stratégie de séparation de ligne par défaut, utilisée si aucune
        // n'est précisée par la configuration de la période.
        this.defaultRowSeparator = options.rowSeparator ?? "line";

        // --- Paramètres de la stratégie "line" (trait plein) ---
        // Densité d'encre minimale (fraction de la largeur) pour qu'une bande
        // horizontale soit considérée comme un trait plein de séparation.
        this.rowLineRatio = options.rowLineRatio ?? 0.85;
        this.minRowLineWidth = options.minRowLineWidth ?? 2;

        // --- Paramètres de la stratégie "whitespace" (espace blanc) ---
        this.rowNoiseTolerance = options.rowNoiseTolerance ?? 2;
        this.minRowGap = options.minRowGap ?? 8;
        this.rowClusterTolerance = options.rowClusterTolerance ?? 15;

    }

    /**
     * @param {string} imagePath
     * @param {number} blockCount nombre de blocs attendus (issus de la config de page)
     * @param {object} [options]
     * @param {string} [options.rowSeparator] stratégie à utiliser ("line" | "whitespace" | "even"),
     *   surcharge celle définie à la construction / dans la config de période.
     */
    async detect(imagePath, blockCount, options = {}) {

        const rowSeparator = options.rowSeparator ?? this.defaultRowSeparator;

        const { data, info } = await sharp(imagePath)
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height } = info;

        const columns = this.detectColumns(data, width, height);

        if (columns.length === 0) {
            throw new Error("GridDetector: aucune colonne détectée dans l'image.");
        }

        const rowsCount = Math.max(1, Math.round(blockCount / columns.length));

        const rowGutter = rowsCount > 1
            ? this.detectRowSeparator(rowSeparator, data, width, height, columns, height / rowsCount)
            : null;

        const rowBands = this.buildRowBands(height, rowsCount, rowGutter);

        const bounds = [];

        for (const rowBand of rowBands) {
            for (const col of columns) {
                bounds.push({
                    x: col.x,
                    y: rowBand.y,
                    width: col.width,
                    height: rowBand.height
                });
            }
        }

        return bounds;

    }

    detectRowSeparator(strategy, data, width, height, columns, expectedY) {

        switch (strategy) {

            case "whitespace":
                return this.detectRowWhitespace(data, width, height, columns, expectedY);

            case "even":
                return Math.round(expectedY);

            case "line":
            default:
                return this.detectRowLine(data, width, height, expectedY);

        }

    }

    detectColumns(data, width, height) {

        const y0 = Math.round(height * this.topMarginRatio);
        const y1 = height - Math.round(height * this.bottomMarginRatio);
        const scanHeight = y1 - y0;

        const profile = new Array(width).fill(0);

        for (let y = y0; y < y1; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                if (data[rowOffset + x] < this.inkThreshold) {
                    profile[x]++;
                }
            }
        }

        const tolerance = Math.max(1, Math.round(scanHeight * this.columnNoiseRatio));

        const rawGutters = this.findRuns(profile, tolerance, this.minColumnGutter);
        const gutters = this.mergeCloseRuns(rawGutters, this.columnMergeGap);

        // colonnes = espaces entre gouttières (en excluant marges de page en bord)
        const columns = [];

        for (let i = 0; i < gutters.length - 1; i++) {

            const x0 = gutters[i].end;
            const x1 = gutters[i + 1].start;

            if (x1 - x0 < this.minColumnWidth) continue; // trop étroit pour être une colonne réelle

            columns.push({ x: x0, width: x1 - x0 });

        }

        return columns;

    }

    mergeCloseRuns(runs, maxGap) {

        const merged = [];

        for (const run of runs) {

            const last = merged[merged.length - 1];

            if (last && run.start - last.end <= maxGap) {
                last.end = run.end;
                last.width = last.end - last.start;
            } else {
                merged.push({ ...run });
            }

        }

        return merged;

    }

    /**
     * Stratégie "line" : détecte le trait horizontal plein qui sépare deux
     * lignes de la grille (imprimé sur toute la largeur de la page).
     */
    detectRowLine(data, width, height, expectedY) {

        // On exclut le bandeau du haut : lui aussi est une zone à très forte
        // densité d'encre (fond de couleur uni) et serait sinon un faux positif.
        const y0 = Math.round(height * this.topMarginRatio);
        const y1 = height - Math.round(height * this.bottomMarginRatio);

        const profile = new Array(height).fill(0);

        for (let y = y0; y < y1; y++) {
            let count = 0;
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                if (data[rowOffset + x] < this.inkThreshold) count++;
            }
            profile[y] = count;
        }

        const highThreshold = width * this.rowLineRatio;

        const runs = this.findRunsAbove(profile, highThreshold, this.minRowLineWidth, y0, y1);

        if (runs.length === 0) {
            return Math.round(expectedY);
        }

        // Plusieurs traits pleins peuvent exister (filets décoratifs) : on
        // garde celui le plus proche de la position attendue pour une grille
        // à lignes de hauteur à peu près régulière.
        runs.sort((a, b) =>
            Math.abs((a.start + a.end) / 2 - expectedY) - Math.abs((b.start + b.end) / 2 - expectedY)
        );

        const best = runs[0];

        return Math.round((best.start + best.end) / 2);

    }

    /**
     * Stratégie "whitespace" : pas de trait imprimé, mais un espace blanc
     * entre les deux rangées. On cherche, dans chaque colonne, les creux à
     * très faible encre, puis on retient la position Y qui revient dans le
     * plus de colonnes distinctes (un vrai séparateur de grille doit
     * apparaître dans (quasi) toutes les colonnes), en départageant les
     * égalités par proximité avec la position attendue (grille à lignes de
     * hauteur à peu près régulière) — cela écarte les simples coïncidences
     * de mise en page (ex. un même retour à la ligne répété dans chaque
     * colonne).
     */
    detectRowWhitespace(data, width, height, columns, expectedY) {

        const candidatesByColumn = columns.map((col, colIndex) =>
            this.rowGapsForColumn(data, width, height, col).map(c => ({ ...c, colIndex }))
        );

        const allCandidates = candidatesByColumn.flat();

        const clusters = [];

        for (const candidate of allCandidates) {
            const mid = (candidate.start + candidate.end) / 2;
            let cluster = clusters.find(c => Math.abs(c.mid - mid) <= this.rowClusterTolerance);
            if (!cluster) {
                cluster = { mid, members: [] };
                clusters.push(cluster);
            }
            cluster.members.push(candidate);
            cluster.mid = cluster.members.reduce((s, m) => s + (m.start + m.end) / 2, 0) / cluster.members.length;
        }

        if (clusters.length === 0) {
            return Math.round(expectedY);
        }

        for (const cluster of clusters) {
            cluster.columnCoverage = new Set(cluster.members.map(m => m.colIndex)).size;
        }

        const maxCoverage = Math.max(...clusters.map(c => c.columnCoverage));

        const bestClusters = clusters.filter(c => c.columnCoverage === maxCoverage);

        bestClusters.sort((a, b) => Math.abs(a.mid - expectedY) - Math.abs(b.mid - expectedY));

        const best = bestClusters[0];

        const avgStart = best.members.reduce((s, m) => s + m.start, 0) / best.members.length;
        const avgEnd = best.members.reduce((s, m) => s + m.end, 0) / best.members.length;

        return Math.round((avgStart + avgEnd) / 2);

    }

    rowGapsForColumn(data, width, height, col) {

        const profile = new Array(height).fill(0);

        for (let y = 0; y < height; y++) {
            let count = 0;
            const rowOffset = y * width;
            for (let x = col.x; x < col.x + col.width; x++) {
                if (data[rowOffset + x] < this.inkThreshold) count++;
            }
            profile[y] = count;
        }

        const runs = this.findRuns(profile, this.rowNoiseTolerance, this.minRowGap);

        // on ignore les creux tout en haut / tout en bas (marges de page)
        return runs.filter(r => r.start > 50 && r.end < height - 50);

    }

    /**
     * Trouve les intervalles contigus où profile[i] >= minValue, de largeur >= minWidth,
     * en ne scannant que la plage [y0, y1).
     */
    findRunsAbove(profile, minValue, minWidth, y0, y1) {

        const runs = [];
        let start = null;

        for (let i = y0; i < y1; i++) {

            if (profile[i] >= minValue) {
                if (start === null) start = i;
            } else {
                if (start !== null && i - start >= minWidth) {
                    runs.push({ start, end: i, width: i - start });
                }
                start = null;
            }

        }

        if (start !== null && y1 - start >= minWidth) {
            runs.push({ start, end: y1, width: y1 - start });
        }

        return runs;

    }

    /**
     * Trouve les intervalles contigus où profile[i] <= maxValue, de largeur >= minWidth.
     */
    findRuns(profile, maxValue, minWidth) {

        const runs = [];
        let start = null;

        for (let i = 0; i < profile.length; i++) {

            if (profile[i] <= maxValue) {
                if (start === null) start = i;
            } else {
                if (start !== null && i - start >= minWidth) {
                    runs.push({ start, end: i, width: i - start });
                }
                start = null;
            }

        }

        if (start !== null && profile.length - start >= minWidth) {
            runs.push({ start, end: profile.length, width: profile.length - start });
        }

        return runs;

    }

    buildRowBands(height, rowsCount, rowGutterY) {

        if (rowsCount <= 1 || rowGutterY === null) {
            return [{ y: 0, height }];
        }

        // Pour l'instant seul le cas 2 lignes est géré/validé.
        // Généralisation à N lignes à faire quand des échantillons
        // multi-lignes (>2) seront disponibles.
        return [
            { y: 0, height: rowGutterY },
            { y: rowGutterY, height: height - rowGutterY }
        ];

    }

}
