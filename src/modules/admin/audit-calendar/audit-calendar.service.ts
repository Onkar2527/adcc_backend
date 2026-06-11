import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { CreateAuditCalendarDto, UpdateAuditCalendarDto } from './dto/audit-calendar.dto';

interface CalendarRow {
  id: number;
  audit_unit_id: number;
  audit_scheme_id: number;
  auditor_id: number;
  start_date: string;
  end_date: string;
  status: string;
  remarks: string | null;
  is_active: number;
  audit_unit_name?: string;
  audit_unit_code?: string;
  scheme_name?: string;
  scheme_code?: string;
  auditor_name?: string;
  auditor_code?: string;
}

@Injectable()
export class AuditCalendarService {
  constructor(private readonly db: DatabaseService) {}

  private async queryRows<T>(query: string, params: any[] = []): Promise<T[]> {
    const result = await this.db.query(query, params);
    return result.rows as T[];
  }

  private async queryOne<T>(query: string, params: any[] = []): Promise<T | null> {
    const rows = await this.queryRows<T>(query, params);
    return rows[0] ?? null;
  }

  async findAll(): Promise<CalendarRow[]> {
    try {
      // Diagnostics: Write columns of audit_assesment_master to columns.txt
      try {
        const colRes = await this.db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'audit_assesment_master'
        `);
        const fsLib = require('fs');
        const pathLib = require('path');
        fsLib.writeFileSync(
          pathLib.join(process.cwd(), 'columns.txt'),
          JSON.stringify(colRes.rows, null, 2)
        );
      } catch (err) {
        console.error('Diag failed:', err);
      }

      return this.queryRows<CalendarRow>(`
        SELECT 
          ac.*,
          au.name AS audit_unit_name,
          au.audit_unit_code,
          sm.name AS scheme_name,
          sm.scheme_code,
          em.name AS auditor_name,
          em.emp_code AS auditor_code
        FROM audit_calendar ac
        LEFT JOIN audit_unit_master au ON au.id = ac.audit_unit_id
        LEFT JOIN scheme_master sm ON sm.id = ac.audit_scheme_id
        LEFT JOIN employee_master em ON em.id = ac.auditor_id
        WHERE ac.deleted_at IS NULL
        ORDER BY ac.id DESC
      `);
    } catch (error) {
      throw new BadRequestException('Failed to fetch audit calendar schedules');
    }
  }

  async findOne(id: number): Promise<CalendarRow> {
    const row = await this.queryOne<CalendarRow>(`
      SELECT 
        ac.*,
        au.name AS audit_unit_name,
        au.audit_unit_code,
        sm.name AS scheme_name,
        sm.scheme_code,
        em.name AS auditor_name,
        em.emp_code AS auditor_code
      FROM audit_calendar ac
      LEFT JOIN audit_unit_master au ON au.id = ac.audit_unit_id
      LEFT JOIN scheme_master sm ON sm.id = ac.audit_scheme_id
      LEFT JOIN employee_master em ON em.id = ac.auditor_id
      WHERE ac.id = $1 AND ac.deleted_at IS NULL
    `, [id]);

    if (!row) {
      throw new NotFoundException('Audit calendar schedule not found');
    }

    return row;
  }

  async getLookups() {
    try {
      const units = await this.queryRows(`
        SELECT id, name, audit_unit_code 
        FROM audit_unit_master 
        WHERE is_active = 1 AND deleted_at IS NULL 
        ORDER BY name ASC
      `);

      const schemes = await this.queryRows(`
        SELECT id, name, scheme_code 
        FROM scheme_master 
        WHERE is_active = 1 AND deleted_at IS NULL 
        ORDER BY name ASC
      `);

      const auditors = await this.queryRows(`
        SELECT id, name, emp_code 
        FROM employee_master 
        WHERE user_type_id = 2 AND is_active = 1 AND deleted_at IS NULL 
        ORDER BY name ASC
      `);

      return { units, schemes, auditors };
    } catch (error) {
      throw new BadRequestException('Failed to fetch lookups');
    }
  }

  async validateSchedule(
    auditorId: number,
    startDateStr: string,
    endDateStr: string,
    excludeId?: number
  ) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Check for overlapping bookings for the same auditor
    let query = `
      SELECT ac.id, au.name AS audit_unit_name, ac.start_date, ac.end_date
      FROM audit_calendar ac
      LEFT JOIN audit_unit_master au ON au.id = ac.audit_unit_id
      WHERE ac.auditor_id = $1 
        AND ac.deleted_at IS NULL 
        AND NOT (ac.end_date < $2::date OR ac.start_date > $3::date)
    `;
    const params: any[] = [auditorId, startDateStr, endDateStr];

    if (excludeId) {
      query += ` AND ac.id != $4`;
      params.push(excludeId);
    }

    const overlap = await this.queryOne<{ id: number; audit_unit_name: string; start_date: Date; end_date: Date }>(query, params);
    if (overlap) {
      const startFormatted = new Date(overlap.start_date).toLocaleDateString();
      const endFormatted = new Date(overlap.end_date).toLocaleDateString();
      throw new BadRequestException(
        `Auditor is already scheduled for audit at "${overlap.audit_unit_name}" from ${startFormatted} to ${endFormatted}`
      );
    }
  }

  async create(data: CreateAuditCalendarDto) {
    await this.validateSchedule(data.auditor_id, data.start_date, data.end_date);

    try {
      const row = await this.queryOne<CalendarRow>(`
        INSERT INTO audit_calendar (
          audit_unit_id,
          audit_scheme_id,
          auditor_id,
          start_date,
          end_date,
          status,
          remarks,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        data.audit_unit_id,
        data.audit_scheme_id,
        data.auditor_id,
        new Date(data.start_date),
        new Date(data.end_date),
        data.status ?? 'Scheduled',
        data.remarks ?? null,
        data.is_active ?? 1
      ]);

      return row;
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to create audit calendar schedule');
    }
  }

  async update(id: number, data: UpdateAuditCalendarDto) {
    const existing = await this.findOne(id);

    const auditorId = data.auditor_id ?? existing.auditor_id;
    const startDate = data.start_date ?? existing.start_date;
    const endDate = data.end_date ?? existing.end_date;

    await this.validateSchedule(auditorId, startDate, endDate, id);

    try {
      const row = await this.queryOne<CalendarRow>(`
        UPDATE audit_calendar
        SET
          audit_unit_id = $1,
          audit_scheme_id = $2,
          auditor_id = $3,
          start_date = $4,
          end_date = $5,
          status = $6,
          remarks = $7,
          is_active = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *
      `, [
        data.audit_unit_id ?? existing.audit_unit_id,
        data.audit_scheme_id ?? existing.audit_scheme_id,
        data.auditor_id ?? existing.auditor_id,
        new Date(startDate),
        new Date(endDate),
        data.status ?? existing.status,
        data.remarks !== undefined ? data.remarks : existing.remarks,
        data.is_active ?? existing.is_active,
        id
      ]);

      return row;
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to update audit calendar schedule');
    }
  }

  async toggleStatus(id: number) {
    await this.findOne(id);
    return this.queryOne(`
      UPDATE audit_calendar
      SET 
        is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.db.query(`
      UPDATE audit_calendar
      SET 
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
    return { success: true };
  }

  async ensureFrequencyMasterTable() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS audit_frequency_master (
        id SERIAL PRIMARY KEY,
        risk_type_id INTEGER NOT NULL UNIQUE,
        frequency INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        admin_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      )
    `);

    const countRes = await this.db.query(`SELECT COUNT(*) FROM audit_frequency_master`);
    if (Number(countRes.rows[0].count) === 0) {
      await this.db.query(`
        INSERT INTO audit_frequency_master (risk_type_id, frequency) VALUES
        (1, 6),
        (2, 12),
        (3, 18)
      `);
    }
  }

  async getSchedulingData() {
    try {
      await this.ensureFrequencyMasterTable();
      // 1. Fetch active units
      const units = await this.queryRows<any>(`
        SELECT id, name, audit_unit_code, last_audit_date, frequency
        FROM audit_unit_master
        WHERE is_active = 1 AND deleted_at IS NULL
        ORDER BY name ASC
      `);

      // 2. Fetch completed assessments with weighted scores
      const assessments = await this.queryRows<any>(`
        SELECT 
          asm.id,
          asm.audit_unit_id,
          asm.year_id,
          rsm.weighted_score
        FROM audit_assesment_master asm
        INNER JOIN report_scoring_master rsm ON rsm.assesment_id = asm.id
        WHERE asm.deleted_at IS NULL AND rsm.deleted_at IS NULL
      `);

      // 3. Fetch risk_branch_rating range limits
      const ratings = await this.queryRows<any>(`
        SELECT audit_unit_id, year_id, risk_type_id, range_from, range_to
        FROM risk_branch_rating
        WHERE deleted_at IS NULL
      `);

      // 4. Fetch dynamic frequencies from audit_frequency_master
      const frequencySettings = await this.queryRows<any>(`
        SELECT risk_type_id, frequency 
        FROM audit_frequency_master 
        WHERE is_active = 1 AND deleted_at IS NULL
      `);

      const freqMap = new Map<number, number>();
      freqMap.set(1, 6);
      freqMap.set(2, 12);
      freqMap.set(3, 18);
      frequencySettings.forEach((f: any) => {
        freqMap.set(Number(f.risk_type_id), Number(f.frequency));
      });

      // Group ratings by key: `${unitId}:${yearId}`
      const ratingsMap = new Map<string, any[]>();
      ratings.forEach((r: any) => {
        const key = `${r.audit_unit_id}:${r.year_id}`;
        if (!ratingsMap.has(key)) {
          ratingsMap.set(key, []);
        }
        ratingsMap.get(key)!.push(r);
      });

      // Calculate sum of weighted_score per year_id to calculate the share percentage
      const yearTotals = new Map<number, number>();
      assessments.forEach((a: any) => {
        const yId = Number(a.year_id || 0);
        const score = Number(a.weighted_score || 0);
        yearTotals.set(yId, (yearTotals.get(yId) || 0) + score);
      });

      // Function to match risk label by percent
      const matchRating = (score: number, unitId: number, yearId: number): number => {
        const key = `${unitId}:${yearId}`;
        const unitYearRatings = ratingsMap.get(key) || [];
        
        for (const rating of unitYearRatings) {
          const upperBound = Number(rating.range_from || 0);
          const lowerBound = Number(rating.range_to || 0);
          if (score <= upperBound && score > lowerBound) {
            return Number(rating.risk_type_id); // 1 = High, 2 = Medium, 3 = Low
          }
        }
        // Fallback defaults if no range matched or defined
        if (score >= 3.0) return 1; // High
        if (score >= 2.0) return 2; // Medium
        return 3; // Low
      };

      // Group assessments by unitId
      const assessmentsByUnit = new Map<number, any[]>();
      assessments.forEach((a: any) => {
        const uId = Number(a.audit_unit_id);
        if (!assessmentsByUnit.has(uId)) {
          assessmentsByUnit.set(uId, []);
        }
        assessmentsByUnit.get(uId)!.push(a);
      });

      const results = units.map((unit) => {
        const unitId = Number(unit.id);
        const unitAssessments = assessmentsByUnit.get(unitId) || [];
        
        let high = 0;
        let medium = 0;
        let low = 0;
        let totalScore = 0;

        unitAssessments.forEach((a: any) => {
          const yId = Number(a.year_id || 0);
          const score = Number(a.weighted_score || 0);
          const yearTotal = yearTotals.get(yId) || 1;
          const percentShare = yearTotal > 0 ? (score / yearTotal) * 100 : 0;
          
          const riskTypeId = matchRating(percentShare, unitId, yId);
          if (riskTypeId === 1) {
            high++;
            totalScore += 3;
          } else if (riskTypeId === 2) {
            medium++;
            totalScore += 2;
          } else {
            low++;
            totalScore += 1;
          }
        });

        const totalCount = unitAssessments.length;
        const riskAverage = totalCount > 0 ? Number((totalScore / totalCount).toFixed(2)) : 0;

        let finalRisk = 'LOW';
        let recommendedFrequency = 3;
        let frequencyMonths = freqMap.get(3) || 18;

        if (riskAverage >= 2.5) {
          finalRisk = 'HIGH';
          recommendedFrequency = 1;
          frequencyMonths = freqMap.get(1) || 6;
        } else if (riskAverage >= 1.5) {
          finalRisk = 'MEDIUM';
          recommendedFrequency = 2;
          frequencyMonths = freqMap.get(2) || 12;
        }

        // Schedule dates from last_audit_date
        const lastAuditDate = unit.last_audit_date;
        let assessmentPeriodFrom = '';
        let assessmentPeriodTo = '';
        let auditDueDate = '';
        let complianceDueDate = '';

        if (lastAuditDate) {
          const lastAudit = new Date(lastAuditDate);
          
          // assessmentPeriodFrom = last_audit_date + 1 day
          const fromDate = new Date(lastAudit);
          fromDate.setDate(fromDate.getDate() + 1);
          assessmentPeriodFrom = fromDate.toISOString().split('T')[0];

          // assessmentPeriodTo = end of month after frequency months from fromDate
          const toDate = new Date(fromDate);
          toDate.setMonth(toDate.getMonth() + frequencyMonths);
          toDate.setDate(0); // Sets to the last day of previous month
          assessmentPeriodTo = toDate.toISOString().split('T')[0];

          // auditDueDate = assessmentPeriodTo + 20 days
          const auditDue = new Date(toDate);
          auditDue.setDate(auditDue.getDate() + 20);
          auditDueDate = auditDue.toISOString().split('T')[0];

          // complianceDueDate = auditDueDate + 20 days
          const complianceDue = new Date(auditDue);
          complianceDue.setDate(complianceDue.getDate() + 20);
          complianceDueDate = complianceDue.toISOString().split('T')[0];
        }

        return {
          audit_unit_id: unitId,
          audit_unit_name: unit.name,
          audit_unit_code: unit.audit_unit_code,
          total_assessments: totalCount,
          high_count: high,
          medium_count: medium,
          low_count: low,
          risk_average: riskAverage,
          final_risk: finalRisk,
          recommended_frequency: recommendedFrequency,
          frequency_months: frequencyMonths,
          frequency: unit.frequency,
          last_audit_date: lastAuditDate ? lastAuditDate.toISOString().split('T')[0] : null,
          assessment_period_from: assessmentPeriodFrom,
          assessment_period_to: assessmentPeriodTo,
          audit_due_date: auditDueDate,
          compliance_due_date: complianceDueDate
        };
      });

      return {
        risk_summary_data: results,
        risk_frequencies: frequencySettings
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to fetch calculated audit calendar scheduling');
    }
  }

  async setFrequencies(body: { frequencies: Record<string, number> }) {
    if (!body?.frequencies || typeof body.frequencies !== 'object') {
      throw new BadRequestException('Frequencies object is required');
    }

    try {
      await this.db.transaction(async (client) => {
        for (const [unitId, freq] of Object.entries(body.frequencies)) {
          const frequencyValue = freq ? Number(freq) : null;
          await client.query(`
            UPDATE audit_unit_master 
            SET frequency = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND deleted_at IS NULL
          `, [frequencyValue, Number(unitId)]);
        }
      });
      return { success: true, message: 'Successfully updated audit frequencies' };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to update audit frequencies');
    }
  }

  async getRiskFrequencies() {
    await this.ensureFrequencyMasterTable();
    return this.queryRows<any>(`
      SELECT risk_type_id, frequency 
      FROM audit_frequency_master 
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY risk_type_id ASC
    `);
  }

  async updateRiskFrequencies(body: { frequencies: { risk_type_id: number; frequency: number }[] }) {
    if (!body?.frequencies || !Array.isArray(body.frequencies)) {
      throw new BadRequestException('Frequencies array is required');
    }
    await this.ensureFrequencyMasterTable();
    try {
      await this.db.transaction(async (client) => {
        for (const item of body.frequencies) {
          const { risk_type_id, frequency } = item;
          await client.query(`
            INSERT INTO audit_frequency_master (risk_type_id, frequency)
            VALUES ($1, $2)
            ON CONFLICT (risk_type_id)
            DO UPDATE SET frequency = $2, updated_at = CURRENT_TIMESTAMP
          `, [Number(risk_type_id), Number(frequency)]);
        }
      });
      return { success: true, message: 'Successfully updated risk frequencies' };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to update risk frequencies');
    }
  }
}

