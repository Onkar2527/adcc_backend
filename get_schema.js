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
  const res = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE '%bank%' OR table_name LIKE '%bank%'");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
