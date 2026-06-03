import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

type ReportStatusOption = {
  value: string;
  label: string;
};

@Injectable()
export class ReportsService {
  private readonly auditStatusOptions: ReportStatusOption[] = [
    { value: 'all', label: 'All Audit' },
    { value: '1', label: 'Pending' },
    { value: '2', label: 'Review Pending' },
    { value: '3', label: 'Re-Audit Needed' },
    { value: '4', label: 'Completed' },
    { value: '12', label: 'Blocked' },
  ];

  private readonly complianceStatusOptions: ReportStatusOption[] = [
    { value: 'all', label: 'All Compliance' },
    { value: '4', label: 'Pending' },
    { value: '5', label: 'Review Pending' },
    { value: '6', label: 'Re-Compliance Needed' },
    { value: '7', label: 'Completed' },
    { value: '10', label: 'Blocked' },
  ];

  constructor(private readonly db: DatabaseService) {}

  async getReportDefinition(reportSlug: string) {
    if (reportSlug !== 'audit-status-report') {
      throw new NotFoundException('Report is not implemented yet');
    }

    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'audit-status-report',
      title: 'Audit Status Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-status-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
        audit_status: 'all',
        comp_status: 'all',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Select Branch',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Select Financial Year',
          type: 'select',
          options: lookups.years,
        },
        {
          key: 'audit_status',
          label: 'Select Audit Status',
          type: 'select',
          options: lookups.auditStatuses,
        },
        {
          key: 'comp_status',
          label: 'Select Compliance Status',
          type: 'select',
          options: lookups.complianceStatuses,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No', width: '5%', align: 'center' },
        { key: 'audit_unit_name', label: 'Audit Unit', width: '10%' },
        { key: 'auditor_name', label: 'Auditor', width: '15%' },
        { key: 'audit_start_date', label: 'Audit Start Date', width: '8%', type: 'date' },
        { key: 'audit_end_date', label: 'Audit End Date', width: '8%', type: 'date' },
        { key: 'assessment_period', label: 'Assessment Period', width: '15%', type: 'assessmentPeriod' },
        {
          key: 'audit_status_label',
          label: 'Audit Status',
          width: '10%',
          align: 'center',
          type: 'status',
          expiredKey: 'audit_expired',
          dueDateKey: 'audit_due_date',
        },
        { key: 'compliance_start_date', label: 'Compliance Start Date', width: '8%', type: 'date' },
        { key: 'compliance_end_date', label: 'Compliance End Date', width: '8%', type: 'date' },
        {
          key: 'compliance_status_label',
          label: 'Compliance Status',
          width: '13%',
          type: 'status',
          expiredKey: 'compliance_expired',
          dueDateKey: 'compliance_due_date',
        },
      ],
      summaryCards: [
        { key: 'total', label: 'Total' },
        { key: 'auditPending', label: 'Audit Pending' },
        { key: 'reviewPending', label: 'Review' },
        { key: 'compliancePending', label: 'Compliance' },
        { key: 'blocked', label: 'Blocked' },
        { key: 'expired', label: 'Expired' },
      ],
    };
  }

  async getReportData(reportSlug: string, query: any) {
    if (reportSlug !== 'audit-status-report') {
      throw new NotFoundException('Report is not implemented yet');
    }

    const report = await this.getAuditStatusReport(query);

    return {
      ...report,
      summary: {
        total: report.total,
        ...report.summary,
      },
    };
  }

  async getAuditStatusLookups() {
    const [years, units] = await Promise.all([
      this.db.query(`
        SELECT id, year
        FROM year_master
        WHERE deleted_at IS NULL
        ORDER BY id DESC
      `),
      this.db.query(`
        SELECT
          id,
          audit_unit_code,
          name,
          section_type_id
        FROM audit_unit_master
        WHERE is_active = 1
          AND deleted_at IS NULL
        ORDER BY section_type_id ASC, audit_unit_code ASC, name ASC
      `),
    ]);

    return {
      years: [
        { value: 'all', label: 'All Years' },
        ...years.rows.map((row: any) => ({
          value: String(row.id),
          label: String(row.year),
        })),
      ],
      auditUnits: [
        { value: 'all_branches', label: 'All Branches' },
        { value: 'all_head_of_dept', label: 'All Head Of Departments' },
        ...units.rows.map((row: any) => ({
          value: String(row.id),
          label: this.auditUnitName(row),
          section_type_id: row.section_type_id,
        })),
      ],
      auditStatuses: this.auditStatusOptions,
      complianceStatuses: this.complianceStatusOptions,
    };
  }

  async getAuditStatusReport(query: any) {
    const auditUnitId = String(query.audit_unit_id || '').trim();
    const financialYear = String(query.financial_year || 'all').trim();
    const auditStatus = String(query.audit_status || 'all').trim();
    const complianceStatus = String(query.comp_status || 'all').trim();

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    const where: string[] = [
      'asm.deleted_at IS NULL',
      'aum.deleted_at IS NULL',
    ];
    const params: any[] = [];

    if (auditUnitId === 'all_branches') {
      where.push('aum.section_type_id = 1');
    } else if (auditUnitId === 'all_head_of_dept') {
      where.push('aum.section_type_id > 1');
    } else {
      params.push(Number(auditUnitId));
      where.push(`asm.audit_unit_id = $${params.length}`);
    }

    if (financialYear !== 'all') {
      params.push(Number(financialYear));
      where.push(`asm.year_id = $${params.length}`);
    }

    this.applyAuditStatusFilter(where, auditStatus);
    this.applyComplianceStatusFilter(where, complianceStatus);

    const result = await this.db.query(
      `
      SELECT
        asm.id,
        asm.year_id,
        ym.year AS financial_year,
        asm.audit_unit_id,
        aum.audit_unit_code,
        aum.name AS audit_unit_name,
        aum.section_type_id,
        asm.audit_emp_id,
        emp.name AS auditor_name,
        emp.emp_code AS auditor_code,
        asm.audit_start_date,
        asm.audit_end_date,
        asm.assesment_period_from,
        asm.assesment_period_to,
        asm.frequency,
        asm.audit_status_id,
        asm.audit_due_date,
        asm.compliance_start_date,
        asm.compliance_end_date,
        asm.compliance_due_date,
        COALESCE(asm.is_limit_blocked, 0) AS is_limit_blocked
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      LEFT JOIN year_master ym
        ON ym.id = asm.year_id
      LEFT JOIN employee_master emp
        ON emp.id = asm.audit_emp_id
      WHERE ${where.join(' AND ')}
      ORDER BY aum.audit_unit_code ASC, asm.audit_unit_id ASC, asm.assesment_period_from ASC
      `,
      params,
    );

    const today = this.dateOnly(new Date());
    const rows = result.rows.map((row: any, index: number) =>
      this.mapAuditStatusRow(row, index + 1, today),
    );

    return {
      filters: {
        audit_unit_id: auditUnitId,
        financial_year: financialYear,
        audit_status: auditStatus,
        comp_status: complianceStatus,
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        auditPending: rows.filter((row) => row.audit_status_id === 1).length,
        reviewPending: rows.filter((row) => row.audit_status_id === 2).length,
        reAuditNeeded: rows.filter((row) => row.audit_status_id === 3).length,
        compliancePending: rows.filter((row) => row.audit_status_id === 4).length,
        complianceReviewPending: rows.filter((row) => row.audit_status_id === 5).length,
        reComplianceNeeded: rows.filter((row) => row.audit_status_id === 6).length,
        completed: rows.filter((row) => row.audit_status_id === 7).length,
        blocked: rows.filter((row) => row.is_limit_blocked === 1).length,
        expired: rows.filter((row) => row.audit_expired || row.compliance_expired).length,
      },
    };
  }

  private applyAuditStatusFilter(where: string[], status: string) {
    switch (status) {
      case '1':
      case '2':
      case '3':
        where.push(`asm.audit_status_id = ${Number(status)}`);
        break;
      case '4':
        where.push('asm.audit_status_id >= 4');
        break;
      case '12':
        where.push('asm.audit_status_id < 4');
        where.push('COALESCE(asm.is_limit_blocked, 0) = 1');
        break;
    }
  }

  private applyComplianceStatusFilter(where: string[], status: string) {
    switch (status) {
      case '4':
      case '5':
      case '6':
      case '7':
        where.push(`asm.audit_status_id = ${Number(status)}`);
        break;
      case '10':
        where.push('asm.audit_status_id BETWEEN 4 AND 7');
        where.push('COALESCE(asm.is_limit_blocked, 0) = 1');
        break;
    }
  }

  private mapAuditStatusRow(row: any, srNo: number, today: string) {
    const auditStatusId = Number(row.audit_status_id || 0);
    const isBlocked = Number(row.is_limit_blocked || 0) === 1;
    const auditDueDate = this.dateOnly(row.audit_due_date);
    const complianceDueDate = this.dateOnly(row.compliance_due_date);
    const auditCompleted = auditStatusId >= 4;
    const auditExpired =
      !auditCompleted &&
      [1, 3].includes(auditStatusId) &&
      !isBlocked &&
      auditDueDate &&
      auditDueDate < today &&
      !row.audit_end_date;
    const complianceExpired =
      auditCompleted &&
      [4, 6].includes(auditStatusId) &&
      !isBlocked &&
      complianceDueDate &&
      complianceDueDate < today;

    return {
      sr_no: srNo,
      id: row.id,
      year_id: row.year_id,
      financial_year: row.financial_year,
      audit_unit_id: row.audit_unit_id,
      audit_unit_code: row.audit_unit_code,
      audit_unit_name: this.auditUnitName(row),
      auditor_name: this.employeeName(row),
      audit_start_date: row.audit_start_date,
      audit_end_date: row.audit_end_date,
      assesment_period_from: row.assesment_period_from,
      assesment_period_to: row.assesment_period_to,
      frequency: row.frequency,
      audit_status_id: auditStatusId,
      audit_status_label: this.auditStatusLabel(auditStatusId, isBlocked, auditExpired),
      audit_due_date: row.audit_due_date,
      audit_expired: Boolean(auditExpired),
      compliance_start_date: auditCompleted ? row.compliance_start_date : null,
      compliance_end_date: auditCompleted ? row.compliance_end_date : null,
      compliance_due_date: row.compliance_due_date,
      compliance_status_label: auditCompleted
        ? this.complianceStatusLabel(auditStatusId, isBlocked, complianceExpired)
        : '-',
      compliance_expired: Boolean(complianceExpired),
      is_limit_blocked: isBlocked ? 1 : 0,
    };
  }

  private auditStatusLabel(statusId: number, blocked: boolean, expired: boolean) {
    if ([1, 2, 3].includes(statusId)) {
      if (blocked) {
        return 'Blocked';
      }

      const labels: Record<number, string> = {
        1: 'Pending',
        2: 'Review Pending',
        3: 'Re-Audit Needed',
      };

      return expired ? `${labels[statusId]} - Expired` : labels[statusId];
    }

    return 'Completed';
  }

  private complianceStatusLabel(statusId: number, blocked: boolean, expired: boolean) {
    if ([4, 5, 6].includes(statusId)) {
      if (blocked) {
        return 'Blocked';
      }

      const labels: Record<number, string> = {
        4: 'Pending',
        5: 'Review Pending',
        6: 'Re-Compliance Needed',
      };

      return expired ? `${labels[statusId]} - Expired` : labels[statusId];
    }

    return 'Completed';
  }

  private auditUnitName(row: any) {
    const code = String(row.audit_unit_code || '').trim();
    const name = String(row.audit_unit_name || row.name || '').trim();

    return code ? `${name} (${code})` : name || '-';
  }

  private employeeName(row: any) {
    const code = String(row.auditor_code || '').trim();
    const name = String(row.auditor_name || '').trim();

    return name ? (code ? `${name} (${code})` : name) : '-';
  }

  private dateOnly(value: any) {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }
}
