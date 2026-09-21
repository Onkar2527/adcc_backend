import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class NonAgriStatementDto {
  @IsOptional()
  id?: number;

  @IsOptional()
  assessment_id?: number;

  @IsOptional()
  year_id?: number;

  @IsOptional()
  audit_unit_id?: number;

  @IsOptional()
  @IsString()
  statement_date?: string;

  @IsOptional()
  @IsString()
  statement_type?: string;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  head_office?: string;

  @IsOptional()
  @IsString()
  unit_text?: string;

  @IsOptional()
  inspection_patra?: number;

  @IsOptional()
  inspection_purna?: number;

  @IsOptional()
  inspection_apoorna?: number;

  @IsOptional()
  @IsString()
  designation1?: string;

  @IsOptional()
  @IsString()
  designation2?: string;

  @IsOptional()
  shares_data?: any;

  @IsOptional()
  statement_data?: any;

  @IsOptional()
  total_yeanebaki_members?: number;

  @IsOptional()
  total_yeanebaki_amount?: number;

  @IsOptional()
  total_thakbaki_members?: number;

  @IsOptional()
  total_thakbaki_amount?: number;

  @IsOptional()
  created_by?: number;

  @IsOptional()
  updated_by?: number;
}

@Injectable()
export class NonAgriStatementService {
  private readonly logger = new Logger(NonAgriStatementService.name);

  constructor(private readonly db: DatabaseService) {}

  async getStatement(assessmentId?: number, auditUnitId?: number, yearId?: number) {
    try {
      let query = 'SELECT * FROM public.audit_non_agri_statement WHERE 1=1';
      const params: any[] = [];

      if (assessmentId) {
        params.push(assessmentId);
        query += ` AND assessment_id = $${params.length}`;
      } else if (auditUnitId && yearId) {
        params.push(auditUnitId);
        query += ` AND audit_unit_id = $${params.length}`;
        params.push(yearId);
        query += ` AND year_id = $${params.length}`;
      } else if (auditUnitId) {
        params.push(auditUnitId);
        query += ` AND audit_unit_id = $${params.length}`;
      }

      query += ' ORDER BY updated_at DESC, id DESC LIMIT 1';

      const result = await this.db.query(query, params);
      return {
        success: true,
        data: result.rows?.[0] || null,
      };
    } catch (error) {
      this.logger.error('Error fetching non-agri statement', error);
      throw error;
    }
  }

  async saveStatement(payload: NonAgriStatementDto, userId?: number) {
    try {
      let existingId = payload.id;

      if (!existingId && payload.assessment_id) {
        const check = await this.db.query(
          'SELECT id FROM public.audit_non_agri_statement WHERE assessment_id = $1 ORDER BY id DESC LIMIT 1',
          [payload.assessment_id],
        );
        if (check.rows?.[0]?.id) {
          existingId = check.rows[0].id;
        }
      }

      if (existingId) {
        const updateQuery = `
          UPDATE public.audit_non_agri_statement
          SET
            assessment_id = COALESCE($1, assessment_id),
            year_id = COALESCE($2, year_id),
            audit_unit_id = COALESCE($3, audit_unit_id),
            statement_date = $4,
            statement_type = $5,
            bank_name = $6,
            head_office = $7,
            unit_text = $8,
            inspection_patra = $9,
            inspection_purna = $10,
            inspection_apoorna = $11,
            designation1 = $12,
            designation2 = $13,
            shares_data = $14,
            statement_data = $15,
            total_yeanebaki_members = $16,
            total_yeanebaki_amount = $17,
            total_thakbaki_members = $18,
            total_thakbaki_amount = $19,
            updated_by = $20,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $21
          RETURNING *;
        `;

        const params = [
          payload.assessment_id || null,
          payload.year_id || null,
          payload.audit_unit_id || null,
          payload.statement_date || null,
          payload.statement_type || null,
          payload.bank_name || null,
          payload.head_office || null,
          payload.unit_text || null,
          payload.inspection_patra ?? null,
          payload.inspection_purna ?? null,
          payload.inspection_apoorna ?? null,
          payload.designation1 || null,
          payload.designation2 || null,
          JSON.stringify(payload.shares_data || {}),
          JSON.stringify(payload.statement_data || {}),
          payload.total_yeanebaki_members ?? null,
          payload.total_yeanebaki_amount ?? null,
          payload.total_thakbaki_members ?? null,
          payload.total_thakbaki_amount ?? null,
          userId || payload.updated_by || null,
          existingId,
        ];

        const result = await this.db.query(updateQuery, params);
        return {
          success: true,
          message: 'Statement updated successfully',
          data: result.rows?.[0] || null,
        };
      } else {
        const insertQuery = `
          INSERT INTO public.audit_non_agri_statement (
            assessment_id,
            year_id,
            audit_unit_id,
            statement_date,
            statement_type,
            bank_name,
            head_office,
            unit_text,
            inspection_patra,
            inspection_purna,
            inspection_apoorna,
            designation1,
            designation2,
            shares_data,
            statement_data,
            total_yeanebaki_members,
            total_yeanebaki_amount,
            total_thakbaki_members,
            total_thakbaki_amount,
            created_by,
            updated_by,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *;
        `;

        const params = [
          payload.assessment_id || null,
          payload.year_id || null,
          payload.audit_unit_id || null,
          payload.statement_date || null,
          payload.statement_type || null,
          payload.bank_name || null,
          payload.head_office || null,
          payload.unit_text || null,
          payload.inspection_patra ?? null,
          payload.inspection_purna ?? null,
          payload.inspection_apoorna ?? null,
          payload.designation1 || null,
          payload.designation2 || null,
          JSON.stringify(payload.shares_data || {}),
          JSON.stringify(payload.statement_data || {}),
          payload.total_yeanebaki_members ?? null,
          payload.total_yeanebaki_amount ?? null,
          payload.total_thakbaki_members ?? null,
          payload.total_thakbaki_amount ?? null,
          userId || payload.created_by || null,
        ];

        const result = await this.db.query(insertQuery, params);
        return {
          success: true,
          message: 'Statement saved successfully',
          data: result.rows?.[0] || null,
        };
      }
    } catch (error) {
      this.logger.error('Error saving non-agri statement', error);
      throw error;
    }
  }
}
