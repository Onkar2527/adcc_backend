const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    console.log('Running migration: ALTER TABLE audit_assesment_master...');
    await pool.query(`
      ALTER TABLE audit_assesment_master 
      ADD COLUMN IF NOT EXISTS risk_rating VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS risk_rating_id INTEGER DEFAULT NULL;
    `);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
