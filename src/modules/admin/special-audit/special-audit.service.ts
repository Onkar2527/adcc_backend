import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import {
  CreateSpecialAuditDto,
  UpdateSpecialAuditDto,
} from './dto/special-audit.dto';

@Injectable()
export class SpecialAuditService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query(`
      SELECT
          aam.id,
          sam.title,
          sam.control_master_id,
          aam.year_id,
          ym.year,
          aam.audit_unit_id,
          aum.name AS audit_unit_name,
          aum.audit_unit_code,
          aam.audit_head_id AS auditor_id,
          auditor.name AS auditor_name,
          aam.assesment_period_from,
          aam.assesment_period_to,
          aam.audit_start_date,
          aam.audit_due_date,
          aam.audit_status_id,
          aam.frequency,
          aam.audit_type_id,
          atm.code AS audit_type_code,
          atm.name AS audit_type_name,
          aam.created_at
      FROM audit_assesment_master aam
      INNER JOIN audit_type_master atm
        ON atm.id = aam.audit_type_id
       AND atm.deleted_at IS NULL
      LEFT JOIN year_master ym ON ym.id = aam.year_id
      LEFT JOIN audit_unit_master aum ON aum.id = aam.audit_unit_id
      LEFT JOIN employee_master auditor ON auditor.id = aam.audit_head_id
      LEFT JOIN special_audit_master sam
        ON sam.assessment_id = aam.id
       AND sam.deleted_at IS NULL
      WHERE aam.deleted_at IS NULL
        AND sam.id IS NOT NULL
      ORDER BY aam.id DESC;
    `);

    return result.rows;
  }

  async findOne(id: number) {
    const result = await this.db.query(
      `
      SELECT
          aam.*,
          sam.title,
          sam.control_master_id,
          ym.year,
          aum.name AS audit_unit_name,
          aum.audit_unit_code,
          auditor.name AS auditor_name,
          atm.code AS audit_type_code,
          atm.name AS audit_type_name
      FROM audit_assesment_master aam
      INNER JOIN audit_type_master atm
        ON atm.id = aam.audit_type_id
       AND atm.deleted_at IS NULL
      LEFT JOIN year_master ym ON ym.id = aam.year_id
      LEFT JOIN audit_unit_master aum ON aum.id = aam.audit_unit_id
      LEFT JOIN employee_master auditor ON auditor.id = aam.audit_head_id
      LEFT JOIN special_audit_master sam
        ON sam.assessment_id = aam.id
       AND sam.deleted_at IS NULL
      WHERE aam.id = $1
        AND aam.deleted_at IS NULL
        AND sam.id IS NOT NULL;
      `,
      [id],
    );

    if (!result.rows.length) {
      throw new BadRequestException('Special audit not found.');
    }

    return result.rows[0];
  }

  async lookups() {
    const [years, auditUnits, auditors, auditTypes, controls] = await Promise.all([
      this.db.query(`
        SELECT id, year AS label
        FROM year_master
        ORDER BY id DESC;
      `),
      this.db.query(`
        SELECT id, CONCAT('(', audit_unit_code, ') ', name) AS label
        FROM audit_unit_master
        WHERE deleted_at IS NULL
        ORDER BY NULLIF(regexp_replace(audit_unit_code, '\D', '', 'g'), '')::int ASC, audit_unit_code ASC;
      `),
      this.db.query(`
        SELECT id, CONCAT(name, ' (', emp_code, ')') AS label
        FROM employee_master
        WHERE deleted_at IS NULL
          AND is_active = 1
          AND user_type_id::text = '2'
        ORDER BY name ASC;
      `),
      this.db.query(`
        SELECT id, name AS label, code
        FROM audit_type_master
        WHERE deleted_at IS NULL
          AND is_active = 1
          AND code <> 'INTERNAL_AUDIT'
        ORDER BY name ASC;
      `),
      this.db.query(`
        SELECT
            mlcm.id,
            CONCAT(
              COALESCE(aum.name, 'All Units'),
              ' - ',
              mlcm.start_month_year,
              ' to ',
              mlcm.end_month_year
            ) AS label,
            mlcm.year_id,
            mlcm.audit_unit_id,
            mapping.audit_type_id
        FROM multi_level_control_master mlcm
        INNER JOIN audit_type_question_setup_mapping mapping
          ON mapping.control_master_id = mlcm.id
         AND mapping.is_active = 1
         AND mapping.deleted_at IS NULL
        LEFT JOIN audit_unit_master aum ON aum.id = mlcm.audit_unit_id
        WHERE mlcm.deleted_at IS NULL
        ORDER BY mlcm.id DESC;
      `),
    ]);

    return {
      years: years.rows,
      audit_units: auditUnits.rows,
      auditors: auditors.rows,
      audit_types: auditTypes.rows,
      periodwise_questions: controls.rows,
    };
  }

  async create(body: CreateSpecialAuditDto) {
    const auditType = await this.findMappedAuditType(
      body.audit_type_id,
      body.control_master_id,
    );
    const fromDate = this.normalizeDate(body.assesment_period_from);
    const toDate = this.normalizeDate(body.assesment_period_to);

    if (fromDate > toDate) {
      throw new BadRequestException('Assessment period from date cannot be after to date.');
    }

    const unitResult = await this.db.query(
      `
      SELECT
          id,
          branch_head_id,
          branch_subhead_id,
          multi_compliance_ids
      FROM audit_unit_master
      WHERE id = $1 AND deleted_at IS NULL;
      `,
      [body.audit_unit_id],
    );

    const unit = unitResult.rows[0];

    if (!unit) {
      throw new BadRequestException('Audit unit not found.');
    }

    const controlResult = await this.db.query(
      `
      SELECT
          id,
          year_id,
          section_type_id,
          audit_unit_id,
          menu_ids,
          cat_ids,
          header_ids,
          question_ids,
          advances_scheme_ids,
          deposits_scheme_ids,
          is_multiple_auditors
      FROM multi_level_control_master
      WHERE id = $1
        AND deleted_at IS NULL;
      `,
      [body.control_master_id],
    );

    const control = controlResult.rows[0];

    if (!control) {
      throw new BadRequestException('Selected question setup was not found.');
    }

    const controlUnitId = Number(control.audit_unit_id || 0);

    if (controlUnitId > 0 && controlUnitId !== Number(body.audit_unit_id)) {
      throw new BadRequestException('Selected question setup does not belong to this audit unit.');
    }

    const auditDueDate =
      body.audit_due_date
        ? this.normalizeDate(body.audit_due_date)
        : this.addDays(new Date(), 15);

    const batchKey = this.generateBatchKey();
    const frequency = this.monthDiffInclusive(fromDate, toDate);

    return this.db.transaction(async (client) => {
      const result = await client.query(
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
            batch_key,
            is_multiple_auditors
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, CURRENT_DATE, $11, 1, 5, 5,
            $12, $13, $14, $15, $16, $17, $18, $19
        )
        RETURNING id;
        `,
        [
          Number(auditType.id),
          body.year_id,
          body.audit_unit_id,
          frequency,
          body.auditor_id,
          unit.branch_head_id,
          unit.branch_subhead_id,
          unit.multi_compliance_ids,
          fromDate,
          toDate,
          auditDueDate,
          control.menu_ids,
          control.cat_ids,
          control.header_ids,
          control.question_ids,
          control.advances_scheme_ids,
          control.deposits_scheme_ids,
          batchKey,
          !!control.is_multiple_auditors,
        ],
      );

      await client.query(
        `
        INSERT INTO special_audit_master (
            assessment_id,
            title,
            control_master_id,
            created_by,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        `,
        [
          result.rows[0].id,
          body.title.trim(),
          body.control_master_id,
          body.auditor_id,
        ],
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
        VALUES ($1, 1, 1, 0, $2, $3);
        `,
        [
          result.rows[0].id,
          body.auditor_id,
          batchKey,
        ],
      );

      return {
        id: result.rows[0].id,
        assessment_id: result.rows[0].id,
        message: 'Special audit created successfully.',
      };
    });
  }

  async update(id: number, body: UpdateSpecialAuditDto) {
    const existing = await this.findOne(id);

    const workResult = await this.db.query(
      `
      SELECT
        (
          EXISTS (
            SELECT 1 FROM answers_data
            WHERE assesment_id = $1
              AND deleted_at IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM answers_data_annexure
            WHERE assesment_id = $1
              AND deleted_at IS NULL
          )
        ) AS has_work;
      `,
      [id],
    );

    if (workResult.rows[0]?.has_work) {
      throw new BadRequestException(
        'Special audit setup can be edited only before audit work has started.',
      );
    }

    const next = {
      title: body.title ?? existing.title,
      audit_type_id: Number(body.audit_type_id ?? existing.audit_type_id),
      year_id: Number(body.year_id ?? existing.year_id),
      audit_unit_id: Number(body.audit_unit_id ?? existing.audit_unit_id),
      control_master_id: Number(body.control_master_id ?? existing.control_master_id),
      auditor_id: Number(body.auditor_id ?? existing.audit_head_id),
      assesment_period_from: this.normalizeDate(
        body.assesment_period_from ?? existing.assesment_period_from,
      ),
      assesment_period_to: this.normalizeDate(
        body.assesment_period_to ?? existing.assesment_period_to,
      ),
      audit_due_date: body.audit_due_date
        ? this.normalizeDate(body.audit_due_date)
        : existing.audit_due_date
          ? this.normalizeDate(existing.audit_due_date)
          : null,
    };

    const auditType = await this.findMappedAuditType(
      next.audit_type_id,
      next.control_master_id,
    );

    if (!next.title?.trim()) {
      throw new BadRequestException('Special audit title is required.');
    }

    if (next.assesment_period_from > next.assesment_period_to) {
      throw new BadRequestException('Assessment period from date cannot be after to date.');
    }

    const unitResult = await this.db.query(
      `
      SELECT
          id,
          branch_head_id,
          branch_subhead_id,
          multi_compliance_ids
      FROM audit_unit_master
      WHERE id = $1 AND deleted_at IS NULL;
      `,
      [next.audit_unit_id],
    );

    const unit = unitResult.rows[0];

    if (!unit) {
      throw new BadRequestException('Audit unit not found.');
    }

    const controlResult = await this.db.query(
      `
      SELECT
          id,
          audit_unit_id,
          menu_ids,
          cat_ids,
          header_ids,
          question_ids,
          advances_scheme_ids,
          deposits_scheme_ids,
          is_multiple_auditors
      FROM multi_level_control_master
      WHERE id = $1
        AND deleted_at IS NULL;
      `,
      [next.control_master_id],
    );

    const control = controlResult.rows[0];

    if (!control) {
      throw new BadRequestException('Selected question setup was not found.');
    }

    const controlUnitId = Number(control.audit_unit_id || 0);

    if (controlUnitId > 0 && controlUnitId !== next.audit_unit_id) {
      throw new BadRequestException('Selected question setup does not belong to this audit unit.');
    }

    const frequency = this.monthDiffInclusive(
      next.assesment_period_from,
      next.assesment_period_to,
    );

    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE audit_assesment_master
        SET
            audit_type_id = $1,
            year_id = $2,
            audit_unit_id = $3,
            frequency = $4,
            audit_head_id = $5,
            branch_head_id = $6,
            branch_subhead_id = $7,
            multi_compliance_ids = $8,
            assesment_period_from = $9,
            assesment_period_to = $10,
            audit_due_date = $11,
            menu_ids = $12,
            cat_ids = $13,
            header_ids = $14,
            question_ids = $15,
            advances_scheme_ids = $16,
            deposits_scheme_ids = $17,
            is_multiple_auditors = $18,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $19
          AND deleted_at IS NULL;
        `,
        [
          Number(auditType.id),
          next.year_id,
          next.audit_unit_id,
          frequency,
          next.auditor_id,
          unit.branch_head_id,
          unit.branch_subhead_id,
          unit.multi_compliance_ids,
          next.assesment_period_from,
          next.assesment_period_to,
          next.audit_due_date,
          control.menu_ids,
          control.cat_ids,
          control.header_ids,
          control.question_ids,
          control.advances_scheme_ids,
          control.deposits_scheme_ids,
          !!control.is_multiple_auditors,
          id,
        ],
      );

      await client.query(
        `
        INSERT INTO special_audit_master (
            assessment_id,
            title,
            control_master_id,
            created_by,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (assessment_id)
        WHERE deleted_at IS NULL
        DO UPDATE SET
            title = EXCLUDED.title,
            control_master_id = EXCLUDED.control_master_id,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [
          id,
          next.title.trim(),
          next.control_master_id,
          next.auditor_id,
        ],
      );
    });

    return {
      id,
      assessment_id: id,
      message: 'Special audit updated successfully.',
    };
  }

  private async findMappedAuditType(
    auditTypeId: number,
    controlMasterId: number,
  ) {
    const result = await this.db.query(
      `
        SELECT audit_type.id
        FROM audit_type_master audit_type
        INNER JOIN audit_type_question_setup_mapping mapping
          ON mapping.audit_type_id = audit_type.id
         AND mapping.control_master_id = $2
         AND mapping.is_active = 1
         AND mapping.deleted_at IS NULL
        WHERE audit_type.id = $1
          AND audit_type.code <> 'INTERNAL_AUDIT'
          AND audit_type.is_active = 1
          AND audit_type.deleted_at IS NULL
        LIMIT 1
      `,
      [auditTypeId, controlMasterId],
    );

    if (!result.rows.length) {
      throw new BadRequestException(
        'Selected question setup is not mapped to this audit type.',
      );
    }

    return result.rows[0];
  }

  private normalizeDate(value: string | Date) {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return String(value).slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return this.normalizeDate(next);
  }

  private monthDiffInclusive(fromDate: string, toDate: string) {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);

    return Math.max(
      1,
      (to.getFullYear() - from.getFullYear()) * 12
        + (to.getMonth() - from.getMonth())
        + 1,
    );
  }

  private generateBatchKey() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');

    return `SA${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
