const { Client } = require('pg');

const client = new Client({
  host: '54.160.231.151',
  port: 5432,
  user: 'postgres',
  password: 'dms@kredpool450',
  database: 'auditpro'
});

// Use CASE WHEN to safely cast is_compliance - handles 'complete', '', NULL, '1', '0' etc.
const SAFE_IS_COMPLIANCE = `CASE WHEN ans.is_compliance::text ~ '^[0-9]+$' THEN ans.is_compliance::text::int ELSE 0 END`;

async function main() {
  await client.connect();

  // Fetch all assessments
  const assessRes = await client.query(`
    SELECT id, year_id, audit_unit_id
    FROM audit_assesment_master
    WHERE deleted_at IS NULL
    ORDER BY id;
  `);

  console.log(`Total assessments: ${assessRes.rows.length}\n`);

  for (const ass of assessRes.rows) {
    const targetAssId = Number(ass.id);
    const yearId = Number(ass.year_id);

    // Fetch risk matrix for this year
    const riskMatrixResult = await client.query(
      `SELECT risk_parameter, business_risk_score::float, control_risk_score::float 
       FROM risk_matrix 
       WHERE year_id = $1 AND deleted_at IS NULL`,
      [yearId]
    );
    const businessRiskScores = new Map();
    const controlRiskScores = new Map();
    riskMatrixResult.rows.forEach(m => {
      const p = Number(m.risk_parameter);
      businessRiskScores.set(p, Number(m.business_risk_score || 0));
      controlRiskScores.set(p, Number(m.control_risk_score || 0));
    });

    const getMatrixScore = (br, cr) => {
      const bRisk = Number(br);
      const cRisk = Number(cr);
      if (!bRisk || !cRisk || bRisk < 1 || bRisk > 4 || cRisk < 1 || cRisk > 4) return 0;
      return (businessRiskScores.get(bRisk) || 0) + (controlRiskScores.get(cRisk) || 0);
    };

    // Score WITH compliance filter - using safe CASE WHEN cast
    const heatResWithComp = await client.query(
      `SELECT business_risk, control_risk, COUNT(*)::int AS count
       FROM (
         SELECT 
           NULLIF(ans.business_risk::text, '')::int AS business_risk, 
           NULLIF(ans.control_risk::text, '')::int AS control_risk
         FROM answers_data ans
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ans.assesment_id = $1
           AND qm.option_id != 4
           AND NULLIF(ans.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ans.control_risk::text, '')::int IN (1, 2, 3)
           AND CASE WHEN ans.is_compliance::text ~ '^[0-9]+$' THEN ans.is_compliance::text::int ELSE 0 END = 1
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL

         UNION ALL

         SELECT 
           NULLIF(ax.business_risk::text, '')::int AS business_risk, 
           NULLIF(ax.control_risk::text, '')::int AS control_risk
         FROM answers_data_annexure ax
         INNER JOIN answers_data ans ON ans.id = ax.answer_id
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ax.assesment_id = $1
           AND qm.option_id = 4
           AND NULLIF(ax.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ax.control_risk::text, '')::int IN (1, 2, 3)
           AND ax.audit_commpliance = '1'
           AND ax.deleted_at IS NULL
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL
       ) combined
       GROUP BY business_risk, control_risk`,
      [targetAssId]
    );

    let scoreWithComp = 0;
    heatResWithComp.rows.forEach(r => {
      scoreWithComp += r.count * getMatrixScore(r.business_risk, r.control_risk);
    });

    // Score WITHOUT compliance filter
    const heatResNoComp = await client.query(
      `SELECT business_risk, control_risk, COUNT(*)::int AS count
       FROM (
         SELECT 
           NULLIF(ans.business_risk::text, '')::int AS business_risk, 
           NULLIF(ans.control_risk::text, '')::int AS control_risk
         FROM answers_data ans
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ans.assesment_id = $1
           AND qm.option_id != 4
           AND NULLIF(ans.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ans.control_risk::text, '')::int IN (1, 2, 3)
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL

         UNION ALL

         SELECT 
           NULLIF(ax.business_risk::text, '')::int AS business_risk, 
           NULLIF(ax.control_risk::text, '')::int AS control_risk
         FROM answers_data_annexure ax
         INNER JOIN answers_data ans ON ans.id = ax.answer_id
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ax.assesment_id = $1
           AND qm.option_id = 4
           AND NULLIF(ax.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ax.control_risk::text, '')::int IN (1, 2, 3)
           AND ax.deleted_at IS NULL
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL
       ) combined
       GROUP BY business_risk, control_risk`,
      [targetAssId]
    );

    let scoreNoComp = 0;
    heatResNoComp.rows.forEach(r => {
      scoreNoComp += r.count * getMatrixScore(r.business_risk, r.control_risk);
    });

    // Get report_scoring_master weighted_score
    const rsm = await client.query(
      `SELECT weighted_score FROM report_scoring_master WHERE assesment_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [targetAssId]
    );
    const weighted = rsm.rows[0]?.weighted_score != null ? Number(rsm.rows[0].weighted_score) : 'N/A';

    // Print all results
    console.log(`AssID: ${targetAssId} | Unit: ${ass.audit_unit_id} | Year: ${yearId} | ScoreWithComp: ${scoreWithComp} | ScoreNoComp: ${scoreNoComp} | Weighted: ${weighted}`);
  }

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  client.end();
});
