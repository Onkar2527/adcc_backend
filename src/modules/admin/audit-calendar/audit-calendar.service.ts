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

  private parseDateUTC(dateVal: any): Date {
    if (dateVal instanceof Date) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(dateVal);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      if (year && month && day) {
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      }
    }
    const str = String(dateVal);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    }
    return new Date(str);
  }

  private formatDateUTC(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
        audit_due_days INTEGER DEFAULT 20,
        compliance_due_days INTEGER DEFAULT 20,
        is_active INTEGER DEFAULT 1,
        admin_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      )
    `);

    // Ensure columns exist (in case table was created previously without them)
    await this.db.query(`
      ALTER TABLE audit_frequency_master ADD COLUMN IF NOT EXISTS audit_due_days INTEGER DEFAULT 20;
      ALTER TABLE audit_frequency_master ADD COLUMN IF NOT EXISTS compliance_due_days INTEGER DEFAULT 20;
    `);

    const countRes = await this.db.query(`SELECT COUNT(*) FROM audit_frequency_master`);
    if (Number(countRes.rows[0].count) === 0) {
      await this.db.query(`
        INSERT INTO audit_frequency_master (risk_type_id, frequency, audit_due_days, compliance_due_days) VALUES
        (1, 6, 20, 20),
        (2, 12, 20, 20),
        (3, 18, 20, 20)
      `);
    }
  }

  async getSchedulingData(userId?: number, userTypeId?: number, auditUnitAuthority?: string) {
    try {
      await this.ensureFrequencyMasterTable();
      // 1. Fetch active units
      let queryStr = `
        SELECT id, name, audit_unit_code, last_audit_date, frequency
        FROM audit_unit_master
        WHERE is_active = 1 AND deleted_at IS NULL
      `;
      const queryParams: any[] = [];

      if (
        userId
        && userTypeId
        && ![1, 5].includes(userTypeId)
      ) {
        if (auditUnitAuthority && auditUnitAuthority.trim() !== '') {
          const unitIds = auditUnitAuthority.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
          if (unitIds.length > 0) {
            queryStr += ` AND id = ANY($1::bigint[])`;
            queryParams.push(unitIds);
          } else {
            queryStr += ` AND 1 = 0`;
          }
        } else {
          if (userTypeId === 2) {
            // Auditor
            queryStr += ` AND id IN (
              SELECT DISTINCT audit_unit_id 
              FROM audit_assesment_master 
              WHERE audit_emp_id = $1 AND deleted_at IS NULL
            )`;
            queryParams.push(userId);
          } else if (userTypeId === 3) {
            // Employee
            queryStr += ` AND id IN (
              SELECT DISTINCT audit_unit_id 
              FROM audit_assesment_master 
              WHERE compliance_emp_id = $1 AND deleted_at IS NULL
            )`;
            queryParams.push(userId);
          } else if (userTypeId === 4) {
            // Reviewer
            queryStr += ` AND id IN (
              SELECT DISTINCT audit_unit_id 
              FROM audit_assesment_master 
              WHERE audit_review_emp_id = $1 AND deleted_at IS NULL
            )`;
            queryParams.push(userId);
          }
        }
      }

      queryStr += ` ORDER BY name ASC`;

      const units = await this.queryRows<any>(queryStr, queryParams);

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
        SELECT risk_type_id, frequency, audit_due_days, compliance_due_days
        FROM audit_frequency_master 
        WHERE is_active = 1 AND deleted_at IS NULL
      `);

      const freqMap = new Map<number, number>();
      const auditDueDaysMap = new Map<number, number>();
      const complianceDueDaysMap = new Map<number, number>();

      freqMap.set(1, 6);
      freqMap.set(2, 12);
      freqMap.set(3, 18);

      auditDueDaysMap.set(1, 20);
      auditDueDaysMap.set(2, 20);
      auditDueDaysMap.set(3, 20);

      complianceDueDaysMap.set(1, 20);
      complianceDueDaysMap.set(2, 20);
      complianceDueDaysMap.set(3, 20);

      frequencySettings.forEach((f: any) => {
        freqMap.set(Number(f.risk_type_id), Number(f.frequency));
        auditDueDaysMap.set(Number(f.risk_type_id), Number(f.audit_due_days || 20));
        complianceDueDaysMap.set(Number(f.risk_type_id), Number(f.compliance_due_days || 20));
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
          const lowerBound = Number(rating.range_from || 0);
          const upperBound = Number(rating.range_to || 0);
          if (score >= lowerBound && score <= upperBound) {
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

      // Fetch actual assessments
      const actualAssessments = await this.queryRows<any>(`
        SELECT 
          id, 
          audit_unit_id, 
          assesment_period_from, 
          assesment_period_to, 
          audit_start_date, 
          audit_end_date, 
          audit_due_date, 
          compliance_due_date, 
          audit_status_id
        FROM audit_assesment_master
        WHERE deleted_at IS NULL
        ORDER BY assesment_period_to ASC
      `);

      const actualAssessmentsMap = new Map<number, any[]>();
      actualAssessments.forEach((asm: any) => {
        const uId = Number(asm.audit_unit_id);
        if (!actualAssessmentsMap.has(uId)) {
          actualAssessmentsMap.set(uId, []);
        }
        actualAssessmentsMap.get(uId)!.push(asm);
      });

      const projectedSchedules: any[] = [];

      units.forEach((unit) => {
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
        let frequencyMonths = freqMap.get(3) || 18;

        if (riskAverage >= 2.5) {
          finalRisk = 'HIGH';
          frequencyMonths = freqMap.get(1) || 6;
        } else if (riskAverage >= 1.5) {
          finalRisk = 'MEDIUM';
          frequencyMonths = freqMap.get(2) || 12;
        }

        const activeFrequencyMonths = unit.frequency ? Number(unit.frequency) : frequencyMonths;
        const lastAuditDate = unit.last_audit_date;
        
        const riskTypeIdForOffsets = finalRisk === 'HIGH' ? 1 : finalRisk === 'MEDIUM' ? 2 : 3;
        const currentAuditDueDays = auditDueDaysMap.get(riskTypeIdForOffsets) || 20;
        const currentComplianceDueDays = complianceDueDaysMap.get(riskTypeIdForOffsets) || 20;

        let currentLastAudit: Date | null = null;
        let firstPeriodFrom: Date | null = null;

        const unitActuals = actualAssessmentsMap.get(unitId) || [];

        // Track first period start date
        if (unitActuals.length > 0) {
          const firstAsm = unitActuals[0];
          if (firstAsm.assesment_period_from) {
            firstPeriodFrom = this.parseDateUTC(firstAsm.assesment_period_from);
          }
        } else if (lastAuditDate) {
          firstPeriodFrom = this.parseDateUTC(lastAuditDate);
          firstPeriodFrom.setUTCDate(firstPeriodFrom.getUTCDate() + 1);
        }

        if (firstPeriodFrom) {
          let iteration = 0;
          const currentSlotStart = new Date(firstPeriodFrom);
          let currentActualIndex = 0;
          
          const today = new Date();
          const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

          while (iteration < 12) {
            const pStartYear = currentSlotStart.getUTCMonth() >= 3 ? currentSlotStart.getUTCFullYear() : currentSlotStart.getUTCFullYear() - 1;
            const pFyEnd = new Date(currentSlotStart);
            pFyEnd.setUTCFullYear(pStartYear + 1);
            pFyEnd.setUTCMonth(2); // March
            pFyEnd.setUTCDate(31);

            if (currentSlotStart > pFyEnd) {
              break;
            }

            // 1. If there's a corresponding actual assessment record, use its actual dates
            if (currentActualIndex < unitActuals.length) {
              const asm = unitActuals[currentActualIndex];
              const asmFrom = asm.assesment_period_from ? this.formatDateUTC(this.parseDateUTC(asm.assesment_period_from)) : '';
              const asmTo = asm.assesment_period_to ? this.formatDateUTC(this.parseDateUTC(asm.assesment_period_to)) : '';
              
              let asmAuditDue = '';
              if (asm.audit_end_date) {
                asmAuditDue = this.formatDateUTC(this.parseDateUTC(asm.audit_end_date));
              } else if (asm.audit_due_date) {
                asmAuditDue = this.formatDateUTC(this.parseDateUTC(asm.audit_due_date));
              } else if (asmTo) {
                const d = this.parseDateUTC(asmTo);
                d.setUTCDate(d.getUTCDate() + currentAuditDueDays);
                asmAuditDue = this.formatDateUTC(d);
              }

              let asmComplianceDue = '';
              if (asm.compliance_due_date) {
                asmComplianceDue = this.formatDateUTC(this.parseDateUTC(asm.compliance_due_date));
              } else if (asmAuditDue) {
                const d = this.parseDateUTC(asmAuditDue);
                d.setUTCDate(d.getUTCDate() + currentComplianceDueDays);
                asmComplianceDue = this.formatDateUTC(d);
              }

              projectedSchedules.push({
                audit_unit_id: unitId,
                audit_unit_name: unit.name,
                audit_unit_code: unit.audit_unit_code,
                final_risk: finalRisk,
                assessment_period_from: asmFrom,
                assessment_period_to: asmTo,
                audit_due_date: asmAuditDue,
                compliance_due_date: asmComplianceDue,
                frequency: activeFrequencyMonths,
                is_actual: true,
                status_id: asm.audit_status_id,
                status: Number(asm.audit_status_id) >= 4 ? 'Completed' : 'Started'
              });

              if (asmAuditDue) {
                currentLastAudit = this.parseDateUTC(asmAuditDue);
              }

              currentActualIndex++;
              currentSlotStart.setUTCMonth(currentSlotStart.getUTCMonth() + activeFrequencyMonths);
              currentSlotStart.setUTCDate(1);
              iteration++;
              continue;
            }

            // 2. Compute normal target boundaries for this slot
            let normalSlotTo = new Date(currentSlotStart);
            normalSlotTo.setUTCMonth(normalSlotTo.getUTCMonth() + activeFrequencyMonths);
            normalSlotTo.setUTCDate(0);

            if (normalSlotTo > pFyEnd) {
              normalSlotTo = pFyEnd;
            }

            // 3. Past slot with no audit is marked Expired
            if (normalSlotTo < todayUTC) {
              const pFromStr = this.formatDateUTC(currentSlotStart);
              const pToStr = this.formatDateUTC(normalSlotTo);
              
              const pAudit = new Date(normalSlotTo);
              pAudit.setUTCDate(pAudit.getUTCDate() + currentAuditDueDays);

              const pCompliance = new Date(pAudit);
              pCompliance.setUTCDate(pCompliance.getUTCDate() + currentComplianceDueDays);

              projectedSchedules.push({
                audit_unit_id: unitId,
                audit_unit_name: unit.name,
                audit_unit_code: unit.audit_unit_code,
                final_risk: finalRisk,
                assessment_period_from: pFromStr,
                assessment_period_to: pToStr,
                audit_due_date: this.formatDateUTC(pAudit),
                compliance_due_date: this.formatDateUTC(pCompliance),
                frequency: activeFrequencyMonths,
                status: 'Expired'
              });

              currentSlotStart.setUTCMonth(currentSlotStart.getUTCMonth() + activeFrequencyMonths);
              currentSlotStart.setUTCDate(1);
              iteration++;
              continue;
            }

            // 4. Current or future slot shifts start date based on previous delay
            let pFrom = new Date(currentSlotStart);
            if (currentLastAudit) {
              pFrom = new Date(currentLastAudit);
              pFrom.setUTCDate(pFrom.getUTCDate() + 1);
            }

            let pTo = new Date(pFrom);
            pTo.setUTCMonth(pTo.getUTCMonth() + activeFrequencyMonths);
            pTo.setUTCDate(0);

            const diffTime = pTo.getTime() - pFrom.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays < 15) {
              pTo = new Date(pFrom);
              pTo.setUTCMonth(pTo.getUTCMonth() + activeFrequencyMonths + 1);
              pTo.setUTCDate(0);
            }

            if (pTo > pFyEnd) {
              pTo = pFyEnd;
            }

            const pAudit = new Date(pTo);
            pAudit.setUTCDate(pAudit.getUTCDate() + currentAuditDueDays);

            const pCompliance = new Date(pAudit);
            pCompliance.setUTCDate(pCompliance.getUTCDate() + currentComplianceDueDays);

            const isDelayed = currentLastAudit && pFrom.getTime() !== currentSlotStart.getTime();

            projectedSchedules.push({
              audit_unit_id: unitId,
              audit_unit_name: unit.name,
              audit_unit_code: unit.audit_unit_code,
              final_risk: finalRisk,
              assessment_period_from: this.formatDateUTC(pFrom),
              assessment_period_to: this.formatDateUTC(pTo),
              audit_due_date: this.formatDateUTC(pAudit),
              compliance_due_date: this.formatDateUTC(pCompliance),
              frequency: activeFrequencyMonths,
              status: 'Not Started'
            });

            currentLastAudit = pTo;
            currentSlotStart.setUTCMonth(currentSlotStart.getUTCMonth() + activeFrequencyMonths);
            currentSlotStart.setUTCDate(1);
            iteration++;
          }
        }
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

        const unitSchedules = projectedSchedules.filter((p) => p.audit_unit_id === unitId);
        const currentCycle = unitSchedules[0];

        let assessmentPeriodFrom = '';
        let assessmentPeriodTo = '';
        let auditDueDate = '';
        let complianceDueDate = '';

        if (currentCycle) {
          assessmentPeriodFrom = currentCycle.assessment_period_from;
          assessmentPeriodTo = currentCycle.assessment_period_to;
          auditDueDate = currentCycle.audit_due_date;
          complianceDueDate = currentCycle.compliance_due_date;
        }

        const lastAuditDate = unit.last_audit_date;

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
          last_audit_date: lastAuditDate ? this.formatDateUTC(this.parseDateUTC(lastAuditDate)) : null,
          assessment_period_from: assessmentPeriodFrom,
          assessment_period_to: assessmentPeriodTo,
          audit_due_date: auditDueDate,
          compliance_due_date: complianceDueDate
        };
      });

      return {
        risk_summary_data: results,
        risk_frequencies: frequencySettings,
        projected_schedules: projectedSchedules
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
      SELECT risk_type_id, frequency, audit_due_days, compliance_due_days
      FROM audit_frequency_master 
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY risk_type_id ASC
    `);
  }

  async updateRiskFrequencies(body: { frequencies: { risk_type_id: number; frequency: number; audit_due_days?: number; compliance_due_days?: number }[] }) {
    if (!body?.frequencies || !Array.isArray(body.frequencies)) {
      throw new BadRequestException('Frequencies array is required');
    }
    await this.ensureFrequencyMasterTable();
    try {
      await this.db.transaction(async (client) => {
        for (const item of body.frequencies) {
          const { risk_type_id, frequency, audit_due_days, compliance_due_days } = item;
          await client.query(`
            INSERT INTO audit_frequency_master (risk_type_id, frequency, audit_due_days, compliance_due_days)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (risk_type_id)
            DO UPDATE SET 
              frequency = $2, 
              audit_due_days = $3, 
              compliance_due_days = $4, 
              updated_at = CURRENT_TIMESTAMP
          `, [Number(risk_type_id), Number(frequency), Number(audit_due_days || 20), Number(compliance_due_days || 20)]);
        }
      });
      return { success: true, message: 'Successfully updated risk frequencies' };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to update risk frequencies');
    }
  }
}

