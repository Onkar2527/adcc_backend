import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Creates a centralized audit log entry.
   */
  async createLog(
    eventType: string,
    options: {
      employeeId: number;
      auditAssessmentId?: number;
      oldStatus?: string;
      newStatus?: string;
      ipAddress?: string;
      description?: string;
    },
    client?: any, // Optional transaction client
  ) {
    try {
      const executor = client || this.db;

      // 1. Resolve Employee Info
      let employeeCode: string | null = null;
      let employeeName: string | null = null;
      let employeeRole: string | null = null;

      if (options.employeeId) {
        const empRes = await executor.query(
          `SELECT id, emp_code, name, user_type_id FROM employee_master WHERE id = $1 AND deleted_at IS NULL`,
          [options.employeeId],
        );
        const emp = empRes.rows[0];
        if (emp) {
          employeeCode = emp.emp_code;
          employeeName = emp.name;
          employeeRole = this.getRoleName(Number(emp.user_type_id));
        }
      }

      // 2. Resolve Assessment & Branch Info
      let auditUnitId: number | null = null;
      let branchId: number | null = null;
      let branchName: string | null = null;

      if (options.auditAssessmentId) {
        const assessmentRes = await executor.query(
          `SELECT aam.audit_unit_id, au.name AS branch_name 
           FROM audit_assesment_master aam 
           LEFT JOIN audit_unit_master au ON au.id = aam.audit_unit_id 
           WHERE aam.id = $1 AND aam.deleted_at IS NULL`,
          [options.auditAssessmentId],
        );
        const assessment = assessmentRes.rows[0];
        if (assessment) {
          auditUnitId = Number(assessment.audit_unit_id);
          branchId = auditUnitId;
          branchName = assessment.branch_name;
        }
      }

      const query = `
        INSERT INTO audit_logs (
          audit_assesment_id,
          audit_unit_id,
          branch_id,
          branch_name,
          employee_id,
          employee_code,
          employee_name,
          employee_role,
          event_type,
          event_description,
          old_status,
          new_status,
          ip_address,
          event_datetime,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const values = [
        options.auditAssessmentId || null,
        auditUnitId,
        branchId,
        branchName,
        options.employeeId || null,
        employeeCode,
        employeeName,
        employeeRole,
        eventType,
        options.description || null,
        options.oldStatus || null,
        options.newStatus || null,
        options.ipAddress || null,
      ];

      await executor.query(query, values);
    } catch (err: any) {
      this.logger.error(`Failed to write audit log for event ${eventType}: ${err.message}`, err.stack);
    }
  }

  /**
   * Retrieves all logs matching optional filters.
   */
  async getLogs(query: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    eventType?: string;
    branchId?: string;
    auditUnitId?: string;
    assessmentId?: string;
  }) {
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      whereClauses.push(`al.event_datetime >= $${paramIndex++}`);
      params.push(query.startDate);
    }
    if (query.endDate) {
      // Add end-of-day boundary for the end date if it is just a date string (YYYY-MM-DD)
      let adjustedEndDate = query.endDate;
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) {
        adjustedEndDate = `${query.endDate} 23:59:59.999`;
      }
      whereClauses.push(`al.event_datetime <= $${paramIndex++}`);
      params.push(adjustedEndDate);
    }
    if (query.employeeId) {
      whereClauses.push(`al.employee_id = $${paramIndex++}`);
      params.push(Number(query.employeeId));
    }
    if (query.eventType) {
      whereClauses.push(`al.event_type = $${paramIndex++}`);
      params.push(query.eventType);
    }
    if (query.branchId) {
      whereClauses.push(`al.branch_id = $${paramIndex++}`);
      params.push(Number(query.branchId));
    }
    if (query.auditUnitId) {
      whereClauses.push(`al.audit_unit_id = $${paramIndex++}`);
      params.push(Number(query.auditUnitId));
    }
    if (query.assessmentId) {
      whereClauses.push(`al.audit_assesment_id = $${paramIndex++}`);
      params.push(Number(query.assessmentId));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT 
        al.*,
        ym.year AS financial_year,
        head.name AS audit_head_name,
        head.emp_code AS audit_head_code,
        rev.name AS reviewer_name,
        rev.emp_code AS reviewer_code,
        comp.name AS compliance_user_name,
        comp.emp_code AS compliance_user_code,
        aam.audit_start_date,
        aam.audit_end_date,
        aam.audit_review_date,
        aam.compliance_start_date,
        aam.compliance_end_date
      FROM audit_logs al
      LEFT JOIN audit_assesment_master aam ON aam.id = al.audit_assesment_id AND aam.deleted_at IS NULL
      LEFT JOIN year_master ym ON ym.id = aam.year_id AND ym.deleted_at IS NULL
      LEFT JOIN employee_master head ON head.id = aam.audit_head_id AND head.deleted_at IS NULL
      LEFT JOIN employee_master rev ON rev.id = COALESCE(aam.audit_review_emp_id, aam.compliance_review_emp_id) AND rev.deleted_at IS NULL
      LEFT JOIN employee_master comp ON comp.id = aam.compliance_emp_id AND comp.deleted_at IS NULL
      ${whereSql}
      ORDER BY al.event_datetime DESC
    `;

    const result = await this.db.query(sql, params);
    return result.rows;
  }

  /**
   * Retrieves unique filter options (dropdown values) from existing logs.
   */
  async getFilterOptions() {
    const employees = await this.db.query(
      `SELECT DISTINCT al.employee_id AS id, em.name, em.emp_code 
       FROM audit_logs al 
       INNER JOIN employee_master em ON em.id = al.employee_id 
       WHERE al.employee_id IS NOT NULL AND em.deleted_at IS NULL
       ORDER BY em.name`,
    );

    const branches = await this.db.query(
      `SELECT DISTINCT al.branch_id AS id, au.name, au.audit_unit_code 
       FROM audit_logs al 
       INNER JOIN audit_unit_master au ON au.id = al.branch_id 
       WHERE al.branch_id IS NOT NULL AND au.deleted_at IS NULL
       ORDER BY au.name`,
    );

    const eventTypes = [
      { label: 'Login', value: 'LOGIN' },
      { label: 'Logout', value: 'LOGOUT' },
      { label: 'Audit Start', value: 'AUDIT_START' },
      { label: 'Audit End', value: 'AUDIT_END' },
      { label: 'Review Start', value: 'REVIEW_START' },
      { label: 'Review End', value: 'REVIEW_END' },
      { label: 'Compliance Start', value: 'COMPLIANCE_START' },
      { label: 'Compliance End', value: 'COMPLIANCE_END' },
    ];

    return {
      employees: employees.rows,
      branches: branches.rows,
      eventTypes,
    };
  }

  /**
   * Helper to map user type id to display role name.
   */
  private getRoleName(userTypeId: number): string {
    switch (userTypeId) {
      case 1:
        return 'Admin';
      case 2:
        return 'Auditor';
      case 3:
        return 'Branch Manager';
      case 4:
        return 'Reviewer';
      case 5:
        return 'Top Level Management';
      case 6:
        return 'Compliance User';
      default:
        return 'User';
    }
  }
}
