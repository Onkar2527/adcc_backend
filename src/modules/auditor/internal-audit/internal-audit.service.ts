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
                  `${Number(year.year) + 1}-03-31`,
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

    const fyStart =
      `${year.year}-04-01`;

    const fyEnd =
      `${Number(year.year) + 1}-03-31`;

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
        `Note: The audit assessment date range from ${assessmentStartDate} - ${assessmentEndDate} is not within the current year range of ${year.year} - ${Number(year.year) + 1}`;
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
        `Note: Your current audit frequency is every ${unit.frequency} Months. There are ${fyRemainMonths} Months remaining for the current audit cycle in the F.Y. ${year.year} - ${Number(year.year) + 1}. Please consider changing your audit frequency.`;
    } else if (
      fyRemainMonths <= 0
    ) {

      error =
        `All audits have been completed in the current F.Y. ${year.year} - ${Number(year.year) + 1}.`;
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

    const fallbackKey =
      `${year.year}-04_${Number(year.year) + 1}-03`;

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
}
