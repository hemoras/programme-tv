export default class Page {

    constructor(date, pageNumber, imagePath) {

        // ============================
        // Informations générales
        // ============================

        this.date = date;
        this.pageNumber = pageNumber;
        this.imagePath = imagePath;

        // ============================
        // Configuration
        // ============================

        this.layout = null;

        // ============================
        // Image
        // ============================

        this.image = null;

        // ============================
        // Détection
        // ============================

        this.blocks = [];

        this.channels = [];

        // ============================
        // Résultats OCR
        // ============================

        this.programs = [];

        // ============================
        // Debug
        // ============================

        this.debug = {

            images: [],
            messages: []

        };

        // ============================
        // Statistiques
        // ============================

        this.statistics = {

            detectedBlocks: 0,
            detectedChannels: 0,
            detectedPrograms: 0

        };

    }

}