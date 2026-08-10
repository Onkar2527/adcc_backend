const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.kredpool.ai',
  port: 5432,
  database: 'ducb_riskanalyser_25_26',
  user: 'postgres',
  password: 'dms@kredpool450',
});

async function run() {
  try {
    const backupPath = path.join(__dirname, 'exe_summary_backup.json');
    if (!fs.existsSync(backupPath)) {
      console.error('Backup not found!');
      return;
    }
    const backupRows = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const currentRes = await pool.query('SELECT id, gl_type_id, march_position, audit_unit_id FROM exe_summary');
    const currentRows = new Map(currentRes.rows.map(r => [r.id, r]));

    console.log(`Original rows in backup: ${backupRows.length}`);
    console.log(`Current rows in DB: ${currentRes.rows.length}`);

    let changed = 0;
    const mismatches = [];

    backupRows.forEach(backupRow => {
      const dbRow = currentRows.get(backupRow.id);
      if (!dbRow) {
        console.log(`Row ID ${backupRow.id} (Original gl_type_id: ${backupRow.gl_type_id}) was DELETED!`);
        return;
      }

      if (String(backupRow.gl_type_id) !== String(dbRow.gl_type_id)) {
        changed++;
        mismatches.push({
          id: backupRow.id,
          original: backupRow.gl_type_id,
          current: dbRow.gl_type_id,
          audit_unit_id: backupRow.audit_unit_id
        });
      }
    });

    console.log(`Total rows whose gl_type_id changed: ${changed}`);
    console.log('Sample changed rows (first 30):');
    console.log(mismatches.slice(0, 30));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
