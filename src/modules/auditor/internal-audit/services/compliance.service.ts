import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { syncAssessmentScoring } from '../../../../common/helpers/assessment-scoring.helper';
import { InternalAuditService } from '../internal-audit.service';
import { randomUUID } from 'crypto';
import {
  EVIDENCE_FILE_TYPES,
  EVIDENCE_MAX_SIZE,
  LIVE_COMPLIANCE_STATUS,
  STATUS_LABELS,
} from '../internal-audit.constants';

/**
 * ComplianceService
 * Contains all branch-manager compliance workflow logic.
 * Shared DB helpers and utilities are delegated to InternalAuditService.
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly svc: InternalAuditService,
  ) { }

  async getCompliancePending(
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    await this.svc.assertCompliance(
      employeeId,
    );

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
              aam.compliance_start_date,
              aam.compliance_due_date,
              au.audit_unit_code,
              au.name AS audit_unit_name,
              sam.title AS special_audit_title,
              ym.year,
              'Live Compliance' AS compliance_stage,
              COUNT(DISTINCT ad.id) FILTER (
                  WHERE ad.is_compliance = 1
                      AND (
                          COALESCE(ad.compliance_status_id, 0) IN (
                              3,
                              7,
                              ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                          )
                          OR (
                              COALESCE(ad.compliance_status_id, 0) IN (0, 4)
                              AND NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NULL
                          )
                      )
              )::int AS compliance_points,
              COUNT(DISTINCT ad.id) FILTER (
                  WHERE ad.is_compliance = 1
                      AND COALESCE(ad.compliance_status_id, 0) IN (0, 3, 4)
                      AND NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NOT NULL
              )::int AS responded_points,
              true AS live_manager_compliance
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
          WHERE aam.audit_status_id IN (1, 3, 4, 5)
              AND aam.deleted_at IS NULL
              AND (
                  aam.branch_head_id = $1
                  OR aam.branch_subhead_id = $1
                  OR au.branch_head_id = $1
                  OR au.branch_subhead_id = $1
                  OR $1::text = ANY(
                      regexp_split_to_array(
                          COALESCE(aam.multi_compliance_ids, ''),
                          '\s*,\s*'
                      )
                  )
                  OR $1::text = ANY(
                      regexp_split_to_array(
                          COALESCE(au.multi_compliance_ids, ''),
                          '\s*,\s*'
                      )
                  )
              )
          GROUP BY
              aam.id,
              au.audit_unit_code,
              au.name,
              sam.title,
              ym.year
          HAVING COUNT(DISTINCT ad.id) FILTER (
              WHERE ad.is_compliance = 1
                  AND (
                      COALESCE(ad.compliance_status_id, 0) IN (
                          3,
                          7,
                          ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                      )
                      OR (
                          COALESCE(ad.compliance_status_id, 0) IN (0, 4)
                          AND NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NULL
                      )
                  )
          ) > 0
          ORDER BY aam.id DESC;
          `,
          [employeeId],
        );

      return {
        assessments:
          liveResult.rows,
      };
    }

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
            aam.compliance_start_date,
            aam.compliance_due_date,
            au.audit_unit_code,
            au.name AS audit_unit_name,
            sam.title AS special_audit_title,
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
                            OR ad.compliance_status_id IN (3, 7, 8)
                        )
                )
                +
                COUNT(DISTINCT aa.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND aa.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR aa.compliance_status_id IN (3, 7, 8)
                        )
                )
            )::int AS compliance_points,
            (
                COUNT(DISTINCT ad.id) FILTER (
                    WHERE ad.is_compliance = 1
                        AND ad.audit_status_id = 2
                        AND (
                            aam.audit_status_id = 4
                            OR ad.compliance_status_id IN (3, 7, 8)
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
                            OR aa.compliance_status_id IN (3, 7, 8)
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
        LEFT JOIN special_audit_master sam
            ON sam.assessment_id = aam.id
            AND sam.deleted_at IS NULL
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
            AND (
                aam.branch_head_id = $1
                OR aam.branch_subhead_id = $1
                OR au.branch_head_id = $1
                OR au.branch_subhead_id = $1
                OR $1::text = ANY(
                    regexp_split_to_array(
                        COALESCE(aam.multi_compliance_ids, ''),
                        '\s*,\s*'
                    )
                )
                OR $1::text = ANY(
                    regexp_split_to_array(
                        COALESCE(au.multi_compliance_ids, ''),
                        '\s*,\s*'
                    )
                )
            )
        GROUP BY
            aam.id,
            au.audit_unit_code,
            au.name,
            sam.title,
            ym.year
        HAVING (
            COUNT(DISTINCT ad.id) FILTER (
                WHERE ad.is_compliance = 1
                    AND ad.audit_status_id = 2
                    AND (
                        aam.audit_status_id = 4
                        OR ad.compliance_status_id IN (3, 7, 8)
                    )
            )
            +
            COUNT(DISTINCT aa.id) FILTER (
                WHERE ad.is_compliance = 1
                    AND ad.audit_status_id = 2
                    AND aa.audit_status_id = 2
                    AND (
                        aam.audit_status_id = 4
                        OR aa.compliance_status_id IN (3, 7, 8)
                    )
            )
        ) > 0
        ORDER BY aam.compliance_start_date DESC NULLS LAST, aam.id DESC;
        `, [employeeId]
      );

    return {
      assessments:
        result.rows,
    };
  }

  async getComplianceAssessment(
    assessmentId: number,
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    await this.svc.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const overview =
      await this.svc.findAssessment(
        assessmentId,
      );

    const complianceStatus =
      Number(overview.audit_status_id);

    if (
      !(
        [4, 6].includes(
          complianceStatus,
        )
        ||
        (
          liveManagerCompliance
          &&
          [1, 3, 4, 5].includes(
            complianceStatus,
          )
        )
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const overviewWithFlow = {
      ...overview,
      live_manager_compliance:
        liveManagerCompliance,
    };

    if (
      !liveManagerCompliance
      &&
      ![4, 6].includes(
        complianceStatus,
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const existingLog = await this.svc.db.findOne(
      `SELECT id FROM audit_logs 
       WHERE audit_assesment_id = $1 
         AND event_type = 'COMPLIANCE_START' 
         AND employee_id = $2 
         AND event_datetime >= COALESCE((SELECT audit_review_date FROM audit_assesment_master WHERE id = $1), '1970-01-01'::date)`,
      [assessmentId, employeeId],
    );
    if (!existingLog) {
      await this.svc.auditLogService.createLog('COMPLIANCE_START', {
        employeeId,
        auditAssessmentId: assessmentId,
        description: `Branch started compliance responses for assessment.`,
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
                        'options', COALESCE(
                            CASE 
                                WHEN ac.column_options IS NULL OR BTRIM(ac.column_options) = '' OR BTRIM(ac.column_options) = '[]' THEN '[]'::jsonb
                                ELSE ac.column_options::jsonb
                            END, 
                            '[]'::jsonb
                        )
                    )
                    ORDER BY ac.id
                ) AS columns_json
            FROM annexure_columns ac
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
            AND ad.deleted_at IS NULL
            AND (
                (
                    $3::boolean = true
                    AND (
                        COALESCE(ad.compliance_status_id, 0) IN (
                            3,
                            7,
                            ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                        )
                        OR (
                            COALESCE(ad.compliance_status_id, 0) IN (0, 4)
                            AND NULLIF(BTRIM(COALESCE(ad.audit_commpliance, '')), '') IS NULL
                        )
                    )
                )
                OR (
                    $3::boolean = false
                    AND ad.audit_status_id = 2
                    AND (
                        $2::int = 4
                        OR ad.compliance_status_id IN (3, 7, 8)
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa
                            WHERE aa.answer_id = ad.id
                                AND aa.assesment_id = ad.assesment_id
                                AND aa.compliance_status_id IN (3, 7, 8)
                                AND aa.deleted_at IS NULL
                        )
                    )
                )
            )
        ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id;
        `,
        [
          assessmentId,
          complianceStatus,
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
              audit_status_id,
              audit_reviewer_comment,
              audit_commpliance AS compliance_response,
              compliance_status_id,
              compliance_reviewer_comment,
              batch_key
          FROM answers_data_annexure
          WHERE assesment_id = $1
              AND answer_id = ANY($2::int[])
              AND deleted_at IS NULL
              AND (
                  (
                      $4::boolean = true
                      AND (
                          COALESCE(compliance_status_id, 0) IN (
                              3,
                              ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                          )
                          OR (
                              COALESCE(compliance_status_id, 0) IN (0, 4)
                              AND NULLIF(BTRIM(COALESCE(audit_commpliance, '')), '') IS NULL
                          )
                      )
                  )
                  OR (
                      $4::boolean = false
                      AND audit_status_id = 2
                      AND (
                          $3::int = 4
                          OR compliance_status_id IN (3, 7, 8)
                      )
                  )
              )
          ORDER BY answer_id, id;
          `,
          [
            assessmentId,
            answerIds,
            complianceStatus,
            liveManagerCompliance,
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
          response_required:
            liveManagerCompliance
            ||
            complianceStatus === 4
            || [3, 7, 8].includes(
              Number(row.compliance_status_id),
            ),
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
            (
              annexureMap.get(
                Number(row.id),
              ) || []
            ).map(
              (annexure: any) => ({
                ...annexure,
                response_required:
                  liveManagerCompliance
                  ||
                  complianceStatus === 4
                  || [3, 7, 8].includes(
                    Number(annexure.compliance_status_id),
                  ),
              }),
            ),
        }),
      );

    await this.svc.attachTimelines(answers, assessmentId);

    return {
      overview:
        overviewWithFlow,
      answers,
      counts:
        this.svc.getComplianceCounts(
          answers,
          String(
            overview.batch_key || '',
          ),
          !liveManagerCompliance
          &&
          complianceStatus === 6,
        ),
    };
  }

  async getComplianceEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.svc.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      ![1, 3, 4, 6].includes(
        Number(assessment.audit_status_id),
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
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
            AND em.evi_type = 1
            AND em.deleted_at IS NULL
            AND (
                (
                    $3::int IN (1, 3)
                    AND COALESCE(ad.compliance_status_id, 0) IN (0, 3, 4, 7)
                )
                OR (
                    $3::int IN (4, 6)
                    AND ad.audit_status_id = 2
                    AND (
                        $3::int = 4
                        OR ad.compliance_status_id IN (3, 7, 8)
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa
                            WHERE aa.answer_id = ad.id
                                AND aa.assesment_id = ad.assesment_id
                                AND aa.compliance_status_id IN (3, 7, 8)
                                AND aa.deleted_at IS NULL
                        )
                    )
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

  async getComplianceUploadedEvidenceFile(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {

    await this.svc.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const assessment =
      await this.svc.findAssessment(
        assessmentId,
      );

    if (
      ![1, 3, 4, 6].includes(
        Number(assessment.audit_status_id),
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
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
            AND em.evi_type = 2
            AND em.deleted_at IS NULL
            AND (
                (
                    $3::int IN (1, 3)
                    AND COALESCE(ad.compliance_status_id, 0) IN (0, 3, 4, 7)
                )
                OR (
                    $3::int IN (4, 6)
                    AND ad.audit_status_id = 2
                    AND (
                        $3::int = 4
                        OR ad.compliance_status_id IN (3, 7, 8)
                        OR EXISTS (
                            SELECT 1
                            FROM answers_data_annexure aa
                            WHERE aa.answer_id = ad.id
                                AND aa.assesment_id = ad.assesment_id
                                AND aa.compliance_status_id IN (3, 7, 8)
                                AND aa.deleted_at IS NULL
                        )
                    )
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

    await this.svc.assertComplianceAuthority(
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
      await this.svc.getComplianceEvidenceTarget(
        assessmentId,
        targetType,
        observationId,
      );

    const storedName =
      `${randomUUID()}${evidenceType.extension}`;

    const storagePath =
      this.svc.getEvidenceStoragePath(
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
      const result = await this.svc.db.query(
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
        VALUES ($1, $2, $3, 2, $4, $5, $6, $7, 0, 0, 0, NOW(), NOW())
        RETURNING id, answer_id, annex_id, evi_type, file_name, file_type, description, created_at;
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

      return {
        success:
          true,
        message:
          'Compliance evidence uploaded successfully.',
        evidence:
          result.rows[0],
      };
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
  }

  async deleteComplianceEvidence(
    assessmentId: number,
    evidenceId: number,
    employeeId: number,
  ) {
    await this.svc.assertComplianceAuthority(
      assessmentId,
      employeeId,
    );

    const result = await this.svc.db.query(
      `
        SELECT file_name
        FROM evidence_master
        WHERE id = $1
            AND assesment_id = $2
            AND deleted_at IS NULL;
      `,
      [
        evidenceId,
        assessmentId,
      ],
    );

    const evidence = result.rows[0];
    if (!evidence) {
      return {
        success: false,
        message: 'Compliance evidence not found.',
      };
    }

    await this.svc.db.query(
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

    const filePath = this.svc.getEvidenceStoragePath(
      assessmentId,
      evidence.file_name,
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      success: true,
      message: 'Compliance evidence removed successfully.',
    };
  }

  async saveComplianceResponse(
    assessmentId: number,
    targetType: string,
    observationId: number,
    employeeId: number,
    rawResponse: string,
    liveManagerCompliance = false,
  ) {

    await this.svc.assertComplianceAuthority(
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
      this.svc.cleanString(
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
      await this.svc.findAssessment(
        assessmentId,
      );

    const complianceStatus =
      Number(assessment.audit_status_id);

    if (
      !(
        [4, 6].includes(
          complianceStatus,
        )
        ||
        (
          liveManagerCompliance
          &&
          [1, 3, 4, 5].includes(
            complianceStatus,
          )
        )
      )
    ) {
      throw new BadRequestException(
        'Assessment is not pending for compliance.',
      );
    }

    const result =
      targetType === 'answer'
        ? await this.svc.db.query(
          `
            UPDATE answers_data
            SET
                audit_commpliance = $1,
                compliance_emp_id = $2,
                compliance_status_id = CASE
                    WHEN compliance_status_id = 7 THEN 8
                    WHEN $7::boolean = true
                        AND (
                            COALESCE(compliance_status_id, 0) IN (
                                3,
                                ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                            )
                            OR $6::int = 4
                        )
                        THEN ${LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING}
                    WHEN $7::boolean = true
                        THEN ${LIVE_COMPLIANCE_STATUS.AUDITOR_PENDING}
                    WHEN $6::int = 6 THEN compliance_status_id
                    ELSE 0
                END,
                batch_key = $3
            WHERE id = $4
                AND assesment_id = $5
                AND is_compliance = 1
                AND deleted_at IS NULL
                AND (
                    (
                        $7::boolean = true
                        AND (
                            COALESCE(compliance_status_id, 0) IN (
                                3,
                                7,
                                8,
                                ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                            )
                            OR (
                                COALESCE(compliance_status_id, 0) IN (0, 4)
                                AND NULLIF(BTRIM(COALESCE(audit_commpliance, '')), '') IS NULL
                            )
                        )
                    )
                    OR (
                        $7::boolean = false
                        AND audit_status_id = 2
                        AND (
                            $6::int = 4
                            OR compliance_status_id IN (3, 7, 8)
                        )
                    )
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
            liveManagerCompliance,
          ],
        )
        : await this.svc.db.query(
          `
            UPDATE answers_data_annexure aa
            SET
                audit_commpliance = $1,
                compliance_emp_id = $2,
                compliance_status_id = CASE
                    WHEN aa.compliance_status_id = 7 THEN 8
                    WHEN $7::boolean = true
                        AND (
                            COALESCE(aa.compliance_status_id, 0) IN (
                                3,
                                ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                            )
                            OR $6::int = 4
                        )
                        THEN ${LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING}
                    WHEN $7::boolean = true
                        THEN ${LIVE_COMPLIANCE_STATUS.AUDITOR_PENDING}
                    WHEN $6::int = 6 THEN aa.compliance_status_id
                    ELSE 0
                END,
                batch_key = $3
            WHERE aa.id = $4
                AND aa.assesment_id = $5
                AND aa.deleted_at IS NULL
                AND (
                    (
                        $7::boolean = true
                        AND (
                            COALESCE(aa.compliance_status_id, 0) IN (
                                3,
                                7,
                                8,
                                ${LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING}
                            )
                            OR (
                                COALESCE(aa.compliance_status_id, 0) IN (0, 4)
                                AND NULLIF(BTRIM(COALESCE(aa.audit_commpliance, '')), '') IS NULL
                            )
                        )
                    )
                    OR (
                        $7::boolean = false
                        AND aa.audit_status_id = 2
                        AND (
                            $6::int = 4
                            OR aa.compliance_status_id IN (3, 7, 8)
                        )
                    )
                )
                AND EXISTS (
                    SELECT 1
                    FROM answers_data ad
                    WHERE ad.id = aa.answer_id
                        AND ad.assesment_id = aa.assesment_id
                        AND ad.is_compliance = 1
                        AND (
                            $7::boolean = true
                            OR ad.audit_status_id = 2
                        )
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
            liveManagerCompliance,
          ],
        );

    if (
      !result.rows.length
    ) {
      throw new NotFoundException(
        'Compliance point not found for this assessment.',
      );
    }

    if (
      liveManagerCompliance
      && Number(assessment.audit_status_id) === 4
    ) {
      await this.svc.db.query(
        `
        UPDATE audit_assesment_master
        SET compliance_end_date = CURRENT_DATE
        WHERE id = $1
            AND deleted_at IS NULL;
        `,
        [assessmentId]
      );
    }

    return {
      success:
        true,
      message:
        complianceStatus === 6
          ? 'Corrected compliance response saved.'
          : liveManagerCompliance
            ? 'Compliance response saved successfully.'
            : 'Compliance response saved.',
    };
  }

  async getComplianceSubmissionPreview(
    assessmentId: number,
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    if (
      liveManagerCompliance
    ) {
      await this.svc.assertComplianceAuthority(
        assessmentId,
        employeeId,
      );

      const assessment =
        await this.svc.findAssessment(
          assessmentId,
        );

      const counts =
        await this.svc.db.findOne(
          `
          SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (
                  WHERE COALESCE(compliance_status_id, 0) IN (
                      3,
                      7,
                      $2
                  )
                  OR (
                      COALESCE(compliance_status_id, 0) IN (0, 4)
                      AND NULLIF(BTRIM(COALESCE(audit_commpliance, '')), '') IS NULL
                  )
              )::int AS pending
          FROM answers_data
          WHERE assesment_id = $1
              AND is_compliance = 1
              AND NULLIF(BTRIM(COALESCE(audit_comment, '')), '') IS NOT NULL
              AND deleted_at IS NULL;
          `,
          [
            assessmentId,
            LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING,
          ],
        );

      const total =
        Number(counts?.total || 0);
      const pending =
        Number(counts?.pending || 0);

      return {
        can_submit:
          total > 0
          && pending === 0,
        total_points:
          total,
        completed_points:
          Math.max(total - pending, 0),
        pending_count:
          pending,
        message:
          !total
            ? 'No compliance-required observations were found.'
            : pending
              ? `${pending} compliance response(s) are pending.`
              : Number(assessment.audit_status_id) === 4
                ? 'All compliance responses are saved. Submit them to Auditor.'
                : 'All corrected compliance responses are saved. Submit them back to Reviewer.',
      };
    }

    const detail =
      await this.getComplianceAssessment(
        assessmentId,
        employeeId,
        liveManagerCompliance,
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
            : liveManagerCompliance
              ? 'All live compliance responses are saved. Reviewer can review them now.'
              : isReCompliance
                ? 'All corrected compliance responses are saved. Assessment is ready to return to Reviewer.'
                : 'All compliance responses are saved. Assessment is ready for reviewer compliance review.',
    };
  }

  async submitComplianceAssessment(
    assessmentId: number,
    employeeId: number,
    liveManagerCompliance = false,
  ) {

    const preview =
      await this.getComplianceSubmissionPreview(
        assessmentId,
        employeeId,
        liveManagerCompliance,
      );

    if (
      !preview.can_submit
    ) {
      throw new BadRequestException(
        preview.message,
      );
    }

    if (
      liveManagerCompliance
    ) {
      const assessment =
        await this.svc.findAssessment(
          assessmentId,
        );
      const currentStatus =
        Number(assessment.audit_status_id);
      const nextStatus =
        currentStatus === 4
          ? 1
          : currentStatus;

      await this.svc.db.query(
        `
        UPDATE audit_assesment_master
        SET
            audit_status_id = $2,
            compliance_emp_id = $3,
            compliance_end_date = CURRENT_DATE
        WHERE id = $1
            AND audit_status_id = $4
            AND deleted_at IS NULL;
        `,
        [
          assessmentId,
          nextStatus,
          employeeId,
          currentStatus,
        ],
      );

      this.svc.emailService.sendComplianceSubmittedEmail(assessmentId).catch((err) => {
        console.error(`Failed to send compliance submitted email for assessment ${assessmentId}: ${err.message}`);
      });

      return {
        success:
          true,
        status_id:
          nextStatus,
        message:
          currentStatus === 4
            ? 'Compliance responses submitted to Auditor for review.'
            : 'Corrected compliance responses returned to Reviewer.',
      };
    }

    const currentStatus =
      Number(
        (
          await this.svc.findAssessment(
            assessmentId,
          )
        ).audit_status_id,
      );

    await this.svc.db.transaction(
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

        await this.svc.auditLogService.createLog(
          'COMPLIANCE_END',
          {
            employeeId,
            auditAssessmentId: assessmentId,
            oldStatus: STATUS_LABELS[currentStatus],
            newStatus: STATUS_LABELS[5],
            description: `Branch submitted compliance responses.`,
          },
          client,
        );
      },
    );

    try {
      await syncAssessmentScoring(this.svc.db, assessmentId);
    } catch (err) {
      console.error(`Failed to sync assessment scoring for assessment ${assessmentId}:`, err);
    }

    this.svc.emailService.sendComplianceSubmittedEmail(assessmentId).catch((err) => {
      console.error(`Failed to send compliance submitted email for assessment ${assessmentId}: ${err.message}`);
    });

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

}
