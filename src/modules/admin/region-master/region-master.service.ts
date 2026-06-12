import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region-master.dto';

@Injectable()
export class RegionMasterService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const regions = await this.db.query(`
      SELECT id, region_name, audit_unit_ids, is_active
      FROM region_master
      WHERE deleted_at IS NULL
      ORDER BY region_name ASC, id DESC
    `);

    const units = await this.db.query(`
      SELECT id, name, audit_unit_code
      FROM audit_unit_master
      WHERE deleted_at IS NULL
    `);

    const unitsMap = new Map(units.rows.map((u: any) => [u.id, u]));

    return regions.rows.map((r: any) => {
      const unitIds = String(r.audit_unit_ids || '')
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);

      const mappedUnits = unitIds
        .map((id) => unitsMap.get(id))
        .filter(Boolean);

      return {
        ...r,
        unit_ids: unitIds,
        units: mappedUnits,
      };
    });
  }

  async findUniqueNames() {
    const result = await this.db.query(`
      SELECT DISTINCT region_name
      FROM region_master
      WHERE deleted_at IS NULL AND is_active = 1
      ORDER BY region_name ASC
    `);
    return result.rows.map((r: any) => r.region_name);
  }

  async findOne(id: number) {
    const row = await this.db.findOne(`
      SELECT * FROM region_master WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    if (!row) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    
    const unitIds = String(row.audit_unit_ids || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => !isNaN(id) && id > 0);

    return {
      ...row,
      unit_ids: unitIds
    };
  }

  async create(data: CreateRegionDto) {
    // Check if duplicate region name exists
    const existing = await this.db.findOne(`
      SELECT id FROM region_master
      WHERE LOWER(TRIM(region_name)) = LOWER(TRIM($1))
        AND deleted_at IS NULL
    `, [data.region_name]);

    if (existing) {
      throw new BadRequestException('Region name already exists');
    }

    const auditUnitIdsStr = (data.unit_ids || []).join(',');

    const result = await this.db.query(`
      INSERT INTO region_master (region_name, audit_unit_ids, is_active, admin_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      data.region_name.trim(),
      auditUnitIdsStr,
      data.is_active ?? 1,
      data.admin_id ?? 1
    ]);

    return result.rows[0];
  }

  async update(id: number, data: UpdateRegionDto) {
    const region = await this.findOne(id);

    if (data.region_name !== undefined) {
      const existing = await this.db.findOne(`
        SELECT id FROM region_master
        WHERE LOWER(TRIM(region_name)) = LOWER(TRIM($1))
          AND id != $2
          AND deleted_at IS NULL
      `, [data.region_name.trim(), id]);

      if (existing) {
        throw new BadRequestException('Region name already exists');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const addUpdate = (field: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(value);
      }
    };

    if (data.region_name !== undefined) {
      addUpdate('region_name', data.region_name.trim());
    }

    if (data.unit_ids !== undefined) {
      addUpdate('audit_unit_ids', data.unit_ids.join(','));
    }

    addUpdate('is_active', data.is_active);
    addUpdate('admin_id', data.admin_id ?? 1);

    if (updates.length === 0) {
      return this.findOne(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE region_master
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async toggleStatus(id: number) {
    await this.findOne(id);
    const result = await this.db.query(`
      UPDATE region_master
      SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    return result.rows[0];
  }

  async softDelete(id: number) {
    await this.findOne(id);
    await this.db.query(`
      UPDATE region_master
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
    return { deleted: true };
  }
}
