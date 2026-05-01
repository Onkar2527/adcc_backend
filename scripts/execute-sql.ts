import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: ts-node execute-sql.ts <path-to-sql-file>');
    process.exit(1);
  }

  const sqlPath = path.resolve(sqlFile);
  if (!fs.existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Executing SQL from ${sqlFile}...`);

  try {
    const result = await pool.query(sql);
    console.log('SQL executed successfully.');
    // console.log(result);
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await pool.end();
  }
}

run();
