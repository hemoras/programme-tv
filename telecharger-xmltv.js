#!/usr/bin/env node

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// ── Configuration ────────────────────────────────────────────────────────────

const URL_SOURCE = "https://xmltvfr.fr/xmltv/xmltv.zip";
const TAILLE_MIN_OCTETS = 5 * 1024 * 1024; // 5 Mo

const DESTINATAIRES = ["hemoras@hotmail.com", "charles.tasserit@gmail.com"];

const SMTP = {
  host: "smtp.gmail.com", // ← à adapter
  port: 587,
  secure: false,
  auth: {
    user: "charles.tasserit@gmail.com", // ← à adapter
    pass: "ejvwgjlrxwtxegih",     // ← à adapter
  },
  tls: { rejectUnauthorized: false }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateAujourdhui() {
  return new Date().toISOString().slice(0, 10); // "2026-06-24"
}

function nomFichierDestination() {
  return path.join(__dirname, 'archives', `${dateAujourdhui()}.zip`);
}

async function envoyerEmail(sujet, corps) {
  const transporter = nodemailer.createTransport(SMTP);
  await transporter.sendMail({
    from: SMTP.auth.user,
    to: DESTINATAIRES.join(", "),
    subject: sujet,
    text: corps,
  });
  console.log(`📧 Email envoyé à : ${DESTINATAIRES.join(", ")}`);
}

function telecharger(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;

    const req = client.get(url, (res) => {
      // Suivi des redirections (301/302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`↪  Redirection → ${res.headers.location}`);
        return telecharger(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject({ type: "http", code: res.statusCode });
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    req.on("error", (err) => reject({ type: "reseau", message: err.message }));
    req.setTimeout(60_000, () => {
      req.destroy();
      reject({ type: "timeout" });
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const destination = nomFichierDestination();
  console.log(`⬇  Téléchargement de ${URL_SOURCE}`);

  let contenu;

  try {
    contenu = await telecharger(URL_SOURCE);
  } catch (err) {
    let detail;
    if (err.type === "http") {
      detail = `Le serveur a répondu avec le code HTTP ${err.code}.`;
    } else if (err.type === "timeout") {
      detail = "La requête a expiré (timeout > 60 s).";
    } else if (err.type === "reseau") {
      detail = `Erreur réseau : ${err.message}`;
    } else {
      detail = String(err);
    }

    console.error(`❌ Échec du téléchargement — ${detail}`);

    await envoyerEmail(
      "[XMLTV] Échec du téléchargement",
      `Bonjour,\n\nLe téléchargement du fichier XMLTV a échoué le ${dateAujourdhui()}.\n\nDétail : ${detail}\nURL : ${URL_SOURCE}\n\nCordialement.`
    );
    process.exit(1);
  }

  const tailleMo = (contenu.length / 1024 / 1024).toFixed(2);
  console.log(`📦 Taille reçue : ${tailleMo} Mo`);

  if (contenu.length < TAILLE_MIN_OCTETS) {
    console.error(`❌ Fichier trop petit (${tailleMo} Mo < 5 Mo)`);

    await envoyerEmail(
      "[XMLTV] Fichier suspect — taille insuffisante",
      `Bonjour,\n\nLe fichier XMLTV téléchargé le ${dateAujourdhui()} est anormalement petit.\n\nTaille reçue : ${tailleMo} Mo (minimum attendu : 5 Mo)\nURL : ${URL_SOURCE}\n\nCordialement.`
    );
    process.exit(1);
  }

  fs.writeFileSync(destination, contenu);
  console.log(`✅ Fichier enregistré : ${destination}`);
})();