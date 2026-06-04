import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService }
    from '../../../core/database/database.service';

import {
    AuditDashboardDto,
    OpenAssessmentDto,
} from './dto/audit-dashboard.dto';

const EXECUTIVE_BRANCH_POSITION_LINES = [
    { type_id: 1, group: 'Deposits', name: 'CASA Deposit' },
    { type_id: 2, group: 'Deposits', name: 'Term Deposit' },
    { type_id: 3, group: 'Advances', name: 'Clean Loan' },
    { type_id: 4, group: 'Advances', name: 'Vehicle Loan' },
    { type_id: 5, group: 'Advances', name: 'Gold Loan' },
    { type_id: 6, group: 'Advances', name: 'Other Term Loan' },
    { type_id: 7, group: 'Advances', name: 'Cash Credit Loan' },
    { type_id: 8, group: 'Advances', name: 'Decreed Loan' },
    { type_id: 9, group: 'NPA', name: 'Clean Loan' },
    { type_id: 10, group: 'NPA', name: 'Vehicle Loan' },
    { type_id: 11, group: 'NPA', name: 'Gold Loan' },
    { type_id: 12, group: 'NPA', name: 'Other Term Loan' },
    { type_id: 13, group: 'NPA', name: 'Cash Credit Loan' },
    { type_id: 14, group: 'NPA', name: 'Decreed Loan' },
];

const EXECUTIVE_FRESH_ACCOUNT_LINES = [
    { type_id: 1, group: 'Deposits', name: 'CASA Deposit' },
    { type_id: 2, group: 'Deposits', name: 'Term Deposit (New)' },
    { type_id: 3, group: 'Deposits', name: 'Term Deposits (Through Auto-Renewals)' },
    { type_id: 4, group: 'Advances', name: 'Clean Loan' },
    { type_id: 5, group: 'Advances', name: 'Vehicle Loan' },
    { type_id: 6, group: 'Advances', name: 'Gold Loan' },
    { type_id: 7, group: 'Advances', name: 'Loan Against Fixed Deposits' },
    { type_id: 8, group: 'Advances', name: 'Other Term Loan' },
    { type_id: 9, group: 'Advances', name: 'Cash Credit Loans (New)' },
    { type_id: 10, group: 'Advances', name: 'Cash Credit Loans (Renewals)' },
    { type_id: 11, group: 'NPA', name: 'Clean Loan' },
    { type_id: 12, group: 'NPA', name: 'Vehicle Loan' },
    { type_id: 13, group: 'NPA', name: 'Gold Loan' },
    { type_id: 14, group: 'NPA', name: 'Other Term Loan' },
    { type_id: 15, group: 'NPA', name: 'Cash Credit Loan' },
    { type_id: 16, group: 'NPA', name: 'Decreed Accounts' },
];

@Injectable()
export class AuditDashboardService {

    constructor(
        private readonly db:
            DatabaseService,
    ) { }

 async findAll(
    dto: AuditDashboardDto,
) {

    try {

        const auditUnits =
            await this.getAuthorizedAuditUnits(
                dto.employee_id,
            );

        if (!auditUnits.length) {
            return [];
        }

        const auditUnitIds =
            auditUnits.map(
                (x: any) => x.id,
            );

        const [
            summaryData,
            notStartedData,
        ] = await Promise.all([

            this.getAssessmentSummary(
                auditUnitIds,
            ),

            this.getNotStartedAudits(
                auditUnits,
            ),

        ]);

        const summaryMap =
            new Map(

                summaryData.map(
                    (x: any) => [
                        x.audit_unit_id,
                        x,
                    ],
                ),
            );

        return auditUnits.map(
            (unit: any) => {

                const summary =
                    summaryMap.get(
                        unit.id,
                    );

                const notStarted =
                    notStartedData[
                    unit.id
                    ] || [];

                return {

                    audit_unit_id:
                        unit.id,

                    audit_unit_code:
                        unit.audit_unit_code,

                    audit_unit_name:
                        unit.name,

                    frequency:
                        unit.frequency,

                    last_audit_date:
                        unit.last_audit_date,

                    total_audit:
                        Number(
                            summary?.total_audit || 0,
                        ),

                    audit_pending:
                        Number(
                            summary?.audit_pending || 0,
                        ),

                    review_pending:
                        Number(
                            summary?.review_pending || 0,
                        ),

                    compliance_pending:
                        Number(
                            summary?.compliance_pending || 0,
                        ),

                    audit_completed:
                        Number(
                            summary?.audit_completed || 0,
                        ),

                    latest_assessment_id:
                        summary?.latest_assessment_id || null,

                    latest_status_id:
                        summary?.latest_status_id || null,

                    latest_status:
                        summary?.latest_status
                        || 'NOT STARTED',

                    not_started_count:
                        notStarted.length,

                };
            },
        );

    } catch (error) {

        console.log(error);

        throw new BadRequestException(
            'Failed to fetch dashboard',
        );
    }
}



async getAuthorizedAuditUnits(
    employeeId: number,
) {

    const query = `

    WITH employee_units AS (

        SELECT

            string_to_array(
                audit_unit_authority,
                ','
            )::int[] AS unit_ids

        FROM employee_master

        WHERE id = $1

    )

    SELECT DISTINCT

        au.id,
        au.audit_unit_code,
        au.name,
        au.frequency,
        au.last_audit_date

    FROM audit_unit_master au

    CROSS JOIN employee_units eu

    WHERE

        au.is_active = 1

        AND au.deleted_at IS NULL

        AND au.id = ANY(eu.unit_ids)

    ORDER BY

        au.audit_unit_code;

    `;

    const result =
        await this.db.query(
            query,
            [employeeId],
        );

    return result.rows;
}



async getAssessmentSummary(
    auditUnitIds: number[],
) {

    if (!auditUnitIds.length) {
        return [];
    }

    const query = `

    WITH latest_assessment AS (

        SELECT DISTINCT ON (
            aam.audit_unit_id
        )

            aam.audit_unit_id,
            aam.id,
            aam.audit_status_id

        FROM audit_assesment_master aam

        WHERE aam.deleted_at IS NULL

        ORDER BY
            aam.audit_unit_id,
            aam.id DESC
    )

    SELECT

        am.audit_unit_id,

        COUNT(*) AS total_audit,

        COUNT(*) FILTER (
            WHERE am.audit_status_id IN (1, 3)
        ) AS audit_pending,

        COUNT(*) FILTER (
            WHERE am.audit_status_id IN (2, 5)
        ) AS review_pending,

        COUNT(*) FILTER (
            WHERE am.audit_status_id IN (4, 6)
        ) AS compliance_pending,

        COUNT(*) FILTER (
            WHERE am.audit_status_id = 7
        ) AS audit_completed,

        la.id AS latest_assessment_id,

        la.audit_status_id AS latest_status_id,

        CASE

            WHEN la.audit_status_id
                IN (1, 3)

            THEN 'AUDIT PENDING'

            WHEN la.audit_status_id
                IN (2, 5)

            THEN 'REVIEW PENDING'

            WHEN la.audit_status_id
                IN (4, 6)

            THEN 'COMPLIANCE PENDING'

            WHEN la.audit_status_id = 7

            THEN 'ASSESMENT COMPLETED'

            ELSE 'NOT STARTED'

        END AS latest_status

    FROM audit_assesment_master am

    LEFT JOIN latest_assessment la

        ON la.audit_unit_id =
            am.audit_unit_id

    WHERE

        am.deleted_at IS NULL

        AND am.audit_unit_id = ANY($1)

    GROUP BY

        am.audit_unit_id,
        la.id,
        la.audit_status_id

    `;

    const result =
        await this.db.query(
            query,
            [auditUnitIds],
        );

    return result.rows;
}



async getNotStartedAudits(
    auditUnits: any[],
) {

    const response: any = {};

    if (!auditUnits.length) {
        return response;
    }

    const currentDate =
        new Date();

    const auditUnitIds =
        auditUnits.map(
            (x: any) => x.id,
        );

    // SINGLE QUERY
    const existingAssessmentsQuery = `

        SELECT

            audit_unit_id,
            assesment_period_to

        FROM audit_assesment_master

        WHERE audit_unit_id = ANY($1)

    `;

    const existingAssessments =
        await this.db.query(

            existingAssessmentsQuery,

            [auditUnitIds],
        );

    // FAST MEMORY LOOKUP
    const assessmentSet =
        new Set(

            existingAssessments.rows.map(
                (x: any) =>

                    `${x.audit_unit_id}_${this.formatDate(
                        x.assesment_period_to,
                    )}`,
            ),
        );

    for (
        const branchDetails
        of auditUnits
    ) {

        response[
            branchDetails.id
        ] = [];

        if (
            !branchDetails
                .last_audit_date
        ) {

            continue;
        }

        const frequency =
            Number(
                branchDetails.frequency,
            );

        const lastAuditDate =
            new Date(
                branchDetails
                    .last_audit_date,
            );

        if (
            lastAuditDate >=
            currentDate
        ) {

            continue;
        }

        const nextAssessmentDate =
            new Date(
                lastAuditDate,
            );

        nextAssessmentDate
            .setMonth(

                nextAssessmentDate
                    .getMonth()

                +

                frequency,
            );

        const nextAssessmentEndDate =
            new Date(
                nextAssessmentDate,
            );

        nextAssessmentEndDate
            .setDate(

                nextAssessmentEndDate
                    .getDate() - 1,
            );

        const assessmentKey =

            `${branchDetails.id}_${this.formatDate(
                nextAssessmentEndDate,
            )}`;

        // NO DB QUERY HERE
        if (
            assessmentSet.has(
                assessmentKey,
            )
        ) {

            continue;
        }

        const currentDateDiff =
            this.monthDiff(

                lastAuditDate,

                currentDate,
            );

        const assessmentCount =
            Math.max(

                Math.floor(

                    currentDateDiff
                    /
                    frequency,
                ),

                1,
            );

        for (
            let i = 0;
            i < assessmentCount;
            i++
        ) {

            const assessmentStartDate =
                new Date(
                    lastAuditDate,
                );

            assessmentStartDate
                .setMonth(

                    assessmentStartDate
                        .getMonth()

                    +

                    (
                        i
                        *
                        frequency
                    ),
                );

            assessmentStartDate
                .setDate(

                    assessmentStartDate
                        .getDate() + 1,
                );

            const assessmentEndDate =
                new Date(
                    assessmentStartDate,
                );

            assessmentEndDate
                .setMonth(

                    assessmentEndDate
                        .getMonth()

                    +

                    frequency,
                );

            assessmentEndDate
                .setDate(

                    assessmentEndDate
                        .getDate() - 1,
                );

            response[
                branchDetails.id
            ].push({

                id:
                    branchDetails.id,

                assesment_period:

                    `${this.formatDate(
                        assessmentStartDate,
                    )} to ${this.formatDate(
                        assessmentEndDate,
                    )}`,
            });
        }
    }

    return response;
}



    async getNotStartedByUnit(
        auditUnitId: number,
    ) {

        const query = `

SELECT

    id,

    audit_unit_code,

    name,

    frequency,

    last_audit_date

FROM audit_unit_master

WHERE id = $1

LIMIT 1;

        `;

        const result =
            await this.db.query(
                query,
                [auditUnitId],
            );

        if (
            !result.rows.length
        ) {

            throw new NotFoundException(
                'Audit unit not found',
            );
        }

        const response =
            await this.getNotStartedAudits(
                result.rows,
            );

        return response[
            auditUnitId
        ] || [];
    }


    async getAssessmentDetails(
        auditUnitId: number,
    ) {

        const query = `

        SELECT

            am.id,

            am.audit_status_id,

            am.assesment_period_from,

            am.assesment_period_to,

            am.audit_start_date,

            am.audit_end_date,

            am.audit_due_date,

            ym.year,

            au.name
                AS audit_unit_name,

            au.audit_unit_code

        FROM audit_assesment_master am

        LEFT JOIN audit_unit_master au
            ON au.id = am.audit_unit_id

        LEFT JOIN year_master ym
            ON ym.id = am.year_id

        WHERE am.audit_unit_id = $1

        AND am.deleted_at IS NULL

        ORDER BY am.id DESC

        LIMIT 1;

        `;

        const result =
            await this.db.query(
                query,
                [auditUnitId],
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


    async openAssessment(
        dto: OpenAssessmentDto,
    ) {

        const hasAuthority =
            await this.hasAuditUnitAuthority(
                dto.employee_id,
                dto.audit_unit_id,
            );

        if (
            !hasAuthority
        ) {

            return {

                assessment_id: null,

                audit_unit_id:
                    dto.audit_unit_id,

                action: 'not_allowed',

                message: 'Auditor is not authorized for this audit unit',
            };
        }

        const query = `

SELECT

    id,

    audit_status_id,

    audit_due_date,

    is_limit_blocked

FROM audit_assesment_master

WHERE audit_unit_id = $1

AND deleted_at IS NULL

ORDER BY id DESC

LIMIT 1;

        `;

        const result =
            await this.db.query(

                query,

                [
                    Number(dto.audit_unit_id),
                ],
            );

        if (
            result.rows.length
        ) {
            const assessment =
                result.rows[0];

            if (
                ![1, 3].includes(
                    Number(
                        assessment.audit_status_id,
                    ),
                )
            ) {

                return {

                    assessment_id:
                        assessment.id,

                    audit_unit_id:
                        dto.audit_unit_id,

                    audit_status_id:
                        assessment.audit_status_id,

                    action:
                        'unit_dashboard',

                    message:
                        'Current assessment is not pending with auditor.',
                };
            }

            if (
                Number(
                    assessment.is_limit_blocked || 0,
                )
            ) {

                return {

                    assessment_id:
                        assessment.id,

                    audit_unit_id:
                        dto.audit_unit_id,

                    audit_status_id:
                        assessment.audit_status_id,

                    action:
                        'unit_dashboard',

                    message:
                        'Current audit assessment is blocked.',
                };
            }

            if (
                assessment.audit_due_date
                &&
                this.isPastDate(
                    assessment.audit_due_date,
                )
            ) {

                return {

                    assessment_id:
                        assessment.id,

                    audit_unit_id:
                        dto.audit_unit_id,

                    audit_status_id:
                        assessment.audit_status_id,

                    action:
                        'unit_dashboard',

                    message:
                        'Audit period has expired for this assessment.',
                };
            }

            return {

                assessment_id:
                    assessment.id,

                audit_unit_id:
                    dto.audit_unit_id,

                audit_status_id:
                    assessment
                        .audit_status_id,

                action:
                    'continue',
            };
        }

        return {

            assessment_id: null,

            audit_unit_id:
                dto.audit_unit_id,

            action: 'unit_dashboard',
        };
    }



    monthDiff(
        d1: Date,
        d2: Date,
    ) {

        let months;

        months =
            (
                d2.getFullYear()
                -
                d1.getFullYear()
            )
            *
            12;

        months -=
            d1.getMonth();

        months +=
            d2.getMonth();

        return months <= 0
            ? 0
            : months;
    }

    /* ===================================================== */
    /* FORMAT DATE */
    /* ===================================================== */

    formatDate(
        date: Date,
    ) {

        return date
            .toISOString()
            .split('T')[0];
    }

    async hasAuditUnitAuthority(
        employeeId: number,
        auditUnitId: number,
    ) {

        const result =
            await this.db.query(
                `
SELECT id
FROM employee_master em
WHERE em.id = $1
AND EXISTS (
    SELECT 1
    FROM unnest(string_to_array(COALESCE(em.audit_unit_authority, ''), ',')) unit_id
    WHERE trim(unit_id) = $2::text
)
LIMIT 1;
                `,
                [
                    employeeId,
                    auditUnitId,
                ],
            );

        return result.rows.length > 0;
    }

    isPastDate(
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
    async getExecutiveSummary(
        assessment_id: number,
        employeeId: number,
    ) {

        const assessmentQuery = `
SELECT 
    aam.id,
    aam.year_id,
    aam.audit_unit_id,
    aam.frequency,
    aam.assesment_period_from,
    aam.assesment_period_to,
    aam.audit_start_date,
    aam.audit_end_date,
    aam.compliance_due_date,
    CASE aam.audit_status_id
        WHEN 1 THEN 'AUDIT (PENDING / ACTIVE)'
        WHEN 2 THEN 'REVIEW (PENDING / ACTIVE)'
        WHEN 3 THEN 'RE AUDIT (PENDING / ACTIVE)'
        WHEN 4 THEN 'COMPLIANCE (PENDING / ACTIVE)'
        WHEN 5 THEN 'REVIEW (PENDING / ACTIVE)'
        WHEN 6 THEN 'RE COMPLIANCE (PENDING / ACTIVE)'
        WHEN 7 THEN 'ASSESMENT COMPLETED'
        WHEN 8 THEN 'REVIEWER TO AUDIT (All OBSERVATIONS)'
        WHEN 9 THEN 'REVIEWER TO COMPLIANCE (All OBSERVATIONS)'
        WHEN 10 THEN 'ADMIN INCREASE ACCEPT / REJECT LIMIT IN AUDIT'
        WHEN 11 THEN 'ADMIN INCREASE ACCEPT / REJECT LIMIT IN COMPLIANCE'
        WHEN 12 THEN 'ADMIN INCREASE DUE DATE IN AUDIT'
        WHEN 13 THEN 'ADMIN INCREASE DUE DATE IN COMPLIANCE'
        WHEN 14 THEN 'REVIEWER TO AUDIT (ENTIRE ASSESMENT BACK TO AUDIT)'
        ELSE 'UNKNOWN'
    END AS audit_status,
    aam.audit_review_date,
    aam.compliance_review_date,
    aum.name AS branch_name,
    aum.audit_unit_code AS branch_code,
    (
        aam.audit_end_date::date
        -
        aam.audit_start_date::date
    ) AS audit_duration_days,
    branch_manager.name AS branch_manager_name,
    branch_assitant_manager.name AS branch_assistant_manager,
    auditor_name.name AS auditor_name,
    td.deposit_target AS deposit_target,
    td.advances_target AS advances_target,
    td.npa_target AS npa_target,
    esb.id AS esb_id,
    esb.report_submitted_date AS report_submitted_date,
    esb.staff_count As staff_count,
    esb.manual_challans_per_day as manual_challans_per_day
FROM audit_assesment_master aam
LEFT JOIN audit_unit_master aum
    ON aum.id = aam.audit_unit_id
LEFT JOIN employee_master auditor
    ON auditor.id = aam.audit_emp_id
LEFT JOIN employee_master review
    ON review.id = aam.audit_review_emp_id
LEFT JOIN employee_master branch_manager
    ON branch_manager.id = aam.branch_head_id
LEFT JOIN employee_master branch_assitant_manager
    ON branch_assitant_manager.id = aam.branch_subhead_id
LEFT JOIN employee_master auditor_name
    ON auditor_name.id = aam.audit_head_id
LEFT JOIN target_details td
    ON td.audit_unit_id = aam.audit_unit_id
    AND td.year_id = aam.year_id
left join executive_summary_basic_details esb
  on esb.assesment_id=aam.id
WHERE aam.id = $1
LIMIT 1;
        `;

        const assessment = await this.db.query(assessmentQuery, [assessment_id]);

        if (
             !assessment.rows.length
        ) {
            throw new NotFoundException(
                'Assessment not found',
            );
        }

        let data = assessment.rows[0];

        if (
            !await this.hasAuditUnitAuthority(
                employeeId,
                Number(data.audit_unit_id),
            )
        ) {
            throw new BadRequestException(
                'You are not authorized for this audit unit.',
            );
        }

        if (!data.esb_id) {
            const [depositsResult, advancesResult] = await Promise.all([
                this.db.query(
                    `
SELECT 
  sm.scheme_code,
  sm.category_id,
  SUM(COALESCE(dd.balance::numeric, 0)) AS total_balance,
  COUNT(dd.account_no) AS total_accounts
FROM dump_deposits dd
LEFT JOIN scheme_master sm ON sm.id = dd.scheme_id
WHERE dd.branch_id = $1 
  AND dd.account_opening_date BETWEEN $2 AND $3
  AND dd.deleted_at IS NULL
GROUP BY sm.scheme_code, sm.category_id;
                    `,
                    [data.audit_unit_id, data.assesment_period_from, data.assesment_period_to]
                ),
                this.db.query(
                    `
SELECT 
  sm.scheme_code,
  sm.category_id,
  da.npa_status,
  SUM(COALESCE(da.outstanding_balance::numeric, 0)) AS total_balance,
  COUNT(da.account_no) AS total_accounts
FROM dump_advances da
LEFT JOIN scheme_master sm ON sm.id = da.scheme_id
WHERE da.branch_id = $1 
  AND da.account_opening_date BETWEEN $2 AND $3
  AND da.deleted_at IS NULL
GROUP BY sm.scheme_code, sm.category_id, da.npa_status;
                    `,
                    [data.audit_unit_id, data.assesment_period_from, data.assesment_period_to]
                )
            ]);

            await this.db.transaction(async (client) => {
                await client.query(
                    `DELETE FROM executive_summary_branch_position WHERE assesment_id = $1 AND year_id = $2`,
                    [assessment_id, data.year_id]
                );
                await client.query(
                    `DELETE FROM executive_summary_fresh_accounts WHERE assesment_id = $1 AND year_id = $2`,
                    [assessment_id, data.year_id]
                );
                await client.query(
                    `
INSERT INTO executive_summary_basic_details (
    year_id,
    assesment_id,
    report_submitted_date,
    staff_count,
    manual_challans_per_day,
    admin_id,
    created_at
)
VALUES ($1, $2, null, '0', '0', $3, NOW());
                    `,
                    [data.year_id, assessment_id, employeeId]
                );

                for (const row of depositsResult.rows) {
                    const schemeCode = String(row.scheme_code || '').trim();
                    if (!schemeCode) continue;
                    const balance = Number(row.total_balance || 0);
                    const accounts = Number(row.total_accounts || 0);

                    // Insert into branch_position (type_id = schemeCode)
                    await client.query(
                        `INSERT INTO executive_summary_branch_position (
                            year_id, assesment_id, type_id, amount,
                            business_risk, control_risk, risk_type,
                            audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                            compliance_emp_id, compliance_status_id,
                            compliance_reviewer_emp_id, batch_key, created_at
                        ) VALUES ($1, $2, $3, $4, 4, 4, 1, 1, $5, 0, 0, 0, 0, $6, NOW());`,
                        [data.year_id, assessment_id, schemeCode, String(balance), employeeId, data.batch_key]
                    );

                    // Insert into fresh_accounts (type_id = schemeCode)
                    await client.query(
                        `INSERT INTO executive_summary_fresh_accounts (
                            year_id, assesment_id, type_id, accounts,
                            business_risk, control_risk, risk_type,
                            audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                            compliance_emp_id, compliance_status_id,
                            compliance_reviewer_emp_id, batch_key, created_at
                        ) VALUES ($1, $2, $3, $4, 4, 4, 1, 1, $5, 0, 0, 0, 0, $6, NOW());`,
                        [data.year_id, assessment_id, schemeCode, String(accounts), employeeId, data.batch_key]
                    );
                }

                for (const row of advancesResult.rows) {
                    const schemeCode = String(row.scheme_code || '').trim();
                    if (!schemeCode) continue;
                    const balance = Number(row.total_balance || 0);
                    const accounts = Number(row.total_accounts || 0);
                    const isNpa = !['STD', 'SB_STD', 'N'].includes(String(row.npa_status || '').trim().toUpperCase());

                    const dbTypeId = isNpa ? `${schemeCode}_NPA` : schemeCode;

                    // Insert into branch_position
                    await client.query(
                        `INSERT INTO executive_summary_branch_position (
                            year_id, assesment_id, type_id, amount,
                            business_risk, control_risk, risk_type,
                            audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                            compliance_emp_id, compliance_status_id,
                            compliance_reviewer_emp_id, batch_key, created_at
                        ) VALUES ($1, $2, $3, $4, 4, 4, 1, 1, $5, 0, 0, 0, 0, $6, NOW());`,
                        [data.year_id, assessment_id, dbTypeId, String(balance), employeeId, data.batch_key]
                    );

                    // Insert into fresh_accounts
                    await client.query(
                        `INSERT INTO executive_summary_fresh_accounts (
                            year_id, assesment_id, type_id, accounts,
                            business_risk, control_risk, risk_type,
                            audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                            compliance_emp_id, compliance_status_id,
                            compliance_reviewer_emp_id, batch_key, created_at
                        ) VALUES ($1, $2, $3, $4, 4, 4, 1, 1, $5, 0, 0, 0, 0, $6, NOW());`,
                        [data.year_id, assessment_id, dbTypeId, String(accounts), employeeId, data.batch_key]
                    );
                }
            });

            const reAssessment = await this.db.query(assessmentQuery, [assessment_id]);
            data = reAssessment.rows[0];
        }

        const [
            branchPositions,
            freshAccounts,
            marchPositions,
        ] =
            await Promise.all([
                this.db.query(
                    `
SELECT
    type_id,
    amount
FROM executive_summary_branch_position
WHERE assesment_id = $1
    AND year_id = $2
    AND deleted_at IS NULL;
                    `,
                    [
                        assessment_id,
                        data.year_id,
                    ],
                ),
                this.db.query(
                    `
SELECT
    type_id,
    accounts
FROM executive_summary_fresh_accounts
WHERE assesment_id = $1
    AND year_id = $2
    AND deleted_at IS NULL;
                    `,
                    [
                        assessment_id,
                        data.year_id,
                    ],
                ),
                this.db.query(
                    `
SELECT
    gl_type_id,
    march_position
FROM exe_summary
WHERE audit_unit_id = $1
    AND year_id = $2
    AND deleted_at IS NULL;
                    `,
                    [
                        data.audit_unit_id,
                        data.year_id,
                    ],
                ),
            ]);

        return {
            year_id:
                data.year_id,

            audit_unit_id:
                data.audit_unit_id,

            branch_name:
                data.branch_name,

            branch_code:
                data.branch_code,

            assessment_period_from:
                data.assesment_period_from,

            assessment_period_to:
                data.assesment_period_to,

            frequency:
                data.frequency,

            audit_status:
                data.audit_status,

            audit_review_status:
                data.review_name
                    || 'Not Available',

            compliance_status:
                data.compliance_review_date
                    ? 'Completed'
                    : 'Not Available',

            compliance_review_status:
                data.audit_review_date
                    ? 'Reviewed'
                    : 'Not Available',

            current_financial_year:
                this.getFinancialYear(),

            branch_positions:
                branchPositions.rows.map((row: any) => ({
                    type_id: row.type_id,
                    amount: row.amount,
                })),

            fresh_accounts:
                freshAccounts.rows.map((row: any) => ({
                    type_id: row.type_id,
                    accounts: row.accounts,
                })),

            march_positions:
                marchPositions.rows.map((row: any) => ({
                    gl_type_id: Number(row.gl_type_id),
                    march_position: Number(row.march_position || 0),
                })),

          summary_detail: [

    {
        label:
            '1. Branch Name',

        value:
            data.branch_name,
    },

    {
        label:
            '2. Inspection Period',

        value:
            `${data.frequency} Months`,
    },

    {
        label:
            '3. Name of Branch Manager',

        value:
            data.branch_manager_name,
    },

    {
        label:
            '4. Name of Assistant Branch Manager',

        value:
            data.branch_assistant_manager,
    },

    {
        label:
            '5. Inspection Conducted by',

        value:
            data.auditor_name,
    },

    {
        label:
            '6. Inspection Start Date',

        value:
            data.audit_start_date,
    },

    {
        label:
            '7. Inspection End Date',

        value:
            data.audit_end_date,
    },

    {
        label:
            '8. Number of Days taken for Inspection',

        value:
            data.audit_duration_days
                ? `${data.audit_duration_days} Days`
                : null,
    },

    {
        label:
            '9. Audit Report Submitted Date',

        value:
            data.report_submitted_date,
    },

    {
        label:
            '10. Compliance to be done before date',

        value:
            data.compliance_due_date,
    },

    {
        label:
            '11. Compliance done date',

        value:
            data.compliance_review_date,
    },

    {
        label:
            '12. Number of Staff including Contractual/Daily wages staff',

        value:
            data.staff_count,
    },

    {
        label:
            '13. Approximate Number of manual Challans per day',

        value:
            data.manual_challans_per_day,
    },

    {
        label:
            '14. CD Ratio',

        value:
            data.cd_ratio,
    },

    {
        label:
            '15. Per Employee Business (In Lakhs)',

        value:
            data.per_employee_business,
    },

    {
        label:
            '16. Annual Incremental Deposit Target (IN LAKHS)',

        value:
            data.deposit_target,
    },

    {
        label:
            '17. Annual Incremental Advances Target (IN LAKHS)',

        value:
            data.advances_target,
    },

    {
        label:
            '18. Annual Differential NPA Target (IN LAKHS)',

        value:
            data.npa_target,
    },

]

        };

    }


    getFinancialYear() {

        const currentDate =
            new Date();

        const currentYear =
            currentDate.getFullYear();

        const currentMonth =
            currentDate.getMonth() + 1;

        if (
            currentMonth >= 4
        ) {

            return `${currentYear} - ${currentYear + 1}`;

        }

        return `${currentYear - 1} - ${currentYear}`;

    }
    async saveExecutiveSummaryBasic(
        body: any,
        admin_id: number,
    ) {
        const assessmentId = Number(body?.assessment_id || 0);

        const assessment = await this.db.findOne(
            `
SELECT id, year_id, audit_unit_id, audit_status_id, batch_key
FROM audit_assesment_master
WHERE id = $1
    AND deleted_at IS NULL
LIMIT 1;
            `,
            [assessmentId],
        );

        if (!assessment) {
            throw new NotFoundException('Assessment not found');
        }

        if (!await this.hasAuditUnitAuthority(admin_id, Number(assessment.audit_unit_id))) {
            throw new BadRequestException('You are not authorized for this audit unit.');
        }

        if (Number(assessment.audit_status_id) !== 1) {
            throw new BadRequestException('Executive summary can be updated only during the initial audit.');
        }

        let reportDate = String(body?.audit_report_submitted_date || '').trim();
        if (reportDate.includes('T')) {
            reportDate = reportDate.split('T')[0];
        }
        const staffCount = Number(body?.staff_count);
        const challanCount = Number(body?.manual_challans_per_day);

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(reportDate) ||
            !Number.isInteger(staffCount) ||
            staffCount < 0 ||
            !Number.isInteger(challanCount) ||
            challanCount < 0
        ) {
            throw new BadRequestException('Enter report submitted date, staff count and manual challans per day.');
        }

        const employeeId = Number(admin_id || 0);

        await this.db.transaction(async (client) => {
            const existing = await client.query(
                `
SELECT id
FROM executive_summary_basic_details
WHERE assesment_id = $1
    AND year_id = $2
    AND deleted_at IS NULL
LIMIT 1;
                `,
                [assessmentId, assessment.year_id],
            );

            if (existing.rows.length) {
                await client.query(
                    `
UPDATE executive_summary_basic_details
SET
    report_submitted_date = $1,
    staff_count = $2,
    manual_challans_per_day = $3,
    admin_id = $4,
    updated_at = NOW()
WHERE id = $5;
                    `,
                    [
                        reportDate,
                        staffCount,
                        challanCount,
                        employeeId,
                        existing.rows[0].id,
                    ],
                );
            } else {
                await client.query(
                    `
INSERT INTO executive_summary_basic_details (
    year_id,
    assesment_id,
    report_submitted_date,
    staff_count,
    manual_challans_per_day,
    admin_id,
    created_at
)
VALUES ($1, $2, $3, $4, $5, $6, NOW());
                    `,
                    [
                        assessment.year_id,
                        assessmentId,
                        reportDate,
                        staffCount,
                        challanCount,
                        employeeId,
                    ],
                );
            }
        });

        return {
            success: true,
            message: 'Basic details saved successfully',
        };
    }

    async saveExecutiveSummaryFinancials(
        body: any,
        admin_id: number,
    ) {
        const assessmentId = Number(body?.assessment_id || 0);

        const assessment = await this.db.findOne(
            `
SELECT id, year_id, audit_unit_id, audit_status_id, batch_key
FROM audit_assesment_master
WHERE id = $1
    AND deleted_at IS NULL
LIMIT 1;
            `,
            [assessmentId],
        );

        if (!assessment) {
            throw new NotFoundException('Assessment not found');
        }

        if (!await this.hasAuditUnitAuthority(admin_id, Number(assessment.audit_unit_id))) {
            throw new BadRequestException('You are not authorized for this audit unit.');
        }

        if (Number(assessment.audit_status_id) !== 1) {
            throw new BadRequestException('Executive summary can be updated only during the initial audit.');
        }

        const branchPositions = Array.isArray(body?.branch_positions)
            ? this.validateExecutiveRows(
                body.branch_positions,
                [],
                'amount',
                false,
            )
            : [];

        const freshAccounts = Array.isArray(body?.fresh_accounts)
            ? this.validateExecutiveRows(
                body.fresh_accounts,
                [],
                'accounts',
                true,
            )
            : [];

        const employeeId = Number(admin_id || 0);

        await this.db.transaction(async (client) => {
            // 1. Fetch all existing branch positions and fresh accounts in parallel
            const [existingBpRes, existingFaRes] = await Promise.all([
                client.query(
                    `SELECT id, type_id, amount, business_risk, control_risk, risk_type, audit_comment, audit_emp_id, 
                            audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment, audit_commpliance, 
                            compliance_emp_id, compliance_status_id, compliance_reviewer_emp_id, 
                            compliance_reviewer_comment, batch_key, created_at, updated_at
                     FROM executive_summary_branch_position
                     WHERE assesment_id = $1 AND year_id = $2 AND deleted_at IS NULL`,
                    [assessmentId, assessment.year_id]
                ),
                client.query(
                    `SELECT id, type_id, accounts, business_risk, control_risk, risk_type, audit_comment, audit_emp_id, 
                            audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment, audit_commpliance, 
                            compliance_emp_id, compliance_status_id, compliance_reviewer_emp_id, 
                            compliance_reviewer_comment, batch_key, created_at, updated_at
                     FROM executive_summary_fresh_accounts
                     WHERE assesment_id = $1 AND year_id = $2 AND deleted_at IS NULL`,
                    [assessmentId, assessment.year_id]
                )
            ]);

            const bpMap = new Map(existingBpRes.rows.map((r: any) => [String(r.type_id).trim(), r]));
            const faMap = new Map(existingFaRes.rows.map((r: any) => [String(r.type_id).trim(), r]));

            // --- BRANCH POSITIONS ---
            const bpUpdates = { ids: [], amounts: [], empIds: [], batchKeys: [] };
            const bpTimelines = {
                esbp_ids: [], assessment_ids: [], last_updated_ats: [], answer_types: [], amounts: [],
                business_risks: [], control_risks: [], risk_types: [], audit_comments: [], audit_emp_ids: [],
                audit_status_ids: [], audit_reviewer_emp_ids: [], audit_reviewer_comments: [],
                audit_compliances: [], compliance_emp_ids: [], compliance_status_ids: [],
                compliance_reviewer_emp_ids: [], compliance_reviewer_comments: [], batch_keys: []
            };
            const bpInserts = {
                year_ids: [], assessment_ids: [], type_ids: [], amounts: [],
                business_risks: [], control_risks: [], risk_types: [],
                audit_status_ids: [], audit_emp_ids: [], audit_reviewer_emp_ids: [],
                compliance_emp_ids: [], compliance_status_ids: [], compliance_reviewer_emp_ids: [],
                batch_keys: []
            };

            for (const row of branchPositions) {
                const typeIdKey = String(row.type_id).trim();
                const old = bpMap.get(typeIdKey);

                if (old) {
                    if (Number(old.amount) !== Number(row.amount)) {
                        bpTimelines.esbp_ids.push(Number(old.id));
                        bpTimelines.assessment_ids.push(assessmentId);
                        bpTimelines.last_updated_ats.push(old.updated_at || old.created_at || new Date());
                        bpTimelines.answer_types.push(row.type_id);
                        bpTimelines.amounts.push(String(old.amount));
                        bpTimelines.business_risks.push(Number(old.business_risk || 4));
                        bpTimelines.control_risks.push(Number(old.control_risk || 4));
                        bpTimelines.risk_types.push(Number(old.risk_type || 1));
                        bpTimelines.audit_comments.push(old.audit_comment || '');
                        bpTimelines.audit_emp_ids.push(Number(old.audit_emp_id || 0));
                        bpTimelines.audit_status_ids.push(Number(old.audit_status_id || 1));
                        bpTimelines.audit_reviewer_emp_ids.push(Number(old.audit_reviewer_emp_id || 0));
                        bpTimelines.audit_reviewer_comments.push(old.audit_reviewer_comment || '');
                        bpTimelines.audit_compliances.push(old.audit_commpliance || '');
                        bpTimelines.compliance_emp_ids.push(Number(old.compliance_emp_id || 0));
                        bpTimelines.compliance_status_ids.push(Number(old.compliance_status_id || 0));
                        bpTimelines.compliance_reviewer_emp_ids.push(Number(old.compliance_reviewer_emp_id || 0));
                        bpTimelines.compliance_reviewer_comments.push(old.compliance_reviewer_comment || '');
                        bpTimelines.batch_keys.push(old.batch_key || '');

                        bpUpdates.ids.push(Number(old.id));
                        bpUpdates.amounts.push(String(row.amount));
                        bpUpdates.empIds.push(employeeId);
                        bpUpdates.batchKeys.push(assessment.batch_key);
                    }
                } else {
                    bpInserts.year_ids.push(Number(assessment.year_id));
                    bpInserts.assessment_ids.push(assessmentId);
                    bpInserts.type_ids.push(row.type_id);
                    bpInserts.amounts.push(String(row.amount));
                    bpInserts.business_risks.push(4);
                    bpInserts.control_risks.push(4);
                    bpInserts.risk_types.push(1);
                    bpInserts.audit_status_ids.push(1);
                    bpInserts.audit_emp_ids.push(employeeId);
                    bpInserts.audit_reviewer_emp_ids.push(0);
                    bpInserts.compliance_emp_ids.push(0);
                    bpInserts.compliance_status_ids.push(0);
                    bpInserts.compliance_reviewer_emp_ids.push(0);
                    bpInserts.batch_keys.push(assessment.batch_key);
                }
            }

            if (bpTimelines.esbp_ids.length > 0) {
                await client.query(
                    `INSERT INTO executive_summary_branch_position_timeline (
                        esbp_id, assesment_id, last_updated_at, answer_type, amount,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key,
                        created_at, updated_at
                    )
                    SELECT 
                        esbp_id, assesment_id, last_updated_at, answer_type, amount,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key,
                        NOW(), NOW()
                    FROM UNNEST(
                        $1::bigint[], $2::bigint[], $3::timestamp without time zone[], $4::varchar[], $5::varchar[],
                        $6::bigint[], $7::bigint[], $8::bigint[], $9::varchar[], $10::bigint[],
                        $11::bigint[], $12::bigint[], $13::varchar[], $14::varchar[], $15::bigint[],
                        $16::bigint[], $17::bigint[], $18::varchar[], $19::varchar[]
                    ) AS t(
                        esbp_id, assesment_id, last_updated_at, answer_type, amount,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key
                    )`,
                    [
                        bpTimelines.esbp_ids, bpTimelines.assessment_ids, bpTimelines.last_updated_ats, bpTimelines.answer_types, bpTimelines.amounts,
                        bpTimelines.business_risks, bpTimelines.control_risks, bpTimelines.risk_types, bpTimelines.audit_comments, bpTimelines.audit_emp_ids,
                        bpTimelines.audit_status_ids, bpTimelines.audit_reviewer_emp_ids, bpTimelines.audit_reviewer_comments,
                        bpTimelines.audit_compliances, bpTimelines.compliance_emp_ids, bpTimelines.compliance_status_ids,
                        bpTimelines.compliance_reviewer_emp_ids, bpTimelines.compliance_reviewer_comments, bpTimelines.batch_keys
                    ]
                );
            }

            if (bpUpdates.ids.length > 0) {
                await client.query(
                    `UPDATE executive_summary_branch_position AS bp
                    SET 
                        amount = val.amount,
                        audit_emp_id = val.audit_emp_id,
                        batch_key = val.batch_key,
                        updated_at = NOW()
                    FROM (
                        SELECT * FROM UNNEST($1::bigint[], $2::varchar[], $3::bigint[], $4::varchar[]) 
                        AS t(id, amount, audit_emp_id, batch_key)
                    ) AS val
                    WHERE bp.id = val.id`,
                    [
                        bpUpdates.ids,
                        bpUpdates.amounts,
                        bpUpdates.empIds,
                        bpUpdates.batchKeys
                    ]
                );
            }

            if (bpInserts.type_ids.length > 0) {
                await client.query(
                    `INSERT INTO executive_summary_branch_position (
                        year_id, assesment_id, type_id, amount,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key, created_at
                    )
                    SELECT 
                        year_id, assesment_id, type_id, amount,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key, NOW()
                    FROM UNNEST(
                        $1::bigint[], $2::bigint[], $3::varchar[], $4::varchar[],
                        $5::bigint[], $6::bigint[], $7::bigint[],
                        $8::bigint[], $9::bigint[], $10::bigint[],
                        $11::bigint[], $12::bigint[], $13::bigint[],
                        $14::varchar[]
                    ) AS t(
                        year_id, assesment_id, type_id, amount,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key
                    )`,
                    [
                        bpInserts.year_ids, bpInserts.assessment_ids, bpInserts.type_ids, bpInserts.amounts,
                        bpInserts.business_risks, bpInserts.control_risks, bpInserts.risk_types,
                        bpInserts.audit_status_ids, bpInserts.audit_emp_ids, bpInserts.audit_reviewer_emp_ids,
                        bpInserts.compliance_emp_ids, bpInserts.compliance_status_ids, bpInserts.compliance_reviewer_emp_ids,
                        bpInserts.batch_keys
                    ]
                );
            }

            // --- FRESH ACCOUNTS ---
            const faUpdates = { ids: [], accounts: [], empIds: [], batchKeys: [] };
            const faTimelines = {
                esfa_ids: [], assessment_ids: [], last_updated_ats: [], answer_types: [], accounts: [],
                business_risks: [], control_risks: [], risk_types: [], audit_comments: [], audit_emp_ids: [],
                audit_status_ids: [], audit_reviewer_emp_ids: [], audit_reviewer_comments: [],
                audit_compliances: [], compliance_emp_ids: [], compliance_status_ids: [],
                compliance_reviewer_emp_ids: [], compliance_reviewer_comments: [], batch_keys: []
            };
            const faInserts = {
                year_ids: [], assessment_ids: [], type_ids: [], accounts: [],
                business_risks: [], control_risks: [], risk_types: [],
                audit_status_ids: [], audit_emp_ids: [], audit_reviewer_emp_ids: [],
                compliance_emp_ids: [], compliance_status_ids: [], compliance_reviewer_emp_ids: [],
                batch_keys: []
            };

            for (const row of freshAccounts) {
                const typeIdKey = String(row.type_id).trim();
                const old = faMap.get(typeIdKey);

                if (old) {
                    if (Number(old.accounts) !== Number(row.accounts)) {
                        faTimelines.esfa_ids.push(Number(old.id));
                        faTimelines.assessment_ids.push(assessmentId);
                        faTimelines.last_updated_ats.push(old.updated_at || old.created_at || new Date());
                        faTimelines.answer_types.push(row.type_id);
                        faTimelines.accounts.push(String(old.accounts));
                        faTimelines.business_risks.push(Number(old.business_risk || 4));
                        faTimelines.control_risks.push(Number(old.control_risk || 4));
                        faTimelines.risk_types.push(Number(old.risk_type || 1));
                        faTimelines.audit_comments.push(old.audit_comment || '');
                        faTimelines.audit_emp_ids.push(Number(old.audit_emp_id || 0));
                        faTimelines.audit_status_ids.push(Number(old.audit_status_id || 1));
                        faTimelines.audit_reviewer_emp_ids.push(Number(old.audit_reviewer_emp_id || 0));
                        faTimelines.audit_reviewer_comments.push(old.audit_reviewer_comment || '');
                        faTimelines.audit_compliances.push(old.audit_commpliance || '');
                        faTimelines.compliance_emp_ids.push(Number(old.compliance_emp_id || 0));
                        faTimelines.compliance_status_ids.push(Number(old.compliance_status_id || 0));
                        faTimelines.compliance_reviewer_emp_ids.push(Number(old.compliance_reviewer_emp_id || 0));
                        faTimelines.compliance_reviewer_comments.push(old.compliance_reviewer_comment || '');
                        faTimelines.batch_keys.push(old.batch_key || '');

                        faUpdates.ids.push(Number(old.id));
                        faUpdates.accounts.push(String(row.accounts));
                        faUpdates.empIds.push(employeeId);
                        faUpdates.batchKeys.push(assessment.batch_key);
                    }
                } else {
                    faInserts.year_ids.push(Number(assessment.year_id));
                    faInserts.assessment_ids.push(assessmentId);
                    faInserts.type_ids.push(row.type_id);
                    faInserts.accounts.push(String(row.accounts));
                    faInserts.business_risks.push(4);
                    faInserts.control_risks.push(4);
                    faInserts.risk_types.push(1);
                    faInserts.audit_status_ids.push(1);
                    faInserts.audit_emp_ids.push(employeeId);
                    faInserts.audit_reviewer_emp_ids.push(0);
                    faInserts.compliance_emp_ids.push(0);
                    faInserts.compliance_status_ids.push(0);
                    faInserts.compliance_reviewer_emp_ids.push(0);
                    faInserts.batch_keys.push(assessment.batch_key);
                }
            }

            if (faTimelines.esfa_ids.length > 0) {
                await client.query(
                    `INSERT INTO executive_summary_fresh_accounts_timeline (
                        esfa_id, assesment_id, last_updated_at, answer_type, accounts,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key,
                        created_at, updated_at
                    )
                    SELECT 
                        esfa_id, assesment_id, last_updated_at, answer_type, accounts,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key,
                        NOW(), NOW()
                    FROM UNNEST(
                        $1::bigint[], $2::bigint[], $3::timestamp without time zone[], $4::varchar[], $5::varchar[],
                        $6::bigint[], $7::bigint[], $8::bigint[], $9::varchar[], $10::bigint[],
                        $11::bigint[], $12::bigint[], $13::varchar[], $14::varchar[], $15::bigint[],
                        $16::bigint[], $17::bigint[], $18::varchar[], $19::varchar[]
                    ) AS t(
                        esfa_id, assesment_id, last_updated_at, answer_type, accounts,
                        business_risk, control_risk, risk_type, audit_comment, audit_emp_id,
                        audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment,
                        audit_commpliance, compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, compliance_reviewer_comment, batch_key
                    )`,
                    [
                        faTimelines.esfa_ids, faTimelines.assessment_ids, faTimelines.last_updated_ats, faTimelines.answer_types, faTimelines.accounts,
                        faTimelines.business_risks, faTimelines.control_risks, faTimelines.risk_types, faTimelines.audit_comments, faTimelines.audit_emp_ids,
                        faTimelines.audit_status_ids, faTimelines.audit_reviewer_emp_ids, faTimelines.audit_reviewer_comments,
                        faTimelines.audit_compliances, faTimelines.compliance_emp_ids, faTimelines.compliance_status_ids,
                        faTimelines.compliance_reviewer_emp_ids, faTimelines.compliance_reviewer_comments, faTimelines.batch_keys
                    ]
                );
            }

            if (faUpdates.ids.length > 0) {
                await client.query(
                    `UPDATE executive_summary_fresh_accounts AS fa
                    SET 
                        accounts = val.accounts,
                        audit_emp_id = val.audit_emp_id,
                        batch_key = val.batch_key,
                        updated_at = NOW()
                    FROM (
                        SELECT * FROM UNNEST($1::bigint[], $2::varchar[], $3::bigint[], $4::varchar[]) 
                        AS t(id, accounts, audit_emp_id, batch_key)
                    ) AS val
                    WHERE fa.id = val.id`,
                    [
                        faUpdates.ids,
                        faUpdates.accounts,
                        faUpdates.empIds,
                        faUpdates.batchKeys
                    ]
                );
            }

            if (faInserts.type_ids.length > 0) {
                await client.query(
                    `INSERT INTO executive_summary_fresh_accounts (
                        year_id, assesment_id, type_id, accounts,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key, created_at
                    )
                    SELECT 
                        year_id, assesment_id, type_id, accounts,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key, NOW()
                    FROM UNNEST(
                        $1::bigint[], $2::bigint[], $3::varchar[], $4::varchar[],
                        $5::bigint[], $6::bigint[], $7::bigint[],
                        $8::bigint[], $9::bigint[], $10::bigint[],
                        $11::bigint[], $12::bigint[], $13::bigint[],
                        $14::varchar[]
                    ) AS t(
                        year_id, assesment_id, type_id, accounts,
                        business_risk, control_risk, risk_type,
                        audit_status_id, audit_emp_id, audit_reviewer_emp_id,
                        compliance_emp_id, compliance_status_id,
                        compliance_reviewer_emp_id, batch_key
                    )`,
                    [
                        faInserts.year_ids, faInserts.assessment_ids, faInserts.type_ids, faInserts.accounts,
                        faInserts.business_risks, faInserts.control_risks, faInserts.risk_types,
                        faInserts.audit_status_ids, faInserts.audit_emp_ids, faInserts.audit_reviewer_emp_ids,
                        faInserts.compliance_emp_ids, faInserts.compliance_status_ids, faInserts.compliance_reviewer_emp_ids,
                        faInserts.batch_keys
                    ]
                );
            }
        });

        return {
            success: true,
            message: 'Executive Summary Financials Saved Successfully',
        };
    }

    private validateExecutiveRows(
        values: any,
        lines: Array<{
            type_id: number;
        }>,
        valueKey: string,
        integerOnly: boolean,
    ) {
        const rows = Array.isArray(values) ? values : [];
        return rows.map(
            (row: any) => {
                const typeId = String(row?.type_id || '').trim();
                let rawValue = row?.[valueKey];
                if (rawValue === '' || rawValue === null || rawValue === undefined) {
                    rawValue = 0;
                }
                const numberValue = Number(rawValue);

                if (
                    typeId === '' ||
                    !Number.isFinite(numberValue) ||
                    numberValue < 0 ||
                    (
                        integerOnly &&
                        !Number.isInteger(numberValue)
                    )
                ) {
                    console.error('validateExecutiveRows FAILED:', {
                        typeId,
                        valueKey,
                        rawValue: row?.[valueKey],
                        numberValue,
                        integerOnly,
                        row
                    });
                    throw new BadRequestException(
                        'Complete all executive summary rows with valid values.',
                    );
                }

                return {
                    type_id: typeId,
                    [valueKey]: numberValue,
                };
            },
        );
    }

    async getBranchFinancialPosition(
        branch_id: number,
    ) {
        const result = await this.db.query(
            `
SELECT
    scheme_type,
    scheme_code,
    scheme_name,
    category_id,
    MAX(march_position) AS march_position,
    SUM(total_accounts) AS total_accounts,
    SUM(total_amount) AS total_amount
FROM (
    SELECT
        'DEPOSITS' AS scheme_type,
        sm.scheme_code,
        sm.name AS scheme_name,
        CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END AS category_id,
        es.march_position,
        COUNT(dd.account_no) AS total_accounts,
        SUM(COALESCE(dd.balance::numeric, 0)) AS total_amount
    FROM dump_deposits dd
    INNER JOIN audit_assesment_master aam
        ON aam.audit_unit_id = dd.branch_id
    LEFT JOIN scheme_master sm
        ON sm.id = dd.scheme_id
    LEFT JOIN exe_summary es
        ON es.audit_unit_id = dd.branch_id
        AND es.year_id = (aam.year_id - 1)
        AND es.gl_type_id = CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END
    WHERE
        dd.branch_id = $1
        AND dd.account_opening_date BETWEEN aam.assesment_period_from AND aam.assesment_period_to
        AND dd.deleted_at IS NULL
    GROUP BY
        sm.scheme_code,
        sm.name,
        sm.category_id,
        es.march_position
    UNION ALL
    SELECT
        'ADVANCES' AS scheme_type,
        sm.scheme_code,
        sm.name AS scheme_name,
        CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END AS category_id,
        es.march_position,
        COUNT(da.account_no) AS total_accounts,
        SUM(COALESCE(da.outstanding_balance::numeric, 0)) AS total_amount
    FROM dump_advances da
    INNER JOIN audit_assesment_master aam
        ON aam.audit_unit_id = da.branch_id
    LEFT JOIN scheme_master sm
        ON sm.id = da.scheme_id
    LEFT JOIN exe_summary es
        ON es.audit_unit_id = da.branch_id
        AND es.year_id = (aam.year_id - 1)
        AND es.gl_type_id = CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END
    WHERE
        da.branch_id = $2
        AND da.account_opening_date BETWEEN aam.assesment_period_from AND aam.assesment_period_to
        AND da.deleted_at IS NULL
    GROUP BY
        sm.scheme_code,
        sm.name,
        sm.category_id,
        es.march_position
) x
GROUP BY
    scheme_type,
    scheme_code,
    scheme_name,
    category_id
ORDER BY
    scheme_type,
    scheme_code;
            `,
            [
                branch_id,
                branch_id,
            ],
        );

        return result.rows;
    }

}
