export default class Program {

    constructor() {

        this.channel = null;

        this.startTime = "";

        this.title = "";

        this.subtitle = "";

        this.genre = "";

        // Texte OCR ayant servi à créer le programme
        this.rawText = "";

        // Score de confiance
        this.confidence = 1.0;

    }

}