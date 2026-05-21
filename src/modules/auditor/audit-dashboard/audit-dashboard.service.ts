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

        SELECT DISTINCT

            au.id,
            au.audit_unit_code,
            au.name,
            au.frequency,
            au.last_audit_date

        FROM audit_unit_master au

        INNER JOIN audit_assesment_master am

            ON am.audit_unit_id = au.id

            AND am.deleted_at IS NULL

            AND am.year_id = (

                SELECT ym.id

                FROM year_master ym

                ORDER BY ym.id DESC

                LIMIT 1

            )

        WHERE
            au.is_active = 1
            AND au.deleted_at IS NULL

            AND au.id::text = ANY(

                string_to_array(

                    (
                        SELECT em.audit_unit_authority

                        FROM employee_master em

                        WHERE em.id = $1
                    ),

                    ','

                )

            )

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

            SELECT DISTINCT ON (aam.audit_unit_id)

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

            MAX(la.id)
                AS latest_assessment_id,

            MAX(la.audit_status_id)
                AS latest_status_id,

            CASE

                WHEN MAX(la.audit_status_id)
                    IN (1, 3)

                THEN 'AUDIT PENDING'

                WHEN MAX(la.audit_status_id)
                    IN (2, 5)

                THEN 'REVIEW PENDING'

                WHEN MAX(la.audit_status_id)
                    IN (4, 6)

                THEN 'COMPLIANCE PENDING'

                WHEN MAX(la.audit_status_id) = 7

                THEN 'ASSESMENT COMPLETED'

                ELSE 'NOT STARTED'

            END AS latest_status

        FROM audit_assesment_master am

        LEFT JOIN latest_assessment la
            ON la.audit_unit_id = am.audit_unit_id

        WHERE
            am.deleted_at IS NULL
            AND am.audit_unit_id = ANY($1)

        GROUP BY
            am.audit_unit_id

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

        const currentDate =
            new Date();

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

                    Number(
                        branchDetails
                            .frequency,
                    ),
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

            const selectQuery = `

            SELECT
                audit_unit_id

            FROM audit_assesment_master

            WHERE audit_unit_id = $1

            AND assesment_period_to = $2

            LIMIT 1;

            `;

            const assessmentResult =
                await this.db.query(

                    selectQuery,

                    [

                        branchDetails.id,

                        this.formatDate(
                            nextAssessmentEndDate,
                        ),
                    ],
                );

            if (
                assessmentResult
                    .rows.length
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

                        Number(
                            branchDetails
                                .frequency,
                        ),
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
                            Number(
                                branchDetails
                                    .frequency,
                            )
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

                        Number(
                            branchDetails
                                .frequency,
                        ),
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
}
