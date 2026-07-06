const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT id, menu_ids, cat_ids, header_ids, question_ids
      FROM audit_assesment_master 
      ORDER BY id DESC LIMIT 1
    `);
    const overview = res.rows[0];
    console.log("Overview: ", overview);

    const query = `
      SELECT
          mm.id AS menu_id,
          mm.name AS menu_name,
          cm.id AS category_id,
          cm.name AS category_name,
          cm.linked_table_id,
          COUNT(DISTINCT qm.id) AS question_count,
          COUNT(DISTINCT ans.id) AS answered_count,
          COUNT(DISTINCT ans.id) FILTER (
              WHERE ans.is_compliance = 1
                  AND COALESCE(ans.compliance_status_id, 0) = 10
          ) AS live_pending_count
      FROM menu_master mm
      LEFT JOIN category_master cm
          ON cm.menu_id = mm.id
          AND cm.is_active = 1
          AND cm.deleted_at IS NULL
          AND ( $2 = '' OR cm.id::text = ANY(string_to_array($2, ',')) )
      LEFT JOIN question_set_master qsm
          ON qsm.id::text = ANY(string_to_array(COALESCE(cm.question_set_ids, ''), ','))
          AND qsm.is_active = 1
          AND qsm.deleted_at IS NULL
      LEFT JOIN question_header_master qhm
          ON qhm.question_set_id = qsm.id
          AND qhm.is_active = 1
          AND qhm.deleted_at IS NULL
          AND ( $3 = '' OR qhm.id::text = ANY(string_to_array($3, ',')) )
      LEFT JOIN question_master qm
          ON qm.header_id = qhm.id
          AND qm.set_id = qsm.id
          AND qm.is_active = 1
          AND qm.deleted_at IS NULL
          AND ( $4 = '' OR qm.id::text = ANY(string_to_array($4, ',')) )
      LEFT JOIN answers_data ans
          ON ans.assesment_id = $5
          AND ans.category_id = cm.id
          AND ans.question_id = qm.id
          AND ans.deleted_at IS NULL
      WHERE
          mm.is_active = 1
          AND mm.deleted_at IS NULL
          AND ( $1 = '' OR mm.id::text = ANY(string_to_array($1, ',')) )
      GROUP BY
          mm.id, mm.name, cm.id, cm.name, cm.linked_table_id
      ORDER BY
          mm.id, cm.id
    `;
    const res2 = await pool.query(query, [
      overview.menu_ids || '',
      overview.cat_ids || '',
      overview.header_ids || '',
      overview.question_ids || '',
      overview.id
    ]);
    console.log("Menu Query Rows: ", res2.rows.length);
    console.log("Menu Query Results: ", res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
