const { Client } = require('pg');
require('dotenv').config({ path: 'f:/KP/AuditPro/audit_backend/.env' });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to DB!');

    // 1. Fetch overview/assessment
    const aamRes = await client.query('SELECT * FROM audit_assesment_master WHERE id = 285');
    const overview = aamRes.rows[0];
    console.log('Overview id:', overview.id);

    // 2. Fetch category
    const catRes = await client.query('SELECT * FROM category_master WHERE id = 52');
    const category = catRes.rows[0];

    const linkedTableId = Number(category.linked_table_id);
    const table = linkedTableId === 1 ? 'dump_deposits' : 'dump_advances';
    const schemeIds = linkedTableId === 1 ? overview.deposits_scheme_ids : overview.advances_scheme_ids;
    const periodCondition = linkedTableId === 1
      ? 'd.account_opening_date BETWEEN $4 AND $5'
      : '(d.account_opening_date BETWEEN $4 AND $5 OR d.renewal_date BETWEEN $4 AND $5)';

    const amountColumn = linkedTableId === 1 ? 'd.principal_amount' : 'd.sanction_amount';
    const amountAlias = linkedTableId === 1 ? 'principal_amount' : 'sanction_amount';
    const renewalColumn = linkedTableId === 1 ? 'NULL::date AS renewal_date' : 'd.renewal_date';
    const npaSelect = linkedTableId === 1 ? 'NULL::text AS npa_classification' : 'd.npa_classification';

    const query = `
      SELECT
          d.id,
          d.account_no,
          d.account_holder_name,
          d.ucic,
          d.account_opening_date,
          d.account_status,
          d.assesment_period_id,
          ${renewalColumn},
          ${amountColumn} AS ${amountAlias},
          ${npaSelect},
          d.kyc,
          sm.name AS scheme_name,
          sm.scheme_code,
          CASE
              WHEN d.assesment_period_id = $1 THEN true
              ELSE false
          END AS is_completed
      FROM ${table} d
      INNER JOIN scheme_master sm
          ON sm.id = d.scheme_id
          AND sm.scheme_type_id = $2
          AND sm.category_id = $3
          AND sm.is_active = 1
          AND sm.deleted_at IS NULL
      WHERE d.branch_id = $6
          AND d.scheme_id::text = ANY(
              string_to_array($7, ',')
          )
          AND ${periodCondition}
          AND d.sampling_filter = 1
          AND d.deleted_at IS NULL
      ORDER BY d.account_no;
    `;

    const result = await client.query(query, [
      overview.id,
      linkedTableId,
      category.id,
      overview.assesment_period_from,
      overview.assesment_period_to,
      overview.audit_unit_id,
      String(schemeIds),
    ]);

    console.log('Result count:', result.rows.length);
    console.log('Sample row:', result.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
