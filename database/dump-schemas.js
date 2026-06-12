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
    const rsmCol = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'report_scoring_master'
      ORDER BY ordinal_position
    `);
    console.log('--- report_scoring_master ---');
    console.log(JSON.stringify(rsmCol.rows, null, 2));

    const rbrCol = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'risk_branch_rating'
      ORDER BY ordinal_position
    `);
    console.log('--- risk_branch_rating ---');
    console.log(JSON.stringify(rbrCol.rows, null, 2));

  } catch (err) {
    console.error('Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
