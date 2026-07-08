const { Pool } = require('pg');
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function translateText(text) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const translated = parsed[0].map(item => item[0]).join('');
          resolve(translated.trim());
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    // 1. Get Marathi language ID
    const langRes = await pool.query("SELECT id FROM language_master WHERE code = 'mr'");
    if (langRes.rows.length === 0) {
      console.error("Marathi language code 'mr' not found in language_master.");
      return;
    }
    const marathiLangId = langRes.rows[0].id;

    // 2. Read reports.service.ts
    const filePath = path.join(__dirname, 'src/modules/reports/reports.service.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    // 3. Extract all static label: '...' values
    const regex = /label:\s*['"]([^'"]+)['"]/g;
    const labels = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
      const labelText = match[1].trim();
      if (labelText && labelText.length > 1 && !/^[0-9\s,.\-():/|%&+$?_]+$/.test(labelText)) {
        labels.add(labelText);
      }
    }

    // Add common filter words and other options that might be in reports
    labels.add('Select Branch');
    labels.add('Select Financial Year');
    labels.add('Select Audit Status');
    labels.add('Select Compliance Status');
    labels.add('Select Audit Type');
    labels.add('Select Month');
    labels.add('Select Department');
    labels.add('All Years');
    labels.add('All Branches');
    labels.add('All Head Of Departments');
    labels.add('All Audit Types');
    labels.add('All Audit');
    labels.add('All Compliance');
    labels.add('All Statuses');
    labels.add('Active');
    labels.add('Review Pending');
    labels.add('Re-Audit Needed');
    labels.add('Re-Compliance Needed');
    labels.add('Completed');
    labels.add('Blocked');
    labels.add('Expired');
    labels.add('High Risk');
    labels.add('Medium Risk');
    labels.add('Low Risk');
    labels.add('All Departments');

    console.log(`Found/Added ${labels.size} static labels to verify for translation.`);

    // 4. Translate and save
    for (const label of labels) {
      const checkRes = await pool.query(
        "SELECT translated_text FROM label_master WHERE english_text = $1 AND language_id = $2",
        [label, marathiLangId]
      );

      if (checkRes.rows.length > 0) {
        console.log(`[Already Translated] "${label}" -> "${checkRes.rows[0].translated_text}"`);
        continue;
      }

      try {
        const translated = await translateText(label);
        if (translated && translated !== label) {
          await pool.query(
            `INSERT INTO label_master (english_text, language_id, translated_text) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (english_text, language_id) DO UPDATE SET translated_text = EXCLUDED.translated_text`,
            [label, marathiLangId, translated]
          );
          console.log(`[Translated & Saved] "${label}" -> "${translated}"`);
        }
      } catch (err) {
        console.error(`Failed to translate "${label}":`, err.message);
      }
    }

    console.log("Report label translation sync completed!");
  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    pool.end();
  }
}

run();
