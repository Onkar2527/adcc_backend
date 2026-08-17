import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MasterBulkUploadService {
  constructor(private readonly db: DatabaseService) { }

  async upload(masterKey: string, rows: any[]) {
    const key = String(masterKey || '').trim().toLowerCase();

    switch (key) {
      case 'employees':
        return this.bulkUploadEmployees(rows);
      case 'sections':
        return this.bulkUploadSections(rows);
      case 'schemes':
        return this.bulkUploadSchemes(rows);
      case 'auditunits':
        return this.bulkUploadAuditUnits(rows);
      case 'regions':
        return this.bulkUploadRegions(rows);
      case 'broaderareas':
        return this.bulkUploadBroaderAreas(rows);
      case 'frequencies':
        return this.bulkUploadFrequencies(rows);
      case 'executivesummary':
        return this.bulkUploadExecutiveSummary(rows);
      default:
        throw new BadRequestException(`Bulk upload is not configured for master: ${masterKey}`);
    }
  }

  private async bulkUploadEmployees(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one employee row is required.');
    }

    return this.db.transaction(async (client) => {
      const existingRows = await client.query(
        `SELECT emp_code, email FROM employee_master WHERE deleted_at IS NULL`,
      );

      const existingCodes = new Set(existingRows.rows.map((row) => String(row.emp_code || '').trim().toLowerCase()));
      const existingEmails = new Set(existingRows.rows.map((row) => String(row.email || '').trim().toLowerCase()));
      const batchCodes = new Set<string>();
      const batchEmails = new Set<string>();
      const errors: string[] = [];
      const validRows: any[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const issues: string[] = [];
        const empCode = String(row?.emp_code || '').trim();
        const email = String(row?.email || '').trim();
        const mobile = String(row?.mobile || '').trim();
        const name = String(row?.name || '').trim();
        const gender = String(row?.gender || '').trim();
        const password = String(row?.password || '').trim();
        const normalizedCode = empCode.toLowerCase();
        const normalizedEmail = email.toLowerCase();
        const userTypeId = Number(row?.user_type_id || 0);

        if (!empCode) issues.push('Employee code is required');
        if (!name) issues.push('Name is required');
        if (!email) {
          issues.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          issues.push('Email format is invalid');
        }
        if (!/^\d{10}$/.test(mobile)) issues.push('Mobile must be 10 digits');
        if (!gender) issues.push('Gender is required');
        if (!userTypeId) issues.push('User type is required');
        if (!password) issues.push('Password is required');
        if (existingCodes.has(normalizedCode) || batchCodes.has(normalizedCode)) issues.push('Employee code already exists');
        if (userTypeId === 6 && !String(row?.region_name || '').trim()) {
          issues.push('Assigned region is required for division user');
        }

        if (issues.length) {
          errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
          return;
        }

        batchCodes.add(normalizedCode);
        batchEmails.add(normalizedEmail);
        validRows.push(row);
      });

      if (errors.length) {
        throw new BadRequestException({ message: 'Bulk employee validation failed.', errors });
      }

      const data: any[] = [];
      for (const row of validRows) {
        const passwordHash = await bcrypt.hash(String(row.password), 10);
        const values = [
          row.emp_code,
          Number(row.user_type_id),
          String(row.name || '').toUpperCase(),
          row.email,
          row.mobile,
          row.designation ?? '',
          row.gender,
          passwordHash,
          Number(row.is_active ?? 1),
          1,
          '',
          Number(row.admin_id ?? 1),
          row.region_name ?? null,
        ];

        const result = await client.query(
          `INSERT INTO employee_master (
            emp_code, user_type_id, name, email, mobile,
            designation, gender, password, is_active,
            password_policy, audit_unit_authority, admin_id, region_name, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
          RETURNING id, emp_code, name, email, is_active, region_name`,
          values,
        );
        data.push(result.rows[0]);
      }

      return { successCount: data.length, errors: [], data };
    });
  }

  private async bulkUploadSections(rows: any[]) {
    return this.bulkSimpleInsert({
      rows,
      errorMessage: 'At least one audit section row is required.',
      validate: async (client) => {
        const existing = await client.query(`SELECT name FROM audit_section_master WHERE deleted_at IS NULL`);
        return new Set(existing.rows.map((r) => String(r.name || '').trim().toLowerCase()));
      },
      getKey: (row) => String(row?.name || '').trim().toLowerCase(),
      validateRow: (row, index, existingKeys, batchKeys) => {
        const errors: string[] = [];
        const name = String(row?.name || '').trim().toUpperCase();
        if (!name) errors.push('Section name is required');
        const key = name.toLowerCase();
        if (existingKeys.has(key) || batchKeys.has(key)) errors.push('Section name already exists');
        return { name, errors, rowNumber: index + 1, key };
      },
      insert: (client, row) => client.query(
        `INSERT INTO audit_section_master (name, admin_id)
         VALUES ($1, $2)
         RETURNING *`,
        [row.name, Number(row.admin_id ?? 1)],
      ),
    });
  }

  private async bulkUploadSchemes(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one scheme row is required.');
    }

    return this.db.transaction(async (client) => {
      const existingRows = await client.query(
        `SELECT scheme_type_id, scheme_code FROM scheme_master WHERE deleted_at IS NULL`,
      );
      const categories = await client.query(
        `SELECT id FROM category_master WHERE deleted_at IS NULL`,
      );

      const categoryIds = new Set(categories.rows.map((r) => Number(r.id)));
      const existingKeys = new Set(existingRows.rows.map((r) => `${Number(r.scheme_type_id)}::${String(r.scheme_code || '').trim().toUpperCase()}`));
      const batchKeys = new Set<string>();
      const validRows: any[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const issues: string[] = [];
        const schemeTypeId = Number(row?.scheme_type_id || 0);
        const categoryId = Number(row?.category_id || 0);
        const schemeCode = String(row?.scheme_code || '').trim().toUpperCase();
        const name = String(row?.name || '').trim().toUpperCase();
        const key = `${schemeTypeId}::${schemeCode}`;

        if (![1, 2].includes(schemeTypeId)) issues.push('Scheme type is invalid');
        if (!categoryIds.has(categoryId)) issues.push('Category is invalid');
        if (!schemeCode) issues.push('Scheme code is required');
        if (!name) issues.push('Scheme name is required');
        if (existingKeys.has(key) || batchKeys.has(key)) issues.push('Scheme code already exists');

        if (issues.length) {
          errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
          return;
        }

        batchKeys.add(key);
        validRows.push({ ...row, scheme_code: schemeCode, name });
      });

      if (errors.length) {
        throw new BadRequestException({ message: 'Bulk scheme validation failed.', errors });
      }

      const data: any[] = [];
      for (const row of validRows) {
        const result = await client.query(
          `INSERT INTO scheme_master (
            scheme_type_id, category_id, scheme_code, name, is_active, admin_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            Number(row.scheme_type_id),
            Number(row.category_id),
            row.scheme_code,
            row.name,
            Number(row.is_active ?? 1),
            Number(row.admin_id ?? 1),
          ],
        );
        data.push(result.rows[0]);
      }

      return { successCount: data.length, errors: [], data };
    });
  }

  private async bulkUploadAuditUnits(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one audit unit row is required.');
    }

    return this.db.transaction(async (client) => {
      const [existingUnits, sections, employees] = await Promise.all([
        client.query(`SELECT audit_unit_code FROM audit_unit_master WHERE deleted_at IS NULL`),
        client.query(`SELECT id FROM audit_section_master WHERE deleted_at IS NULL`),
        client.query(`SELECT id FROM employee_master WHERE deleted_at IS NULL`),
      ]);

      const existingCodes = new Set(existingUnits.rows.map((r) => String(r.audit_unit_code || '').trim().toLowerCase()));
      const sectionIds = new Set(sections.rows.map((r) => Number(r.id)));
      const employeeIds = new Set(employees.rows.map((r) => Number(r.id)));
      const batchCodes = new Set<string>();
      const validRows: any[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const issues: string[] = [];
        const code = String(row?.audit_unit_code || '').trim();
        const name = String(row?.name || '').trim().toUpperCase();
        const sectionTypeId = Number(row?.section_type_id || 0);
        const branchHeadId = Number(row?.branch_head_id || 0);
        const branchSubheadId = row?.branch_subhead_id === null || row?.branch_subhead_id === undefined || row?.branch_subhead_id === ''
          ? null
          : Number(row.branch_subhead_id);
        const frequency = Number(row?.frequency || 0);
        const lastAuditDate = String(row?.last_audit_date || '').trim();
        const key = code.toLowerCase();

        if (!sectionIds.has(sectionTypeId)) issues.push('Audit section is invalid');
        if (!code) issues.push('Audit unit code is required');
        if (!name) issues.push('Audit unit name is required');

        if (branchSubheadId !== null && branchSubheadId === branchHeadId) issues.push('Head and assistant cannot be the same');
        if (![1, 3, 6, 12].includes(frequency)) issues.push('Audit frequency is invalid');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(lastAuditDate)) issues.push('Last audit date must be in YYYY-MM-DD format');
        if (existingCodes.has(key) || batchCodes.has(key)) issues.push('Audit unit code already exists');

        if (issues.length) {
          errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
          return;
        }

        batchCodes.add(key);
        validRows.push({ ...row, name, audit_unit_code: code, branch_subhead_id: branchSubheadId });
      });

      if (errors.length) {
        throw new BadRequestException({ message: 'Bulk audit unit validation failed.', errors });
      }

      const data: any[] = [];
      for (const row of validRows) {
        const result = await client.query(
          `INSERT INTO audit_unit_master (
            section_type_id, audit_unit_code, name, branch_head_id, branch_subhead_id,
            frequency, last_audit_date, admin_id, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            Number(row.section_type_id),
            row.audit_unit_code,
            row.name,
            Number(row.branch_head_id),
            row.branch_subhead_id,
            Number(row.frequency),
            row.last_audit_date,
            Number(row.admin_id ?? 1),
            Number(row.is_active ?? 1),
          ],
        );
        data.push(result.rows[0]);
      }

      return { successCount: data.length, errors: [], data };
    });
  }

  private async bulkUploadRegions(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one region row is required.');
    }

    return this.db.transaction(async (client) => {
      const [existingRows, units] = await Promise.all([
        client.query(`SELECT region_name FROM region_master WHERE deleted_at IS NULL`),
        client.query(`SELECT id FROM audit_unit_master WHERE deleted_at IS NULL`),
      ]);

      const existingNames = new Set(existingRows.rows.map((r) => String(r.region_name || '').trim().toLowerCase()));
      const validUnitIds = new Set(units.rows.map((r) => Number(r.id)));
      const batchNames = new Set<string>();
      const validRows: any[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const issues: string[] = [];
        const regionName = String(row?.region_name || '').trim();
        const unitIds = Array.isArray(row?.unit_ids) ? row.unit_ids.map((id: any) => Number(id)) : [];
        const key = regionName.toLowerCase();

        if (!regionName) issues.push('Region name is required');
        if (existingNames.has(key) || batchNames.has(key)) issues.push('Region name already exists');
        if (!unitIds.length) issues.push('At least one audit unit is required');
        if (unitIds.some((id: number) => !validUnitIds.has(id))) issues.push('One or more audit units are invalid');

        if (issues.length) {
          errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
          return;
        }

        batchNames.add(key);
        validRows.push({ ...row, region_name: regionName, unit_ids: unitIds });
      });

      if (errors.length) {
        throw new BadRequestException({ message: 'Bulk region validation failed.', errors });
      }

      const data: any[] = [];
      for (const row of validRows) {
        const result = await client.query(
          `INSERT INTO region_master (region_name, audit_unit_ids, is_active, admin_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            row.region_name,
            row.unit_ids.join(','),
            Number(row.is_active ?? 1),
            Number(row.admin_id ?? 1),
          ],
        );
        data.push(result.rows[0]);
      }

      return { successCount: data.length, errors: [], data };
    });
  }

  private async bulkUploadBroaderAreas(rows: any[]) {
    return this.bulkSimpleInsert({
      rows,
      errorMessage: 'At least one broader area row is required.',
      validate: async (client) => {
        const existing = await client.query(`SELECT name FROM audit_area_master WHERE deleted_at IS NULL`);
        return new Set(existing.rows.map((r) => String(r.name || '').trim().toLowerCase()));
      },
      getKey: (row) => String(row?.name || '').trim().toLowerCase(),
      validateRow: (row, index, existingKeys, batchKeys) => {
        const errors: string[] = [];
        const name = String(row?.name || '').trim().toUpperCase();
        const appetite_percent = String(row?.appetite_percent ?? '').trim();
        const occurance_percent = String(row?.occurance_percent ?? '').trim();
        const magnitude = String(row?.magnitude ?? '').trim();
        const frequency = String(row?.frequency ?? '').trim();
        const average_qualitative_count = String(row?.average_qualitative_count ?? '').trim();
        const average_quantitative_count = String(row?.average_quantitative_count ?? '').trim();
        const key = name.toLowerCase();

        if (!name) errors.push('Name is required');
        if (existingKeys.has(key) || batchKeys.has(key)) errors.push('Broader area already exists');

        for (const [label, value] of [
          ['Appetite percent', appetite_percent],
          ['Occurrence percent', occurance_percent],
          ['Magnitude', magnitude],
          ['Frequency', frequency],
          ['Average qualitative count', average_qualitative_count],
          ['Average quantitative count', average_quantitative_count],
        ]) {
          if (value && Number.isNaN(Number(value))) errors.push(`${label} must be numeric`);
        }

        return {
          rowNumber: index + 1,
          key,
          errors,
          name,
          appetite_percent,
          occurance_percent,
          magnitude,
          frequency,
          average_qualitative_count,
          average_quantitative_count,
        };
      },
      insert: (client, row) => client.query(
        `INSERT INTO audit_area_master (
          name, appetite_percent, occurance_percent, magnitude, frequency,
          average_qualitative_count, average_quantitative_count, admin_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          row.name,
          row.appetite_percent,
          row.occurance_percent,
          row.magnitude,
          row.frequency,
          row.average_qualitative_count,
          row.average_quantitative_count,
          Number(row.admin_id ?? 1),
        ],
      ),
    });
  }

  private async bulkUploadFrequencies(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one risk frequency row is required.');
    }

    const validRiskTypes = new Set([1, 2, 3]);
    const seenRiskTypes = new Set<number>();
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      const riskTypeId = Number(row?.risk_type_id || 0);
      const frequency = Number(row?.frequency || 0);
      const issues: string[] = [];

      if (!validRiskTypes.has(riskTypeId)) issues.push('Risk type is invalid');
      if (!Number.isFinite(frequency) || frequency <= 0) issues.push('Frequency must be a positive number');
      if (seenRiskTypes.has(riskTypeId)) issues.push('Duplicate risk type found in CSV');

      if (issues.length) {
        errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
        return;
      }

      seenRiskTypes.add(riskTypeId);
    });

    if (errors.length) {
      throw new BadRequestException({ message: 'Bulk frequency validation failed.', errors });
    }

    await this.db.transaction(async (client) => {
      for (const row of rows) {
        await client.query(
          `INSERT INTO audit_frequency_master (risk_type_id, frequency)
           VALUES ($1, $2)
           ON CONFLICT (risk_type_id)
           DO UPDATE SET frequency = $2, updated_at = CURRENT_TIMESTAMP`,
          [Number(row.risk_type_id), Number(row.frequency)],
        );
      }
    });

    return { successCount: rows.length, errors: [], data: [] };
  }

  private async bulkUploadExecutiveSummary(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('At least one row is required.');
    }

    const unitsRes = await this.db.query(`SELECT id, audit_unit_code FROM audit_unit_master WHERE deleted_at IS NULL`);
    const schemesRes = await this.db.query(`SELECT id, scheme_code FROM scheme_master WHERE deleted_at IS NULL`);
    const yearsRes = await this.db.query(`SELECT id FROM year_master WHERE deleted_at IS NULL`);

    const unitMap = new Map<string, number>(
      unitsRes.rows.map((u: any) => [String(u.audit_unit_code).trim().toLowerCase(), Number(u.id)])
    );
    const schemeMap = new Map<string, number>(
      schemesRes.rows.map((s: any) => [String(s.scheme_code).trim().toLowerCase(), Number(s.id)])
    );
    const yearSet = new Set<number>(
      yearsRes.rows.map((y: any) => Number(y.id))
    );

    const errors: string[] = [];
    const consolidatedMap = new Map<string, any>();

    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      const issues: string[] = [];

      const yearId = Number(row?.year_id || 0);
      const auditUnitCodeRaw = String(row?.audit_unit_code || '').trim();
      const glCodeRaw = String(row?.gl_code || '').trim();
      const marchPositionRaw = String(row?.march_position || '').trim();

      if (!yearId) {
        issues.push('Year is required');
      } else if (!yearSet.has(yearId)) {
        issues.push(`Year ID '${yearId}' is invalid`);
      }

      let unitId: number | undefined;
      if (!auditUnitCodeRaw) {
        issues.push('Audit Unit Code is required');
      } else {
        unitId = unitMap.get(auditUnitCodeRaw.toLowerCase());
        if (unitId === undefined) {
          issues.push(`Audit Unit Code '${auditUnitCodeRaw}' not found in master`);
        }
      }

      let finalGlCode: string | undefined;
      if (!glCodeRaw) {
        issues.push('GL Code is required');
      } else {
        const baseSchemeCode = glCodeRaw.replace(/_NPA$/i, '').trim().toLowerCase();
        if (!schemeMap.has(baseSchemeCode)) {
          issues.push(`GL Code '${glCodeRaw}' not found in master`);
        } else {
          finalGlCode = glCodeRaw;
        }
      }

      if (marchPositionRaw === '') {
        issues.push('March Position is required');
      } else if (isNaN(Number(marchPositionRaw))) {
        issues.push('March Position must be a numeric value');
      }

      if (issues.length) {
        errors.push(`Row ${rowNumber}: ${issues.join('; ')}`);
        return;
      }

      const key = `${yearId}-${unitId}-${finalGlCode}`;
      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key);
        existing.march_position = Number(existing.march_position) + Number(marchPositionRaw);
      } else {
        consolidatedMap.set(key, {
          year_id: yearId,
          audit_unit_id: unitId,
          gl_type_id: finalGlCode,
          march_position: Number(marchPositionRaw),
          admin_id: Number(row.admin_id || 1)
        });
      }
    });

    if (errors.length) {
      throw new BadRequestException({ message: 'Bulk Executive Summary validation failed.', errors });
    }

    const finalValidRows = Array.from(consolidatedMap.values());

    return this.db.transaction(async (client) => {
      const data: any[] = [];
      for (const row of finalValidRows) {
        const checkRes = await client.query(
          `SELECT id FROM exe_summary 
           WHERE year_id = $1 AND audit_unit_id = $2 AND gl_type_id = $3 AND deleted_at IS NULL`,
          [row.year_id, row.audit_unit_id, row.gl_type_id]
        );

        if (checkRes.rows.length) {
          const existingId = checkRes.rows[0].id;
          const updateRes = await client.query(
            `UPDATE exe_summary 
             SET march_position = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2
             RETURNING *`,
            [row.march_position, existingId]
          );
          data.push(updateRes.rows[0]);
        } else {
          const insertRes = await client.query(
            `INSERT INTO exe_summary (
              year_id, audit_unit_id, gl_type_id, march_position,
              m_4, m_5, m_6, m_7, m_8, m_9, m_10, m_11, m_12, m_1, m_2, m_3,
              admin_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *`,
            [row.year_id, row.audit_unit_id, row.gl_type_id, row.march_position, row.admin_id]
          );
          data.push(insertRes.rows[0]);
        }
      }
      return { successCount: finalValidRows.length, errors: [], data };
    });
  }

  private async bulkSimpleInsert(config: {
    rows: any[];
    errorMessage: string;
    validate: (client: any) => Promise<Set<string>>;
    getKey: (row: any) => string;
    validateRow: (row: any, index: number, existingKeys: Set<string>, batchKeys: Set<string>) => any;
    insert: (client: any, row: any) => Promise<any>;
  }) {
    const { rows, errorMessage, validate, validateRow, insert } = config;
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException(errorMessage);
    }

    return this.db.transaction(async (client) => {
      const existingKeys = await validate(client);
      const batchKeys = new Set<string>();
      const validRows: any[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const validated = validateRow(row, index, existingKeys, batchKeys);
        if (validated.errors.length) {
          errors.push(`Row ${validated.rowNumber}: ${validated.errors.join('; ')}`);
          return;
        }
        batchKeys.add(validated.key);
        validRows.push({ ...row, ...validated });
      });

      if (errors.length) {
        throw new BadRequestException({ message: 'Bulk validation failed.', errors });
      }

      const data: any[] = [];
      for (const row of validRows) {
        const result = await insert(client, row);
        data.push(result.rows?.[0] ?? result);
      }

      return { successCount: data.length, errors: [], data };
    });
  }
}
