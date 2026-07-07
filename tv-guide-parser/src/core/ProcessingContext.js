export default class ProcessingContext {

    constructor() {

        this.version = "0.1.0";

        // Configuration de la période
        this.config = null;

        // Page en cours de traitement
        this.page = null;

        // Mode debug
        this.debug = false;

        // Statistiques globales
        this.statistics = {};

        // Temps d'exécution des étapes
        this.timings = {};

    }

}