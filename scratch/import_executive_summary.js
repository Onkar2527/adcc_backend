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

// Simple CSV parser
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((h, index) => {
      row[h] = values[index];
    });
    data.push(row);
  }
  return data;
}

async function run() {
  const csvFilePath = 'C:\\Users\\Flowenol\\Downloads\\executive_summary_sample.csv';
  
  try {
    console.log(`1. Reading CSV file from: ${csvFilePath}...`);
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found at path: ${csvFilePath}`);
    }
    const content = fs.readFileSync(csvFilePath, 'utf8');
    const rows = parseCSV(content);
    console.log(`Parsed ${rows.length} rows from CSV.`);

    console.log('\n2. Fetching branch and scheme metadata from database...');
    const unitsRes = await pool.query('SELECT id, audit_unit_code, name FROM audit_unit_master WHERE deleted_at IS NULL');
    const schemesRes = await pool.query('SELECT scheme_code FROM scheme_master WHERE deleted_at IS NULL');

    const unitMap = new Map();
    unitsRes.rows.forEach(u => {
      unitMap.set(String(u.audit_unit_code).trim(), Number(u.id));
    });

    const validSchemes = new Set(
      schemesRes.rows.map(s => String(s.scheme_code).trim().toLowerCase())
    );

    console.log(`Found ${unitMap.size} active branches and ${validSchemes.size} active schemes in database.`);

    console.log('\n3. Validating CSV rows...');
    const verifiedRows = [];
    const errors = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      const unitCode = String(row.audit_unit_code || '').trim();
      const glCode = String(row.gl_code || '').trim();
      const marchPos = String(row.march_position || '').trim();

      if (!unitCode) {
        errors.push(`Row ${rowNum}: audit_unit_code is missing`);
        return;
      }
      if (!glCode) {
        errors.push(`Row ${rowNum}: gl_code is missing`);
        return;
      }
      if (marchPos === '' || isNaN(Number(marchPos))) {
        errors.push(`Row ${rowNum}: march_position '${marchPos}' is invalid/not a number`);
        return;
      }

      const branchId = unitMap.get(unitCode);
      if (!branchId) {
        errors.push(`Row ${rowNum}: Branch code '${unitCode}' not found in audit_unit_master`);
        return;
      }

      // Verify the base scheme exists in scheme_master (e.g. strip '_NPA')
      const baseSchemeCode = glCode.replace(/_NPA$/i, '').trim().toLowerCase();
      if (!validSchemes.has(baseSchemeCode)) {
        errors.push(`Row ${rowNum}: Mapped scheme code '${baseSchemeCode}' (from '${glCode}') not found in scheme_master`);
        return;
      }

      verifiedRows.push({
        branchId,
        glCode,
        marchPos,
        rowNum
      });
    });

    if (errors.length > 0) {
      console.error('\nValidation errors found:');
      errors.forEach(e => console.error(` - ${e}`));
      throw new Error('Validation failed. Please correct the CSV errors.');
    }

    console.log(`Validation successful. Verified ${verifiedRows.length} rows.`);

    console.log('\n4. Starting data import transaction...');
    await pool.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const r of verifiedRows) {
      // Check if entry already exists
      const checkRes = await pool.query(
        'SELECT id FROM exe_summary WHERE year_id = 1 AND audit_unit_id = $1 AND gl_type_id = $2 AND deleted_at IS NULL',
        [r.branchId, r.glCode]
      );

      if (checkRes.rows.length > 0) {
        // Update existing row
        await pool.query(
          'UPDATE exe_summary SET march_position = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [r.marchPos, checkRes.rows[0].id]
        );
        updated++;
      } else {
        // Insert new row
        await pool.query(
          `INSERT INTO exe_summary (
            year_id, audit_unit_id, gl_type_id, march_position,
            m_4, m_5, m_6, m_7, m_8, m_9, m_10, m_11, m_12, m_1, m_2, m_3,
            admin_id, created_at, updated_at
          ) VALUES (
            1, $1, $2, $3,
            '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0',
            1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [r.branchId, r.glCode, r.marchPos]
        );
        inserted++;
      }
    }

    console.log(`Commiting transaction (Inserted: ${inserted}, Updated: ${updated})...`);
    await pool.query('COMMIT');
    console.log('Import completed successfully!');

  } catch (err) {
    console.error('\nImport failed. Transaction rolled back:', err.message);
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
