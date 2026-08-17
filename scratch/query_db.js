const { Client } = require('pg');

const client = new Client({
  host: 'db.kredpool.ai',
  port: 5432,
  user: 'postgres',
  password: 'dms@kredpool450',
  database: 'rvgcb_riskanalyser_25_26',
});

async function run() {
  await client.connect();
  
  console.log('Querying assessments for branch 1040 in rvgcb_riskanalyser_25_26:');

  const res = await client.query(`
    SELECT id, assesment_period_from, assesment_period_to, audit_status_id, deposits_scheme_ids
    FROM audit_assesment_master
    WHERE audit_unit_id = 1040 AND deleted_at IS NULL
  `);
  console.log(res.rows);

  await client.end();
}

run().catch(console.error);
