import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';

const AUDITOR_STATUS_IDS = [1, 3];

const STATUS_LABELS: Record<number, string> = {
  1: 'AUDIT (PENDING / ACTIVE)',
  2: 'REVIEW (PENDING / ACTIVE)',
  3: 'RE AUDIT (PENDING / ACTIVE)',
  4: 'COMPLIANCE (PENDING / ACTIVE)',
  5: 'REVIEW (PENDING / ACTIVE)',
  6: 'RE COMPLIANCE (PENDING / ACTIVE)',
  7: 'ASSESMENT COMPLETED',
};

@Injectable()
export class InternalAuditService {
  constructor(
    private readonly db:
      DatabaseService,
  ) { }

  async getAuditUnitDashboard(
    auditUnitId: number,
    employeeId: number,
  ) {

    await this.assertAuthority(
      auditUnitId,
      employeeId,
    );

    const unitResult =
      await this.db.query(
        `
SELECT
    au.id,
    au.audit_unit_code,
    au.name,
    au.section_type_id,
    au.frequency,
    au.last_audit_date,
    asm.name AS section_type_name
FROM audit_unit_master au
LEFT JOIN audit_section_master asm
    ON asm.id = au.section_type_id
WHERE au.id = $1
    AND au.is_active = 1
    AND au.deleted_at IS NULL
LIMIT 1;
        `,
        [auditUnitId],
      );

    if (
      !unitResult.rows.length
    ) {

      throw new NotFoundException(
        'Audit unit not found',
      );
    }

    const yearsResult =
      await this.db.query(
        `
SELECT id, year
FROM year_master
WHERE deleted_at IS NULL
ORDER BY id DESC;
        `,
      );

    const latestYearId =
      yearsResult.rows[0]?.id || null;

    const assessmentResult =
      await this.db.query(
        `
SELECT
    id,
    year_id,
    audit_unit_id,
    frequency,
    audit_status_id,
    assesment_period_from,
    assesment_period_to,
    audit_due_date,
    compliance_due_date,
    is_limit_blocked,
    compliance_onhold_count
FROM audit_assesment_master
WHERE audit_unit_id = $1
    AND deleted_at IS NULL
ORDER BY year_id DESC, id ASC;
        `,
        [auditUnitId],
      );

    const assessmentMap =
      new Map<number, any[]>();

    for (
      const assessment
      of assessmentResult.rows
    ) {

      const yearRows =
        assessmentMap.get(
          Number(
            assessment.year_id,
          ),
        )
        || [];

      yearRows.push(
        this.decorateAssessmentAction(
          assessment,
        ),
      );

      assessmentMap.set(
        Number(
          assessment.year_id,
        ),
        yearRows,
      );
    }

    const years =
      yearsResult.rows.map(
        (year: any) => {

          const assessments =
            assessmentMap.get(
              Number(year.id),
            )
            || [];

          return {
            ...year,
            is_latest:
              Number(year.id)
              ===
              Number(latestYearId),
            pending_assessment:
              assessments.some(
                (assessment: any) =>
                  Number(
                    assessment.audit_status_id,
                  ) <= 3,
              ),
            assessments,
            can_start:
              Number(year.id)
              ===
              Number(latestYearId)
              &&
              !assessments.some(
                (assessment: any) =>
                  Number(
                    assessment.audit_status_id,
                  ) <= 3,
              )
              &&
              !assessments.some(
                (assessment: any) =>
                  this.formatDbDate(
                    assessment.assesment_period_to,
                  )
                  ===
                  `${this.getFinancialYearStart(year.year) + 1}-03-31`,
              ),
          };
        },
      );

    return {
      audit_unit:
        unitResult.rows[0],
      years,
      metrics:
        this.getAssessmentMetrics(
          assessmentResult.rows,
        ),
    };
  }

  formatDate(
    date: Date,
  ) {

    return date
      .toISOString()
      .split('T')[0];
  }

  async getStartAssessmentPreview(
    auditUnitId: number,
    yearId: number,
    employeeId: number,
  ) {

    await this.assertAuthority(
      auditUnitId,
      employeeId,
    );

    const unit =
      await this.db.findOne(
        `
        SELECT
            id,
            audit_unit_code,
            name,
            section_type_id,
            frequency,
            branch_head_id,
            branch_subhead_id,
            multi_compliance_ids,
            last_audit_date
        FROM audit_unit_master
        WHERE id = $1
            AND is_active = 1
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [auditUnitId],
      );

    const year =
      await this.db.findOne(
        `
        SELECT id, year
        FROM year_master
        WHERE id = $1
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [yearId],
      );

    if (
      !unit
      ||
      !year
    ) {

      throw new NotFoundException(
        'Audit unit or financial year not found',
      );
    }

    const fyStartYear =
      this.getFinancialYearStart(
        year.year,
      );

    const fyStart =
      `${fyStartYear}-04-01`;

    const fyEnd =
      `${fyStartYear + 1}-03-31`;

    const existingResult =
      await this.db.query(
        `
        SELECT
            id,
            frequency,
            audit_status_id,
            assesment_period_to
        FROM audit_assesment_master
        WHERE year_id = $1
            AND audit_unit_id = $2
            AND assesment_period_from >= $3
            AND assesment_period_to <= $4
            AND deleted_at IS NULL
        ORDER BY id ASC;
        `,
        [
          yearId,
          auditUnitId,
          fyStart,
          fyEnd,
        ],
      );

    let fyRemainMonths = 12;
    let pendingAssessment = false;

    for (
      const assessment
      of existingResult.rows
    ) {

      if (
        Number(
          assessment.audit_status_id,
        )
        === 1
      ) {

        pendingAssessment = true;
      }

      if (
        this.formatDbDate(
          assessment.assesment_period_to,
        )
        === fyEnd
      ) {

        fyRemainMonths = 0;
      }

      if (
        fyRemainMonths > 0
      ) {

        fyRemainMonths -=
          Number(
            assessment.frequency || 0,
          );
      }
    }

    const assessmentStartDate =
      this.formatDate(
        this.firstDayOfNextMonth(
          new Date(
            unit.last_audit_date,
          ),
        ),
      );

    const assessmentEndDate =
      this.formatDate(
        this.lastDayAfterMonths(
          new Date(
            assessmentStartDate,
          ),
          Number(unit.frequency || 1) - 1,
        ),
      );

    const auditStartDate =
      this.formatDate(
        new Date(),
      );

    const auditDueDate =
      this.formatDate(
        this.addDays(
          new Date(),
          15,
        ),
      );

    let error: string | null = null;

    if (
      !(
        assessmentStartDate >= fyStart
        &&
        assessmentEndDate <= fyEnd
      )
    ) {

      error =
        `Note: The audit assessment date range from ${assessmentStartDate} - ${assessmentEndDate} is not within the current year range of ${fyStartYear} - ${fyStartYear + 1}`;
    }

    if (
      pendingAssessment
    ) {

      error = 'pendingAudit';
    }

    if (
      fyRemainMonths > 0
      &&
      Number(unit.frequency) > fyRemainMonths
    ) {

      error =
        `Note: Your current audit frequency is every ${unit.frequency} Months. There are ${fyRemainMonths} Months remaining for the current audit cycle in the F.Y. ${fyStartYear} - ${fyStartYear + 1}. Please consider changing your audit frequency.`;
    } else if (
      fyRemainMonths <= 0
    ) {

      error =
        `All audits have been completed in the current F.Y. ${fyStartYear} - ${fyStartYear + 1}.`;
    }

    if (
      !error
    ) {

      error =
        await this.getRiskSetupError(
          yearId,
        );
    }

    let controlData: any = null;

    if (
      !error
    ) {

      controlData =
        await this.getMultiLevelControl(
          unit,
          year,
          auditUnitId,
          assessmentStartDate,
          assessmentEndDate,
        );

      if (
        !controlData
      ) {

        error = 'multiLevelControlNoData';
      }
    }

    return {
      can_start:
        !error,
      error,
      audit_unit: unit,
      year,
      data: {
        audit_type_id: 1,
        year_id: yearId,
        audit_unit_id: auditUnitId,
        frequency: unit.frequency,
        audit_head_id: employeeId,
        branch_head_id: unit.branch_head_id,
        branch_subhead_id: unit.branch_subhead_id,
        multi_compliance_ids: unit.multi_compliance_ids,
        last_audit_date: unit.last_audit_date,
        assesment_period_from: assessmentStartDate,
        assesment_period_to: assessmentEndDate,
        audit_start_date: auditStartDate,
        audit_due_date: auditDueDate,
        audit_status_id: 1,
        audit_review_reject_limit: 5,
        compliance_review_reject_limit: 5,
        menu_ids: controlData?.menu_ids || null,
        cat_ids: controlData?.cat_ids || null,
        header_ids: controlData?.header_ids || null,
        question_ids: controlData?.question_ids || null,
        advances_scheme_ids:
          controlData?.advances_scheme_ids || null,
        deposits_scheme_ids:
          controlData?.deposits_scheme_ids || null,
      },
      notice:
        `Note: The audit due date is: ${auditDueDate} (15 days from the audit start date). After this date, you will not be allowed to conduct audits in the current assessment.`,
    };
  }

  async startAssessment(
    auditUnitId: number,
    yearId: number,
    employeeId: number,
  ) {

    const preview =
      await this.getStartAssessmentPreview(
        auditUnitId,
        yearId,
        employeeId,
      );

    if (
      !preview.can_start
    ) {

      throw new BadRequestException(
        preview.error || 'Assessment cannot be started',
      );
    }

    const batchKey =
      this.generateBatchKey();

    const data =
    {
      ...preview.data,
      batch_key:
        batchKey,
    };

    return this.db.transaction(
      async (client) => {

        const assessmentResult =
          await client.query(
            `
            INSERT INTO audit_assesment_master (
                audit_type_id,
                year_id,
                audit_unit_id,
                frequency,
                audit_head_id,
                branch_head_id,
                branch_subhead_id,
                multi_compliance_ids,
                assesment_period_from,
                assesment_period_to,
                audit_start_date,
                audit_due_date,
                audit_status_id,
                audit_review_reject_limit,
                compliance_review_reject_limit,
                menu_ids,
                cat_ids,
                header_ids,
                question_ids,
                advances_scheme_ids,
                deposits_scheme_ids,
                batch_key
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22
            )
            RETURNING id;
            `,
            [
              data.audit_type_id,
              data.year_id,
              data.audit_unit_id,
              data.frequency,
              data.audit_head_id,
              data.branch_head_id,
              data.branch_subhead_id,
              data.multi_compliance_ids,
              data.assesment_period_from,
              data.assesment_period_to,
              data.audit_start_date,
              data.audit_due_date,
              data.audit_status_id,
              data.audit_review_reject_limit,
              data.compliance_review_reject_limit,
              data.menu_ids,
              data.cat_ids,
              data.header_ids,
              data.question_ids,
              data.advances_scheme_ids,
              data.deposits_scheme_ids,
              data.batch_key,
            ],
          );

        const assessmentId =
          assessmentResult.rows[0].id;

        await client.query(
          `
          INSERT INTO audit_assesment_timeline (
              assesment_id,
              type_id,
              status_id,
              rejected_cnt,
              reviewer_emp_id,
              batch_key
          )
          VALUES ($1, $2, $3, $4, $5, $6);
          `,
          [
            assessmentId,
            1,
            1,
            0,
            employeeId,
            batchKey,
          ],
        );

        return {
          assessment_id:
            assessmentId,
          audit_unit_id:
            auditUnitId,
          action:
            'continue',
          message:
            'Audit assessment started successfully',
        };
      },
    );
  }

  async getOverview(
    assessmentId: number,
    employeeId: number,
  ) {

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    await this.assertAuthority(
      assessment.audit_unit_id,
      employeeId,
    );

    const auditStatusId =
      Number(
        assessment.audit_status_id,
      );

    const isBlocked =
      Boolean(
        Number(
          assessment.is_limit_blocked || 0,
        ),
      );

    const isExpired =
      assessment.audit_due_date
        ? this.isPastDate(
          assessment.audit_due_date,
        )
        : false;

    const canContinue =
      AUDITOR_STATUS_IDS.includes(
        auditStatusId,
      )
      &&
      !isBlocked
      &&
      !isExpired;

    return {
      ...assessment,
      latest_status:
        STATUS_LABELS[auditStatusId]
        || 'UNKNOWN',
      can_continue:
        canContinue,
      action_label:
        auditStatusId === 3
          ? 'DO RE-ASSESMENT'
          : 'DO ASSESMENT',
      block_reason:
        this.getBlockReason(
          auditStatusId,
          isBlocked,
          isExpired,
        ),
    };
  }

  async getMenu(
    assessmentId: number,
    employeeId: number,
  ) {

    const overview =
      await this.getOverview(
        assessmentId,
        employeeId,
      );

    if (
      !overview.can_continue
    ) {

      return {
        overview,
        menus: [],
      };
    }

    const query = `

SELECT

    mm.id AS menu_id,
    mm.name AS menu_name,

    cm.id AS category_id,
    cm.name AS category_name,
    cm.linked_table_id,

    qsm.id AS question_set_id,
    qsm.name AS question_set_name,

    qhm.id AS header_id,
    qhm.name AS header_name,

    COUNT(DISTINCT qm.id)
        AS question_count,

    COUNT(DISTINCT ans.id)
        AS answered_count,

    q.questions

FROM menu_master mm

LEFT JOIN category_master cm
    ON cm.menu_id = mm.id
    AND cm.is_active = 1
    AND cm.deleted_at IS NULL
    AND (
        $2 = ''
        OR cm.id::text = ANY(
            string_to_array($2, ',')
        )
    )

LEFT JOIN question_set_master qsm
    ON qsm.id::text = ANY(
        string_to_array(
            COALESCE(
                cm.question_set_ids,
                ''
            ),
            ','
        )
    )
    AND qsm.is_active = 1
    AND qsm.deleted_at IS NULL

LEFT JOIN question_header_master qhm
    ON qhm.question_set_id = qsm.id
    AND qhm.is_active = 1
    AND qhm.deleted_at IS NULL
    AND (
        $3 = ''
        OR qhm.id::text = ANY(
            string_to_array($3, ',')
        )
    )

LEFT JOIN question_master qm
    ON qm.header_id = qhm.id
    AND qm.set_id = qsm.id
    AND qm.is_active = 1
    AND qm.deleted_at IS NULL
    AND (
        $4 = ''
        OR qm.id::text = ANY(
            string_to_array($4, ',')
        )
    )

LEFT JOIN answers_data ans
    ON ans.assesment_id = $5
    AND ans.category_id = cm.id
    AND ans.question_id = qm.id
    AND ans.deleted_at IS NULL

LEFT JOIN
(

    SELECT

        qm.header_id,
        qm.set_id,

        jsonb_agg(

            jsonb_build_object(

                'question_id', qm.id,
                'question', qm.question,
                'question_type_id', qm.question_type_id,
                'option_id', qm.option_id,

                'parameters',

                CASE
                    WHEN qm.parameters IS NULL
                         OR qm.parameters = ''
                    THEN '[]'::jsonb
                    ELSE qm.parameters::jsonb
                END,

                'risk_category_id', qm.risk_category_id,
                'annexure_id', qm.annexure_id,
                'area_of_audit_id', qm.area_of_audit_id,
                'applicable_id', qm.applicable_id,
                'control_risk_id', qm.control_risk_id,
                'key_aspect_id', qm.key_aspect_id,
                'residual_risk_id', qm.residual_risk_id,
                'show_instances', qm.show_instances,
                'audit_ev_upload', qm.audit_ev_upload,
                'compliance_ev_upload', qm.compliance_ev_upload,

                'annexure',

                jsonb_build_object(

                    'annexure_id', am.id,
                    'annexure_name', am.name,

                    'columns',

                    COALESCE(
                        ac.columns_json,
                        '[]'::jsonb
                    )

                )

            )

        ) AS questions

    FROM question_master qm

    LEFT JOIN annexure_master am
        ON am.id = qm.annexure_id

    LEFT JOIN
    (

        SELECT

            ac.annexure_id,

            jsonb_agg(

                jsonb_build_object(

                    'column_name', ac.name,
                    'column_type_id', ac.column_type_id,
                    'column_options', ac.column_options

                )

            ) AS columns_json

        FROM annexure_columns ac

        WHERE ac.deleted_at IS NULL

        GROUP BY ac.annexure_id

    ) ac
        ON ac.annexure_id = am.id

    WHERE
        qm.deleted_at IS NULL
        AND qm.is_active = 1

    GROUP BY
        qm.header_id,
        qm.set_id

) q
    ON q.header_id = qhm.id
   AND q.set_id = qsm.id

WHERE
    mm.is_active = 1
    AND mm.deleted_at IS NULL
    AND (
        $1 = ''
        OR mm.id::text = ANY(
            string_to_array($1, ',')
        )
    )

GROUP BY

    mm.id,
    mm.name,

    cm.id,
    cm.name,
    cm.linked_table_id,

    qsm.id,
    qsm.name,

    qhm.id,
    qhm.name,
    q.questions
  
ORDER BY

    mm.id,
    cm.id,
    qsm.id,
    qhm.id

`;

    const result =
      await this.db.query(
        query,
        [
          overview.menu_ids || '',
          overview.cat_ids || '',
          overview.header_ids || '',
          overview.question_ids || '',
          assessmentId,
        ],
      );

    const menuMap =
      new Map<number, any>();

    for (
      const row
      of result.rows
    ) {

      if (
        !menuMap.has(
          row.menu_id,
        )
      ) {

        menuMap.set(
          row.menu_id,
          {
            id:
              row.menu_id,

            name:
              row.menu_name,

            categories:
              [],
          },
        );
      }

      const menu =
        menuMap.get(
          row.menu_id,
        );

      let category =
        menu.categories.find(
          (c: any) =>
            c.id ===
            row.category_id,
        );

      if (
        !category &&
        row.category_id
      ) {

        category = {

          id:
            row.category_id,

          name:
            row.category_name,

          linked_table_id:
            row.linked_table_id,

          question_count:
            Number(
              row.question_count || 0,
            ),

          answered_count:
            Number(
              row.answered_count || 0,
            ),

          question_sets:
            [],
        };

        menu.categories.push(
          category,
        );
      }

      if (
        row.question_set_id
      ) {

        let questionSet =
          category.question_sets.find(
            (q: any) =>
              q.id ===
              row.question_set_id,
          );

        if (
          !questionSet
        ) {

          questionSet = {

            id:
              row.question_set_id,

            name:
              row.question_set_name,

            headers:
              [],
          };

          category.question_sets.push(
            questionSet,
          );
        }

        if (
          row.header_id
        ) {

          questionSet.headers.push({

            id:
              row.header_id,

            name:
              row.header_name,

            questions:
              row.questions || [],

          });
        }
      }
    }

    return {

      overview,

      menus:
        Array.from(
          menuMap.values(),
        ),

    };
  }

  async getCategory(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
  ) {

    const overview =
      await this.getOverview(
        assessmentId,
        employeeId,
      );

    if (
      !overview.can_continue
    ) {

      throw new BadRequestException(
        overview.block_reason || 'Assessment is locked',
      );
    }

    const category =
      await this.db.findOne(
        `
SELECT
    cm.id,
    cm.menu_id,
    cm.name,
    cm.linked_table_id,
    cm.question_set_ids,
    mm.name AS menu_name,
    mm.section_type_id
FROM category_master cm
LEFT JOIN menu_master mm
    ON mm.id = cm.menu_id
WHERE cm.id = $1
    AND cm.is_active = 1
    AND cm.deleted_at IS NULL
    AND (
        $2 = ''
        OR cm.id::text = ANY(string_to_array($2, ','))
    )
    AND (
        $3 = ''
        OR cm.menu_id::text = ANY(string_to_array($3, ','))
    )
LIMIT 1;
        `,
        [
          categoryId,
          overview.cat_ids || '',
          overview.menu_ids || '',
        ],
      );

    if (
      !category
    ) {

      throw new NotFoundException(
        'Category not found for this assessment',
      );
    }

    const questionResult =
      await this.db.query(
        `
SELECT
    qsm.id AS set_id,
    qsm.name AS set_name,
    qhm.id AS header_id,
    qhm.name AS header_name,
    qm.id AS question_id,
    qm.question,
    qm.question_type_id,
    qm.option_id,
    qm.parameters,
    qm.risk_category_id,
    qm.annexure_id,
    qm.subset_multi_id,
    qm.audit_ev_upload,
    qm.show_instances,
    rcm.risk_category AS risk_category_name,
    ans.id AS answer_id,
    ans.answer_given,
    ans.audit_comment,
    ans.is_compliance,
    ans.business_risk,
    ans.control_risk,
    ans.audit_status_id AS answer_status_id
FROM question_set_master qsm
INNER JOIN question_header_master qhm
    ON qhm.question_set_id = qsm.id
    AND qhm.is_active = 1
    AND qhm.deleted_at IS NULL
    AND (
        $3 = ''
        OR qhm.id::text = ANY(string_to_array($3, ','))
    )
INNER JOIN question_master qm
    ON qm.set_id = qsm.id
    AND qm.header_id = qhm.id
    AND qm.is_active = 1
    AND qm.deleted_at IS NULL
    AND (
        $4 = ''
        OR qm.id::text = ANY(string_to_array($4, ','))
    )
LEFT JOIN risk_category_master rcm
    ON rcm.id = qm.risk_category_id
LEFT JOIN answers_data ans
    ON ans.assesment_id = $5
    AND ans.category_id = $6
    AND ans.header_id = qhm.id
    AND ans.question_id = qm.id
    AND ans.deleted_at IS NULL
WHERE qsm.is_active = 1
    AND qsm.deleted_at IS NULL
    AND qsm.id::text = ANY(string_to_array(COALESCE($1, ''), ','))
    AND (
        $2 = ''
        OR qsm.id::text = ANY(string_to_array($2, ','))
    )
ORDER BY
    qsm.id,
    qhm.id,
    qm.id;
        `,
        [
          category.question_set_ids || '',
          this.getSetIdsFromQuestionScope(
            category.question_set_ids || '',
          ),
          overview.header_ids || '',
          overview.question_ids || '',
          assessmentId,
          categoryId,
        ],
      );

    return {
      overview,
      category,
      sets:
        this.groupCategoryQuestions(
          questionResult.rows,
        ),
    };
  }

  private getSetIdsFromQuestionScope(
    questionSetIds: string,
  ) {

    return questionSetIds || '';
  }

  async saveCategoryAnswers(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    answers: any[],
  ) {

    if (
      !Array.isArray(answers)
      ||
      !answers.length
    ) {

      throw new BadRequestException(
        'Answers are required',
      );
    }

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    for (
      const set
      of detail.sets
    ) {

      for (
        const header
        of set.headers
      ) {

        for (
          const question
          of header.questions
        ) {

          questionMap.set(
            Number(question.id),
            {
              ...question,
              header_id:
                header.id,
            },
          );
        }
      }
    }

    const errors: Record<string, string> = {};
    const rowsToSave: any[] = [];

    for (
      const answer
      of answers
    ) {

      const questionId =
        Number(answer?.question_id);

      const question =
        questionMap.get(
          questionId,
        );

      if (
        !question
      ) {

        errors[questionId || 'unknown'] =
          'Question not found for this category';
        continue;
      }

      if (
        Number(answer?.header_id)
        !==
        Number(question.header_id)
      ) {

        errors[questionId] =
          'Header does not match this question';
        continue;
      }

      const validation =
        this.validateQuestionAnswer(
          question,
          answer?.answer_given,
        );

      if (
        validation.error
      ) {

        errors[questionId] =
          validation.error;
        continue;
      }

      rowsToSave.push({
        section_type_id:
          detail.category.section_type_id || 0,
        assesment_id:
          assessmentId,
        menu_id:
          detail.category.menu_id,
        category_id:
          categoryId,
        header_id:
          question.header_id,
        question_id:
          questionId,
        dump_id:
          0,
        answer_given:
          this.cleanString(
            answer?.answer_given,
          ),
        audit_comment:
          this.cleanString(
            answer?.audit_comment,
          ) || null,
        audit_emp_id:
          employeeId,
        is_compliance:
          (
            answer?.is_compliance === true
            ||
            answer?.is_compliance === 1
            ||
            validation.is_compliance
          )
            ? 1
            : 0,
        business_risk:
          validation.business_risk,
        control_risk:
          validation.control_risk,
        batch_key:
          detail.overview.batch_key,
      });
    }

    if (
      Object.keys(errors).length
    ) {

      return {
        success:
          false,
        message:
          'Please correct highlighted answers.',
        errors,
      };
    }

    await this.db.transaction(
      async (client) => {

        for (
          const row
          of rowsToSave
        ) {

          const existing =
            await client.query(
              `
              SELECT id
              FROM answers_data
              WHERE assesment_id = $1
                  AND category_id = $2
                  AND header_id = $3
                  AND question_id = $4
                  AND dump_id = $5
                  AND deleted_at IS NULL
              LIMIT 1;
              `,
              [
                row.assesment_id,
                row.category_id,
                row.header_id,
                row.question_id,
                row.dump_id,
              ],
            );

          if (
            existing.rows.length
          ) {

            await client.query(
              `
              UPDATE answers_data
              SET
                  answer_given = $1,
                  audit_comment = $2,
                  audit_emp_id = $3,
                  is_compliance = $4,
                  business_risk = $5,
                  control_risk = $6,
                  batch_key = $7
              WHERE id = $8;
              `,
              [
                row.answer_given,
                row.audit_comment,
                row.audit_emp_id,
                row.is_compliance,
                row.business_risk,
                row.control_risk,
                row.batch_key,
                existing.rows[0].id,
              ],
            );
          } else {

            await client.query(
              `
              INSERT INTO answers_data (
                  section_type_id,
                  assesment_id,
                  menu_id,
                  category_id,
                  header_id,
                  question_id,
                  dump_id,
                  answer_given,
                  audit_comment,
                  audit_emp_id,
                  audit_status_id,
                  audit_reviewer_emp_id,
                  audit_reviewer_comment,
                  is_compliance,
                  audit_commpliance,
                  compliance_evidance_upload,
                  compliance_emp_id,
                  compliance_status_id,
                  compliance_reviewer_emp_id,
                  compliance_reviewer_comment,
                  business_risk,
                  control_risk,
                  instances_count,
                  batch_key
              )
              VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8,
                  $9, $10, $11, $12, $13, $14, $15, $16,
                  $17, $18, $19, $20, $21, $22, $23, $24
              );
              `,
              [
                row.section_type_id,
                row.assesment_id,
                row.menu_id,
                row.category_id,
                row.header_id,
                row.question_id,
                row.dump_id,
                row.answer_given,
                row.audit_comment,
                row.audit_emp_id,
                0,
                0,
                null,
                row.is_compliance,
                null,
                null,
                0,
                0,
                0,
                null,
                row.business_risk,
                row.control_risk,
                0,
                row.batch_key,
              ],
            );
          }
        }
      },
    );

    return {
      success:
        true,
      message:
        'Answers saved successfully',
      saved:
        rowsToSave.length,
    };
  }

  private groupCategoryQuestions(
    rows: any[],
  ) {

    const setMap =
      new Map<number, any>();

    for (
      const row
      of rows
    ) {

      if (
        !setMap.has(
          row.set_id,
        )
      ) {

        setMap.set(
          row.set_id,
          {
            id:
              row.set_id,
            name:
              row.set_name,
            headers:
              [],
          },
        );
      }

      const set =
        setMap.get(
          row.set_id,
        );

      let header =
        set.headers.find(
          (x: any) =>
            x.id === row.header_id,
        );

      if (
        !header
      ) {

        header = {
          id:
            row.header_id,
          name:
            row.header_name,
          questions:
            [],
        };

        set.headers.push(
          header,
        );
      }

      header.questions.push({
        id:
          row.question_id,
        question:
          row.question,
        question_type_id:
          row.question_type_id,
        option_id:
          row.option_id,
        parameters:
          this.parseQuestionParameters(
            row.parameters,
          ),
        option_name:
          this.getQuestionOptionName(
            Number(row.option_id),
          ),
        risk_category_id:
          row.risk_category_id,
        risk_category_name:
          row.risk_category_name,
        annexure_id:
          row.annexure_id,
        subset_multi_id:
          row.subset_multi_id,
        audit_ev_upload:
          row.audit_ev_upload,
        show_instances:
          row.show_instances,
        answer:
          row.answer_id
            ? {
              id:
                row.answer_id,
              answer_given:
                row.answer_given,
              audit_comment:
                row.audit_comment,
              is_compliance:
                row.is_compliance,
              business_risk:
                row.business_risk,
              control_risk:
                row.control_risk,
              audit_status_id:
                row.answer_status_id,
            }
            : null,
      });
    }

    return Array.from(
      setMap.values(),
    );
  }

  private getQuestionOptionName(
    optionId: number,
  ) {

    const labels: Record<number, string> = {
      1: 'MULTIPLE OPTION',
      2: 'YES / NO',
      3: 'TEXTAREA',
      4: 'ANNEXURE',
      5: 'SUBSET',
    };

    return labels[optionId] || '-';
  }

  private validateQuestionAnswer(
    question: any,
    rawAnswer: any,
  ) {

    const answer =
      this.cleanString(
        rawAnswer,
      );

    const optionId =
      Number(
        question.option_id,
      );

    const result = {
      error:
        '',
      business_risk:
        0,
      control_risk:
        0,
      is_compliance:
        false,
    };

    const parameters =
      this.parseQuestionParameters(
        question.parameters,
      );

    if (
      [1, 2, 4, 5].includes(optionId)
      &&
      parameters.length
    ) {

      const selected =
        parameters.find(
          (item: any) =>
            this.cleanString(item?.rt)
            ===
            answer,
        );

      if (
        selected
      ) {

        result.business_risk =
          Number(selected.br || 0);
        result.control_risk =
          Number(selected.cr || 0);
        result.is_compliance =
          result.business_risk < 4
          ||
          result.control_risk < 4;

        return result;
      }
    }

    if (
      optionId === 3
    ) {

      result.business_risk = 4;
      result.control_risk = 4;
      return result;
    }

    if (
      optionId === 4
      &&
      answer
      &&
      answer ===
      this.cleanString(
        question.annexure_id,
      )
    ) {

      result.is_compliance = true;
      return result;
    }

    if (
      optionId === 5
    ) {

      const subsetIds =
        this.cleanString(
          question.subset_multi_id,
        )
          .split(',')
          .map(
            (item) =>
              item.trim(),
          )
          .filter(Boolean);

      if (
        answer
        &&
        subsetIds.includes(
          answer,
        )
      ) {

        return result;
      }
    }

    result.error =
      'Please select a valid answer option.';

    return result;
  }

  private parseQuestionParameters(
    value: any,
  ) {

    if (
      Array.isArray(value)
    ) {

      return value;
    }

    if (
      !value
    ) {

      return [];
    }

    try {
      const parsed =
        JSON.parse(
          String(value),
        );

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {

      return [];
    }
  }

  private cleanString(
    value: any,
  ) {

    if (
      value === null
      ||
      value === undefined
    ) {

      return '';
    }

    return String(value)
      .trim();
  }

  private async findAssessment(
    assessmentId: number,
  ) {

    const query = `
SELECT
    aam.id,
    aam.audit_type_id,
    aam.year_id,
    aam.audit_unit_id,
    aam.frequency,
    aam.audit_status_id,
    aam.assesment_period_from,
    aam.assesment_period_to,
    aam.audit_start_date,
    aam.audit_end_date,
    aam.audit_due_date,
    aam.is_limit_blocked,
    aam.menu_ids,
    aam.cat_ids,
    aam.header_ids,
    aam.question_ids,
    aam.advances_scheme_ids,
    aam.deposits_scheme_ids,
    aam.batch_key,
    ym.year,
    au.name AS audit_unit_name,
    au.audit_unit_code,
    asm.name AS section_type_name
FROM audit_assesment_master aam
LEFT JOIN year_master ym
    ON ym.id = aam.year_id
LEFT JOIN audit_unit_master au
    ON au.id = aam.audit_unit_id
LEFT JOIN audit_section_master asm
    ON asm.id = au.section_type_id
WHERE aam.id = $1
    AND aam.deleted_at IS NULL
LIMIT 1;
    `;

    const result =
      await this.db.query(
        query,
        [assessmentId],
      );

    if (
      !result.rows.length
    ) {

      throw new NotFoundException(
        'Assessment not found',
      );
    }

    return result.rows[0];
  }

  // Check whether this employee is allowed to access this audit unit.
  private async assertAuthority(
    auditUnitId: number,
    employeeId: number,
  ) {

    if (
      !employeeId
    ) {

      throw new BadRequestException(
        'Employee is required',
      );
    }

    const result =
      await this.db.query(
        `
        SELECT id
        FROM employee_master
        WHERE id = $1
            AND audit_unit_authority IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM unnest(string_to_array(COALESCE(audit_unit_authority, ''), ',')) unit_id
                WHERE trim(unit_id) = $2::text
            )
        LIMIT 1;
        `,
        [
          employeeId,
          auditUnitId,
        ],
      );

    if (
      !result.rows.length
    ) {

      throw new BadRequestException(
        'Auditor is not authorized for this audit unit',
      );
    }
  }

  private getBlockReason(
    auditStatusId: number,
    isBlocked: boolean,
    isExpired: boolean,
  ) {

    if (
      isBlocked
    ) {

      return 'Current audit assessment is blocked.';
    }

    if (
      isExpired
    ) {

      return 'Audit period has expired for this assessment.';
    }

    if (
      !AUDITOR_STATUS_IDS.includes(
        auditStatusId,
      )
    ) {

      return 'Current assessment is not pending with auditor.';
    }

    return null;
  }

  private decorateAssessmentAction(
    assessment: any,
  ) {

    const auditStatusId =
      Number(
        assessment.audit_status_id,
      );

    const isBlocked =
      Boolean(
        Number(
          assessment.is_limit_blocked || 0,
        ),
      );

    const auditExpired =
      [1, 3].includes(
        auditStatusId,
      )
      &&
      assessment.audit_due_date
      &&
      this.isPastDate(
        assessment.audit_due_date,
      );

    const complianceExpired =
      [4, 6].includes(
        auditStatusId,
      )
      &&
      assessment.compliance_due_date
      &&
      this.isPastDate(
        assessment.compliance_due_date,
      );

    let actionLabel = '';
    let actionType = 'none';

    if (
      isBlocked
    ) {

      actionLabel =
        auditStatusId <= 3
          ? 'Audit Blocked'
          : 'Compliance Blocked';
      actionType = 'blocked';

    } else if (
      auditStatusId === 7
    ) {

      actionLabel = 'Completed';
      actionType = 'completed';

    } else if (
      auditExpired
    ) {

      actionLabel = 'Audit Period Expired';
      actionType = 'expired';

    } else if (
      complianceExpired
    ) {

      actionLabel = 'Compliance Period Expired';
      actionType = 'expired';

    } else if (
      auditStatusId === 1
    ) {

      actionLabel = 'DO ASSESMENT';
      actionType = 'continue';

    } else if (
      auditStatusId === 3
    ) {

      actionLabel = 'DO RE-ASSESMENT';
      actionType = 'continue';

    } else if (
      auditStatusId === 2
    ) {

      actionLabel = 'Review Pending';
      actionType = 'review';

    } else if (
      [4, 6].includes(
        auditStatusId,
      )
    ) {

      actionLabel = 'Compliance Pending';
      actionType = 'compliance';

    } else if (
      auditStatusId === 5
    ) {

      actionLabel = 'Compliance Review Pending';
      actionType = 'review';
    }

    return {
      ...assessment,
      audit_status_label:
        this.getAuditStatusLabel(
          auditStatusId,
        ),
      compliance_status_label:
        this.getComplianceStatusLabel(
          auditStatusId,
        ),
      reviewer_status_label:
        this.getReviewerStatusLabel(
          auditStatusId,
        ),
      action_label:
        actionLabel,
      action_type:
        actionType,
      can_continue:
        actionType === 'continue',
    };
  }

  private getAssessmentMetrics(
    assessments: any[],
  ) {

    return {
      total:
        assessments.length,
      audit_pending:
        assessments.filter(
          (x) => [1, 3].includes(
            Number(x.audit_status_id),
          ),
        ).length,
      review_pending:
        assessments.filter(
          (x) => [2, 5].includes(
            Number(x.audit_status_id),
          ),
        ).length,
      compliance_pending:
        assessments.filter(
          (x) => [4, 6].includes(
            Number(x.audit_status_id),
          ),
        ).length,
      completed:
        assessments.filter(
          (x) => Number(x.audit_status_id) === 7,
        ).length,
    };
  }

  private async getRiskSetupError(
    yearId: number,
  ) {

    const riskCategory =
      await this.db.findOne(
        `
        SELECT COUNT(*)::int AS total
        FROM risk_category_master
        WHERE deleted_at IS NULL;
        `,
      );

    const totalRiskCategory =
      Number(
        riskCategory?.total || 0,
      );

    if (
      totalRiskCategory <= 0
    ) {

      return 'riskCategoryNoData';
    }

    const riskWeights =
      await this.db.findOne(
        `
        SELECT COUNT(*)::int AS total
        FROM risk_category_weights
        WHERE year_id = $1
            AND is_active = 1
            AND deleted_at IS NULL
            AND risk_category_id != 10;
        `,
        [yearId],
      );

    const totalRiskWeights =
      Number(
        riskWeights?.total || 0,
      );

    if (
      totalRiskWeights <= 0
      ||
      totalRiskWeights !== totalRiskCategory - 1
    ) {

      return 'riskCategoryWeightNoData';
    }

    const riskMatrix =
      await this.db.findOne(
        `
        SELECT COUNT(*)::int AS total
        FROM risk_matrix
        WHERE year_id = $1
            AND deleted_at IS NULL;
        `,
        [yearId],
      );

    if (
      Number(
        riskMatrix?.total || 0,
      )
      <= 0
    ) {

      return 'riskMatrixNoData';
    }

    return null;
  }

  private async getMultiLevelControl(
    unit: any,
    year: any,
    auditUnitId: number,
    assessmentStartDate: string,
    assessmentEndDate: string,
  ) {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM multi_level_control_master
        WHERE year_id = $1
            AND audit_unit_id = $2
            AND deleted_at IS NULL;
        `,
        [
          year.id,
          auditUnitId,
        ],
      );

    const controls =
      new Map<string, any>();

    for (
      const row
      of result.rows
    ) {

      controls.set(
        `${row.start_month_year}_${row.end_month_year}`,
        row,
      );
    }

    const periodKey =
      `${assessmentStartDate.slice(0, 7)}_${assessmentEndDate.slice(0, 7)}`;

    const fyStartYear =
      this.getFinancialYearStart(
        year.year,
      );

    const fallbackKey =
      `${fyStartYear}-04_${fyStartYear + 1}-03`;

    return this.validControl(
      controls.get(
        periodKey,
      ),
      unit.section_type_id,
    )
      || this.validControl(
        controls.get(
          fallbackKey,
        ),
        unit.section_type_id,
      );
  }

  private validControl(
    control: any,
    sectionTypeId: number,
  ) {

    if (
      !control
      ||
      !control.menu_ids
      ||
      !control.cat_ids
      ||
      !control.header_ids
      ||
      !control.question_ids
    ) {

      return null;
    }

    if (
      Number(sectionTypeId) === 1
      &&
      (
        !control.advances_scheme_ids
        ||
        !control.deposits_scheme_ids
      )
    ) {

      return null;
    }

    return control;
  }

  private getAuditStatusLabel(
    auditStatusId: number,
  ) {

    if (
      [1, 3].includes(
        auditStatusId,
      )
    ) {

      return STATUS_LABELS[auditStatusId];
    }

    return 'COMPLETED';
  }

  private getComplianceStatusLabel(
    auditStatusId: number,
  ) {

    if (
      auditStatusId <= 3
    ) {

      return '-';
    }

    if (
      [4, 6].includes(
        auditStatusId,
      )
    ) {

      return STATUS_LABELS[auditStatusId];
    }

    return 'COMPLETED';
  }

  private getReviewerStatusLabel(
    auditStatusId: number,
  ) {

    if (
      [2, 5].includes(
        auditStatusId,
      )
    ) {

      return STATUS_LABELS[auditStatusId];
    }

    if (
      auditStatusId > 1
    ) {

      return 'COMPLETED';
    }

    return '';
  }

  private isPastDate(
    value: string | Date,
  ) {

    const date =
      new Date(value);

    const today =
      new Date();

    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return date < today;
  }

  private formatDbDate(
    value: string | Date,
  ) {

    if (
      !value
    ) {

      return '';
    }

    return this.formatDate(
      new Date(value),
    );
  }

  private getFinancialYearStart(
    value: string | number,
  ) {

    const match =
      String(value)
        .match(/\d{4}/);

    if (
      !match
    ) {

      throw new BadRequestException(
        'Invalid financial year',
      );
    }

    return Number(
      match[0],
    );
  }

  private firstDayOfNextMonth(
    date: Date,
  ) {

    return new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      1,
    );
  }

  private lastDayAfterMonths(
    date: Date,
    months: number,
  ) {

    return new Date(
      date.getFullYear(),
      date.getMonth() + months + 1,
      0,
    );
  }

  private addDays(
    date: Date,
    days: number,
  ) {

    const copy =
      new Date(date);

    copy.setDate(
      copy.getDate() + days,
    );

    return copy;
  }

  private generateBatchKey() {

    const now =
      new Date();

    const pad =
      (value: number) =>
        String(value).padStart(2, '0');

    return `A${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
