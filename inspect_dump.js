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

  console.log('--- Unique category_id from scheme_master ---');
  const res = await client.query('SELECT category_id, COUNT(*) FROM scheme_master GROUP BY category_id ORDER BY category_id');
  console.log(res.rows);

  await client.end();
}

main().catch(console.error);
