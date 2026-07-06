const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '54.160.231.151',
    port: 5432,
    user: 'postgres',
    password: 'dms@kredpool450',
    database: 'auditpro',
    ssl: false,
  });

  await client.connect();

  console.log('--- 1. Querying assessments for April and May 2024 ---');
  const assesmentRes = await client.query(`
    SELECT aam.id, aam.year_id, aam.audit_unit_id, aum.name as branch_name, aam.assesment_period_from, aam.assesment_period_to, aam.audit_status_id
    FROM audit_assesment_master aam
    LEFT JOIN audit_unit_master aum ON aum.id = aam.audit_unit_id
    WHERE aam.assesment_period_to >= '2024-04-01' AND aam.assesment_period_to <= '2024-05-31' AND aam.deleted_at IS NULL
    ORDER BY aam.id DESC;
  `);
  console.log('Assessments on 2024-04-28:', assesmentRes.rows.map(r => ({
    id: r.id,
    year_id: r.year_id,
    branch: r.branch_name,
    from: r.assesment_period_from,
    to: r.assesment_period_to,
    status: r.audit_status_id
  })));

  if (assesmentRes.rows.length === 0) {
    console.log('No assessments found ending on 2024-04-28');
    await client.end();
    return;
  }

  for (const r of assesmentRes.rows) {
    const assessmentId = r.id;
    const yearId = r.year_id;
    console.log(`\n================ ASSESSMENT ID: ${assessmentId} (Branch: ${r.branch_name}) ================`);

    console.log(`--- Querying executive_summary_fresh_accounts (no year_id filter) ---`);
    const freshRes = await client.query(`
      SELECT id, type_id, accounts, year_id, deleted_at
      FROM executive_summary_fresh_accounts
      WHERE assesment_id = $1 AND deleted_at IS NULL;
    `, [assessmentId]);
    console.log('Fresh Accounts Rows:', freshRes.rows);

    console.log(`--- Querying executive_summary_branch_position (no year_id filter) ---`);
    const branchRes = await client.query(`
      SELECT id, type_id, amount, year_id, deleted_at
      FROM executive_summary_branch_position
      WHERE assesment_id = $1 AND deleted_at IS NULL;
    `, [assessmentId]);
    console.log('Branch Position Rows:', branchRes.rows);

    console.log(`--- Dynamic schemes from dump_deposits and dump_advances ---`);
    const schemesRes = await client.query(`
      SELECT
          scheme_type,
          scheme_code,
          scheme_name,
          category_id
      FROM (
          SELECT
              'DEPOSITS' AS scheme_type,
              sm.scheme_code,
              sm.name AS scheme_name,
              CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END AS category_id
          FROM dump_deposits dd
          INNER JOIN audit_assesment_master aam
              ON aam.id = $1
          LEFT JOIN scheme_master sm
              ON sm.id = dd.scheme_id
          WHERE
              dd.branch_id = aam.audit_unit_id
              AND dd.account_opening_date BETWEEN aam.assesment_period_from AND aam.assesment_period_to
              AND dd.deleted_at IS NULL
          GROUP BY
              sm.scheme_code,
              sm.name,
              sm.category_id
          UNION ALL
          SELECT
              'ADVANCES' AS scheme_type,
              sm.scheme_code,
              sm.name AS scheme_name,
              CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END AS category_id
          FROM dump_advances da
          INNER JOIN audit_assesment_master aam
              ON aam.id = $2
          LEFT JOIN scheme_master sm
              ON sm.id = da.scheme_id
          WHERE
              da.branch_id = aam.audit_unit_id
              AND da.account_opening_date BETWEEN aam.assesment_period_from AND aam.assesment_period_to
              AND da.deleted_at IS NULL
          GROUP BY
              sm.scheme_code,
              sm.name,
              sm.category_id
      ) x
      GROUP BY
          scheme_type,
          scheme_code,
          scheme_name,
          category_id
      ORDER BY
          scheme_type,
          scheme_code;
    `, [assessmentId, assessmentId]);
    console.log('Dynamic Schemes:', schemesRes.rows);
  }

  await client.end();
}

main().catch(console.error);

