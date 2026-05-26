const fs = require('fs');
const { Client } = require('pg');

function readEnv() {
  return Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function main() {
  const env = readEnv();

  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const before = await client.query(`
    SELECT id, year, length(year) AS length
    FROM year_master
    ORDER BY id;
  `);

  console.log('Rows before normalization:', before.rows);

  await client.query(`
    ALTER TABLE year_master
    ALTER COLUMN year TYPE varchar(4)
    USING substring(trim(year) from 1 for 4);
  `);

  const result = await client.query(`
    UPDATE year_master
    SET year = substring(trim(year) from 1 for 4),
        updated_at = CURRENT_TIMESTAMP
    WHERE year IS NOT NULL
    RETURNING id, year, length(year) AS length;
  `);

  console.log('Rows normalized:', result.rows);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
