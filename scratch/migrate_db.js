const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'db.kredpool.ai',
  port: 5432,
  database: 'ducb_riskanalyser_25_26',
  user: 'postgres',
  password: 'dms@kredpool450',
});

async function run() {
  try {
    console.log('1. Backing up exe_summary table...');
    const backupRes = await pool.query('SELECT * FROM exe_summary');
    const backupPath = path.join(__dirname, 'exe_summary_backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupRes.rows, null, 2), 'utf8');
    console.log(`Backup saved successfully to: ${backupPath} (${backupRes.rows.length} rows)`);

    console.log('\n2. Starting migration transaction...');
    await pool.query('BEGIN');

    console.log('Altering exe_summary.gl_type_id column type to VARCHAR(50)...');
    await pool.query('ALTER TABLE exe_summary ALTER COLUMN gl_type_id TYPE VARCHAR(50)');

    console.log('Updating existing rows to map scheme IDs to scheme codes...');
    const updateRes = await pool.query(`
      UPDATE exe_summary es
      SET gl_type_id = sm.scheme_code
      FROM scheme_master sm
      WHERE es.gl_type_id::text = sm.id::text
    `);
    console.log(`Successfully migrated ${updateRes.rowCount} rows.`);

    console.log('Committing transaction...');
    await pool.query('COMMIT');
    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Migration failed. Rolling back...', err);
    try {
      await pool.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
