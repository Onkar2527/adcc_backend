import { Injectable, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../../../core/database/database.service";

@Injectable()
export class PeriodwiseQuestionsMasterService {
    constructor(private readonly db: DatabaseService) { }

    async findAll() {
        return this.db.query(`
          SELECT
    mlcm.id,
    mlcm.year_id,
    mlcm.section_type_id,
    mlcm.user_type_id,
    mlcm.audit_unit_id,
    mlcm.start_month_year,
    mlcm.end_month_year,
    mlcm.menu_ids,
    mlcm.cat_ids,
    mlcm.header_ids,
    mlcm.question_ids,
    mlcm.advances_scheme_ids,
    mlcm.deposits_scheme_ids,
    mlcm.is_multiple_auditors,
    mlcm.admin_id,
    mlcm.created_at,
    mlcm.updated_at,
    COALESCE(
        (
            SELECT array_agg(mapping.audit_type_id ORDER BY mapping.audit_type_id)
            FROM audit_type_question_setup_mapping mapping
            WHERE mapping.control_master_id = mlcm.id
              AND mapping.is_active = 1
              AND mapping.deleted_at IS NULL
        ),
        ARRAY[
            (
                SELECT id
                FROM audit_type_master
                WHERE code = 'INTERNAL_AUDIT'
                  AND deleted_at IS NULL
                LIMIT 1
            )
        ]::bigint[]
    ) AS audit_type_ids,
    COALESCE(
        (
            SELECT string_agg(audit_type.name, ', ' ORDER BY audit_type.name)
            FROM audit_type_question_setup_mapping mapping
            JOIN audit_type_master audit_type
              ON audit_type.id = mapping.audit_type_id
             AND audit_type.deleted_at IS NULL
            WHERE mapping.control_master_id = mlcm.id
              AND mapping.is_active = 1
              AND mapping.deleted_at IS NULL
        ),
        'Internal Audit'
    ) AS audit_type_names,
    ym.year,
    stm.name AS section_type_name,
    aum.name AS audit_unit_name,
    aum.audit_unit_code

FROM multi_level_control_master mlcm

LEFT JOIN year_master ym
    ON ym.id = mlcm.year_id

LEFT JOIN audit_section_master stm
    ON stm.id = mlcm.section_type_id

LEFT JOIN audit_unit_master aum
    ON aum.id = mlcm.audit_unit_id

WHERE mlcm.deleted_at IS NULL

ORDER BY mlcm.id DESC;
      `);
    }

    async findQuestionData(id: number) {
        return this.db.query(`
          SELECT

    mm.id AS menu_id,
    mm.name AS menu_name,

    cm.id AS category_id,
    cm.name AS category_name,

    qsm.id AS question_set_id,
    qsm.name AS question_set_name,

    qhm.id AS header_id,
    qhm.name AS header_name,

    q.questions

FROM multi_level_control_master mlcm



LEFT JOIN menu_master mm
    ON mm.id::text = ANY(
        string_to_array(
            mlcm.menu_ids,
            ','
        )
    )



LEFT JOIN category_master cm
    ON cm.id::text = ANY(
        string_to_array(
            mlcm.cat_ids,
            ','
        )
    )
   AND cm.menu_id = mm.id



LEFT JOIN question_set_master qsm
    ON qsm.id::text = ANY(
        string_to_array(
            cm.question_set_ids,
            ','
        )
    )



LEFT JOIN question_header_master qhm
    ON qhm.question_set_id = qsm.id



LEFT JOIN (

    SELECT

        qm.header_id,
        qm.set_id,

        json_agg(

            json_build_object(

                'question_id', qm.id,
                'question', qm.question

            )

            ORDER BY qm.id

        ) AS questions

    FROM question_master qm

    GROUP BY

        qm.header_id,
        qm.set_id

) q

    ON q.header_id = qhm.id
   AND q.set_id = qsm.id

WHERE mlcm.id = $1
AND mlcm.deleted_at IS NULL

ORDER BY

    mm.id,
    cm.id,
    qsm.id,
    qhm.id;
      `, [id]);

    }

    async create(data: { audit_type_ids: number[], year_id: number, section_type_id: number, user_type_id: number, audit_unit_id: number, start_month_year: string, end_month_year: string, admin_id: number }) {
        const existing = await this.db.query(
            `SELECT id 
             FROM multi_level_control_master 
             WHERE audit_unit_id = $1 AND start_month_year = $2 AND end_month_year = $3
             AND deleted_at IS NULL
             `,
            [data.audit_unit_id, data.start_month_year, data.end_month_year]
        );

        if (existing.rows.length) {
            throw new BadRequestException('Menu master already exists');
        }

        try {
            return await this.db.transaction(async (client) => {
                const created = await client.query(
                    ` INSERT INTO multi_level_control_master (year_id, section_type_id, user_type_id, audit_unit_id, start_month_year, end_month_year, admin_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                  RETURNING *
                  `,
                    [data.year_id, data.section_type_id, data.user_type_id, data.audit_unit_id, data.start_month_year, data.end_month_year, data.admin_id]
                );

                await this.replaceAuditTypeMappings(
                    client,
                    Number(created.rows[0].id),
                    data.audit_type_ids,
                );

                return created;
            });
        } catch (err: any) {
            if (err.code === '23505') {
                throw new BadRequestException('Menu master already exists')
            }
            throw err;
        }
    }

    async update(id: number, data: { audit_type_ids: number[], year_id: number, section_type_id: number, user_type_id: number, audit_unit_id: number, start_month_year: string, end_month_year: string }) {
        const existing = await this.db.query(
            `SELECT id FROM multi_level_control_master 
       WHERE audit_unit_id = $1 AND start_month_year = $2 AND end_month_year = $3
       AND id != $4 AND deleted_at IS NULL`,
            [data.audit_unit_id, data.start_month_year, data.end_month_year, id]
        );

        if (existing.rows.length) {
            throw new BadRequestException('Menu master already exists');
        }

        return this.db.transaction(async (client) => {
            const updated = await client.query(
                `
                 UPDATE multi_level_control_master
                 SET year_id = $1, section_type_id = $2, user_type_id = $3, audit_unit_id = $4, start_month_year = $5, end_month_year = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7
                 RETURNING *
                 `,
                [data.year_id, data.section_type_id, data.user_type_id, data.audit_unit_id, data.start_month_year, data.end_month_year, id]
            );

            await this.replaceAuditTypeMappings(
                client,
                id,
                data.audit_type_ids,
            );

            return updated;
        });
    }

    private async replaceAuditTypeMappings(
        client: any,
        controlMasterId: number,
        auditTypeIds: number[],
    ) {
        const ids = [
            ...new Set(
                (auditTypeIds || [])
                    .map(Number)
                    .filter((value) => Number.isInteger(value) && value > 0),
            ),
        ];

        if (!ids.length) {
            throw new BadRequestException('Select at least one audit type');
        }

        const valid = await client.query(
            `
            SELECT id
            FROM audit_type_master
            WHERE id = ANY($1::bigint[])
              AND is_active = 1
              AND deleted_at IS NULL
            `,
            [ids],
        );

        if (valid.rows.length !== ids.length) {
            throw new BadRequestException('One or more selected audit types are invalid');
        }

        await client.query(
            `
            UPDATE audit_type_question_setup_mapping
            SET is_active = 0,
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE control_master_id = $1
              AND deleted_at IS NULL
            `,
            [controlMasterId],
        );

        for (const auditTypeId of ids) {
            await client.query(
                `
                INSERT INTO audit_type_question_setup_mapping (
                    audit_type_id,
                    control_master_id,
                    is_active
                )
                VALUES ($1, $2, 1)
                `,
                [auditTypeId, controlMasterId],
            );
        }
    }


    async updateAdvaneSchemes(id: number, data: { advances_scheme_ids: string, }) {

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET advances_scheme_ids = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *
             `,
            [data.advances_scheme_ids, id]
        );
    }

    async updateDepositSchemes(id: number, data: { deposits_scheme_ids: string, }) {

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET deposits_scheme_ids = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *
             `,
            [data.deposits_scheme_ids, id]
        );
    }

    async updateMenu(id: number, data: { menu_ids: string, }) {

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET menu_ids = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *
             `,
            [data.menu_ids, id]
        );
    }
    async updateMultipleAuditors(id: number, data: { is_multiple_auditors: boolean }) {
        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET is_multiple_auditors = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *
             `,
            [data.is_multiple_auditors, id]
        );
    }
    async updateCategory(id: number, data: { cat_ids: string, }) {

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET cat_ids = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *
             `,
            [data.cat_ids, id]
        );
    }
    async updateQuestionAndHeaders(id: number, data: { header_ids: string, question_ids: string }) {

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET header_ids = $1, question_ids = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *
             `,
            [data.header_ids, data.question_ids, id]
        );
    }

    async getEligibleAuditors(id: number) {
        const record = await this.db.findOne(
            `SELECT audit_unit_id FROM multi_level_control_master WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );
        if (!record) {
            throw new BadRequestException('Periodwise Questions Master not found');
        }

        const auditUnitId = String(record.audit_unit_id);
        return this.db.query(
            `
            SELECT id, name, emp_code, user_type_id
            FROM employee_master
            WHERE $1 = ANY(string_to_array(audit_unit_authority, ','))
              AND user_type_id = 2
              AND is_active = 1
              AND deleted_at IS NULL
            ORDER BY name;
            `,
            [auditUnitId]
        ).then(res => res.rows);
    }

    async getCategoryAssignments(id: number) {
        return this.db.query(
            `
            SELECT pca.id, pca.category_id, pca.audit_emp_id, em.name AS auditor_name, em.emp_code AS auditor_emp_code
            FROM periodwise_category_assignments pca
            INNER JOIN employee_master em ON em.id = pca.audit_emp_id
            WHERE pca.periodwise_master_id = $1
              AND pca.deleted_at IS NULL;
            `,
            [id]
        ).then(res => res.rows);
    }

    async assignCategories(
        id: number,
        assignments: { category_id: number; audit_emp_id: number }[]
    ) {
        if (!Array.isArray(assignments)) {
            throw new BadRequestException('assignments must be an array');
        }

        return this.db.transaction(async (client) => {
            await client.query(
                `DELETE FROM periodwise_category_assignments WHERE periodwise_master_id = $1`,
                [id]
            );

            for (const assignment of assignments) {
                if (!assignment.category_id || !assignment.audit_emp_id) {
                    continue;
                }
                await client.query(
                    `
                    INSERT INTO periodwise_category_assignments (
                        periodwise_master_id,
                        category_id,
                        audit_emp_id
                    )
                    VALUES ($1, $2, $3)
                    ON CONFLICT (periodwise_master_id, category_id, audit_emp_id) 
                    DO NOTHING;
                    `,
                    [id, assignment.category_id, assignment.audit_emp_id]
                );
            }

            return { success: true };
        });
    }

    async syncAllBranches(id: number) {
        const source = await this.db.findOne(
            `SELECT * FROM multi_level_control_master WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (!source) {
            throw new BadRequestException('Periodwise Questions Master not found');
        }

        if (Number(source.section_type_id) !== 1) {
            throw new BadRequestException('Sync is only allowed for branch setups (section type id = 1)');
        }

        // Fetch the mapped audit types for this source record
        const auditTypesRes = await this.db.query(
            `SELECT audit_type_id FROM audit_type_question_setup_mapping WHERE control_master_id = $1 AND is_active = 1 AND deleted_at IS NULL`,
            [id]
        );
        const auditTypeIds = auditTypesRes.rows.map((row: any) => Number(row.audit_type_id));

        // Find other active branch records with the same year_id, start_month_year, and end_month_year
        const targetsRes = await this.db.query(
            `SELECT id FROM multi_level_control_master 
             WHERE section_type_id = 1 
               AND year_id = $1 
               AND start_month_year = $2 
               AND end_month_year = $3 
               AND id != $4 
               AND deleted_at IS NULL`,
            [source.year_id, source.start_month_year, source.end_month_year, id]
        );

        const targetIds = targetsRes.rows.map((row: any) => Number(row.id));

        if (targetIds.length === 0) {
            return { message: 'No other branch setups found for this period to update.', updatedCount: 0 };
        }

        await this.db.transaction(async (client) => {
            // Update multi_level_control_master for all target records
            await client.query(
                `UPDATE multi_level_control_master
                 SET menu_ids = $1,
                     cat_ids = $2,
                     header_ids = $3,
                     question_ids = $4,
                     advances_scheme_ids = $5,
                     deposits_scheme_ids = $6,
                     is_multiple_auditors = $7,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ANY($8::bigint[])`,
                [
                    source.menu_ids,
                    source.cat_ids,
                    source.header_ids,
                    source.question_ids,
                    source.advances_scheme_ids,
                    source.deposits_scheme_ids,
                    source.is_multiple_auditors,
                    targetIds
                ]
            );

            // Update audit_type_question_setup_mapping for all target records
            await client.query(
                `UPDATE audit_type_question_setup_mapping
                 SET is_active = 0,
                     deleted_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE control_master_id = ANY($1::bigint[])
                   AND deleted_at IS NULL`,
                [targetIds]
            );

            if (auditTypeIds.length > 0) {
                for (const targetId of targetIds) {
                    for (const auditTypeId of auditTypeIds) {
                        await client.query(
                            `INSERT INTO audit_type_question_setup_mapping (
                                 audit_type_id,
                                 control_master_id,
                                 is_active
                             )
                             VALUES ($1, $2, 1)`,
                            [auditTypeId, targetId]
                        );
                    }
                }
            }
        });

        return {
            success: true,
            message: `Configurations synced successfully to all ${targetIds.length} other branches.`,
            updatedCount: targetIds.length
        };
    }

    async syncAllBranchesCurrentAssessment(id: number) {
        const source = await this.db.findOne(
            `SELECT * FROM multi_level_control_master WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (!source) {
            throw new BadRequestException('Periodwise Questions Master not found');
        }

        if (Number(source.section_type_id) !== 1) {
            throw new BadRequestException('Sync is only allowed for branch setups (section type id = 1)');
        }

        const result = await this.db.query(
            `UPDATE audit_assesment_master asm
             SET menu_ids = mlcm.menu_ids,
                 cat_ids = mlcm.cat_ids,
                 header_ids = mlcm.header_ids,
                 question_ids = mlcm.question_ids,
                 advances_scheme_ids = mlcm.advances_scheme_ids,
                 deposits_scheme_ids = mlcm.deposits_scheme_ids,
                 is_multiple_auditors = mlcm.is_multiple_auditors,
                 updated_at = CURRENT_TIMESTAMP
             FROM multi_level_control_master mlcm, audit_unit_master aum
             WHERE asm.audit_unit_id = mlcm.audit_unit_id
               AND aum.id = mlcm.audit_unit_id
               AND aum.section_type_id = 1
               AND mlcm.year_id = $1
               AND mlcm.start_month_year = $2
               AND mlcm.end_month_year = $3
               AND asm.audit_status_id = 1
               AND asm.deleted_at IS NULL
               AND mlcm.deleted_at IS NULL
             RETURNING asm.id`,
            [source.year_id, source.start_month_year, source.end_month_year]
        );

        const updatedIds = result.rows.map((row: any) => Number(row.id));

        return {
            success: true,
            message: `Current assessment configuration synced successfully to all ${updatedIds.length} branch assessments for this period.`,
            updatedCount: updatedIds.length
        };
    }

    async softDelete(id: number) {
        return this.db.query(
            `
            UPDATE multi_level_control_master
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [id]
        );
    }
}

