import { Injectable, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "src/core/database/database.service";

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
    mlcm.admin_id,
    mlcm.created_at,
    mlcm.updated_at,
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

    async create(data: { year_id: number, section_type_id: number, user_type_id: number, audit_unit_id: number,start_month_year: string, end_month_year: string, admin_id: number }) {
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
            return await this.db.query(
                ` INSERT INTO multi_level_control_master (year_id, section_type_id, user_type_id, audit_unit_id, start_month_year, end_month_year, admin_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING *
              `,
                [data.year_id, data.section_type_id, data.user_type_id, data.audit_unit_id, data.start_month_year, data.end_month_year, data.admin_id]
            );
        } catch (err: any) {
            if (err.code === '23505') {
                throw new BadRequestException('Menu master already exists')
            }
            throw err;
        }
    }

    async update(id: number, data: { year_id: number, section_type_id: number, user_type_id: number, audit_unit_id: number, start_month_year: string, end_month_year: string }) {
        const existing = await this.db.query(
            `SELECT id FROM multi_level_control_master 
       WHERE audit_unit_id = $1 AND start_month_year = $2 AND end_month_year = $3
       AND id != $4 AND deleted_at IS NULL`,
            [data.audit_unit_id, data.start_month_year, data.end_month_year, id]
        );

        if (existing.rows.length) {
            throw new BadRequestException('Menu master already exists');
        }

        return this.db.query(
            `
             UPDATE multi_level_control_master
             SET year_id = $1, section_type_id = $2, user_type_id = $3, audit_unit_id = $4, start_month_year = $5, end_month_year = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *
             `,
            [data.year_id, data.section_type_id, data.user_type_id, data.audit_unit_id, data.start_month_year, data.end_month_year, id]
        );
    }

    
    async updateAdvaneSchemes(id: number, data: { advances_scheme_ids: string,  }) {

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

