export default class Block {

    constructor(config = {}) {

        // Type de bloc
        this.type = config.type ?? "channel";

        // Nom attendu (configuration)
        this.name = config.name ?? "";

        // Nombre de rangées consécutives occupées par ce bloc dans sa
        // colonne (ex. Pathé Sport sur Page4/2001, cf. "rowSpan" dans
        // config/periods/*.json et DetectBlocksStep.assignBounds()).
        this.rowSpan = config.rowSpan ?? 1;

        // Coordonnées dans l'image
        this.bounds = null;

        // Image découpée correspondant au bloc
        this.image = null;

        // Score de confiance (détection)
        this.confidence = 1.0;

        // Texte OCR brut (pour debug)
        this.text = "";

        // Programmes extraits
        this.programs = [];

        // Métadonnées libres
        this.metadata = {};

    }

}
