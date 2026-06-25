import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../../core/database/database.service';

import {
  CreateAuditAnnexureColumnDto,
  CreateAuditAnnexureDto,
} from './dto/audit-annexure.dto';

@Injectable()
export class AuditAnnexureMasterService {
  constructor(private readonly db: DatabaseService) { }

  // ANNEXURE MASTER 

  async findAll() {
    try {
      const result = await this.db.query(
        `
      SELECT
        am.id,
        am.name,
        am.risk_defination_id,
        am.risk_category_id,
        am.business_risk,
        am.control_risk,
        CASE
          WHEN am.business_risk = 1 THEN 'High'
          WHEN am.business_risk = 2 THEN 'Medium'
          WHEN am.business_risk = 3 THEN 'Low'
          ELSE '-'
        END AS business_risk_name,

        CASE
          WHEN am.control_risk = 1 THEN 'High'
          WHEN am.control_risk = 2 THEN 'Medium'
          WHEN am.control_risk = 3 THEN 'Low'
          ELSE '-'
        END AS control_risk_name,
        am.is_active,

        rcm.risk_category AS risk_category_name,

        CASE
          WHEN am.risk_defination_id = 1 THEN 'Custom'
          WHEN am.risk_defination_id = 0 THEN 'Default'
          ELSE '-'
        END AS risk_definition_name

      FROM annexure_master am

      LEFT JOIN risk_category_master rcm
        ON rcm.id = am.risk_category_id

      WHERE am.deleted_at IS NULL

      ORDER BY am.id DESC
      `,
      );

      return result.rows;
    } catch (error) {
      throw new BadRequestException(
        'Failed to fetch annexures',
      );
    }
  }

  async findOne(id: number) {
    try {

      const result = await this.db.query(
        `
      SELECT
        am.id,
        am.name,
        EXISTS (
          SELECT 1
          FROM question_master qm
          WHERE qm.annexure_id = am.id
          AND qm.deleted_at IS NULL
        ) AS is_locked,
        am.risk_defination_id,
        am.risk_category_id,
        am.business_risk,
        am.control_risk,
        am.is_active,

        rcm.risk_category AS risk_category_name,

        CASE
          WHEN am.risk_defination_id = 1 THEN 'Custom'
          WHEN am.risk_defination_id = 0 THEN 'Default'
          ELSE '-'
        END AS risk_definition_name,

        CASE
          WHEN am.business_risk = 1 THEN 'High'
          WHEN am.business_risk = 2 THEN 'Medium'
          WHEN am.business_risk = 3 THEN 'Low'
          ELSE '-'
        END AS business_risk_name,

        CASE
          WHEN am.control_risk = 1 THEN 'High'
          WHEN am.control_risk = 2 THEN 'Medium'
          WHEN am.control_risk = 3 THEN 'Low'
          ELSE '-'
        END AS control_risk_name

      FROM annexure_master am

      LEFT JOIN risk_category_master rcm
        ON rcm.id = am.risk_category_id

      WHERE am.id = $1
      AND am.deleted_at IS NULL
      `,
        [id],
      );

      if (!result.rows.length) {
        throw new NotFoundException(
          'Annexure not found',
        );
      }

      return result.rows[0];

    } catch (error) {
      throw error;
    }
  }

  async create(
    data: CreateAuditAnnexureDto & { admin_id: number },
  ) {
    try {
      const existing = await this.db.query(
        `
        SELECT id
        FROM annexure_master
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND deleted_at IS NULL
        `,
        [data.name],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Annexure already exists',
        );
      }

      return await this.db.query(
        `
        INSERT INTO annexure_master (
          name,
          risk_defination_id,
          risk_category_id,
          business_risk,
          control_risk,
          admin_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.name,
          data.risk_defination_id,
          data.risk_category_id,
          data.business_risk,
          data.control_risk,
          data.admin_id,
        ],
      );
    } catch (error) {
      throw error;
    }
  }

  async update(
    id: number,
    data: CreateAuditAnnexureDto,
  ) {
    try {
      const existing = await this.db.query(
        `
        SELECT id
        FROM annexure_master
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND id != $2
        AND deleted_at IS NULL
        `,
        [data.name, id],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Annexure already exists',
        );
      }

      const result = await this.db.query(
        `
        UPDATE annexure_master
        SET
          name = $1,
          risk_defination_id = $2,
          risk_category_id = $3,
          business_risk = $4,
          control_risk = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        AND deleted_at IS NULL
        RETURNING *
        `,
        [
          data.name,
          data.risk_defination_id,
          data.risk_category_id,
          data.business_risk,
          data.control_risk,
          id,
        ],
      );

      if (!result.rows.length) {
        throw new NotFoundException(
          'Annexure not found',
        );
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async toggleStatus(id: number) {
    try {
      const result = await this.db.query(
        `
        UPDATE annexure_master
        SET
          is_active = CASE
            WHEN is_active = 1 THEN 0
            ELSE 1
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        AND deleted_at IS NULL
        RETURNING *
        `,
        [id],
      );

      if (!result.rows.length) {
        throw new NotFoundException(
          'Annexure not found',
        );
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async softDelete(id: number) {
    try {
      const result = await this.db.query(
        `
        UPDATE annexure_master
        SET
          deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1
        AND deleted_at IS NULL
        RETURNING *
        `,
        [id],
      );

      if (!result.rows.length) {
        throw new NotFoundException(
          'Annexure not found',
        );
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getLookups() {
    try {
      const riskCategories =
        await this.db.query(
          `
        SELECT
          id::int AS value,
          risk_category AS label
        FROM risk_category_master
        WHERE deleted_at IS NULL
        ORDER BY risk_category
        `,
        );

      return {
        riskDefinitionOptions: [
          {
            label: 'Default',
            value: 0,
          },

          {
            label: 'Custom',
            value: 1,
          },
        ],

        riskOptions: [
          {
            label: 'High',
            value: 1,
          },

          {
            label: 'Medium',
            value: 2,
          },

          {
            label: 'Low',
            value: 3,
          },
        ],

        columnTypes: [
          {
            label: 'TextBox',
            value: 1,
          },

          {
            label: 'TextArea',
            value: 2,
          },

          {
            label: 'Dropdown',
            value: 3,
          },
        ],

        riskCategories:
          riskCategories.rows,
      };
    } catch (error) {
      throw new BadRequestException(
        'Unable to load lookups',
      );
    }
  }

  private async validateAnnexureLocked(
    annexureId: number,
  ) {

    const result =
      await this.db.query(
        `
      SELECT EXISTS (
        SELECT 1
        FROM question_master
        WHERE annexure_id = $1
        AND deleted_at IS NULL
      ) AS is_locked
      `,
        [annexureId],
      );

    if (result.rows[0]?.is_locked) {

      throw new BadRequestException(
        'Annexure is mapped to questions and cannot be modified',
      );
    }
  }

  // ANNEXURE COLUMNS

  async findAllColumns(annexureId: number) {
    try {
      const result = await this.db.query(
        `
      SELECT
        ac.id,
        ac.annexure_id,
        ac.name,
        ac.column_type_id,

        CASE
          WHEN ac.column_type_id = 1 THEN 'TextBox'
          WHEN ac.column_type_id = 2 THEN 'TextArea'
          WHEN ac.column_type_id = 3 THEN 'Dropdown'
          ELSE '-'
        END AS column_type_name,

        COALESCE(
          (CASE 
            WHEN ac.column_options IS NULL OR BTRIM(ac.column_options) = '' OR BTRIM(ac.column_options) = '[]' THEN '[]'::jsonb
            ELSE ac.column_options::jsonb
          END), 
          '[]'::jsonb
        ) AS options

      FROM annexure_columns ac

      WHERE ac.annexure_id = $1
      AND ac.deleted_at IS NULL

      ORDER BY ac.id DESC
      `,
        [annexureId],
      );

      return result.rows;
    } catch (error) {
      throw new BadRequestException(
        'Failed to fetch annexure columns',
      );
    }
  }

  async createColumn(
    data: CreateAuditAnnexureColumnDto & {
      admin_id: number;
    },
  ) {
    try {
      return await this.db.transaction(async (client) => {
        const existing = await client.query(
          `
        SELECT id
        FROM annexure_columns
        WHERE annexure_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        AND deleted_at IS NULL
        `,
          [data.annexure_id, data.name],
        );

        if (existing.rows.length) {
          throw new BadRequestException(
            'Column already exists',
          );
        }

        if (
          data.column_type_id === 3 &&
          (!data.options || !data.options.length)
        ) {
          throw new BadRequestException(
            'Dropdown options are required',
          );
        }

        await this.validateAnnexureLocked(
          data.annexure_id,
        );

        const jsonOptions = data.column_type_id === 3 && data.options?.length
          ? JSON.stringify(data.options.map(opt => ({ option_label: opt.trim(), column_option: opt.trim() })))
          : '[]';

        const columnResult = await client.query(
          `
        INSERT INTO annexure_columns (
          annexure_id,
          name,
          column_type_id,
          column_options,
          admin_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
          [
            data.annexure_id,
            data.name,
            data.column_type_id,
            jsonOptions,
            data.admin_id,
          ],
        );

        return columnResult.rows[0];
      });
    } catch (error) {
      throw error;
    }
  }

  async updateColumn(
    id: number,
    data: CreateAuditAnnexureColumnDto,
  ) {
    try {
      return await this.db.transaction(async (client) => {
        const existing = await client.query(
          `
        SELECT id
        FROM annexure_columns
        WHERE annexure_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        AND id != $3
        AND deleted_at IS NULL
        `,
          [data.annexure_id, data.name, id],
        );

        if (existing.rows.length) {
          throw new BadRequestException(
            'Column already exists',
          );
        }

        if (
          data.column_type_id === 3 &&
          (!data.options || !data.options.length)
        ) {
          throw new BadRequestException(
            'Dropdown options are required',
          );
        }

        await this.validateAnnexureLocked(
          data.annexure_id,
        );

        const jsonOptions = data.column_type_id === 3 && data.options?.length
          ? JSON.stringify(data.options.map(opt => ({ option_label: opt.trim(), column_option: opt.trim() })))
          : '[]';

        await client.query(
          `
        UPDATE annexure_columns
        SET
          name = $1,
          column_type_id = $2,
          column_options = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
          [
            data.name,
            data.column_type_id,
            jsonOptions,
            id,
          ],
        );

        return {
          message: 'Column updated successfully',
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteColumn(id: number) {
    try {

      const annexureResult =
        await this.db.query(
          `
        SELECT annexure_id
        FROM annexure_columns
        WHERE id = $1
        AND deleted_at IS NULL
        `,
          [id],
        );

      if (
        !annexureResult.rows.length
      ) {
        throw new NotFoundException(
          'Column not found',
        );
      }

      await this.validateAnnexureLocked(
        annexureResult.rows[0]
          .annexure_id,
      );

      const result = await this.db.query(
        `
      UPDATE annexure_columns
      SET deleted_at = CURRENT_TIMESTAMP, column_options = '[]'
      WHERE id = $1
      AND deleted_at IS NULL
      RETURNING *
      `,
        [id],
      );

      return result;

    } catch (error) {
      throw error;
    }
  }
}