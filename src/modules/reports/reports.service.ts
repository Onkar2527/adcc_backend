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

  private readonly riskParameterOptions: ReportStatusOption[] = [
    { value: '1', label: 'High Risk' },
    { value: '2', label: 'Medium Risk' },
    { value: '3', label: 'Low Risk' },
    { value: '4', label: 'No Risk' },
  ];

  constructor(private readonly db: DatabaseService) { }

  async getReportDefinition(reportSlug: string) {
    if (reportSlug === 'audit-status-report') {
      return this.getAuditStatusDefinition();
    }

    if (reportSlug === 'audit-status-expired-report') {
      return this.getAuditStatusExpiredDefinition();
    }

    if (reportSlug === 'assesment-timeline-report') {
      return this.getAssessmentTimelineDefinition();
    }

    if (reportSlug === 'assement-not-started-yet-report') {
      return this.getAssessmentNotStartedDefinition();
    }

    if (reportSlug === 'audit-complete-report') {
      return this.getAuditCompleteDefinition();
    }

    throw new NotFoundException('Report is not implemented yet');
  }

  private async getAuditStatusDefinition() {
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

  private async getAuditStatusExpiredDefinition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'audit-status-expired-report',
      title: 'Audit Status Expired Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-status-expired-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
        audit_status: '13',
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
          required: true,
          options: [
            { value: '13', label: 'Audit Expired' },
            { value: '11', label: 'Compliance Expired' },
          ],
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
        { key: 'total', label: 'Total Expired' },
        { key: 'auditExpired', label: 'Audit Expired' },
        { key: 'complianceExpired', label: 'Compliance Expired' },
      ],
    };
  }

  private async getAssessmentTimelineDefinition() {
    const lookups = await this.getAssessmentTimelineLookups();

    return {
      slug: 'assesment-timeline-report',
      title: 'Assesment Timeline Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'assesment-timeline-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        reportAuditUnit: '',
        reportAuditAssesment: '',
      },
      filters: [
        {
          key: 'reportAuditUnit',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Audit Assessment',
          type: 'select',
          required: true,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '10%', align: 'center' },
        { key: 'inspection_type', label: 'Inspection Type', width: '20%' },
        { key: 'rejected_count', label: 'Rejected Count', width: '10%', align: 'center' },
        { key: 'employee_name', label: 'Employee Name', width: '10%' },
        { key: 'status_label', label: 'Status', width: '40%' },
        { key: 'created_at', label: 'Status Changed On', width: '20%', type: 'date' },
      ],
      summaryCards: [
        { key: 'total', label: 'Timeline Entries' },
        { key: 'audit', label: 'Audit' },
        { key: 'compliance', label: 'Compliance' },
        { key: 'admin', label: 'Admin' },
      ],
    };
  }

  private async getAssessmentNotStartedDefinition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'assement-not-started-yet-report',
      title: 'Assement Not Started Yet Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'assement-not-started-yet-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No', width: '10%', align: 'center' },
        { key: 'audit_unit_name', label: 'Audit Unit', width: '25%' },
        { key: 'assessment_period', label: 'Assessment Period', width: '25%' },
        { key: 'frequency_label', label: 'Frequency', width: '10%', align: 'center' },
        { key: 'audit_status_label', label: 'Audit Status', width: '30%' },
      ],
      summaryCards: [
        { key: 'total', label: 'Not Started' },
      ],
    };
  }

  private async getAuditCompleteDefinition() {
    const lookups = await this.getAuditCompleteLookups();

    return {
      slug: 'audit-complete-report',
      title: 'Audit Complete Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-complete-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        reportAuditUnit: '',
        reportAuditAssesment: '',
        risk_category_arr: [],
        business_risk_arr: [],
        control_risk_arr: [],
      },
      filters: [
        {
          key: 'reportAuditUnit',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Audit Assessment',
          type: 'select',
          required: true,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'risk_category_arr',
          label: 'Risk Category',
          type: 'checkbox',
          options: lookups.riskCategories,
        },
        {
          key: 'business_risk_arr',
          label: 'Business Category',
          type: 'checkbox',
          options: this.riskParameterOptions,
        },
        {
          key: 'control_risk_arr',
          label: 'Control Category',
          type: 'checkbox',
          options: this.riskParameterOptions,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No', width: '5%', align: 'center' },
        { key: 'question', label: 'Question', width: '33%' },
        { key: 'answer_given', label: 'Audit Point', width: '10%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '24%' },
        { key: 'business_risk_label', label: 'Business Risk', width: '9%' },
        { key: 'control_risk_label', label: 'Control Risk', width: '9%' },
        { key: 'risk_category', label: 'Risk Type', width: '10%' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Points' },
        { key: 'complianceRequired', label: 'Compliance Required' },
        { key: 'highBusinessRisk', label: 'High Business Risk' },
        { key: 'highControlRisk', label: 'High Control Risk' },
      ],
    };
  }

  async getReportData(reportSlug: string, query: any) {
    if (reportSlug === 'audit-complete-report') {
      return this.getAuditCompleteReport(query);
    }

    if (reportSlug === 'audit-status-expired-report') {
      return this.getAuditStatusExpiredReport(query);
    }

    if (reportSlug === 'assesment-timeline-report') {
      return this.getAssessmentTimelineReport(query);
    }

    if (reportSlug === 'assement-not-started-yet-report') {
      return this.getAssessmentNotStartedReport(query);
    }

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

  async getAuditCompleteLookups() {
    const [units, assessments, riskCategories] = await Promise.all([
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
      this.db.query(`
        SELECT
          asm.id,
          asm.audit_unit_id,
          asm.assesment_period_from,
          asm.assesment_period_to,
          asm.frequency,
          aum.audit_unit_code,
          aum.name AS audit_unit_name
        FROM audit_assesment_master asm
        INNER JOIN audit_unit_master aum
          ON aum.id = asm.audit_unit_id
        WHERE asm.audit_status_id > 1
          AND asm.deleted_at IS NULL
          AND aum.deleted_at IS NULL
        ORDER BY aum.audit_unit_code ASC, asm.assesment_period_from DESC
      `),
      this.db.query(`
        SELECT id, risk_category
        FROM risk_category_master
        WHERE is_active = 1
          AND deleted_at IS NULL
        ORDER BY id ASC
      `),
    ]);

    return {
      auditUnits: [
        { value: '', label: 'Please select audit unit' },
        ...units.rows.map((row: any) => ({
          value: String(row.id),
          label: this.auditUnitName(row),
        })),
      ],
      assessments: [
        { value: '', label: 'Please select audit assessment' },
        ...assessments.rows.map((row: any) => ({
          value: String(row.id),
          label: `${this.dateOnly(row.assesment_period_from)} to ${this.dateOnly(row.assesment_period_to)} (Frequency: ${row.frequency || '-'} Months)`,
          audit_unit_id: row.audit_unit_id,
        })),
      ],
      riskCategories: riskCategories.rows.map((row: any) => ({
        value: String(row.id),
        label: String(row.risk_category || '').toUpperCase(),
      })),
    };
  }

  async getAssessmentTimelineLookups() {
    const [units, assessments] = await Promise.all([
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
      this.db.query(`
        SELECT
          asm.id,
          asm.audit_unit_id,
          asm.assesment_period_from,
          asm.assesment_period_to,
          asm.frequency
        FROM audit_assesment_master asm
        INNER JOIN audit_unit_master aum
          ON aum.id = asm.audit_unit_id
        WHERE asm.deleted_at IS NULL
          AND aum.deleted_at IS NULL
        ORDER BY aum.audit_unit_code ASC, asm.assesment_period_from DESC
      `),
    ]);

    return {
      auditUnits: [
        { value: '', label: 'Please select audit unit' },
        ...units.rows.map((row: any) => ({
          value: String(row.id),
          label: this.auditUnitName(row),
        })),
      ],
      assessments: [
        { value: '', label: 'Please select audit assessment' },
        ...assessments.rows.map((row: any) => ({
          value: String(row.id),
          label: `${this.dateOnly(row.assesment_period_from)} to ${this.dateOnly(row.assesment_period_to)} (Frequency: ${row.frequency || '-'} Months)`,
          audit_unit_id: row.audit_unit_id,
        })),
      ],
    };
  }

  async getAuditCompleteReport(query: any) {
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    const riskCategoryIds = this.toNumberArray(query.risk_category_arr);
    const businessRiskIds = this.toNumberArray(query.business_risk_arr);
    const controlRiskIds = this.toNumberArray(query.control_risk_arr);
    const params: any[] = [assessmentId, auditUnitId];
    const where = [
      'ad.assesment_id = $1',
      'aam.audit_unit_id = $2',
      'aam.audit_status_id > 1',
      'ad.deleted_at IS NULL',
      'qm.deleted_at IS NULL',
    ];

    if (riskCategoryIds.length) {
      params.push(riskCategoryIds);
      where.push(`qm.risk_category_id = ANY($${params.length}::int[])`);
    }

    if (businessRiskIds.length) {
      params.push(businessRiskIds);
      where.push(`NULLIF(ad.business_risk::text, '')::int = ANY($${params.length}::int[])`);
    }

    if (controlRiskIds.length) {
      params.push(controlRiskIds);
      where.push(`NULLIF(ad.control_risk::text, '')::int = ANY($${params.length}::int[])`);
    }

    const result = await this.db.query(
      `
      SELECT
        ad.id,
        ad.menu_id,
        mm.name AS menu_name,
        ad.category_id,
        cm.name AS category_name,
        ad.header_id,
        qhm.name AS header_name,
        ad.question_id,
        qm.question,
        qm.option_id,
        qm.annexure_id,
        cm.linked_table_id,
        qm.risk_category_id,
        rc.risk_category,
        ad.answer_given,
        ad.audit_comment,
        ad.is_compliance,
        ad.business_risk,
        ad.control_risk,
        ad.dump_id,
        ac.columns_json AS annexure_columns,
        COALESCE(dd.account_no, da.account_no) AS account_no,
        COALESCE(dd.account_holder_name, da.account_holder_name) AS account_holder_name,
        COALESCE(dd.ucic, da.ucic) AS ucic,
        COALESCE(dd.customer_type, da.customer_type) AS customer_type,
        COALESCE(dd.account_opening_date, da.account_opening_date) AS account_opening_date,
        da.renewal_date,
        COALESCE(dd.principal_amount, da.sanction_amount) AS account_amount,
        COALESCE(dd.intrest_rate, da.intrest_rate) AS interest_rate,
        COALESCE(dd.balance, da.outstanding_balance) AS outstanding_balance,
        COALESCE(dd.balance_date, da.balance_date) AS balance_date,
        da.due_date,
        da.npa_status,
        COALESCE(dd.account_status, da.account_status) AS account_status,
        au.name AS account_branch_name,
        au.audit_unit_code AS account_branch_code,
        sm.name AS scheme_name,
        sm.scheme_code
      FROM answers_data ad
      INNER JOIN audit_assesment_master aam
        ON aam.id = ad.assesment_id
      LEFT JOIN menu_master mm
        ON mm.id = ad.menu_id
      LEFT JOIN category_master cm
        ON cm.id = ad.category_id
      LEFT JOIN question_header_master qhm
        ON qhm.id = ad.header_id
      LEFT JOIN question_master qm
        ON qm.id = ad.question_id
      LEFT JOIN risk_category_master rc
        ON rc.id = qm.risk_category_id
      LEFT JOIN (
        SELECT
          ac.annexure_id,
          jsonb_agg(
            jsonb_build_object(
              'id', ac.id,
              'name', ac.name,
              'column_type_id', ac.column_type_id
            )
            ORDER BY ac.id
          ) AS columns_json
        FROM annexure_columns ac
        WHERE ac.deleted_at IS NULL
        GROUP BY ac.annexure_id
      ) ac
        ON ac.annexure_id = qm.annexure_id
      LEFT JOIN dump_deposits dd
        ON cm.linked_table_id = 1
        AND dd.id = ad.dump_id
        AND dd.deleted_at IS NULL
      LEFT JOIN dump_advances da
        ON cm.linked_table_id = 2
        AND da.id = ad.dump_id
        AND da.deleted_at IS NULL
      LEFT JOIN scheme_master sm
        ON sm.id = COALESCE(dd.scheme_id, da.scheme_id)
        AND sm.deleted_at IS NULL
      LEFT JOIN audit_unit_master au
        ON au.id = COALESCE(dd.branch_id, da.branch_id)
        AND au.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id
      `,
      params,
    );

    const answerIds = result.rows.map((row: any) => Number(row.id)).filter(Boolean);
    const annexureRowsByAnswer = await this.getAuditCompleteAnnexureRows(
      assessmentId,
      answerIds,
    );

    const questionRows = result.rows.map((row: any, index: number) => ({
      sr_no: 0,
      ...row,
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      risk_category: row.risk_category || '-',
      business_risk_label: this.riskParameterLabel(row.business_risk),
      control_risk_label: this.riskParameterLabel(row.control_risk),
      __account_key: this.accountDetailKey(row),
      __account_details: this.accountDetailRows(row),
      __is_vouching:
        this.isVouchingTransactionRow(row),
      __annexure_rows: this.formatAnnexureRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
      __vouching_rows: this.formatVouchingRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
    }));
    const rows = this.buildAuditCompleteGroupedRows(questionRows);

    const assessment = await this.getAssessmentHeader(assessmentId);

    return {
      filters: {
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
        risk_category_arr: riskCategoryIds,
        business_risk_arr: businessRiskIds,
        control_risk_arr: controlRiskIds,
      },
      total: questionRows.length,
      generatedAt: new Date().toISOString(),
      header: assessment,
      rows,
      summary: {
        total: questionRows.length,
        complianceRequired: questionRows.filter((row) => Number(row.is_compliance) === 1).length,
        highBusinessRisk: questionRows.filter((row) => Number(row.business_risk) === 1).length,
        highControlRisk: questionRows.filter((row) => Number(row.control_risk) === 1).length,
      },
    };
  }

  async getAuditStatusExpiredReport(query: any) {
    const auditUnitId = String(query.audit_unit_id || '').trim();
    const financialYear = String(query.financial_year || 'all').trim();
    const auditStatus = String(query.audit_status || '13').trim();

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    const today = this.dateOnly(new Date());
    const where: string[] = [
      'asm.deleted_at IS NULL',
      'aum.deleted_at IS NULL',
      'COALESCE(asm.is_limit_blocked, 0) = 0',
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

    params.push(today);

    if (auditStatus === '11') {
      where.push('asm.audit_status_id IN (4, 6)');
      where.push(`asm.compliance_due_date < $${params.length}`);
    } else {
      where.push('asm.audit_status_id IN (1, 3)');
      where.push(`asm.audit_due_date < $${params.length}`);
    }

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

    const rows = result.rows.map((row: any, index: number) =>
      this.mapAuditStatusRow(row, index + 1, today),
    );

    return {
      filters: {
        audit_unit_id: auditUnitId,
        financial_year: financialYear,
        audit_status: auditStatus,
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        total: rows.length,
        auditExpired: rows.filter((row) => row.audit_expired).length,
        complianceExpired: rows.filter((row) => row.compliance_expired).length,
      },
    };
  }

  async getAssessmentTimelineReport(query: any) {
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    const result = await this.db.query(
      `
      SELECT
        aut.id,
        aut.type_id,
        aut.assesment_id,
        aut.status_id,
        aut.rejected_cnt,
        aut.reviewer_emp_id,
        aut.created_at,
        emp.name AS employee_name
      FROM audit_assesment_master asm
      INNER JOIN audit_assesment_timeline aut
        ON asm.id = aut.assesment_id
      LEFT JOIN employee_master emp
        ON emp.id = aut.reviewer_emp_id
      WHERE aut.assesment_id = $1
        AND asm.audit_unit_id = $2
        AND aut.deleted_at IS NULL
        AND asm.deleted_at IS NULL
      ORDER BY aut.type_id::int ASC, aut.created_at ASC, aut.id ASC
      `,
      [assessmentId, auditUnitId],
    );

    const rows = result.rows.map((row: any, index: number) => ({
      sr_no: index + 1,
      inspection_type: this.timelineTypeLabel(row.type_id),
      rejected_count:
        [3, 6].includes(Number(row.status_id))
          ? row.rejected_cnt || 0
          : '-',
      employee_name: row.employee_name || '-',
      status_label: this.timelineStatusLabel(row.status_id),
      created_at: row.created_at,
      type_id: Number(row.type_id || 0),
      status_id: Number(row.status_id || 0),
    }));

    const assessment = await this.getAssessmentHeader(assessmentId);

    return {
      filters: {
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: assessment,
      rows,
      summary: {
        total: rows.length,
        audit: rows.filter((row) => row.type_id === 1).length,
        compliance: rows.filter((row) => row.type_id === 2).length,
        admin: rows.filter((row) => row.type_id === 3).length,
      },
    };
  }

  async getAssessmentNotStartedReport(query: any) {
    const auditUnitId = String(query.audit_unit_id || '').trim();

    if (!auditUnitId) {
      throw new BadRequestException('Search type is required');
    }

    const where: string[] = [
      'frequency != 0',
      'is_active = 1',
      'deleted_at IS NULL',
    ];
    const params: any[] = [];

    if (auditUnitId === 'all_branches') {
      where.push('section_type_id = 1');
    } else if (auditUnitId === 'all_head_of_dept') {
      where.push('section_type_id != 1');
    } else {
      params.push(Number(auditUnitId));
      where.push(`id = $${params.length}`);
    }

    const unitsResult = await this.db.query(
      `
      SELECT id, audit_unit_code, name, frequency, last_audit_date
      FROM audit_unit_master
      WHERE ${where.join(' AND ')}
      ORDER BY audit_unit_code ASC, name ASC
      `,
      params,
    );

    const rows: any[] = [];
    const currentDate = this.dateOnly(new Date());

    for (const unit of unitsResult.rows) {
      const notStartedRows = await this.getNotStartedRowsForUnit(
        unit,
        currentDate,
      );
      rows.push(...notStartedRows);
    }

    const mappedRows = rows.map((row, index) => ({
      sr_no: index + 1,
      ...row,
    }));

    return {
      filters: {
        audit_unit_id: auditUnitId,
      },
      total: mappedRows.length,
      generatedAt: new Date().toISOString(),
      rows: mappedRows,
      summary: {
        total: mappedRows.length,
      },
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
      Boolean(!auditCompleted &&
        [1, 3].includes(auditStatusId) &&
        !isBlocked &&
        auditDueDate &&
        auditDueDate < today &&
        !row.audit_end_date);
    const complianceExpired =
      Boolean(auditCompleted &&
        [4, 6].includes(auditStatusId) &&
        !isBlocked &&
        complianceDueDate &&
        complianceDueDate < today);

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
      audit_expired: auditExpired,
      compliance_start_date: auditCompleted ? row.compliance_start_date : null,
      compliance_end_date: auditCompleted ? row.compliance_end_date : null,
      compliance_due_date: row.compliance_due_date,
      compliance_status_label: auditCompleted
        ? this.complianceStatusLabel(auditStatusId, isBlocked, complianceExpired)
        : '-',
      compliance_expired: complianceExpired,
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

  private async getAssessmentHeader(assessmentId: number) {
    const result = await this.db.query(
      `
      SELECT
        aam.id,
        aam.assesment_period_from,
        aam.assesment_period_to,
        aam.frequency,
        aum.name AS audit_unit_name,
        aum.audit_unit_code
      FROM audit_assesment_master aam
      LEFT JOIN audit_unit_master aum
        ON aum.id = aam.audit_unit_id
      WHERE aam.id = $1
        AND aam.deleted_at IS NULL
      `,
      [assessmentId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      assessmentPeriod: `${this.dateOnly(row.assesment_period_from)} to ${this.dateOnly(row.assesment_period_to)}`,
      auditUnit: this.auditUnitName(row),
      frequency: row.frequency,
    };
  }

  private toNumberArray(value: any) {
    if (Array.isArray(value)) {
      return value.map(Number).filter(Boolean);
    }

    return String(value || '')
      .split(',')
      .map(Number)
      .filter(Boolean);
  }

  private riskParameterLabel(value: any) {
    const option = this.riskParameterOptions.find(
      (item) => item.value === String(value || ''),
    );

    return option?.label || '-';
  }

  private timelineTypeLabel(value: any) {
    const labels: Record<number, string> = {
      1: 'AUDIT',
      2: 'COMPLIANCE',
      3: 'ADMIN',
    };

    return labels[Number(value || 0)] || '-';
  }

  private timelineStatusLabel(value: any) {
    const labels: Record<number, string> = {
      1: 'AUDIT PENDING',
      2: 'REVIEW PENDING',
      3: 'RE-AUDIT NEEDED',
      4: 'COMPLIANCE PENDING',
      5: 'COMPLIANCE REVIEW PENDING',
      6: 'RE-COMPLIANCE NEEDED',
      7: 'COMPLETED',
      10: 'COMPLIANCE BLOCKED',
      11: 'ASSESSMENT STARTED',
      12: 'AUDIT BLOCKED',
      13: 'AUDIT DUE DATE EXTENDED',
      14: 'CARRY FORWARD',
    };

    return labels[Number(value || 0)] || '-';
  }

  private async getNotStartedRowsForUnit(unit: any, currentDate: string) {
    const rows: any[] = [];
    const frequency = Number(unit.frequency || 0);
    const lastAuditDate = this.dateOnly(unit.last_audit_date);

    if (!frequency || !lastAuditDate || lastAuditDate >= currentDate) {
      return rows;
    }

    const nextAssessmentDate = this.addMonths(lastAuditDate, frequency);
    const nextAssessmentEndDate = this.addDays(nextAssessmentDate, -1);
    const existing = await this.db.query(
      `
      SELECT id
      FROM audit_assesment_master
      WHERE audit_unit_id = $1
        AND assesment_period_to = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [unit.id, nextAssessmentEndDate],
    );

    if (existing.rows.length) {
      return rows;
    }

    const monthDiff = this.monthDifference(lastAuditDate, currentDate);
    const assessmentCount = Math.max(Math.floor(monthDiff / frequency), 1);

    for (let index = 0; index < assessmentCount; index += 1) {
      const startDate = this.addDays(
        this.addMonths(lastAuditDate, index * frequency),
        1,
      );
      const endDate = this.addDays(
        this.addMonths(startDate, frequency),
        -1,
      );

      rows.push({
        audit_unit_name: this.auditUnitName(unit),
        assessment_period: `${startDate} to ${endDate}`,
        frequency_label: `${frequency} Months`,
        audit_status_label: 'Assement Not Started Yet',
      });
    }

    return rows;
  }

  private addMonths(value: string, months: number) {
    const date = new Date(`${value}T00:00:00`);
    date.setMonth(date.getMonth() + months);

    return this.dateOnly(date);
  }

  private addDays(value: string, days: number) {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);

    return this.dateOnly(date);
  }

  private monthDifference(fromDate: string, toDate: string) {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);

    return (to.getFullYear() - from.getFullYear()) * 12
      + (to.getMonth() - from.getMonth());
  }

  private buildAuditCompleteGroupedRows(questionRows: any[]) {
    const rows: any[] = [];
    let currentMenu = '';
    let currentCategory = '';
    let currentHeader = '';
    let currentAccount = '';
    let headerSerial = 0;

    questionRows.forEach((row) => {
      const menu = String(row.menu_name || '-').trim();
      const category = String(row.category_name || '-').trim();
      const header = String(row.header_name || '-').trim();
      const account = String(row.__account_key || '').trim();

      if (menu !== currentMenu) {
        rows.push({
          __report_group: true,
          __group_level: 'menu',
          __group_label: `Menu: ${menu}`,
        });
        currentMenu = menu;
        currentCategory = '';
        currentHeader = '';
        currentAccount = '';
        headerSerial = 0;
      }

      if (category !== currentCategory) {
        rows.push({
          __report_group: true,
          __group_level: 'category',
          __group_label: `Category: ${category}`,
        });
        currentCategory = category;
        currentHeader = '';
        currentAccount = '';
        headerSerial = 0;
      }

      if (header !== currentHeader) {
        rows.push({
          __report_group: true,
          __group_level: 'header',
          __group_label: `Header: ${header}`,
        });
        currentHeader = header;
        currentAccount = '';
        headerSerial = 0;
      }

      if (account && account !== currentAccount) {
        rows.push({
          __report_group: true,
          __group_level: 'account',
          __group_label: row.__account_details?.title || 'Account Details',
          __account_details: row.__account_details,
        });
        currentAccount = account;
      }

      headerSerial += 1;
      rows.push({
        ...row,
        sr_no: headerSerial,
      });

      if (row.__is_vouching && (row.__vouching_rows || []).length) {
        rows.push({
          __report_vouching: true,
          __vouching_columns:
            row.__vouching_rows[0].columns || [],
          __vouching_rows:
            row.__vouching_rows,
        });
      } else if ((row.__annexure_rows || []).length) {
        rows.push({
          __report_annexure: true,
          __annexure_title: row.__annexure_rows[0].title || 'Annexure Details',
          __annexure_rows: row.__annexure_rows,
        });
      }
    });

    return rows;
  }

  private async getAuditCompleteAnnexureRows(
    assessmentId: number,
    answerIds: number[],
  ) {
    const rowsByAnswer = new Map<number, any[]>();

    if (!answerIds.length) {
      return rowsByAnswer;
    }

    const result = await this.db.query(
      `
      SELECT
        aa.id,
        aa.answer_id,
        aa.answer_given,
        aa.business_risk,
        aa.control_risk,
        aa.risk_cat_id,
        rc.risk_category
      FROM answers_data_annexure aa
      LEFT JOIN risk_category_master rc
        ON rc.id = aa.risk_cat_id
      WHERE aa.assesment_id = $1
        AND aa.answer_id = ANY($2::int[])
        AND aa.deleted_at IS NULL
      ORDER BY aa.answer_id, aa.id
      `,
      [assessmentId, answerIds],
    );

    for (const row of result.rows) {
      const answerId = Number(row.answer_id);

      if (!rowsByAnswer.has(answerId)) {
        rowsByAnswer.set(answerId, []);
      }

      rowsByAnswer.get(answerId)?.push(row);
    }

    return rowsByAnswer;
  }

  private formatAnnexureRows(rows: any[], columns: any[]) {
    const annexureColumns = this.parseJsonArray(columns);
    const firstColumnName =
      String(annexureColumns[0]?.name || 'Annexure Details').trim();

    return rows.map((row, index) => {
      const values = this.parseJsonArray(row.answer_given);
      const displayValues = annexureColumns.length
        ? values.slice(0, annexureColumns.length)
        : values.slice(0, 1);
      const descriptionParts = displayValues
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      return {
        title: firstColumnName,
        description: descriptionParts.length
          ? `${index + 1}) ${descriptionParts.join(' | ')}`
          : `${index + 1}) -`,
        business_risk_label: this.riskParameterLabel(row.business_risk),
        control_risk_label: this.riskParameterLabel(row.control_risk),
        risk_category: row.risk_category || '-',
      };
    });
  }

  private formatVouchingRows(rows: any[], columns: any[]) {
    const vouchingColumns = this.parseJsonArray(columns).map(
      (column: any, index: number) => ({
        label:
          String(column?.name || `Column ${index + 1}`).trim(),
      }),
    );

    return rows.map((row, index) => {
      const values =
        this.parseJsonArray(row.answer_given);
      const cells =
        vouchingColumns.map((_column: any, columnIndex: number) => {
          const value =
            String(values[columnIndex] || '').trim();

          return columnIndex === 0
            ? `${index + 1}) ${value || '-'}`
            : value || '-';
        });

      return {
        columns:
          vouchingColumns,
        cells,
        business_risk_label:
          this.riskParameterLabel(row.business_risk),
        control_risk_label:
          this.riskParameterLabel(row.control_risk),
        risk_category:
          row.risk_category || '-',
      };
    });
  }

  private isVouchingTransactionRow(row: any) {
    return [
      row.menu_name,
      row.category_name,
      row.header_name,
      row.question,
    ]
      .map((item) => String(item || '').toLowerCase())
      .some((item) => item.includes('vouching'));
  }

  private accountDetailKey(row: any) {
    if (!Number(row.dump_id || 0)) {
      return '';
    }

    return [
      row.scheme_code,
      row.account_no,
      row.ucic,
      row.account_holder_name,
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(':');
  }

  private accountDetailRows(row: any) {
    if (!Number(row.dump_id || 0)) {
      return null;
    }

    return {
      title:
        `Account Details: ${String(row.account_holder_name || row.account_no || '').trim() || '-'}`,
      rows: [
        [
          this.detailCell(
            'Branch Name',
            `${row.account_branch_name || '-'}${row.account_branch_code ? ` (BR. CODE: ${row.account_branch_code})` : ''}`,
          ),
          this.detailCell('Scheme Code', row.scheme_code),
          this.detailCell('Scheme Name', row.scheme_name),
        ],
        [
          this.detailCell('Account Number', row.account_no),
          this.detailCell('UCIC', row.ucic),
          this.detailCell('Account Open Date', this.dateOnly(row.account_opening_date)),
        ],
        [
          this.detailCell('Interest Rate', row.interest_rate),
          this.detailCell('Sanction Amount', row.account_amount),
          this.detailCell('Outstanding Balance', row.outstanding_balance),
        ],
        [
          this.detailCell('Customer Type', row.customer_type),
          this.detailCell('Due Date', this.dateOnly(row.due_date)),
          this.detailCell('Balance As On', this.dateOnly(row.balance_date)),
        ],
        [
          this.detailCell('NPA Status', row.npa_status),
          this.detailCell('Renewal Date', this.dateOnly(row.renewal_date)),
          this.detailCell('Account Status', row.account_status),
        ],
      ],
    };
  }

  private detailCell(label: string, value: any) {
    return {
      label,
      value: value === null || value === undefined || value === '' ? '-' : value,
    };
  }

  private auditAnswerLabel(row: any) {
    if (Number(row.option_id) === 4 && row.answer_given) {
      return 'As per annexure';
    }

    if (Number(row.option_id) === 5 && row.answer_given) {
      return 'As per subset';
    }

    return row.answer_given || '-';
  }

  private parseJsonArray(value: any) {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(String(value));
      if (Array.isArray(parsed)) {
        return parsed;
      }

      return Object.keys(parsed || {})
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => parsed[key]);
    } catch {
      return [];
    }
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
