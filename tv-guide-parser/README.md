# TV Guide Parser

Extraction automatique des programmes TV à partir des scans Télé 7 Jours.

## Installation

```bash
npm install
```

## Utilisation

```bash
npm start chemin/vers/2001-06-01-Page5.jpg
```

Traiter toutes les pages d'une année (nécessite `PAGES_DIR` dans `.env`, voir `.env.example`) :

```bash
npm start -- --year 2001
npm start -- --year 2001 --from 2001-06-05 --to 2001-12-31
```

## Index des pages PDF par jour

Pour chaque PDF de numéro complet de Télé 7 Jours (nécessite `PDF_DIR` dans
`.env`, voir `.env.example`), repère le numéro de la première page de
programme de chacun des 7 jours (samedi à vendredi) et les enregistre dans
`pdf-index/<année>.csv` :

```bash
npm run index-pdf -- 2001
```

Le repérage se fait par OCR du bandeau/onglet coloré en haut de chaque page
(voir `src/pdf/DayBannerDetector.js`) ; le traitement d'un PDF prend environ
1 à 2 minutes.

## Version

0.1.0