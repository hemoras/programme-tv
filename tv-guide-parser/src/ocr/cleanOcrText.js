/**
 * Nettoie le texte brut issu de l'OCR.
 *
 * Retire notamment les codes ShowView : des numéros de 6 à 9 chiffres
 * imprimés en fin de synopsis (ex. "5455352", "500008524"), qui servaient à
 * programmer un magnétoscope et n'ont aucune valeur pour l'extraction des
 * programmes.
 *
 * Note : les pictogrammes de notation (ex. les icônes "▶▶▶") mal
 * reconnus par l'OCR (rendus en texte sous des formes variables et peu
 * prévisibles : "77", "# ##", "riï"...) ne sont volontairement pas traités
 * ici — un filtrage fiable demande plus de contexte positionnel et sera
 * mieux géré à l'étape de parsing des programmes.
 */
export default function cleanOcrText(text) {

    return text
        .split("\n")
        .map(line => line
            .replace(/\b\d{6,9}\b/g, "")
            .replace(/[ \t]{2,}/g, " ")
            .replace(/[ \t]+$/g, "")
        )
        .join("\n")
        .trim();

}
