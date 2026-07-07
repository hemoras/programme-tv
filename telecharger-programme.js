#!/usr/bin/env node
'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const db   = require('./db');
const { telechargerINA } = require('./sources/ina');

// ─── Paramètres CLI ─────────────────────────────────────────────────────────

const [,, codeSource, urlChaine, dateParam] = process.argv;

if (!codeSource || !urlChaine || !dateParam) {
  console.error('Usage : node telecharger-programme.js <code_source> <url_chaine> <date YYYY-MM-DD>');
  process.exit(1);
}


// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Récupère en base les infos nécessaires pour une chaîne / source donnée :
 * - chaine.nom_chaine
 * - chaine_source.nom_chaine_source
 * - chaine.id_chaine
 */
async function getInfosChaine(codeSource, urlChaine) {
  const [rows] = await db.query(
    `SELECT c.id_chaine, c.nom_chaine, cs.nom_chaine_source
     FROM chaine c
     JOIN chaine_source cs ON cs.id_chaine = c.id_chaine
     WHERE c.url_chaine = ? AND cs.code_source = ?`,
    [urlChaine, codeSource]
  );

  if (!rows.length) {
    throw new Error(`Aucune correspondance trouvée pour url_chaine="${urlChaine}" et code_source="${codeSource}"`);
  }
  return rows[0];
}

/**
 * Écrit le fichier texte CSV dans le bon dossier.
 * Chemin : $CHEMIN_PROGRAMMES_TXT/<CODE_SOURCE>/<date>/<url_chaine>.txt
 */
function ecrireFichier(codeSource, dateParam, urlChaine, lignes) {
  const base = process.env.CHEMIN_PROGRAMMES_TXT;
  if (!base) throw new Error('Variable d\'environnement CHEMIN_PROGRAMMES_TXT non définie');

  const dossier = path.join(base, codeSource.toUpperCase(), dateParam.replace(/^([0-9]{4}).+/g, '$1'), dateParam);
  fs.mkdirSync(dossier, { recursive: true });

  const fichier = path.join(dossier, `${urlChaine}.txt`);

  const entete = 'Chaine|Date|Heure début|Heure fin|Titre|Sous-titre|Episode|Genre|Identifiant|Synopsis';
  const contenu = [entete, ...lignes].join('\n');

  fs.writeFileSync(fichier, contenu, 'utf8');
  console.log(`[OK] Fichier écrit : ${fichier} (${lignes.length} ligne(s))`);
  return fichier;
}

// ─── Dispatch par source ─────────────────────────────────────────────────────

async function telecharger(codeSource, urlChaine, date) {
  const infos = await getInfosChaine(codeSource, urlChaine);
  console.log(`[INFO] Chaîne : ${infos.nom_chaine} | Source : ${codeSource} (${infos.nom_chaine_source})`);

  let lignes;

  switch (codeSource.toLowerCase()) {
    case 'ina':
      lignes = await telechargerINA(infos.nom_chaine_source, infos.nom_chaine, date);
      break;

    // Ajouter ici les autres sources :
    // case 'xmltv':
    //   lignes = await telechargerXMLTV(infos, date);
    //   break;

    default:
      throw new Error(`Source inconnue : "${codeSource}". Sources supportées : ina`);
  }

  if (!lignes.length) {
    console.warn('[WARN] Aucun programme récupéré, fichier non créé.');
    return;
  }

  ecrireFichier(codeSource, date, urlChaine, lignes);

  // Insertion dans programme_jour
  await db.query(
    `INSERT INTO programme_jour (code_source, id_chaine, jour, nb_programmes, present_en_bdd)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE nb_programmes = VALUES(nb_programmes), present_en_bdd = 0`,
    [codeSource.toUpperCase(), infos.id_chaine, date, lignes.length]
  );
  console.log(`[OK] programme_jour inséré : ${lignes.length} programme(s) pour ${date}`);
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

(async () => {
  try {
    let dateDebut = dateParam;
    let dateFin   = dateParam;
    if(dateParam.match(/^\d{4}-\d{2}-\d{2}->\d{4}-\d{2}-\d{2}$/)) {
      dateDebut = dateParam.split('->')[0];
      dateFin   = dateParam.split('->')[1];
    }
    if (dateParam >= 1950 && dateParam <= 2050) {
      // Si dateParam est une année, on télécharge toutes les dates de l'année
      dateDebut = `${dateParam}-01-01`;
      dateFin   = `${dateParam}-12-31`;
    }
    const dateDebutObj = new Date(dateDebut);
    const dateFinObj   = new Date(dateFin);
    for (let date = dateDebutObj; date <= dateFinObj; date.setDate(date.getDate() + 1)) {      
      console.log(`[INFO] Date : ${date.toISOString().split('T')[0]}`);
      await telecharger(codeSource, urlChaine, date.toISOString().split('T')[0]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  
  } catch (err) {
    console.error('[ERREUR]', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
})();
