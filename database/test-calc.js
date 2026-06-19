const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function parseDateUTC(dateVal) {
  if (dateVal instanceof Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(dateVal);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
  }
  const str = String(dateVal);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  return new Date(str);
}

function formatDateUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function run() {
  try {
    const units = await pool.query(`
      SELECT id, name, last_audit_date, frequency
      FROM audit_unit_master
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY id
    `);
    
    for (const unit of units.rows) {
      const lastAuditDate = unit.last_audit_date;
      if (!lastAuditDate) continue;
      const lastAudit = parseDateUTC(lastAuditDate);
      const fromDate = new Date(lastAudit);
      fromDate.setUTCDate(fromDate.getUTCDate() + 1);
      const assessmentPeriodFrom = formatDateUTC(fromDate);

      console.log(`Branch: ${unit.name} (Freq: ${unit.frequency || 12}M)`);
      console.log(`  Last Audit End: ${formatDateUTC(lastAudit)}`);
      console.log(`  Assessment Start: ${assessmentPeriodFrom}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
