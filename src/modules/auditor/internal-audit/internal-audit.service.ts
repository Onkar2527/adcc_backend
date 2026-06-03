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
const REMARK_TYPES: Record<number, string> = {
  1: 'Remark for Auditor',
  2: 'Remark for Reviewer',
  3: 'Remark for Compliance',
  4: 'Remark for Reviewer & Compliance',
  5: 'Remark for Auditor & Compliance',
};
const AUDITOR_REMARK_RECIPIENT_IDS = [2, 3, 4];
const AUDITOR_INCOMING_REMARK_IDS = [1, 5];
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
  private annexureRiskOptionsCache =
    new Map<number, any>();

  private riskCategoriesCache =
    new Map<string, any[]>();

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
                  ) !== 7,
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

    const year =
      date.getFullYear();
    const month =
      String(
        date.getMonth() + 1,
      ).padStart(2, '0');
    const day =
      String(
        date.getDate(),
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
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
    let latestAssessmentPeriodTo =
      unit.last_audit_date;

    for (
      const assessment
      of existingResult.rows
    ) {

      if (
        Number(
          assessment.audit_status_id,
        )
        !== 7
      ) {

        pendingAssessment = true;
      }

      latestAssessmentPeriodTo =
        assessment.assesment_period_to
        || latestAssessmentPeriodTo;

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
            latestAssessmentPeriodTo,
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

        const carryForwardCount =
          await this.createCarryForwardPoints(
            client,
            assessmentId,
            data,
            employeeId,
          );

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
          carry_forward_count:
            carryForwardCount,
          action:
            'continue',
          message:
            'Audit assessment started successfully',
        };
      },
    );
  }

  private async createCarryForwardPoints(
    client: any,
    assessmentId: number,
    data: any,
    employeeId: number,
  ) {
    const previousAssessments =
      await client.query(
        `
        SELECT id
        FROM audit_assesment_master
        WHERE audit_type_id = $1
            AND audit_unit_id = $2
            AND audit_status_id = 7
            AND COALESCE(compliance_carry_forward_count, 0) > 0
            AND id <> $3
            AND deleted_at IS NULL;
        `,
        [
          data.audit_type_id,
          data.audit_unit_id,
          assessmentId,
        ],
      );

    const previousIds =
      previousAssessments.rows.map(
        (row: any) =>
          Number(row.id),
      );

    if (
      !previousIds.length
    ) {
      return 0;
    }

    const carried =
      await client.query(
        `
        WITH cf_answers AS (
            SELECT
                ad.id AS old_answer_id,
                0::bigint AS old_annexure_id,
                ad.assesment_id AS old_assessment_id,
                ad.question_id,
                ad.dump_id,
                ad.answer_given,
                ad.audit_comment,
                ad.audit_commpliance,
                ad.compliance_reviewer_comment,
                ad.business_risk,
                ad.control_risk,
                qm.risk_category_id,
                mm.name AS menu_name,
                cm.name AS category_name,
                cm.linked_table_id,
                qhm.name AS header_name,
                qm.question
            FROM answers_data ad
            LEFT JOIN menu_master mm ON mm.id = ad.menu_id
            LEFT JOIN category_master cm ON cm.id = ad.category_id
            LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
            LEFT JOIN question_master qm ON qm.id = ad.question_id
            WHERE ad.assesment_id = ANY($1::int[])
                AND ad.is_compliance = 1
                AND ad.compliance_status_id = 5
                AND ad.deleted_at IS NULL
                AND COALESCE(ad.cf_asses_id, 0) = 0
                AND NOT EXISTS (
                    SELECT 1
                    FROM answers_data_annexure aa
                    WHERE aa.answer_id = ad.id
                        AND aa.assesment_id = ad.assesment_id
                        AND aa.compliance_status_id = 5
                        AND aa.deleted_at IS NULL
                        AND COALESCE(aa.cf_asses_id, 0) = 0
                )
        ),
        cf_annexure AS (
            SELECT
                ad.id AS old_answer_id,
                aa.id AS old_annexure_id,
                ad.assesment_id AS old_assessment_id,
                ad.question_id,
                ad.dump_id,
                aa.answer_given,
                aa.audit_comment,
                aa.audit_commpliance,
                aa.compliance_reviewer_comment,
                aa.business_risk,
                aa.control_risk,
                aa.risk_cat_id AS risk_category_id,
                mm.name AS menu_name,
                cm.name AS category_name,
                cm.linked_table_id,
                qhm.name AS header_name,
                qm.question
            FROM answers_data_annexure aa
            INNER JOIN answers_data ad
                ON ad.id = aa.answer_id
                AND ad.assesment_id = aa.assesment_id
                AND ad.is_compliance = 1
                AND ad.deleted_at IS NULL
            LEFT JOIN menu_master mm ON mm.id = ad.menu_id
            LEFT JOIN category_master cm ON cm.id = ad.category_id
            LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
            LEFT JOIN question_master qm ON qm.id = ad.question_id
            WHERE aa.assesment_id = ANY($1::int[])
                AND aa.compliance_status_id = 5
                AND aa.deleted_at IS NULL
                AND COALESCE(aa.cf_asses_id, 0) = 0
        )
        SELECT *
        FROM cf_answers
        UNION ALL
        SELECT *
        FROM cf_annexure
        ORDER BY old_assessment_id, old_answer_id, old_annexure_id;
        `,
        [
          previousIds,
        ],
      );

    if (
      !carried.rows.length
    ) {
      return 0;
    }

    const parent =
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
            audit_emp_id,
            audit_status_id,
            is_compliance,
            compliance_status_id,
            business_risk,
            control_risk,
            batch_key
        )
        VALUES ($1, $2, 0, 0, 0, 0, 0, 'CF', $3, 0, 1, 0, 1, 1, $4)
        RETURNING id;
        `,
        [
          data.audit_type_id,
          assessmentId,
          employeeId,
          data.batch_key,
        ],
      );

    const parentId =
      Number(parent.rows[0].id);

    for (
      const row
      of carried.rows
    ) {
      const payload = {
        assessment:
          `Assessment #${row.old_assessment_id}`,
        path:
          `Menu: ${row.menu_name || '-'}, Category: ${row.category_name || '-'}, Header: ${row.header_name || '-'}`,
        question:
          row.question || '-',
        answer:
          row.answer_given || '-',
        old_audit_comment:
          row.audit_comment || '',
        old_audit_compliance:
          row.audit_commpliance || '',
        old_compliance_reviewer_comment:
          row.compliance_reviewer_comment || '',
        old_answer_id:
          Number(row.old_answer_id || 0),
        old_annexure_id:
          Number(row.old_annexure_id || 0),
      };

      await client.query(
        `
        INSERT INTO answers_data_annexure (
            answer_id,
            assesment_id,
            answer_given,
            audit_emp_id,
            audit_status_id,
            compliance_status_id,
            business_risk,
            control_risk,
            risk_cat_id,
            batch_key
        )
        VALUES ($1, $2, $3, $4, 1, 0, $5, $6, $7, $8);
        `,
        [
          parentId,
          assessmentId,
          JSON.stringify(payload),
          employeeId,
          Number(row.business_risk || 1),
          Number(row.control_risk || 1),
          Number(row.risk_category_id || 1),
          data.batch_key,
        ],
      );
    }

    await client.query(
      `
      UPDATE answers_data
      SET cf_asses_id = $2,
          cf_transfer_date = CURRENT_DATE
      WHERE id = ANY($1::int[]);
      `,
      [
        carried.rows
          .filter((row: any) => !Number(row.old_annexure_id || 0))
          .map((row: any) => Number(row.old_answer_id)),
        assessmentId,
      ],
    );

    await client.query(
      `
      UPDATE answers_data_annexure
      SET cf_asses_id = $2,
          cf_transfer_date = CURRENT_DATE
      WHERE id = ANY($1::int[]);
      `,
      [
        carried.rows
          .filter((row: any) => Number(row.old_annexure_id || 0))
          .map((row: any) => Number(row.old_annexure_id)),
        assessmentId,
      ],
    );

    await client.query(
      `
      UPDATE audit_assesment_master
      SET menu_ids = CASE
          WHEN COALESCE(menu_ids, '') = '' THEN 'CF'
          WHEN 'CF' = ANY(string_to_array(menu_ids, ',')) THEN menu_ids
          ELSE CONCAT(menu_ids, ',CF')
      END
      WHERE id = $1;
      `,
      [
        assessmentId,
      ],
    );

    return carried.rows.length;
  }

  async rebuildCarryForwardPoints(
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

    const existing =
      await this.getCarryForwardCount(
        assessmentId,
      );

    if (
      existing > 0
    ) {
      return {
        success:
          true,
        carry_forward_count:
          existing,
        message:
          'Carry-forward points are already available for this assessment.',
      };
    }

    const count =
      await this.db.transaction(
        async (client) =>
          this.createCarryForwardPoints(
            client,
            assessmentId,
            assessment,
            employeeId,
          ),
      );

    return {
      success:
        true,
      carry_forward_count:
        count,
      message:
        count > 0
          ? 'Carry-forward points rebuilt successfully.'
          : 'No carry-forward points were found for this assessment.',
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

  // Audit Remarks

  async getRemarks(
    assessmentId: number,
    employeeId: number,
  ) {

    const assessment =
      await this.assertAuditorRemarkAccess(
        assessmentId,
        employeeId,
      );

    const result =
      await this.db.query(
        `
        SELECT
            ar.id,
            ar.subject,
            ar.message,
            ar.noti_type,
            ar.admin_id,
            ar.created_at,
            em.name AS author_name,
            em.emp_code AS author_code,
            EXISTS (
                SELECT 1
                FROM audit_remark_status ars
                WHERE ars.noti_id = ar.id
            ) AS has_been_read
        FROM audit_remarks ar
        LEFT JOIN employee_master em
            ON em.id = ar.admin_id
        WHERE ar.assesment_id = $1
            AND ar.deleted_at IS NULL
            AND (
                ar.admin_id = $2
                OR ar.noti_type = ANY($3::int[])
            )
        ORDER BY ar.id DESC;
        `,
        [
          assessmentId,
          employeeId,
          AUDITOR_INCOMING_REMARK_IDS,
        ],
      );

    const remarks =
      result.rows.map(
        (remark: any) => ({
          ...remark,
          noti_type_label:
            REMARK_TYPES[
            Number(remark.noti_type)
            ]
            || 'Remark',
          can_delete:
            Number(remark.admin_id)
            === employeeId
            &&
            !remark.has_been_read,
          is_unread:
            Number(remark.admin_id)
            !== employeeId
            &&
            !remark.has_been_read,
        }),
      );

    return {
      assessment_id:
        assessment.id,
      remark_types:
        AUDITOR_REMARK_RECIPIENT_IDS.map(
          (id) => ({
            id,
            name:
              REMARK_TYPES[id],
          }),
        ),
      current:
        remarks.filter(
          (remark: any) =>
            Number(remark.admin_id)
            === employeeId,
        ),
      other:
        remarks.filter(
          (remark: any) =>
            Number(remark.admin_id)
            !== employeeId,
        ),
      unread_count:
        remarks.filter(
          (remark: any) =>
            remark.is_unread,
        ).length,
    };
  }

  async saveRemark(
    assessmentId: number,
    employeeId: number,
    payload: any,
  ) {

    await this.assertAuditorRemarkAccess(
      assessmentId,
      employeeId,
    );

    const notiType =
      Number(payload?.noti_type || 0);
    const subject =
      String(payload?.subject || '')
        .trim();
    const message =
      String(payload?.message || '')
        .trim();

    if (
      !AUDITOR_REMARK_RECIPIENT_IDS.includes(
        notiType,
      )
    ) {

      throw new BadRequestException(
        'Please select a valid remark type.',
      );
    }

    if (
      !subject
    ) {

      throw new BadRequestException(
        'Remark subject is required.',
      );
    }

    if (
      !message
    ) {

      throw new BadRequestException(
        'Remark message is required.',
      );
    }

    await this.db.query(
      `
      INSERT INTO audit_remarks (
          subject,
          message,
          noti_type,
          assesment_id,
          admin_id
      ) VALUES ($1, $2, $3, $4, $5);
      `,
      [
        subject,
        message,
        notiType,
        assessmentId,
        employeeId,
      ],
    );

    return {
      success: true,
      message:
        'Assessment remark saved successfully.',
    };
  }

  async markRemarkRead(
    assessmentId: number,
    remarkId: number,
    employeeId: number,
  ) {

    await this.assertAuditorRemarkAccess(
      assessmentId,
      employeeId,
    );

    const remark =
      await this.db.query(
        `
        SELECT id
        FROM audit_remarks
        WHERE id = $1
            AND assesment_id = $2
            AND admin_id <> $3
            AND noti_type = ANY($4::int[])
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [
          remarkId,
          assessmentId,
          employeeId,
          AUDITOR_INCOMING_REMARK_IDS,
        ],
      );

    if (
      !remark.rows.length
    ) {

      throw new NotFoundException(
        'Remark not found.',
      );
    }

    await this.db.query(
      `
      INSERT INTO audit_remark_status (
          noti_id,
          emp_id,
          readed_at
      )
      SELECT $1, $2, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
          SELECT 1
          FROM audit_remark_status
          WHERE noti_id = $1
              AND emp_id = $2
      );
      `,
      [
        remarkId,
        employeeId,
      ],
    );

    return {
      success: true,
    };
  }

  async deleteRemark(
    assessmentId: number,
    remarkId: number,
    employeeId: number,
  ) {

    await this.assertAuditorRemarkAccess(
      assessmentId,
      employeeId,
    );

    const result =
      await this.db.query(
        `
        DELETE FROM audit_remarks ar
        WHERE ar.id = $1
            AND ar.assesment_id = $2
            AND ar.admin_id = $3
            AND ar.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1
                FROM audit_remark_status ars
                WHERE ars.noti_id = ar.id
            )
        RETURNING ar.id;
        `,
        [
          remarkId,
          assessmentId,
          employeeId,
        ],
      );

    if (
      !result.rows.length
    ) {

      throw new BadRequestException(
        'This remark was already read or cannot be removed.',
      );
    }

    return {
      success: true,
      message:
        'Assessment remark removed successfully.',
    };
  }

  // Menu

  async getMenu(
    assessmentId: number,
    employeeId: number,
  ) {

    const overview =
      await this.getOverview(
        assessmentId,
        employeeId,
      );

    const reAuditScope =
      Number(overview.audit_status_id) === 3
        ? await this.getReAuditScope(
          assessmentId,
        )
        : null;

    const query = `

      SELECT

          mm.id AS menu_id,
          mm.name AS menu_name,

          cm.id AS category_id,
          cm.name AS category_name,
          cm.linked_table_id,

          COUNT(DISTINCT qm.id)
              AS question_count,

          COUNT(DISTINCT ans.id)
              AS answered_count

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
          cm.linked_table_id

      ORDER BY

          mm.id,
          cm.id

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
        &&
        (
          !reAuditScope
          ||
          reAuditScope.categories.size === 0
          ||
          reAuditScope.categories.has(
            Number(row.category_id),
          )
        )
      ) {

        category = {

          id:
            row.category_id,

          name:
            row.category_name,

          linked_table_id:
            row.linked_table_id,

          question_count:
            reAuditScope && reAuditScope.categories.size > 0
              ? reAuditScope.categoryQuestionCount.get(
                Number(row.category_id),
              ) || 0
              : Number(
                row.question_count || 0,
              ),

          answered_count:
            reAuditScope && reAuditScope.categories.size > 0
              ? reAuditScope.categoryQuestionCount.get(
                Number(row.category_id),
              ) || 0
              : Number(
                row.answered_count || 0,
              ),

          question_sets:
            [],
        };

        menu.categories.push(
          category,
        );
      }

    }

    const accountCategoryTasks =
      Array.from(
        menuMap.values(),
      )
        .flatMap(
          (menu: any) =>
            menu.categories || [],
        )
        .filter(
          (category: any) =>
            [1, 2].includes(
              Number(category.linked_table_id),
            ),
        )
        .map(
          async (category: any) => {
            const accounts =
              await this.getSampledAccounts(
                category,
                overview,
              );

            const visibleAccounts =
              reAuditScope && reAuditScope.categories.size > 0
                ? accounts.filter(
                  (account: any) =>
                    reAuditScope.dumps.has(
                      `${Number(category.id)}:${Number(account.id)}`,
                    ),
                )
                : accounts;

            category.account_based =
              true;
            category.account_count =
              visibleAccounts.length;
            category.completed_account_count =
              visibleAccounts.filter(
                (account: any) =>
                  account.is_completed,
              ).length;
          },
        );

    await Promise.all(
      accountCategoryTasks,
    );

    const carryForwardCount =
      await this.getCarryForwardCount(
        assessmentId,
      );

    if (
      carryForwardCount > 0
    ) {
      menuMap.set(
        -1,
        {
          id:
            -1,
          name:
            'Carry Forward',
          categories:
            [
              {
                id:
                  0,
                name:
                  'Carry Forward Points',
                linked_table_id:
                  0,
                question_count:
                  carryForwardCount,
                answered_count:
                  carryForwardCount,
                carry_forward:
                  true,
              },
            ],
        },
      );
    }

    return {

      overview,

      menus:
        Array.from(
          menuMap.values(),
        ).filter(
          (menu: any) =>
            !reAuditScope
            ||
            menu.categories?.length,
        ),

    };
  }

  // Submit Assessment

  async getSubmissionPreview(
    assessmentId: number,
    employeeId: number,
  ) {
    return this.getAssessmentSubmissionPreview(
      assessmentId,
      employeeId,
    );
  }

  private async getAssessmentSubmissionPreview(
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
      Number(overview.audit_status_id) === 3
    ) {
      const reAuditScope =
        await this.getReAuditScope(
          assessmentId,
        );

      const pendingCorrections =
        await this.getReAuditPendingCorrectionCount(
          assessmentId,
          String(overview.batch_key || ''),
        );

      return {
        can_submit:
          reAuditScope.questions.size > 0
          &&
          pendingCorrections === 0,
        pending_count:
          pendingCorrections,
        compliance_count:
          reAuditScope.questions.size,
        compliance_points:
          [],
        message:
          !reAuditScope.questions.size
            ? 'No Reviewer-rejected audit observation is available for correction.'
            : pendingCorrections
              ? 'Save each Reviewer-rejected point after correction before resubmitting.'
              : 'Corrected re-audit points are ready to submit back to Reviewer.',
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
          'Current assessment is not pending with Auditor.',
        issues:
          [],
        overview,
      };
    }

    const pendingResult =
      await this.db.query(
        `
      WITH category_scope AS (
          SELECT
              cm.id AS category_id,
              cm.name AS category_name,
              cm.menu_id,
              cm.linked_table_id,
              mm.name AS menu_name,
              cm.question_set_ids
          FROM category_master cm
          INNER JOIN menu_master mm
              ON mm.id = cm.menu_id
              AND mm.is_active = 1
              AND mm.deleted_at IS NULL
          WHERE cm.is_active = 1
              AND cm.deleted_at IS NULL
              AND (
                  $2 = ''
                  OR cm.id::text = ANY(string_to_array($2, ','))
              )
              AND (
                  $1 = ''
                  OR mm.id::text = ANY(string_to_array($1, ','))
              )
      ),
      normal_questions AS (
          SELECT
              cs.menu_id,
              cs.menu_name,
              cs.category_id,
              cs.category_name,
              qhm.id AS header_id,
              qm.id AS question_id,
              qm.question
          FROM category_scope cs
          INNER JOIN question_set_master qsm
              ON qsm.id::text = ANY(
                  string_to_array(
                      COALESCE(cs.question_set_ids, ''),
                      ','
                  )
              )
              AND qsm.is_active = 1
              AND qsm.deleted_at IS NULL
          INNER JOIN question_header_master qhm
              ON qhm.question_set_id = qsm.id
              AND qhm.is_active = 1
              AND qhm.deleted_at IS NULL
              AND (
                  $3 = ''
                  OR qhm.id::text = ANY(string_to_array($3, ','))
              )
          INNER JOIN question_master qm
              ON qm.header_id = qhm.id
              AND qm.set_id = qsm.id
              AND qm.is_active = 1
              AND qm.deleted_at IS NULL
              AND (
                  $4 = ''
                  OR qm.id::text = ANY(string_to_array($4, ','))
              )
          WHERE COALESCE(cs.linked_table_id, 0) NOT IN (1, 2)
      )
      SELECT
          nq.menu_id,
          nq.menu_name,
          nq.category_id,
          nq.category_name,
          nq.header_id,
          nq.question_id,
          nq.question,
          ad.id AS answer_id,
          ad.answer_given
      FROM normal_questions nq
      LEFT JOIN answers_data ad
          ON ad.assesment_id = $5
          AND ad.category_id = nq.category_id
          AND ad.header_id = nq.header_id
          AND ad.question_id = nq.question_id
          AND COALESCE(ad.dump_id, 0) = 0
          AND ad.deleted_at IS NULL
      WHERE ad.id IS NULL
          OR COALESCE(TRIM(ad.answer_given), '') = ''
      ORDER BY
          nq.menu_id,
          nq.category_id,
          nq.header_id,
          nq.question_id;
      `,
        [
          overview.menu_ids || '',
          overview.cat_ids || '',
          overview.header_ids || '',
          overview.question_ids || '',
          assessmentId,
        ],
      );

    const annexurePendingResult =
      await this.db.query(
        `
    SELECT
        ad.menu_id,
        mm.name AS menu_name,
        ad.category_id,
        cm.name AS category_name,
        ad.header_id,
        ad.question_id,
        qm.question,
        ad.dump_id,
        'Annexure rows are required for selected annexure answer.' AS message
    FROM answers_data ad
    INNER JOIN question_master qm
        ON qm.id = ad.question_id
    LEFT JOIN menu_master mm
        ON mm.id = ad.menu_id
    LEFT JOIN category_master cm
        ON cm.id = ad.category_id
    WHERE ad.assesment_id = $1
        AND ad.deleted_at IS NULL
        AND qm.option_id = 4
        AND COALESCE(ad.answer_given, '') = qm.annexure_id::text
        AND NOT EXISTS (
            SELECT 1
            FROM answers_data_annexure ada
            WHERE ada.answer_id = ad.id
                AND ada.deleted_at IS NULL
        )
    ORDER BY
        ad.menu_id,
        ad.category_id,
        ad.header_id,
        ad.question_id;
    `,
        [
          assessmentId,
        ],
      );

    const complianceResult =
      await this.db.query(
        `
      SELECT
          ad.id,
          ad.menu_id,
          mm.name AS menu_name,
          ad.category_id,
          cm.name AS category_name,
          ad.header_id,
          qhm.name AS header_name,
          ad.question_id,
          qm.question,
          ad.dump_id,
          ad.answer_given,
          ad.audit_comment
      FROM answers_data ad
      LEFT JOIN menu_master mm
          ON mm.id = ad.menu_id
      LEFT JOIN category_master cm
          ON cm.id = ad.category_id
      LEFT JOIN question_header_master qhm
          ON qhm.id = ad.header_id
      LEFT JOIN question_master qm
          ON qm.id = ad.question_id
      WHERE ad.assesment_id = $1
          AND ad.is_compliance = 1
          AND ad.deleted_at IS NULL
      ORDER BY
          ad.menu_id,
          ad.category_id,
          ad.dump_id,
          ad.header_id,
          ad.question_id;
      `,
        [
          assessmentId,
        ],
      );

    const accountPendingResult =
      await this.db.query(
        `
      WITH account_categories AS (
          SELECT
              cm.id AS category_id,
              cm.name AS category_name,
              cm.linked_table_id,
              mm.name AS menu_name
          FROM category_master cm
          INNER JOIN menu_master mm
              ON mm.id = cm.menu_id
              AND mm.deleted_at IS NULL
          WHERE cm.deleted_at IS NULL
              AND cm.is_active = 1
              AND cm.linked_table_id IN (1, 2)
              AND (
                  $2 = ''
                  OR cm.id::text = ANY(string_to_array($2, ','))
              )
      )
      SELECT
          ac.category_id,
          ac.category_name,
          ac.menu_name,
          d.id AS dump_id,
          d.account_no,
          d.account_holder_name,
          'Account assessment is not marked complete.' AS message
      FROM account_categories ac
      INNER JOIN dump_deposits d
          ON ac.linked_table_id = 1
          AND d.sampling_filter = 1
          AND d.deleted_at IS NULL
          AND COALESCE(d.assesment_period_id, 0) <> $1
      UNION ALL
      SELECT
          ac.category_id,
          ac.category_name,
          ac.menu_name,
          a.id AS dump_id,
          a.account_no,
          a.account_holder_name,
          'Account assessment is not marked complete.' AS message
      FROM account_categories ac
      INNER JOIN dump_advances a
          ON ac.linked_table_id = 2
          AND a.sampling_filter = 1
          AND a.deleted_at IS NULL
          AND COALESCE(a.assesment_period_id, 0) <> $1
      ORDER BY
          category_id,
          dump_id;
      `,
        [
          assessmentId,
          overview.cat_ids || '',
        ],
      );

    const issues: any[] = [
      ...pendingResult.rows.map(
        (row: any) => ({
          category_id:
            row.category_id,
          category_name:
            row.category_name,
          menu_name:
            row.menu_name,
          header_id:
            row.header_id,
          question_id:
            row.question_id,
          question:
            row.question,
          type:
            'question',
          message:
            'Answer is pending.',
        }),
      ),

      ...annexurePendingResult.rows.map(
        (row: any) => ({
          category_id:
            row.category_id,
          category_name:
            row.category_name,
          menu_name:
            row.menu_name,
          header_id:
            row.header_id,
          question_id:
            row.question_id,
          question:
            row.question,
          dump_id:
            row.dump_id,
          type:
            'annexure',
          message:
            row.message,
        }),
      ),

      ...accountPendingResult.rows.map(
        (row: any) => ({
          category_id:
            row.category_id,
          category_name:
            row.category_name,
          menu_name:
            row.menu_name,
          dump_id:
            row.dump_id,
          account_no:
            row.account_no,
          account_holder_name:
            row.account_holder_name,
          question_id:
            0,
          question:
            row.account_no,
          type:
            'account',
          message:
            row.message,
        }),
      ),
    ];

    if (
      String(overview.menu_ids || '')
        .split(',')
        .map(
          (id: string) =>
            id.trim(),
        )
        .includes('1')
    ) {
      await this.appendExecutiveSummaryIssues(
        assessmentId,
        Number(overview.year_id),
        issues,
      );
    }

    return {
      can_submit:
        issues.length === 0,
      pending_count:
        issues.length,
      compliance_count:
        complianceResult.rows.length,
      compliance_points:
        complianceResult.rows,
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

        const currentStatus =
          Number(
            preview.overview.audit_status_id,
          );

        const updated =
          await client.query(
            `
            UPDATE audit_assesment_master
            SET
                audit_end_date = CURRENT_DATE,
                audit_status_id = 2,
                audit_emp_id = $2
            WHERE id = $1
                AND audit_status_id = $3
                AND deleted_at IS NULL
            RETURNING id;
            `,
            [
              assessmentId,
              employeeId,
              currentStatus,
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
        Number(preview.overview.audit_status_id) === 3
          ? 'Corrected audit points submitted back to Reviewer successfully.'
          : 'Audit submitted to reviewer successfully.',
      status_id:
        2,
      status:
        STATUS_LABELS[2],
    };
  }

  // Reveiwer

  async getReviewerPending(
    employeeId: number,
  ) {

    await this.assertReviewer(
      employeeId,
    );

    const result =
      await this.db.query(
        `
        SELECT
            aam.id,
            aam.audit_unit_id,
            aam.audit_status_id,
            aam.assesment_period_from,
            aam.assesment_period_to,
            aam.audit_end_date,
            au.audit_unit_code,
            au.name AS audit_unit_name,
            ym.year,
            COUNT(ad.id) FILTER (
                WHERE aam.audit_status_id = 2
                    OR ad.is_compliance = 1
            )::int AS total_points,
            COUNT(ad.id) FILTER (WHERE ad.is_compliance = 1)::int AS compliance_points,
            COUNT(ad.id) FILTER (
                WHERE (aam.audit_status_id = 2 AND ad.audit_status_id = 3)
                    OR (aam.audit_status_id = 5 AND ad.compliance_status_id = 3)
            )::int AS rejected_points,
            CASE
                WHEN aam.audit_status_id = 5 THEN 'Compliance Review'
                ELSE 'Audit Review'
            END AS review_stage
            FROM audit_assesment_master aam
            INNER JOIN audit_unit_master au
                ON au.id = aam.audit_unit_id
            LEFT JOIN year_master ym
                ON ym.id = aam.year_id
            LEFT JOIN answers_data ad
                ON ad.assesment_id = aam.id
                AND ad.deleted_at IS NULL
            WHERE aam.audit_status_id IN (2, 5)
              AND aam.deleted_at IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM employee_master em
                  WHERE em.id = $1
                      AND em.user_type_id = 4
                      AND em.deleted_at IS NULL
                      AND em.audit_unit_authority IS NOT NULL
                      AND EXISTS (
                          SELECT 1
                          FROM unnest(string_to_array(COALESCE(em.audit_unit_authority, ''), ',')) unit_id
                          WHERE trim(unit_id) = aam.audit_unit_id::text
                  )
        )
        GROUP BY
            aam.id,
            au.audit_unit_code,
            au.name,
            ym.year
        ORDER BY aam.audit_status_id, aam.audit_end_date DESC NULLS LAST, aam.id DESC;
        `, [employeeId]
      );

    return {
      assessments:
        result.rows,
    };
  }

  private async assertReviewerAuthority(
    assessmentId: number,
    employeeId: number,
  ) {
    await this.assertReviewer(
      employeeId,
    );

    const allowed =
      await this.db.findOne(
        `
      SELECT aam.id
      FROM audit_assesment_master aam
      INNER JOIN employee_master em
          ON em.id = $2
          AND em.user_type_id = 4
          AND em.deleted_at IS NULL
          AND em.audit_unit_authority IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM unnest(string_to_array(COALESCE(em.audit_unit_authority, ''), ',')) unit_id
              WHERE trim(unit_id) = aam.audit_unit_id::text
          )
      WHERE aam.id = $1
          AND aam.deleted_at IS NULL
      LIMIT 1;
      `,
        [
          assessmentId,
          employeeId,
        ],
      );

    if (
      !allowed
    ) {
      throw new BadRequestException(
        'Reviewer is not authorized for this audit unit.',
      );
    }
  }

  async getReviewerComplianceAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(overview.audit_status_id) !== 5
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const answerResult =
      await this.db.query(
        `
        SELECT
            ad.id,
            ad.menu_id,
            ad.category_id,
            ad.header_id,
            ad.question_id,
            ad.dump_id,
            ad.answer_given,
            ad.audit_comment,
            ad.is_compliance,
            ad.business_risk,
            ad.control_risk,
            ad.audit_reviewer_comment,
            ad.audit_commpliance AS compliance_response,
            ad.compliance_status_id,
            ad.compliance_reviewer_comment,
            mm.name AS menu_name,
            cm.name AS category_name,
            cm.linked_table_id,
            qhm.name AS header_name,
            qm.question,
            qm.option_id,
            qm.annexure_id,
            qm.compliance_ev_upload AS compliance_evidence_upload,
            ac.columns_json AS annexure_columns,
            au.name AS account_branch_name,
            COALESCE(dd.account_no, da.account_no) AS account_no,
            COALESCE(dd.account_holder_name, da.account_holder_name) AS account_holder_name,
            COALESCE(dd.ucic, da.ucic) AS ucic,
            COALESCE(dd.customer_type, da.customer_type) AS customer_type,
            COALESCE(dd.account_opening_date, da.account_opening_date) AS account_opening_date,
            da.renewal_date,
            COALESCE(dd.principal_amount, da.sanction_amount) AS account_amount,
            COALESCE(dd.intrest_rate, da.intrest_rate) AS interest_rate,
            COALESCE(dd.balance, da.outstanding_balance) AS outstanding_balance,
            COALESCE(dd.balance_date, da.balance_date) AS balance_date,
            da.due_date,
            da.npa_status,
            COALESCE(dd.account_status, da.account_status) AS account_status,
            sm.name AS scheme_name,
            sm.scheme_code
        FROM answers_data ad
        LEFT JOIN menu_master mm
            ON mm.id = ad.menu_id
        LEFT JOIN category_master cm
            ON cm.id = ad.category_id
        LEFT JOIN question_header_master qhm
            ON qhm.id = ad.header_id
        LEFT JOIN question_master qm
            ON qm.id = ad.question_id
        LEFT JOIN (
            SELECT
                ac.annexure_id,
                jsonb_agg(
                    jsonb_build_object(
                        'id', ac.id,
                        'name', ac.name,
                        'column_type_id', ac.column_type_id
                    )
                    ORDER BY ac.id
                ) AS columns_json
            FROM annexure_columns ac
            WHERE ac.deleted_at IS NULL
            GROUP BY ac.annexure_id
        ) ac
            ON ac.annexure_id = qm.annexure_id
        LEFT JOIN dump_deposits dd
            ON cm.linked_table_id = 1
            AND dd.id = ad.dump_id
            AND dd.deleted_at IS NULL
        LEFT JOIN dump_advances da
            ON cm.linked_table_id = 2
            AND da.id = ad.dump_id
            AND da.deleted_at IS NULL
        LEFT JOIN audit_unit_master au
            ON au.id = COALESCE(dd.branch_id, da.branch_id)
            AND au.deleted_at IS NULL
        LEFT JOIN scheme_master sm
            ON sm.id = COALESCE(dd.scheme_id, da.scheme_id)
            AND sm.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.is_compliance = 1
            AND ad.deleted_at IS NULL
        ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id;
        `,
        [assessmentId],
      );

    const answerIds =
      answerResult.rows.map(
        (row: any) =>
          Number(row.id),
      );

    let annexureRows: any[] = [];
    let evidenceRows: any[] = [];

    if (
      answerIds.length
    ) {
      const annexureResult =
        await this.db.query(
          `
          SELECT
              id,
              answer_id,
              answer_given,
              business_risk,
              control_risk,
              audit_commpliance AS compliance_response,
              compliance_status_id,
              compliance_reviewer_comment
          FROM answers_data_annexure
          WHERE assesment_id = $1
              AND answer_id = ANY($2::int[])
              AND deleted_at IS NULL
          ORDER BY answer_id, id;
          `,
          [
            assessmentId,
            answerIds,
          ],
        );

      annexureRows =
        annexureResult.rows;

      const evidenceResult =
        await this.db.query(
          `
          SELECT
              id,
              answer_id,
              annex_id,
              evi_type,
              file_name,
              file_type,
              description
          FROM evidence_master
          WHERE assesment_id = $1
              AND answer_id = ANY($2::int[])
              AND evi_type IN (1, 2)
              AND deleted_at IS NULL
          ORDER BY id DESC;
          `,
          [
            assessmentId,
            answerIds,
          ],
        );

      evidenceRows =
        evidenceResult.rows;
    }

    const annexureMap =
      new Map<number, any[]>();
    const auditEvidenceMap =
      new Map<string, any>();
    const complianceEvidenceMap =
      new Map<string, any>();

    for (
      const row
      of evidenceRows
    ) {
      const key =
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`;

      if (
        Number(row.evi_type) === 2
        &&
        !complianceEvidenceMap.has(key)
      ) {
        complianceEvidenceMap.set(
          key,
          row,
        );
      }

      if (
        Number(row.evi_type) === 1
        &&
        !auditEvidenceMap.has(key)
      ) {
        auditEvidenceMap.set(
          key,
          row,
        );
      }
    }

    for (
      const row
      of annexureRows
    ) {
      const answerId =
        Number(row.answer_id);
      const values =
        annexureMap.get(answerId)
        || [];

      values.push({
        ...row,
        values:
          this.parseJsonArray(
            row.answer_given,
          ),
        evidence:
          auditEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || null,
        compliance_evidence:
          complianceEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || null,
      });
      annexureMap.set(
        answerId,
        values,
      );
    }

    const answers =
      answerResult.rows.map(
        (row: any) => ({
          ...row,
          evidence:
            auditEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || null,
          compliance_evidence:
            complianceEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || null,
          annexure_rows:
            annexureMap.get(
              Number(row.id),
            ) || [],
        }),
      );

    return {
      overview,
      answers,
      counts:
        this.getReviewerComplianceCounts(
          answers,
        ),
    };
  }

  async getReviewerComplianceEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 5
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const evidence =
      await this.db.findOne(
        `
        SELECT
            em.file_name,
            em.file_type,
            em.description
        FROM evidence_master em
        INNER JOIN answers_data ad
            ON ad.id = em.answer_id
            AND ad.assesment_id = em.assesment_id
            AND ad.is_compliance = 1
            AND ad.deleted_at IS NULL
        WHERE em.id = $1
            AND em.assesment_id = $2
            AND em.evi_type IN (1, 2)
            AND em.deleted_at IS NULL
        LIMIT 1;
        `,
        [
          evidenceId,
          assessmentId,
        ],
      );

    if (
      !evidence
    ) {
      throw new NotFoundException(
        'Evidence document not found.',
      );
    }

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException(
        'Evidence file not found.',
      );
    }

    return {
      path:
        filePath,
      filename:
        path.basename(
          String(
            evidence.description
            || evidence.file_name,
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

  async saveReviewerComplianceAction(
    assessmentId: number,
    targetType: string,
    observationId: number,
    employeeId: number,
    action: number,
    comment: string,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    if (
      !['answer', 'annexure'].includes(
        targetType,
      )
    ) {
      throw new BadRequestException(
        'Invalid observation type.',
      );
    }

    if (
      ![2, 3, 5].includes(action)
    ) {
      throw new BadRequestException(
        'Choose Accepted, Re-Compliance Needed, or Carry Forward.',
      );
    }

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 5
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const result =
      await this.db.transaction(
        async (client) => {

          if (
            targetType === 'answer'
          ) {
            const parentResult =
              await client.query(
                `
                UPDATE answers_data
                SET
                    compliance_status_id = $1,
                    compliance_reviewer_emp_id = $2,
                    compliance_reviewer_comment = $3,
                    batch_key = $4
                WHERE id = $5
                    AND assesment_id = $6
                    AND is_compliance = 1
                    AND deleted_at IS NULL
                RETURNING id;
                `,
                [
                  action,
                  employeeId,
                  this.cleanString(comment)
                  || null,
                  assessment.batch_key,
                  observationId,
                  assessmentId,
                ],
              );

            if (
              parentResult.rows.length
            ) {
              await client.query(
                `
                UPDATE answers_data_annexure
                SET
                    compliance_status_id = $1,
                    compliance_reviewer_emp_id = $2,
                    batch_key = $3
                WHERE answer_id = $4
                    AND assesment_id = $5
                    AND deleted_at IS NULL;
                `,
                [
                  action,
                  employeeId,
                  assessment.batch_key,
                  observationId,
                  assessmentId,
                ],
              );
            }

            return parentResult;
          }

          const annexureResult =
            await client.query(
              `
              UPDATE answers_data_annexure aa
              SET
                  compliance_status_id = $1,
                  compliance_reviewer_emp_id = $2,
                  compliance_reviewer_comment = $3,
                  batch_key = $4
              WHERE aa.id = $5
                  AND aa.assesment_id = $6
                  AND aa.deleted_at IS NULL
                  AND EXISTS (
                      SELECT 1
                      FROM answers_data ad
                      WHERE ad.id = aa.answer_id
                          AND ad.assesment_id = aa.assesment_id
                          AND ad.is_compliance = 1
                          AND ad.deleted_at IS NULL
                  )
              RETURNING aa.id, aa.answer_id;
              `,
              [
                action,
                employeeId,
                this.cleanString(comment)
                || null,
                assessment.batch_key,
                observationId,
                assessmentId,
              ],
            );

          if (
            annexureResult.rows.length
          ) {
            const answerId =
              Number(
                annexureResult.rows[0].answer_id,
              );
            const remainingRejections =
              await client.query(
                `
                SELECT COUNT(*)::int AS rejected_count
                FROM answers_data_annexure
                WHERE answer_id = $1
                    AND assesment_id = $2
                    AND compliance_status_id = 3
                    AND deleted_at IS NULL;
                `,
                [
                  answerId,
                  assessmentId,
                ],
              );
            const parentStatus =
              Number(
                remainingRejections.rows[0]?.rejected_count || 0,
              ) > 0
                ? 3
                : 2;

            await client.query(
              `
              UPDATE answers_data
              SET
                  compliance_status_id = $1,
                  compliance_reviewer_emp_id = $2,
                  batch_key = $3
              WHERE id = $4
                  AND assesment_id = $5
                  AND is_compliance = 1
                  AND deleted_at IS NULL;
              `,
              [
                parentStatus,
                employeeId,
                assessment.batch_key,
                answerId,
                assessmentId,
              ],
            );
          }

          return annexureResult;
        },
      );

    if (
      !result.rows.length
    ) {
      throw new NotFoundException(
        'Compliance point not found for this assessment.',
      );
    }

    return {
      success:
        true,
      message:
        action === 2
          ? 'Compliance response accepted.'
          : action === 5
            ? 'Compliance response marked as carry forward.'
            : 'Compliance response marked for re-compliance.',
    };
  }

  private async getCarryForwardCount(
    assessmentId: number,
  ) {
    const result =
      await this.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM answers_data ad
        INNER JOIN answers_data_annexure aa
            ON aa.answer_id = ad.id
            AND aa.assesment_id = ad.assesment_id
            AND aa.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.answer_given = 'CF'
            AND ad.deleted_at IS NULL;
        `,
        [
          assessmentId,
        ],
      );

    return Number(
      result.rows[0]?.total || 0,
    );
  }

  async getCarryForwardPoints(
    assessmentId: number,
    employeeId: number,
  ) {
    const overview =
      await this.getOverview(
        assessmentId,
        employeeId,
      );

    const result =
      await this.db.query(
        `
        SELECT
            aa.id,
            aa.answer_given,
            aa.business_risk,
            aa.control_risk,
            aa.risk_cat_id
        FROM answers_data ad
        INNER JOIN answers_data_annexure aa
            ON aa.answer_id = ad.id
            AND aa.assesment_id = ad.assesment_id
            AND aa.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.answer_given = 'CF'
            AND ad.deleted_at IS NULL
        ORDER BY aa.id;
        `,
        [
          assessmentId,
        ],
      );

    return {
      overview,
      points:
        result.rows.map(
          (row: any) => ({
            id:
              row.id,
            data:
              this.parseJsonObject(
                row.answer_given,
              ),
            business_risk:
              row.business_risk,
            control_risk:
              row.control_risk,
            risk_cat_id:
              row.risk_cat_id,
          }),
        ),
    };
  }

  async submitReviewerComplianceAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 5
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const result =
      await this.db.transaction(
        async (client) => {

          await client.query(
            `
            UPDATE answers_data
            SET
                compliance_status_id = 2,
                compliance_reviewer_emp_id = $2
            WHERE assesment_id = $1
                AND is_compliance = 1
                AND COALESCE(compliance_status_id, 0) NOT IN (2, 3, 5)
                AND deleted_at IS NULL;
            `,
            [
              assessmentId,
              employeeId,
            ],
          );

          await client.query(
            `
            UPDATE answers_data_annexure aa
            SET
                compliance_status_id = 2,
                compliance_reviewer_emp_id = $2
            WHERE aa.assesment_id = $1
                AND COALESCE(aa.compliance_status_id, 0) NOT IN (2, 3, 5)
                AND aa.deleted_at IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM answers_data ad
                    WHERE ad.id = aa.answer_id
                        AND ad.assesment_id = aa.assesment_id
                        AND ad.is_compliance = 1
                        AND ad.deleted_at IS NULL
                );
            `,
            [
              assessmentId,
              employeeId,
            ],
          );

          const reviewSummary =
            await client.query(
              `
              SELECT (
                  (SELECT COUNT(*)
                      FROM answers_data
                      WHERE assesment_id = $1
                          AND is_compliance = 1
                          AND compliance_status_id = 3
                          AND deleted_at IS NULL)
                  +
                  (SELECT COUNT(*)
                      FROM answers_data_annexure aa
                      WHERE aa.assesment_id = $1
                          AND aa.compliance_status_id = 3
                          AND aa.deleted_at IS NULL
                          AND EXISTS (
                              SELECT 1
                              FROM answers_data ad
                              WHERE ad.id = aa.answer_id
                                  AND ad.assesment_id = aa.assesment_id
                                  AND ad.is_compliance = 1
                                  AND ad.deleted_at IS NULL
                          ))
              )::int AS rejected_count;
              `,
              [assessmentId],
            );
          const carryForwardSummary =
            await client.query(
              `
              SELECT (
                  (SELECT COUNT(*)
                      FROM answers_data
                      WHERE assesment_id = $1
                          AND is_compliance = 1
                          AND compliance_status_id = 5
                          AND deleted_at IS NULL)
                  +
                  (SELECT COUNT(*)
                      FROM answers_data_annexure aa
                      WHERE aa.assesment_id = $1
                          AND aa.compliance_status_id = 5
                          AND aa.deleted_at IS NULL
                          AND EXISTS (
                              SELECT 1
                              FROM answers_data ad
                              WHERE ad.id = aa.answer_id
                                  AND ad.assesment_id = aa.assesment_id
                                  AND ad.is_compliance = 1
                                  AND ad.deleted_at IS NULL
                          ))
              )::int AS carry_forward_count;
              `,
              [assessmentId],
            );

          const rejectedCount =
            Number(
              reviewSummary.rows[0]?.rejected_count || 0,
            );
          const carryForwardCount =
            Number(
              carryForwardSummary.rows[0]?.carry_forward_count || 0,
            );
          const nextStatus =
            rejectedCount > 0
              ? 6
              : 7;

          const updated =
            await client.query(
              `
              UPDATE audit_assesment_master
              SET
                  audit_status_id = $2::bigint,
                  compliance_review_emp_id = $3,
                  compliance_review_date = CURRENT_DATE,
                  compliance_carry_forward_count = CASE
                      WHEN $2::bigint = 7 THEN $4::bigint
                      ELSE compliance_carry_forward_count
                  END,
                  batch_key = CASE
                      WHEN $2::bigint = 6
                      THEN CONCAT('C-', TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSMS'))
                      ELSE batch_key
                  END
              WHERE id = $1
                  AND audit_status_id = 5
                  AND deleted_at IS NULL
              RETURNING batch_key;
              `,
              [
                assessmentId,
                nextStatus,
                employeeId,
                carryForwardCount,
              ],
            );

          if (
            !updated.rows.length
          ) {
            throw new BadRequestException(
              'Compliance review status has changed.',
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
            VALUES ($1, 2, $2, $3, $4, $5);
            `,
            [
              assessmentId,
              nextStatus,
              rejectedCount,
              employeeId,
              updated.rows[0].batch_key,
            ],
          );

          return {
            rejectedCount,
            nextStatus,
            carryForwardCount,
          };
        },
      );

    return {
      success:
        true,
      status_id:
        result.nextStatus,
      rejected_count:
        result.rejectedCount,
      carry_forward_count:
        result.carryForwardCount,
      message:
        result.nextStatus === 6
          ? 'Compliance review submitted. Rejected responses returned to Manager.'
          : 'Compliance review submitted. Assessment completed.',
    };
  }

  async getReviewerAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(overview.audit_status_id) !== 2
    ) {
      throw new BadRequestException(
        'Assessment is not pending for audit review.',
      );
    }

    const answerResult =
      await this.db.query(
        `
        SELECT
            ad.id,
            ad.menu_id,
            ad.category_id,
            ad.header_id,
            ad.question_id,
            ad.dump_id,
            ad.answer_given,
            ad.audit_comment,
            ad.is_compliance,
            ad.business_risk,
            ad.control_risk,
            ad.audit_status_id,
            ad.audit_reviewer_comment,
            mm.name AS menu_name,
            cm.name AS category_name,
            cm.linked_table_id,
            qhm.name AS header_name,
            qm.question,
            qm.option_id,
            qm.annexure_id,
            qm.compliance_ev_upload AS compliance_evidence_upload,
            ac.columns_json AS annexure_columns,
            au.name AS account_branch_name,
            COALESCE(dd.account_no, da.account_no) AS account_no,
            COALESCE(dd.account_holder_name, da.account_holder_name) AS account_holder_name,
            COALESCE(dd.ucic, da.ucic) AS ucic,
            COALESCE(dd.customer_type, da.customer_type) AS customer_type,
            COALESCE(dd.account_opening_date, da.account_opening_date) AS account_opening_date,
            da.renewal_date,
            COALESCE(dd.principal_amount, da.sanction_amount) AS account_amount,
            COALESCE(dd.intrest_rate, da.intrest_rate) AS interest_rate,
            COALESCE(dd.balance, da.outstanding_balance) AS outstanding_balance,
            COALESCE(dd.balance_date, da.balance_date) AS balance_date,
            da.due_date,
            da.npa_status,
            COALESCE(dd.account_status, da.account_status) AS account_status,
            sm.name AS scheme_name,
            sm.scheme_code
        FROM answers_data ad
        LEFT JOIN menu_master mm
            ON mm.id = ad.menu_id
        LEFT JOIN category_master cm
            ON cm.id = ad.category_id
        LEFT JOIN question_header_master qhm
            ON qhm.id = ad.header_id
        LEFT JOIN question_master qm
            ON qm.id = ad.question_id
        LEFT JOIN (
            SELECT
                ac.annexure_id,
                jsonb_agg(
                    jsonb_build_object(
                        'id', ac.id,
                        'name', ac.name,
                        'column_type_id', ac.column_type_id
                    )
                    ORDER BY ac.id
                ) AS columns_json
            FROM annexure_columns ac
            WHERE ac.deleted_at IS NULL
            GROUP BY ac.annexure_id
        ) ac
            ON ac.annexure_id = qm.annexure_id
        LEFT JOIN dump_deposits dd
            ON cm.linked_table_id = 1
            AND dd.id = ad.dump_id
            AND dd.deleted_at IS NULL
        LEFT JOIN dump_advances da
            ON cm.linked_table_id = 2
            AND da.id = ad.dump_id
            AND da.deleted_at IS NULL
        LEFT JOIN audit_unit_master au
            ON au.id = COALESCE(dd.branch_id, da.branch_id)
            AND au.deleted_at IS NULL
        LEFT JOIN scheme_master sm
            ON sm.id = COALESCE(dd.scheme_id, da.scheme_id)
            AND sm.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.deleted_at IS NULL
        ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id;
        `,
        [assessmentId],
      );

    const answerIds =
      answerResult.rows.map(
        (row: any) =>
          Number(row.id),
      );

    let annexureRows: any[] = [];
    let evidenceRows: any[] = [];

    if (
      answerIds.length
    ) {
      const annexureResult =
        await this.db.query(
          `
          SELECT
              id,
              answer_id,
              answer_given,
              business_risk,
              control_risk,
              audit_status_id,
              audit_reviewer_comment
          FROM answers_data_annexure
          WHERE assesment_id = $1
              AND answer_id = ANY($2::int[])
              AND deleted_at IS NULL
          ORDER BY answer_id, id;
          `,
          [
            assessmentId,
            answerIds,
          ],
        );

      annexureRows =
        annexureResult.rows;

      const evidenceResult =
        await this.db.query(
          `
          SELECT
              id,
              answer_id,
              annex_id,
              file_name,
              file_type,
              description
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

      evidenceRows =
        evidenceResult.rows;
    }

    const annexureMap =
      new Map<number, any[]>();
    const evidenceMap =
      new Map<string, any>();

    for (
      const row
      of evidenceRows
    ) {
      const key =
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`;

      if (
        !evidenceMap.has(key)
      ) {
        evidenceMap.set(
          key,
          row,
        );
      }
    }

    for (
      const row
      of annexureRows
    ) {
      const answerId =
        Number(row.answer_id);
      const values =
        annexureMap.get(answerId)
        || [];

      values.push({
        ...row,
        values:
          this.parseJsonArray(
            row.answer_given,
          ),
        evidence:
          evidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || null,
      });
      annexureMap.set(
        answerId,
        values,
      );
    }

    const answers =
      answerResult.rows.map(
        (row: any) => ({
          ...row,
          evidence:
            evidenceMap.get(
              `${Number(row.id)}:0`,
            ) || null,
          annexure_rows:
            annexureMap.get(
              Number(row.id),
            ) || [],
        }),
      );

    return {
      overview,
      answers,
      counts:
        this.getReviewerCounts(
          answers,
        ),
    };
  }

  async getReviewerEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 2
    ) {
      throw new BadRequestException(
        'Assessment is not pending for audit review.',
      );
    }

    const evidence =
      await this.db.findOne(
        `
        SELECT
            em.file_name,
            em.file_type,
            em.description
        FROM evidence_master em
        INNER JOIN answers_data ad
            ON ad.id = em.answer_id
            AND ad.assesment_id = em.assesment_id
            AND ad.deleted_at IS NULL
        WHERE em.id = $1
            AND em.assesment_id = $2
            AND em.evi_type = 1
            AND em.deleted_at IS NULL
        LIMIT 1;
        `,
        [
          evidenceId,
          assessmentId,
        ],
      );

    if (
      !evidence
    ) {
      throw new NotFoundException(
        'Evidence document not found.',
      );
    }

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException(
        'Evidence file not found.',
      );
    }

    return {
      path:
        filePath,
      filename:
        path.basename(
          String(
            evidence.description
            || evidence.file_name,
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

  async saveReviewerAction(
    assessmentId: number,
    targetType: string,
    observationId: number,
    employeeId: number,
    action: number,
    comment: string,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    if (
      !['answer', 'annexure'].includes(
        targetType,
      )
    ) {
      throw new BadRequestException(
        'Invalid observation type.',
      );
    }

    if (
      ![2, 3].includes(action)
    ) {
      throw new BadRequestException(
        'Choose Accepted or Re-Audit Needed.',
      );
    }

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 2
    ) {
      throw new BadRequestException(
        'Assessment is not pending for audit review.',
      );
    }

    const table =
      targetType === 'answer'
        ? 'answers_data'
        : 'answers_data_annexure';

    const result =
      await this.db.query(
        `
        UPDATE ${table}
        SET
            audit_status_id = $1,
            audit_reviewer_emp_id = $2,
            audit_reviewer_comment = $3
        WHERE id = $4
            AND assesment_id = $5
            AND deleted_at IS NULL
        RETURNING id;
        `,
        [
          action,
          employeeId,
          this.cleanString(comment)
          || null,
          observationId,
          assessmentId,
        ],
      );

    if (
      !result.rows.length
    ) {
      throw new NotFoundException(
        'Observation not found for this assessment.',
      );
    }

    return {
      success:
        true,
      message:
        action === 2
          ? 'Observation accepted.'
          : 'Observation marked for re-audit.',
    };
  }

  async submitReviewerAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 2
    ) {
      throw new BadRequestException(
        'Assessment is not pending for audit review.',
      );
    }

    const result =
      await this.db.transaction(
        async (client) => {

          await client.query(
            `
            UPDATE answers_data
            SET
                audit_status_id = 2,
                audit_reviewer_emp_id = $2
            WHERE assesment_id = $1
                AND COALESCE(audit_status_id, 0) NOT IN (2, 3)
                AND deleted_at IS NULL;
            `,
            [
              assessmentId,
              employeeId,
            ],
          );

          await client.query(
            `
            UPDATE answers_data_annexure
            SET
                audit_status_id = 2,
                audit_reviewer_emp_id = $2
            WHERE assesment_id = $1
                AND COALESCE(audit_status_id, 0) NOT IN (2, 3)
                AND deleted_at IS NULL;
            `,
            [
              assessmentId,
              employeeId,
            ],
          );

          const reviewSummary =
            await client.query(
              `
              SELECT (
                  (SELECT COUNT(*) FROM answers_data
                      WHERE assesment_id = $1
                          AND audit_status_id = 3
                          AND deleted_at IS NULL)
                  +
                  (SELECT COUNT(*) FROM answers_data_annexure
                      WHERE assesment_id = $1
                          AND audit_status_id = 3
                          AND deleted_at IS NULL)
              )::int AS rejected_count,
              (
                  SELECT COUNT(*)
                  FROM answers_data
                  WHERE assesment_id = $1
                      AND is_compliance = 1
                      AND deleted_at IS NULL
              )::int AS compliance_count;
              `,
              [assessmentId],
            );

          const rejectedCount =
            Number(
              reviewSummary.rows[0]?.rejected_count || 0,
            );
          const complianceCount =
            Number(
              reviewSummary.rows[0]?.compliance_count || 0,
            );
          const nextStatus =
            rejectedCount > 0
              ? 3
              : complianceCount > 0
                ? 4
                : 7;

          const updated =
            await client.query(
              `
              UPDATE audit_assesment_master
              SET
                  audit_status_id = $2::bigint,
                  audit_review_emp_id = $3,
                  audit_review_date = CURRENT_DATE,
                  compliance_start_date = CASE WHEN $2::bigint = 4 THEN CURRENT_DATE ELSE compliance_start_date END,
                  compliance_due_date = CASE WHEN $2::bigint = 4 THEN CURRENT_DATE + INTERVAL '16 days' ELSE compliance_due_date END,
                  batch_key = CASE
                      WHEN $2::bigint = 3
                      THEN CONCAT('A-', TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSMS'))
                      ELSE batch_key
                  END
              WHERE id = $1
                  AND audit_status_id = 2
                  AND deleted_at IS NULL
              RETURNING batch_key;
              `,
              [
                assessmentId,
                nextStatus,
                employeeId,
              ],
            );

          if (
            !updated.rows.length
          ) {
            throw new BadRequestException(
              'Assessment review status has changed.',
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
            VALUES ($1, 1, $2, $3, $4, $5);
            `,
            [
              assessmentId,
              nextStatus,
              rejectedCount,
              employeeId,
              updated.rows[0].batch_key,
            ],
          );

          return {
            rejectedCount,
            complianceCount,
            nextStatus,
          };
        },
      );

    return {
      success:
        true,
      status_id:
        result.nextStatus,
      rejected_count:
        result.rejectedCount,
      message:
        result.nextStatus === 3
          ? 'Review submitted. Rejected observations returned to Auditor.'
          : result.nextStatus === 4
            ? 'Review submitted. Assessment sent to Manager for compliance.'
            : 'Review submitted. Assessment completed with no compliance action required.',
    };
  }

  // Compliance

  async getCompliancePending(
    employeeId: number,
  ) {

    await this.assertCompliance(
      employeeId,
    );

    const result =
      await this.db.query(
        `
        SELECT
            aam.id,
            aam.audit_unit_id,
            aam.audit_status_id,
            aam.assesment_period_from,
            aam.assesment_period_to,
            aam.compliance_start_date,
            aam.compliance_due_date,
            au.audit_unit_code,
            au.name AS audit_unit_name,
            ym.year,
            CASE
                WHEN aam.audit_status_id = 6 THEN 'Re-Compliance'
                ELSE 'Compliance'
            END AS compliance_stage,
            (
                COUNT(DISTINCT ad.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR ad.compliance_status_id = 3
                        )
                )
                +
                COUNT(DISTINCT aa.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND aa.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR aa.compliance_status_id = 3
                        )
                )
            )::int AS compliance_points,
            (
                COUNT(DISTINCT ad.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR ad.compliance_status_id = 3
                        )
                        AND NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NOT NULL
                        AND (
                            aam.audit_status_id = 4
                            OR ad.batch_key = aam.batch_key
                        )
                )
                +
                COUNT(DISTINCT aa.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND aa.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR aa.compliance_status_id = 3
                        )
                        AND NULLIF(BTRIM(COALESCE(aa.audit_commpliance, '')), '') IS NOT NULL
                        AND (
                            aam.audit_status_id = 4
                            OR aa.batch_key = aam.batch_key
                        )
                )
            )::int AS responded_points
        FROM audit_assesment_master aam
        INNER JOIN audit_unit_master au
            ON au.id = aam.audit_unit_id
        LEFT JOIN year_master ym
            ON ym.id = aam.year_id
        LEFT JOIN answers_data ad
            ON ad.assesment_id = aam.id
            AND ad.deleted_at IS NULL
        LEFT JOIN answers_data_annexure aa
            ON aa.answer_id = ad.id
            AND aa.assesment_id = ad.assesment_id
            AND aa.deleted_at IS NULL
        WHERE aam.audit_status_id IN (4, 6)
            AND aam.deleted_at IS NULL
            AND EXISTS (
              SELECT 1
              FROM employee_master em
              WHERE em.id = $1
                  AND em.deleted_at IS NULL
                  AND em.audit_unit_authority IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM unnest(
                          string_to_array(
                              COALESCE(em.audit_unit_authority, ''),
                              ','
                          )
                      ) unit_id
                      WHERE trim(unit_id) = aam.audit_unit_id::text
                  )
          )
        GROUP BY
            aam.id,
            au.audit_unit_code,
            au.name,
            ym.year
        ORDER BY aam.compliance_start_date DESC NULLS LAST, aam.id DESC;
        `, [employeeId]
      );

    return {
      assessments:
        result.rows,
    };
  }

  private async assertComplianceAuthority(
    assessmentId: number,
    employeeId: number,
  ) {
    await this.assertCompliance(
      employeeId,
    );

    const allowed =
      await this.db.findOne(
        `
      SELECT aam.id
      FROM audit_assesment_master aam
      INNER JOIN employee_master em
          ON em.id = $2
          AND em.deleted_at IS NULL
          AND em.audit_unit_authority IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM unnest(string_to_array(COALESCE(em.audit_unit_authority, ''), ',')) unit_id
              WHERE trim(unit_id) = aam.audit_unit_id::text
          )
      WHERE aam.id = $1
          AND aam.deleted_at IS NULL
      LIMIT 1;
      `,
        [
          assessmentId,
          employeeId,
        ],
      );

    if (
      !allowed
    ) {
      throw new BadRequestException(
        'Compliance user is not authorized for this audit unit.',
      );
    }
  }

  async getComplianceAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.findAssessment(
        assessmentId,
      );

    const complianceStatus =
      Number(overview.audit_status_id);

    if (
      ![4, 6].includes(
        complianceStatus,
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const answerResult =
      await this.db.query(
        `
        SELECT
            ad.id,
            ad.menu_id,
            ad.category_id,
            ad.header_id,
            ad.question_id,
            ad.dump_id,
            ad.answer_given,
            ad.audit_comment,
            ad.is_compliance,
            ad.business_risk,
            ad.control_risk,
            ad.audit_status_id,
            ad.audit_reviewer_comment,
            ad.audit_commpliance AS compliance_response,
            ad.compliance_status_id,
            ad.compliance_reviewer_comment,
            ad.batch_key,
            mm.name AS menu_name,
            cm.name AS category_name,
            cm.linked_table_id,
            qhm.name AS header_name,
            qm.question,
            qm.option_id,
            qm.annexure_id,
            ac.columns_json AS annexure_columns,
            au.name AS account_branch_name,
            COALESCE(dd.account_no, da.account_no) AS account_no,
            COALESCE(dd.account_holder_name, da.account_holder_name) AS account_holder_name,
            COALESCE(dd.ucic, da.ucic) AS ucic,
            COALESCE(dd.customer_type, da.customer_type) AS customer_type,
            COALESCE(dd.account_opening_date, da.account_opening_date) AS account_opening_date,
            da.renewal_date,
            COALESCE(dd.principal_amount, da.sanction_amount) AS account_amount,
            COALESCE(dd.intrest_rate, da.intrest_rate) AS interest_rate,
            COALESCE(dd.balance, da.outstanding_balance) AS outstanding_balance,
            COALESCE(dd.balance_date, da.balance_date) AS balance_date,
            da.due_date,
            da.npa_status,
            COALESCE(dd.account_status, da.account_status) AS account_status,
            sm.name AS scheme_name,
            sm.scheme_code
        FROM answers_data ad
        LEFT JOIN menu_master mm
            ON mm.id = ad.menu_id
        LEFT JOIN category_master cm
            ON cm.id = ad.category_id
        LEFT JOIN question_header_master qhm
            ON qhm.id = ad.header_id
        LEFT JOIN question_master qm
            ON qm.id = ad.question_id
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
            ) aco ON aco.annexure_column_id = ac.id
            WHERE ac.deleted_at IS NULL
            GROUP BY ac.annexure_id
        ) ac ON ac.annexure_id = qm.annexure_id
        LEFT JOIN dump_deposits dd
            ON cm.linked_table_id = 1
            AND dd.id = ad.dump_id
            AND dd.deleted_at IS NULL
        LEFT JOIN dump_advances da
            ON cm.linked_table_id = 2
            AND da.id = ad.dump_id
            AND da.deleted_at IS NULL
        LEFT JOIN audit_unit_master au
            ON au.id = COALESCE(dd.branch_id, da.branch_id)
            AND au.deleted_at IS NULL
        LEFT JOIN scheme_master sm
            ON sm.id = COALESCE(dd.scheme_id, da.scheme_id)
            AND sm.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.is_compliance = 1
            AND ad.audit_status_id = 2
            AND ad.deleted_at IS NULL
            AND (
                $2::int = 4
                OR ad.compliance_status_id = 3
                OR EXISTS (
                    SELECT 1
                    FROM answers_data_annexure aa
                    WHERE aa.answer_id = ad.id
                        AND aa.assesment_id = ad.assesment_id
                        AND aa.compliance_status_id = 3
                        AND aa.deleted_at IS NULL
                )
            )
        ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id;
        `,
        [
          assessmentId,
          complianceStatus,
        ],
      );

    const answerIds =
      answerResult.rows.map(
        (row: any) =>
          Number(row.id),
      );

    let annexureRows: any[] = [];
    let evidenceRows: any[] = [];

    if (
      answerIds.length
    ) {
      const annexureResult =
        await this.db.query(
          `
          SELECT
              id,
              answer_id,
              answer_given,
              business_risk,
              control_risk,
              audit_status_id,
              audit_reviewer_comment,
              audit_commpliance AS compliance_response,
              compliance_status_id,
              compliance_reviewer_comment,
              batch_key
          FROM answers_data_annexure
          WHERE assesment_id = $1
              AND answer_id = ANY($2::int[])
              AND audit_status_id = 2
              AND deleted_at IS NULL
              AND (
                  $3::int = 4
                  OR compliance_status_id = 3
              )
          ORDER BY answer_id, id;
          `,
          [
            assessmentId,
            answerIds,
            complianceStatus,
          ],
        );

      annexureRows =
        annexureResult.rows;

      const evidenceResult =
        await this.db.query(
          `
SELECT
    id,
    answer_id,
    annex_id,
    evi_type,
    file_name,
    file_type,
    description
FROM evidence_master
WHERE assesment_id = $1
    AND answer_id = ANY($2::int[])
    AND evi_type IN (1, 2)
    AND deleted_at IS NULL
ORDER BY id DESC;
          `,
          [
            assessmentId,
            answerIds,
          ],
        );

      evidenceRows =
        evidenceResult.rows;
    }

    const annexureMap =
      new Map<number, any[]>();
    const auditEvidenceMap =
      new Map<string, any>();
    const complianceEvidenceMap =
      new Map<string, any>();

    for (
      const row
      of evidenceRows
    ) {
      const key =
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`;

      if (
        Number(row.evi_type) === 2
        &&
        !complianceEvidenceMap.has(key)
      ) {
        complianceEvidenceMap.set(
          key,
          row,
        );
      }

      if (
        Number(row.evi_type) === 1
        &&
        !auditEvidenceMap.has(key)
      ) {
        auditEvidenceMap.set(
          key,
          row,
        );
      }
    }

    for (
      const row
      of annexureRows
    ) {
      const answerId =
        Number(row.answer_id);
      const values =
        annexureMap.get(answerId)
        || [];

      values.push({
        ...row,
        values:
          this.parseJsonArray(
            row.answer_given,
          ),
        evidence:
          auditEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || null,
        compliance_evidence:
          complianceEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || null,
      });
      annexureMap.set(
        answerId,
        values,
      );
    }

    const answers =
      answerResult.rows.map(
        (row: any) => ({
          ...row,
          response_required:
            complianceStatus === 4
            ||
            Number(row.compliance_status_id) === 3,
          evidence:
            auditEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || null,
          compliance_evidence:
            complianceEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || null,
          annexure_rows:
            (
              annexureMap.get(
                Number(row.id),
              ) || []
            ).map(
              (annexure: any) => ({
                ...annexure,
                response_required:
                  complianceStatus === 4
                  ||
                  Number(annexure.compliance_status_id) === 3,
              }),
            ),
        }),
      );

    return {
      overview,
      answers,
      counts:
        this.getComplianceCounts(
          answers,
          String(
            overview.batch_key || '',
          ),
          complianceStatus === 6,
        ),
    };
  }

  async getComplianceEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      ![4, 6].includes(
        Number(assessment.audit_status_id),
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const evidence =
      await this.db.findOne(
        `
        SELECT
            em.file_name,
            em.file_type,
            em.description
        FROM evidence_master em
        INNER JOIN answers_data ad
            ON ad.id = em.answer_id
            AND ad.assesment_id = em.assesment_id
            AND ad.is_compliance = 1
            AND ad.audit_status_id = 2
            AND ad.deleted_at IS NULL
        WHERE em.id = $1
            AND em.assesment_id = $2
            AND em.evi_type = 1
            AND em.deleted_at IS NULL
            AND (
                $3::int = 4
                OR ad.compliance_status_id = 3
                OR EXISTS (
                    SELECT 1
                    FROM answers_data_annexure aa
                    WHERE aa.answer_id = ad.id
                        AND aa.assesment_id = ad.assesment_id
                        AND aa.compliance_status_id = 3
                        AND aa.deleted_at IS NULL
                )
            )
        LIMIT 1;
        `,
        [
          evidenceId,
          assessmentId,
          Number(assessment.audit_status_id),
        ],
      );

    if (
      !evidence
    ) {
      throw new NotFoundException(
        'Evidence document not found.',
      );
    }

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException(
        'Evidence file not found.',
      );
    }

    return {
      path:
        filePath,
      filename:
        path.basename(
          String(
            evidence.description
            || evidence.file_name,
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

  async getComplianceUploadedEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    if (
      ![4, 6].includes(
        Number(assessment.audit_status_id),
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const evidence =
      await this.db.findOne(
        `
        SELECT
            em.file_name,
            em.file_type,
            em.description
        FROM evidence_master em
        INNER JOIN answers_data ad
            ON ad.id = em.answer_id
            AND ad.assesment_id = em.assesment_id
            AND ad.is_compliance = 1
            AND ad.audit_status_id = 2
            AND ad.deleted_at IS NULL
        WHERE em.id = $1
            AND em.assesment_id = $2
            AND em.evi_type = 2
            AND em.deleted_at IS NULL
            AND (
                $3::int = 4
                OR ad.compliance_status_id = 3
                OR EXISTS (
                    SELECT 1
                    FROM answers_data_annexure aa
                    WHERE aa.answer_id = ad.id
                        AND aa.assesment_id = ad.assesment_id
                        AND aa.compliance_status_id = 3
                        AND aa.deleted_at IS NULL
                )
            )
        LIMIT 1;
        `,
        [
          evidenceId,
          assessmentId,
          Number(assessment.audit_status_id),
        ],
      );

    if (
      !evidence
    ) {
      throw new NotFoundException(
        'Evidence document not found.',
      );
    }

    const filePath =
      this.getEvidenceStoragePath(
        assessmentId,
        evidence.file_name,
      );

    if (
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException(
        'Evidence file not found.',
      );
    }

    return {
      path:
        filePath,
      filename:
        path.basename(
          String(
            evidence.description
            || evidence.file_name,
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

  async uploadComplianceEvidence(
    assessmentId: number,
    targetType: string,
    observationId: number,
    employeeId: number,
    file: {
      filename: string;
      mimetype: string;
      buffer: Buffer;
    },
  ) {

    await this.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    if (
      !['answer', 'annexure'].includes(
        targetType,
      )
    ) {
      throw new BadRequestException(
        'Invalid observation type.',
      );
    }

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
      await this.getComplianceEvidenceTarget(
        assessmentId,
        targetType,
        observationId,
      );

    const existing =
      await this.db.findOne(
        `
        SELECT id
        FROM evidence_master
        WHERE answer_id = $1
            AND annex_id = $2
            AND assesment_id = $3
            AND evi_type = 2
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [
          target.answerId,
          target.annexureRowId,
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
          'Compliance evidence already uploaded.',
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
        VALUES ($1, $2, $3, 2, $4, $5, $6, $7, 0, 0, 0, NOW(), NOW());
        `,
        [
          target.answerId,
          target.annexureRowId,
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
        'Compliance evidence uploaded successfully.',
    };
  }

  async saveComplianceResponse(
    assessmentId: number,
    targetType: string,
    observationId: number,
    employeeId: number,
    rawResponse: string,
  ) {

    await this.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    if (
      !['answer', 'annexure'].includes(
        targetType,
      )
    ) {
      throw new BadRequestException(
        'Invalid observation type.',
      );
    }

    const response =
      this.cleanString(
        rawResponse,
      );

    if (
      !response
    ) {
      throw new BadRequestException(
        'Compliance response is required.',
      );
    }

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    const complianceStatus =
      Number(assessment.audit_status_id);

    if (
      ![4, 6].includes(
        complianceStatus,
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const result =
      targetType === 'answer'
        ? await this.db.query(
          `
            UPDATE answers_data
            SET
                audit_commpliance = $1,
                compliance_emp_id = $2,
                compliance_status_id = CASE
                    WHEN $6::int = 6 THEN compliance_status_id
                    ELSE 0
                END,
                batch_key = $3
            WHERE id = $4
                AND assesment_id = $5
                AND is_compliance = 1
                AND audit_status_id = 2
                AND deleted_at IS NULL
                AND (
                    $6::int = 4
                    OR compliance_status_id = 3
                )
            RETURNING id;
          `,
          [
            response,
            employeeId,
            assessment.batch_key,
            observationId,
            assessmentId,
            complianceStatus,
          ],
        )
        : await this.db.query(
          `
            UPDATE answers_data_annexure aa
            SET
                audit_commpliance = $1,
                compliance_emp_id = $2,
                compliance_status_id = CASE
                    WHEN $6::int = 6 THEN compliance_status_id
                    ELSE 0
                END,
                batch_key = $3
            WHERE aa.id = $4
                AND aa.assesment_id = $5
                AND aa.audit_status_id = 2
                AND aa.deleted_at IS NULL
                AND (
                    $6::int = 4
                    OR aa.compliance_status_id = 3
                )
                AND EXISTS (
                    SELECT 1
                    FROM answers_data ad
                    WHERE ad.id = aa.answer_id
                        AND ad.assesment_id = aa.assesment_id
                        AND ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND ad.deleted_at IS NULL
                )
            RETURNING aa.id;
          `,
          [
            response,
            employeeId,
            assessment.batch_key,
            observationId,
            assessmentId,
            complianceStatus,
          ],
        );

    if (
      !result.rows.length
    ) {
      throw new NotFoundException(
        'Compliance point not found for this assessment.',
      );
    }

    return {
      success:
        true,
      message:
        complianceStatus === 6
          ? 'Corrected compliance response saved.'
          : 'Compliance response saved.',
    };
  }

  async getComplianceSubmissionPreview(
    assessmentId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getComplianceAssessment(
        assessmentId,
        employeeId,
      );

    const counts =
      detail.counts;
    const isReCompliance =
      Number(detail.overview.audit_status_id) === 6;

    return {
      can_submit:
        counts.total > 0
        && counts.pending === 0,
      total_points:
        counts.total,
      completed_points:
        counts.completed,
      pending_count:
        counts.pending,
      message:
        !counts.total
          ? 'No compliance-required observations were found.'
          : counts.pending
            ? `${counts.pending} compliance response(s) are pending.`
            : isReCompliance
              ? 'All corrected compliance responses are saved. Assessment is ready to return to Reviewer.'
              : 'All compliance responses are saved. Assessment is ready for reviewer compliance review.',
    };
  }

  async submitComplianceAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    const preview =
      await this.getComplianceSubmissionPreview(
        assessmentId,
        employeeId,
      );

    if (
      !preview.can_submit
    ) {
      throw new BadRequestException(
        preview.message,
      );
    }

    const currentStatus =
      Number(
        (
          await this.findAssessment(
            assessmentId,
          )
        ).audit_status_id,
      );

    await this.db.transaction(
      async (client) => {

        const updated =
          await client.query(
            `
            UPDATE audit_assesment_master
            SET
                audit_status_id = 5,
                compliance_emp_id = $2,
                compliance_end_date = CURRENT_DATE
            WHERE id = $1
                AND audit_status_id = $3
                AND deleted_at IS NULL
            RETURNING batch_key;
            `,
            [
              assessmentId,
              employeeId,
              currentStatus,
            ],
          );

        if (
          !updated.rows.length
        ) {
          throw new BadRequestException(
            'Assessment compliance status has changed.',
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
          VALUES ($1, 2, 5, 0, $2, $3);
          `,
          [
            assessmentId,
            employeeId,
            updated.rows[0].batch_key,
          ],
        );
      },
    );

    return {
      success:
        true,
      status_id:
        5,
      message:
        currentStatus === 6
          ? 'Corrected compliance responses submitted back to Reviewer.'
          : 'Compliance submitted to Reviewer.',
    };
  }

  // Categor Assessment

  async getCategory(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    dumpId = 0,
    allowLocked = false,
  ) {

    const overview =
      await this.getOverview(
        assessmentId,
        employeeId,
      );

    if (
      !allowLocked &&
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

    const reAuditScope =
      Number(overview.audit_status_id) === 3
        ? await this.getReAuditScope(
          assessmentId,
        )
        : null;

    let accounts =
      [1, 2].includes(
        Number(category.linked_table_id),
      )
        ? await this.getSampledAccounts(
          category,
          overview,
        )
        : [];

    if (
      reAuditScope
      &&
      reAuditScope.categories.size > 0
      &&
      accounts.length
    ) {
      accounts =
        accounts.filter(
          (account: any) =>
            reAuditScope.dumps.has(
              `${categoryId}:${Number(account.id)}`,
            ),
        );
    }

    if (
      dumpId
      &&
      !accounts.some(
        (account: any) =>
          Number(account.id) === dumpId,
      )
    ) {
      throw new BadRequestException(
        'Selected sampled account is not available for this category.',
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
              ans.audit_status_id AS answer_status_id,
              ans.audit_reviewer_comment
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
              AND ans.dump_id = $7
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
          dumpId,
        ],
      );

    let sets =
      this.groupCategoryQuestions(
        questionResult.rows,
      );

    await this.attachSubsetOptions(
      sets,
    );

    let hasAnnexureQuestions =
      questionResult.rows.some(
        (row: any) =>
          Number(row.annexure_id || 0) > 0,
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
              ans.audit_status_id AS answer_status_id,
              ans.audit_reviewer_comment
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
              AND ans.dump_id = $6
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
            dumpId,
          ],
        );

      this.attachSubsetSets(
        sets,
        this.groupCategoryQuestions(
          subsetResult.rows,
        ),
      );

      hasAnnexureQuestions =
        hasAnnexureQuestions
        ||
        subsetResult.rows.some(
          (row: any) =>
            Number(row.annexure_id || 0) > 0,
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

    if (
      reAuditScope
      &&
      reAuditScope.categories.size > 0
    ) {
      sets =
        this.filterReAuditSets(
          sets,
          reAuditScope,
          categoryId,
          dumpId,
        );
    }

    const annexureRiskOptions =
      hasAnnexureQuestions
        ? await this.getAnnexureRiskOptions(
          Number(overview.year_id),
        )
        : {
          business_risks: [],
          control_risks: [],
          risk_categories: [],
        };

    return {
      overview,
      category,
      accounts,
      selected_account:
        accounts.find(
          (account: any) =>
            Number(account.id) === dumpId,
        ) || null,
      dump_id:
        dumpId,
      sets,
      annexure_risk_options:
        annexureRiskOptions,
    };
  }

  private async attachSubsetOptions(
    sets: any[],
  ) {
    const subsetIds = new Set<string>();

    for (const set of sets || []) {
      for (const header of set.headers || []) {
        for (const question of header.questions || []) {
          if (
            Number(question.option_id) !== 5 ||
            !question.subset_multi_id
          ) {
            continue;
          }

          String(question.subset_multi_id)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .forEach((id) => subsetIds.add(id));
        }
      }
    }

    if (!subsetIds.size) {
      return;
    }

    const result = await this.db.query(
      `
    SELECT
        id,
        name
    FROM question_set_master
    WHERE id::text = ANY($1)
        AND is_active = 1
        AND deleted_at IS NULL
    ORDER BY id;
    `,
      [
        Array.from(subsetIds),
      ],
    );

    const optionMap = new Map<string, string>();

    for (const row of result.rows) {
      optionMap.set(
        String(row.id),
        row.name,
      );
    }

    for (const set of sets || []) {
      for (const header of set.headers || []) {
        for (const question of header.questions || []) {
          if (
            Number(question.option_id) !== 5 ||
            !question.subset_multi_id
          ) {
            continue;
          }

          question.subset_options =
            String(question.subset_multi_id)
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
              .map((id) => ({
                id,
                name: optionMap.get(id) || `Subset ${id}`,
              }));
        }
      }
    }
  }

  async getCategorySubsetSet(
    assessmentId: number,
    categoryId: number,
    subsetSetId: number,
    employeeId: number,
    dumpId = 0,
  ) {
    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
    );

    const allowedSubsetIds = new Set<string>();

    for (const set of detail.sets || []) {
      for (const header of set.headers || []) {
        for (const question of header.questions || []) {
          if (
            Number(question.option_id) !== 5 ||
            !question.subset_multi_id
          ) {
            continue;
          }

          String(question.subset_multi_id)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .forEach((id) => allowedSubsetIds.add(id));
        }
      }
    }

    if (
      !allowedSubsetIds.has(
        String(subsetSetId),
      )
    ) {
      throw new BadRequestException(
        'Selected subset is not linked with this category.',
      );
    }

    const result = await this.db.query(
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
        ans.audit_status_id AS answer_status_id,
        ans.audit_reviewer_comment
    FROM question_set_master qsm
    INNER JOIN question_header_master qhm
        ON qhm.question_set_id = qsm.id
        AND qhm.is_active = 1
        AND qhm.deleted_at IS NULL
    INNER JOIN question_master qm
        ON qm.set_id = qsm.id
        AND qm.header_id = qhm.id
        AND qm.is_active = 1
        AND qm.deleted_at IS NULL
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
        ON ans.assesment_id = $2
        AND ans.category_id = $3
        AND ans.header_id = qhm.id
        AND ans.question_id = qm.id
        AND ans.dump_id = $4
        AND ans.deleted_at IS NULL
    WHERE qsm.id = $1
        AND qsm.is_active = 1
        AND qsm.deleted_at IS NULL
    ORDER BY
        qsm.id,
        qhm.id,
        qm.id;
    `,
      [
        subsetSetId,
        assessmentId,
        categoryId,
        dumpId,
      ],
    );

    const sets =
      this.groupCategoryQuestions(
        result.rows,
      );

    await this.attachAnnexureRows(
      sets,
      assessmentId,
    );

    await this.attachEvidenceRows(
      sets,
      assessmentId,
    );

    return {
      success: true,
      subset_set:
        sets[0] || null,
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
    dumpId = 0,
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
        dumpId,
      );

    this.assertAccountSelection(
      detail,
    );

    const questionMap =
      new Map<number, any>();

    this.collectQuestions(
      detail.sets,
      questionMap,
    );

    await this.addLinkedSubsetQuestionsToMap(
      detail.sets,
      questionMap,
      assessmentId,
      categoryId,
      dumpId,
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

      if (
        Number(detail.overview.audit_status_id) === 3
        &&
        Number(question.answer?.audit_status_id || 0) !== 3
      ) {
        errors[questionId] =
          'Only the Reviewer-rejected annexure row can be updated.';
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
          dumpId,
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

  private async addLinkedSubsetQuestionsToMap(
    sets: any[],
    questionMap: Map<number, any>,
    assessmentId: number,
    categoryId: number,
    dumpId: number,
  ) {
    const subsetIds = new Set<string>();

    for (const set of sets || []) {
      for (const header of set.headers || []) {
        for (const question of header.questions || []) {
          if (
            Number(question.option_id) !== 5 ||
            !question.subset_multi_id
          ) {
            continue;
          }

          String(question.subset_multi_id)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .forEach((id) => subsetIds.add(id));
        }
      }
    }

    if (!subsetIds.size) {
      return;
    }

    const result = await this.db.query(
      `
    SELECT
        qhm.id AS header_id,
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
        ans.id AS answer_id,
        ans.answer_given,
        ans.audit_comment,
        ans.is_compliance,
        ans.audit_compulsary_ev_upload,
        ans.business_risk,
        ans.control_risk,
        ans.audit_status_id AS answer_status_id,
        ans.audit_reviewer_comment
    FROM question_set_master qsm
    INNER JOIN question_header_master qhm
        ON qhm.question_set_id = qsm.id
        AND qhm.is_active = 1
        AND qhm.deleted_at IS NULL
    INNER JOIN question_master qm
        ON qm.set_id = qsm.id
        AND qm.header_id = qhm.id
        AND qm.is_active = 1
        AND qm.deleted_at IS NULL
    LEFT JOIN answers_data ans
        ON ans.assesment_id = $2
        AND ans.category_id = $3
        AND ans.header_id = qhm.id
        AND ans.question_id = qm.id
        AND ans.dump_id = $4
        AND ans.deleted_at IS NULL
    WHERE qsm.id::text = ANY($1)
        AND qsm.is_active = 1
        AND qsm.deleted_at IS NULL;
    `,
      [
        Array.from(subsetIds),
        assessmentId,
        categoryId,
        dumpId,
      ],
    );

    for (const row of result.rows) {
      questionMap.set(
        Number(row.question_id),
        {
          id:
            row.question_id,
          header_id:
            row.header_id,
          question:
            row.question,
          question_type_id:
            row.question_type_id,
          option_id:
            row.option_id,
          parameters:
            row.parameters || [],
          risk_category_id:
            row.risk_category_id,
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
                audit_compulsary_ev_upload:
                  row.audit_compulsary_ev_upload,
                business_risk:
                  row.business_risk,
                control_risk:
                  row.control_risk,
                audit_status_id:
                  row.answer_status_id,
                audit_reviewer_comment:
                  row.audit_reviewer_comment,
              }
              : null,
        },
      );
    }
  }

  async saveAnnexureRow(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
    body: any,
    dumpId = 0,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
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

          if (
            !result.rows.length
          ) {
            throw new BadRequestException(
              'Annexure row not found or cannot be updated.',
            );
          }

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
    dumpId = 0,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
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

  // Evidence Upload

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
    dumpId = 0,
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
        dumpId,
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
    dumpId = 0,
  ) {

    const evidence =
      await this.findAccessibleEvidence(
        assessmentId,
        categoryId,
        evidenceId,
        employeeId,
        dumpId,
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
    dumpId = 0,
  ) {

    const evidence =
      await this.findAccessibleEvidence(
        assessmentId,
        categoryId,
        evidenceId,
        employeeId,
        dumpId,
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

  // Annexure Upload

  async getAnnexureCsvSample(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    employeeId: number,
    dumpId = 0,
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
        dumpId,
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
    dumpId = 0,
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
        dumpId,
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
              audit_reviewer_comment:
                row.audit_reviewer_comment,
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

    this.assertAccountSelection(
      detail,
    );

    const dumpId =
      Number(detail.dump_id || 0);

    const existing =
      await this.db.findOne(
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
          assessmentId,
          categoryId,
          question.header_id,
          question.id,
          dumpId,
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
            $1, $2, $3, $4, $5, $6, $7, $8,
            NULL, $9, 0, 0, NULL, 1, NULL, NULL,
            0, 0, 0, NULL, 1, 1, 0, $10
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
          dumpId,
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
    dumpId = 0,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
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
    const cacheKey =
      includeNotApplicable
        ? 'with-na'
        : 'without-na';

    if (
      this.riskCategoriesCache.has(
        cacheKey,
      )
    ) {
      return this.riskCategoriesCache.get(
        cacheKey,
      );
    }

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

    this.riskCategoriesCache.set(
      cacheKey,
      result.rows,
    );

    return result.rows;
  }

  private async getAnnexureRiskOptions(
    yearId: number,
  ) {
    if (
      this.annexureRiskOptionsCache.has(
        yearId,
      )
    ) {
      return this.annexureRiskOptionsCache.get(
        yearId,
      );
    }

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

    const options = {
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

    this.annexureRiskOptionsCache.set(
      yearId,
      options,
    );

    return options;
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
            risk_cat_id,
            audit_status_id,
            audit_reviewer_comment
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
        audit_status_id:
          row.audit_status_id,
        audit_reviewer_comment:
          row.audit_reviewer_comment,
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

  // Evidence

  private async getComplianceEvidenceTarget(
    assessmentId: number,
    targetType: string,
    observationId: number,
  ) {

    const assessment =
      await this.findAssessment(
        assessmentId,
      );

    const complianceStatus =
      Number(assessment.audit_status_id);

    if (
      ![4, 6].includes(
        complianceStatus,
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    if (
      targetType === 'answer'
    ) {
      const answer =
        await this.db.findOne(
          `
          SELECT id
          FROM answers_data
          WHERE id = $1
              AND assesment_id = $2
              AND is_compliance = 1
              AND audit_status_id = 2
              AND deleted_at IS NULL
              AND (
                  $3::int = 4
                  OR compliance_status_id = 3
              )
          LIMIT 1;
          `,
          [
            observationId,
            assessmentId,
            complianceStatus,
          ],
        );

      if (
        !answer?.id
      ) {
        throw new NotFoundException(
          'Compliance point not found for this assessment.',
        );
      }

      return {
        answerId:
          Number(answer.id),
        annexureRowId:
          0,
      };
    }

    const annexure =
      await this.db.findOne(
        `
        SELECT aa.id, aa.answer_id
        FROM answers_data_annexure aa
        INNER JOIN answers_data ad
            ON ad.id = aa.answer_id
            AND ad.assesment_id = aa.assesment_id
            AND ad.is_compliance = 1
            AND ad.audit_status_id = 2
            AND ad.deleted_at IS NULL
        WHERE aa.id = $1
            AND aa.assesment_id = $2
            AND aa.audit_status_id = 2
            AND aa.deleted_at IS NULL
            AND (
                $3::int = 4
                OR aa.compliance_status_id = 3
            )
        LIMIT 1;
        `,
        [
          observationId,
          assessmentId,
          complianceStatus,
        ],
      );

    if (
      !annexure?.id
    ) {
      throw new NotFoundException(
        'Compliance point not found for this assessment.',
      );
    }

    return {
      answerId:
        Number(annexure.answer_id),
      annexureRowId:
        Number(annexure.id),
    };
  }

  private async getEvidenceTarget(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    annexureRowId: number,
    employeeId: number,
    dumpId = 0,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
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
    dumpId = 0,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
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
      dump_id?: number;
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
            dump_id:
              category.dump_id || 0,
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

  private async appendAccountCompliancePoints(
    assessmentId: number,
    categoryId: number,
    accounts: any[],
    category: {
      id: number;
      name: string;
      menu_name: string;
    },
    compliancePoints: any[],
  ) {

    const completedAccounts =
      (accounts || [])
        .filter(
          (account: any) =>
            account.is_completed,
        );

    if (
      !completedAccounts.length
    ) {
      return 0;
    }

    const accountMap =
      new Map<number, any>(
        completedAccounts.map(
          (account: any) => [
            Number(account.id),
            account,
          ],
        ),
      );

    const result =
      await this.db.query(
        `
        SELECT
            ad.dump_id,
            ad.question_id,
            ad.answer_given,
            ad.audit_comment,
            qm.question,
            qm.option_id,
            qm.annexure_id
        FROM answers_data ad
        INNER JOIN question_master qm
            ON qm.id = ad.question_id
            AND qm.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.category_id = $2
            AND ad.dump_id = ANY($3::int[])
            AND ad.is_compliance = 1
            AND ad.deleted_at IS NULL
        ORDER BY
            ad.dump_id,
            ad.question_id;
        `,
        [
          assessmentId,
          categoryId,
          completedAccounts.map(
            (account: any) =>
              Number(account.id),
          ),
        ],
      );

    for (
      const row
      of result.rows || []
    ) {
      const account =
        accountMap.get(
          Number(row.dump_id),
        );

      const isAnnexureAnswer =
        Number(row.option_id) === 4
        &&
        row.annexure_id
        &&
        String(row.answer_given || '')
        === String(row.annexure_id);

      compliancePoints.push({
        category_id:
          category.id,
        category_name:
          `${category.name} - ${account?.account_no || row.dump_id}`,
        menu_name:
          category.menu_name,
        dump_id:
          Number(row.dump_id || 0),
        question_id:
          row.question_id,
        question:
          row.question,
        answer_given:
          isAnnexureAnswer
            ? 'As per annexure'
            : String(row.answer_given || ''),
        audit_comment:
          row.audit_comment || '',
      });
    }

    return result.rows?.length || 0;
  }

  private async appendNormalCategoryPreviewIssues(
    assessmentId: number,
    overview: any,
    categories: any[],
    issues: any[],
    compliancePoints: any[],
  ) {

    const categoryIds =
      (categories || [])
        .map(
          (category: any) =>
            Number(category.id),
        )
        .filter(Boolean);

    if (
      !categoryIds.length
    ) {
      return 0;
    }

    const result =
      await this.db.query(
        `
        SELECT
            cm.id AS category_id,
            cm.name AS category_name,
            mm.name AS menu_name,
            qm.id AS question_id,
            qm.question,
            qm.option_id,
            qm.annexure_id,
            ad.id AS answer_id,
            ad.answer_given,
            ad.audit_comment,
            ad.is_compliance,
            CASE
                WHEN ad.id IS NULL THEN 'answer'
                WHEN qm.option_id = 4
                    AND qm.annexure_id IS NOT NULL
                    AND ad.answer_given::text = qm.annexure_id::text
                    AND NOT EXISTS (
                        SELECT 1
                        FROM answers_data_annexure ada
                        WHERE ada.answer_id = ad.id
                            AND ada.assesment_id = ad.assesment_id
                            AND ada.deleted_at IS NULL
                    )
                    THEN 'annexure'
                ELSE NULL
            END AS issue_type
        FROM category_master cm
        INNER JOIN menu_master mm
            ON mm.id = cm.menu_id
            AND mm.deleted_at IS NULL
        INNER JOIN question_set_master qsm
            ON qsm.id::text = ANY(string_to_array(COALESCE(cm.question_set_ids, ''), ','))
            AND qsm.is_active = 1
            AND qsm.deleted_at IS NULL
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
        LEFT JOIN answers_data ad
            ON ad.assesment_id = $1
            AND ad.category_id = cm.id
            AND ad.header_id = qhm.id
            AND ad.question_id = qm.id
            AND ad.dump_id = 0
            AND ad.deleted_at IS NULL
        WHERE cm.id = ANY($2::int[])
            AND cm.is_active = 1
            AND cm.deleted_at IS NULL
        ORDER BY
            cm.id,
            qsm.id,
            qhm.id,
            qm.id;
        `,
        [
          assessmentId,
          categoryIds,
          overview.header_ids || '',
          overview.question_ids || '',
        ],
      );

    let complianceCount = 0;

    for (
      const row
      of result.rows || []
    ) {
      const issueBase = {
        category_id:
          row.category_id,
        category_name:
          row.category_name,
        menu_name:
          row.menu_name,
        dump_id:
          0,
        question_id:
          row.question_id,
        question:
          row.question,
      };

      if (
        row.issue_type
      ) {
        issues.push({
          ...issueBase,
          type:
            row.issue_type,
          message:
            row.issue_type === 'annexure'
              ? 'At least one annexure row is required.'
              : 'Answer is pending.',
        });
      }

      if (
        Number(row.is_compliance || 0) === 1
      ) {
        const isAnnexureAnswer =
          Number(row.option_id) === 4
          &&
          row.annexure_id
          &&
          String(row.answer_given || '')
          === String(row.annexure_id);

        complianceCount++;
        compliancePoints.push({
          ...issueBase,
          answer_given:
            isAnnexureAnswer
              ? 'As per annexure'
              : String(row.answer_given || ''),
          audit_comment:
            row.audit_comment || '',
        });
      }
    }

    return complianceCount;
  }

  private async appendExecutiveSummaryIssues(
    assessmentId: number,
    yearId: number,
    issues: any[],
  ) {

    const result =
      await this.db.findOne(
        `
        SELECT
            EXISTS (
                SELECT 1
                FROM executive_summary_basic_details
                WHERE assesment_id = $1
                    AND year_id = $2
                    AND deleted_at IS NULL
            ) AS has_basic_details,
            EXISTS (
                SELECT 1
                FROM executive_summary_branch_position
                WHERE assesment_id = $1
                    AND year_id = $2
                    AND deleted_at IS NULL
            ) AS has_branch_position;
        `,
        [
          assessmentId,
          yearId,
        ],
      );

    const sections = [
      {
        complete:
          result?.has_basic_details,
        question:
          'Basic Details',
      },
      {
        complete:
          result?.has_branch_position,
        question:
          'Branch Financial Position',
      },
    ];

    for (
      const section
      of sections
    ) {
      if (
        !section.complete
      ) {
        issues.push({
          category_id:
            0,
          category_name:
            'Executive Summary',
          menu_name:
            'Executive Summary',
          question_id:
            0,
          question:
            section.question,
          type:
            'executive_summary',
          message:
            'Complete and save this executive summary section.',
        });
      }
    }
  }

  // Subsets

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

  private parseJsonObject(
    value: any,
  ) {

    if (
      value
      &&
      typeof value === 'object'
      &&
      !Array.isArray(value)
    ) {
      return value;
    }

    if (
      !value
    ) {
      return {};
    }

    try {
      const parsed =
        JSON.parse(
          String(value),
        );

      return parsed
        &&
        typeof parsed === 'object'
        &&
        !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {

      return {};
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

  private async assertAuditorRemarkAccess(
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

    if (
      !AUDITOR_STATUS_IDS.includes(
        Number(
          assessment.audit_status_id,
        ),
      )
    ) {

      throw new BadRequestException(
        'Assessment remarks are not pending with auditor.',
      );
    }

    return assessment;
  }

  // Account Sampling

  async getAccountSampling(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    filterType = 0,
    primaryValue = '',
    secondaryValue = '',
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    this.assertSamplingAllowed(
      detail,
    );

    const candidateData =
      await this.getSamplingCandidates(
        detail.category,
        detail.overview,
        filterType,
        primaryValue,
        secondaryValue,
      );

    return {
      filter_types: [
        {
          id: 1,
          name: 'Block Sampling',
        },
        {
          id: 2,
          name: 'High Value Sampling',
        },
        {
          id: 3,
          name: 'Systematic Sampling - Below 1 Lakh',
        },
        {
          id: 4,
          name: 'Systematic Sampling - Between 1 Lakh To 2 Lakhs',
        },
        {
          id: 5,
          name: 'Systematic Sampling - Above 2 Lakhs',
        },
      ],
      selected_accounts:
        detail.accounts || [],
      candidates:
        candidateData.accounts,
      matching_count:
        candidateData.matching_count,
      displayed_count:
        candidateData.accounts.length,
    };
  }

  async applyAccountSampling(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    accountIds: any[],
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
      );

    this.assertSamplingAllowed(
      detail,
    );

    const selectedIds =
      Array.from(
        new Set(
          (Array.isArray(accountIds) ? accountIds : [])
            .map(
              (id: any) =>
                Number(id),
            )
            .filter(
              (id: number) =>
                Number.isInteger(id)
                &&
                id > 0,
            ),
        ),
      );

    if (
      !selectedIds.length
    ) {
      throw new BadRequestException(
        'Select at least one account for sampling.',
      );
    }

    const candidates =
      await this.getSamplingCandidates(
        detail.category,
        detail.overview,
      );

    const eligibleIds =
      new Set(
        candidates.accounts.map(
          (account: any) =>
            Number(account.id),
        ),
      );

    if (
      selectedIds.some(
        (id: number) =>
          !eligibleIds.has(id),
      )
    ) {
      throw new BadRequestException(
        'One or more selected accounts are no longer available for sampling.',
      );
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    await this.db.query(
      `
      UPDATE ${table}
      SET sampling_filter = 1
      WHERE id = ANY($1::int[])
          AND COALESCE(sampling_filter, 0) = 0
          AND deleted_at IS NULL;
      `,
      [
        selectedIds,
      ],
    );

    return {
      success:
        true,
      message:
        'Sampled accounts applied successfully.',
      selected_count:
        selectedIds.length,
    };
  }

  async removeAccountSampling(
    assessmentId: number,
    categoryId: number,
    dumpId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertSamplingAllowed(
      detail,
    );
    this.assertAccountSelection(
      detail,
    );

    if (
      Number(
        detail.selected_account.assesment_period_id || 0,
      )
    ) {
      throw new BadRequestException(
        'Completed account sampling cannot be removed.',
      );
    }

    const answered =
      await this.db.findOne(
        `
        SELECT id
        FROM answers_data
        WHERE assesment_id = $1
            AND category_id = $2
            AND dump_id = $3
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [
          assessmentId,
          categoryId,
          dumpId,
        ],
      );

    if (
      answered?.id
    ) {
      throw new BadRequestException(
        'This sampled account already has audit answers and cannot be removed.',
      );
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    await this.db.query(
      `
      UPDATE ${table}
      SET sampling_filter = 0
      WHERE id = $1
          AND COALESCE(assesment_period_id, 0) = 0
          AND sampling_filter = 1
          AND deleted_at IS NULL;
      `,
      [
        dumpId,
      ],
    );

    return {
      success:
        true,
      message:
        'Sampled account removed successfully.',
    };
  }

  private async getSamplingCandidates(
    category: any,
    overview: any,
    filterType = 0,
    primaryValue = '',
    secondaryValue = '',
  ) {

    const linkedTableId =
      Number(category.linked_table_id);

    if (
      ![1, 2].includes(
        linkedTableId,
      )
    ) {
      throw new BadRequestException(
        'Sampling is available only for account-based categories.',
      );
    }

    if (
      filterType
      &&
      ![1, 2, 3, 4, 5].includes(filterType)
    ) {
      throw new BadRequestException(
        'Select a valid sampling filter.',
      );
    }

    if (
      filterType === 1
      &&
      (
        !String(primaryValue).trim()
        ||
        !String(secondaryValue).trim()
      )
    ) {
      throw new BadRequestException(
        'Enter from and to account numbers for block sampling.',
      );
    }

    const percentage =
      Number(primaryValue);

    if (
      [2, 3, 4, 5].includes(filterType)
      &&
      (
        !Number.isFinite(percentage)
        ||
        percentage <= 0
        ||
        percentage > 100
      )
    ) {
      throw new BadRequestException(
        'Enter a sampling percentage between 1 and 100.',
      );
    }

    const table =
      linkedTableId === 1
        ? 'dump_deposits'
        : 'dump_advances';

    const amountColumn =
      linkedTableId === 1
        ? 'd.principal_amount'
        : 'd.sanction_amount';

    const amountAlias =
      linkedTableId === 1
        ? 'principal_amount'
        : 'sanction_amount';

    const renewalColumn =
      linkedTableId === 1
        ? 'NULL::date AS renewal_date'
        : 'd.renewal_date';

    const periodCondition =
      linkedTableId === 1
        ? 'd.account_opening_date BETWEEN $3 AND $4'
        : '(d.account_opening_date BETWEEN $3 AND $4 OR d.renewal_date BETWEEN $3 AND $4)';

    const schemeIds =
      linkedTableId === 1
        ? overview.deposits_scheme_ids || ''
        : overview.advances_scheme_ids || '';

    if (
      !String(schemeIds).trim()
    ) {
      return {
        accounts: [],
        matching_count: 0,
      };
    }

    let filterClause = '';
    const params: any[] = [
      linkedTableId,
      category.id,
      overview.assesment_period_from,
      overview.assesment_period_to,
      overview.audit_unit_id,
      String(schemeIds),
    ];

    if (
      filterType === 1
    ) {
      filterClause =
        ' AND d.account_no BETWEEN $7 AND $8';
      params.push(
        String(primaryValue).trim(),
        String(secondaryValue).trim(),
      );
    } else if (
      filterType === 3
    ) {
      filterClause =
        ` AND ${amountColumn} < 100000`;
    } else if (
      filterType === 4
    ) {
      filterClause =
        ` AND ${amountColumn} BETWEEN 100000 AND 200000`;
    } else if (
      filterType === 5
    ) {
      filterClause =
        ` AND ${amountColumn} > 200000`;
    }

    const result =
      await this.db.query(
        `
        SELECT
            d.id,
            d.account_no,
            d.account_holder_name,
            d.ucic,
            d.account_opening_date,
            ${renewalColumn},
            ${amountColumn} AS ${amountAlias},
            sm.name AS scheme_name,
            sm.scheme_code
        FROM ${table} d
        INNER JOIN scheme_master sm
            ON sm.id = d.scheme_id
            AND sm.scheme_type_id = $1
            AND sm.category_id = $2
            AND sm.is_active = 1
            AND sm.deleted_at IS NULL
        WHERE d.branch_id = $5
            AND d.scheme_id::text = ANY(
                string_to_array($6, ',')
            )
            AND ${periodCondition}
            AND COALESCE(d.sampling_filter, 0) = 0
            AND d.deleted_at IS NULL
            ${filterClause}
        ORDER BY
            NULLIF(${amountColumn}::text, '')::numeric DESC NULLS LAST,
            d.account_no;
        `,
        params,
      );

    const matchingCount =
      result.rows.length;

    const accounts =
      [2, 3, 4, 5].includes(filterType)
        ? result.rows.slice(
          0,
          Math.max(
            1,
            Math.ceil(
              matchingCount * percentage / 100,
            ),
          ),
        )
        : result.rows;

    return {
      accounts,
      matching_count:
        matchingCount,
    };
  }

  private async getSampledAccounts(
    category: any,
    overview: any,
  ) {

    const linkedTableId =
      Number(category.linked_table_id);

    if (
      ![1, 2].includes(
        linkedTableId,
      )
    ) {
      return [];
    }

    const table =
      linkedTableId === 1
        ? 'dump_deposits'
        : 'dump_advances';

    const schemeIds =
      linkedTableId === 1
        ? overview.deposits_scheme_ids || ''
        : overview.advances_scheme_ids || '';

    if (
      !String(schemeIds).trim()
    ) {
      return [];
    }

    const periodCondition =
      linkedTableId === 1
        ? 'd.account_opening_date BETWEEN $4 AND $5'
        : '(d.account_opening_date BETWEEN $4 AND $5 OR d.renewal_date BETWEEN $4 AND $5)';

    const result =
      await this.db.query(
        `
        SELECT
            d.id,
            d.account_no,
            d.account_holder_name,
            d.ucic,
            d.account_opening_date,
            d.account_status,
            d.assesment_period_id,
            sm.name AS scheme_name,
            sm.scheme_code,
            CASE
                WHEN d.assesment_period_id = $1 THEN true
                ELSE false
            END AS is_completed
        FROM ${table} d
        INNER JOIN scheme_master sm
            ON sm.id = d.scheme_id
            AND sm.scheme_type_id = $2
            AND sm.category_id = $3
            AND sm.is_active = 1
            AND sm.deleted_at IS NULL
        WHERE d.branch_id = $6
            AND d.scheme_id::text = ANY(
                string_to_array($7, ',')
            )
            AND ${periodCondition}
            AND d.sampling_filter = 1
            AND d.deleted_at IS NULL
        ORDER BY d.account_no;
        `,
        [
          overview.id,
          linkedTableId,
          category.id,
          overview.assesment_period_from,
          overview.assesment_period_to,
          overview.audit_unit_id,
          String(schemeIds),
        ],
      );

    return result.rows;
  }

  private assertAccountSelection(
    detail: any,
  ) {

    if (
      [1, 2].includes(
        Number(
          detail?.category?.linked_table_id,
        ),
      )
      &&
      !detail?.selected_account
    ) {
      throw new BadRequestException(
        'Select a sampled account before saving audit data.',
      );
    }
  }

  private assertSamplingAllowed(
    detail: any,
  ) {

    if (
      ![1, 2].includes(
        Number(
          detail?.category?.linked_table_id,
        ),
      )
    ) {
      throw new BadRequestException(
        'Sampling is available only for account-based categories.',
      );
    }

    if (
      Number(
        detail?.overview?.audit_status_id || 0,
      ) !== 1
    ) {
      throw new BadRequestException(
        'Account sampling can be updated only during the initial audit.',
      );
    }
  }

  async completeAccountAssessment(
    assessmentId: number,
    categoryId: number,
    dumpId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        dumpId,
      );

    this.assertAccountSelection(
      detail,
    );

    if (
      ![1, 2].includes(
        Number(detail.category.linked_table_id),
      )
      ||
      !detail.selected_account
    ) {
      throw new BadRequestException(
        'Account assessment not found.',
      );
    }

    const issues: any[] = [];
    const compliancePoints: any[] = [];

    this.validateSubmissionSets(
      detail.sets || [],
      {
        id:
          categoryId,
        name:
          `${detail.category.name} - ${detail.selected_account.account_no}`,
        menu_name:
          detail.category.menu_name,
        dump_id:
          dumpId,
      },
      issues,
      compliancePoints,
    );

    if (
      issues.length
    ) {
      return {
        success:
          false,
        message:
          'Complete all required account questions before marking it complete.',
        issues,
      };
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    await this.db.query(
      `
      UPDATE ${table}
      SET assesment_period_id = $1
      WHERE id = $2
          AND sampling_filter = 1
          AND deleted_at IS NULL;
      `,
      [
        assessmentId,
        dumpId,
      ],
    );

    return {
      success:
        true,
      message:
        'Account assessment marked complete.',
    };
  }

  async completeRemainingAccountAssessments(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
  ) {

    const detail =
      await this.getCategory(
        assessmentId,
        categoryId,
        employeeId,
        0,
      );

    if (
      ![1, 2].includes(
        Number(detail.category.linked_table_id),
      )
    ) {
      throw new BadRequestException(
        'Account assessment not found.',
      );
    }

    const remainingAccounts =
      (detail.accounts || [])
        .filter(
          (account: any) =>
            !account.is_completed,
        );

    if (
      !remainingAccounts.length
    ) {
      return {
        success:
          true,
        message:
          'No remaining sampled accounts are pending for completion.',
        completed_count:
          0,
      };
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    const accountIds =
      remainingAccounts.map(
        (account: any) =>
          Number(account.id),
      );

    await this.db.query(
      `
      UPDATE ${table}
      SET assesment_period_id = $1
      WHERE id = ANY($2::int[])
          AND sampling_filter = 1
          AND deleted_at IS NULL;
      `,
      [
        assessmentId,
        accountIds,
      ],
    );

    return {
      success:
        true,
      message:
        `${accountIds.length} remaining account assessment(s) marked complete.`,
      completed_count:
        accountIds.length,
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

  private async getReAuditScope(
    assessmentId: number,
  ) {

    const result =
      await this.db.query(
        `
        SELECT
            ad.category_id,
            ad.question_id,
            ad.dump_id,
            ad.audit_status_id,
            EXISTS (
                SELECT 1
                FROM answers_data_annexure aa
                WHERE aa.answer_id = ad.id
                    AND aa.assesment_id = ad.assesment_id
                    AND aa.audit_status_id = 3
                    AND aa.deleted_at IS NULL
            ) AS has_rejected_annexure
        FROM answers_data ad
        WHERE ad.assesment_id = $1
            AND ad.deleted_at IS NULL
            AND (
                ad.audit_status_id = 3
                OR EXISTS (
                    SELECT 1
                    FROM answers_data_annexure aa
                    WHERE aa.answer_id = ad.id
                        AND aa.assesment_id = ad.assesment_id
                        AND aa.audit_status_id = 3
                        AND aa.deleted_at IS NULL
                )
            );
        `,
        [assessmentId],
      );

    const categories =
      new Set<number>();
    const questions =
      new Map<string, any>();
    const dumps =
      new Set<string>();
    const categoryQuestions =
      new Map<number, Set<number>>();

    for (
      const row
      of result.rows
    ) {
      const categoryId =
        Number(row.category_id);
      const questionId =
        Number(row.question_id);
      const dumpId =
        Number(row.dump_id || 0);
      const key =
        `${categoryId}:${dumpId}:${questionId}`;

      categories.add(
        categoryId,
      );
      questions.set(
        key,
        {
          answer_rejected:
            Number(row.audit_status_id) === 3,
          annexure_rejected:
            Boolean(row.has_rejected_annexure),
        },
      );

      if (
        dumpId
      ) {
        dumps.add(
          `${categoryId}:${dumpId}`,
        );
      }

      const categorySet =
        categoryQuestions.get(categoryId)
        || new Set<number>();
      categorySet.add(questionId);
      categoryQuestions.set(
        categoryId,
        categorySet,
      );
    }

    return {
      categories,
      questions,
      dumps,
      categoryQuestionCount:
        new Map(
          Array.from(
            categoryQuestions.entries(),
          ).map(
            ([categoryId, ids]) => [
              categoryId,
              ids.size,
            ],
          ),
        ),
    };
  }

  private async getReAuditPendingCorrectionCount(
    assessmentId: number,
    batchKey: string,
  ) {

    const result =
      await this.db.findOne(
        `
SELECT (
    (
        SELECT COUNT(*)
        FROM answers_data ad
        WHERE ad.assesment_id = $1
            AND ad.audit_status_id = 3
            AND ad.batch_key IS DISTINCT FROM $2
            AND ad.deleted_at IS NULL
    )
    +
    (
        SELECT COUNT(*)
        FROM answers_data_annexure aa
        WHERE aa.assesment_id = $1
            AND aa.audit_status_id = 3
            AND aa.batch_key IS DISTINCT FROM $2
            AND aa.deleted_at IS NULL
    )
)::int AS pending_count;
        `,
        [
          assessmentId,
          batchKey,
        ],
      );

    return Number(
      result?.pending_count || 0,
    );
  }

  private filterReAuditSets(
    sets: any[],
    scope: any,
    categoryId: number,
    dumpId: number,
  ): any[] {

    return (sets || [])
      .map(
        (set: any) => ({
          ...set,
          headers:
            (set.headers || [])
              .map(
                (header: any) => ({
                  ...header,
                  questions:
                    (header.questions || [])
                      .map(
                        (question: any) => {
                          const scoped =
                            scope.questions.get(
                              `${categoryId}:${dumpId}:${Number(question.id)}`,
                            );
                          const subsetSets =
                            this.filterReAuditSets(
                              question.subset_sets || [],
                              scope,
                              categoryId,
                              dumpId,
                            );

                          if (
                            !scoped
                            &&
                            !subsetSets.length
                          ) {
                            return null;
                          }

                          const visibleRows =
                            scoped?.annexure_rejected
                              &&
                              !scoped?.answer_rejected
                              ? (
                                question.answer?.annexure_rows || []
                              ).filter(
                                (row: any) =>
                                  Number(row.audit_status_id) === 3,
                              )
                              : question.answer?.annexure_rows || [];

                          return {
                            ...question,
                            subset_sets:
                              subsetSets,
                            re_audit:
                              Boolean(scoped),
                            re_audit_annexure_only:
                              Boolean(
                                scoped?.annexure_rejected
                                &&
                                !scoped?.answer_rejected,
                              ),
                            answer:
                              question.answer
                                ? {
                                  ...question.answer,
                                  annexure_rows:
                                    visibleRows,
                                }
                                : question.answer,
                          };
                        },
                      )
                      .filter(Boolean),
                }),
              )
              .filter(
                (header: any) =>
                  header.questions.length,
              ),
        }),
      )
      .filter(
        (set: any) =>
          set.headers.length,
      );
  }

  private async assertReviewer(
    employeeId: number,
  ) {

    if (
      !employeeId
    ) {
      throw new BadRequestException(
        'Reviewer is required.',
      );
    }

    const employee =
      await this.db.findOne(
        `
        SELECT id
        FROM employee_master
        WHERE id = $1
            AND user_type_id = 4
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [employeeId],
      );

    if (
      !employee
    ) {
      throw new BadRequestException(
        'Only a reviewer can open audit review.',
      );
    }
  }

  private async assertCompliance(
    employeeId: number,
  ) {

    if (
      !employeeId
    ) {
      throw new BadRequestException(
        'Manager is required.',
      );
    }

    const employee =
      await this.db.findOne(
        `
        SELECT id
        FROM employee_master
        WHERE id = $1
            AND user_type_id = 3
            AND deleted_at IS NULL
        LIMIT 1;
        `,
        [employeeId],
      );

    if (
      !employee
    ) {
      throw new BadRequestException(
        'Only a manager can open compliance.',
      );
    }
  }

  private getReviewerCounts(
    answers: any[],
  ) {

    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    let compliance = 0;

    const applyStatus =
      (status: number) => {
        if (
          status === 2
        ) {
          accepted++;
        } else if (
          status === 3
        ) {
          rejected++;
        } else {
          pending++;
        }
      };

    for (
      const answer
      of answers
    ) {
      if (
        Number(answer.is_compliance) === 1
      ) {
        compliance++;
      }

      applyStatus(
        Number(answer.audit_status_id || 0),
      );

      for (
        const annexure
        of answer.annexure_rows || []
      ) {
        applyStatus(
          Number(annexure.audit_status_id || 0),
        );
      }
    }

    return {
      total:
        accepted
        + rejected
        + pending,
      accepted,
      rejected,
      pending,
      compliance,
    };
  }

  private getComplianceCounts(
    answers: any[],
    batchKey = '',
    requireCurrentBatch = false,
  ) {

    let total = 0;
    let completed = 0;

    const applyResponse =
      (observation: any) => {
        if (
          observation.response_required === false
        ) {
          return;
        }

        total++;

        if (
          this.cleanString(
            observation.compliance_response,
          )
          &&
          (
            !requireCurrentBatch
            ||
            String(
              observation.batch_key || '',
            ) === batchKey
          )
        ) {
          completed++;
        }
      };

    for (
      const answer
      of answers
    ) {
      applyResponse(
        answer,
      );

      for (
        const annexure
        of answer.annexure_rows || []
      ) {
        applyResponse(
          annexure,
        );
      }
    }

    return {
      total,
      completed,
      pending:
        total - completed,
    };
  }

  private getReviewerComplianceCounts(
    answers: any[],
  ) {

    let accepted = 0;
    let rejected = 0;
    let pending = 0;

    const applyStatus =
      (status: number) => {
        if (
          status === 2
        ) {
          accepted++;
        } else if (
          status === 3
        ) {
          rejected++;
        } else {
          pending++;
        }
      };

    for (
      const answer
      of answers
    ) {
      applyStatus(
        Number(answer.compliance_status_id || 0),
      );

      for (
        const annexure
        of answer.annexure_rows || []
      ) {
        applyStatus(
          Number(annexure.compliance_status_id || 0),
        );
      }
    }

    return {
      total:
        accepted
        + rejected
        + pending,
      compliance:
        answers.length,
      accepted,
      rejected,
      pending,
    };
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
