const { Client } = require('pg');

const client = new Client({
  host: '54.160.231.151',
  port: 5432,
  user: 'postgres',
  password: 'dms@kredpool450',
  database: 'auditpro'
});

async function main() {
  await client.connect();
  
  // 1. Get the latest assessments
  const assessRes = await client.query(`
    SELECT id, year_id, audit_unit_id, audit_status_id, assesment_period_from, assesment_period_to
    FROM audit_assesment_master
    WHERE deleted_at IS NULL
    ORDER BY id DESC
    LIMIT 5;
  `);
  console.log("LATEST ASSESSMENTS IN SYSTEM:");
  console.log(JSON.stringify(assessRes.rows, null, 2));

  if (assessRes.rows.length > 0) {
    const targetUnitId = assessRes.rows[0].audit_unit_id;
    console.log(`\nTARGET UNIT ID: ${targetUnitId}`);
    
    // 2. Get unit details
    const unitRes = await client.query(`
      SELECT id, name, section_type_id, frequency, last_audit_date
      FROM audit_unit_master
      WHERE id = $1;
    `, [targetUnitId]);
    console.log("UNIT DETAILS:");
    console.log(JSON.stringify(unitRes.rows, null, 2));
    
    // 3. Get all assessments for this unit
    const unitAssessRes = await client.query(`
      SELECT id, year_id, audit_status_id, assesment_period_from, assesment_period_to
      FROM audit_assesment_master
      WHERE audit_unit_id = $1 AND deleted_at IS NULL
      ORDER BY id DESC;
    `, [targetUnitId]);
    console.log("ALL ASSESSMENTS FOR THIS UNIT:");
    console.log(JSON.stringify(unitAssessRes.rows, null, 2));

    // 4. Get all controls for this unit
    const controlRes = await client.query(`
      SELECT id, year_id, audit_unit_id, start_month_year, end_month_year, 
             (menu_ids IS NOT NULL AND menu_ids != '') as has_menus,
             (cat_ids IS NOT NULL AND cat_ids != '') as has_cats,
             (header_ids IS NOT NULL AND header_ids != '') as has_headers,
             (question_ids IS NOT NULL AND question_ids != '') as has_questions,
             (advances_scheme_ids IS NOT NULL AND advances_scheme_ids != '') as has_advances,
             (deposits_scheme_ids IS NOT NULL AND deposits_scheme_ids != '') as has_deposits
      FROM multi_level_control_master
      WHERE audit_unit_id = $1 AND deleted_at IS NULL;
    `, [targetUnitId]);
    console.log("ALL CONTROLS FOR THIS UNIT:");
    console.log(JSON.stringify(controlRes.rows, null, 2));
  }
  
  await client.end();
}

main().catch(console.error);
