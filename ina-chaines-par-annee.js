#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const annee = process.argv[2];

if (!annee) {
    console.error('Usage : node ina-chaines-par-annee.js <année>');
    process.exit(1);
}

const url = `https://catalogue.ina.fr/docListe/TV-RADIO/?base_label=TVNAT%2CTVSAT&sujets_filter=Sujet&datdif=%5B01%2F01%2F${annee}+TO+31%2F12%2F${annee}%5D&bool_operator=AND&tri=datdif0&nbLignes=50`;

const fichierCSV = 'ina-chaines-par-annee.csv';

async function main() {
    try {
        console.log(`Récupération INA ${annee}...`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const $ = cheerio.load(response.data);

        const resultats = [];

        $('table.table_facettes td').each(function () {

            const html = $(this).html();

            // On ne garde que la colonne Chaîne
            if (html && html.includes("filterQueryByFacet('ch'")) {

                $(this).find('a').each(function () {

                    const texte = $(this).text().trim();

                    // Exemple : France 2 (62457)
                    const match = texte.match(/^(.+?)\s+\(([\d]+)\)$/);

                    if (match) {
                        const chaine = match[1].trim();
                        const nombre = match[2];

                        resultats.push(
                            `${annee};${chaine};${nombre}`
                        );
                    }

                });
            }
        });


        if (resultats.length === 0) {
            console.log('Aucune chaîne trouvée');
            return;
        }


        // Création du fichier avec entête si absent
        if (!fs.existsSync(fichierCSV)) {
            fs.writeFileSync(
                fichierCSV,
                'annee;chaine;nombre\n',
                'utf8'
            );
        }


        fs.appendFileSync(
            fichierCSV,
            resultats.join('\n') + '\n',
            'utf8'
        );


        console.log(`${resultats.length} chaînes ajoutées dans ${fichierCSV}`);

    } catch (err) {
        console.error('Erreur :', err.message);
    }
}

main();