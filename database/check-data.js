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
    // 1. Get assessment counts by status
    const statusCounts = await pool.query(`
      SELECT audit_status_id, COUNT(*) AS count 
      FROM audit_assesment_master 
      WHERE deleted_at IS NULL
      GROUP BY audit_status_id
      ORDER BY audit_status_id
    `);
    console.log('--- Assessment Counts by Status ---');
    console.log(statusCounts.rows);

    // 2. Get some completed assessments (status > 3)
    const completedAssessments = await pool.query(`
      SELECT id, year_id, audit_unit_id, audit_status_id, risk_rating, risk_rating_id
      FROM audit_assesment_master 
      WHERE audit_status_id > 3 AND deleted_at IS NULL
      LIMIT 10
    `);
    console.log('\n--- Completed Assessments (Status > 3) ---');
    console.log(completedAssessments.rows);

    // 3. Get entries in report_scoring_master
    const scoringEntries = await pool.query(`
      SELECT id, assesment_id, year, weighted_score, deleted_at
      FROM report_scoring_master
      LIMIT 10
    `);
    console.log('\n--- Entries in report_scoring_master ---');
    console.log(scoringEntries.rows);

  } catch (err) {
    console.error('Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
