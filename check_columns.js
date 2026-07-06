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

  console.log('--- Columns in scheme_master ---');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'scheme_master';
  `);
  console.log(cols.rows.map(r => `${r.column_name}: ${r.data_type}`).join('\n'));

  await client.end();
}

main().catch(console.error);
