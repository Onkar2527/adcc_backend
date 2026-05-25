import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const AUDITOR_STATUS_IDS = [1, 3];
const EVIDENCE_MAX_SIZE =
  5 * 1024 * 1024;
const EVIDENCE_FILE_TYPES: Record<string, {
  id: number;
  extension: string;
}> = {
  'image/jpeg': {
    id: 1,
    extension: '.jpg',
  },
  'image/jpg': {
    id: 2,
    extension: '.jpg',
  },
  'image/png': {
    id: 3,
    extension: '.png',
  },
  'application/pdf': {
    id: 4,
    extension: '.pdf',
  },
};

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
                    'risk_defination_id', am.risk_defination_id,

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

                    'id', ac.id,
                    'column_name', ac.name,
                    'column_type_id', ac.column_type_id,
                    'options', COALESCE(aco.options_json, '[]'::jsonb)

                )
                ORDER BY ac.id

            ) AS columns_json

        FROM annexure_columns ac

        LEFT JOIN (
            SELECT
                annexure_column_id,
                jsonb_agg(
                    jsonb_build_object(
                        'id', id,
                        'option_label', option_label
                    )
                    ORDER BY id
                ) AS options_json
            FROM annexure_column_options
            WHERE deleted_at IS NULL
            GROUP BY annexure_column_id
        ) aco
            ON aco.annexure_column_id = ac.id

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

  async getSubmissionPreview(
    assessmentId: number,
    employeeId: number,
  ) {

    const menuData =
      await this.getMenu(
        assessmentId,
        employeeId,
      );

    const overview =
      menuData.overview;

    if (
      !overview.can_continue
    ) {
      return {
        can_submit:
          false,
        pending_count:
          0,
        compliance_count:
          0,
        compliance_points:
          [],
        message:
          overview.block_reason
          || 'Current assessment cannot be submitted by auditor.',
        issues:
          [],
        overview,
      };
    }

    if (
      Number(overview.audit_status_id) !== 1
    ) {
      return {
        can_submit:
          false,
        pending_count:
          0,
        compliance_count:
          0,
        compliance_points:
          [],
        message:
          'Re-audit submission will be enabled with the re-audit workflow.',
        issues:
          [],
        overview,
      };
    }

    const issues: any[] = [];
    const compliancePoints: any[] = [];
    let complianceCount = 0;

    for (
      const menu
      of menuData.menus || []
    ) {
      for (
        const category
        of menu.categories || []
      ) {

        const detail =
          await this.getCategory(
            assessmentId,
            Number(category.id),
            employeeId,
          );

        complianceCount +=
          this.validateSubmissionSets(
            detail.sets || [],
            {
              id:
                category.id,
              name:
                category.name,
              menu_name:
                menu.name,
            },
            issues,
            compliancePoints,
          );
      }
    }

    return {
      can_submit:
        issues.length === 0,
      pending_count:
        issues.length,
      compliance_count:
        complianceCount,
      compliance_points:
        compliancePoints,
      message:
        issues.length
          ? 'Complete the pending audit points before submitting for review.'
          : 'Audit is ready to submit for review.',
      issues,
      overview,
    };
  }

  async submitAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    const preview =
      await this.getSubmissionPreview(
        assessmentId,
        employeeId,
      );

    if (
      !preview.can_submit
    ) {
      return {
        success:
          false,
        ...preview,
      };
    }

    await this.db.transaction(
      async (client) => {

        const updated =
          await client.query(
            `
            UPDATE audit_assesment_master
            SET
                audit_end_date = CURRENT_DATE,
                audit_status_id = 2,
                audit_emp_id = $2
            WHERE id = $1
                AND audit_status_id = 1
                AND deleted_at IS NULL
            RETURNING id;
            `,
            [
              assessmentId,
              employeeId,
            ],
          );

        if (
          !updated.rows.length
        ) {
          throw new BadRequestException(
            'Assessment is no longer pending with auditor.',
          );
        }

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
          VALUES ($1, 1, 2, 0, $2, $3);
          `,
          [
            assessmentId,
            employeeId,
            preview.overview.batch_key,
          ],
        );

        await client.query(
          `
          UPDATE audit_unit_master
          SET last_audit_date = $1
          WHERE id = $2
              AND deleted_at IS NULL;
          `,
          [
            preview.overview.assesment_period_to,
            preview.overview.audit_unit_id,
          ],
        );
      },
    );

    return {
      success:
        true,
      message:
        'Audit submitted to reviewer successfully.',
      status_id:
        2,
      status:
        STATUS_LABELS[2],
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
    am.name AS annexure_name,
    am.risk_defination_id AS annexure_risk_defination_id,
    ac.columns_json AS annexure_columns,
    ans.id AS answer_id,
    ans.answer_given,
    ans.audit_comment,
    ans.is_compliance,
    ans.audit_compulsary_ev_upload,
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
LEFT JOIN annexure_master am
    ON am.id = qm.annexure_id
    AND am.deleted_at IS NULL
LEFT JOIN (
    SELECT
        ac.annexure_id,
        jsonb_agg(
            jsonb_build_object(
                'id', ac.id,
                'name', ac.name,
                'column_type_id', ac.column_type_id,
                'options', COALESCE(aco.options_json, '[]'::jsonb)
            )
            ORDER BY ac.id
        ) AS columns_json
    FROM annexure_columns ac
    LEFT JOIN (
        SELECT
            annexure_column_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'option_label', option_label
                )
                ORDER BY id
            ) AS options_json
        FROM annexure_column_options
        WHERE deleted_at IS NULL
        GROUP BY annexure_column_id
    ) aco
        ON aco.annexure_column_id = ac.id
    WHERE ac.deleted_at IS NULL
    GROUP BY ac.annexure_id
) ac
    ON ac.annexure_id = am.id
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

    const sets =
      this.groupCategoryQuestions(
        questionResult.rows,
      );

    const subsetIds =
      this.getSubsetIdsFromRows(
        questionResult.rows,
      );

    if (
      subsetIds.length
    ) {

      const subsetResult =
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
    am.name AS annexure_name,
    am.risk_defination_id AS annexure_risk_defination_id,
    ac.columns_json AS annexure_columns,
    ans.id AS answer_id,
    ans.answer_given,
    ans.audit_comment,
    ans.is_compliance,
    ans.audit_compulsary_ev_upload,
    ans.business_risk,
    ans.control_risk,
    ans.audit_status_id AS answer_status_id
FROM question_set_master qsm
INNER JOIN question_header_master qhm
    ON qhm.question_set_id = qsm.id
    AND qhm.is_active = 1
    AND qhm.deleted_at IS NULL
    AND (
        $2 = ''
        OR qhm.id::text = ANY(string_to_array($2, ','))
    )
INNER JOIN question_master qm
    ON qm.set_id = qsm.id
    AND qm.header_id = qhm.id
    AND qm.is_active = 1
    AND qm.deleted_at IS NULL
    AND (
        $3 = ''
        OR qm.id::text = ANY(string_to_array($3, ','))
    )
LEFT JOIN risk_category_master rcm
    ON rcm.id = qm.risk_category_id
LEFT JOIN annexure_master am
    ON am.id = qm.annexure_id
    AND am.deleted_at IS NULL
LEFT JOIN (
    SELECT
        ac.annexure_id,
        jsonb_agg(
            jsonb_build_object(
                'id', ac.id,
                'name', ac.name,
                'column_type_id', ac.column_type_id,
                'options', COALESCE(aco.options_json, '[]'::jsonb)
            )
            ORDER BY ac.id
        ) AS columns_json
    FROM annexure_columns ac
    LEFT JOIN (
        SELECT
            annexure_column_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'option_label', option_label
                )
                ORDER BY id
            ) AS options_json
        FROM annexure_column_options
        WHERE deleted_at IS NULL
        GROUP BY annexure_column_id
    ) aco
        ON aco.annexure_column_id = ac.id
    WHERE ac.deleted_at IS NULL
    GROUP BY ac.annexure_id
) ac
    ON ac.annexure_id = am.id
LEFT JOIN answers_data ans
    ON ans.assesment_id = $4
    AND ans.category_id = $5
    AND ans.header_id = qhm.id
    AND ans.question_id = qm.id
    AND ans.deleted_at IS NULL
WHERE qsm.is_active = 1
    AND qsm.deleted_at IS NULL
    AND qsm.id::text = ANY(string_to_array($1, ','))
ORDER BY
    qsm.id,
    qhm.id,
    qm.id;
          `,
          [
            subsetIds.join(','),
            overview.header_ids || '',
            overview.question_ids || '',
            assessmentId,
            categoryId,
          ],
        );

      this.attachSubsetSets(
        sets,
        this.groupCategoryQuestions(
          subsetResult.rows,
        ),
      );
    }

    await this.attachAnnexureRows(
      sets,
      assessmentId,
    );

    await this.attachEvidenceRows(
      sets,
      assessmentId,
    );

    const annexureRiskOptions =
      await this.getAnnexureRiskOptions(
        Number(overview.year_id),
      );

    return {
      overview,
      category,
      sets,
      annexure_risk_options:
        annexureRiskOptions,
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

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

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
        audit_compulsary_ev_upload:
          (
            answer?.audit_compulsary_ev_upload === true
            ||
            Number(answer?.audit_compulsary_ev_upload || 0) === 1
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
                  audit_compulsary_ev_upload = $5,
                  business_risk = $6,
                  control_risk = $7,
                  batch_key = $8
              WHERE id = $9;
              `,
              [
                row.answer_given,
                row.audit_comment,
                row.audit_emp_id,
                row.is_compliance,
                row.audit_compulsary_ev_upload,
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
                  audit_compulsary_ev_upload,
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
                  $17, $18, $19, $20, $21, $22, $23, $24,
                  $25
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
                row.audit_compulsary_ev_upload,
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

  async saveAnnexureRow(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
    body: any,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    const question =
      questionMap.get(
        questionId,
      );

    if (
      !question
      ||
      Number(question.option_id) !== 4
      ||
      !question.annexure_id
    ) {

      throw new BadRequestException(
        'Annexure question not found',
      );
    }

    const values =
      Array.isArray(body?.values)
        ? body.values
        : [];

    const columns =
      question.annexure?.columns || [];

    const validationError =
      this.validateAnnexureValues(
        columns,
        values,
      );

    if (
      validationError
    ) {

      return {
        success:
          false,
        message:
          validationError,
      };
    }

    const risk =
      this.validateAnnexureRisk(
        question,
        detail.annexure_risk_options,
        body,
      );

    if (
      risk.error
    ) {

      return {
        success:
          false,
        message:
          risk.error,
      };
    }

    const parentAnswerId =
      await this.ensureAnnexureParentAnswer(
        detail,
        question,
        employeeId,
      );

    const payload =
      JSON.stringify(values);

    const rowId =
      Number(body?.id || 0);

    let savedRow: any;

    await this.db.transaction(
      async (client) => {

        if (
          rowId
        ) {

          const result =
            await client.query(
              `
UPDATE answers_data_annexure
SET
    answer_given = $1,
    audit_emp_id = $2,
    business_risk = $3,
    control_risk = $4,
    risk_cat_id = $5,
    batch_key = $6
WHERE id = $7
    AND answer_id = $8
    AND assesment_id = $9
    AND deleted_at IS NULL
RETURNING id, answer_given, business_risk, control_risk, risk_cat_id;
            `,
              [
                payload,
                employeeId,
                risk.business_risk,
                risk.control_risk,
                risk.risk_cat_id,
                detail.overview.batch_key,
                rowId,
                parentAnswerId,
                assessmentId,
              ],
            );

          savedRow =
            result.rows[0];
        } else {

          const result =
            await client.query(
              `
INSERT INTO answers_data_annexure (
    answer_id,
    assesment_id,
    answer_given,
    audit_comment,
    audit_emp_id,
    audit_status_id,
    audit_reviewer_emp_id,
    audit_reviewer_comment,
    audit_commpliance,
    compliance_evidance_upload,
    compliance_emp_id,
    compliance_status_id,
    compliance_reviewer_emp_id,
    compliance_reviewer_comment,
    business_risk,
    control_risk,
    risk_cat_id,
    batch_key
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
)
RETURNING id, answer_given, business_risk, control_risk, risk_cat_id;
            `,
              [
                parentAnswerId,
                assessmentId,
                payload,
                null,
                employeeId,
                Number(detail.overview.audit_status_id || 0),
                0,
                null,
                null,
                null,
                0,
                0,
                0,
                null,
                risk.business_risk,
                risk.control_risk,
                risk.risk_cat_id,
                detail.overview.batch_key,
              ],
            );

          savedRow =
            result.rows[0];
        }
      },
    );

    return {
      success:
        true,
      message:
        'Annexure row saved successfully',
      answer_id:
        parentAnswerId,
      row:
        savedRow
          ? {
            id:
              savedRow.id,
            values:
              this.parseJsonArray(
                savedRow.answer_given,
              ),
            business_risk:
              savedRow.business_risk,
            control_risk:
              savedRow.control_risk,
            risk_cat_id:
              savedRow.risk_cat_id,
          }
          : null,
    };
  }

  async deleteAnnexureRow(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    annexureRowId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    const question =
      questionMap.get(
        questionId,
      );

    if (
      !question
      ||
      Number(question.option_id) !== 4
    ) {

      throw new BadRequestException(
        'Annexure question not found',
      );
    }

    const answerId =
      Number(question.answer?.id || 0);

    if (
      !answerId
    ) {

      throw new BadRequestException(
        'Annexure answer not found',
      );
    }

    const activeEvidence =
      await this.db.findOne(
        `
SELECT id
FROM evidence_master
WHERE answer_id = $1
    AND annex_id = $2
    AND assesment_id = $3
    AND evi_type = 1
    AND deleted_at IS NULL
LIMIT 1;
        `,
        [
          answerId,
          annexureRowId,
          assessmentId,
        ],
      );

    if (
      activeEvidence?.id
    ) {
      return {
        success:
          false,
        message:
          'Remove the evidence before deleting this annexure row.',
      };
    }

    await this.db.query(
      `
UPDATE answers_data_annexure
SET deleted_at = NOW()
WHERE id = $1
    AND answer_id = $2
    AND assesment_id = $3
    AND deleted_at IS NULL;
      `,
      [
        annexureRowId,
        answerId,
        assessmentId,
      ],
    );

    return {
      success:
        true,
      message:
        'Annexure row deleted successfully',
    };
  }

  async uploadEvidence(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    annexureRowId: number,
    employeeId: number,
    file: {
      filename: string;
      mimetype: string;
      buffer: Buffer;
    },
  ) {

    const evidenceType =
      EVIDENCE_FILE_TYPES[file?.mimetype];

    if (
      !evidenceType
    ) {
      return {
        success:
          false,
        message:
          'Only JPG, JPEG, PNG and PDF evidence files are allowed.',
      };
    }

    if (
      !file?.buffer?.length
      ||
      file.buffer.length > EVIDENCE_MAX_SIZE
    ) {
      return {
        success:
          false,
        message:
          'Evidence file size must be less than or equal to 5 MB.',
      };
    }

    const target =
      await this.getEvidenceTarget(
        assessmentId,
        categoryId,
        questionId,
        annexureRowId,
        employeeId,
      );

    const existing =
      await this.db.findOne(
        `
SELECT id
FROM evidence_master
WHERE answer_id = $1
    AND annex_id = $2
    AND assesment_id = $3
    AND evi_type = 1
    AND deleted_at IS NULL
LIMIT 1;
        `,
        [
          target.answerId,
          annexureRowId,
          assessmentId,
        ],
      );

    if (
      existing?.id
    ) {
      return {
        success:
          false,
        message:
          'Evidence document already uploaded. Please remove it before uploading another file.',
      };
    }

    const storedName =
      `${randomUUID()}${evidenceType.extension}`;

    const storagePath =
      this.getEvidenceStoragePath(
        assessmentId,
        storedName,
      );

    fs.mkdirSync(
      path.dirname(storagePath),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      storagePath,
      file.buffer,
    );

    try {
      await this.db.query(
        `
INSERT INTO evidence_master (
    answer_id,
    annex_id,
    assesment_id,
    evi_type,
    file_name,
    file_type,
    description,
    emp_id,
    status_id,
    review_emp_id,
    deleted_by_emp_id,
    created_at,
    updated_at
)
VALUES ($1, $2, $3, 1, $4, $5, $6, $7, 0, 0, 0, NOW(), NOW());
        `,
        [
          target.answerId,
          annexureRowId,
          assessmentId,
          storedName,
          evidenceType.id,
          file.filename || null,
          employeeId,
        ],
      );
    } catch (
    error
    ) {
      if (
        fs.existsSync(storagePath)
      ) {
        fs.unlinkSync(storagePath);
      }

      throw error;
    }

    return {
      success:
        true,
      message:
        'Evidence uploaded successfully.',
    };
  }

  async getEvidenceFile(
    assessmentId: number,
    categoryId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    const evidence =
      await this.findAccessibleEvidence(
        assessmentId,
        categoryId,
        evidenceId,
        employeeId,
      );

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException(
        'Evidence file not found',
      );
    }

    return {
      path:
        filePath,
      filename:
        path.basename(
          String(
            evidence.description || evidence.file_name,
          ),
        ).replace(
          /["\r\n]/g,
          '_',
        ),
      mimetype:
        this.getEvidenceMimetype(
          Number(evidence.file_type),
        ),
    };
  }

  async deleteEvidence(
    assessmentId: number,
    categoryId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    const evidence =
      await this.findAccessibleEvidence(
        assessmentId,
        categoryId,
        evidenceId,
        employeeId,
      );

    if (
      Number(evidence.status_id) !== 0
    ) {
      return {
        success:
          false,
        message:
          'Reviewed evidence cannot be removed.',
      };
    }

    await this.db.query(
      `
UPDATE evidence_master
SET
    deleted_by_emp_id = $1,
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id = $2
    AND deleted_at IS NULL;
      `,
      [
        employeeId,
        evidenceId,
      ],
    );

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }

    return {
      success:
        true,
      message:
        'Evidence removed successfully.',
    };
  }

  async getAnnexureCsvSample(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
  ) {

    const {
      detail,
      question,
    } =
      await this.getAnnexureQuestionContext(
        assessmentId,
        categoryId,
        questionId,
        employeeId,
      );

    const sample =
      await this.buildAnnexureCsvSample(
        question,
        detail.annexure_risk_options,
      );

    return {
      success:
        true,
      filename:
        'sample-annexure.csv',
      csv:
        this.toCsv(
          sample.rows,
        ),
    };
  }

  async uploadAnnexureCsv(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
    file: {
      filename?: string;
      mimetype?: string;
      buffer: Buffer;
    },
  ) {

    if (
      !file?.buffer?.length
    ) {

      return {
        success:
          false,
        message:
          'Please select CSV file.',
      };
    }

    const filename =
      String(file.filename || '');

    const mimetype =
      String(file.mimetype || '');

    if (
      !filename.toLowerCase().endsWith('.csv')
      &&
      ![
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
      ].includes(mimetype)
    ) {

      return {
        success:
          false,
        message:
          'Only CSV files are allowed.',
      };
    }

    const {
      detail,
      question,
    } =
      await this.getAnnexureQuestionContext(
        assessmentId,
        categoryId,
        questionId,
        employeeId,
      );

    const parsedRows =
      this.parseCsv(
        file.buffer.toString('utf8'),
      );

    if (
      parsedRows.length < 2
    ) {

      return {
        success:
          false,
        message:
          'CSV does not contain annexure data rows.',
      };
    }

    const columns =
      question.annexure?.columns || [];

    const errors: any[] = [];
    const insertRows: any[] = [];

    for (
      let index = 1;
      index < parsedRows.length;
      index++
    ) {

      const row =
        parsedRows[index];

      if (
        row.every(
          (value) =>
            !this.cleanString(value),
        )
      ) {
        continue;
      }

      const values =
        columns.map(
          (_column: any, columnIndex: number) =>
            this.cleanString(
              row[columnIndex],
            ),
        );

      const rowErrors: string[] = [];

      const validationError =
        this.validateAnnexureValues(
          columns,
          values,
        );

      if (
        validationError
      ) {
        rowErrors.push(
          validationError,
        );
      }

      const risk =
        this.resolveAnnexureCsvRisk(
          question,
          detail.annexure_risk_options,
          row.slice(
            columns.length,
            columns.length + 3,
          ),
        );

      if (
        risk.error
      ) {
        rowErrors.push(
          risk.error,
        );
      }

      if (
        rowErrors.length
      ) {

        errors.push({
          row:
            index + 1,
          errors:
            rowErrors,
        });
        continue;
      }

      insertRows.push({
        values,
        business_risk:
          risk.business_risk,
        control_risk:
          risk.control_risk,
        risk_cat_id:
          risk.risk_cat_id,
      });
    }

    if (
      errors.length
    ) {

      return {
        success:
          false,
        message:
          'CSV has invalid annexure rows.',
        errors,
      };
    }

    if (
      !insertRows.length
    ) {

      return {
        success:
          false,
        message:
          'CSV does not contain valid annexure rows.',
      };
    }

    const parentAnswerId =
      await this.ensureAnnexureParentAnswer(
        detail,
        question,
        employeeId,
      );

    await this.db.transaction(
      async (client) => {

        for (
          const row
          of insertRows
        ) {

          await client.query(
            `
INSERT INTO answers_data_annexure (
    answer_id,
    assesment_id,
    answer_given,
    audit_comment,
    audit_emp_id,
    audit_status_id,
    audit_reviewer_emp_id,
    audit_reviewer_comment,
    audit_commpliance,
    compliance_evidance_upload,
    compliance_emp_id,
    compliance_status_id,
    compliance_reviewer_emp_id,
    compliance_reviewer_comment,
    business_risk,
    control_risk,
    risk_cat_id,
    batch_key
)
VALUES (
    $1, $2, $3, NULL, $4, $5, 0, NULL,
    NULL, NULL, 0, 0, 0, NULL, $6, $7, $8, $9
);
            `,
            [
              parentAnswerId,
              assessmentId,
              JSON.stringify(row.values),
              employeeId,
              Number(detail.overview.audit_status_id || 0),
              row.business_risk,
              row.control_risk,
              row.risk_cat_id,
              detail.overview.batch_key,
            ],
          );
        }
      },
    );

    return {
      success:
        true,
      message:
        `${insertRows.length} annexure row(s) uploaded successfully.`,
      inserted:
        insertRows.length,
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
        annexure:
          row.annexure_id
            ? {
              id:
                row.annexure_id,
              name:
                row.annexure_name,
              risk_defination_id:
                row.annexure_risk_defination_id,
              columns:
                row.annexure_columns || [],
            }
            : null,
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
              audit_compulsary_ev_upload:
                row.audit_compulsary_ev_upload,
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

  private collectQuestions(
    sets: any[],
    questionMap: Map<number, any>,
  ) {

    for (
      const set
      of sets || []
    ) {

      for (
        const header
        of set.headers || []
      ) {

        for (
          const question
          of header.questions || []
        ) {

          question.header_id =
            header.id;

          questionMap.set(
            Number(question.id),
            question,
          );

          this.collectQuestions(
            question.subset_sets || [],
            questionMap,
          );
        }
      }
    }
  }

  private async ensureAnnexureParentAnswer(
    detail: any,
    question: any,
    employeeId: number,
  ) {

    const assessmentId =
      Number(detail.overview.id);

    const categoryId =
      Number(detail.category.id);

    const existing =
      await this.db.findOne(
        `
SELECT id
FROM answers_data
WHERE assesment_id = $1
    AND category_id = $2
    AND header_id = $3
    AND question_id = $4
    AND dump_id = 0
    AND deleted_at IS NULL
LIMIT 1;
        `,
        [
          assessmentId,
          categoryId,
          question.header_id,
          question.id,
        ],
      );

    if (
      existing?.id
    ) {

      await this.db.query(
        `
UPDATE answers_data
SET
    answer_given = $1,
    audit_emp_id = $2,
    is_compliance = 1,
    business_risk = 1,
    control_risk = 1,
    batch_key = $3
WHERE id = $4;
        `,
        [
          String(question.annexure_id),
          employeeId,
          detail.overview.batch_key,
          existing.id,
        ],
      );

      return Number(existing.id);
    }

    const inserted =
      await this.db.findOne(
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
    $1, $2, $3, $4, $5, $6, 0, $7,
    NULL, $8, 0, 0, NULL, 1, NULL, NULL,
    0, 0, 0, NULL, 1, 1, 0, $9
)
RETURNING id;
        `,
        [
          detail.category.section_type_id || 0,
          assessmentId,
          detail.category.menu_id,
          categoryId,
          question.header_id,
          question.id,
          String(question.annexure_id),
          employeeId,
          detail.overview.batch_key,
        ],
      );

    return Number(inserted?.id || 0);
  }

  private validateAnnexureValues(
    columns: any[],
    values: any[],
  ) {

    if (
      !columns.length
    ) {

      return 'Annexure columns are not configured.';
    }

    if (
      columns.length !== values.length
    ) {

      return 'Annexure row values do not match configured columns.';
    }

    for (
      let i = 0;
      i < columns.length;
      i++
    ) {

      const value =
        this.cleanString(
          values[i],
        );

      if (
        !value
      ) {

        return 'Please fill all annexure columns.';
      }

      if (
        Number(columns[i].column_type_id) === 3
      ) {

        const options =
          columns[i].options || [];

        if (
          options.length
          &&
          !options.some(
            (option: any) =>
              this.cleanString(option.option_label)
              ===
              value,
          )
        ) {

          return 'Please select a valid annexure column option.';
        }
      }
    }

    return '';
  }

  private async getAnnexureQuestionContext(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    const question =
      questionMap.get(
        questionId,
      );

    if (
      !question
      ||
      Number(question.option_id) !== 4
      ||
      !question.annexure_id
    ) {

      throw new BadRequestException(
        'Annexure question not found',
      );
    }

    return {
      detail,
      question,
    };
  }

  private async buildAnnexureCsvSample(
    question: any,
    riskOptions: any,
  ) {

    const columns =
      question.annexure?.columns || [];

    const riskCategories =
      (riskOptions?.risk_categories || [])
        .filter(
          (risk: any) =>
            Number(risk.id) !== 10,
        );

    const headers = [
      ...columns.map(
        (column: any) =>
          String(
            column.name
            || column.column_name
            || '',
          ).toUpperCase(),
      ),
      'BUSINESS RISK',
      'CONTROL RISK',
      'RISK TYPE',
    ];

    const dataColumns =
      columns.map(
        (column: any) =>
          Number(column.column_type_id) === 3
            ? (column.options || []).map(
              (option: any) =>
                option.option_label,
            )
            : [],
      );

    const riskDefinitionId =
      Number(
        question.annexure?.risk_defination_id || 0,
      );

    if (
      riskDefinitionId === 1
    ) {

      dataColumns.push(
        (riskOptions?.business_risks || [])
          .map(
            (option: { label: any; }) =>
              option.label,
          ),
      );
      dataColumns.push(
        (riskOptions?.control_risks || [])
          .map(
            (option: { label: any; }) =>
              option.label,
          ),
      );
      dataColumns.push(
        riskCategories.map(
          (risk: any) =>
            risk.risk_category,
        ),
      );
    } else {

      const riskCategory =
        this.defaultAnnexureRiskCategory(
          riskCategories,
        );

      dataColumns.push(['HIGH RISK']);
      dataColumns.push(['HIGH RISK']);
      dataColumns.push([
        riskCategory?.risk_category || '',
      ]);
    }

    const totalRows =
      Math.max(
        1,
        ...dataColumns.map(
          (column: string | any[]) =>
            column.length,
        ),
      );

    const rows = [
      headers,
    ];

    for (
      let index = 0;
      index < totalRows;
      index++
    ) {

      rows.push(
        dataColumns.map(
          (column: any[]) =>
            column[index] || '',
        ),
      );
    }

    return {
      rows,
    };
  }

  private async getRiskCategories(
    includeNotApplicable = false,
  ) {

    const result =
      await this.db.query(
        `
SELECT id, risk_category
FROM risk_category_master
WHERE is_active = 1
    AND ($1 = true OR id != 10)
    AND deleted_at IS NULL
ORDER BY id;
        `,
        [includeNotApplicable],
      );

    return result.rows;
  }

  private async getAnnexureRiskOptions(
    yearId: number,
  ) {

    const result =
      await this.db.query(
        `
SELECT
    risk_parameter,
    business_risk_app,
    control_risk_app
FROM risk_matrix
WHERE year_id = $1
    AND deleted_at IS NULL
ORDER BY risk_parameter;
        `,
        [yearId],
      );

    const matrix =
      result.rows;

    const riskParameters =
      this.riskParameterOptions();

    const businessRisks =
      riskParameters.filter(
        (risk) =>
          matrix.some(
            (row: any) =>
              Number(row.risk_parameter) === risk.id
              &&
              Number(row.business_risk_app) === 1,
          ),
      );

    const controlRisks =
      riskParameters.filter(
        (risk) =>
          matrix.some(
            (row: any) =>
              Number(row.risk_parameter) === risk.id
              &&
              Number(row.control_risk_app) === 1,
          ),
      );

    return {
      business_risks:
        businessRisks.length
          ? businessRisks
          : riskParameters.slice(0, 3),
      control_risks:
        controlRisks.length
          ? controlRisks
          : riskParameters.slice(0, 3),
      risk_categories:
        await this.getRiskCategories(true),
    };
  }

  private riskParameterOptions() {

    return [
      {
        id:
          1,
        label:
          'HIGH RISK',
      },
      {
        id:
          2,
        label:
          'MEDIUM RISK',
      },
      {
        id:
          3,
        label:
          'LOW RISK',
      },
      {
        id:
          4,
        label:
          'NO RISK',
      },
    ];
  }

  private resolveAnnexureCsvRisk(
    question: any,
    riskOptions: any,
    riskValues: any[],
  ) {

    const riskDefinitionId =
      Number(
        question.annexure?.risk_defination_id || 0,
      );

    const riskCategories =
      (riskOptions?.risk_categories || [])
        .filter(
          (risk: any) =>
            Number(risk.id) !== 10,
        );

    const defaultRiskCategory =
      this.defaultAnnexureRiskCategory(
        riskCategories,
      );

    if (
      riskDefinitionId !== 1
    ) {

      return {
        error:
          '',
        business_risk:
          1,
        control_risk:
          1,
        risk_cat_id:
          Number(defaultRiskCategory?.id || 0),
      };
    }

    const businessRisk =
      this.findRiskParameter(
        riskValues[0],
        riskOptions?.business_risks || [],
      );

    const controlRisk =
      this.findRiskParameter(
        riskValues[1],
        riskOptions?.control_risks || [],
      );

    const riskCategory =
      this.findRiskCategory(
        riskValues[2],
        riskCategories,
      );

    if (
      !businessRisk
    ) {

      return {
        error:
          'Please select a valid business risk.',
      };
    }

    if (
      !controlRisk
    ) {

      return {
        error:
          'Please select a valid control risk.',
      };
    }

    if (
      !riskCategory
    ) {

      return {
        error:
          'Please select a valid risk type.',
      };
    }

    return {
      error:
        '',
      business_risk:
        businessRisk.id,
      control_risk:
        controlRisk.id,
      risk_cat_id:
        Number(riskCategory.id),
    };
  }

  private validateAnnexureRisk(
    question: any,
    riskOptions: any,
    body: any,
  ) {

    const riskDefinitionId =
      Number(
        question.annexure?.risk_defination_id || 0,
      );

    const defaultRiskCategory =
      this.defaultAnnexureRiskCategory(
        riskOptions?.risk_categories || [],
      );

    if (
      riskDefinitionId !== 1
    ) {

      return {
        error:
          '',
        business_risk:
          1,
        control_risk:
          1,
        risk_cat_id:
          Number(defaultRiskCategory?.id || 0),
      };
    }

    const businessRisk =
      (riskOptions?.business_risks || [])
        .find(
          (risk: any) =>
            Number(risk.id)
            ===
            Number(body?.business_risk),
        );

    if (
      !businessRisk
    ) {

      return {
        error:
          'Please select a valid business risk.',
      };
    }

    const controlRisk =
      (riskOptions?.control_risks || [])
        .find(
          (risk: any) =>
            Number(risk.id)
            ===
            Number(body?.control_risk),
        );

    if (
      !controlRisk
    ) {

      return {
        error:
          'Please select a valid control risk.',
      };
    }

    const riskCategory =
      (riskOptions?.risk_categories || [])
        .find(
          (risk: any) =>
            Number(risk.id)
            ===
            Number(body?.risk_cat_id),
        );

    if (
      !riskCategory
    ) {

      return {
        error:
          'Please select a valid risk type.',
      };
    }

    return {
      error:
        '',
      business_risk:
        Number(businessRisk.id),
      control_risk:
        Number(controlRisk.id),
      risk_cat_id:
        Number(riskCategory.id),
    };
  }

  private findRiskParameter(
    value: any,
    options: any[],
  ) {

    const normalized =
      this.normalizeLookupValue(
        value,
      );

    return options
      .find(
        (option) =>
          String(option.id) === normalized
          ||
          this.normalizeLookupValue(option.label)
          ===
          normalized,
      );
  }

  private defaultAnnexureRiskCategory(
    riskCategories: any[],
  ) {

    return riskCategories.find(
      (risk: any) =>
        Number(risk.id) === 1,
    )
      || riskCategories[0];
  }

  private findRiskCategory(
    value: any,
    riskCategories: any[],
  ) {

    const normalized =
      this.normalizeLookupValue(
        value,
      );

    return riskCategories.find(
      (risk: any) =>
        String(risk.id) === normalized
        ||
        this.normalizeLookupValue(risk.risk_category)
        ===
        normalized,
    );
  }

  private normalizeLookupValue(
    value: any,
  ) {

    return this.cleanString(value)
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private toCsv(
    rows: any[][],
  ) {

    return rows
      .map(
        (row) =>
          row.map(
            (value) => {

              const text =
                String(value ?? '');

              if (
                /[",\r\n]/.test(text)
              ) {

                return `"${text.replace(/"/g, '""')}"`;
              }

              return text;
            },
          ).join(','),
      )
      .join('\r\n');
  }

  private parseCsv(
    csv: string,
  ) {

    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;

    for (
      let index = 0;
      index < csv.length;
      index++
    ) {

      const char =
        csv[index];

      if (
        char === '"'
      ) {

        if (
          quoted
          &&
          csv[index + 1] === '"'
        ) {

          value += '"';
          index++;
        } else {

          quoted =
            !quoted;
        }

        continue;
      }

      if (
        char === ','
        &&
        !quoted
      ) {

        row.push(value);
        value = '';
        continue;
      }

      if (
        (char === '\n' || char === '\r')
        &&
        !quoted
      ) {

        if (
          char === '\r'
          &&
          csv[index + 1] === '\n'
        ) {
          index++;
        }

        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }

      value += char;
    }

    if (
      value
      ||
      row.length
    ) {

      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  private async attachAnnexureRows(
    sets: any[],
    assessmentId: number,
  ) {

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      sets,
      questionMap,
    );

    const answerIds =
      Array.from(
        questionMap.values(),
      )
        .map(
          (question: any) =>
            Number(question.answer?.id || 0),
        )
        .filter(Boolean);

    if (
      !answerIds.length
    ) {
      return;
    }

    const result =
      await this.db.query(
        `
SELECT
    id,
    answer_id,
    answer_given,
    business_risk,
    control_risk,
    risk_cat_id
FROM answers_data_annexure
WHERE assesment_id = $1
    AND answer_id = ANY($2::int[])
    AND deleted_at IS NULL
ORDER BY id;
        `,
        [
          assessmentId,
          answerIds,
        ],
      );

    const rowsByAnswer =
      new Map<number, any[]>();

    for (
      const row
      of result.rows
    ) {

      const answerId =
        Number(row.answer_id);

      if (
        !rowsByAnswer.has(answerId)
      ) {
        rowsByAnswer.set(answerId, []);
      }

      rowsByAnswer.get(answerId)?.push({
        id:
          row.id,
        values:
          this.parseJsonArray(
            row.answer_given,
          ),
        business_risk:
          row.business_risk,
        control_risk:
          row.control_risk,
        risk_cat_id:
          row.risk_cat_id,
      });
    }

    for (
      const question
      of questionMap.values()
    ) {

      const answerId =
        Number(question.answer?.id || 0);

      if (
        answerId
      ) {
        question.answer.annexure_rows =
          rowsByAnswer.get(answerId) || [];
      }
    }
  }

  private async attachEvidenceRows(
    sets: any[],
    assessmentId: number,
  ) {

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      sets,
      questionMap,
    );

    const answerIds =
      Array.from(
        questionMap.values(),
      )
        .map(
          (question: any) =>
            Number(question.answer?.id || 0),
        )
        .filter(Boolean);

    if (
      !answerIds.length
    ) {
      return;
    }

    const result =
      await this.db.query(
        `
SELECT
    id,
    answer_id,
    annex_id,
    file_name,
    file_type,
    description,
    status_id
FROM evidence_master
WHERE assesment_id = $1
    AND answer_id = ANY($2::int[])
    AND evi_type = 1
    AND deleted_at IS NULL
ORDER BY id DESC;
        `,
        [
          assessmentId,
          answerIds,
        ],
      );

    const evidenceByTarget =
      new Map<string, any>();

    for (
      const row
      of result.rows
    ) {
      evidenceByTarget.set(
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`,
        row,
      );
    }

    for (
      const question
      of questionMap.values()
    ) {

      const answerId =
        Number(question.answer?.id || 0);

      if (
        !answerId
      ) {
        continue;
      }

      question.answer.evidence =
        evidenceByTarget.get(
          `${answerId}:0`,
        ) || null;

      for (
        const row
        of question.answer.annexure_rows || []
      ) {
        row.evidence =
          evidenceByTarget.get(
            `${answerId}:${Number(row.id)}`,
          ) || null;
      }
    }
  }

  private async getEvidenceTarget(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    annexureRowId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    const question =
      questionMap.get(questionId);

    const answerId =
      Number(question?.answer?.id || 0);

    if (
      !question
      ||
      !answerId
    ) {
      throw new BadRequestException(
        'Save the answer before uploading evidence.',
      );
    }

    if (
      !annexureRowId
      &&
      Number(question.option_id) === 4
      &&
      question.annexure_id
      &&
      String(question.answer?.answer_given || '')
      === String(question.annexure_id)
    ) {
      throw new BadRequestException(
        'Upload evidence against an annexure row.',
      );
    }

    if (
      annexureRowId
      &&
      !(question.answer.annexure_rows || [])
        .some(
          (row: any) =>
            Number(row.id) === annexureRowId,
        )
    ) {
      throw new BadRequestException(
        'Annexure row not found',
      );
    }

    return {
      question,
      answerId,
    };
  }

  private async findAccessibleEvidence(
    assessmentId: number,
    categoryId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    for (
      const question
      of questionMap.values()
    ) {
      if (
        Number(question.answer?.evidence?.id || 0)
        === evidenceId
      ) {
        return question.answer.evidence;
      }

      const evidence =
        (question.answer?.annexure_rows || [])
          .find(
            (row: any) =>
              Number(row.evidence?.id || 0)
              === evidenceId,
          )?.evidence;

      if (
        evidence
      ) {
        return evidence;
      }
    }

    throw new NotFoundException(
      'Evidence not found',
    );
  }

  private getEvidenceStoragePath(
    assessmentId: number,
    filename: string,
  ) {

    return path.join(
      process.cwd(),
      'uploads',
      'audit-evidence',
      `evi_audit_${assessmentId}`,
      path.basename(filename),
    );
  }

  private getEvidenceMimetype(
    fileType: number,
  ) {

    return Object.entries(
      EVIDENCE_FILE_TYPES,
    ).find(
      ([, type]) =>
        type.id === fileType,
    )?.[0] || 'application/octet-stream';
  }

  private validateSubmissionSets(
    sets: any[],
    category: {
      id: number;
      name: string;
      menu_name: string;
    },
    issues: any[],
    compliancePoints: any[],
  ) {

    let complianceCount = 0;

    for (
      const set
      of sets || []
    ) {
      for (
        const header
        of set.headers || []
      ) {
        for (
          const question
          of header.questions || []
        ) {

          const answer =
            question.answer;

          const issueBase = {
            category_id:
              category.id,
            category_name:
              category.name,
            menu_name:
              category.menu_name,
            question_id:
              question.id,
            question:
              question.question,
          };

          if (
            !answer?.id
          ) {
            issues.push({
              ...issueBase,
              type:
                'answer',
              message:
                'Answer is pending.',
            });
            continue;
          }

          const isAnnexureAnswer =
            Number(question.option_id) === 4
            &&
            question.annexure_id
            &&
            String(answer.answer_given || '')
            === String(question.annexure_id);

          if (
            Number(answer.is_compliance || 0) === 1
          ) {
            complianceCount++;
            compliancePoints.push({
              ...issueBase,
              answer_given:
                isAnnexureAnswer
                  ? 'As per annexure'
                  : String(answer.answer_given || ''),
              audit_comment:
                answer.audit_comment || '',
            });
          }

          if (
            isAnnexureAnswer
          ) {

            const rows =
              answer.annexure_rows || [];

            if (
              !rows.length
            ) {
              issues.push({
                ...issueBase,
                type:
                  'annexure',
                message:
                  'At least one annexure row is required.',
              });
            }

            if (
              Number(answer.audit_compulsary_ev_upload || 0) === 1
            ) {
              for (
                const row
                of rows
              ) {
                if (
                  !row.evidence?.id
                ) {
                  issues.push({
                    ...issueBase,
                    annexure_row_id:
                      row.id,
                    type:
                      'evidence',
                    message:
                      'Evidence is pending for an annexure row.',
                  });
                }
              }
            }
          } else if (
            Number(answer.audit_compulsary_ev_upload || 0) === 1
            &&
            !answer.evidence?.id
          ) {
            issues.push({
              ...issueBase,
              type:
                'evidence',
              message:
                'Audit evidence is required.',
            });
          }

          if (
            Number(question.option_id) === 5
          ) {

            const subsetIds =
              String(question.subset_multi_id || '')
                .split(',')
                .map(
                  (value) =>
                    value.trim(),
                )
                .filter(Boolean);

            const selectedSubset =
              (question.subset_sets || [])
                .find(
                  (subset: any) =>
                    String(subset.id)
                    === String(answer.answer_given || ''),
                );

            if (
              selectedSubset
            ) {
              complianceCount +=
                this.validateSubmissionSets(
                  [selectedSubset],
                  category,
                  issues,
                  compliancePoints,
                );
            } else if (
              subsetIds.includes(
                String(answer.answer_given || ''),
              )
            ) {
              issues.push({
                ...issueBase,
                type:
                  'subset',
                message:
                  'Selected subset questions could not be validated.',
              });
            }
          }
        }
      }
    }

    return complianceCount;
  }

  private getSubsetIdsFromRows(
    rows: any[],
  ) {

    const ids =
      new Set<string>();

    for (
      const row
      of rows
    ) {

      if (
        Number(row.option_id) !== 5
        ||
        !row.subset_multi_id
      ) {
        continue;
      }

      String(row.subset_multi_id)
        .split(',')
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean)
        .forEach(
          (item) =>
            ids.add(item),
        );
    }

    return Array.from(ids);
  }

  private attachSubsetSets(
    parentSets: any[],
    subsetSets: any[],
  ) {

    const subsetMap =
      new Map<string, any>();

    for (
      const set
      of subsetSets
    ) {

      subsetMap.set(
        String(set.id),
        set,
      );
    }

    for (
      const set
      of parentSets
    ) {

      for (
        const header
        of set.headers || []
      ) {

        for (
          const question
          of header.questions || []
        ) {

          const subsetIds =
            String(
              question.subset_multi_id || '',
            )
              .split(',')
              .map(
                (item) =>
                  item.trim(),
              )
              .filter(Boolean);

          question.subset_sets =
            subsetIds
              .map(
                (id) =>
                  subsetMap.get(id),
              )
              .filter(Boolean);
        }
      }
    }
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

  private parseJsonArray(
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

      if (
        Array.isArray(parsed)
      ) {
        return parsed;
      }

      return Object.keys(parsed || {})
        .sort(
          (
            a,
            b,
          ) =>
            Number(a) - Number(b),
        )
        .map(
          (key) =>
            parsed[key],
        );
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
