const { Pool } = require('pg');
const pool = new Pool({ host: '54.160.231.151', port: 5432, user: 'postgres', password: 'dms@kredpool450', database: 'auditpro', ssl: false });

async function run() {
  try {
    const asmt = await pool.query(`SELECT cat_ids FROM audit_assesment_master WHERE id = 287`);
    const catIds = String(asmt.rows[0].cat_ids || '').split(',').map(id => Number(id.trim())).filter(Boolean);

    // New query — same as fixed backend
    const menusResult = await pool.query(`
      SELECT DISTINCT mm.id, mm.name
      FROM menu_master mm
      INNER JOIN category_master cm ON cm.menu_id = mm.id
      WHERE cm.id = ANY($1::int[])
        AND mm.is_active = 1
        AND mm.deleted_at IS NULL
      ORDER BY mm.id
    `, [catIds]);

    console.log(`✅ Menus fetched with NEW query (${menusResult.rows.length} total):`);
    menusResult.rows.forEach(m => console.log(`  id=${m.id}  name="${m.name}"`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
