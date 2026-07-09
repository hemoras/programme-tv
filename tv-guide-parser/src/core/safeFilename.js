/**
 * Nettoie un nom (ex. nom de chaîne) pour en faire un nom de fichier valide
 * sous Windows/Linux, en conservant les lettres accentuées (é, è, ô...).
 */
export default function safeFilename(name) {

    return name
        .replace(/\s+/g, "_")
        .replace(/[\\/:*?"<>|]+/g, "_");

}
