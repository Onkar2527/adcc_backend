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

    const res = await client.query("SELECT id, name, emp_code, password, is_active FROM employee_master WHERE name ILIKE '%PRABHU%'");
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
