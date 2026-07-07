/**
 * generate-csv-from-local.js
 *
 * Lit les pages HTML de C:\Users\hemor\Downloads\csat (déjà téléchargées
 * manuellement) et génère un CSV : annee,mois,categorie,canal,chaine,logo
 *
 * Nom de fichier attendu : "NomDuMois_Annee.htm" (ex: Août_2019.htm)
 *
 * Usage :
 *   npm install cheerio
 *   node generate-csv-from-local.js
 *
 * Options via variables d'env :
 *   INPUT_DIR=C:\Users\hemor\Downloads\csat
 *   OUTPUT_FILE=./chaines_csat.csv
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const INPUT_DIR = process.env.INPUT_DIR || 'C:\\Users\\hemor\\Downloads\\csat';
const OUTPUT_FILE = process.env.OUTPUT_FILE || './chaines_csat.csv';

const MONTHS = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12'
};

function normalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function csvEscape(value) {
  const v = (value === null || value === undefined) ? '' : String(value);
  if (/[",\n;]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Construit une grille de cellules en résolvant rowspan/colspan,
 * pour pouvoir indexer grid[rowIndex][colIndex] même sur des lignes
 * dont certaines colonnes sont "héritées" d'une ligne précédente.
 */
function buildGrid($, table) {
  const rows = $(table).find('> tbody > tr, > tr').toArray();
  const grid = [];

  rows.forEach((tr, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let colIndex = 0;
    $(tr).find('> th, > td').each((_, cell) => {
      while (grid[rowIndex][colIndex] !== undefined) colIndex++;
      const rowspan = parseInt($(cell).attr('rowspan'), 10) || 1;
      const colspan = parseInt($(cell).attr('colspan'), 10) || 1;
      const cellInfo = { el: cell, isHeader: cell.tagName.toLowerCase() === 'th' };
      for (let r = 0; r < rowspan; r++) {
        if (!grid[rowIndex + r]) grid[rowIndex + r] = [];
        for (let c = 0; c < colspan; c++) {
          grid[rowIndex + r][colIndex + c] = cellInfo;
        }
      }
      colIndex += colspan;
    });
  });

  return grid;
}

function cellText($, cellInfo) {
  if (!cellInfo) return '';
  return $(cellInfo.el).text().replace(/\s+/g, ' ').trim();
}

function cellLogoUrl($, cellInfo) {
  if (!cellInfo) return '';
  const $cell = $(cellInfo.el);
  // priorité au lien vers l'image en pleine résolution
  const href = $cell.find('a.image').attr('href');
  if (href) return href;
  const src = $cell.find('img').attr('src');
  return src || '';
}

/**
 * Parse une page mensuelle et retourne un tableau de lignes
 * { categorie, canal, chaine, logo }
 */
function parseMonthPage(html) {
  const $ = cheerio.load(html);
  let container = $('.mw-parser-output');
  if (container.length === 0) container = $('body'); // fallback si la page enregistrée a une structure différente
  const results = [];
  let currentCategory = null;

  container.children().each((_, node) => {
    const $node = $(node);
    const tag = node.tagName ? node.tagName.toLowerCase() : '';

    if (tag === 'h3' || tag === 'h2') {
      const headline = $node.find('.mw-headline').first().text().trim() || $node.text().trim();
      if (headline) currentCategory = headline;
      return;
    }

    if (tag === 'table' && $node.hasClass('wikitable')) {
      const grid = buildGrid($, node);
      if (grid.length < 2) return;

      const headerRow = grid[0];
      const colIndex = { canal: -1, chaine: -1, logo: -1 };
      headerRow.forEach((cellInfo, idx) => {
        if (!cellInfo) return;
        const text = normalize(cellText($, cellInfo));
        if (colIndex.canal === -1 && text.includes('canal') && !text.includes('logo')) colIndex.canal = idx;
        if (colIndex.chaine === -1 && (text.includes('chaine') || text.includes('nom'))) colIndex.chaine = idx;
        if (colIndex.logo === -1 && text.includes('logo')) colIndex.logo = idx;
      });

      // fallback si en-têtes non détectés : positions habituelles observées
      if (colIndex.canal === -1) colIndex.canal = 0;
      if (colIndex.logo === -1) colIndex.logo = 2;
      if (colIndex.chaine === -1) colIndex.chaine = 3;

      for (let r = 1; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        const canalCell = row[colIndex.canal];
        const chaineCell = row[colIndex.chaine];
        const logoCell = row[colIndex.logo];

        // ignorer les lignes vides / lignes d'en-tête répétées
        if (!chaineCell || chaineCell.isHeader) continue;
        const chaine = cellText($, chaineCell);
        if (!chaine) continue;

        results.push({
          categorie: currentCategory || '',
          canal: cellText($, canalCell),
          chaine,
          logo: cellLogoUrl($, logoCell)
        });
      }
    }
  });

  return results;
}

/**
 * Extrait { year, month } à partir d'un nom de fichier du type
 * "Août_2019.htm" ou "16_Juillet_2024.htm"
 */
function parseFilename(filename) {
  const base = filename.replace(/\.html?$/i, '');
  const m = base.match(/([A-Za-zÀ-ÿ]+)_(\d{4})/);
  if (!m) return null;
  const monthKey = normalize(m[1]);
  const month = MONTHS[monthKey];
  if (!month) return null;
  return { year: parseInt(m[2], 10), month };
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Dossier introuvable : ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => /\.html?$/i.test(f));
  console.log(`${files.length} fichiers .htm trouvés dans ${INPUT_DIR}`);

  const out = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
  out.write('annee,mois,categorie,canal,chaine,logo\n');

  let ok = 0;
  const skipped = [];

  files.forEach((filename, i) => {
    const info = parseFilename(filename);
    if (!info) {
      skipped.push({ filename, reason: 'nom de fichier non reconnu' });
      return;
    }

    const fullPath = path.join(INPUT_DIR, filename);
    let html;
    try {
      html = fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
      skipped.push({ filename, reason: err.message });
      return;
    }

    const rows = parseMonthPage(html);
    rows.forEach((row) => {
      out.write([
        info.year,
        info.month,
        csvEscape(row.categorie),
        csvEscape(row.canal),
        csvEscape(row.chaine),
        csvEscape(row.logo)
      ].join(',') + '\n');
    });

    console.log(`[${i + 1}/${files.length}] ${filename} -> ${rows.length} chaînes`);
    ok++;
  });

  out.end();

  console.log(`\nTerminé. ${ok}/${files.length} fichiers traités.`);
  if (skipped.length) {
    console.log(`${skipped.length} fichier(s) ignoré(s) :`);
    skipped.forEach((s) => console.log(`  - ${s.filename} : ${s.reason}`));
  }
  console.log(`CSV écrit dans : ${OUTPUT_FILE}`);
}

main();