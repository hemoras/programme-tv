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
 *  2. Lignes : la façon dont les rangées de chaînes sont séparées
 *     verticalement varie selon l'époque / la maquette du magazine :
 *       - "line" (par défaut) : un trait noir plein imprimé sur (quasi)
 *         toute la largeur de CHAQUE COLONNE (cas Télé 7 Jours ~2001). On
 *         cherche, dans chaque colonne indépendamment, les bandes
 *         horizontales à très forte densité d'encre — un vrai trait de
 *         séparation de chaîne traverse toute la largeur du bloc, alors que
 *         la bordure d'un encart (encadré "programme en clair" surligné,
 *         etc.) a des marges à l'intérieur du bloc et n'apparaît que sur une
 *         partie de la largeur. Les traits candidats sont ensuite regroupés
 *         entre colonnes (un vrai séparateur revient à la même hauteur dans
 *         quasi toutes les colonnes) puis validés par un second critère :
 *         juste après un vrai séparateur de chaîne se trouve le bandeau de
 *         nom de la chaîne suivante (fond coloré, texte gras => forte
 *         densité d'encre sur une hauteur significative), alors qu'un filet
 *         interne à un bloc (comme la bordure d'un encadré surligné) est
 *         suivi de texte de programme normal (densité nettement plus
 *         faible). Ce second critère est ce qui permet de distinguer un vrai
 *         séparateur d'un filet interne qui a exactement la même épaisseur
 *         et la même récurrence inter-colonnes (cas réel observé : Page4,
 *         voir docs/PARSING_RULES.md).
 *       - "whitespace" : un espace blanc franc entre les rangées, cohérent
 *         à travers toutes les colonnes (pas de trait imprimé).
 *       - "even" : repli sans analyse d'image — répartition strictement
 *         proportionnelle (utile en attendant de valider un vrai algorithme
 *         pour une époque donnée, ou si la maquette n'a aucun repère fiable).
 *     La stratégie à utiliser est choisie par période (voir le champ
 *     "rowSeparator" dans config/periods/*.json), car elle dépend de la
 *     maquette du magazine à cette époque, pas du contenu de la page.
 *
 *  3. Grilles à plus de 2 rangées : le nombre de rangées est déduit de
 *     cellCount / nombre de colonnes détectées, puis on cherche
 *     (rangées - 1) traits de séparation. Les rangées peuvent avoir des
 *     hauteurs très différentes (le contenu de chaque chaîne varie), aucune
 *     hypothèse de régularité n'est faite sur leur position — seule la
 *     détection d'image fait foi. Si l'analyse ne trouve pas assez de
 *     traits fiables, les coupures manquantes sont réparties uniformément
 *     dans les plus grands intervalles restants (repli best-effort, avec un
 *     message de warning retourné par detect()).
 *
 * GridDetector ne fait QUE la géométrie (colonnes, rangées) : il retourne
 * columns/rowBands, pas des bounds déjà associés à des blocs. C'est
 * DetectBlocksStep qui combine cette géométrie avec la liste de blocs de la
 * config pour affecter les bounds, y compris pour les blocs qui occupent
 * plusieurs rangées d'affilée dans leur colonne (ex. Page4/2001 : Pathé
 * Sport occupe 2 rangées sur 3, cf. "rowSpan" dans config/periods/*.json).
 * Ce découplage est nécessaire car une grille peut être rectangulaire en
 * nombre de cases (colonnes × rangées) sans que chaque bloc n'occupe
 * exactement une case.
 *
 * Limite connue : le nombre de rangées à détecter (cellCount / colonnes)
 * suppose toujours que TOUTES les colonnes ont le même nombre de rangées ;
 * une colonne qui aurait moins de cases que les autres SANS qu'un bloc n'y
 * ait de rowSpan (case réellement vide, ni bloc ni prolongement) n'est pas
 * représentable dans la configuration actuelle.
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
        // Densité d'encre minimale (fraction de la largeur de la colonne)
        // pour qu'une bande horizontale soit considérée comme un trait
        // plein de séparation.
        this.rowLineRatio = options.rowLineRatio ?? 0.85;
        this.minRowLineWidth = options.minRowLineWidth ?? 2;
        // Largeur maximale (px) d'un trait candidat : au-delà, il s'agit
        // probablement d'un aplat épais (photo, encart sombre) et non d'un
        // simple filet de séparation.
        this.maxRowLineWidth = options.maxRowLineWidth ?? 20;
        // Hauteur (px) de la fenêtre examinée juste après un trait candidat
        // pour vérifier la présence d'un bandeau de nom de chaîne (forte
        // densité d'encre soutenue).
        this.bannerWindowHeight = options.bannerWindowHeight ?? 100;
        // Densité d'encre minimale dans cette fenêtre pour valider le trait
        // comme un vrai séparateur de chaîne plutôt qu'un filet interne.
        this.bannerDensityThreshold = options.bannerDensityThreshold ?? 0.4;
        // Distance (px) sous laquelle deux traits/coupures retenus sont
        // considérés comme la même frontière (ex. double filet d'un
        // bandeau) et fusionnés en un seul.
        this.rowLineMergeGap = options.rowLineMergeGap ?? 80;

        // --- Paramètres partagés par "whitespace" et le regroupement inter-colonnes de "line" ---
        this.rowNoiseTolerance = options.rowNoiseTolerance ?? 2;
        this.minRowGap = options.minRowGap ?? 8;
        this.rowClusterTolerance = options.rowClusterTolerance ?? 15;

    }

    /**
     * @param {string} imagePath
     * @param {number} cellCount nombre de cases de grille attendues (issu de la config
     *   de page : ignorés compris, et un bloc occupant plusieurs rangées via "rowSpan"
     *   compte pour rowSpan cases — voir DetectBlocksStep pour le calcul)
     * @param {object} [options]
     * @param {string} [options.rowSeparator] stratégie à utiliser ("line" | "whitespace" | "even"),
     *   surcharge celle définie à la construction / dans la config de période.
     * @returns {Promise<{columns: object[], rowBands: object[], warnings: string[]}>}
     *   columns = [{x, width}, ...], rowBands = [{y, height}, ...] : à combiner en
     *   grille (columns.length × rowBands.length cases) par l'appelant, qui seul sait
     *   comment les blocs de config occupent ces cases (blocs simples ou en rowSpan).
     */
    async detect(imagePath, cellCount, options = {}) {

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

        const rowsCount = Math.max(1, Math.round(cellCount / columns.length));

        const warnings = [];

        let cutYs = [];

        if (rowsCount > 1) {

            cutYs = this.detectRowCuts(rowSeparator, data, width, height, columns, rowsCount);

            if (cutYs.length < rowsCount - 1) {

                warnings.push(
                    `GridDetector: seulement ${cutYs.length} trait(s) de séparation fiable(s) trouvé(s) ` +
                    `pour ${rowsCount} rangées attendues (${rowsCount - 1} attendus) — ` +
                    `répartition égale utilisée pour compléter.`
                );

                cutYs = this.fillMissingCuts(cutYs, height, rowsCount);

            } else if (cutYs.length > rowsCount - 1) {

                cutYs = cutYs.slice(0, rowsCount - 1);

            }

        }

        const rowBands = this.buildRowBands(height, rowsCount, cutYs);

        return { columns, rowBands, warnings };

    }

    /**
     * Détecte les (rowsCount - 1) coupures horizontales séparant les
     * rangées, selon la stratégie choisie. Retourne les Y triés par ordre
     * croissant (peut retourner moins que rowsCount - 1 si l'analyse
     * d'image n'a pas trouvé assez de séparateurs fiables — voir detect()
     * pour le repli).
     */
    detectRowCuts(strategy, data, width, height, columns, rowsCount) {

        switch (strategy) {

            case "whitespace":
                return this.detectRowCutsWhitespace(data, width, height, columns, rowsCount);

            case "even":
                return this.evenRowCuts(height, rowsCount);

            case "line":
            default:
                return this.detectRowCutsLine(data, width, height, columns, rowsCount);

        }

    }

    evenRowCuts(height, rowsCount) {

        const cuts = [];

        for (let k = 1; k < rowsCount; k++) {
            cuts.push(Math.round(height * k / rowsCount));
        }

        return cuts;

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
     * Stratégie "line" : détecte les traits horizontaux pleins qui séparent
     * les rangées. Recherche colonne par colonne (un vrai trait de
     * séparation traverse toute la largeur DU BLOC, contrairement à la
     * bordure d'un encart qui a des marges), regroupe les candidats entre
     * colonnes, puis ne garde que ceux immédiatement suivis d'un bandeau de
     * nom de chaîne (forte densité d'encre soutenue) pour écarter les
     * filets purement internes à un bloc.
     */
    detectRowCutsLine(data, width, height, columns, rowsCount) {

        const y0 = Math.round(height * this.topMarginRatio);
        const y1 = height - Math.round(height * this.bottomMarginRatio);

        const candidatesByColumn = columns.map((col, colIndex) => {

            const profile = new Array(height).fill(0);

            for (let y = y0; y < y1; y++) {
                let count = 0;
                const rowOffset = y * width;
                for (let x = col.x; x < col.x + col.width; x++) {
                    if (data[rowOffset + x] < this.inkThreshold) count++;
                }
                profile[y] = count;
            }

            const highThreshold = col.width * this.rowLineRatio;

            return this.findRunsAbove(profile, highThreshold, this.minRowLineWidth, y0, y1)
                .filter(run => run.width <= this.maxRowLineWidth)
                .map(run => ({ mid: (run.start + run.end) / 2, colIndex }));

        });

        const allCandidates = candidatesByColumn.flat();

        const clusters = this.clusterByY(allCandidates, this.rowClusterTolerance);

        for (const cluster of clusters) {
            cluster.columnCoverage = new Set(cluster.members.map(m => m.colIndex)).size;
        }

        // Un vrai séparateur doit apparaître dans (quasi) toutes les
        // colonnes ; on tolère qu'une colonne l'occulte (ex. dernière
        // colonne d'une grille irrégulière qui a moins de rangées).
        const minCoverage = Math.max(1, columns.length - 1);

        const accepted = clusters
            .filter(c => c.columnCoverage >= minCoverage)
            .filter(c => this.bannerDensityAfter(data, width, height, columns, c.mid) >= this.bannerDensityThreshold)
            .map(c => c.mid)
            .sort((a, b) => a - b);

        return this.mergeNearbyPoints(accepted, this.rowLineMergeGap);

    }

    /**
     * Densité d'encre moyenne, sur toutes les colonnes, dans la fenêtre
     * [y, y + bannerWindowHeight) : sert à détecter le bandeau de nom de
     * chaîne (fond coloré, texte gras) qui suit un vrai séparateur de
     * rangée.
     */
    bannerDensityAfter(data, width, height, columns, y) {

        const yStart = Math.round(y) + 3; // saute le trait lui-même
        const yEnd = Math.min(height, yStart + this.bannerWindowHeight);

        let ink = 0;
        let total = 0;

        for (const col of columns) {
            for (let yy = yStart; yy < yEnd; yy++) {
                const rowOffset = yy * width;
                for (let x = col.x; x < col.x + col.width; x++) {
                    total++;
                    if (data[rowOffset + x] < this.inkThreshold) ink++;
                }
            }
        }

        return total > 0 ? ink / total : 0;

    }

    /**
     * Stratégie "whitespace" : pas de trait imprimé, mais un espace blanc
     * entre les rangées. On cherche, dans chaque colonne, les creux à très
     * faible encre, on les regroupe entre colonnes, et on retient les
     * (rowsCount - 1) regroupements les plus représentés (un vrai
     * séparateur de grille doit apparaître dans (quasi) toutes les
     * colonnes), départagés par proximité entre eux pour éviter de retenir
     * deux fois la même frontière.
     */
    detectRowCutsWhitespace(data, width, height, columns, rowsCount) {

        const candidatesByColumn = columns.map((col, colIndex) =>
            this.rowGapsForColumn(data, width, height, col).map(c => ({ mid: (c.start + c.end) / 2, colIndex }))
        );

        const allCandidates = candidatesByColumn.flat();

        const clusters = this.clusterByY(allCandidates, this.rowClusterTolerance);

        for (const cluster of clusters) {
            cluster.columnCoverage = new Set(cluster.members.map(m => m.colIndex)).size;
        }

        const minCoverage = Math.max(1, columns.length - 1);

        const sorted = clusters
            .filter(c => c.columnCoverage >= minCoverage)
            .sort((a, b) => b.columnCoverage - a.columnCoverage || a.mid - b.mid)
            .slice(0, rowsCount - 1)
            .map(c => c.mid)
            .sort((a, b) => a - b);

        return this.mergeNearbyPoints(sorted, this.rowLineMergeGap);

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
     * Regroupe des candidats {mid, ...} dont la position Y est proche
     * (à "tolerance" près) en clusters. Utilisé par les stratégies "line"
     * et "whitespace" pour agréger les candidats détectés indépendamment
     * dans chaque colonne.
     */
    clusterByY(candidates, tolerance) {

        const clusters = [];

        for (const candidate of candidates) {

            let cluster = clusters.find(c => Math.abs(c.mid - candidate.mid) <= tolerance);

            if (!cluster) {
                cluster = { mid: candidate.mid, members: [] };
                clusters.push(cluster);
            }

            cluster.members.push(candidate);
            cluster.mid = cluster.members.reduce((s, m) => s + m.mid, 0) / cluster.members.length;

        }

        return clusters;

    }

    /**
     * Fusionne des points triés proches les uns des autres (ex. plusieurs
     * traits détectés pour un même bandeau à double filet) en un seul,
     * en gardant le premier (le plus haut) de chaque groupe.
     */
    mergeNearbyPoints(points, maxGap) {

        const merged = [];

        for (const point of points) {

            if (merged.length && point - merged[merged.length - 1] <= maxGap) continue;

            merged.push(point);

        }

        return merged;

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

    /**
     * Répartit les coupures manquantes dans les plus grands intervalles
     * restants (repli best-effort quand l'analyse d'image n'a pas trouvé
     * assez de séparateurs fiables).
     */
    fillMissingCuts(cuts, height, rowsCount) {

        const needed = rowsCount - 1;
        const boundaries = [0, ...cuts, height];

        while (boundaries.length - 2 < needed) {

            let bestIndex = 0;
            let bestSize = -1;

            for (let i = 0; i < boundaries.length - 1; i++) {
                const size = boundaries[i + 1] - boundaries[i];
                if (size > bestSize) {
                    bestSize = size;
                    bestIndex = i;
                }
            }

            const mid = Math.round((boundaries[bestIndex] + boundaries[bestIndex + 1]) / 2);

            boundaries.splice(bestIndex + 1, 0, mid);

        }

        return boundaries.slice(1, -1);

    }

    buildRowBands(height, rowsCount, cutYs) {

        if (rowsCount <= 1 || cutYs.length === 0) {
            return [{ y: 0, height }];
        }

        const boundaries = [0, ...cutYs, height];
        const bands = [];

        for (let i = 0; i < boundaries.length - 1; i++) {
            bands.push({ y: boundaries[i], height: boundaries[i + 1] - boundaries[i] });
        }

        return bands;

    }

}
