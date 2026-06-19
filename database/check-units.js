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
    const res = await pool.query(`
      SELECT id, name, audit_unit_code, last_audit_date, frequency
      FROM audit_unit_master
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY id
    `);
    console.log('--- Active Audit Units ---');
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
