const { Pool } = require('pg');
require('dotenv').config();
const https = require('https');

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
      console.error("Marathi language code 'mr' not found.");
      return;
    }
    const marathiLangId = langRes.rows[0].id;

    // 2. Fetch all audit type names
    const typesRes = await pool.query("SELECT DISTINCT name FROM audit_type_master WHERE deleted_at IS NULL");
    const names = typesRes.rows.map(r => r.name.trim()).filter(Boolean);

    console.log(`Found ${names.length} audit types to translate:`, names);

    // 3. Translate and save
    for (const name of names) {
      const checkRes = await pool.query(
        "SELECT translated_text FROM label_master WHERE english_text = $1 AND language_id = $2",
        [name, marathiLangId]
      );

      if (checkRes.rows.length > 0) {
        console.log(`[Already Translated] "${name}" -> "${checkRes.rows[0].translated_text}"`);
        continue;
      }

      try {
        const translated = await translateText(name);
        if (translated && translated !== name) {
          await pool.query(
            `INSERT INTO label_master (english_text, language_id, translated_text) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (english_text, language_id) DO UPDATE SET translated_text = EXCLUDED.translated_text`,
            [name, marathiLangId, translated]
          );
          console.log(`[Translated & Saved] "${name}" -> "${translated}"`);
        }
      } catch (err) {
        console.error(`Failed to translate "${name}":`, err.message);
      }
    }

    console.log("Audit types translation completed!");
  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    pool.end();
  }
}

run();
