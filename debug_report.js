const { Pool } = require('pg');

const pool = new Pool({
  host: '54.160.231.151',
  port: 5432,
  user: 'postgres',
  password: 'dms@kredpool450',
  database: 'auditpro',
  ssl: false
});

async function run() {
  try {
    const assessmentId = 333;
    const auditUnitId = 1001;

    // Step 1: Fetch assessment
    const assessmentResult = await pool.query(
      `
      SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency, menu_ids, cat_ids, question_ids
      FROM audit_assesment_master
      WHERE id = $1
        AND audit_unit_id = $2
        AND deleted_at IS NULL
      `,
      [assessmentId, auditUnitId]
    );

    if (!assessmentResult.rows.length) {
      console.log('No assessment found');
      return;
    }

    const assessment = assessmentResult.rows[0];
    const firstYearId = Number(assessment.year_id || 0);
    console.log('Assessment found:', assessment.id, 'Menu IDs:', assessment.menu_ids);

    // Step 2: Fetch all deposits/advances for this assessment
    const [depositsAll, advancesAll] = await Promise.all([
      pool.query(
        `SELECT id, account_no, account_holder_name FROM dump_deposits WHERE assesment_period_id = $1 AND deleted_at IS NULL`,
        [assessment.id]
      ),
      pool.query(
        `SELECT id, account_no, account_holder_name FROM dump_advances WHERE assesment_period_id = $1 AND deleted_at IS NULL`,
        [assessment.id]
      )
    ]);

    const depositsMap = new Map();
    depositsAll.rows.forEach((row) => {
      depositsMap.set(Number(row.id), {
        account_no: String(row.account_no || '').trim(),
        account_holder_name: String(row.account_holder_name || '').trim(),
      });
    });

    const advancesMap = new Map();
    advancesAll.rows.forEach((row) => {
      advancesMap.set(Number(row.id), {
        account_no: String(row.account_no || '').trim(),
        account_holder_name: String(row.account_holder_name || '').trim(),
      });
    });

    console.log('Total deposits:', depositsMap.size, 'Total advances:', advancesMap.size);

    // Step 3: Fetch deposits/advances sampling accounts mapped to scheme categories
    const [depositsSampling, advancesSampling] = await Promise.all([
      pool.query(
        `
        SELECT 
          dt.id, 
          dt.account_no, 
          dt.account_holder_name, 
          COALESCE(sm.category_id, 0)::int AS cat_id
        FROM dump_deposits dt
        LEFT JOIN scheme_master sm ON dt.scheme_id = sm.id
        WHERE dt.assesment_period_id = $1
          AND dt.sampling_filter = 1
          AND dt.deleted_at IS NULL
          AND sm.deleted_at IS NULL
        `,
        [assessment.id]
      ),
      pool.query(
        `
        SELECT 
          dt.id, 
          dt.account_no, 
          dt.account_holder_name, 
          COALESCE(sm.category_id, 0)::int AS cat_id
        FROM dump_advances dt
        LEFT JOIN scheme_master sm ON dt.scheme_id = sm.id
        WHERE dt.assesment_period_id = $1
          AND dt.sampling_filter = 1
          AND dt.deleted_at IS NULL
          AND sm.deleted_at IS NULL
        `,
        [assessment.id]
      )
    ]);

    const categoryAccountsMap = new Map();
    depositsSampling.rows.forEach((row) => {
      const catId = Number(row.cat_id);
      if (catId) {
        if (!categoryAccountsMap.has(catId)) {
          categoryAccountsMap.set(catId, []);
        }
        categoryAccountsMap.get(catId).push(row);
      }
    });
    advancesSampling.rows.forEach((row) => {
      const catId = Number(row.cat_id);
      if (catId) {
        if (!categoryAccountsMap.has(catId)) {
          categoryAccountsMap.set(catId, []);
        }
        categoryAccountsMap.get(catId).push(row);
      }
    });

    console.log('Category accounts mapped:', categoryAccountsMap.size);

    // Step 4: Fetch Menus
    const menuIds = String(assessment.menu_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    const menusResult = menuIds.length ? await pool.query(
      `
      SELECT id, name
      FROM menu_master
      WHERE id = ANY($1::int[])
        AND is_active = 1
        AND deleted_at IS NULL
      `,
      [menuIds]
    ) : { rows: [] };

    const menusMap = new Map();
    menusResult.rows.forEach((row) => {
      menusMap.set(Number(row.id), String(row.name || '').trim());
    });

    console.log('Menus mapped:', menusMap.size);

    // Step 5: Fetch Risk Category Weights
    const riskCategoriesResult = await pool.query(
      `
      SELECT
        rcm.id,
        rcm.risk_category AS title,
        COALESCE(rcw.risk_weight, 0) AS risk_weight
      FROM risk_category_master rcm
      LEFT JOIN risk_category_weights rcw
        ON rcw.risk_category_id = rcm.id
        AND rcw.year_id = $1
        AND rcw.is_active = 1
        AND rcw.deleted_at IS NULL
      WHERE rcm.is_active = 1
        AND rcm.deleted_at IS NULL
      ORDER BY rcm.id ASC
      `,
      [firstYearId]
    );

    const riskCategoriesMap = new Map();
    riskCategoriesResult.rows.forEach((row) => {
      riskCategoriesMap.set(Number(row.id), {
        title: String(row.title || '').trim(),
        weight: Number(row.risk_weight || 0),
      });
    });

    console.log('Risk categories mapped:', riskCategoriesMap.size);

    // Step 6: Fetch Risk Matrix
    const riskMatrixResult = await pool.query(
      `
      SELECT risk_parameter, business_risk_score, control_risk_score
      FROM risk_matrix
      WHERE year_id = $1
        AND deleted_at IS NULL
      `,
      [firstYearId]
    );

    const businessRiskScores = new Map();
    const controlRiskScores = new Map();
    riskMatrixResult.rows.forEach((row) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk, controlRisk) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);
      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }
      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    // Step 7: Fetch Category Master records
    const catIds = String(assessment.cat_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    const categoriesResult = catIds.length ? await pool.query(
      `
      SELECT id, menu_id, name, linked_table_id, question_set_ids
      FROM category_master
      WHERE id = ANY($1::int[])
        AND is_active = 1
        AND deleted_at IS NULL
      `,
      [catIds]
    ) : { rows: [] };

    console.log('Categories loaded:', categoriesResult.rows.length);

    // Step 8: Fetch Question Master records
    const questionIds = String(assessment.question_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    const questionsResult = questionIds.length ? await pool.query(
      `
      SELECT id, set_id, parameters, risk_category_id, question, option_id, annexure_id, subset_multi_id
      FROM question_master
      WHERE id = ANY($1::int[])
        AND is_active = 1
        AND deleted_at IS NULL
      `,
      [questionIds]
    ) : { rows: [] };

    console.log('Questions loaded:', questionsResult.rows.length);

    const questionHighestRiskMap = new Map();
    questionsResult.rows.forEach((qRow) => {
      const qId = Number(qRow.id);
      const optionId = Number(qRow.option_id);
      let highestRisk = 0;

      if (optionId !== 3 && qRow.parameters) {
        try {
          const params = JSON.parse(qRow.parameters);
          if (Array.isArray(params)) {
            params.forEach((param) => {
              const score = matrixScore(param.br, param.cr);
              if (score > highestRisk) {
                highestRisk = score;
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
      questionHighestRiskMap.set(qId, highestRisk);
    });

    // Step 9: Fetch Answers and Annexures
    const answersResult = await pool.query(
      `
      SELECT
        id,
        menu_id,
        category_id,
        dump_id,
        question_id,
        answer_given,
        audit_comment,
        business_risk,
        control_risk
      FROM answers_data
      WHERE assesment_id = $1
        AND deleted_at IS NULL
      `,
      [assessment.id]
    );

    console.log('Answers loaded:', answersResult.rows.length);

    const answersMap = new Map();
    answersResult.rows.forEach((row) => {
      const key = `${row.menu_id}_${row.category_id}_${row.dump_id}_${row.question_id}`;
      answersMap.set(key, row);
    });

    const answerIds = answersResult.rows.map((row) => Number(row.id));
    const annexuresResult = answerIds.length ? await pool.query(
      `
      SELECT
        answer_id,
        business_risk,
        control_risk,
        risk_cat_id AS risk_category_id
      FROM answers_data_annexure
      WHERE answer_id = ANY($1::int[])
        AND assesment_id = $2
        AND deleted_at IS NULL
      `,
      [answerIds, assessment.id]
    ) : { rows: [] };

    console.log('Annexures loaded:', annexuresResult.rows.length);

    const annexuresMap = new Map();
    annexuresResult.rows.forEach((annRow) => {
      const answerId = Number(annRow.answer_id);
      if (!annexuresMap.has(answerId)) {
        annexuresMap.set(answerId, []);
      }
      annexuresMap.get(answerId).push(annRow);
    });

    // Step 10: Build nested report tree
    const menuWiseMap = new Map();

    categoriesResult.rows.forEach((catRow) => {
      const menuId = Number(catRow.menu_id);
      const catId = Number(catRow.id);
      const linkedTableId = Number(catRow.linked_table_id);

      if (!menuWiseMap.has(menuId)) {
        menuWiseMap.set(menuId, {
          menu_name: menusMap.get(menuId) || 'UNKNOWN MENU',
          risk_category_wise: new Map(),
        });
      }

      const menuNode = menuWiseMap.get(menuId);

      let dumpIds = [0];
      if (linkedTableId === 1 || linkedTableId === 2) {
        const accounts = categoryAccountsMap.get(catId) || [];
        dumpIds = accounts.map((acc) => Number(acc.id));
      }

      const catSetIds = String(catRow.question_set_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));

      const catQuestions = questionsResult.rows.filter((qRow) => {
        const qSetId = Number(qRow.set_id);
        return catSetIds.includes(qSetId);
      });

      catQuestions.forEach((qRow) => {
        const questionId = Number(qRow.id);
        const riskCatId = Number(qRow.risk_category_id || 0);

        if (!riskCategoriesMap.has(riskCatId)) {
          return;
        }

        const riskCategoryMaster = riskCategoriesMap.get(riskCatId);

        if (!menuNode.risk_category_wise.has(riskCatId)) {
          menuNode.risk_category_wise.set(riskCatId, {
            risk_category_master: {
              risk_category: riskCategoryMaster.title,
              risk_weightage: riskCategoryMaster.weight,
            },
            questions: [],
          });
        }

        const riskNode = menuNode.risk_category_wise.get(riskCatId);

        dumpIds.forEach((dumpId) => {
          const genKey = `${menuId}_${catId}_${dumpId}_${questionId}`;
          const ansRow = answersMap.get(genKey);

          let answerGiven = ansRow ? String(ansRow.answer_given || '').trim() : '';
          let auditComment = ansRow ? String(ansRow.audit_comment || '').trim() : '';
          let riskScore = 0;

          if (ansRow) {
            riskScore = matrixScore(ansRow.business_risk, ansRow.control_risk);
          }

          const annexData = ansRow ? (annexuresMap.get(Number(ansRow.id)) || []) : [];
          if (annexData.length > 0) {
            answerGiven = 'AS PER ANNEXURE';
          }

          if (answerGiven.toUpperCase() === 'NOT APPLICABLE') {
            riskScore = 0;
          }

          let annexWeighted = 0;
          const annexDetails = [];
          annexData.forEach((aRow) => {
            const annexRiskId = Number(aRow.risk_category_id || 0);
            const annexRiskWeight = riskCategoriesMap.get(annexRiskId)?.weight || 0;
            const aRiskScore = matrixScore(aRow.business_risk, aRow.control_risk);
            const weighted = aRiskScore * annexRiskWeight;
            annexWeighted += weighted;
            annexDetails.push({
              risk_score_weighted: weighted,
            });
          });

          const highestWeightageQuestionRisk = questionHighestRiskMap.get(questionId) || 0;
          const rowMaxScore = (highestWeightageQuestionRisk * riskCategoryMaster.weight) + annexWeighted;

          let accountNo = '';
          let accountHolderName = '';
          if (linkedTableId === 1 && depositsMap.has(dumpId)) {
            accountNo = depositsMap.get(dumpId).account_no;
            accountHolderName = depositsMap.get(dumpId).account_holder_name;
          } else if (linkedTableId === 2 && advancesMap.has(dumpId)) {
            accountNo = advancesMap.get(dumpId).account_no;
            accountHolderName = advancesMap.get(dumpId).account_holder_name;
          }

          riskNode.questions.push({
            category_name: String(catRow.name || '').trim(),
            linked_table_id: linkedTableId,
            account_id: dumpId,
            account_no: accountNo,
            account_holder_name: accountHolderName,
            question: String(qRow.question || '').trim(),
            answer_given: answerGiven,
            audit_comment: auditComment,
            risk_score: riskScore,
            weighted_risk_score: riskScore * riskCategoryMaster.weight,
            highest_weightage_risk: rowMaxScore,
            annex_details: annexDetails,
          });
        });
      });
    });

    const menuWiseList = [];
    Array.from(menuWiseMap.keys()).sort((a, b) => Number(a) - Number(b)).forEach((mId) => {
      const menuNode = menuWiseMap.get(mId);
      const riskCategoryWiseList = [];
      Array.from(menuNode.risk_category_wise.keys()).sort((a, b) => Number(a) - Number(b)).forEach((rcId) => {
        const riskNode = menuNode.risk_category_wise.get(rcId);
        if (riskNode.questions.length > 0) {
          riskCategoryWiseList.push({
            risk_category_id: rcId,
            ...riskNode,
          });
        }
      });
      if (riskCategoryWiseList.length > 0) {
        menuWiseList.push({
          menu_id: mId,
          menu_name: menuNode.menu_name,
          risk_category_wise: riskCategoryWiseList,
        });
      }
    });

    console.log('Resulting menuWiseList count:', menuWiseList.length);
    if (menuWiseList.length > 0) {
      console.log('First menu name:', menuWiseList[0].menu_name);
      console.log('Risk categories count in first menu:', menuWiseList[0].risk_category_wise.length);
      if (menuWiseList[0].risk_category_wise.length > 0) {
        console.log('Questions count in first risk category:', menuWiseList[0].risk_category_wise[0].questions.length);
      }
    }
  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    await pool.end();
  }
}

run();
