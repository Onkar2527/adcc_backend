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
    SELECT id, answer_id, audit_evidance_upload, compliance_evidance_upload 
    FROM answers_data_timeline 
    WHERE (audit_evidance_upload IS NOT NULL AND audit_evidance_upload != '') 
       OR (compliance_evidance_upload IS NOT NULL AND compliance_evidance_upload != '')
    LIMIT 5;
  `);
  console.log("TIMELINE ROWS WITH EVIDENCE:", JSON.stringify(res.rows, null, 2));

  await client.end();
}
main().catch(console.error);
