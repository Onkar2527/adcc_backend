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
  
  const res = await client.query(`
    SELECT id, answer_id, answer_given, audit_comment, audit_status_id, audit_commpliance, business_risk, control_risk, risk_cat_id 
    FROM answers_data_annexure 
    WHERE assesment_id = 197 
    LIMIT 10;
  `);
  console.log("Annexure rows for assessment 197:", JSON.stringify(res.rows, null, 2));

  await client.end();
}
main().catch(console.error);
