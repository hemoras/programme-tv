const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Normalise une heure INA vers HH:MM:SS
 * Formats acceptés : "10:28:20" ou "10:28"
 */
function normalizeHeure(heure) {
  if (!heure) return null;
  const str = heure.trim();
  if (!str) return null;
  const parts = str.split(':');
  // On ne garde que les 3 premiers segments (HH, MM, SS)
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1] || '0', 10);
  const ss = parseInt(parts[2] || '0', 10);
  if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;
  return [hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Normalise une durée INA vers HH:MM:SS
 * Format INA : "00:36:01:00" (4 segments) → on ignore le dernier → "00:36:01"
 * Formats aussi acceptés : "HH:MM:SS" ou "HH:MM"
 */
function normalizeDuree(duree) {
  if (!duree) return null;
  const str = duree.trim();
  if (!str) return null;
  const parts = str.split(':');
  // Si 4 segments (ex: 00:36:01:00), on ignore le dernier
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1] || '0', 10);
  const ss = parseInt(parts[2] || '0', 10);
  if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;
  return [hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Ajoute une durée (format "HH:MM:SS") à une heure de début (format "HH:MM:SS")
 * Retourne l'heure de fin au format "HH:MM:SS"
 */
function addDuration(heureDebut, duree) {
  const [hD, mD, sD] = heureDebut.split(':').map(Number);
  const [hDur, mDur, sDur] = duree.split(':').map(Number);

  let secondes = sD + sDur;
  let minutes = mD + mDur + Math.floor(secondes / 60);
  let heures = hD + hDur + Math.floor(minutes / 60);

  secondes = secondes % 60;
  minutes = minutes % 60;
  heures = heures % 24;

  return [heures, minutes, secondes].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Extrait l'identifiant depuis une URL INA
 * ex: https://catalogue.ina.fr/doc/TV-RADIO/TV_779674.001/cococinel?rang=1 -> TV_779674.001
 */
function extraireIdentifiant(href) {
  if (!href) return null;
  // Le path est de la forme /doc/TV-RADIO/{identifiant}/{slug}
  const match = href.match(/\/doc\/TV-RADIO\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Détermine Titre et Sous-titre selon les règles INA :
 * - Si Titre collection ET Titre programme vides → Titre = Titre propre, Sous-titre = null
 * - Si Titre collection vide → Titre = Titre programme, Sous-titre = Titre propre
 * - Sinon (tout renseigné) → Titre = Titre collection, Sous-titre = Titre propre
 */
function resoudreTitre(titrePropre, titreCollection, titreProgramme) {
  const tp = (titrePropre || '').trim();
  const tc = (titreCollection || '').trim();
  const tpr = (titreProgramme || '').trim();

  if (!tc && !tpr) {
    return { titre: tp, sousTitre: null };
  }
  if (!tc) {
    return { titre: tpr, sousTitre: tp || null };
  }
  return { titre: tc, sousTitre: tp || null };
}

/**
 * Télécharge et parse la page INA pour une chaîne et une date données.
 * @param {string} nomChaineSource - valeur nom_chaine_source (ex: "TF1")
 * @param {string} nomChaine - valeur nom_chaine (ex: "TF1") pour la colonne Chaine du CSV
 * @param {string} date - format YYYY-MM-DD
 * @returns {Array} lignes CSV prêtes à écrire
 */
async function telechargerINA(nomChaineSource, nomChaine, date) {
  // Convertir date YYYY-MM-DD → DD/MM/YYYY pour l'URL INA
  const [annee, mois, jour] = date.split('-');
  const datdif = `${jour}%2F${mois}%2F${annee}`;

  const url = `https://catalogue.ina.fr/docListe/TV-RADIO/?base_label=TVNAT%2CTVSAT%2CTVREG&sujets_filter=Sujet&ch=${encodeURIComponent(nomChaineSource)}&datdif=${datdif}&bool_operator=AND&tri=score1&nbLignes=500`;

  console.log(`[INA] Téléchargement : ${url}`);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);
  const lignes = [];

  // Le tableau INA : on cherche les lignes <tr> dans le tableau de résultats
  // Colonnes attendues : Chaîne | Date diffusion | Heure diffusion | Durée | Titre propre | Titre collection | Titre programme | Genre
  $('table.dataTableBiblio tbody tr, table.resultat tbody tr, table tbody tr').each((i, row) => {
    const cols = $(row).find('td');
    if (cols.length < 6) return;

    const titrePropre     = $(cols[5]).text().trim();
    const titreCollection = $(cols[6]).text().trim();
    const titreProgramme  = cols.length >= 8 ? $(cols[7]).text().trim() : '';
    const genre           = cols.length >= 9 ? $(cols[8]).text().trim() : '';

    // Ignorer les lignes d'entête
    if (titrePropre === 'Statut de diffusion' || titreCollection.includes('Première diffusion')) return;

    // Résolution titre / sous-titre
    let { titre, sousTitre } = resoudreTitre(titrePropre, titreCollection, titreProgramme);
    
    if (!titre) return;

    // Ignorer les interprogrammes
    if (titre.toLowerCase().includes('interprogrammes')) return;

    // Retirer les crochets éventuels autour du titre
    titre = titre.replace(/^\[(.+)\]$/, '$1').trim();
    sousTitre = sousTitre ? sousTitre.replace(/^\[(.+)\]$/, '$1').trim() : null;
    sousTitre = sousTitre ? sousTitre.replace(/ : \[(.+)\]$/, '').trim() : null;
    if (sousTitre && sousTitre.toLowerCase() == titre.toLowerCase()) {
      sousTitre = null;
    }

    // Heure de diffusion
    const heureRaw = $(cols[3]).text().trim();
    const heureDiffusion = normalizeHeure(heureRaw);
    if (!heureDiffusion) {
      console.warn(`[INA] Heure invalide ignorée (ligne ${i})`);
      return;
    }

    // Durée
    const dureeRaw = $(cols[4]).text().trim();
    const dureeNormalisee = normalizeDuree(dureeRaw);

    // Calcul heure de fin
    const heureFin = dureeNormalisee ? addDuration(heureDiffusion, dureeNormalisee) : '';

    // Lien de la ligne pour extraire l'identifiant
    const lien = $(row).find('a').attr('href') || '';
    const identifiant = extraireIdentifiant(lien);

    const dateFormatee = `${jour}/${mois}/${annee}`;

    // Ligne CSV : Chaine|Date|Heure début|Heure fin|Titre|Sous-titre|Episode|Genre|Identifiant|Synopsis
    lignes.push([
      nomChaine,
      dateFormatee,
      heureDiffusion,
      heureFin,
      titre,
      sousTitre || '',
      '', // Episode
      genre,
      identifiant || '',
      '', // Synopsis
    ].join('|'));
  });

  console.log(`[INA] ${lignes.length} programme(s) trouvé(s)`);
  return lignes;
}

module.exports = { telechargerINA };