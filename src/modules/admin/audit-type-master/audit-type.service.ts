import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { AuditTypeDto } from './dto/audit-type.dto';

@Injectable()
export class AuditTypeService {
  constructor(private readonly db: DatabaseService) {}

  async findActiveByCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const result = await this.db.query(
      `
        SELECT id, code, name, description, is_system, is_active
        FROM audit_type_master
        WHERE UPPER(TRIM(code)) = $1
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [normalizedCode],
    );

    if (!result.rows.length) {
      throw new BadRequestException(
        `Active audit type ${normalizedCode} was not found.`,
      );
    }

    return result.rows[0];
  }

  async findAll() {
    return this.db.query(`
      SELECT
        id,
        code,
        name,
        description,
        is_system,
        is_active,
        (
          SELECT COUNT(*)::int
          FROM audit_type_question_setup_mapping mapping
          WHERE mapping.audit_type_id = audit_type_master.id
            AND mapping.is_active = 1
            AND mapping.deleted_at IS NULL
        ) AS question_setup_count,
        created_at,
        updated_at
      FROM audit_type_master
      WHERE deleted_at IS NULL
      ORDER BY is_system DESC, name ASC
    `);
  }

  async create(dto: AuditTypeDto) {
    const data = this.normalize(dto);
    await this.ensureUnique(data.code, data.name);

    return this.db.query(
      `
        INSERT INTO audit_type_master (
          code,
          name,
          description,
          is_system,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        data.code,
        data.name,
        data.description,
        data.is_system,
        data.is_active,
      ],
    );
  }

  async update(id: number, dto: AuditTypeDto) {
    const data = this.normalize(dto);
    const current = await this.findExisting(id);
    await this.ensureUnique(data.code, data.name, id);

    const isSystem = Number(current.is_system) === 1
      ? 1
      : data.is_system;

    return this.db.query(
      `
        UPDATE audit_type_master
        SET
          code = $1,
          name = $2,
          description = $3,
          is_system = $4,
          is_active = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
          AND deleted_at IS NULL
        RETURNING *
      `,
      [
        data.code,
        data.name,
        data.description,
        isSystem,
        data.is_active,
        id,
      ],
    );
  }

  async toggleStatus(id: number) {
    await this.findExisting(id);

    return this.db.query(
      `
        UPDATE audit_type_master
        SET
          is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING *
      `,
      [id],
    );
  }

  async getQuestionSetups(id: number) {
    const auditType = await this.findExisting(id);
    const result = await this.db.query(
      `
        SELECT
          setup.id,
          CONCAT(
            COALESCE(unit.name, 'All Units'),
            ' - ',
            setup.start_month_year,
            ' to ',
            setup.end_month_year
          ) AS label,
          setup.year_id,
          setup.audit_unit_id,
          CASE WHEN mapping.id IS NULL THEN 0 ELSE 1 END AS is_mapped
        FROM multi_level_control_master setup
        LEFT JOIN audit_unit_master unit
          ON unit.id = setup.audit_unit_id
        LEFT JOIN audit_type_question_setup_mapping mapping
          ON mapping.control_master_id = setup.id
         AND mapping.audit_type_id = $1
         AND mapping.is_active = 1
         AND mapping.deleted_at IS NULL
        WHERE setup.deleted_at IS NULL
        ORDER BY setup.id DESC
      `,
      [id],
    );

    return {
      audit_type: auditType,
      question_setups: result.rows,
      selected_ids: result.rows
        .filter((row: any) => Number(row.is_mapped) === 1)
        .map((row: any) => Number(row.id)),
    };
  }

  async saveQuestionSetups(id: number, controlMasterIds: number[]) {
    await this.findExisting(id);
    const ids = [
      ...new Set(
        (controlMasterIds || [])
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];

    if (ids.length) {
      const valid = await this.db.query(
        `
          SELECT id
          FROM multi_level_control_master
          WHERE id = ANY($1::bigint[])
            AND deleted_at IS NULL
        `,
        [ids],
      );

      if (valid.rows.length !== ids.length) {
        throw new BadRequestException(
          'One or more selected question setups are invalid.',
        );
      }
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `
          UPDATE audit_type_question_setup_mapping
          SET
            is_active = 0,
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE audit_type_id = $1
            AND deleted_at IS NULL
        `,
        [id],
      );

      for (const controlMasterId of ids) {
        await client.query(
          `
            INSERT INTO audit_type_question_setup_mapping (
              audit_type_id,
              control_master_id,
              is_active
            )
            VALUES ($1, $2, 1)
          `,
          [id, controlMasterId],
        );
      }
    });

    return {
      message: 'Questionnaire mappings saved successfully.',
      mapped_count: ids.length,
    };
  }

  private async findExisting(id: number) {
    const result = await this.db.query(
      `
        SELECT id, code, name, is_system, is_active
        FROM audit_type_master
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id],
    );

    if (!result.rows.length) {
      throw new BadRequestException('Audit type not found.');
    }

    return result.rows[0];
  }

  private async ensureUnique(code: string, name: string, id?: number) {
    const result = await this.db.query(
      `
        SELECT id, code, name
        FROM audit_type_master
        WHERE deleted_at IS NULL
          AND ($3::bigint IS NULL OR id <> $3)
          AND (
            LOWER(TRIM(code)) = LOWER(TRIM($1))
            OR LOWER(TRIM(name)) = LOWER(TRIM($2))
          )
        LIMIT 1
      `,
      [code, name, id ?? null],
    );

    if (!result.rows.length) return;

    const duplicate = result.rows[0];
    if (duplicate.code.toLowerCase() === code.toLowerCase()) {
      throw new BadRequestException('Audit type code already exists.');
    }

    throw new BadRequestException('Audit type name already exists.');
  }

  private normalize(dto: AuditTypeDto): AuditTypeDto {
    return {
      code: dto.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      is_system: Number(dto.is_system),
      is_active: Number(dto.is_active),
    };
  }
}
