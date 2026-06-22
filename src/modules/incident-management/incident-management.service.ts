import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/incident.dto';

@Injectable()
export class IncidentManagementService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateIncidentDto, employeeId: number) {
    try {
      const query = `
        INSERT INTO incident_management (
          audit_unit_id,
          incident_type,
          description,
          reported_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const values = [
        dto.audit_unit_id,
        dto.incident_type,
        dto.description,
        employeeId
      ];
      const result = await this.db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Failed to create incident:', error);
      throw new BadRequestException('Failed to create incident');
    }
  }

  async findAll(employeeId: number) {
    try {
      const empQuery = `SELECT user_type_id, region_name, audit_unit_authority FROM employee_master WHERE id = $1 AND deleted_at IS NULL`;
      const empResult = await this.db.query(empQuery, [employeeId]);
      if (!empResult.rows.length) {
        return [];
      }
      const emp = empResult.rows[0];
      const userTypeId = Number(emp.user_type_id || 0);

      // Admin (1), Top Level Management (5), Division/Auditor-in-charge (9) see all incidents
      if (userTypeId === 1 || userTypeId === 5 || userTypeId === 9) {
        const query = `
          SELECT 
            im.*, 
            au.name as audit_unit_name, 
            au.audit_unit_code,
            em.name as reported_by_name
          FROM incident_management im
          LEFT JOIN audit_unit_master au ON im.audit_unit_id = au.id
          LEFT JOIN employee_master em ON im.reported_by = em.id
          WHERE im.deleted_at IS NULL
          ORDER BY im.id DESC
        `;
        const res = await this.db.query(query);
        return res.rows;
      }

      // Reviewer (4) sees incidents for branches in their assigned region/authority
      if (userTypeId === 4) {
        let unitIds: number[] = [];
        const regionName = emp.region_name || '';
        if (regionName) {
          const regionQuery = `
            SELECT audit_unit_ids 
            FROM region_master 
            WHERE LOWER(TRIM(region_name)) = LOWER(TRIM($1)) 
              AND deleted_at IS NULL
          `;
          const regionResult = await this.db.query(regionQuery, [regionName]);
          if (regionResult.rows.length) {
            const unitIdsStr = regionResult.rows[0].audit_unit_ids || '';
            unitIds = unitIdsStr
              .split(',')
              .map(id => parseInt(id, 10))
              .filter(id => !isNaN(id));
          }
        }

        const authorityStr = emp.audit_unit_authority || '';
        if (authorityStr) {
          const authIds = authorityStr
            .split(',')
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));
          authIds.forEach(id => {
            if (!unitIds.includes(id)) {
              unitIds.push(id);
            }
          });
        }

        if (!unitIds.length) {
          return [];
        }

        const query = `
          SELECT 
            im.*, 
            au.name as audit_unit_name, 
            au.audit_unit_code,
            em.name as reported_by_name
          FROM incident_management im
          LEFT JOIN audit_unit_master au ON im.audit_unit_id = au.id
          LEFT JOIN employee_master em ON im.reported_by = em.id
          WHERE im.audit_unit_id = ANY($1) AND im.deleted_at IS NULL
          ORDER BY im.id DESC
        `;
        const res = await this.db.query(query, [unitIds]);
        return res.rows;
      }

      // Managers (3) and Auditors (2) see only incidents reported by themselves
      const query = `
        SELECT 
          im.*, 
          au.name as audit_unit_name, 
          au.audit_unit_code,
          em.name as reported_by_name
        FROM incident_management im
        LEFT JOIN audit_unit_master au ON im.audit_unit_id = au.id
        LEFT JOIN employee_master em ON im.reported_by = em.id
        WHERE im.reported_by = $1 
          AND im.deleted_at IS NULL
        ORDER BY im.id DESC
      `;
      const res = await this.db.query(query, [employeeId]);
      return res.rows;
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
      throw new BadRequestException('Failed to fetch incidents');
    }
  }

  async findOne(id: number) {
    const query = `
      SELECT 
        im.*, 
        au.name as audit_unit_name, 
        au.audit_unit_code,
        em.name as reported_by_name
      FROM incident_management im
      LEFT JOIN audit_unit_master au ON im.audit_unit_id = au.id
      LEFT JOIN employee_master em ON im.reported_by = em.id
      WHERE im.id = $1 AND im.deleted_at IS NULL
    `;
    const res = await this.db.query(query, [id]);
    if (!res.rows.length) {
      throw new NotFoundException('Incident not found');
    }
    return res.rows[0];
  }

  async update(id: number, dto: UpdateIncidentDto) {
    try {
      const existing = await this.findOne(id);
      
      const auditUnitId = dto.audit_unit_id ?? existing.audit_unit_id;
      const incidentType = dto.incident_type ?? existing.incident_type;
      const description = dto.description ?? existing.description;

      const query = `
        UPDATE incident_management
        SET 
          audit_unit_id = $2,
          incident_type = $3,
          description = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `;
      const result = await this.db.query(query, [id, auditUnitId, incidentType, description]);
      return result.rows[0];
    } catch (error) {
      console.error('Failed to update incident:', error);
      throw new BadRequestException('Failed to update incident');
    }
  }

  async remove(id: number) {
    const query = `
      UPDATE incident_management 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    await this.db.query(query, [id]);
    return { success: true };
  }
}
