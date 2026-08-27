import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { syncAssessmentScoring } from '../../../../common/helpers/assessment-scoring.helper';
import { InternalAuditService } from '../internal-audit.service';
import {
  AUDITOR_STATUS_IDS,
  LIVE_COMPLIANCE_STATUS,
  LIVE_COMPLIANCE_REVIEWER_PENDING_STATUSES,
  LIVE_COMPLIANCE_REVIEWER_QUEUE_STATUSES,
  LIVE_COMPLIANCE_VISIBLE_STATUSES,
  STATUS_LABELS,
} from '../internal-audit.constants';

/**
 * ReviewerService
 * Contains all reviewer and reviewer-compliance (live-manager-compliance) workflow logic.
 * Shared DB helpers and utilities are delegated to InternalAuditService.
 */
@Injectable()
export class ReviewerService {
  constructor(
    private readonly svc: InternalAuditService,
  ) { }

  async getReviewerPending(
    employeeId: number,
    liveManagerCompliance = true,
  ) {

    await this.svc.assertReviewer(
      employeeId,
    );

    const result =
      await this.svc.db.query(
        `
        SELECT
            aam.id,
            aam.audit_type_id,
            (
              SELECT audit_type.name
              FROM audit_type_master audit_type
              WHERE audit_type.id = aam.audit_type_id
                AND audit_type.deleted_at IS NULL
            ) AS audit_type_name,
            aam.audit_unit_id,
            aam.audit_status_id,
            aam.assesment_period_from,
            aam.assesment_period_to,
            aam.audit_end_date,
            au.audit_unit_code,
            au.name AS audit_unit_name,
            sam.title AS special_audit_title,
            ym.year,
            COUNT(ad.id) FILTER (
                WHERE aam.audit_status_id = 2
                    OR ad.is_compliance = 1
            )::int AS total_points,
            COUNT(ad.id) FILTER (WHERE ad.is_compliance = 1)::int AS compliance_points,
            COUNT(ad.id) FILTER (
                WHERE (aam.audit_status_id = 2 AND ad.audit_status_id = 3)
                    OR (aam.audit_status_id = 5 AND ad.compliance_status_id IN (3, 7, 8))
            )::int AS rejected_points,
            CASE
                WHEN aam.audit_status_id = 5 THEN 'Compliance Review'
                ELSE 'Audit Review'
            END AS review_stage
            FROM audit_assesment_master aam
            INNER JOIN audit_unit_master au
                ON au.id = aam.audit_unit_id
            LEFT JOIN special_audit_master sam
                ON sam.assessment_id = aam.id
                AND sam.deleted_at IS NULL
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
            sam.title,
            ym.year
        ORDER BY aam.audit_status_id, aam.audit_end_date DESC NULLS LAST, aam.id DESC;
        `, [employeeId]
      );

    const assessments =
      result.rows;

    if (
      liveManagerCompliance
    ) {
      const liveResult =
        await this.svc.db.query(
          `
        SELECT
            aam.id,
            aam.audit_type_id,
            (
              SELECT audit_type.name
              FROM audit_type_master audit_type
              WHERE audit_type.id = aam.audit_type_id
                AND audit_type.deleted_at IS NULL
            ) AS audit_type_name,
            aam.audit_unit_id,
            aam.audit_status_id,
            aam.assesment_period_from,
            aam.assesment_period_to,
            aam.audit_end_date,
            au.audit_unit_code,
            au.name AS audit_unit_name,
            sam.title AS special_audit_title,
            ym.year,
            (
                SELECT COUNT(DISTINCT ad2.id)::int
                FROM answers_data ad2
                WHERE ad2.assesment_id = aam.id
                    AND ad2.is_compliance = 1
                    AND ad2.deleted_at IS NULL
                    AND (
                        COALESCE(ad2.compliance_status_id, 0) IN (0, 4)
                        OR NULLIF(BTRIM(COALESCE(ad2.audit_commpliance, '')), '') IS NOT NULL
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa2
                            WHERE aa2.answer_id = ad2.id
                                AND aa2.assesment_id = ad2.assesment_id
                                AND aa2.deleted_at IS NULL
                                AND (
                                    COALESCE(aa2.compliance_status_id, 0) IN (0, 4)
                                    OR NULLIF(BTRIM(COALESCE(aa2.audit_commpliance, '')), '') IS NOT NULL
                                )
                        )
                    )
            ) AS total_points,
            (
                SELECT COUNT(DISTINCT ad2.id)::int
                FROM answers_data ad2
                WHERE ad2.assesment_id = aam.id
                    AND ad2.is_compliance = 1
                    AND ad2.deleted_at IS NULL
                    AND (
                        COALESCE(ad2.compliance_status_id, 0) IN (0, 4)
                        OR NULLIF(BTRIM(COALESCE(ad2.audit_commpliance, '')), '') IS NOT NULL
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa2
                            WHERE aa2.answer_id = ad2.id
                                AND aa2.assesment_id = ad2.assesment_id
                                AND aa2.deleted_at IS NULL
                                AND (
                                    COALESCE(aa2.compliance_status_id, 0) IN (0, 4)
                                    OR NULLIF(BTRIM(COALESCE(aa2.audit_commpliance, '')), '') IS NOT NULL
                                )
                        )
                    )
            ) AS compliance_points,
            (
                SELECT COUNT(DISTINCT ad2.id)::int
                FROM answers_data ad2
                WHERE ad2.assesment_id = aam.id
                    AND ad2.is_compliance = 1
                    AND ad2.deleted_at IS NULL
                    AND (
                        COALESCE(ad2.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_REVIEWER_PENDING_STATUSES.join(', ')})
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa2
                            WHERE aa2.answer_id = ad2.id
                                AND aa2.assesment_id = ad2.assesment_id
                                AND aa2.deleted_at IS NULL
                                AND COALESCE(aa2.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_REVIEWER_PENDING_STATUSES.join(', ')})
                        )
                    )
            ) AS rejected_points,
            'Live Compliance Review' AS review_stage,
            true AS live_manager_compliance
          FROM audit_assesment_master aam
          INNER JOIN audit_unit_master au
              ON au.id = aam.audit_unit_id
          LEFT JOIN special_audit_master sam
              ON sam.assessment_id = aam.id
              AND sam.deleted_at IS NULL
          LEFT JOIN year_master ym
              ON ym.id = aam.year_id
          WHERE aam.audit_status_id IN (1, 3, 4, 5)
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
            AND EXISTS (
                SELECT 1
                FROM answers_data ad2
                WHERE ad2.assesment_id = aam.id
                    AND ad2.is_compliance = 1
                    AND ad2.deleted_at IS NULL
                    AND (
                        (
                            COALESCE(ad2.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_REVIEWER_QUEUE_STATUSES.join(', ')})
                            AND (
                                COALESCE(ad2.compliance_status_id, 0) IN (0, 4)
                                OR NULLIF(BTRIM(COALESCE(ad2.audit_commpliance, '')), '') IS NOT NULL
                            )
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa2
                            WHERE aa2.answer_id = ad2.id
                                AND aa2.assesment_id = ad2.assesment_id
                                AND aa2.deleted_at IS NULL
                                AND COALESCE(ad2.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_REVIEWER_QUEUE_STATUSES.join(', ')})
                                AND (
                                    COALESCE(aa2.compliance_status_id, 0) IN (0, 4)
                                    OR NULLIF(BTRIM(COALESCE(aa2.audit_commpliance, '')), '') IS NOT NULL
                                )
                        )
                    )
            )
          ORDER BY aam.id DESC;
          `,
          [employeeId],
        );

      for (const liveAssessment of liveResult.rows) {
        const existingIndex =
          assessments.findIndex(
            (assessment: any) =>
              Number(assessment.id) === Number(liveAssessment.id),
          );

        if (existingIndex >= 0) {
          assessments.splice(existingIndex, 1);
        }

        assessments.push(liveAssessment);
      }
    }

    return {
      assessments:
        assessments,
    };
  }

  async getReviewerComplianceAssessment(
    assessmentId: number,
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      Number(overview.audit_status_id) !== 5
      &&
      !(
        liveManagerCompliance
        &&
        [1, 3, 4].includes(
          Number(overview.audit_status_id),
        )
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const existingLog = await this.svc.db.findOne(
      `SELECT id FROM audit_logs 
       WHERE audit_assesment_id = $1 
         AND event_type = 'REVIEW_START' 
         AND employee_id = $2 
         AND event_datetime >= COALESCE((SELECT compliance_end_date FROM audit_assesment_master WHERE id = $1), '1970-01-01'::date)`,
      [assessmentId, employeeId],
    );
    if (!existingLog) {
      await this.svc.auditLogService.createLog('REVIEW_START', {
        employeeId,
        auditAssessmentId: assessmentId,
        description: `Reviewer started compliance review for assessment.`,
      });
    }

    const answerResult =
      await this.svc.db.query(
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
            COALESCE(au_dd.name, au_da.name) AS account_branch_name,
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
            COALESCE(sm_dd.name, sm_da.name) AS scheme_name,
            COALESCE(sm_dd.scheme_code, sm_da.scheme_code) AS scheme_code
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
        LEFT JOIN audit_unit_master au_dd
            ON cm.linked_table_id = 1
            AND au_dd.id = dd.branch_id
            AND au_dd.deleted_at IS NULL
        LEFT JOIN audit_unit_master au_da
            ON cm.linked_table_id = 2
            AND au_da.id = da.branch_id
            AND au_da.deleted_at IS NULL
        LEFT JOIN scheme_master sm_dd
            ON cm.linked_table_id = 1
            AND sm_dd.id = dd.scheme_id
            AND sm_dd.deleted_at IS NULL
        LEFT JOIN scheme_master sm_da
            ON cm.linked_table_id = 2
            AND sm_da.id = da.scheme_id
            AND sm_da.deleted_at IS NULL
        WHERE ad.assesment_id = $1
            AND ad.is_compliance = 1
            AND ad.deleted_at IS NULL
            AND (
                $2::boolean = false
                OR (
                    COALESCE(ad.compliance_status_id, 0) IN (0, 4)
                    OR
                    (
                        NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NOT NULL
                        AND COALESCE(ad.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_VISIBLE_STATUSES.join(', ')})
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM answers_data_annexure aa2
                        WHERE aa2.answer_id = ad.id
                            AND aa2.assesment_id = ad.assesment_id
                            AND aa2.deleted_at IS NULL
                            AND NULLIF(BTRIM(COALESCE(aa2.audit_commpliance, '')), '') IS NOT NULL
                            AND COALESCE(aa2.compliance_status_id, 0) IN (${LIVE_COMPLIANCE_VISIBLE_STATUSES.join(', ')})
                    )
                )
            )
        ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id;
        `,
        [
          assessmentId,
          liveManagerCompliance,
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
        await this.svc.db.query(
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
        await this.svc.db.query(
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
      new Map<string, any[]>();
    const complianceEvidenceMap =
      new Map<string, any[]>();

    for (
      const row
      of evidenceRows
    ) {
      const key =
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`;

      if (
        Number(row.evi_type) === 2
      ) {
        complianceEvidenceMap.set(
          key,
          [
            ...(complianceEvidenceMap.get(key) || []),
            row,
          ],
        );
      }

      if (
        Number(row.evi_type) === 1
      ) {
        auditEvidenceMap.set(
          key,
          [
            ...(auditEvidenceMap.get(key) || []),
            row,
          ],
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
          this.svc.parseJsonArray(
            row.answer_given,
          ),
        evidences:
          auditEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || [],
        evidence:
          auditEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          )?.[0] || null,
        compliance_evidences:
          complianceEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || [],
        compliance_evidence:
          complianceEvidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          )?.[0] || null,
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
          evidences:
            auditEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || [],
          evidence:
            auditEvidenceMap.get(
              `${Number(row.id)}:0`,
            )?.[0] || null,
          compliance_evidences:
            complianceEvidenceMap.get(
              `${Number(row.id)}:0`,
            ) || [],
          compliance_evidence:
            complianceEvidenceMap.get(
              `${Number(row.id)}:0`,
            )?.[0] || null,
          annexure_rows:
            annexureMap.get(
              Number(row.id),
            ) || [],
        }),
      );

    await this.svc.attachTimelines(answers, assessmentId);

    return {
      overview:
      {
        ...overview,
        live_manager_compliance:
          liveManagerCompliance,
      },
      answers,
      counts:
        this.svc.getReviewerComplianceCounts(
          answers,
          liveManagerCompliance,
        ),
    };
  }

  async getReviewerComplianceEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      ![1, 3, 4, 5].includes(
        Number(assessment.audit_status_id),
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    const evidence =
      await this.svc.db.findOne(
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
      this.svc.getEvidenceStoragePath(
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
        this.svc.getEvidenceMimetype(
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
    liveManagerCompliance = false,
  ) {

    await this.svc.assertReviewerAuthority(
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
      ![2, 3, 5, 7].includes(action)
    ) {
      throw new BadRequestException(
        'Choose Accepted, Re-Compliance Needed, Carry Forward, or Partially Pass.',
      );
    }

    if (
      action === 7
      && !this.svc.cleanString(comment)
    ) {
      throw new BadRequestException(
        'Reviewer comment is required for Partially Pass.',
      );
    }

    const assessment =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 5
      &&
      !(
        liveManagerCompliance
        &&
        [1, 3, 4].includes(
          Number(assessment.audit_status_id),
        )
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    if (liveManagerCompliance) {
      const nextStatus =
        action === 2
          ? LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED
          : action === 3
            ? LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING
            : action === 5
              ? 5
              : 9;

      const result =
        await this.svc.db.transaction(
          async (client) => {
            if (targetType === 'answer') {
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
                      AND (
                          COALESCE(compliance_status_id, 0) IN ($7, $8, $9)
                          OR EXISTS (
                              SELECT 1
                              FROM answers_data_annexure aa
                              WHERE aa.answer_id = answers_data.id
                                  AND aa.assesment_id = answers_data.assesment_id
                                  AND COALESCE(aa.compliance_status_id, 0) IN (7, 8)
                                  AND aa.deleted_at IS NULL
                          )
                      )
                      AND deleted_at IS NULL
                  RETURNING id;
                  `,
                  [
                    nextStatus,
                    employeeId,
                    this.svc.cleanString(comment) || null,
                    assessment.batch_key,
                    observationId,
                    assessmentId,
                    LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
                    LIVE_COMPLIANCE_STATUS.AUDITOR_SETTLED,
                    LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED,
                  ],
                );

              if (parentResult.rows.length) {
                await client.query(
                  `
                  UPDATE answers_data_annexure
                  SET
                      compliance_status_id = CASE
                          WHEN COALESCE(compliance_status_id, 0) IN ($1, $8, $9, 7, 8)
                              THEN $2
                          ELSE compliance_status_id
                      END,
                      compliance_reviewer_emp_id = $3,
                      compliance_reviewer_comment = $4,
                      batch_key = $5
                  WHERE answer_id = $6
                      AND assesment_id = $7
                      AND deleted_at IS NULL;
                  `,
                  [
                    LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
                    nextStatus,
                    employeeId,
                    this.svc.cleanString(comment) || null,
                    assessment.batch_key,
                    observationId,
                    assessmentId,
                    LIVE_COMPLIANCE_STATUS.AUDITOR_SETTLED,
                    LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED,
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
                    AND COALESCE(aa.compliance_status_id, 0) IN ($7, $8, $9, 7, 8)
                    AND aa.deleted_at IS NULL
                RETURNING aa.id, aa.answer_id;
                `,
                [
                  nextStatus,
                  employeeId,
                  this.svc.cleanString(comment) || null,
                  assessment.batch_key,
                  observationId,
                  assessmentId,
                  LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
                  LIVE_COMPLIANCE_STATUS.AUDITOR_SETTLED,
                  LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED,
                ],
              );

            if (annexureResult.rows.length) {
              const answerId =
                Number(annexureResult.rows[0].answer_id);
              const rows =
                await client.query(
                  `
                  SELECT compliance_status_id
                  FROM answers_data_annexure
                  WHERE answer_id = $1
                      AND assesment_id = $2
                      AND deleted_at IS NULL;
                  `,
                  [answerId, assessmentId],
                );

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
                  this.svc.getLiveComplianceParentStatusFromRows(
                    rows.rows.map(
                      (row: any) =>
                        Number(row.compliance_status_id || 0),
                    ),
                  ),
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

      if (!result.rows.length) {
        throw new NotFoundException(
          'Live compliance point is not pending with Reviewer.',
        );
      }

      return {
        success: true,
        message:
          action === 2
            ? 'Live compliance point settled by Reviewer.'
            : action === 3
              ? 'Live compliance point returned to Manager.'
              : action === 5
                ? 'Live compliance point marked as carry forward.'
                : 'Live compliance point marked as Partially Pass.',
      };
    }
    const result =
      await this.svc.db.transaction(
        async (client) => {

          if (
            targetType === 'answer'
          ) {
            const parentResult =
              await client.query(
                `
                UPDATE answers_data
                SET
                    compliance_status_id = CASE
                        WHEN $1 = 2 AND compliance_status_id IN (8, 9) THEN 9
                        WHEN $1 = 7 THEN 9
                        ELSE $1
                    END,
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
                  this.svc.cleanString(comment)
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
                    compliance_status_id = CASE
                        WHEN $1 = 2 AND compliance_status_id IN (8, 9) THEN 9
                        WHEN $1 = 7 THEN 9
                        ELSE $1
                    END,
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
                  compliance_status_id = CASE
                      WHEN $1 = 2 AND aa.compliance_status_id IN (8, 9) THEN 9
                      WHEN $1 = 7 THEN 9
                      ELSE $1
                  END,
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
                this.svc.cleanString(comment)
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
                SELECT
                    COUNT(*) FILTER (WHERE compliance_status_id = 3)::int AS rejected_count,
                    COUNT(*) FILTER (WHERE compliance_status_id = 7)::int AS partial_count,
                    COUNT(*) FILTER (WHERE compliance_status_id = 8)::int AS partial_response_count,
                    COUNT(*) FILTER (WHERE compliance_status_id = 9)::int AS partial_settled_count
                FROM answers_data_annexure
                WHERE answer_id = $1
                    AND assesment_id = $2
                    AND compliance_status_id IN (3, 7, 8, 9)
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
                : Number(
                  remainingRejections.rows[0]?.partial_count || 0,
                ) > 0
                  ? 7
                  : Number(
                    remainingRejections.rows[0]?.partial_response_count || 0,
                  ) > 0
                    ? 8
                    : Number(
                      remainingRejections.rows[0]?.partial_settled_count || 0,
                    ) > 0
                      ? 9
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
            : action === 7
              ? 'Compliance response marked as Partially Pass.'
              : 'Compliance response marked for re-compliance.',
    };
  }

  async submitReviewerComplianceAssessment(
    assessmentId: number,
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      Number(assessment.audit_status_id) !== 5
      && (!liveManagerCompliance || Number(assessment.audit_status_id) !== 4)
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance review.',
      );
    }

    if (
      liveManagerCompliance
      && Number(assessment.audit_status_id) === 4
    ) {
      const pending =
        await this.svc.db.findOne(
          `
          SELECT COUNT(*)::int AS pending_count
          FROM answers_data
          WHERE assesment_id = $1
              AND is_compliance = 1
              AND COALESCE(compliance_status_id, 0) IN ($2, $3, $4, $5, $6, $7)
              AND deleted_at IS NULL;
          `,
          [
            assessmentId,
            0,
            4,
            LIVE_COMPLIANCE_STATUS.AUDITOR_PENDING,
            LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
            LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING,
            LIVE_COMPLIANCE_STATUS.AUDITOR_SETTLED,
          ],
        );

      if (
        Number(pending?.pending_count || 0) > 0
      ) {
        throw new BadRequestException(
          'Settle all points pending with Reviewer or Manager before submitting.',
        );
      }

      await this.svc.db.query(
        `
        UPDATE audit_assesment_master
        SET
            audit_status_id = 7,
            audit_end_date = CURRENT_DATE,
            compliance_end_date = COALESCE(compliance_end_date, CURRENT_DATE),
            compliance_review_emp_id = $2,
            compliance_review_date = CURRENT_DATE
        WHERE id = $1
            AND audit_status_id = 4
            AND deleted_at IS NULL;
        `,
        [
          assessmentId,
          employeeId,
        ],
      );

      const existing = await this.svc.db.findOne<{ id: number }>(
        `SELECT id FROM executive_summary_basic_details WHERE assesment_id = $1;`,
        [assessmentId]
      );
      if (existing) {
        await this.svc.db.query(
          `UPDATE executive_summary_basic_details SET report_submitted_date = CURRENT_DATE, updated_at = NOW() WHERE assesment_id = $1;`,
          [assessmentId]
        );
      } else {
        await this.svc.db.query(
          `INSERT INTO executive_summary_basic_details (year_id, assesment_id, report_submitted_date, staff_count, manual_challans_per_day, admin_id, created_at) VALUES ($1, $2, CURRENT_DATE, '0', '0', $3, NOW());`,
          [assessment.year_id, assessmentId, employeeId]
        );
      }

      try {
        await syncAssessmentScoring(
          this.svc.db,
          assessmentId,
        );
      } catch (err) {
        console.error(
          `Failed to sync assessment scoring for assessment ${assessmentId}:`,
          err,
        );
      }

      this.svc.emailService.sendComplianceReviewCompletedEmail(assessmentId, 7).catch((err) => {
        console.error(`Failed to send compliance review completed email for assessment ${assessmentId}: ${err.message}`);
      });

      return {
        success:
          true,
        message:
          'Live compliance review submitted. Assessment completed.',
        status_id:
          7,
        status:
          STATUS_LABELS[7],
      };
    }

    const pendingPartialResponses =
      await this.svc.db.findOne(
        `
        SELECT (
            (SELECT COUNT(*)
                FROM answers_data
                WHERE assesment_id = $1
                    AND is_compliance = 1
                    AND compliance_status_id = 8
                    AND deleted_at IS NULL)
            +
            (SELECT COUNT(*)
                FROM answers_data_annexure aa
                WHERE aa.assesment_id = $1
                    AND aa.compliance_status_id = 8
                    AND aa.deleted_at IS NULL
                    AND EXISTS (
                        SELECT 1
                        FROM answers_data ad
                        WHERE ad.id = aa.answer_id
                            AND ad.assesment_id = aa.assesment_id
                            AND ad.is_compliance = 1
                            AND ad.deleted_at IS NULL
                    ))
        )::int AS pending_count;
        `,
        [assessmentId],
      );

    if (
      Number(pendingPartialResponses?.pending_count || 0) > 0
    ) {
      throw new BadRequestException(
        'Review all manager responses for Partially Pass points before submitting.',
      );
    }

    const result =
      await this.svc.db.transaction(
        async (client) => {

          await client.query(
            `
            UPDATE answers_data
            SET
                compliance_status_id = 2,
                compliance_reviewer_emp_id = $2
            WHERE assesment_id = $1
                AND is_compliance = 1
                AND COALESCE(compliance_status_id, 0) NOT IN (2, 3, 5, 7, 9)
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
                AND COALESCE(aa.compliance_status_id, 0) NOT IN (2, 3, 5, 7, 9)
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
              )::int AS rejected_count,
              (
                  (SELECT COUNT(*)
                      FROM answers_data
                      WHERE assesment_id = $1
                          AND is_compliance = 1
                          AND compliance_status_id = 7
                          AND deleted_at IS NULL)
                  +
                  (SELECT COUNT(*)
                      FROM answers_data_annexure aa
                      WHERE aa.assesment_id = $1
                          AND aa.compliance_status_id = 7
                          AND aa.deleted_at IS NULL
                          AND EXISTS (
                              SELECT 1
                              FROM answers_data ad
                              WHERE ad.id = aa.answer_id
                                  AND ad.assesment_id = aa.assesment_id
                                  AND ad.is_compliance = 1
                                  AND ad.deleted_at IS NULL
                          ))
              )::int AS partial_count;
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
          const partialCount =
            Number(
              reviewSummary.rows[0]?.partial_count || 0,
            );
          const nextStatus =
            rejectedCount > 0 || partialCount > 0
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
              rejectedCount + partialCount,
              employeeId,
              updated.rows[0].batch_key,
            ],
          );

          await this.svc.auditLogService.createLog(
            'REVIEW_END',
            {
              employeeId,
              auditAssessmentId: assessmentId,
              oldStatus: STATUS_LABELS[5],
              newStatus: STATUS_LABELS[nextStatus],
              description: `Reviewer completed compliance review. Rejected points: ${rejectedCount}. Partially passed points: ${partialCount}. Carry-forward points: ${carryForwardCount}.`,
            },
            client,
          );

          const existing = await client.query(
            `SELECT id FROM executive_summary_basic_details WHERE assesment_id = $1;`,
            [assessmentId]
          );
          if (existing.rows.length) {
            await client.query(
              `UPDATE executive_summary_basic_details SET report_submitted_date = CURRENT_DATE, updated_at = NOW() WHERE assesment_id = $1;`,
              [assessmentId]
            );
          } else {
            await client.query(
              `INSERT INTO executive_summary_basic_details (year_id, assesment_id, report_submitted_date, staff_count, manual_challans_per_day, admin_id, created_at) VALUES ($1, $2, CURRENT_DATE, '0', '0', $3, NOW());`,
              [assessment.year_id, assessmentId, employeeId]
            );
          }

          return {
            rejectedCount,
            partialCount,
            nextStatus,
            carryForwardCount,
          };
        },
      );

    if (result.nextStatus === 7) {
      try {
        await syncAssessmentScoring(this.svc.db, assessmentId);
      } catch (err) {
        console.error(`Failed to sync assessment scoring for assessment ${assessmentId}:`, err);
      }
    }

    this.svc.emailService.sendComplianceReviewCompletedEmail(assessmentId, result.nextStatus).catch((err) => {
      console.error(`Failed to send compliance review completed email for assessment ${assessmentId}: ${err.message}`);
    });

    return {
      success:
        true,
      status_id:
        result.nextStatus,
      rejected_count:
        result.rejectedCount,
      carry_forward_count:
        result.carryForwardCount,
      partially_passed_count:
        result.partialCount,
      message:
        result.nextStatus === 6
          ? 'Compliance review submitted. Re-compliance and partially passed points returned to Manager.'
          : 'Compliance review submitted. Assessment completed.',
    };
  }

  async getReviewerAssessment(
    assessmentId: number,
    employeeId: number,
  ) {

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      Number(overview.audit_status_id) !== 2
    ) {
      throw new BadRequestException(
        'Assessment is not pending for audit review.',
      );
    }

    const existingLog = await this.svc.db.findOne(
      `SELECT id FROM audit_logs 
       WHERE audit_assesment_id = $1 
         AND event_type = 'REVIEW_START' 
         AND employee_id = $2 
         AND event_datetime >= COALESCE((SELECT audit_end_date FROM audit_assesment_master WHERE id = $1), '1970-01-01'::date)`,
      [assessmentId, employeeId],
    );
    if (!existingLog) {
      await this.svc.auditLogService.createLog('REVIEW_START', {
        employeeId,
        auditAssessmentId: assessmentId,
        description: `Reviewer started review for assessment.`,
      });
    }

    const answerResult =
      await this.svc.db.query(
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
        await this.svc.db.query(
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
        await this.svc.db.query(
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
      new Map<string, any[]>();

    for (
      const row
      of evidenceRows
    ) {
      const key =
        `${Number(row.answer_id)}:${Number(row.annex_id || 0)}`;

      evidenceMap.set(
        key,
        [
          ...(evidenceMap.get(key) || []),
          row,
        ],
      );
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
          this.svc.parseJsonArray(
            row.answer_given,
          ),
        evidences:
          evidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          ) || [],
        evidence:
          evidenceMap.get(
            `${answerId}:${Number(row.id)}`,
          )?.[0] || null,
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
          evidences:
            evidenceMap.get(
              `${Number(row.id)}:0`,
            ) || [],
          evidence:
            evidenceMap.get(
              `${Number(row.id)}:0`,
            )?.[0] || null,
          annexure_rows:
            annexureMap.get(
              Number(row.id),
            ) || [],
        }),
      );

    await this.svc.attachTimelines(answers, assessmentId);

    return {
      overview,
      answers,
      counts:
        this.svc.getReviewerCounts(
          answers,
        ),
    };
  }

  async getReviewerEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
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
      await this.svc.db.findOne(
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
      this.svc.getEvidenceStoragePath(
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
        this.svc.getEvidenceMimetype(
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

    await this.svc.assertReviewerAuthority(
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
      await this.svc.findAssessment(
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
      await this.svc.db.query(
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
          this.svc.cleanString(comment)
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

    await this.svc.assertReviewerAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
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
      await this.svc.db.transaction(
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
                  +
                  (SELECT COUNT(*) FROM executive_summary_branch_position
                      WHERE assesment_id = $1
                          AND audit_status_id = 3
                          AND deleted_at IS NULL)
                  +
                  (SELECT COUNT(*) FROM executive_summary_fresh_accounts
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

          const asmUnitRes = await client.query(
            `SELECT audit_unit_id FROM audit_assesment_master WHERE id = $1`,
            [assessmentId]
          );
          const auditUnitId = asmUnitRes.rows[0]?.audit_unit_id;

          let complianceDueDays = 20;
          if (auditUnitId) {
            const assessments = await client.query(`
              SELECT asm.id, asm.year_id, rsm.weighted_score
              FROM audit_assesment_master asm
              INNER JOIN report_scoring_master rsm ON rsm.assesment_id = asm.id
              WHERE asm.audit_unit_id = $1 AND asm.deleted_at IS NULL AND rsm.deleted_at IS NULL
            `, [auditUnitId]);

            const yearIds = Array.from(new Set(assessments.rows.map((a: any) => Number(a.year_id))));
            let yearTotals = new Map<number, number>();
            if (yearIds.length > 0) {
              const totalsRes = await client.query(`
                SELECT asm.year_id, rsm.weighted_score
                FROM audit_assesment_master asm
                INNER JOIN report_scoring_master rsm ON rsm.assesment_id = asm.id
                WHERE asm.year_id = ANY($1::bigint[]) AND asm.deleted_at IS NULL AND rsm.deleted_at IS NULL
              `, [yearIds]);
              totalsRes.rows.forEach((r: any) => {
                const yId = Number(r.year_id || 0);
                const score = Number(r.weighted_score || 0);
                yearTotals.set(yId, (yearTotals.get(yId) || 0) + score);
              });
            }

            const ratings = await client.query(`
              SELECT year_id, risk_type_id, range_from, range_to
              FROM risk_branch_rating
              WHERE audit_unit_id = $1 AND deleted_at IS NULL
            `, [auditUnitId]);
            const ratingsMap = new Map<number, any[]>();
            ratings.rows.forEach((r: any) => {
              const yId = Number(r.year_id || 0);
              if (!ratingsMap.has(yId)) ratingsMap.set(yId, []);
              ratingsMap.get(yId)!.push(r);
            });

            const frequencySettings = await client.query(`
              SELECT risk_type_id, frequency, audit_due_days, compliance_due_days
              FROM audit_frequency_master 
              WHERE is_active = 1 AND deleted_at IS NULL
            `);

            const complianceDueDaysMap = new Map<number, number>();
            frequencySettings.rows.forEach((f: any) => {
              complianceDueDaysMap.set(Number(f.risk_type_id), Number(f.compliance_due_days || 20));
            });

            const matchRating = (score: number, yearId: number): number => {
              const yearRatings = ratingsMap.get(yearId) || [];
              for (const rating of yearRatings) {
                const lowerBound = Number(rating.range_from || 0);
                const upperBound = Number(rating.range_to || 0);
                if (score >= lowerBound && score <= upperBound) {
                  return Number(rating.risk_type_id);
                }
              }
              if (score >= 3.0) return 1;
              if (score >= 2.0) return 2;
              return 3;
            };

            let totalScore = 0;
            assessments.rows.forEach((a: any) => {
              const yId = Number(a.year_id || 0);
              const score = Number(a.weighted_score || 0);
              const yearTotal = yearTotals.get(yId) || 1;
              const percentShare = yearTotal > 0 ? (score / yearTotal) * 100 : 0;
              const riskTypeId = matchRating(percentShare, yId);
              if (riskTypeId === 1) totalScore += 3;
              else if (riskTypeId === 2) totalScore += 2;
              else totalScore += 1;
            });

            const totalCount = assessments.rows.length;
            const riskAverage = totalCount > 0 ? totalScore / totalCount : 0;

            let finalRisk = 'LOW';
            if (riskAverage >= 2.5) finalRisk = 'HIGH';
            else if (riskAverage >= 1.5) finalRisk = 'MEDIUM';

            const riskTypeId = finalRisk === 'HIGH' ? 1 : finalRisk === 'MEDIUM' ? 2 : 3;
            complianceDueDays = complianceDueDaysMap.get(riskTypeId) || 20;
          }

          const updated =
            await client.query(
              `
              UPDATE audit_assesment_master
              SET
                  audit_status_id = $2::bigint,
                  audit_review_emp_id = $3,
                  audit_review_date = CURRENT_DATE,
                  compliance_start_date = CASE WHEN $2::bigint = 4 THEN CURRENT_DATE ELSE compliance_start_date END,
                  compliance_due_date = CASE WHEN $2::bigint = 4 THEN CURRENT_DATE + CAST($4 || ' days' AS INTERVAL) ELSE compliance_due_date END,
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
                complianceDueDays,
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

          await this.svc.auditLogService.createLog(
            'REVIEW_END',
            {
              employeeId,
              auditAssessmentId: assessmentId,
              oldStatus: STATUS_LABELS[2],
              newStatus: STATUS_LABELS[nextStatus],
              description: `Reviewer completed audit review. Rejected points: ${rejectedCount}. Compliance points: ${complianceCount}.`,
            },
            client,
          );

          return {
            rejectedCount,
            complianceCount,
            nextStatus,
          };
        },
      );

    try {
      await syncAssessmentScoring(this.svc.db, assessmentId);
    } catch (err) {
      console.error(`Failed to sync assessment scoring for assessment ${assessmentId}:`, err);
    }

    this.svc.emailService.sendReviewCompletedEmail(assessmentId, result.nextStatus).catch((err) => {
      console.error(`Failed to send reviewer completed email for assessment ${assessmentId}: ${err.message}`);
    });

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

}
