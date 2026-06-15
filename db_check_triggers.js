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
  
  // query user-defined functions
  const res = await client.query(`
    SELECT routine_name, routine_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
  `);
  console.log("FUNCTIONS & PROCEDURES:", JSON.stringify(res.rows, null, 2));

  await client.end();
}
main().catch(console.error);
