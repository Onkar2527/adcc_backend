import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

type ReportStatusOption = {
  value: string;
  label: string;
};

@Injectable()
export class ReportsService {

  // Options

  private readonly auditTypeOptions: ReportStatusOption[] = [
    { value: 'all', label: 'All Audit Types' },
    { value: '1', label: 'Internal Audit' },
    { value: '2', label: 'Special Audit' },
  ];

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

  private getBankName(defaultName = 'KREDPOOL SOLUTIONS PVT LTD.'): string {
    return process.env.BANK_NAME || defaultName;
  }

  // Special Audit Filter
  private normalizeAuditType(query: any) {
    const value = String(query?.audit_type_id || 'all').trim();
    return ['1', '2'].includes(value) ? Number(value) : null;
  }

  private applyAssessmentAuditTypeFilter(
    where: string[],
    params: any[],
    query: any,
    field: string,
  ) {
    const auditTypeId = this.normalizeAuditType(query);

    if (auditTypeId) {
      params.push(auditTypeId);
      where.push(`COALESCE(${field}, 1) = $${params.length}`);
    }
  }

  // Report Definitions

  async getReportDefinition(reportSlug: string, isFreeFlow = false) {
    if (reportSlug === 'audit-status-report') {
      return this.getAuditStatusDefinition();
    }

    if (reportSlug === 'carry-forward-report') {
      return this.getCarryForwardDefinition();
    }

    if (reportSlug === 'partially-pass-report') {
      return this.getPartiallyPassDefinition();
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
      return this.getAuditCompleteDefinition(isFreeFlow);
    }

    if (reportSlug === 'audit-observations-report') {
      return this.getAuditObservationsDefinition(isFreeFlow);
    }

    if (reportSlug === 'compliance-report') {
      return this.getComplianceDefinition(isFreeFlow);
    }

    if (reportSlug === 'compliance-summary-report') {
      return this.getComplianceSummaryDefinition(isFreeFlow);
    }

    if (reportSlug === 'risk-weightage-report') {
      return this.getRiskWeightageDefinition(isFreeFlow);
    }

    if (reportSlug === 'risk-wise-audit-units-report') {
      return this.getRiskWiseAuditUnitsDefinition(isFreeFlow);
    }

    if (reportSlug === 'risk-npa-wise-audit-units-report') {
      return this.getRiskNpaWiseAuditUnitsDefinition(isFreeFlow);
    }

    if (reportSlug === 'rbia-performance-risk-weightage-report-all-units') {
      return this.getRBIAPerformanceRiskWeightageReportAllUnitsDefinition(isFreeFlow);
    }

    if (reportSlug === 'performance-risk-weightage-report') {
      return this.getPerformanceRiskWeightageDefinition(isFreeFlow);
    }

    if (reportSlug === 'performance-risk-weightage-report-category-wise') {
      return this.getPerformanceRiskWeightageCategoryWiseDefinition(isFreeFlow);
    }

    if (reportSlug === 'audit-committee-board-report-1') {
      return this.getAuditCommitteeBoardReport1Definition();
    }

    if (reportSlug === 'broader-areawise-scoring-report') {
      return this.getBroaderAreaWiseScoringDefinition(isFreeFlow);
    }

    if (reportSlug === 'questionwsie-broader-areawise-report') {
      return this.getQuestionWiseBroaderAreaDefinition(isFreeFlow);
    }

    if (reportSlug === 'question-wise-scoring-report') {
      return this.getQuestionWiseScoringDefinition(isFreeFlow);
    }

    if (reportSlug === 'audit-observation-count-report') {
      return this.getAuditObservationCountDefinition();
    }

    if (reportSlug === 'pending-compliance-detail-report') {
      return this.getPendingComplianceDetailDefinition(isFreeFlow);
    }

    if (reportSlug === 'executive-summary-audit-report') {
      return this.getExecutiveSummaryDefinition(false, isFreeFlow);
    }

    if (reportSlug === 'executive-summary-compliance-report') {
      return this.getExecutiveSummaryDefinition(true, isFreeFlow);
    }

    if (reportSlug === 'internal-assesment-report') {
      return this.getInternalAssessmentDefinition();
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
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
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
        {
          key: 'audit_start_date',
          label: 'Audit Start Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'audit_end_date',
          label: 'Audit End Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'assessment_period',
          label: 'Assessment Period',
          width: '15%',
          type: 'assessmentPeriod',
        },
        {
          key: 'audit_status_label',
          label: 'Audit Status',
          width: '10%',
          align: 'center',
          type: 'status',
          expiredKey: 'audit_expired',
          dueDateKey: 'audit_due_date',
        },
        {
          key: 'compliance_start_date',
          label: 'Compliance Start Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'compliance_end_date',
          label: 'Compliance End Date',
          width: '8%',
          type: 'date',
        },
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

  private async getCarryForwardDefinition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'carry-forward-report',
      title: 'Carry Forward Report',
      category: 'Audit Reports',
      page: 'A4',
      fileName: 'carry-forward-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
        transfer_status: 'all',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          options: lookups.years,
        },
        {
          key: 'transfer_status',
          label: 'Carry Forward Status',
          type: 'select',
          options: [
            { value: 'all', label: 'All Points' },
            { value: 'transferred', label: 'Transferred' },
            { value: 'pending', label: 'Pending Transfer' },
          ],
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '5%', align: 'center' },
        { key: 'question', label: 'Question', width: '27%' },
        { key: 'answer_given', label: 'Audit Point', width: '11%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '19%' },
        { key: 'manager_response', label: 'Manager Response', width: '16%' },
        { key: 'reviewer_comment', label: 'Reviewer Comment', width: '16%' },
        { key: 'carry_forward_status', label: 'Status', width: '11%', type: 'status' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Points' },
        { key: 'transferred', label: 'Transferred' },
        { key: 'pending', label: 'Pending Transfer' },
        { key: 'accountPoints', label: 'Account Points' },
        { key: 'annexurePoints', label: 'Annexure Points' },
      ],
    };
  }

  private async getPartiallyPassDefinition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'partially-pass-report',
      title: 'Partially Pass Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'partially-pass-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
        partial_status: 'all',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          options: lookups.years,
        },
        {
          key: 'partial_status',
          label: 'Partially Pass Status',
          type: 'select',
          options: [
            { value: 'all', label: 'All Points' },
            { value: 'manager_pending', label: 'Pending with Manager' },
            { value: 'reviewer_pending', label: 'Pending with Reviewer' },
            { value: 'settled', label: 'Settled' },
          ],
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '5%', align: 'center' },
        { key: 'question', label: 'Question', width: '27%' },
        { key: 'answer_given', label: 'Audit Point', width: '11%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '19%' },
        { key: 'manager_response', label: 'Manager Response', width: '16%' },
        { key: 'reviewer_comment', label: 'Reviewer Comment', width: '16%' },
        { key: 'partial_pass_status', label: 'Status', width: '11%', type: 'status' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Points' },
        { key: 'managerPending', label: 'Pending with Manager' },
        { key: 'reviewerPending', label: 'Pending with Reviewer' },
        { key: 'settled', label: 'Settled' },
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
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
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
        {
          key: 'audit_start_date',
          label: 'Audit Start Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'audit_end_date',
          label: 'Audit End Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'assessment_period',
          label: 'Assessment Period',
          width: '15%',
          type: 'assessmentPeriod',
        },
        {
          key: 'audit_status_label',
          label: 'Audit Status',
          width: '10%',
          align: 'center',
          type: 'status',
          expiredKey: 'audit_expired',
          dueDateKey: 'audit_due_date',
        },
        {
          key: 'compliance_start_date',
          label: 'Compliance Start Date',
          width: '8%',
          type: 'date',
        },
        {
          key: 'compliance_end_date',
          label: 'Compliance End Date',
          width: '8%',
          type: 'date',
        },
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
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
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
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
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
        {
          key: 'rejected_count',
          label: 'Rejected Count',
          width: '10%',
          align: 'center',
        },
        { key: 'employee_name', label: 'Employee Name', width: '10%' },
        { key: 'status_label', label: 'Status', width: '40%' },
        {
          key: 'created_at',
          label: 'Status Changed On',
          width: '20%',
          type: 'date',
        },
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
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No', width: '10%', align: 'center' },
        { key: 'audit_unit_name', label: 'Audit Unit', width: '25%' },
        { key: 'assessment_period', label: 'Assessment Period', width: '25%' },
        {
          key: 'frequency_label',
          label: 'Frequency',
          width: '10%',
          align: 'center',
        },
        { key: 'audit_status_label', label: 'Audit Status', width: '30%' },
      ],
      summaryCards: [{ key: 'total', label: 'Not Started' }],
    };
  }

  private async getAuditCompleteDefinition(isFreeFlow = false) {
    const lookups = await this.getAuditCompleteLookups(isFreeFlow);

    return {
      slug: 'audit-complete-report',
      title: 'Audit Complete Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-complete-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
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
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
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
        { key: 'question', label: 'Question', width: '25%' },
        { key: 'auditor_emp_code', label: 'Auditor Code', width: '10%', align: 'center' },
        { key: 'answer_given', label: 'Audit Point', width: '10%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '22%' },
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

  private async getAuditObservationsDefinition(isFreeFlow = false) {
    const lookups = await this.getAuditCompleteLookups(isFreeFlow);

    return {
      slug: 'audit-observations-report',
      title: 'Audit Observations Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-observations-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
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
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
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
        { key: 'question', label: 'Question', width: '50%' },
        { key: 'answer_given', label: 'Audit Point', width: '10%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '35%' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Points' },
        { key: 'complianceRequired', label: 'Compliance Required' },
        { key: 'highBusinessRisk', label: 'High Business Risk' },
        { key: 'highControlRisk', label: 'High Control Risk' },
      ],
    };
  }

  private async getComplianceDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'compliance-report',
      title: 'Compliance Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'compliance-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
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
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
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
        { key: 'question', label: 'Question', width: '25%' },
        { key: 'auditor_emp_code', label: 'Auditor Code', width: '10%', align: 'center' },
        { key: 'answer_given', label: 'Audit Point', width: '10%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '22%' },
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

  private async getComplianceSummaryDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'compliance-summary-report',
      title: 'Compliance Summary Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'compliance-summary-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
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
          options: [
            { value: '', label: 'Please select audit unit' },
            { value: 'all_branches', label: 'All Branches' },
            ...lookups.auditUnits.filter((opt: any) => opt.value !== ''),
          ],
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
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
        { key: 'question', label: 'Question', width: '31%' },
        { key: 'answer_given', label: 'Audit Point', width: '10%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '10%' },
        { key: 'audit_commpliance', label: 'Compliance', width: '20%' },
        { key: 'business_risk_label', label: 'Business Risk', width: '8%' },
        { key: 'control_risk_label', label: 'Control Risk', width: '8%' },
        { key: 'risk_category', label: 'Risk Type', width: '8%' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Points' },
        { key: 'complianceRequired', label: 'Compliance Required' },
        { key: 'highBusinessRisk', label: 'High Business Risk' },
        { key: 'highControlRisk', label: 'High Control Risk' },
      ],
    };
  }

  private async getRiskWeightageDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'risk-weightage-report',
      title: 'Risk Weightage Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'risk-weightage-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Select Branch / Department',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Assessment',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        {
          key: 'branch_code',
          label: 'Branch Code',
          width: '10%',
          align: 'center',
        },
        { key: 'branch_name', label: 'Branch Name', width: '20%' },
        { key: 'category_name', label: 'Category', width: '10%' },
        { key: 'risk_type', label: 'Risk Type', width: '15%' },
        {
          key: 'total_score',
          label: 'Total Score',
          width: '10%',
          align: 'center',
        },
        {
          key: 'no_of_assessment',
          label: 'Number of Audits Conducted',
          width: '10%',
          align: 'center',
        },
        {
          key: 'avg_tot_score_per_audit',
          label: 'Averaged Total Score Per Audit',
          width: '10%',
          align: 'right',
        },
        {
          key: 'risk_weight',
          label: 'Risk Weight',
          width: '5%',
          align: 'center',
        },
        {
          key: 'weighted_score',
          label: 'Weighted Score',
          width: '10%',
          align: 'right',
        },
        {
          key: 'percent_to_total',
          label: '% To Total Weighted Score',
          width: '10%',
          align: 'right',
        },
      ],
      summaryCards: [{ key: 'total', label: 'Total Weighted Score' }],
    };
  }

  private async getRiskWiseAuditUnitsDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);
    const riskColumns = lookups.riskCategories.flatMap((riskCategory: any) => [
      {
        key: `risk_${riskCategory.value}_score`,
        label: `${riskCategory.label} - Total Risk Score`,
        width: '10%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_branch_percent`,
        label: `${riskCategory.label} (%) To Total Branch Risk`,
        width: '10%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_all_percent`,
        label: `${riskCategory.label} (%) To All Branch Risk`,
        width: '10%',
        align: 'right',
      },
    ]);

    return {
      slug: 'risk-wise-audit-units-report',
      title: 'Risk Wise Audit Units Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'risk-wise-audit-units-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '1',
        financial_year: 'all',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: ['1'],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'All Branches' },
            { value: '2', label: 'All Head Of Departments' },
          ],
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },

        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        {
          key: 'audit_unit_code',
          label: 'BR Code',
          width: '8%',
          align: 'center',
        },
        { key: 'audit_unit_name', label: 'Branch / HO', width: '16%' },
        ...riskColumns,
        {
          key: 'total_score',
          label: 'Total Score',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_score_all_percent',
          label: 'Total Score % to All Branches / HO Departments',
          width: '10%',
          align: 'right',
        },
        {
          key: 'branch_rating',
          label: 'Branch Rating',
          width: '10%',
          align: 'center',
        },
      ],
      summaryCards: [
        { key: 'totalAuditUnits', label: 'Audit Units' },
        { key: 'totalScore', label: 'Total Score' },
      ],
    };
  }

  private async getRiskNpaWiseAuditUnitsDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);
    const riskColumns = lookups.riskCategories.flatMap((riskCategory: any) => [
      {
        key: `risk_${riskCategory.value}_score`,
        label: `${riskCategory.label} - Total Risk Score`,
        width: '10%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_branch_percent`,
        label: `${riskCategory.label} (%) To Total Branch Risk`,
        width: '10%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_all_percent`,
        label: `${riskCategory.label} (%) To All Branch Risk`,
        width: '10%',
        align: 'right',
      },
    ]);

    return {
      slug: 'risk-npa-wise-audit-units-report',
      title: 'Risk & NPA Wise Audit Units Report',
      category: 'Advanced Reports',
      page: 'A5L',
      fileName: 'risk-npa-wise-audit-units-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '1',
        financial_year: 'all',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: ['1'],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'All Branches' },
            { value: '2', label: 'All Head Of Departments' },
          ],
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },

        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        {
          key: 'audit_unit_code',
          label: 'BR Code',
          width: '8%',
          align: 'center',
        },
        { key: 'audit_unit_name', label: 'Branch / HO', width: '16%' },
        ...riskColumns,
        {
          key: 'total_score',
          label: 'Total Score',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_score_all_percent',
          label: 'Total Score % to All Branches / HO Departments',
          width: '10%',
          align: 'right',
        },
        {
          key: 'branch_rating',
          label: 'Branch Rating',
          width: '10%',
          align: 'center',
        },
        {
          key: 'npa_total',
          label: 'NPA (IN Lakhs)',
          width: '10%',
          align: 'right',
        },
        {
          key: 'weighted_score',
          label: 'Weighted Score % (NPA 60% + Risk 40%)',
          width: '12%',
          align: 'right',
        },
        {
          key: 'weighted_npa_rating',
          label: 'Weighted NPA Risk Rating',
          width: '12%',
          align: 'center',
        },
        {
          key: 'total_score_all_percent_with_npa',
          label: 'Total Score % to All Branches / HO Departments With NPA',
          width: '14%',
          align: 'right',
        },
        {
          key: 'actual_npa_rating',
          label: 'Actual NPA Rating',
          width: '12%',
          align: 'center',
        },
      ],
      summaryCards: [
        { key: 'totalAuditUnits', label: 'Audit Units' },
        { key: 'totalScore', label: 'Total Score' },
        { key: 'totalNpa', label: 'Total NPA' },
      ],
    };
  }

  private async getRBIAPerformanceRiskWeightageReportAllUnitsDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    const riskColumns = lookups.riskCategories.flatMap((riskCategory: any) => [
      {
        key: `risk_${riskCategory.value}_highest_score`,
        label: `${riskCategory.label} - Total Score`,
        width: '8%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_obtained_score`,
        label: `${riskCategory.label} - Out of Score`,
        width: '8%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_percent`,
        label: `${riskCategory.label} - %`,
        width: '8%',
        align: 'right',
      },
      {
        key: `risk_${riskCategory.value}_rating`,
        label: `${riskCategory.label} - Risk`,
        width: '8%',
        align: 'center',
      },
    ]);

    return {
      slug: 'rbia-performance-risk-weightage-report-all-units',
      title: 'RBIA - Performance Risk Weightage Report (All Units)',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'rbia-performance-risk-weightage-report-all-units',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '1',
        financial_year: 'all',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'All Branches' },
            { value: '2', label: 'All Head Of Departments' },
          ],
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: true,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        {
          key: 'audit_unit_code',
          label: 'BR Code',
          width: '8%',
          align: 'center',
        },
        { key: 'name', label: 'Branch / HO', width: '16%' },
        {
          key: 'no_of_audits',
          label: 'No of Audits',
          width: '8%',
          align: 'center',
        },
        ...riskColumns,
        {
          key: 'total_highest_score_weighted',
          label: 'Total Score',
          width: '8%',
          align: 'right',
        },
        {
          key: 'total_obtained_score_weighted',
          label: 'Out of Score',
          width: '8%',
          align: 'right',
        },
        { key: 'total_percent', label: '%', width: '8%', align: 'right' },
        { key: 'total_rating', label: 'Risk', width: '8%', align: 'center' },
        {
          key: 'total_score_all_percent',
          label: 'Total Score % to All Branches / HO Departments',
          width: '10%',
          align: 'right',
        },
        {
          key: 'total_all_rating',
          label: 'Total Risk',
          width: '8%',
          align: 'center',
        },
      ],
      summaryCards: [],
    };
  }

  private async getPerformanceRiskWeightageDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'performance-risk-weightage-report',
      title: 'Performance Risk Weightage Report',
      category: 'Advanced Reports',
      page: 'A4',
      fileName: 'performance-risk-weightage-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Audit Assessments',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '5%', align: 'center' },
        { key: 'risk_type', label: 'Risk Type', width: '15%' },
        {
          key: 'risk_weight',
          label: 'Risk Weight',
          width: '7%',
          align: 'right',
        },
        {
          key: 'total_questions',
          label: 'Total Questions Available',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_na_questions',
          label: 'Questions Not Applicable',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_questions_t1',
          label: 'Total Questions Applicable (T1)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_annex_t2',
          label: 'Total Annexures (T2)',
          width: '8%',
          align: 'right',
        },
        {
          key: 'total_questions_t1_t2',
          label: 'Total Questions (T1 + T2)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_highest_score_weighted',
          label: 'Highest Possible Score (Weighted)',
          width: '10%',
          align: 'right',
        },
        {
          key: 'total_obtained_score_weighted',
          label: 'Total Score Obtained (Weighted)',
          width: '10%',
          align: 'right',
        },
        {
          key: 'relative_performance',
          label: 'Relative Performance (%)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'percent_to_total',
          label: '% To Total Score Obtained (Weighted)',
          width: '10%',
          align: 'right',
        },
      ],
      summaryCards: [],
    };
  }

  private async getPerformanceRiskWeightageCategoryWiseDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'performance-risk-weightage-report-category-wise',
      title: 'Performance Risk Weightage Report (Category Wise)',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'performance-risk-weightage-report-category-wise',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Audit Unit',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Audit Assessments',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        { key: 'category', label: 'Category', width: '10%', align: 'left' },
        { key: 'risk_type', label: 'Risk Type', width: '14%', align: 'left' },
        {
          key: 'risk_weight',
          label: 'Risk Weight',
          width: '7%',
          align: 'right',
        },
        {
          key: 'total_questions',
          label: 'Total Questions Available',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_na_questions',
          label: 'Questions Not Applicable',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_questions_t1',
          label: 'Total Questions Applicable (T1)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_annex_t2',
          label: 'Total Annexures (T2)',
          width: '8%',
          align: 'right',
        },
        {
          key: 'total_questions_t1_t2',
          label: 'Total Questions (T1 + T2)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'total_highest_score_weighted',
          label: 'Highest Possible Score (Weighted)',
          width: '10%',
          align: 'right',
        },
        {
          key: 'total_obtained_score_weighted',
          label: 'Total Score Obtained (Weighted)',
          width: '10%',
          align: 'right',
        },
        {
          key: 'relative_performance',
          label: 'Relative Performance (%)',
          width: '9%',
          align: 'right',
        },
        {
          key: 'percent_to_total',
          label: '% To Total Score Obtained (Weighted)',
          width: '10%',
          align: 'right',
        },
      ],
      summaryCards: [],
    };
  }

  private async getAuditCommitteeBoardReport1Definition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'audit-committee-board-report-1',
      title: 'Audit Committee Board Report - 1',
      category: 'Board Reports',
      page: 'A4L',
      fileName: 'audit-committee-board-report-1',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
        trend: '',
        startMonth: '',
        endMonth: '',
        startMonth2: '',
        endMonth2: '',
      },
      filters: [
        {
          key: 'audit_unit_id',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'trend',
          label: 'Trend On',
          type: 'select',
          required: true,
          options: [
            { value: '', label: 'Please select trend' },
            { value: 'rwt', label: 'Risk Wise Trend' },
            { value: 'rswt', label: 'Risk Score Wise Trend' },
          ],
        },
        {
          key: 'startMonth',
          label: 'Trend Period - 1 Start Month [YYYY-MM]',
          type: 'text',
          required: true,
        },
        {
          key: 'endMonth',
          label: 'Trend Period - 1 End Month [YYYY-MM]',
          type: 'text',
          required: true,
        },
        {
          key: 'startMonth2',
          label: 'Trend Period - 2 Start Month [YYYY-MM]',
          type: 'text',
          required: true,
        },
        {
          key: 'endMonth2',
          label: 'Trend Period - 2 End Month [YYYY-MM]',
          type: 'text',
          required: true,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '5%', align: 'center' },
        {
          key: 'audit_unit_details',
          label: 'Audit Unit Details',
          width: '18%',
        },
        {
          key: 'period1_total_risk',
          label: 'Total Risk',
          width: '9%',
          align: 'right',
        },
        {
          key: 'period1_percent',
          label: 'Period 1 - % To All Branch Risk',
          width: '12%',
          align: 'right',
        },
        {
          key: 'period1_risk',
          label: 'Period 1 - Risk Rating',
          width: '10%',
          align: 'center',
        },
        {
          key: 'period2_percent',
          label: 'Period 2 - % To All Branch Risk',
          width: '12%',
          align: 'right',
        },
        {
          key: 'period2_risk',
          label: 'Period 2 - Risk Rating',
          width: '10%',
          align: 'center',
        },
        {
          key: 'period2_total_risk',
          label: 'Total Risk',
          width: '9%',
          align: 'right',
        },
        { key: 'trend_label', label: 'Trend', width: '8%', align: 'center' },
        {
          key: 'change_in_risk_score',
          label: 'Change in Risk Score',
          width: '10%',
          align: 'right',
        },
      ],
      summaryCards: [
        { key: 'totalAuditUnits', label: 'Audit Units' },
        { key: 'overallTrend', label: 'Overall Trend' },
        { key: 'changeInRiskScore', label: 'Change in Risk Score' },
      ],
    };
  }
  private async getBroaderAreaWiseScoringDefinition(isFreeFlow = false) {
    const lookups = await this.getAuditCompleteLookups(isFreeFlow);

    return {
      slug: 'broader-areawise-scoring-report',
      title: 'Broader Areawise Scoring Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'broader-areawise-scoring-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Select Branch / Department',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Assessment',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        {
          key: 'branch_code',
          label: 'Audit Unit Code',
          width: '5%',
          align: 'center',
        },
        { key: 'branch_name', label: 'Branch', width: '8%' },
        { key: 'risk_type', label: 'Risk Type', width: '6%' },
        { key: 'category_name', label: 'Category', width: '6%' },
        {
          key: 'broader_area_name',
          label: 'Broader Area of Audit Non-Compliance',
          width: '12%',
        },

        { key: 'qual_1_1', label: 'BR-H Qual H', width: '3%', align: 'center' },
        { key: 'qual_1_2', label: 'BR-H Qual M', width: '3%', align: 'center' },
        { key: 'qual_1_3', label: 'BR-H Qual L', width: '3%', align: 'center' },
        { key: 'quan_1_1', label: 'BR-H Quan H', width: '3%', align: 'center' },
        { key: 'quan_1_2', label: 'BR-H Quan M', width: '3%', align: 'center' },
        { key: 'quan_1_3', label: 'BR-H Quan L', width: '3%', align: 'center' },

        { key: 'qual_2_1', label: 'BR-M Qual H', width: '3%', align: 'center' },
        { key: 'qual_2_2', label: 'BR-M Qual M', width: '3%', align: 'center' },
        { key: 'qual_2_3', label: 'BR-M Qual L', width: '3%', align: 'center' },
        { key: 'quan_2_1', label: 'BR-M Quan H', width: '3%', align: 'center' },
        { key: 'quan_2_2', label: 'BR-M Quan M', width: '3%', align: 'center' },
        { key: 'quan_2_3', label: 'BR-M Quan L', width: '3%', align: 'center' },

        { key: 'qual_3_1', label: 'BR-L Qual H', width: '3%', align: 'center' },
        { key: 'qual_3_2', label: 'BR-L Qual M', width: '3%', align: 'center' },
        { key: 'qual_3_3', label: 'BR-L Qual L', width: '3%', align: 'center' },
        { key: 'quan_3_1', label: 'BR-L Quan H', width: '3%', align: 'center' },
        { key: 'quan_3_2', label: 'BR-L Quan M', width: '3%', align: 'center' },
        { key: 'quan_3_3', label: 'BR-L Quan L', width: '3%', align: 'center' },

        {
          key: 'qual_tot',
          label: 'Qualitative Score',
          width: '4%',
          align: 'center',
        },
        {
          key: 'quan_tot',
          label: 'Quantitative Score',
          width: '4%',
          align: 'center',
        },
        {
          key: 'total_qual_quan',
          label: 'Total Score Before Averaging',
          width: '5%',
          align: 'center',
        },
        {
          key: 'acc_non_compliant',
          label: 'No. Of Accounts Non-Compliant',
          width: '4%',
          align: 'center',
        },
        {
          key: 'no_of_acc_checked',
          label: 'No Of Accounts Checked',
          width: '4%',
          align: 'center',
        },
        {
          key: 'avg_quan_score',
          label: 'Averaged Quantitative Score',
          width: '4%',
          align: 'right',
        },
        {
          key: 'tot_avg_score',
          label: 'Total Averaged Score',
          width: '4%',
          align: 'right',
        },
        {
          key: 'no_of_audit_conduct',
          label: 'Number of Audits Conducted',
          width: '4%',
          align: 'center',
        },
        {
          key: 'avg_tot_score_per_audit',
          label: 'Averaged Total Score Per Audit',
          width: '4%',
          align: 'right',
        },
        {
          key: 'risk_weight',
          label: 'Risk Weight',
          width: '3%',
          align: 'center',
        },
        {
          key: 'weighted_score',
          label: 'Weighted Score',
          width: '4%',
          align: 'right',
        },
      ],
      summaryCards: [{ key: 'total', label: 'Total Weighted Score' }],
    };
  }

  private async getQuestionWiseBroaderAreaDefinition(isFreeFlow = false) {
    const lookups = await this.getAuditCompleteLookups(isFreeFlow);

    return {
      slug: 'questionwsie-broader-areawise-report',
      title: 'Question Wise BroaderArea Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'question-wise-broader-area-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'All Branches' },
            { value: '2', label: 'All Head Of Departments' },
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Select Branch / Department',
          type: 'select',
          required: false,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: false,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Assessment',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
        {
          key: 'rmv_pending_assesments',
          label: 'Remove Pending Assessments',
          type: 'checkbox',
          options: [{ value: '1', label: 'Remove Pending Assessments' }],
        },
      ],
      columns: [
        { key: 'audit_unit_code', label: 'Audit Unit Code' },
        { key: 'qcat', label: 'QCAT' },
        { key: 'branch_name', label: 'Branch' },
        { key: 'risk_type', label: 'Risk Type' },
        { key: 'broader_area', label: 'Broader Area of Audit Non-Compliance' },
        { key: 'menu_category', label: 'Menu & Category' },
        { key: 'question', label: 'Question' },
        { key: 'total_avg_score', label: 'Total Avg Score', align: 'right' },
        { key: 'no_of_audits', label: 'No. of Audits', align: 'right' },
        { key: 'avg_score_per_audit', label: 'Avg Score / Audit', align: 'right' },
        { key: 'risk_weight', label: 'Risk Weight', align: 'right' },
        { key: 'weighted_score', label: 'Weighted Score', align: 'right' },
        { key: 'total_ba_weighted_score', label: 'Total BA Weighted Score', align: 'right' },
      ],
    };
  }

  async getQuestionWiseBroaderAreaReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : null;
    const endDate = query.endDate ? String(query.endDate).trim() : null;
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    // Step 1: Find matching assessments
    let assessments: any[] = [];

    // Status condition
    const statusCondition = removePending
      ? (isFreeFlow ? 'AND aam.audit_status_id >= 4' : 'AND aam.audit_status_id > 4')
      : (isFreeFlow ? 'AND aam.audit_status_id >= 1' : 'AND aam.audit_status_id > 1');

    if (searchType === '3' || searchType === '4') {
      if (!auditUnitId || !assessmentId) {
        throw new BadRequestException('Audit unit and assessment are required');
      }
      const result = await this.db.query(
        `
        SELECT aam.id, aam.year_id, aam.audit_unit_id, aam.assesment_period_from, aam.assesment_period_to, aam.frequency, aum.name as branch_name, aum.audit_unit_code
        FROM audit_assesment_master aam
        INNER JOIN audit_unit_master aum ON aam.audit_unit_id = aum.id
        WHERE aam.id = $1
          AND aam.audit_unit_id = $2
          AND aam.deleted_at IS NULL
          AND aum.deleted_at IS NULL
        `,
        [assessmentId, auditUnitId],
      );
      assessments = result.rows;
    } else if (searchType === '5' || searchType === '6') {
      if (!auditUnitId || !startDate || !endDate) {
        throw new BadRequestException('Audit unit and date range are required');
      }
      const result = await this.db.query(
        `
        SELECT aam.id, aam.year_id, aam.audit_unit_id, aam.assesment_period_from, aam.assesment_period_to, aam.frequency, aum.name as branch_name, aum.audit_unit_code
        FROM audit_assesment_master aam
        INNER JOIN audit_unit_master aum ON aam.audit_unit_id = aum.id
        WHERE aam.audit_unit_id = $1
          AND aam.assesment_period_from >= $2
          AND aam.assesment_period_to <= $3
          ${statusCondition}
          AND aam.deleted_at IS NULL
          AND aum.deleted_at IS NULL
        ORDER BY aam.id ASC
        `,
        [auditUnitId, startDate, endDate],
      );
      assessments = result.rows;
    } else if (searchType === '1' || searchType === '2') {
      if (!startDate || !endDate) {
        throw new BadRequestException('Date range is required');
      }
      const unitTypeId = searchType === '2' ? 2 : 1; // 2 for departments, 1 for branches
      const result = await this.db.query(
        `
        SELECT aam.id, aam.year_id, aam.audit_unit_id, aam.assesment_period_from, aam.assesment_period_to, aam.frequency, aum.name as branch_name, aum.audit_unit_code
        FROM audit_assesment_master aam
        INNER JOIN audit_unit_master aum ON aam.audit_unit_id = aum.id
        WHERE aum.section_type_id = $1
          AND aam.assesment_period_from >= $2
          AND aam.assesment_period_to <= $3
          ${statusCondition}
          AND aam.deleted_at IS NULL
          AND aum.deleted_at IS NULL
        ORDER BY aam.id ASC
        `,
        [unitTypeId, startDate, endDate],
      );
      assessments = result.rows;
    }

    if (!assessments.length) {
      throw new BadRequestException('No assessments found for selected filters.');
    }

    const assessmentIds = assessments.map((a) => Number(a.id));
    const firstYearId = Number(assessments[0].year_id);

    // Fetch Risk Matrix for score calculation
    const riskMatrixResult = await this.db.query(
      `
      SELECT risk_parameter, business_risk_score, control_risk_score
      FROM risk_matrix
      WHERE year_id = $1
        AND deleted_at IS NULL
      `,
      [firstYearId],
    );

    // Fetch Risk Category Weights
    const riskCategoriesResult = await this.db.query(
      `
      SELECT
        rcm.id,
        COALESCE(rcw.risk_weight, 0) AS risk_weight
      FROM risk_category_master rcm
      LEFT JOIN risk_category_weights rcw
        ON rcw.risk_category_id = rcm.id
        AND rcw.year_id = $1
        AND rcw.is_active = 1
        AND rcw.deleted_at IS NULL
      WHERE rcm.is_active = 1
        AND rcm.deleted_at IS NULL
      `,
      [firstYearId],
    );
    const riskWeightsMap = new Map<number, number>();
    riskCategoriesResult.rows.forEach((row: any) => {
      riskWeightsMap.set(Number(row.id), Number(row.risk_weight || 0));
    });

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();
    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);
      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }
      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    // Step 2: Fetch all answers for the selected assessments
    const answersResult = await this.db.query(
      `
      SELECT 
        ad.id AS answer_id,
        ad.assesment_id,
        ad.question_id,
        ad.dump_id,
        ad.answer_given,
        ad.business_risk,
        ad.control_risk,
        ad.category_id,
        ad.menu_id,
        qm.question,
        qm.risk_category_id,
        rcm.risk_category AS risk_type_name,
        qm.area_of_audit_id,
        aam.name AS broader_area_name,
        cm.name AS category_name,
        cm.linked_table_id,
        mm.name AS menu_name,
        aum.audit_unit_code,
        aum.name AS branch_name
      FROM answers_data ad
      INNER JOIN question_master qm ON ad.question_id = qm.id
      INNER JOIN audit_assesment_master asm ON ad.assesment_id = asm.id
      INNER JOIN audit_unit_master aum ON asm.audit_unit_id = aum.id
      LEFT JOIN risk_category_master rcm ON qm.risk_category_id = rcm.id
      LEFT JOIN audit_area_master aam ON qm.area_of_audit_id = aam.id
      LEFT JOIN category_master cm ON ad.category_id = cm.id
      LEFT JOIN menu_master mm ON ad.menu_id = mm.id
      WHERE ad.assesment_id = ANY($1::int[])
        AND ad.deleted_at IS NULL
        AND qm.deleted_at IS NULL
        AND asm.deleted_at IS NULL
      `,
      [assessmentIds],
    );

    const answerIds = answersResult.rows.map((row: any) => Number(row.answer_id));

    // Fetch all annexure row answers for these answers
    const annexuresResult = answerIds.length
      ? await this.db.query(
        `
          SELECT
            answer_id,
            business_risk,
            control_risk
          FROM answers_data_annexure
          WHERE answer_id = ANY($1::int[])
            AND deleted_at IS NULL
          `,
        [answerIds],
      )
      : { rows: [] };

    const annexuresMap = new Map<number, any[]>();
    annexuresResult.rows.forEach((annRow: any) => {
      const answerId = Number(annRow.answer_id);
      if (!annexuresMap.has(answerId)) {
        annexuresMap.set(answerId, []);
      }
      annexuresMap.get(answerId)!.push(annRow);
    });

    // Group answers by: assessment_id and question_id (to calculate average score per question per assessment)
    // Map structure: question_id -> Map(assessment_id -> array of scores)
    const questionAssessmentScores = new Map<number, Map<number, number[]>>();
    const questionDetails = new Map<number, any>();

    answersResult.rows.forEach((row: any) => {
      const qId = Number(row.question_id);
      const assesId = Number(row.assesment_id);

      if (!questionDetails.has(qId)) {
        const riskWeight = riskWeightsMap.get(Number(row.risk_category_id)) || 0;
        questionDetails.set(qId, {
          audit_unit_code: row.audit_unit_code || '-',
          branch_name: row.branch_name || '-',
          qcat: !row.linked_table_id ? 'GENERAL' : (Number(row.linked_table_id) === 1 ? 'DEPOSITS' : 'ADVANCES'),
          risk_type: row.risk_type_name || '-',
          broader_area: row.broader_area_name || '-',
          menu_category: `Menu: ${row.menu_name || '-'}\nCategory: ${row.category_name || '-'}`,
          question: `QUESTION: ${row.question || '-'}`,
          risk_weight: riskWeight,
        });
      }

      if (!questionAssessmentScores.has(qId)) {
        questionAssessmentScores.set(qId, new Map<number, number[]>());
      }

      const assesMap = questionAssessmentScores.get(qId)!;
      if (!assesMap.has(assesId)) {
        assesMap.set(assesId, []);
      }

      const annexData = annexuresMap.get(Number(row.answer_id)) || [];
      if (annexData.length > 0) {
        // Annexure question: score is calculated from annexure rows
        annexData.forEach((ann: any) => {
          const score = matrixScore(ann.business_risk, ann.control_risk);
          assesMap.get(assesId)!.push(score);
        });
      } else {
        // Regular question
        if (String(row.answer_given).toUpperCase() !== 'NOT APPLICABLE') {
          const score = matrixScore(row.business_risk, row.control_risk);
          assesMap.get(assesId)!.push(score);
        }
      }
    });

    // Now build the final rows by aggregating across all assessments
    const flatRows: any[] = [];

    questionAssessmentScores.forEach((assesMap, qId) => {
      const details = questionDetails.get(qId);
      let totalAvgScore = 0;
      let noOfAudits = 0;

      assesMap.forEach((scores) => {
        if (scores.length > 0) {
          const avgScoreForAssessment = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          totalAvgScore += avgScoreForAssessment;
          noOfAudits += 1;
        }
      });

      if (noOfAudits > 0) {
        const avgScorePerAudit = totalAvgScore / noOfAudits;

        const weightedScore = avgScorePerAudit * details.risk_weight;
        const totalBaWeightedScore = (Math.ceil((weightedScore / 12) * 100) / 100).toFixed(2);

        flatRows.push({
          audit_unit_code: details.audit_unit_code,
          qcat: details.qcat,
          branch_name: details.branch_name,
          risk_type: details.risk_type,
          broader_area: details.broader_area,
          menu_category: details.menu_category,
          question: details.question,
          total_avg_score: Number(totalAvgScore.toFixed(3)),
          no_of_audits: Number(noOfAudits.toFixed(3)),
          avg_score_per_audit: Number(avgScorePerAudit.toFixed(3)),
          risk_weight: Number(details.risk_weight.toFixed(3)),
          weighted_score: Number(weightedScore.toFixed(3)),
          total_ba_weighted_score: totalBaWeightedScore,
        });
      }
    });

    // Sort by audit_unit_code, qcat, broader_area, question
    flatRows.sort((a, b) => {
      const cmpCode = String(a.audit_unit_code).localeCompare(String(b.audit_unit_code));
      if (cmpCode !== 0) return cmpCode;

      const cmpQcat = String(a.qcat).localeCompare(String(b.qcat));
      if (cmpQcat !== 0) return cmpQcat;

      const cmpArea = String(a.broader_area).localeCompare(String(b.broader_area));
      if (cmpArea !== 0) return cmpArea;

      return String(a.question).localeCompare(String(b.question));
    });

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
        startDate: startDate || '',
        endDate: endDate || '',
      },
      total: flatRows.length,
      generatedAt: new Date().toISOString(),
      rows: flatRows,
    };
  }

  private async getQuestionWiseScoringDefinition(isFreeFlow = false) {
    const lookups = await this.getAuditCompleteLookups(isFreeFlow);

    return {
      slug: 'question-wise-scoring-report',
      title: 'Question Wise Scoring Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'question-wise-scoring-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
        rmv_pending_assesments: [],
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Select Branch / Department',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Assessment',
          type: 'select',
          required: true,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
      ],
      columns: [
        { key: 'menu_name', label: 'Menu Name' },
        { key: 'risk_category', label: 'Risk Category' },
        { key: 'category_name', label: 'Category Name' },
        { key: 'account_no', label: 'Account No' },
        { key: 'account_holder_name', label: 'Account Holder' },
        { key: 'question', label: 'Question' },
        { key: 'answer_given', label: 'Answer' },
        { key: 'audit_comment', label: 'Comment' },
        { key: 'risk_score', label: 'Risk Score' },
        { key: 'weighted_risk_score', label: 'Weighted Score' },
        { key: 'highest_weightage_risk', label: 'Max Score' },
      ],
    };
  }

  private async getAuditObservationCountDefinition() {
    const lookups = await this.getAuditStatusLookups();

    return {
      slug: 'audit-observation-count-report',
      title: 'Audit Observation Count Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'audit-observation-count-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        reportAuditUnit: 'all_branches',
        financial_year: 'all',
        startDate: '',
        endDate: '',
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
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: true,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '5%', align: 'center' },
        { key: 'audit_unit_name', label: 'Audit Unit', width: '20%' },
        { key: 'assessment_period', label: 'Assesment Period', width: '15%' },
        { key: 'audit_status_label', label: 'Audit Status', width: '20%' },
        { key: 'audited', label: 'Audited', width: '10%', align: 'center' },
        {
          key: 'pending_observations',
          label: 'Pending Observations',
          width: '10%',
          align: 'center',
        },
        { key: 'completed', label: 'Completed', width: '10%', align: 'center' },
      ],
      summaryCards: [
        { key: 'totalAssessments', label: 'Assessments' },
        { key: 'totalAudited', label: 'Audited' },
        { key: 'totalPending', label: 'Pending Observations' },
        { key: 'totalCompleted', label: 'Completed' },
      ],
    };
  }

  private async getPendingComplianceDetailDefinition(isFreeFlow = false) {
    const lookups = await this.getComplianceLookups(isFreeFlow);

    return {
      slug: 'pending-compliance-detail-report',
      title: 'Pending Compliance Detailed Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'pending-compliance-detail-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
        startDate: '',
        endDate: '',
      },
      filters: [
        {
          key: 'selectSearchTypeFilter',
          label: 'Search Type',
          type: 'select',
          required: true,
          options: [
            { value: '3', label: 'Single Branch (Assessment Wise)' },
            { value: '4', label: 'Single Department (Assessment Wise)' },
            { value: '5', label: 'Single Branch Wise' },
            { value: '6', label: 'Single Head Of Department Wise' },
          ],
        },
        {
          key: 'reportAuditUnit',
          label: 'Select Branch / Department',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Assessment',
          type: 'select',
          required: false,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
        },
        {
          key: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
        },
      ],
      columns: [
        { key: 'sr_no', label: 'Sr. No', width: '5%', align: 'center' },
        { key: 'question', label: 'Question', width: '26%' },
        { key: 'answer_given', label: 'Audit Point', width: '9%' },
        { key: 'audit_comment', label: 'Audit Comment', width: '13%' },
        { key: 'audit_commpliance', label: 'Compliance', width: '18%' },
        { key: 'business_risk_label', label: 'Business Risk', width: '7%' },
        { key: 'control_risk_label', label: 'Control Risk', width: '7%' },
        { key: 'risk_category', label: 'Risk Type', width: '7%' },
        {
          key: 'compliance_reviewer_comment',
          label: 'Reviewer Comment',
          width: '10%',
        },
      ],
      summaryCards: [
        { key: 'total', label: 'Pending Points' },
        { key: 'assessments', label: 'Assessments' },
      ],
    };
  }

  async getReportData(reportSlug: string, query: any) {
    if (reportSlug === 'carry-forward-report') {
      return this.getCarryForwardReport(query);
    }

    if (reportSlug === 'partially-pass-report') {
      return this.getPartiallyPassReport(query);
    }

    if (reportSlug === 'audit-complete-report') {
      return this.getAuditCompleteReport(query);
    }

    if (reportSlug === 'audit-observations-report') {
      return this.getAuditObservationsReport(query);
    }

    if (reportSlug === 'compliance-report') {
      return this.getComplianceReport(query);
    }

    if (reportSlug === 'compliance-summary-report') {
      return this.getComplianceSummaryReport(query);
    }

    if (reportSlug === 'risk-weightage-report') {
      return this.getRiskWeightageReport(query);
    }

    if (reportSlug === 'risk-wise-audit-units-report') {
      return this.getRiskWiseAuditUnitsReport(query);
    }

    if (reportSlug === 'risk-npa-wise-audit-units-report') {
      return this.getRiskNpaWiseAuditUnitsReport(query);
    }

    if (reportSlug === 'rbia-performance-risk-weightage-report-all-units') {
      return this.getRBIAPerformanceRiskWeightageReportAllUnitsReport(query);
    }

    if (reportSlug === 'performance-risk-weightage-report') {
      return this.getPerformanceRiskWeightageReport(query);
    }

    if (reportSlug === 'performance-risk-weightage-report-category-wise') {
      return this.getPerformanceRiskWeightageCategoryWiseReport(query);
    }

    if (reportSlug === 'audit-committee-board-report-1') {
      return this.getAuditCommitteeBoardReport1(query);
    }

    if (reportSlug === 'broader-areawise-scoring-report') {
      return this.getBroaderAreaWiseScoringReport(query);
    }

    if (reportSlug === 'questionwsie-broader-areawise-report') {
      return this.getQuestionWiseBroaderAreaReport(query);
    }

    if (reportSlug === 'question-wise-scoring-report') {
      return this.getQuestionWiseScoringReport(query);
    }

    if (reportSlug === 'audit-observation-count-report') {
      return this.getAuditObservationCountReport(query);
    }

    if (reportSlug === 'pending-compliance-detail-report') {
      return this.getPendingComplianceDetailReport(query);
    }

    if (reportSlug === 'executive-summary-audit-report') {
      return this.getExecutiveSummaryReport(query, false);
    }

    if (reportSlug === 'executive-summary-compliance-report') {
      return this.getExecutiveSummaryReport(query, true);
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

    if (reportSlug === 'internal-assesment-report') {
      return this.getInternalAssessmentReport(query);
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

  async getAuditCompleteLookups(isFreeFlow = false) {
    const [units, assessments, riskCategories, years] = await Promise.all([
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
          COALESCE(asm.audit_type_id, 1) AS audit_type_id,
          asm.year_id,
          asm.audit_unit_id,
          asm.assesment_period_from,
          asm.assesment_period_to,
          asm.frequency,
          aum.audit_unit_code,
          aum.name AS audit_unit_name
        FROM audit_assesment_master asm
        INNER JOIN audit_unit_master aum
          ON aum.id = asm.audit_unit_id
        WHERE ${isFreeFlow ? 'asm.audit_status_id >= 1' : 'asm.audit_status_id > 1'}
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
      this.db.query(`
        SELECT id, year
        FROM year_master
        WHERE deleted_at IS NULL
        ORDER BY id DESC
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
          audit_type_id: String(row.audit_type_id || '1'),
          year_id: String(row.year_id || ''),
        })),
      ],
      riskCategories: riskCategories.rows.map((row: any) => ({
        value: String(row.id),
        label: String(row.risk_category || '').toUpperCase(),
      })),
      years: [
        { value: 'all', label: 'All Years' },
        ...years.rows.map((row: any) => ({
          value: String(row.id),
          label: String(row.year),
        })),
      ],
    };
  }

  async getComplianceLookups(isFreeFlow = false) {
    const [units, assessments, riskCategories, years] = await Promise.all([
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
          COALESCE(asm.audit_type_id, 1) AS audit_type_id,
          asm.year_id,
          asm.audit_unit_id,
          asm.assesment_period_from,
          asm.assesment_period_to,
          asm.frequency,
          aum.audit_unit_code,
          aum.name AS audit_unit_name
        FROM audit_assesment_master asm
        INNER JOIN audit_unit_master aum
          ON aum.id = asm.audit_unit_id
        WHERE ${isFreeFlow ? 'asm.audit_status_id >= 4' : 'asm.audit_status_id > 4'}
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
      this.db.query(`
        SELECT id, year
        FROM year_master
        WHERE deleted_at IS NULL
        ORDER BY id DESC
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
          audit_type_id: String(row.audit_type_id || '1'),
          year_id: String(row.year_id || ''),
        })),
      ],
      riskCategories: riskCategories.rows.map((row: any) => ({
        value: String(row.id),
        label: String(row.risk_category || '').toUpperCase(),
      })),
      years: [
        { value: 'all', label: 'All Years' },
        ...years.rows.map((row: any) => ({
          value: String(row.id),
          label: String(row.year),
        })),
      ],
    };
  }

  async getAssessmentTimelineLookups() {
    const [units, assessments, years] = await Promise.all([
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
          COALESCE(asm.audit_type_id, 1) AS audit_type_id,
          asm.year_id,
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
      this.db.query(`
        SELECT id, year
        FROM year_master
        WHERE deleted_at IS NULL
        ORDER BY id DESC
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
          audit_type_id: String(row.audit_type_id || '1'),
          year_id: String(row.year_id || ''),
        })),
      ],
      years: [
        { value: 'all', label: 'All Years' },
        ...years.rows.map((row: any) => ({
          value: String(row.id),
          label: String(row.year),
        })),
      ],
    };
  }

  async getAuditObservationCountReport(query: any) {
    const auditUnit = String(query.reportAuditUnit || '').trim();
    const startDate = this.dateOnly(query.startDate);
    const endDate = this.dateOnly(query.endDate);
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!auditUnit) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!startDate) {
      throw new BadRequestException('Start date is required');
    }

    if (!endDate) {
      throw new BadRequestException('End date is required');
    }

    const params: any[] = [startDate, endDate];
    const where = [
      'asm.assesment_period_from >= $1',
      'asm.assesment_period_to <= $2',
      isFreeFlow ? 'asm.audit_status_id >= 1' : 'asm.audit_status_id > 1',
      'asm.deleted_at IS NULL',
      'aum.deleted_at IS NULL',
    ];

    if (auditUnit === 'all_branches') {
      where.push('aum.section_type_id = 1');
    } else if (auditUnit === 'all_head_of_dept') {
      where.push('aum.section_type_id != 1');
    } else {
      params.push(Number(auditUnit));
      where.push(`asm.audit_unit_id = $${params.length}`);
    }

    const assessmentResult = await this.db.query(
      `
      SELECT
        asm.id,
        asm.audit_unit_id,
        asm.assesment_period_from,
        asm.assesment_period_to,
        asm.frequency,
        asm.audit_status_id,
        aum.audit_unit_code,
        aum.name AS audit_unit_name,
        aum.section_type_id
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      WHERE ${where.join(' AND ')}
      ORDER BY aum.audit_unit_code ASC, asm.audit_unit_id ASC
      `,
      params,
    );

    const assessments = assessmentResult.rows;
    const assessmentIds = assessments.map((row: any) => Number(row.id));

    if (!assessmentIds.length) {
      return {
        filters: {
          reportAuditUnit: auditUnit,
          startDate,
          endDate,
        },
        generatedAt: new Date().toISOString(),
        rows: [],
        summary: {
          totalAssessments: 0,
          totalAudited: 0,
          totalPending: 0,
          totalCompleted: 0,
        },
      };
    }

    const [answerResult, annexureResult] = await Promise.all([
      this.db.query(
        `
        SELECT
          ans.id,
          ans.assesment_id,
          ans.audit_status_id,
          ans.compliance_status_id
        FROM answers_data ans
        INNER JOIN question_master qm
          ON qm.id = ans.question_id
        WHERE ans.assesment_id = ANY($1::int[])
          AND qm.option_id != 4
          AND ans.is_compliance = '1'
          AND ans.deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT
          ax.id,
          ax.assesment_id,
          ax.audit_status_id,
          ax.compliance_status_id
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans
          ON ans.id = ax.answer_id
        INNER JOIN question_master qm
          ON qm.id = ans.question_id
        WHERE ax.assesment_id = ANY($1::int[])
          AND qm.option_id = 4
          AND (
            NULLIF(ax.business_risk::text, '')::int IN (1, 2, 3)
            OR NULLIF(ax.control_risk::text, '')::int IN (1, 2, 3)
          )
          AND ax.deleted_at IS NULL
        `,
        [assessmentIds],
      ),
    ]);

    const countMap = new Map<number, { audited: number; pending: number }>();
    assessments.forEach((assessment: any) => {
      countMap.set(Number(assessment.id), { audited: 0, pending: 0 });
    });

    [...answerResult.rows, ...annexureResult.rows].forEach(
      (observation: any) => {
        const assessmentId = Number(observation.assesment_id);
        const counts = countMap.get(assessmentId);
        const assessment = assessments.find(
          (row: any) => Number(row.id) === assessmentId,
        );

        if (!counts || !assessment) {
          return;
        }

        counts.audited++;

        if (
          this.isPendingObservation(
            Number(assessment.audit_status_id),
            observation,
          )
        ) {
          counts.pending++;
        }
      },
    );

    const rows = assessments.map((assessment: any, index: number) => {
      const counts = countMap.get(Number(assessment.id)) || {
        audited: 0,
        pending: 0,
      };
      const auditStatusId = Number(assessment.audit_status_id || 0);
      const pending = auditStatusId === 7 ? 0 : counts.pending;
      const completed =
        auditStatusId === 7 ? counts.audited : counts.audited - pending;

      return {
        sr_no: index + 1,
        audit_unit_id: assessment.audit_unit_id,
        audit_unit_name: this.auditUnitName(assessment),
        assessment_period: `${this.dateOnly(assessment.assesment_period_from)} to ${this.dateOnly(assessment.assesment_period_to)} (Frequency: ${assessment.frequency || '-'} Months)`,
        audit_status_id: auditStatusId,
        audit_status_label: this.auditTimelineStatusLabel(auditStatusId),
        audited: counts.audited,
        pending_observations: pending,
        completed,
      };
    });

    return {
      filters: {
        reportAuditUnit: auditUnit,
        startDate,
        endDate,
      },
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: `${startDate} to ${endDate}`,
      },
      rows,
      summary: {
        totalAssessments: rows.length,
        totalAudited: rows.reduce((sum, row) => sum + row.audited, 0),
        totalPending: rows.reduce(
          (sum, row) => sum + row.pending_observations,
          0,
        ),
        totalCompleted: rows.reduce((sum, row) => sum + row.completed, 0),
      },
    };
  }

  async getAuditCompleteReport(query: any) {
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

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
      isFreeFlow ? 'aam.audit_status_id >= 1' : 'aam.audit_status_id > 1',
      'ad.deleted_at IS NULL',
      'qm.deleted_at IS NULL',
    ];

    this.applyAssessmentAuditTypeFilter(where, params, query, 'aam.audit_type_id');

    if (riskCategoryIds.length) {
      params.push(riskCategoryIds);
      where.push(`qm.risk_category_id = ANY($${params.length}::int[])`);
    }

    if (businessRiskIds.length) {
      params.push(businessRiskIds);
      where.push(
        `NULLIF(ad.business_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    if (controlRiskIds.length) {
      params.push(controlRiskIds);
      where.push(
        `NULLIF(ad.control_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    const result = await this.db.query(
      `
      SELECT
        ad.id,
        auditor.emp_code AS auditor_emp_code,
        aam.is_multiple_auditors,
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
      LEFT JOIN employee_master auditor
        ON auditor.id = ad.audit_emp_id
      WHERE ${where.join(' AND ')}
      ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id
      `,
      params,
    );

    const answerIds = result.rows
      .map((row: any) => Number(row.id))
      .filter(Boolean);
    const annexureRowsByAnswer = await this.getAuditCompleteAnnexureRows(
      assessmentId,
      answerIds,
    );

    const questionRows = result.rows.map((row: any, index: number) => ({
      sr_no: 0,
      ...row,
      is_multiple_auditors: !!row.is_multiple_auditors,
      auditor_emp_code: row.auditor_emp_code || '-',
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      risk_category: row.risk_category || '-',
      business_risk_label: this.riskParameterLabel(row.business_risk),
      control_risk_label: this.riskParameterLabel(row.control_risk),
      __account_key: this.accountDetailKey(row),
      __account_details: this.accountDetailRows(row),
      __is_vouching: this.isVouchingTransactionRow(row),
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
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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
        complianceRequired: questionRows.filter(
          (row) => Number(row.is_compliance) === 1,
        ).length,
        highBusinessRisk: questionRows.filter(
          (row) => Number(row.business_risk) === 1,
        ).length,
        highControlRisk: questionRows.filter(
          (row) => Number(row.control_risk) === 1,
        ).length,
      },
    };
  }

  async getAuditObservationsReport(query: any) {
    return this.getAuditCompleteReport(query);
  }

  async getComplianceReport(query: any) {
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

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
      isFreeFlow ? 'aam.audit_status_id >= 1' : 'aam.audit_status_id > 1',
      'ad.deleted_at IS NULL',
      'qm.deleted_at IS NULL',
      'ad.is_compliance = 1',
    ];

    this.applyAssessmentAuditTypeFilter(where, params, query, 'aam.audit_type_id');

    if (riskCategoryIds.length) {
      params.push(riskCategoryIds);
      where.push(`qm.risk_category_id = ANY($${params.length}::int[])`);
    }

    if (businessRiskIds.length) {
      params.push(businessRiskIds);
      where.push(
        `NULLIF(ad.business_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    if (controlRiskIds.length) {
      params.push(controlRiskIds);
      where.push(
        `NULLIF(ad.control_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    const result = await this.db.query(
      `
      SELECT
        ad.id,
        auditor.emp_code AS auditor_emp_code,
        aam.is_multiple_auditors,
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
      LEFT JOIN employee_master auditor
        ON auditor.id = ad.audit_emp_id
      WHERE ${where.join(' AND ')}
      ORDER BY ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id
      `,
      params,
    );

    const answerIds = result.rows
      .map((row: any) => Number(row.id))
      .filter(Boolean);
    const annexureRowsByAnswer = await this.getAuditCompleteAnnexureRows(
      assessmentId,
      answerIds,
    );

    const questionRows = result.rows.map((row: any) => ({
      sr_no: 0,
      ...row,
      is_multiple_auditors: !!row.is_multiple_auditors,
      auditor_emp_code: row.auditor_emp_code || '-',
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      risk_category: row.risk_category || '-',
      business_risk_label: this.riskParameterLabel(row.business_risk),
      control_risk_label: this.riskParameterLabel(row.control_risk),
      __account_key: this.accountDetailKey(row),
      __account_details: this.accountDetailRows(row),
      __is_vouching: this.isVouchingTransactionRow(row),
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
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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
        complianceRequired: questionRows.filter(
          (row) => Number(row.is_compliance) === 1,
        ).length,
        highBusinessRisk: questionRows.filter(
          (row) => Number(row.business_risk) === 1,
        ).length,
        highControlRisk: questionRows.filter(
          (row) => Number(row.control_risk) === 1,
        ).length,
      },
    };
  }

  async getComplianceSummaryReport(query: any) {
    const isAllBranches = query.reportAuditUnit === 'all_branches';
    const auditUnitId = isAllBranches ? null : Number(query.reportAuditUnit || 0);
    const assessmentId = isAllBranches ? null : Number(query.reportAuditAssesment || 0);
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!isAllBranches && !auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!isAllBranches && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    const riskCategoryIds = this.toNumberArray(query.risk_category_arr);
    const businessRiskIds = this.toNumberArray(query.business_risk_arr);
    const controlRiskIds = this.toNumberArray(query.control_risk_arr);
    const params: any[] = [];
    const where = [
      isFreeFlow ? 'aam.audit_status_id >= 1' : 'aam.audit_status_id > 1',
      'ad.deleted_at IS NULL',
      'qm.deleted_at IS NULL',
      'ad.is_compliance = 1',
    ];

    if (isAllBranches) {
      where.push(
        'aam.audit_unit_id IN (SELECT id FROM audit_unit_master WHERE section_type_id = 1 AND deleted_at IS NULL)',
      );
      const financialYear = query.financial_year;
      if (financialYear && financialYear !== 'all') {
        params.push(Number(financialYear));
        where.push(`aam.year_id = $${params.length}`);
      }
    } else {
      params.push(assessmentId);
      where.push(`ad.assesment_id = $${params.length}`);
      params.push(auditUnitId);
      where.push(`aam.audit_unit_id = $${params.length}`);
    }

    this.applyAssessmentAuditTypeFilter(where, params, query, 'aam.audit_type_id');

    if (riskCategoryIds.length) {
      params.push(riskCategoryIds);
      where.push(`qm.risk_category_id = ANY($${params.length}::int[])`);
    }

    if (businessRiskIds.length) {
      params.push(businessRiskIds);
      where.push(
        `NULLIF(ad.business_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    if (controlRiskIds.length) {
      params.push(controlRiskIds);
      where.push(
        `NULLIF(ad.control_risk::text, '')::int = ANY($${params.length}::int[])`,
      );
    }

    const result = await this.db.query(
      `
      SELECT
        ad.id,
        auditor.emp_code AS auditor_emp_code,
        aam.is_multiple_auditors,
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
        ad.audit_commpliance,
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
        sm.scheme_code,
        ad.assesment_id,
        aam.assesment_period_from,
        aam.assesment_period_to,
        aum_assesment.name AS assessment_unit_name,
        aum_assesment.audit_unit_code AS assessment_unit_code
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
      LEFT JOIN employee_master auditor
        ON auditor.id = ad.audit_emp_id
      LEFT JOIN audit_unit_master aum_assesment
        ON aum_assesment.id = aam.audit_unit_id
        AND aum_assesment.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY ad.assesment_id, ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id
      `,
      params,
    );

    const answerIds = result.rows
      .map((row: any) => Number(row.id))
      .filter(Boolean);

    const assessmentIds = Array.from(
      new Set(
        result.rows
          .map((row: any) => Number(row.assesment_id))
          .filter(Boolean),
      ),
    );

    const annexureRowsByAnswer = await this.getAuditCompleteAnnexureRowsForAssessments(
      assessmentIds,
      answerIds,
    );

    const questionRows = result.rows.map((row: any) => ({
      sr_no: 0,
      ...row,
      is_multiple_auditors: !!row.is_multiple_auditors,
      auditor_emp_code: row.auditor_emp_code || '-',
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      audit_commpliance: row.audit_commpliance || '-',
      risk_category: row.risk_category || '-',
      business_risk_label: this.riskParameterLabel(row.business_risk),
      control_risk_label: this.riskParameterLabel(row.control_risk),
      __assessment_label: `${row.assessment_unit_code || ''} - ${row.assessment_unit_name || ''} (${this.dateOnly(row.assesment_period_from)} to ${this.dateOnly(row.assesment_period_to)})`,
      __account_key: this.accountDetailKey(row),
      __account_details: this.accountDetailRows(row),
      __is_vouching: this.isVouchingTransactionRow(row),
      __annexure_rows: this.formatAnnexureRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
      __vouching_rows: this.formatVouchingRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
    }));

    const rows = isAllBranches
      ? this.buildAuditCompleteGroupedRowsWithAssessments(questionRows)
      : this.buildAuditCompleteGroupedRows(questionRows);

    const assessment = isAllBranches
      ? {
          assessmentPeriod: 'All Periods',
          auditUnit: 'All Branches',
          frequency: '-',
          isMultipleAuditors: false,
        }
      : await this.getAssessmentHeader(assessmentId);

    return {
      filters: {
        reportAuditUnit: isAllBranches ? 'all_branches' : String(auditUnitId || ''),
        reportAuditAssesment: isAllBranches ? '' : String(assessmentId || ''),
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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
        complianceRequired: questionRows.filter(
          (row) => Number(row.is_compliance) === 1,
        ).length,
        highBusinessRisk: questionRows.filter(
          (row) => Number(row.business_risk) === 1,
        ).length,
        highControlRisk: questionRows.filter(
          (row) => Number(row.control_risk) === 1,
        ).length,
      },
    };
  }

  async getPendingComplianceDetailReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : '';
    const endDate = query.endDate ? String(query.endDate).trim() : '';

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if (
      (searchType === '5' || searchType === '6') &&
      (!startDate || !endDate)
    ) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    const assessmentParams: any[] = [auditUnitId];
    const assessmentWhere = [
      'audit_unit_id = $1',
      'audit_status_id = 6',
      'deleted_at IS NULL',
    ];

    if (searchType === '3' || searchType === '4') {
      assessmentParams.push(assessmentId);
      assessmentWhere.push(`id = $${assessmentParams.length}`);
    } else {
      assessmentParams.push(startDate, endDate);
      assessmentWhere.push(
        `assesment_period_from >= $${assessmentParams.length - 1}`,
      );
      assessmentWhere.push(
        `assesment_period_to <= $${assessmentParams.length}`,
      );
    }

    const assessmentResult = await this.db.query(
      `
      SELECT
        id,
        year_id,
        audit_unit_id,
        assesment_period_from,
        assesment_period_to,
        frequency
      FROM audit_assesment_master
      WHERE ${assessmentWhere.join(' AND ')}
      ORDER BY assesment_period_from ASC, id ASC
      `,
      assessmentParams,
    );

    const assessments = assessmentResult.rows;
    const assessmentIds = assessments.map((assessment: any) =>
      Number(assessment.id),
    );

    if (!assessmentIds.length) {
      return {
        filters: {
          selectSearchTypeFilter: searchType,
          reportAuditUnit: String(auditUnitId),
          reportAuditAssesment: assessmentId ? String(assessmentId) : '',
          startDate,
          endDate,
        },
        total: 0,
        generatedAt: new Date().toISOString(),
        rows: [],
        summary: {
          total: 0,
          assessments: 0,
        },
      };
    }

    const params: any[] = [assessmentIds, auditUnitId];
    const where = [
      'ad.assesment_id = ANY($1::int[])',
      'aam.audit_unit_id = $2',
      'aam.audit_status_id = 6',
      'ad.deleted_at IS NULL',
      'qm.deleted_at IS NULL',
      'ad.is_compliance = 1',
      '(ad.compliance_status_id = 3 OR COALESCE(qm.annexure_id, 0) > 0)',
    ];

    const result = await this.db.query(
      `
      SELECT
        ad.id,
        auditor.emp_code AS auditor_emp_code,
        aam.is_multiple_auditors,
        ad.assesment_id,
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
        ad.audit_commpliance,
        ad.compliance_reviewer_comment,
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
      LEFT JOIN employee_master auditor
        ON auditor.id = ad.audit_emp_id
      WHERE ${where.join(' AND ')}
      ORDER BY ad.assesment_id, ad.menu_id, ad.category_id, ad.dump_id, ad.header_id, ad.question_id
      `,
      params,
    );

    const answerIds = result.rows
      .map((row: any) => Number(row.id))
      .filter(Boolean);
    const annexureRowsByAnswer =
      await this.getAuditCompleteAnnexureRowsForAssessments(
        assessmentIds,
        answerIds,
        'aa.compliance_status_id = 3',
      );

    const assessmentHeaderById = new Map<number, any>();
    for (const currentAssessment of assessments) {
      assessmentHeaderById.set(
        Number(currentAssessment.id),
        await this.getAssessmentHeader(Number(currentAssessment.id)),
      );
    }

    const questionRows = result.rows.map((row: any) => ({
      sr_no: 0,
      ...row,
      is_multiple_auditors: !!row.is_multiple_auditors,
      auditor_emp_code: row.auditor_emp_code || '-',
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      audit_commpliance: row.audit_commpliance || '-',
      compliance_reviewer_comment: row.compliance_reviewer_comment || '-',
      risk_category: row.risk_category || '-',
      business_risk_label: this.riskParameterLabel(row.business_risk),
      control_risk_label: this.riskParameterLabel(row.control_risk),
      __assessment_label:
        assessmentHeaderById.get(Number(row.assesment_id))?.assessmentPeriod ||
        '',
      __account_key: this.accountDetailKey(row),
      __account_details: this.accountDetailRows(row),
      __is_vouching: this.isVouchingTransactionRow(row),
      __annexure_rows: this.formatAnnexureRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
      __vouching_rows: this.formatVouchingRows(
        annexureRowsByAnswer.get(Number(row.id)) || [],
        row.annexure_columns || [],
      ),
    }));

    const rows =
      this.buildAuditCompleteGroupedRowsWithAssessments(questionRows);
    const header =
      assessmentIds.length === 1
        ? assessmentHeaderById.get(assessmentIds[0])
        : {
          assessmentPeriod: `${startDate || this.dateOnly(assessments[0]?.assesment_period_from)} to ${endDate || this.dateOnly(assessments[assessments.length - 1]?.assesment_period_to)}`,
        };

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: assessmentId ? String(assessmentId) : '',
        startDate,
        endDate,
      },
      total: questionRows.length,
      generatedAt: new Date().toISOString(),
      header,
      rows,
      summary: {
        total: questionRows.length,
        assessments: assessmentIds.length,
      },
    };
  }

  async getRiskWeightageReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : null;
    const endDate = query.endDate ? String(query.endDate).trim() : null;
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if (
      (searchType === '5' || searchType === '6') &&
      (!startDate || !endDate)
    ) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    // Step 1: Find matching assessments
    let assessments: any[] = [];
    if (searchType === '3' || searchType === '4') {
      const result = await this.db.query(
        `
        SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency
        FROM audit_assesment_master
        WHERE id = $1
          AND audit_unit_id = $2
          AND deleted_at IS NULL
        `,
        [assessmentId, auditUnitId],
      );
      assessments = result.rows;
    } else {
      // searchType 5 or 6 (date range filter)
      const statusCondition = removePending
        ? (isFreeFlow ? 'AND audit_status_id >= 4' : 'AND audit_status_id > 4')
        : (isFreeFlow ? 'AND audit_status_id >= 1' : 'AND audit_status_id > 1');
      const result = await this.db.query(
        `
        SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency
        FROM audit_assesment_master
        WHERE audit_unit_id = $1
          AND assesment_period_from >= $2
          AND assesment_period_to <= $3
          ${statusCondition}
          AND deleted_at IS NULL
        ORDER BY id ASC
        `,
        [auditUnitId, startDate, endDate],
      );
      assessments = result.rows;
    }

    if (!assessments.length) {
      throw new BadRequestException(
        'No assessments found for selected filters.',
      );
    }

    const assessmentIds = assessments.map((a) => Number(a.id));
    const firstYearId = Number(assessments[0].year_id);

    // Fetch branch info
    const branchResult = await this.db.query(
      `SELECT name, audit_unit_code FROM audit_unit_master WHERE id = $1 AND deleted_at IS NULL`,
      [auditUnitId],
    );
    const branchInfo = branchResult.rows[0] || {
      name: 'Unknown',
      audit_unit_code: '-',
    };

    // Step 2: Fetch Risk Category weightages for the financial year
    const riskCategoriesResult = await this.db.query(
      `
      SELECT
        rcm.id,
        rcm.risk_category AS title,
        COALESCE(rcw.risk_weight, 0) AS risk_weight
      FROM risk_category_master rcm
      LEFT JOIN risk_category_weights rcw
        ON rcw.risk_category_id = rcm.id
        AND rcw.year_id = $1
        AND rcw.is_active = 1
        AND rcw.deleted_at IS NULL
      WHERE rcm.is_active = 1
        AND rcm.deleted_at IS NULL
      ORDER BY rcm.id ASC
      `,
      [firstYearId],
    );
    const riskCategories = riskCategoriesResult.rows;

    // Step 3: Fetch Risk Matrix
    const riskMatrixResult = await this.db.query(
      `SELECT risk_parameter, business_risk_score, control_risk_score FROM risk_matrix WHERE year_id = $1 AND deleted_at IS NULL`,
      [firstYearId],
    );
    const riskMatrixList = riskMatrixResult.rows;
    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();
    for (const m of riskMatrixList) {
      const p = Number(m.risk_parameter);
      businessRiskScores.set(p, Number(m.business_risk_score || 0));
      controlRiskScores.set(p, Number(m.control_risk_score || 0));
    }

    // Function to calculate matrix score
    const getMatrixScore = (br: any, cr: any): number => {
      const bRisk = Number(br);
      const cRisk = Number(cr);
      if (
        !bRisk ||
        !cRisk ||
        bRisk < 1 ||
        bRisk > 4 ||
        cRisk < 1 ||
        cRisk > 4
      ) {
        return 0;
      }
      const bScore = businessRiskScores.get(bRisk) || 0;
      const cScore = controlRiskScores.get(cRisk) || 0;
      return bScore + cScore;
    };

    // Step 4: Fetch Deposits/Advances Sampling Counts per Assessment
    const depositsSamplingResult = await this.db.query(
      `
      SELECT assesment_period_id, COUNT(*)::int AS count
      FROM dump_deposits
      WHERE sampling_filter = 1
        AND assesment_period_id = ANY($1::int[])
        AND deleted_at IS NULL
      GROUP BY assesment_period_id
      `,
      [assessmentIds],
    );
    const advancesSamplingResult = await this.db.query(
      `
      SELECT assesment_period_id, COUNT(*)::int AS count
      FROM dump_advances
      WHERE sampling_filter = 1
        AND assesment_period_id = ANY($1::int[])
        AND deleted_at IS NULL
      GROUP BY assesment_period_id
      `,
      [assessmentIds],
    );

    const depositsSamplingByAssessment = new Map<number, number>();
    for (const r of depositsSamplingResult.rows) {
      depositsSamplingByAssessment.set(
        Number(r.assesment_period_id),
        Number(r.count || 0),
      );
    }
    const advancesSamplingByAssessment = new Map<number, number>();
    for (const r of advancesSamplingResult.rows) {
      advancesSamplingByAssessment.set(
        Number(r.assesment_period_id),
        Number(r.count || 0),
      );
    }

    // Step 5: Fetch Answers
    const answersResult = await this.db.query(
      `
      SELECT
        ans.id,
        ans.category_id,
        ans.dump_id,
        ans.business_risk,
        ans.control_risk,
        ans.question_id,
        ans.is_compliance,
        ans.assesment_id,
        ans.answer_given,
        qm.risk_category_id,
        qm.option_id,
        qm.area_of_audit_id AS audit_area_id,
        cm.linked_table_id
      FROM answers_data ans
      INNER JOIN question_master qm ON ans.question_id = qm.id
      LEFT JOIN category_master cm ON cm.id = ans.category_id
      WHERE ans.assesment_id = ANY($1::int[])
        AND (ans.business_risk IN ('1', '2', '3') OR ans.control_risk IN ('1', '2', '3') OR qm.option_id = 4)
        AND ans.deleted_at IS NULL
        AND qm.deleted_at IS NULL
      `,
      [assessmentIds],
    );
    const answers = answersResult.rows;

    const annexureAnswerIds = answers
      .filter((ans: any) => Number(ans.option_id) === 4)
      .map((ans: any) => Number(ans.id));

    // Fetch Annexure Answers if any
    let annexures: any[] = [];
    if (annexureAnswerIds.length) {
      const annexuresResult = await this.db.query(
        `
        SELECT
          ax.id,
          ax.answer_id,
          ax.business_risk,
          ax.control_risk,
          ax.risk_cat_id AS risk_category_id,
          ax.audit_commpliance AS is_compliance,
          ax.assesment_id,
          ans.category_id,
          ans.dump_id,
          ans.question_id,
          ans.answer_given,
          qm.option_id,
          qm.area_of_audit_id AS audit_area_id,
          cm.linked_table_id
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans ON ax.answer_id = ans.id
        INNER JOIN question_master qm ON ans.question_id = qm.id
        LEFT JOIN category_master cm ON cm.id = ans.category_id
        WHERE qm.option_id = 4
          AND ax.answer_id = ANY($1::int[])
          AND ax.assesment_id = ANY($2::int[])
          AND (ax.business_risk IN ('1', '2', '3') OR ax.control_risk IN ('1', '2', '3'))
          AND ax.deleted_at IS NULL
        `,
        [annexureAnswerIds, assessmentIds],
      );
      annexures = annexuresResult.rows;
    }

    // Step 6: Perform Aggregations
    // Structure: assessmentId -> category -> broaderAreaId -> riskCategoryId -> { qualScoreSum, quanScoreSum, totalAnnexRows }
    const assessmentStats = new Map<
      number,
      Map<
        string,
        Map<
          number,
          Map<
            number,
            {
              qualScoreSum: number;
              quanScoreSum: number;
              totalAnnexRows: number;
            }
          >
        >
      >
    >();

    const getStats = (
      assesId: number,
      category: string,
      broaderAreaId: number,
      riskCatId: number,
    ) => {
      if (!assessmentStats.has(assesId)) {
        assessmentStats.set(assesId, new Map());
      }
      const catMap = assessmentStats.get(assesId)!;
      if (!catMap.has(category)) {
        catMap.set(category, new Map());
      }
      const areaMap = catMap.get(category)!;
      if (!areaMap.has(broaderAreaId)) {
        areaMap.set(broaderAreaId, new Map());
      }
      const riskMap = areaMap.get(broaderAreaId)!;
      if (!riskMap.has(riskCatId)) {
        riskMap.set(riskCatId, {
          qualScoreSum: 0,
          quanScoreSum: 0,
          totalAnnexRows: 0,
        });
      }
      return riskMap.get(riskCatId)!;
    };

    // Helper to determine category key
    const getCategoryKey = (row: any) => {
      const linkedTableId = Number(row.linked_table_id || 0);
      if (linkedTableId === 1) return 'deposits';
      if (linkedTableId === 2) return 'advances';
      return 'general';
    };

    // Process main answers
    for (const ans of answers) {
      const assesId = Number(ans.assesment_id);
      const catKey = getCategoryKey(ans);
      const broaderAreaId = Number(ans.audit_area_id);
      const riskCatId = Number(ans.risk_category_id);

      if (!broaderAreaId || !riskCatId) continue;

      const stats = getStats(assesId, catKey, broaderAreaId, riskCatId);
      const score = getMatrixScore(ans.business_risk, ans.control_risk);

      if (catKey === 'general') {
        // If it's general and not annexure, it is qualitative (goes to qual)
        if (Number(ans.option_id) !== 4) {
          stats.qualScoreSum += score;
        }
      } else {
        // For advances/deposits, it is quantitative (goes to quan)
        stats.quanScoreSum += score;
      }
    }

    // Process annexures
    for (const ann of annexures) {
      const assesId = Number(ann.assesment_id);
      const catKey = getCategoryKey(ann);
      const broaderAreaId = Number(ann.audit_area_id);
      const riskCatId = Number(ann.risk_category_id);

      if (!broaderAreaId || !riskCatId) continue;

      const stats = getStats(assesId, catKey, broaderAreaId, riskCatId);
      const score = getMatrixScore(ann.business_risk, ann.control_risk);

      // Annexure scores go to quantitative (quan)
      stats.quanScoreSum += score;
      stats.totalAnnexRows++;
    }

    // Now mix and aggregate over all assessments for each category and risk category
    // Structure: category -> riskCategoryId -> { tot_avg_score: number; qual_tot_sum: number; quan_tot_sum: number }
    const finalMetrics = new Map<
      string,
      Map<
        number,
        {
          tot_avg_score: number;
          avg_tot_score_per_audit: number;
          weighted_score: number;
        }
      >
    >();

    const categoriesList = ['general', 'deposits', 'advances'];
    for (const catKey of categoriesList) {
      finalMetrics.set(catKey, new Map());
      for (const rc of riskCategories) {
        finalMetrics
          .get(catKey)!
          .set(Number(rc.id), {
            tot_avg_score: 0,
            avg_tot_score_per_audit: 0,
            weighted_score: 0,
          });
      }
    }

    const noOfAssessments = assessmentIds.length;

    // Collect all unique broader area IDs that had scores
    const broaderAreaIds = new Set<number>();
    for (const [_, catMap] of assessmentStats) {
      for (const [_, areaMap] of catMap) {
        for (const [areaId, _] of areaMap) {
          broaderAreaIds.add(areaId);
        }
      }
    }

    // Sum samplings over all assessments
    let totalDepositsSampling = 0;
    let totalAdvancesSampling = 0;
    for (const assesId of assessmentIds) {
      totalDepositsSampling += depositsSamplingByAssessment.get(assesId) || 0;
      totalAdvancesSampling += advancesSamplingByAssessment.get(assesId) || 0;
    }

    // Calculate aggregated scores per Broader Area and Risk Category
    for (const catKey of categoriesList) {
      const catMetrics = finalMetrics.get(catKey)!;

      for (const broaderAreaId of broaderAreaIds) {
        for (const rc of riskCategories) {
          const riskCatId = Number(rc.id);
          const riskWeight = Number(rc.risk_weight || 0);

          let qualScoreSum_all = 0;
          let quanScoreSum_all = 0;
          let totalAnnexRows_all = 0;

          // Sum over all assessments
          for (const assesId of assessmentIds) {
            const catMap = assessmentStats.get(assesId);
            const areaMap = catMap?.get(catKey);
            const riskMap = areaMap?.get(broaderAreaId);
            const stats = riskMap?.get(riskCatId);

            if (stats) {
              qualScoreSum_all += stats.qualScoreSum;
              quanScoreSum_all += stats.quanScoreSum;
              totalAnnexRows_all += stats.totalAnnexRows;
            }
          }

          if (qualScoreSum_all === 0 && quanScoreSum_all === 0) {
            continue; // No observations in this category / broader area / risk category
          }

          // Calculate mixed no_of_acc_checked_all
          let no_of_acc_checked_all = 0;
          if (catKey === 'advances') {
            no_of_acc_checked_all = totalAdvancesSampling + totalAnnexRows_all;
          } else if (catKey === 'deposits') {
            no_of_acc_checked_all = totalDepositsSampling + totalAnnexRows_all;
          } else {
            no_of_acc_checked_all = totalAnnexRows_all;
          }

          const avg_quan_score_all =
            quanScoreSum_all > 0
              ? quanScoreSum_all / (no_of_acc_checked_all || 1)
              : 0;
          const tot_avg_score_all = qualScoreSum_all + avg_quan_score_all;
          const avg_tot_score_per_audit_all =
            tot_avg_score_all / noOfAssessments;
          const weighted_score_all = riskWeight * avg_tot_score_per_audit_all;

          // Accumulate for this Category + Risk Category
          const metrics = catMetrics.get(riskCatId)!;
          metrics.tot_avg_score += tot_avg_score_all;
          metrics.avg_tot_score_per_audit += avg_tot_score_per_audit_all;
          metrics.weighted_score += weighted_score_all;
        }
      }
    }

    // Calculate total weighted score
    let tot_weighted_score = 0;
    for (const [_, catMetrics] of finalMetrics) {
      for (const [_, metrics] of catMetrics) {
        tot_weighted_score += metrics.weighted_score;
      }
    }

    // Format output rows
    const rows: any[] = [];
    for (const catKey of categoriesList) {
      const catMetrics = finalMetrics.get(catKey)!;
      for (const rc of riskCategories) {
        const riskCatId = Number(rc.id);
        const metrics = catMetrics.get(riskCatId)!;

        // Skip rows that have 0 score to match broader area remove blank helper behavior
        if (metrics.tot_avg_score === 0) {
          continue;
        }

        const percent_to_total =
          tot_weighted_score > 0
            ? (metrics.weighted_score / tot_weighted_score) * 100
            : 0;

        rows.push({
          branch_code: branchInfo.audit_unit_code,
          branch_name: branchInfo.name,
          category_name: catKey.toUpperCase(),
          risk_type: rc.title,
          total_score: this.formatDecimal(metrics.tot_avg_score, 2),
          no_of_assessment: noOfAssessments,
          avg_tot_score_per_audit: this.formatDecimal(
            metrics.avg_tot_score_per_audit,
            2,
          ),
          risk_weight: rc.risk_weight,
          weighted_score: this.formatDecimal(metrics.weighted_score, 2),
          percent_to_total: `${this.formatDecimal(percent_to_total, 2)}%`,
          __weighted_score_val: metrics.weighted_score, // raw number for calculations
          __percent_to_total_val: percent_to_total,
        });
      }
    }

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
        startDate: startDate || '',
        endDate: endDate || '',
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod:
          searchType === '3' || searchType === '4'
            ? `${this.dateOnly(assessments[0].assesment_period_from)} to ${this.dateOnly(assessments[0].assesment_period_to)}`
            : `${startDate} to ${endDate}`,
        auditUnit: branchInfo.name,
      },
      rows,
      summary: {
        total: this.formatDecimal(tot_weighted_score, 2),
      },
    };
  }

  async getRiskWiseAuditUnitsReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '1').trim();
    let startDate = query.startDate ? String(query.startDate).trim() : '';
    let endDate = query.endDate ? String(query.endDate).trim() : '';
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!['1', '2'].includes(searchType)) {
      throw new BadRequestException('Search type is required');
    }

    if (!startDate || !endDate) {
      if (query.financial_year && query.financial_year !== 'all') {
        let yearLabel = '';
        if (/^\d+$/.test(String(query.financial_year).trim())) {
          const yearResult = await this.db.query(
            `SELECT year FROM year_master WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
            [Number(query.financial_year)],
          );
          if (yearResult.rows.length > 0) {
            yearLabel = yearResult.rows[0].year;
          }
        } else {
          yearLabel = String(query.financial_year);
        }
        const dates = this.financialYearDateRange(yearLabel);
        if (dates) {
          startDate = dates.startDate;
          endDate = dates.endDate;
        }
      }
    }

    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Please select a specific Financial Year',
      );
    }


    const riskCategoriesResult = await this.db.query(
      `
      SELECT id, risk_category
      FROM risk_category_master
      WHERE is_active = 1
        AND deleted_at IS NULL
      ORDER BY id ASC
      `,
      [],
    );

    const unitTypeId = searchType === '2' ? 2 : 1;

    const unitsResult = await this.db.query(
      `
      SELECT id, audit_unit_code, name, section_type_id
      FROM audit_unit_master
      WHERE section_type_id = $1
        AND is_active = 1
        AND deleted_at IS NULL
      ORDER BY audit_unit_code ASC, name ASC
      `,
      [unitTypeId],
    );

    if (!unitsResult.rows.length) {
      throw new BadRequestException(
        'No audit units found for selected search type.',
      );
    }

    const statusCondition = removePending
      ? (isFreeFlow ? 'AND asm.audit_status_id >= 4' : 'AND asm.audit_status_id > 4')
      : (isFreeFlow ? 'AND asm.audit_status_id >= 1' : 'AND asm.audit_status_id > 1');

    const assessmentsResult = await this.db.query(
      `
      SELECT
        asm.id,
        asm.year_id,
        asm.audit_unit_id
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      WHERE aum.section_type_id = $3
        AND asm.assesment_period_from >= $1
        AND asm.assesment_period_to <= $2
        ${statusCondition}
        AND asm.deleted_at IS NULL
        AND aum.deleted_at IS NULL
      `,
      [startDate, endDate, unitTypeId],
    );

    if (!assessmentsResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const assessmentIds = assessmentsResult.rows.map((row: any) =>
      Number(row.id),
    );
    const firstYearId = Number(assessmentsResult.rows[0].year_id || 0);

    const assessmentById = new Map<number, any>();
    const assessmentCountByUnit = new Map<number, number>();

    assessmentsResult.rows.forEach((row: any) => {
      const assessmentId = Number(row.id);
      const auditUnitId = Number(row.audit_unit_id);

      assessmentById.set(assessmentId, row);
      assessmentCountByUnit.set(
        auditUnitId,
        Number(assessmentCountByUnit.get(auditUnitId) || 0) + 1,
      );
    });

    const [
      riskMatrixResult,
      riskWeightsResult,
      depositsSamplingResult,
      advancesSamplingResult,
      answersResult,
    ] = await Promise.all([
      this.db.query(
        `SELECT risk_parameter, business_risk_score, control_risk_score FROM risk_matrix WHERE year_id = $1 AND deleted_at IS NULL`,
        [firstYearId],
      ),
      this.db.query(
        `
          SELECT risk_category_id, risk_weight
          FROM risk_category_weights
          WHERE year_id = $1
            AND is_active = 1
            AND deleted_at IS NULL
          `,
        [firstYearId],
      ),
      this.db.query(
        `
          SELECT assesment_period_id, COUNT(*)::int AS count
          FROM dump_deposits
          WHERE sampling_filter = 1
            AND assesment_period_id = ANY($1::int[])
            AND deleted_at IS NULL
          GROUP BY assesment_period_id
          `,
        [assessmentIds],
      ),
      this.db.query(
        `
          SELECT assesment_period_id, COUNT(*)::int AS count
          FROM dump_advances
          WHERE sampling_filter = 1
            AND assesment_period_id = ANY($1::int[])
            AND deleted_at IS NULL
          GROUP BY assesment_period_id
          `,
        [assessmentIds],
      ),
      this.db.query(
        `
          SELECT
            ans.id,
            ans.category_id,
            ans.dump_id,
            ans.business_risk,
            ans.control_risk,
            ans.question_id,
            ans.assesment_id,
            qm.risk_category_id,
            qm.option_id,
            qm.area_of_audit_id AS audit_area_id,
            cm.linked_table_id
          FROM answers_data ans
          INNER JOIN question_master qm
            ON ans.question_id = qm.id
          LEFT JOIN category_master cm
            ON cm.id = ans.category_id
          WHERE ans.assesment_id = ANY($1::int[])
            AND (
              ans.business_risk IN ('1', '2', '3')
              OR ans.control_risk IN ('1', '2', '3')
              OR qm.option_id = 4
            )
            AND ans.deleted_at IS NULL
            AND qm.deleted_at IS NULL
          `,
        [assessmentIds],
      ),
    ]);

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();

    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);

      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const riskWeightMap = new Map<number, number>();

    riskWeightsResult.rows.forEach((row: any) => {
      riskWeightMap.set(
        Number(row.risk_category_id),
        Number(row.risk_weight || 0),
      );
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);

      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }

      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    const depositsSamplingByAssessment = new Map<number, number>();
    depositsSamplingResult.rows.forEach((row: any) => {
      depositsSamplingByAssessment.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const advancesSamplingByAssessment = new Map<number, number>();
    advancesSamplingResult.rows.forEach((row: any) => {
      advancesSamplingByAssessment.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const annexureAnswerIds = answersResult.rows
      .filter((row: any) => Number(row.option_id) === 4)
      .map((row: any) => Number(row.id));

    const annexuresResult = annexureAnswerIds.length
      ? await this.db.query(
        `
        SELECT
          ax.answer_id,
          ax.business_risk,
          ax.control_risk,
          ax.risk_cat_id AS risk_category_id,
          ax.assesment_id,
          ans.category_id,
          qm.area_of_audit_id AS audit_area_id,
          cm.linked_table_id
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans
          ON ax.answer_id = ans.id
        INNER JOIN question_master qm
          ON ans.question_id = qm.id
        LEFT JOIN category_master cm
          ON cm.id = ans.category_id
        WHERE ax.answer_id = ANY($1::int[])
          AND ax.assesment_id = ANY($2::int[])
          AND (
            ax.business_risk IN ('1', '2', '3')
            OR ax.control_risk IN ('1', '2', '3')
          )
          AND ax.deleted_at IS NULL
        `,
        [annexureAnswerIds, assessmentIds],
      )
      : { rows: [] };

    const assessmentStats = new Map<
      number,
      Map<
        number,
        Map<
          string,
          Map<
            number,
            Map<
              number,
              {
                qualScoreSum: number;
                quanScoreSum: number;
                totalAnnexRows: number;
              }
            >
          >
        >
      >
    >();

    const categoryKey = (row: any) => {
      const linkedTableId = Number(row.linked_table_id || 0);

      if (linkedTableId === 1) {
        return 'deposits';
      }

      if (linkedTableId === 2) {
        return 'advances';
      }

      return 'general';
    };

    const statsFor = (
      auditUnitId: number,
      assessmentId: number,
      catKey: string,
      broaderAreaId: number,
      riskCategoryId: number,
    ) => {
      if (!assessmentStats.has(auditUnitId)) {
        assessmentStats.set(auditUnitId, new Map());
      }

      const unitMap = assessmentStats.get(auditUnitId)!;

      if (!unitMap.has(assessmentId)) {
        unitMap.set(assessmentId, new Map());
      }

      const assessmentMap = unitMap.get(assessmentId)!;

      if (!assessmentMap.has(catKey)) {
        assessmentMap.set(catKey, new Map());
      }

      const categoryMap = assessmentMap.get(catKey)!;

      if (!categoryMap.has(broaderAreaId)) {
        categoryMap.set(broaderAreaId, new Map());
      }

      const areaMap = categoryMap.get(broaderAreaId)!;

      if (!areaMap.has(riskCategoryId)) {
        areaMap.set(riskCategoryId, {
          qualScoreSum: 0,
          quanScoreSum: 0,
          totalAnnexRows: 0,
        });
      }

      return areaMap.get(riskCategoryId)!;
    };

    answersResult.rows.forEach((answer: any) => {
      const assessment = assessmentById.get(Number(answer.assesment_id));

      if (!assessment) {
        return;
      }

      const broaderAreaId = Number(answer.audit_area_id);
      const riskCategoryId = Number(answer.risk_category_id);

      if (!broaderAreaId || !riskCategoryId) {
        return;
      }

      const catKey = categoryKey(answer);
      const stats = statsFor(
        Number(assessment.audit_unit_id),
        Number(answer.assesment_id),
        catKey,
        broaderAreaId,
        riskCategoryId,
      );
      const score = matrixScore(answer.business_risk, answer.control_risk);

      if (catKey === 'general' && Number(answer.option_id) !== 4) {
        stats.qualScoreSum += score;
      } else {
        stats.quanScoreSum += score;
      }
    });

    annexuresResult.rows.forEach((annexure: any) => {
      const assessment = assessmentById.get(Number(annexure.assesment_id));

      if (!assessment) {
        return;
      }

      const broaderAreaId = Number(annexure.audit_area_id);
      const riskCategoryId = Number(annexure.risk_category_id);

      if (!broaderAreaId || !riskCategoryId) {
        return;
      }

      const stats = statsFor(
        Number(assessment.audit_unit_id),
        Number(annexure.assesment_id),
        categoryKey(annexure),
        broaderAreaId,
        riskCategoryId,
      );

      stats.quanScoreSum += matrixScore(
        annexure.business_risk,
        annexure.control_risk,
      );
      stats.totalAnnexRows++;
    });

    const ratingYearResult = await this.db.query(
      `
      SELECT DISTINCT asm.year_id
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      WHERE aum.section_type_id = $3
        AND asm.assesment_period_from >= $1
        AND asm.assesment_period_to <= $2
        AND asm.deleted_at IS NULL
        AND aum.deleted_at IS NULL
      ORDER BY asm.year_id ASC
      LIMIT 1
      `,
      [startDate, endDate, unitTypeId],
    );

    const ratingYearId = Number(ratingYearResult.rows[0]?.year_id || 0);

    const ratingsResult = ratingYearId
      ? await this.db.query(
        `
        SELECT audit_unit_id, risk_type_id, range_from, range_to
        FROM risk_branch_rating
        WHERE year_id = $1
          AND audit_type_id = 1
          AND deleted_at IS NULL
        `,
        [ratingYearId],
      )
      : { rows: [] };

    const ratingMap = new Map<number, any[]>();

    ratingsResult.rows.forEach((rating: any) => {
      const auditUnitId = Number(rating.audit_unit_id);

      if (!ratingMap.has(auditUnitId)) {
        ratingMap.set(auditUnitId, []);
      }

      ratingMap.get(auditUnitId)!.push(rating);
    });

    const rows: any[] = [];
    const allBranchRiskTotals = new Map<number, number>();
    let totalAllScore = 0;

    riskCategoriesResult.rows.forEach((riskCategory: any) => {
      allBranchRiskTotals.set(Number(riskCategory.id), 0);
    });

    const categoryKeys = ['general', 'deposits', 'advances'];

    unitsResult.rows.forEach((unit: any) => {
      const auditUnitId = Number(unit.id);
      const unitAssessmentStats = assessmentStats.get(auditUnitId);

      if (!unitAssessmentStats) {
        return;
      }

      const noOfAssessments = Number(
        assessmentCountByUnit.get(auditUnitId) || 0,
      );

      if (!noOfAssessments) {
        return;
      }

      const unitScores = new Map<number, number>();

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        unitScores.set(Number(riskCategory.id), 0);
      });

      let totalDepositsSampling = 0;
      let totalAdvancesSampling = 0;

      unitAssessmentStats.forEach(
        (_assessmentMap: any, assessmentId: number) => {
          totalDepositsSampling += Number(
            depositsSamplingByAssessment.get(Number(assessmentId)) || 0,
          );
          totalAdvancesSampling += Number(
            advancesSamplingByAssessment.get(Number(assessmentId)) || 0,
          );
        },
      );

      categoryKeys.forEach((catKey) => {
        const broaderAreaIds = new Set<number>();

        unitAssessmentStats.forEach((assessmentMap: any) => {
          const catMap = assessmentMap.get(catKey);

          if (!catMap) {
            return;
          }

          catMap.forEach((_riskMap: any, broaderAreaId: number) => {
            broaderAreaIds.add(Number(broaderAreaId));
          });
        });

        broaderAreaIds.forEach((broaderAreaId) => {
          riskCategoriesResult.rows.forEach((riskCategory: any) => {
            const riskCategoryId = Number(riskCategory.id);
            let qualScoreSumAll = 0;
            let quanScoreSumAll = 0;
            let totalAnnexRowsAll = 0;

            unitAssessmentStats.forEach((assessmentMap: any) => {
              const stats = assessmentMap
                .get(catKey)
                ?.get(broaderAreaId)
                ?.get(riskCategoryId);

              if (!stats) {
                return;
              }

              qualScoreSumAll += Number(stats.qualScoreSum || 0);
              quanScoreSumAll += Number(stats.quanScoreSum || 0);
              totalAnnexRowsAll += Number(stats.totalAnnexRows || 0);
            });

            if (qualScoreSumAll === 0 && quanScoreSumAll === 0) {
              return;
            }

            let noOfAccountsChecked = 0;

            if (catKey === 'advances') {
              noOfAccountsChecked = totalAdvancesSampling + totalAnnexRowsAll;
            } else if (catKey === 'deposits') {
              noOfAccountsChecked = totalDepositsSampling + totalAnnexRowsAll;
            } else {
              noOfAccountsChecked = totalAnnexRowsAll;
            }

            const avgQuanScore =
              quanScoreSumAll > 0
                ? quanScoreSumAll / (noOfAccountsChecked || 1)
                : 0;
            const totalAvgScore = qualScoreSumAll + avgQuanScore;
            const avgTotalScorePerAudit = totalAvgScore / noOfAssessments;
            const riskWeight = Number(riskWeightMap.get(riskCategoryId) || 0);
            const weightedScore = riskWeight * avgTotalScorePerAudit;

            unitScores.set(
              riskCategoryId,
              Number(unitScores.get(riskCategoryId) || 0) + weightedScore,
            );
          });
        });
      });

      const totalScore = Array.from(unitScores.values()).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
      );

      if (totalScore <= 0) {
        return;
      }

      totalAllScore += totalScore;

      const row: any = {
        audit_unit_id: auditUnitId,
        audit_unit_code: unit.audit_unit_code || '-',
        audit_unit_name: this.auditUnitName(unit),
        __risk_scores: Object.fromEntries(unitScores),
        __total_score_value: totalScore,
        __rating_rows: ratingMap.get(auditUnitId) || [],
      };

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        const riskCategoryId = Number(riskCategory.id);
        const score = Number(unitScores.get(riskCategoryId) || 0);

        row[`risk_${riskCategoryId}_score`] = this.formatDecimal(score, 2);
        row[`risk_${riskCategoryId}_branch_percent`] =
          totalScore > 0
            ? this.formatDecimal((score * 100) / totalScore, 2)
            : '0.00';

        allBranchRiskTotals.set(
          riskCategoryId,
          Number(allBranchRiskTotals.get(riskCategoryId) || 0) + score,
        );
      });

      rows.push(row);
    });

    for (const row of rows) {
      const totalScore = Number(row.__total_score_value || 0);

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        const riskCategoryId = Number(riskCategory.id);
        const score = Number(row.__risk_scores?.[riskCategoryId] || 0);
        const allRiskTotal = Number(
          allBranchRiskTotals.get(riskCategoryId) || 0,
        );

        row[`risk_${riskCategoryId}_all_percent`] =
          allRiskTotal > 0
            ? this.formatDecimal((score * 100) / allRiskTotal, 2)
            : '0.00';
      });

      row.total_score = this.formatDecimal(totalScore, 2);
      row.total_score_all_percent =
        totalAllScore > 0
          ? this.formatDecimal((totalScore * 100) / totalAllScore, 2)
          : '0.00';

      row.branch_rating = this.matchBranchRiskRatingByPercent(
        Number(row.total_score_all_percent || 0),
        row.__rating_rows || [],
      );

      delete row.__risk_scores;
      delete row.__total_score_value;
      delete row.__rating_rows;
    }

    if (!rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const totalRow: any = {
      audit_unit_code: 'Total',
      audit_unit_name: '',
      total_score: this.formatDecimal(totalAllScore, 2),
      total_score_all_percent: '',
      branch_rating: '',
    };

    riskCategoriesResult.rows.forEach((riskCategory: any) => {
      const riskCategoryId = Number(riskCategory.id);

      totalRow[`risk_${riskCategoryId}_score`] = this.formatDecimal(
        Number(allBranchRiskTotals.get(riskCategoryId) || 0),
        2,
      );
      totalRow[`risk_${riskCategoryId}_branch_percent`] = '';
      totalRow[`risk_${riskCategoryId}_all_percent`] = '';
    });

    const outputRows = [...rows, totalRow];

    const summaryRows = rows;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        startDate,
        endDate,
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: summaryRows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: `${startDate} to ${endDate}`,
      },
      rows: outputRows,
      summary: {
        totalAuditUnits: summaryRows.length,
        totalScore: this.formatDecimal(totalAllScore, 2),
      },
    };
  }

  async getRiskNpaWiseAuditUnitsReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '1').trim();
    let startDate = query.startDate ? String(query.startDate).trim() : '';
    let endDate = query.endDate ? String(query.endDate).trim() : '';
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!['1', '2'].includes(searchType)) {
      throw new BadRequestException('Search type is required');
    }

    if (!startDate || !endDate) {
      if (query.financial_year && query.financial_year !== 'all') {
        let yearLabel = '';
        if (/^\d+$/.test(String(query.financial_year).trim())) {
          const yearResult = await this.db.query(
            `SELECT year FROM year_master WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
            [Number(query.financial_year)],
          );
          if (yearResult.rows.length > 0) {
            yearLabel = yearResult.rows[0].year;
          }
        } else {
          yearLabel = String(query.financial_year);
        }
        const dates = this.financialYearDateRange(yearLabel);
        if (dates) {
          startDate = dates.startDate;
          endDate = dates.endDate;
        }
      }
    }

    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Please select a specific Financial Year',
      );
    }

    const riskCategoriesResult = await this.db.query(
      `
      SELECT id, risk_category
      FROM risk_category_master
      WHERE is_active = 1
        AND deleted_at IS NULL
      ORDER BY id ASC
      `,
      [],
    );

    const unitTypeId = searchType === '2' ? 2 : 1;

    const unitsResult = await this.db.query(
      `
      SELECT id, audit_unit_code, name, section_type_id
      FROM audit_unit_master
      WHERE section_type_id = $1
        AND is_active = 1
        AND deleted_at IS NULL
      ORDER BY audit_unit_code ASC, name ASC
      `,
      [unitTypeId],
    );

    if (!unitsResult.rows.length) {
      throw new BadRequestException(
        'No audit units found for selected search type.',
      );
    }

    const statusCondition = removePending
      ? (isFreeFlow ? 'AND asm.audit_status_id >= 4' : 'AND asm.audit_status_id > 4')
      : (isFreeFlow ? 'AND asm.audit_status_id >= 1' : 'AND asm.audit_status_id > 1');

    const assessmentsResult = await this.db.query(
      `
      SELECT
        asm.id,
        asm.year_id,
        asm.audit_unit_id
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      WHERE aum.section_type_id = $3
        AND asm.assesment_period_from >= $1
        AND asm.assesment_period_to <= $2
        ${statusCondition}
        AND asm.deleted_at IS NULL
        AND aum.deleted_at IS NULL
      `,
      [startDate, endDate, unitTypeId],
    );

    if (!assessmentsResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const assessmentIds = assessmentsResult.rows.map((row: any) =>
      Number(row.id),
    );
    const firstYearId = Number(assessmentsResult.rows[0].year_id || 0);

    const assessmentById = new Map<number, any>();
    const assessmentCountByUnit = new Map<number, number>();

    assessmentsResult.rows.forEach((row: any) => {
      const assessmentId = Number(row.id);
      const auditUnitId = Number(row.audit_unit_id);

      assessmentById.set(assessmentId, row);
      assessmentCountByUnit.set(
        auditUnitId,
        Number(assessmentCountByUnit.get(auditUnitId) || 0) + 1,
      );
    });

    const [
      riskMatrixResult,
      riskWeightsResult,
      depositsSamplingResult,
      advancesSamplingResult,
      answersResult,
      positionDataResult,
      npaRatingsResult,
      ratingsResult,
    ] = await Promise.all([
      this.db.query(
        `SELECT risk_parameter, business_risk_score, control_risk_score FROM risk_matrix WHERE year_id = $1 AND deleted_at IS NULL`,
        [firstYearId],
      ),
      this.db.query(
        `
          SELECT risk_category_id, risk_weight
          FROM risk_category_weights
          WHERE year_id = $1
            AND is_active = 1
            AND deleted_at IS NULL
          `,
        [firstYearId],
      ),
      this.db.query(
        `
          SELECT assesment_period_id, COUNT(*)::int AS count
          FROM dump_deposits
          WHERE sampling_filter = 1
            AND assesment_period_id = ANY($1::int[])
            AND deleted_at IS NULL
          GROUP BY assesment_period_id
          `,
        [assessmentIds],
      ),
      this.db.query(
        `
          SELECT assesment_period_id, COUNT(*)::int AS count
          FROM dump_advances
          WHERE sampling_filter = 1
            AND assesment_period_id = ANY($1::int[])
            AND deleted_at IS NULL
          GROUP BY assesment_period_id
          `,
        [assessmentIds],
      ),
      this.db.query(
        `
          SELECT
            ans.id,
            ans.category_id,
            ans.dump_id,
            ans.business_risk,
            ans.control_risk,
            ans.question_id,
            ans.assesment_id,
            qm.risk_category_id,
            qm.option_id,
            qm.area_of_audit_id AS audit_area_id,
            cm.linked_table_id
          FROM answers_data ans
          INNER JOIN question_master qm
            ON ans.question_id = qm.id
          LEFT JOIN category_master cm
            ON cm.id = ans.category_id
          WHERE ans.assesment_id = ANY($1::int[])
            AND (
              ans.business_risk IN ('1', '2', '3')
              OR ans.control_risk IN ('1', '2', '3')
              OR qm.option_id = 4
            )
            AND ans.deleted_at IS NULL
            AND qm.deleted_at IS NULL
          `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT assesment_id, type_id, amount
        FROM executive_summary_branch_position
        WHERE year_id = $1
          AND deleted_at IS NULL
        `,
        [firstYearId],
      ),
      firstYearId
        ? this.db.query(
          `
          SELECT audit_unit_id, risk_type_id, range_from, range_to
          FROM risk_branch_rating
          WHERE year_id = $1
            AND audit_type_id = 1
            AND deleted_at IS NULL
          `,
          [firstYearId],
        )
        : Promise.resolve({ rows: [] }),
      firstYearId
        ? this.db.query(
          `
          SELECT audit_unit_id, risk_type_id, range_from, range_to
          FROM risk_branch_rating
          WHERE year_id = $1
            AND audit_type_id = 1
            AND deleted_at IS NULL
          `,
          [firstYearId],
        )
        : Promise.resolve({ rows: [] }),
    ]);

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();

    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);

      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const riskWeightMap = new Map<number, number>();

    riskWeightsResult.rows.forEach((row: any) => {
      riskWeightMap.set(
        Number(row.risk_category_id),
        Number(row.risk_weight || 0),
      );
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);

      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }

      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    const depositsSamplingByAssessment = new Map<number, number>();
    depositsSamplingResult.rows.forEach((row: any) => {
      depositsSamplingByAssessment.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const advancesSamplingByAssessment = new Map<number, number>();
    advancesSamplingResult.rows.forEach((row: any) => {
      advancesSamplingByAssessment.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const annexureAnswerIds = answersResult.rows
      .filter((row: any) => Number(row.option_id) === 4)
      .map((row: any) => Number(row.id));

    const annexuresResult = annexureAnswerIds.length
      ? await this.db.query(
        `
        SELECT
          ax.answer_id,
          ax.business_risk,
          ax.control_risk,
          ax.risk_cat_id AS risk_category_id,
          ax.assesment_id,
          ans.category_id,
          qm.area_of_audit_id AS audit_area_id,
          cm.linked_table_id
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans
          ON ax.answer_id = ans.id
        INNER JOIN question_master qm
          ON ans.question_id = qm.id
        LEFT JOIN category_master cm
          ON cm.id = ans.category_id
        WHERE ax.answer_id = ANY($1::int[])
          AND ax.assesment_id = ANY($2::int[])
          AND (
            ax.business_risk IN ('1', '2', '3')
            OR ax.control_risk IN ('1', '2', '3')
          )
          AND ax.deleted_at IS NULL
        `,
        [annexureAnswerIds, assessmentIds],
      )
      : { rows: [] };

    const assessmentStats = new Map<
      number,
      Map<
        number,
        Map<
          string,
          Map<
            number,
            Map<
              number,
              {
                qualScoreSum: number;
                quanScoreSum: number;
                totalAnnexRows: number;
              }
            >
          >
        >
      >
    >();

    const categoryKey = (row: any) => {
      const linkedTableId = Number(row.linked_table_id || 0);

      if (linkedTableId === 1) {
        return 'deposits';
      }

      if (linkedTableId === 2) {
        return 'advances';
      }

      return 'general';
    };

    const statsFor = (
      auditUnitId: number,
      assessmentId: number,
      catKey: string,
      broaderAreaId: number,
      riskCategoryId: number,
    ) => {
      if (!assessmentStats.has(auditUnitId)) {
        assessmentStats.set(auditUnitId, new Map());
      }

      const unitMap = assessmentStats.get(auditUnitId)!;

      if (!unitMap.has(assessmentId)) {
        unitMap.set(assessmentId, new Map());
      }

      const assessmentMap = unitMap.get(assessmentId)!;

      if (!assessmentMap.has(catKey)) {
        assessmentMap.set(catKey, new Map());
      }

      const categoryMap = assessmentMap.get(catKey)!;

      if (!categoryMap.has(broaderAreaId)) {
        categoryMap.set(broaderAreaId, new Map());
      }

      const areaMap = categoryMap.get(broaderAreaId)!;

      if (!areaMap.has(riskCategoryId)) {
        areaMap.set(riskCategoryId, {
          qualScoreSum: 0,
          quanScoreSum: 0,
          totalAnnexRows: 0,
        });
      }

      return areaMap.get(riskCategoryId)!;
    };

    answersResult.rows.forEach((answer: any) => {
      const assessment = assessmentById.get(Number(answer.assesment_id));

      if (!assessment) {
        return;
      }

      const broaderAreaId = Number(answer.audit_area_id);
      const riskCategoryId = Number(answer.risk_category_id);

      if (!broaderAreaId || !riskCategoryId) {
        return;
      }

      const catKey = categoryKey(answer);
      const stats = statsFor(
        Number(assessment.audit_unit_id),
        Number(answer.assesment_id),
        catKey,
        broaderAreaId,
        riskCategoryId,
      );
      const score = matrixScore(answer.business_risk, answer.control_risk);

      if (catKey === 'general' && Number(answer.option_id) !== 4) {
        stats.qualScoreSum += score;
      } else {
        stats.quanScoreSum += score;
      }
    });

    annexuresResult.rows.forEach((annexure: any) => {
      const assessment = assessmentById.get(Number(annexure.assesment_id));

      if (!assessment) {
        return;
      }

      const broaderAreaId = Number(annexure.audit_area_id);
      const riskCategoryId = Number(annexure.risk_category_id);

      if (!broaderAreaId || !riskCategoryId) {
        return;
      }

      const stats = statsFor(
        Number(assessment.audit_unit_id),
        Number(annexure.assesment_id),
        categoryKey(annexure),
        broaderAreaId,
        riskCategoryId,
      );

      stats.quanScoreSum += matrixScore(
        annexure.business_risk,
        annexure.control_risk,
      );
      stats.totalAnnexRows++;
    });

    const ratingMap = new Map<number, any[]>();
    ratingsResult.rows.forEach((rating: any) => {
      const auditUnitId = Number(rating.audit_unit_id);
      if (!ratingMap.has(auditUnitId)) {
        ratingMap.set(auditUnitId, []);
      }
      ratingMap.get(auditUnitId)!.push(rating);
    });

    const npaRatingMap = new Map<number, any[]>();
    npaRatingsResult.rows.forEach((rating: any) => {
      const auditUnitId = Number(rating.audit_unit_id);
      if (!npaRatingMap.has(auditUnitId)) {
        npaRatingMap.set(auditUnitId, []);
      }
      npaRatingMap.get(auditUnitId)!.push(rating);
    });

    // Map NPA positions
    const positionDataByBranch = new Map<number, any[]>();
    let totalAllBranchPosition = 0;

    positionDataResult.rows.forEach((row: any) => {
      const assessment = assessmentById.get(Number(row.assesment_id));
      if (assessment) {
        const auditUnitId = Number(assessment.audit_unit_id);
        if (!positionDataByBranch.has(auditUnitId)) {
          positionDataByBranch.set(auditUnitId, []);
        }
        positionDataByBranch.get(auditUnitId)!.push(row);

        if (String(row.type_id).toUpperCase().endsWith('_NPA')) {
          totalAllBranchPosition += Number(row.amount || 0);
        }
      }
    });

    const rows: any[] = [];
    const allBranchRiskTotals = new Map<number, number>();
    let totalAllScore = 0;

    riskCategoriesResult.rows.forEach((riskCategory: any) => {
      allBranchRiskTotals.set(Number(riskCategory.id), 0);
    });

    const categoryKeys = ['general', 'deposits', 'advances'];

    unitsResult.rows.forEach((unit: any) => {
      const auditUnitId = Number(unit.id);
      const unitAssessmentStats = assessmentStats.get(auditUnitId);

      if (!unitAssessmentStats) {
        return;
      }

      const noOfAssessments = Number(
        assessmentCountByUnit.get(auditUnitId) || 0,
      );

      if (!noOfAssessments) {
        return;
      }

      const unitScores = new Map<number, number>();

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        unitScores.set(Number(riskCategory.id), 0);
      });

      let totalDepositsSampling = 0;
      let totalAdvancesSampling = 0;

      unitAssessmentStats.forEach(
        (_assessmentMap: any, assessmentId: number) => {
          totalDepositsSampling += Number(
            depositsSamplingByAssessment.get(Number(assessmentId)) || 0,
          );
          totalAdvancesSampling += Number(
            advancesSamplingByAssessment.get(Number(assessmentId)) || 0,
          );
        },
      );

      categoryKeys.forEach((catKey) => {
        const broaderAreaIds = new Set<number>();

        unitAssessmentStats.forEach((assessmentMap: any) => {
          const catMap = assessmentMap.get(catKey);

          if (!catMap) {
            return;
          }

          catMap.forEach((_riskMap: any, broaderAreaId: number) => {
            broaderAreaIds.add(Number(broaderAreaId));
          });
        });

        broaderAreaIds.forEach((broaderAreaId) => {
          riskCategoriesResult.rows.forEach((riskCategory: any) => {
            const riskCategoryId = Number(riskCategory.id);
            let qualScoreSumAll = 0;
            let quanScoreSumAll = 0;
            let totalAnnexRowsAll = 0;

            unitAssessmentStats.forEach((assessmentMap: any) => {
              const stats = assessmentMap
                .get(catKey)
                ?.get(broaderAreaId)
                ?.get(riskCategoryId);

              if (!stats) {
                return;
              }

              qualScoreSumAll += Number(stats.qualScoreSum || 0);
              quanScoreSumAll += Number(stats.quanScoreSum || 0);
              totalAnnexRowsAll += Number(stats.totalAnnexRows || 0);
            });

            if (qualScoreSumAll === 0 && quanScoreSumAll === 0) {
              return;
            }

            let noOfAccountsChecked = 0;

            if (catKey === 'advances') {
              noOfAccountsChecked = totalAdvancesSampling + totalAnnexRowsAll;
            } else if (catKey === 'deposits') {
              noOfAccountsChecked = totalDepositsSampling + totalAnnexRowsAll;
            } else {
              noOfAccountsChecked = totalAnnexRowsAll;
            }

            const avgQuanScore =
              quanScoreSumAll > 0
                ? quanScoreSumAll / (noOfAccountsChecked || 1)
                : 0;
            const totalAvgScore = qualScoreSumAll + avgQuanScore;
            const avgTotalScorePerAudit = totalAvgScore / noOfAssessments;
            const riskWeight = Number(riskWeightMap.get(riskCategoryId) || 0);
            const weightedScore = riskWeight * avgTotalScorePerAudit;

            unitScores.set(
              riskCategoryId,
              Number(unitScores.get(riskCategoryId) || 0) + weightedScore,
            );
          });
        });
      });

      const totalScore = Array.from(unitScores.values()).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
      );

      if (totalScore <= 0) {
        return;
      }

      totalAllScore += totalScore;

      // Calculate NPA total for this branch
      let positionTotal = 0;
      const branchPositions = positionDataByBranch.get(auditUnitId) || [];
      branchPositions.forEach((posRow: any) => {
        if (String(posRow.type_id).toUpperCase().endsWith('_NPA')) {
          positionTotal += Number(posRow.amount || 0);
        }
      });

      const row: any = {
        audit_unit_id: auditUnitId,
        audit_unit_code: unit.audit_unit_code || '-',
        audit_unit_name: this.auditUnitName(unit),
        __risk_scores: Object.fromEntries(unitScores),
        __total_score_value: totalScore,
        __rating_rows: ratingMap.get(auditUnitId) || [],
        __npa_rating_rows: npaRatingMap.get(auditUnitId) || [],
        __npa_total_value: positionTotal,
      };

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        const riskCategoryId = Number(riskCategory.id);
        const score = Number(unitScores.get(riskCategoryId) || 0);

        row[`risk_${riskCategoryId}_score`] = this.formatDecimal(score, 2);
        row[`risk_${riskCategoryId}_branch_percent`] =
          totalScore > 0
            ? this.formatDecimal((score * 100) / totalScore, 2)
            : '0.00';

        allBranchRiskTotals.set(
          riskCategoryId,
          Number(allBranchRiskTotals.get(riskCategoryId) || 0) + score,
        );
      });

      rows.push(row);
    });

    let totalWeightedScoreForBottom = 0;

    for (const row of rows) {
      const totalScore = Number(row.__total_score_value || 0);
      const positionTotal = Number(row.__npa_total_value || 0);

      riskCategoriesResult.rows.forEach((riskCategory: any) => {
        const riskCategoryId = Number(riskCategory.id);
        const score = Number(row.__risk_scores?.[riskCategoryId] || 0);
        const allRiskTotal = Number(
          allBranchRiskTotals.get(riskCategoryId) || 0,
        );

        row[`risk_${riskCategoryId}_all_percent`] =
          allRiskTotal > 0
            ? this.formatDecimal((score * 100) / allRiskTotal, 2)
            : '0.00';
      });

      row.total_score = this.formatDecimal(totalScore, 2);

      const totalScoreAllBranch = Math.min(
        totalAllScore > 0 ? (totalScore * 100) / totalAllScore : 0,
        100,
      );

      row.total_score_all_percent = this.formatDecimal(totalScoreAllBranch, 2);

      row.branch_rating = this.matchBranchRiskRatingByPercent(
        totalScoreAllBranch,
        row.__rating_rows || [],
      );

      // NPA Column Values
      row.npa_total = this.formatDecimal(positionTotal / 100000, 2);

      const totalScoreAllBranchWithNPA = Math.min(
        totalAllBranchPosition > 0 ? (positionTotal * 100) / totalAllBranchPosition : 0,
        100,
      );

      row.total_score_all_percent_with_npa = this.formatDecimal(totalScoreAllBranchWithNPA, 2);

      const weightedScore = Math.min(
        ((totalScoreAllBranchWithNPA * 60) + (totalScoreAllBranch * 40)) / 100,
        100,
      );

      row.weighted_score = this.formatDecimal(weightedScore, 2);

      row.weighted_npa_rating = this.matchBranchRiskRatingByPercent(
        weightedScore,
        row.__npa_rating_rows || [],
      );

      row.actual_npa_rating = this.matchBranchRiskRatingByPercent(
        totalScoreAllBranchWithNPA,
        row.__rating_rows || [],
      );

      totalWeightedScoreForBottom += weightedScore;

      delete row.__risk_scores;
      delete row.__total_score_value;
      delete row.__rating_rows;
      delete row.__npa_rating_rows;
      delete row.__npa_total_value;
    }

    if (!rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    // Bottom Total Row percentages
    let totalScoreAllBranchesWithNPAPercentage = 0;
    rows.forEach((row: any) => {
      const positionVal = Number(row.npa_total || 0);
      const branchNPAPercent = totalAllBranchPosition > 0 ? (positionVal * 100) / totalAllBranchPosition : 0;
      totalScoreAllBranchesWithNPAPercentage += branchNPAPercent;
    });
    totalScoreAllBranchesWithNPAPercentage = Math.min(totalScoreAllBranchesWithNPAPercentage, 100);

    const totalRow: any = {
      audit_unit_code: 'Total',
      audit_unit_name: '',
      total_score: this.formatDecimal(totalAllScore, 2),
      total_score_all_percent: '100.00',
      branch_rating: '',
      npa_total: this.formatDecimal(totalAllBranchPosition / 100000, 2),
      weighted_score: this.formatDecimal(Math.min(totalWeightedScoreForBottom, 100), 2),
      weighted_npa_rating: '',
      total_score_all_percent_with_npa: this.formatDecimal(totalScoreAllBranchesWithNPAPercentage, 2),
      actual_npa_rating: '',
    };

    riskCategoriesResult.rows.forEach((riskCategory: any) => {
      const riskCategoryId = Number(riskCategory.id);

      totalRow[`risk_${riskCategoryId}_score`] = this.formatDecimal(
        Number(allBranchRiskTotals.get(riskCategoryId) || 0),
        2,
      );
      totalRow[`risk_${riskCategoryId}_branch_percent`] = '';
      totalRow[`risk_${riskCategoryId}_all_percent`] = '';
    });

    const outputRows = [...rows, totalRow];
    const summaryRows = rows;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        startDate,
        endDate,
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: summaryRows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: `${startDate} to ${endDate}`,
      },
      rows: outputRows,
      summary: {
        totalAuditUnits: summaryRows.length,
        totalScore: this.formatDecimal(totalAllScore, 2),
        totalNpa: this.formatDecimal(totalAllBranchPosition / 100000, 2),
      },
    };
  }

  private financialYearDateRange(year: any) {
    const yearStr = String(year || '').trim();

    // Check for dual-year like 2024-2025 or 2024-25
    const dualMatch = yearStr.match(/(\d{4})\D+(\d{2,4})/);
    if (dualMatch) {
      const startYear = dualMatch[1];
      let endYear = dualMatch[2];
      if (endYear.length === 2) {
        endYear = startYear.slice(0, 2) + endYear;
      }
      return {
        startDate: `${startYear}-04-01`,
        endDate: `${endYear}-03-31`,
      };
    }

    // Check for single-year like 2024
    const singleMatch = yearStr.match(/^(\d{4})$/);
    if (singleMatch) {
      const startYear = singleMatch[1];
      const endYear = String(Number(startYear) + 1);
      return {
        startDate: `${startYear}-04-01`,
        endDate: `${endYear}-03-31`,
      };
    }

    return null;
  }

  private async getRiskWiseRatingYearId(
    searchType: string,
    auditUnitId: number,
    assessmentId: number,
    startDate: string,
    endDate: string,
  ) {
    if (searchType === '3' || searchType === '4') {
      const result = await this.db.query(
        `
        SELECT year_id
        FROM audit_assesment_master
        WHERE id = $1
          AND audit_unit_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [assessmentId, auditUnitId],
      );

      return Number(result.rows[0]?.year_id || 0);
    }

    const result = await this.db.query(
      `
      SELECT year_id
      FROM audit_assesment_master
      WHERE audit_unit_id = $1
        AND assesment_period_from >= $2
        AND assesment_period_to <= $3
        AND deleted_at IS NULL
      ORDER BY assesment_period_from ASC
      LIMIT 1
      `,
      [auditUnitId, startDate, endDate],
    );

    return Number(result.rows[0]?.year_id || 0);
  }

  private async getRiskWiseBranchRatingRows(
    auditUnitId: number,
    yearId: number,
  ) {
    if (!auditUnitId || !yearId) {
      return [];
    }

    const result = await this.db.query(
      `
      SELECT risk_type_id, range_from, range_to
      FROM risk_branch_rating
      WHERE audit_unit_id = $1
        AND year_id = $2
        AND audit_type_id = 1
        AND deleted_at IS NULL
      ORDER BY risk_type_id ASC
      `,
      [auditUnitId, yearId],
    );

    return result.rows;
  }

  private matchBranchRiskRatingByPercent(score: number, ratings: any[]) {
    for (const rating of ratings) {
      const upperBound = Number(rating.range_from || 0);
      const lowerBound = Number(rating.range_to || 0);

      if (score <= upperBound && score > lowerBound) {
        return this.riskWiseRiskLabel(rating.risk_type_id).toUpperCase();
      }
    }

    const maxUpper = Math.max(
      ...ratings.map((rating: any) => Number(rating.range_from || 0)),
      0,
    );
    const maxLower = Math.max(
      ...ratings.map((rating: any) => Number(rating.range_to || 0)),
      0,
    );

    if (score >= maxUpper && maxUpper > 0) {
      return 'HIGH RISK';
    }

    if (score <= maxLower && maxLower > 0) {
      return 'LOW RISK';
    }

    return '';
  }

  private matchBranchRiskRating(weightedScore: number, ratings: any[]) {
    const matched = ratings.find((rating: any) => {
      const from = Number(rating.range_from || 0);
      const to = Number(rating.range_to || 0);

      return weightedScore >= from && weightedScore <= to;
    });

    if (!matched) {
      return {
        risk_type_id: 0,
        risk_type: 'Unmapped',
        range_label: '-',
      };
    }

    return {
      risk_type_id: Number(matched.risk_type_id || 0),
      risk_type: this.riskWiseRiskLabel(matched.risk_type_id),
      range_label: `${matched.range_from} - ${matched.range_to}`,
    };
  }

  private riskWiseRiskLabel(value: any) {
    const labels: Record<number, string> = {
      1: 'High Risk',
      2: 'Medium Risk',
      3: 'Low Risk',
    };

    return labels[Number(value)] || 'Unmapped';
  }

  private riskWiseAuditTypeLabel(value: any) {
    const labels: Record<number, string> = {
      1: 'RBI Audit',
      2: 'Concurrent Audit',
    };

    return labels[Number(value)] || '-';
  }

  private formatDecimal(val: number, decimals: number): string {
    return Number(val || 0).toFixed(decimals);
  }

  async getRBIAPerformanceRiskWeightageReportAllUnitsReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '1').trim();
    const startDate = query.startDate ? String(query.startDate).trim() : '';
    const endDate = query.endDate ? String(query.endDate).trim() : '';
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!['1', '2'].includes(searchType)) {
      throw new BadRequestException('Search type is required');
    }

    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    const unitTypeId = searchType === '2' ? 2 : 1;

    const statusCondition = removePending
      ? (isFreeFlow ? 'AND asm.audit_status_id >= 4' : 'AND asm.audit_status_id > 4')
      : (isFreeFlow ? 'AND asm.audit_status_id >= 1' : 'AND asm.audit_status_id > 1');

    const assessmentsResult = await this.db.query(
      `
      SELECT
        asm.id,
        asm.year_id,
        asm.audit_unit_id,
        asm.assesment_period_from,
        asm.assesment_period_to,
        aum.name AS audit_unit_name,
        aum.audit_unit_code
      FROM audit_assesment_master asm
      INNER JOIN audit_unit_master aum
        ON aum.id = asm.audit_unit_id
      WHERE aum.section_type_id = $3
        AND asm.assesment_period_from >= $1
        AND asm.assesment_period_to <= $2
        ${statusCondition}
        AND asm.deleted_at IS NULL
        AND aum.deleted_at IS NULL
      ORDER BY aum.audit_unit_code ASC, asm.id ASC
      `,
      [startDate, endDate, unitTypeId],
    );

    if (!assessmentsResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const assessmentIds = assessmentsResult.rows.map((row: any) =>
      Number(row.id),
    );
    const firstYearId = Number(assessmentsResult.rows[0].year_id || 0);

    const [
      riskCategoriesResult,
      riskMatrixResult,
      depositsResult,
      advancesResult,
      depositsSamplingResult,
      advancesSamplingResult,
      answersResult,
      ratingResult,
    ] = await Promise.all([
      this.db.query(
        `
        SELECT
          rcm.id,
          rcm.risk_category AS title,
          COALESCE(rcw.risk_weight, 0) AS risk_weight
        FROM risk_category_master rcm
        LEFT JOIN risk_category_weights rcw
          ON rcw.risk_category_id = rcm.id
          AND rcw.year_id = $1
          AND rcw.is_active = 1
          AND rcw.deleted_at IS NULL
        WHERE rcm.is_active = 1
          AND rcm.deleted_at IS NULL
        ORDER BY rcm.id ASC
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT risk_parameter, business_risk_score, control_risk_score
        FROM risk_matrix
        WHERE year_id = $1
          AND deleted_at IS NULL
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT assesment_period_id, COUNT(*)::int AS count
        FROM dump_deposits
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        GROUP BY assesment_period_id
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT assesment_period_id, COUNT(*)::int AS count
        FROM dump_advances
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        GROUP BY assesment_period_id
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT assesment_period_id, COUNT(*)::int AS count
        FROM dump_deposits
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        GROUP BY assesment_period_id
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT assesment_period_id, COUNT(*)::int AS count
        FROM dump_advances
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        GROUP BY assesment_period_id
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT
          ans.id,
          ans.business_risk,
          ans.control_risk,
          ans.answer_given,
          ans.assesment_id,
          qm.option_id,
          qm.risk_category_id
        FROM answers_data ans
        INNER JOIN question_master qm
          ON qm.id = ans.question_id
        WHERE ans.assesment_id = ANY($1::int[])
          AND qm.risk_category_id IS NOT NULL
          AND ans.deleted_at IS NULL
          AND qm.deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT audit_unit_id, risk_type_id, range_from, range_to
        FROM risk_branch_rating
        WHERE year_id = $1
          AND audit_type_id = 1
          AND deleted_at IS NULL
        `,
        [firstYearId],
      ),
    ]);

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();
    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);
      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }
      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    const highestPossibleScore = Math.max(
      0,
      ...Array.from({ length: 4 }, (_, index) => index + 1).flatMap(
        (businessRisk) =>
          Array.from({ length: 4 }, (__, index) => index + 1).map(
            (controlRisk) => matrixScore(businessRisk, controlRisk),
          ),
      ),
    );

    const ratingMap = new Map<number, any[]>();
    ratingResult.rows.forEach((rating: any) => {
      const unitId = Number(rating.audit_unit_id);
      if (!ratingMap.has(unitId)) {
        ratingMap.set(unitId, []);
      }
      ratingMap.get(unitId)!.push(rating);
    });

    const depositsMap = new Map<number, number>();
    depositsResult.rows.forEach((row: any) => {
      depositsMap.set(Number(row.assesment_period_id), Number(row.count || 0));
    });

    const advancesMap = new Map<number, number>();
    advancesResult.rows.forEach((row: any) => {
      advancesMap.set(Number(row.assesment_period_id), Number(row.count || 0));
    });

    const depositsSamplingMap = new Map<number, number>();
    depositsSamplingResult.rows.forEach((row: any) => {
      depositsSamplingMap.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const advancesSamplingMap = new Map<number, number>();
    advancesSamplingResult.rows.forEach((row: any) => {
      advancesSamplingMap.set(
        Number(row.assesment_period_id),
        Number(row.count || 0),
      );
    });

    const answerIds = answersResult.rows.map((row: any) => Number(row.id));
    const annexuresResult = answerIds.length
      ? await this.db.query(
        `
          SELECT
            ax.business_risk,
            ax.control_risk,
            ax.risk_cat_id AS risk_category_id,
            ax.assesment_id,
            ax.answer_id
          FROM answers_data_annexure ax
          WHERE ax.answer_id = ANY($1::int[])
            AND ax.assesment_id = ANY($2::int[])
            AND ax.deleted_at IS NULL
          `,
        [answerIds, assessmentIds],
      )
      : { rows: [] };

    // Group answers and annexures by assessment
    const answersByAssessment = new Map<number, any[]>();
    answersResult.rows.forEach((row: any) => {
      const assesId = Number(row.assesment_id);
      if (!answersByAssessment.has(assesId)) {
        answersByAssessment.set(assesId, []);
      }
      answersByAssessment.get(assesId)!.push(row);
    });

    const annexuresByAssessment = new Map<number, any[]>();
    annexuresResult.rows.forEach((row: any) => {
      const assesId = Number(row.assesment_id);
      if (!annexuresByAssessment.has(assesId)) {
        annexuresByAssessment.set(assesId, []);
      }
      annexuresByAssessment.get(assesId)!.push(row);
    });

    // Group assessments by audit unit
    const assessmentsByUnit = new Map<number, any[]>();
    assessmentsResult.rows.forEach((row: any) => {
      const unitId = Number(row.audit_unit_id);
      if (!assessmentsByUnit.has(unitId)) {
        assessmentsByUnit.set(unitId, []);
      }
      assessmentsByUnit.get(unitId)!.push(row);
    });

    const hasDataRiskCategory = riskCategoriesResult.rows.map((rc: any) => ({
      id: Number(rc.id),
      risk_category: String(rc.title || '').toUpperCase(),
      risk_weightage: Number(rc.risk_weight || 0),
    }));

    const rows: any[] = [];
    let allUnitsTotalObtainedScoreWeighted = 0;

    assessmentsByUnit.forEach((unitAssessments, unitId) => {
      const firstAssess = unitAssessments[0];
      const name = String(firstAssess.audit_unit_name || '').toUpperCase();
      const audit_unit_code = String(
        firstAssess.audit_unit_code || '',
      ).toUpperCase();

      const unitRow: any = {
        audit_unit_id: unitId,
        name,
        audit_unit_code,
        no_of_audits: unitAssessments.length,
        no_of_asses: unitAssessments.map((a) => a.id),
        risk_category: {},
        total_highest_score_weighted: 0,
        total_obtained_score_weighted: 0,
        total_percent: '0.00',
        total_rating: '',
        total_score_all_percent: '0.00',
        total_all_rating: '',
      };

      // Initialize stats per risk category for this unit
      const statsByRisk = new Map<
        number,
        {
          totalQuestions: number;
          totalNaQuestions: number;
          totalQuestionsT1: number;
          totalAnnexT2: number;
          obtainedScore: number;
        }
      >();

      const getStatsObj = (rcId: number) => {
        if (!statsByRisk.has(rcId)) {
          statsByRisk.set(rcId, {
            totalQuestions: 0,
            totalNaQuestions: 0,
            totalQuestionsT1: 0,
            totalAnnexT2: 0,
            obtainedScore: 0,
          });
        }
        return statsByRisk.get(rcId)!;
      };

      // Loop through all assessments of this unit
      unitAssessments.forEach((assess) => {
        const assesId = Number(assess.id);
        const answers = answersByAssessment.get(assesId) || [];
        const annexures = annexuresByAssessment.get(assesId) || [];

        answers.forEach((ans) => {
          const rcId = Number(ans.risk_category_id);
          if (!rcId) return;

          const stats = getStatsObj(rcId);
          stats.totalQuestions++;

          const answerStr = String(ans.answer_given || '')
            .trim()
            .toUpperCase();
          const isNA = [
            'NOT APPLICABLE',
            'N/A',
            'NA',
            'NOTAPPLICABLE',
          ].includes(answerStr);
          const isAnnex = Number(ans.option_id) === 4;

          if (isNA) {
            stats.totalNaQuestions++;
            return;
          }

          if (!isAnnex) {
            stats.totalQuestionsT1++;
            stats.obtainedScore += matrixScore(
              ans.business_risk,
              ans.control_risk,
            );
          }
        });

        annexures.forEach((ann) => {
          const rcId = Number(ann.risk_category_id);
          if (!rcId) return;

          const stats = getStatsObj(rcId);
          stats.totalAnnexT2++;
          stats.obtainedScore += matrixScore(
            ann.business_risk,
            ann.control_risk,
          );
        });
      });

      // Calculate totals per risk category for this unit
      let unitHighestTotal = 0;
      let unitObtainedTotal = 0;

      hasDataRiskCategory.forEach((rc) => {
        const rcId = rc.id;
        const stats = getStatsObj(rcId);
        const riskWeight = rc.risk_weightage;

        const totalQuestionsT1T2 = stats.totalQuestionsT1 + stats.totalAnnexT2;
        const highestScoreWeighted =
          highestPossibleScore * totalQuestionsT1T2 * riskWeight;
        const obtainedScoreWeighted = stats.obtainedScore * riskWeight;

        unitHighestTotal += highestScoreWeighted;
        unitObtainedTotal += obtainedScoreWeighted;

        const relativePerformance =
          highestScoreWeighted > 0
            ? (obtainedScoreWeighted / highestScoreWeighted) * 100
            : 0;

        const ratings = ratingMap.get(unitId) || [];
        const riskRating = this.matchBranchRiskRatingByPercent(
          relativePerformance,
          ratings,
        );

        unitRow[`risk_${rcId}_highest_score`] = this.formatDecimal(
          highestScoreWeighted,
          2,
        );
        unitRow[`risk_${rcId}_obtained_score`] = this.formatDecimal(
          obtainedScoreWeighted,
          2,
        );
        unitRow[`risk_${rcId}_percent`] = this.formatDecimal(
          relativePerformance,
          2,
        );
        unitRow[`risk_${rcId}_rating`] = riskRating || '-';

        unitRow.risk_category[rcId] = {
          total_highest_score_weighted: highestScoreWeighted,
          total_obtained_score_weighted: obtainedScoreWeighted,
          relative_performance: relativePerformance,
          risk_rating: riskRating,
        };
      });

      const totalPercent =
        unitHighestTotal > 0 ? (unitObtainedTotal / unitHighestTotal) * 100 : 0;

      const ratings = ratingMap.get(unitId) || [];
      const totalRating = this.matchBranchRiskRatingByPercent(
        totalPercent,
        ratings,
      );

      unitRow.total_highest_score_weighted = this.formatDecimal(
        unitHighestTotal,
        2,
      );
      unitRow.total_obtained_score_weighted = this.formatDecimal(
        unitObtainedTotal,
        2,
      );
      unitRow.total_percent = this.formatDecimal(totalPercent, 2);
      unitRow.total_rating = totalRating || '-';

      unitRow.__total_highest_score_val = unitHighestTotal;
      unitRow.__total_obtained_score_val = unitObtainedTotal;

      allUnitsTotalObtainedScoreWeighted += unitObtainedTotal;

      rows.push(unitRow);
    });

    // Second pass to calculate percentages relative to all units
    rows.forEach((row) => {
      const obtained = row.__total_obtained_score_val;
      const allPercent =
        allUnitsTotalObtainedScoreWeighted > 0
          ? (obtained / allUnitsTotalObtainedScoreWeighted) * 100
          : 0;

      const ratings = ratingMap.get(row.audit_unit_id) || [];
      const allRating = this.matchBranchRiskRatingByPercent(
        allPercent,
        ratings,
      );

      row.total_score_all_percent = this.formatDecimal(allPercent, 2);
      row.total_all_rating = allRating || '-';

      delete row.__total_highest_score_val;
      delete row.__total_obtained_score_val;
    });

    // Generate TOTAL footer row
    const totalsRow: any = {
      audit_unit_code: '',
      name: 'TOTAL',
      no_of_audits: '',
      total_highest_score_weighted: '0.00',
      total_obtained_score_weighted: '0.00',
      total_percent: '0.00',
      total_rating: '',
      total_score_all_percent: '0.00',
      total_all_rating: '',
    };

    let grandHighest = 0;
    let grandObtained = 0;
    let grandAllPercent = 0;

    const riskTotals = new Map<number, { highest: number; obtained: number }>();
    hasDataRiskCategory.forEach((rc) => {
      riskTotals.set(rc.id, { highest: 0, obtained: 0 });
    });

    rows.forEach((row) => {
      grandHighest += Number(row.total_highest_score_weighted || 0);
      grandObtained += Number(row.total_obtained_score_weighted || 0);
      grandAllPercent += Number(row.total_score_all_percent || 0);

      hasDataRiskCategory.forEach((rc) => {
        const rcId = rc.id;
        const uRc = row.risk_category[rcId] || {
          total_highest_score_weighted: 0,
          total_obtained_score_weighted: 0,
        };
        const rT = riskTotals.get(rcId)!;
        rT.highest += uRc.total_highest_score_weighted;
        rT.obtained += uRc.total_obtained_score_weighted;
      });
    });

    hasDataRiskCategory.forEach((rc) => {
      const rcId = rc.id;
      const rT = riskTotals.get(rcId)!;
      const pct = rT.highest > 0 ? (rT.obtained / rT.highest) * 100 : 0;

      totalsRow[`risk_${rcId}_highest_score`] = this.formatDecimal(
        rT.highest,
        2,
      );
      totalsRow[`risk_${rcId}_obtained_score`] = this.formatDecimal(
        rT.obtained,
        2,
      );
      totalsRow[`risk_${rcId}_percent`] = this.formatDecimal(pct, 2);
      totalsRow[`risk_${rcId}_rating`] = '';
    });

    const grandPct =
      grandHighest > 0 ? (grandObtained / grandHighest) * 100 : 0;
    totalsRow.total_highest_score_weighted = this.formatDecimal(
      grandHighest,
      2,
    );
    totalsRow.total_obtained_score_weighted = this.formatDecimal(
      grandObtained,
      2,
    );
    totalsRow.total_percent = this.formatDecimal(grandPct, 2);
    totalsRow.total_score_all_percent = this.formatDecimal(grandAllPercent, 2);

    if (rows.length) {
      rows.push(totalsRow);
    }

    // Process summary information (Deposits & Advances counts for all units)
    let totalDeposits = 0;
    let totalAdvances = 0;
    let totalDepositsSampling = 0;
    let totalAdvancesSampling = 0;

    assessmentIds.forEach((id) => {
      totalDeposits += depositsMap.get(id) || 0;
      totalAdvances += advancesMap.get(id) || 0;
      totalDepositsSampling += depositsSamplingMap.get(id) || 0;
      totalAdvancesSampling += advancesSamplingMap.get(id) || 0;
    });

    const periodText = `${startDate} to ${endDate}`;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        startDate,
        endDate,
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: periodText,
        auditUnit:
          searchType === '2' ? 'ALL HEAD OF DEPARTMENTS' : 'ALL BRANCHES',
      },
      rows,
      summary: {
        auditsConducted: assessmentIds.length,
        totalQuestions: 0,
        totalObtainedScore: this.formatDecimal(grandObtained, 2),
        totalDepositsSampling,
        totalAdvancesSampling,
      },
      meta: {
        totalDeposits,
        totalAdvances,
      },
      has_data: hasDataRiskCategory,
      total_risk_scores: Object.fromEntries(
        Array.from(riskTotals.entries()).map(([rcId, t]) => [
          rcId,
          {
            total_highest_score_weighted: t.highest,
            total_obtained_score_weighted: t.obtained,
          },
        ]),
      ),
    };
  }

  async getAuditCommitteeBoardReport1(query: any) {
    const auditUnitFilter = String(
      query.audit_unit_id || 'all_branches',
    ).trim();
    const trend = String(query.trend || '').trim();
    const startMonth = String(query.startMonth || '').trim();
    const endMonth = String(query.endMonth || '').trim();
    const startMonth2 = String(query.startMonth2 || '').trim();
    const endMonth2 = String(query.endMonth2 || '').trim();

    if (!['rwt', 'rswt'].includes(trend)) {
      throw new BadRequestException('Trend on is required');
    }

    const period1 = this.monthPeriodRange(
      startMonth,
      endMonth,
      'Trend Period - 1',
    );
    const period2 = this.monthPeriodRange(
      startMonth2,
      endMonth2,
      'Trend Period - 2',
    );

    if (
      period1.startDate <= period2.endDate &&
      period2.startDate <= period1.endDate
    ) {
      throw new BadRequestException('Trend periods must not overlap.');
    }

    const unitWhere: string[] = ['aum.deleted_at IS NULL'];
    const unitParams: any[] = [];

    if (auditUnitFilter === 'all_branches') {
      unitWhere.push('aum.section_type_id = 1');
    } else if (auditUnitFilter === 'all_head_of_dept') {
      unitWhere.push('aum.section_type_id > 1');
    } else {
      unitParams.push(Number(auditUnitFilter));
      unitWhere.push(`aum.id = $${unitParams.length}`);
    }

    const unitsResult = await this.db.query(
      `
      SELECT aum.id, aum.audit_unit_code, aum.name
      FROM audit_unit_master aum
      WHERE ${unitWhere.join(' AND ')}
      ORDER BY NULLIF(regexp_replace(aum.audit_unit_code, '\D', '', 'g'), '')::int ASC, aum.audit_unit_code ASC
      `,
      unitParams,
    );

    if (!unitsResult.rows.length) {
      throw new BadRequestException(
        'No audit units found for selected filters.',
      );
    }

    const auditUnitIds = unitsResult.rows.map((row: any) => Number(row.id));
    const unitsById = new Map<number, any>();
    unitsResult.rows.forEach((unit: any) =>
      unitsById.set(Number(unit.id), unit),
    );

    const scoringResult = await this.db.query(
      `
      SELECT
        rsm.audit_unit_id,
        rsm.id AS audit_assesment_id,
        COALESCE(asm.year_id, ym.id) AS year_id,
        rsm.assesment_period_from,
        rsm.assesment_period_to,
        rsm.risk_data
      FROM report_scoring_master rsm
      LEFT JOIN audit_assesment_master asm
        ON asm.id = rsm.id
        AND asm.deleted_at IS NULL
      LEFT JOIN year_master ym
        ON ym.year::text = rsm.year::text
      WHERE rsm.audit_unit_id = ANY($1::int[])
        AND rsm.audit_status_id > 3
        AND rsm.deleted_at IS NULL
        AND (
          (rsm.assesment_period_from >= $2 AND rsm.assesment_period_to <= $3)
          OR (rsm.assesment_period_from >= $4 AND rsm.assesment_period_to <= $5)
        )
      ORDER BY rsm.audit_unit_id ASC, rsm.assesment_period_from ASC
      `,
      [
        auditUnitIds,
        period1.startDate,
        period1.endDate,
        period2.startDate,
        period2.endDate,
      ],
    );

    if (!scoringResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const yearIds = Array.from(
      new Set(
        scoringResult.rows
          .map((row: any) => Number(row.year_id || 0))
          .filter(Boolean),
      ),
    );
    const riskWeightsResult = yearIds.length
      ? await this.db.query(
        `
        SELECT year_id, risk_category_id, risk_weight
        FROM risk_category_weights
        WHERE year_id = ANY($1::int[])
          AND is_active = 1
          AND deleted_at IS NULL
        `,
        [yearIds],
      )
      : { rows: [] };

    const riskWeightMap = new Map<string, number>();
    riskWeightsResult.rows.forEach((row: any) => {
      riskWeightMap.set(
        `${Number(row.year_id)}:${Number(row.risk_category_id)}`,
        Number(row.risk_weight || 0),
      );
    });

    const ratingsResult = yearIds.length
      ? await this.db.query(
        `
        SELECT audit_unit_id, year_id, risk_type_id, range_from, range_to
        FROM risk_branch_rating
        WHERE year_id = ANY($1::int[])
          AND audit_type_id = 1
          AND deleted_at IS NULL
        `,
        [yearIds],
      )
      : { rows: [] };

    const ratingsMap = new Map<string, any[]>();
    ratingsResult.rows.forEach((row: any) => {
      const key = `${Number(row.audit_unit_id)}:${Number(row.year_id)}`;
      if (!ratingsMap.has(key)) {
        ratingsMap.set(key, []);
      }
      ratingsMap.get(key)!.push(row);
    });

    const statsByUnit = new Map<number, any>();
    const statsFor = (auditUnitId: number) => {
      if (!statsByUnit.has(auditUnitId)) {
        statsByUnit.set(auditUnitId, {
          period1: {
            audits: new Set<number>(),
            yearId: 0,
            totalScoreByRisk: new Map<number, number>(),
            score: 0,
          },
          period2: {
            audits: new Set<number>(),
            yearId: 0,
            totalScoreByRisk: new Map<number, number>(),
            score: 0,
          },
        });
      }
      return statsByUnit.get(auditUnitId);
    };

    scoringResult.rows.forEach((row: any) => {
      const assessmentFrom = this.dateOnly(row.assesment_period_from);
      const assessmentTo = this.dateOnly(row.assesment_period_to);
      const periodKey =
        assessmentFrom >= period1.startDate && assessmentTo <= period1.endDate
          ? 'period1'
          : assessmentFrom >= period2.startDate &&
            assessmentTo <= period2.endDate
            ? 'period2'
            : '';

      if (!periodKey) {
        return;
      }

      const unitStats = statsFor(Number(row.audit_unit_id));
      const periodStats = unitStats[periodKey];
      const assessmentId = Number(row.audit_assesment_id || 0);
      const yearId = Number(row.year_id || 0);
      periodStats.yearId = periodStats.yearId || yearId;
      if (assessmentId) {
        periodStats.audits.add(assessmentId);
      }

      const riskData = this.parseRiskData(row.risk_data);
      Object.entries(riskData).forEach(
        ([riskIdText, riskDetails]: [string, any]) => {
          const riskId = Number(riskIdText);
          if (!riskId) {
            return;
          }

          const avgScore = Number(
            riskDetails?.avg_sc ?? riskDetails?.avg ?? riskDetails?.score ?? 0,
          );
          const current = Number(periodStats.totalScoreByRisk.get(riskId) || 0);
          periodStats.totalScoreByRisk.set(riskId, current + avgScore);
        },
      );
    });

    let period1Total = 0;
    let period2Total = 0;

    statsByUnit.forEach((unitStats: any) => {
      ['period1', 'period2'].forEach((periodKey) => {
        const periodStats = unitStats[periodKey];
        const auditCount = Math.max(periodStats.audits.size, 1);
        let weightedScore = 0;

        periodStats.totalScoreByRisk.forEach(
          (score: number, riskId: number) => {
            const avgScore = Number((score / auditCount).toFixed(2));
            const riskWeight = Number(
              riskWeightMap.get(`${periodStats.yearId}:${riskId}`) || 0,
            );
            weightedScore += Number((avgScore * riskWeight).toFixed(2));
          },
        );

        periodStats.score = Number(weightedScore.toFixed(2));
      });

      period1Total += Number(unitStats.period1.score || 0);
      period2Total += Number(unitStats.period2.score || 0);
    });

    const rows: any[] = [];
    const trendCounts = { increasing: 0, decreasing: 0, stable: 0 };

    auditUnitIds.forEach((auditUnitId: number) => {
      const unitStats = statsByUnit.get(auditUnitId);
      if (!unitStats) {
        return;
      }

      const p1Score = Number(unitStats.period1.score || 0);
      const p2Score = Number(unitStats.period2.score || 0);

      if (p1Score <= 0 && p2Score <= 0) {
        return;
      }

      const p1Percent = period1Total > 0 ? (p1Score * 100) / period1Total : 0;
      const p2Percent = period2Total > 0 ? (p2Score * 100) / period2Total : 0;
      const p1Risk = this.matchBranchRiskRatingByPercent(
        p1Percent,
        ratingsMap.get(`${auditUnitId}:${unitStats.period1.yearId}`) || [],
      );
      const p2Risk = this.matchBranchRiskRatingByPercent(
        p2Percent,
        ratingsMap.get(`${auditUnitId}:${unitStats.period2.yearId}`) || [],
      );
      const trendLabel = this.committeeTrendLabel(
        trend,
        p1Score,
        p2Score,
        p1Risk,
        p2Risk,
      );
      trendCounts[trendLabel.key as 'increasing' | 'decreasing' | 'stable']++;
      const unit = unitsById.get(auditUnitId) || {};

      rows.push({
        sr_no: rows.length + 1,
        audit_unit_id: auditUnitId,
        audit_unit_details: this.auditUnitName(unit),
        period1_total_risk: this.formatDecimal(p1Score, 2),
        period1_percent: this.formatDecimal(p1Percent, 2),
        period1_risk: p1Risk || '-',
        period2_percent: this.formatDecimal(p2Percent, 2),
        period2_risk: p2Risk || '-',
        period2_total_risk: this.formatDecimal(p2Score, 2),
        trend_label: trendLabel.label,
        change_in_risk_score: this.formatDecimal(
          Math.abs(p2Score - p1Score),
          2,
        ),
      });
    });

    if (!rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const overallTrend = this.committeeTrendLabel(
      'rswt',
      period1Total,
      period2Total,
      '',
      '',
    );

    return {
      filters: {
        audit_unit_id: auditUnitFilter,
        trend,
        startMonth,
        endMonth,
        startMonth2,
        endMonth2,
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: `${period1.startDate} to ${period1.endDate} / ${period2.startDate} to ${period2.endDate}`,
      },
      rows,
      summary: {
        totalAuditUnits: rows.length,
        period1TotalRisk: this.formatDecimal(period1Total, 2),
        period2TotalRisk: this.formatDecimal(period2Total, 2),
        overallTrend: overallTrend.label,
        changeInRiskScore: this.formatDecimal(
          Math.abs(period2Total - period1Total),
          2,
        ),
        increasing: trendCounts.increasing,
        decreasing: trendCounts.decreasing,
        stable: trendCounts.stable,
      },
    };
  }

  private monthPeriodRange(
    startMonth: string,
    endMonth: string,
    label: string,
  ) {
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(startMonth) || !monthPattern.test(endMonth)) {
      throw new BadRequestException(
        `${label} month must be in YYYY-MM format.`,
      );
    }

    const startDate = `${startMonth}-01`;
    const [endYear, endMonthNo] = endMonth.split('-').map(Number);
    const endDay = new Date(endYear, endMonthNo, 0).getDate();
    const endDate = `${endMonth}-${String(endDay).padStart(2, '0')}`;

    if (startDate > endDate) {
      throw new BadRequestException(
        `${label} start month cannot be after end month.`,
      );
    }

    return { startDate, endDate };
  }

  private parseRiskData(value: any) {
    if (!value) {
      return {};
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(String(value));
    } catch (_error) {
      return {};
    }
  }

  private committeeTrendLabel(
    trend: string,
    period1Score: number,
    period2Score: number,
    period1Risk: string,
    period2Risk: string,
  ) {
    if (
      trend === 'rwt' &&
      period1Risk &&
      period2Risk &&
      period1Risk === period2Risk
    ) {
      return { key: 'stable', label: 'Stable' };
    }

    if (trend === 'rswt' && Number(period1Score) === Number(period2Score)) {
      return { key: 'stable', label: 'Stable' };
    }

    if (
      trend === 'rwt' &&
      (!period1Risk || !period2Risk) &&
      Number(period1Score) === Number(period2Score)
    ) {
      return { key: 'stable', label: 'Stable' };
    }

    return Number(period1Score) > Number(period2Score)
      ? { key: 'decreasing', label: 'Decreasing' }
      : { key: 'increasing', label: 'Increasing' };
  }
  async getPerformanceRiskWeightageReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : '';
    const endDate = query.endDate ? String(query.endDate).trim() : '';
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!['3', '4', '5', '6'].includes(searchType)) {
      throw new BadRequestException('Search type is required');
    }

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if (
      (searchType === '5' || searchType === '6') &&
      (!startDate || !endDate)
    ) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    let assessmentsResult: any;

    if (searchType === '3' || searchType === '4') {
      assessmentsResult = await this.db.query(
        `
        SELECT
          id,
          year_id,
          audit_unit_id,
          assesment_period_from,
          assesment_period_to,
          frequency
        FROM audit_assesment_master
        WHERE id = $1
          AND audit_unit_id = $2
          AND deleted_at IS NULL
        `,
        [assessmentId, auditUnitId],
      );
    } else {
      const statusCondition = removePending
        ? (isFreeFlow ? 'AND audit_status_id >= 4' : 'AND audit_status_id > 4')
        : (isFreeFlow ? 'AND audit_status_id >= 1' : 'AND audit_status_id > 1');

      assessmentsResult = await this.db.query(
        `
        SELECT
          id,
          year_id,
          audit_unit_id,
          assesment_period_from,
          assesment_period_to,
          frequency
        FROM audit_assesment_master
        WHERE audit_unit_id = $1
          AND assesment_period_from >= $2
          AND assesment_period_to <= $3
          ${statusCondition}
          AND deleted_at IS NULL
        ORDER BY id ASC
        `,
        [auditUnitId, startDate, endDate],
      );
    }

    if (!assessmentsResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const assessmentIds = assessmentsResult.rows.map((row: any) =>
      Number(row.id),
    );
    const firstYearId = Number(assessmentsResult.rows[0].year_id || 0);

    const branchResult = await this.db.query(
      `
      SELECT name, audit_unit_code
      FROM audit_unit_master
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [auditUnitId],
    );
    const branchInfo = branchResult.rows[0] || {
      name: 'Selected Audit Unit',
      audit_unit_code: '',
    };

    const [
      riskCategoriesResult,
      riskMatrixResult,
      depositsResult,
      advancesResult,
      depositsSamplingResult,
      advancesSamplingResult,
      answersResult,
    ] = await Promise.all([
      this.db.query(
        `
        SELECT
          rcm.id,
          rcm.risk_category AS title,
          COALESCE(rcw.risk_weight, 0) AS risk_weight
        FROM risk_category_master rcm
        LEFT JOIN risk_category_weights rcw
          ON rcw.risk_category_id = rcm.id
          AND rcw.year_id = $1
          AND rcw.is_active = 1
          AND rcw.deleted_at IS NULL
        WHERE rcm.is_active = 1
          AND rcm.deleted_at IS NULL
        ORDER BY rcm.id ASC
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT risk_parameter, business_risk_score, control_risk_score
        FROM risk_matrix
        WHERE year_id = $1
          AND deleted_at IS NULL
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_deposits
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_deposits
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT
          ans.id,
          ans.business_risk,
          ans.control_risk,
          ans.answer_given,
          qm.option_id,
          qm.risk_category_id
        FROM answers_data ans
        INNER JOIN question_master qm
          ON qm.id = ans.question_id
        WHERE ans.assesment_id = ANY($1::int[])
          AND qm.risk_category_id IS NOT NULL
          AND ans.deleted_at IS NULL
          AND qm.deleted_at IS NULL
        `,
        [assessmentIds],
      ),
    ]);

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();

    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);

      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }

      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    const highestPossibleScore = Math.max(
      0,
      ...Array.from({ length: 4 }, (_value, index) => index + 1).flatMap(
        (businessRisk) =>
          Array.from({ length: 4 }, (__value, index) => index + 1).map(
            (controlRisk) => matrixScore(businessRisk, controlRisk),
          ),
      ),
    );

    const statsByRiskCategory = new Map<
      number,
      {
        totalQuestions: number;
        totalNaQuestions: number;
        totalQuestionsT1: number;
        totalAnnexT2: number;
        obtainedScore: number;
      }
    >();

    const getStats = (riskCategoryId: number) => {
      if (!statsByRiskCategory.has(riskCategoryId)) {
        statsByRiskCategory.set(riskCategoryId, {
          totalQuestions: 0,
          totalNaQuestions: 0,
          totalQuestionsT1: 0,
          totalAnnexT2: 0,
          obtainedScore: 0,
        });
      }

      return statsByRiskCategory.get(riskCategoryId)!;
    };

    const answerIds = answersResult.rows.map((row: any) => Number(row.id));
    const annexuresResult = answerIds.length
      ? await this.db.query(
        `
        SELECT
          ax.business_risk,
          ax.control_risk,
          ax.risk_cat_id AS risk_category_id
        FROM answers_data_annexure ax
        WHERE ax.answer_id = ANY($1::int[])
          AND ax.assesment_id = ANY($2::int[])
          AND ax.deleted_at IS NULL
        `,
        [answerIds, assessmentIds],
      )
      : { rows: [] };

    answersResult.rows.forEach((row: any) => {
      const riskCategoryId = Number(row.risk_category_id || 0);
      if (!riskCategoryId) {
        return;
      }

      const stats = getStats(riskCategoryId);
      const answer = String(row.answer_given || '')
        .trim()
        .toUpperCase();
      const isNotApplicable = [
        'NOT APPLICABLE',
        'N/A',
        'NA',
        'NOTAPPLICABLE',
      ].includes(answer);
      const isAnnexureAnswer = Number(row.option_id) === 4;

      stats.totalQuestions++;

      if (isNotApplicable) {
        stats.totalNaQuestions++;
        return;
      }

      if (!isAnnexureAnswer) {
        stats.totalQuestionsT1++;
        stats.obtainedScore += matrixScore(row.business_risk, row.control_risk);
      }
    });

    annexuresResult.rows.forEach((row: any) => {
      const riskCategoryId = Number(row.risk_category_id || 0);
      if (!riskCategoryId) {
        return;
      }

      const stats = getStats(riskCategoryId);
      stats.totalAnnexT2++;
      stats.obtainedScore += matrixScore(row.business_risk, row.control_risk);
    });

    let totalObtainedScoreWeighted = 0;
    const rows = riskCategoriesResult.rows
      .map((riskCategory: any, index: number) => {
        const riskCategoryId = Number(riskCategory.id);
        const stats = getStats(riskCategoryId);
        const riskWeight = Number(riskCategory.risk_weight || 0);
        const totalQuestionsT1T2 = stats.totalQuestionsT1 + stats.totalAnnexT2;
        const highestScoreWeighted =
          highestPossibleScore * totalQuestionsT1T2 * riskWeight;
        const obtainedScoreWeighted = stats.obtainedScore * riskWeight;

        totalObtainedScoreWeighted += obtainedScoreWeighted;

        return {
          sr_no: index + 1,
          risk_type: String(riskCategory.title || '').toUpperCase(),
          risk_weight: this.formatDecimal(riskWeight, 0),
          total_questions: stats.totalQuestions,
          total_na_questions: stats.totalNaQuestions,
          total_questions_t1: stats.totalQuestionsT1,
          total_annex_t2: stats.totalAnnexT2,
          total_questions_t1_t2: totalQuestionsT1T2,
          total_highest_score_weighted: this.formatDecimal(
            highestScoreWeighted,
            2,
          ),
          total_obtained_score_weighted: this.formatDecimal(
            obtainedScoreWeighted,
            2,
          ),
          relative_performance: this.formatDecimal(
            highestScoreWeighted > 0
              ? (obtainedScoreWeighted / highestScoreWeighted) * 100
              : 0,
            2,
          ),
          percent_to_total: 0,
          __obtained_weighted_value: obtainedScoreWeighted,
        };
      })
      .filter(
        (row: any) =>
          row.total_questions > 0 ||
          row.total_annex_t2 > 0 ||
          Number(row.total_obtained_score_weighted) > 0,
      )
      .map((row: any) => ({
        ...row,
        percent_to_total: this.formatDecimal(
          totalObtainedScoreWeighted > 0
            ? (Number(row.__obtained_weighted_value || 0) /
              totalObtainedScoreWeighted) *
            100
            : 0,
          2,
        ),
      }));

    const totals = rows.reduce(
      (acc: any, row: any) => {
        acc.totalQuestions += Number(row.total_questions || 0);
        acc.totalNaQuestions += Number(row.total_na_questions || 0);
        acc.totalQuestionsT1 += Number(row.total_questions_t1 || 0);
        acc.totalAnnexT2 += Number(row.total_annex_t2 || 0);
        acc.totalHighestScoreWeighted += Number(
          row.total_highest_score_weighted || 0,
        );
        acc.totalObtainedScoreWeighted += Number(
          row.total_obtained_score_weighted || 0,
        );
        acc.percentToTotal += Number(row.percent_to_total || 0);
        return acc;
      },
      {
        totalQuestions: 0,
        totalNaQuestions: 0,
        totalQuestionsT1: 0,
        totalAnnexT2: 0,
        totalHighestScoreWeighted: 0,
        totalObtainedScoreWeighted: 0,
        percentToTotal: 0,
      },
    );

    if (rows.length) {
      rows.push({
        sr_no: '',
        risk_type: 'TOTAL',
        risk_weight: '',
        total_questions: totals.totalQuestions,
        total_na_questions: totals.totalNaQuestions,
        total_questions_t1: totals.totalQuestionsT1,
        total_annex_t2: totals.totalAnnexT2,
        total_questions_t1_t2: totals.totalQuestionsT1 + totals.totalAnnexT2,
        total_highest_score_weighted: this.formatDecimal(
          totals.totalHighestScoreWeighted,
          2,
        ),
        total_obtained_score_weighted: this.formatDecimal(
          totals.totalObtainedScoreWeighted,
          2,
        ),
        relative_performance: '',
        percent_to_total: this.formatDecimal(totals.percentToTotal, 2),
      });
    }

    const branchCode = branchInfo.audit_unit_code
      ? ` - ( BR. ${branchInfo.audit_unit_code} )`
      : '';
    const combinedName = `${branchInfo.name || 'Selected Audit Unit'}${branchCode}`;
    const periodText =
      searchType === '3' || searchType === '4'
        ? `${this.dateOnly(assessmentsResult.rows[0].assesment_period_from)} to ${this.dateOnly(assessmentsResult.rows[0].assesment_period_to)}`
        : `${startDate} to ${endDate}`;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId || ''),
        startDate,
        endDate,
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: periodText,
        auditUnit: combinedName,
      },
      rows,
      summary: {
        auditsConducted: assessmentIds.length,
        totalQuestions: totals.totalQuestions,
        totalObtainedScore: this.formatDecimal(
          totals.totalObtainedScoreWeighted,
          2,
        ),
        totalDepositsSampling: Number(
          depositsSamplingResult.rows[0]?.count || 0,
        ),
        totalAdvancesSampling: Number(
          advancesSamplingResult.rows[0]?.count || 0,
        ),
      },
      meta: {
        totalDeposits: Number(depositsResult.rows[0]?.count || 0),
        totalAdvances: Number(advancesResult.rows[0]?.count || 0),
      },
    };
  }

  async getPerformanceRiskWeightageCategoryWiseReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : '';
    const endDate = query.endDate ? String(query.endDate).trim() : '';
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!['3', '4', '5', '6'].includes(searchType)) {
      throw new BadRequestException('Search type is required');
    }

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if (
      (searchType === '5' || searchType === '6') &&
      (!startDate || !endDate)
    ) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    let assessmentsResult: any;

    if (searchType === '3' || searchType === '4') {
      assessmentsResult = await this.db.query(
        `
        SELECT
          id,
          year_id,
          audit_unit_id,
          assesment_period_from,
          assesment_period_to,
          frequency
        FROM audit_assesment_master
        WHERE id = $1
          AND audit_unit_id = $2
          AND deleted_at IS NULL
        `,
        [assessmentId, auditUnitId],
      );
    } else {
      const statusCondition = removePending
        ? (isFreeFlow ? 'AND audit_status_id >= 4' : 'AND audit_status_id > 4')
        : (isFreeFlow ? 'AND audit_status_id >= 1' : 'AND audit_status_id > 1');

      assessmentsResult = await this.db.query(
        `
        SELECT
          id,
          year_id,
          audit_unit_id,
          assesment_period_from,
          assesment_period_to,
          frequency
        FROM audit_assesment_master
        WHERE audit_unit_id = $1
          AND assesment_period_from >= $2
          AND assesment_period_to <= $3
          ${statusCondition}
          AND deleted_at IS NULL
        ORDER BY id ASC
        `,
        [auditUnitId, startDate, endDate],
      );
    }

    if (!assessmentsResult.rows.length) {
      throw new BadRequestException('No data found for selected filters.');
    }

    const assessmentIds = assessmentsResult.rows.map((row: any) =>
      Number(row.id),
    );
    const firstYearId = Number(assessmentsResult.rows[0].year_id || 0);

    const branchResult = await this.db.query(
      `
      SELECT name, audit_unit_code
      FROM audit_unit_master
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [auditUnitId],
    );
    const branchInfo = branchResult.rows[0] || {
      name: 'Selected Audit Unit',
      audit_unit_code: '',
    };

    const [
      riskCategoriesResult,
      riskMatrixResult,
      depositsResult,
      advancesResult,
      depositsSamplingResult,
      advancesSamplingResult,
      answersResult,
    ] = await Promise.all([
      this.db.query(
        `
        SELECT
          rcm.id,
          rcm.risk_category AS title,
          COALESCE(rcw.risk_weight, 0) AS risk_weight
        FROM risk_category_master rcm
        LEFT JOIN risk_category_weights rcw
          ON rcw.risk_category_id = rcm.id
          AND rcw.year_id = $1
          AND rcw.is_active = 1
          AND rcw.deleted_at IS NULL
        WHERE rcm.is_active = 1
          AND rcm.deleted_at IS NULL
        ORDER BY rcm.id ASC
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT risk_parameter, business_risk_score, control_risk_score
        FROM risk_matrix
        WHERE year_id = $1
          AND deleted_at IS NULL
        `,
        [firstYearId],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_deposits
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_deposits
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT
          ans.id,
          ans.business_risk,
          ans.control_risk,
          ans.answer_given,
          ans.dump_id,
          qm.option_id,
          qm.risk_category_id,
          cm.linked_table_id
        FROM answers_data ans
        INNER JOIN question_master qm
          ON qm.id = ans.question_id
        LEFT JOIN category_master cm
          ON cm.id = ans.category_id
        WHERE ans.assesment_id = ANY($1::int[])
          AND qm.risk_category_id IS NOT NULL
          AND ans.deleted_at IS NULL
          AND qm.deleted_at IS NULL
        `,
        [assessmentIds],
      ),
    ]);

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();

    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);

      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }

      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    const highestPossibleScore = Math.max(
      0,
      ...Array.from({ length: 4 }, (_value, index) => index + 1).flatMap(
        (businessRisk) =>
          Array.from({ length: 4 }, (__value, index) => index + 1).map(
            (controlRisk) => matrixScore(businessRisk, controlRisk),
          ),
      ),
    );

    const categoryKey = (dumpId: any, linkedTableId: any) => {
      if (!Number(dumpId || 0)) {
        return 'GENERAL';
      }

      return Number(linkedTableId || 0) === 1 ? 'DEPOSITS' : 'ADVANCES';
    };

    const statsByCategoryRisk = new Map<
      string,
      {
        totalQuestions: number;
        totalNaQuestions: number;
        totalQuestionsT1: number;
        totalAnnexT2: number;
        obtainedScore: number;
      }
    >();

    const getStats = (category: string, riskCategoryId: number) => {
      const key = `${category}:${riskCategoryId}`;

      if (!statsByCategoryRisk.has(key)) {
        statsByCategoryRisk.set(key, {
          totalQuestions: 0,
          totalNaQuestions: 0,
          totalQuestionsT1: 0,
          totalAnnexT2: 0,
          obtainedScore: 0,
        });
      }

      return statsByCategoryRisk.get(key)!;
    };

    const answerIds = answersResult.rows.map((row: any) => Number(row.id));
    const annexuresResult = answerIds.length
      ? await this.db.query(
        `
        SELECT
          ax.business_risk,
          ax.control_risk,
          ax.risk_cat_id AS risk_category_id,
          ans.dump_id,
          cm.linked_table_id
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans
          ON ans.id = ax.answer_id
          AND ans.deleted_at IS NULL
        LEFT JOIN category_master cm
          ON cm.id = ans.category_id
        WHERE ax.answer_id = ANY($1::int[])
          AND ax.assesment_id = ANY($2::int[])
          AND ax.deleted_at IS NULL
        `,
        [answerIds, assessmentIds],
      )
      : { rows: [] };

    answersResult.rows.forEach((row: any) => {
      const riskCategoryId = Number(row.risk_category_id || 0);
      if (!riskCategoryId) {
        return;
      }

      const stats = getStats(
        categoryKey(row.dump_id, row.linked_table_id),
        riskCategoryId,
      );
      const answer = String(row.answer_given || '')
        .trim()
        .toUpperCase();
      const isNotApplicable = [
        'NOT APPLICABLE',
        'N/A',
        'NA',
        'NOTAPPLICABLE',
      ].includes(answer);
      const isAnnexureAnswer = Number(row.option_id) === 4;

      stats.totalQuestions++;

      if (isNotApplicable) {
        stats.totalNaQuestions++;
        return;
      }

      if (!isAnnexureAnswer) {
        stats.totalQuestionsT1++;
        stats.obtainedScore += matrixScore(row.business_risk, row.control_risk);
      }
    });

    annexuresResult.rows.forEach((row: any) => {
      const riskCategoryId = Number(row.risk_category_id || 0);
      if (!riskCategoryId) {
        return;
      }

      const stats = getStats(
        categoryKey(row.dump_id, row.linked_table_id),
        riskCategoryId,
      );
      stats.totalAnnexT2++;
      stats.obtainedScore += matrixScore(row.business_risk, row.control_risk);
    });

    const categories = ['GENERAL', 'ADVANCES', 'DEPOSITS'];
    let totalObtainedScoreWeighted = 0;

    const rows = riskCategoriesResult.rows
      .flatMap((riskCategory: any) => {
        const riskCategoryId = Number(riskCategory.id);
        const riskWeight = Number(riskCategory.risk_weight || 0);

        return categories.map((category) => {
          const stats = getStats(category, riskCategoryId);
          const totalQuestionsT1T2 =
            stats.totalQuestionsT1 + stats.totalAnnexT2;
          const highestScoreWeighted =
            highestPossibleScore * totalQuestionsT1T2 * riskWeight;
          const obtainedScoreWeighted = stats.obtainedScore * riskWeight;

          totalObtainedScoreWeighted += obtainedScoreWeighted;

          return {
            category,
            risk_type: String(riskCategory.title || '').toUpperCase(),
            risk_weight: this.formatDecimal(riskWeight, 0),
            total_questions: stats.totalQuestions,
            total_na_questions: stats.totalNaQuestions,
            total_questions_t1: stats.totalQuestionsT1,
            total_annex_t2: stats.totalAnnexT2,
            total_questions_t1_t2: totalQuestionsT1T2,
            total_highest_score_weighted: this.formatDecimal(
              highestScoreWeighted,
              2,
            ),
            total_obtained_score_weighted: this.formatDecimal(
              obtainedScoreWeighted,
              2,
            ),
            relative_performance: this.formatDecimal(
              highestScoreWeighted > 0
                ? (obtainedScoreWeighted / highestScoreWeighted) * 100
                : 0,
              2,
            ),
            percent_to_total: 0,
            __obtained_weighted_value: obtainedScoreWeighted,
            __risk_order: riskCategoryId,
            __category_order: categories.indexOf(category) + 1,
          };
        });
      })
      .filter(
        (row: any) =>
          row.total_questions > 0 ||
          row.total_annex_t2 > 0 ||
          Number(row.total_obtained_score_weighted) > 0,
      )
      .sort((a: any, b: any) => {
        const riskDiff =
          Number(a.__risk_order || 0) - Number(b.__risk_order || 0);
        if (riskDiff !== 0) {
          return riskDiff;
        }

        return (
          Number(a.__category_order || 0) - Number(b.__category_order || 0)
        );
      })
      .map((row: any) => ({
        ...row,
        percent_to_total: this.formatDecimal(
          totalObtainedScoreWeighted > 0
            ? (Number(row.__obtained_weighted_value || 0) /
              totalObtainedScoreWeighted) *
            100
            : 0,
          2,
        ),
      }));

    const totals = rows.reduce(
      (acc: any, row: any) => {
        acc.totalQuestions += Number(row.total_questions || 0);
        acc.totalNaQuestions += Number(row.total_na_questions || 0);
        acc.totalQuestionsT1 += Number(row.total_questions_t1 || 0);
        acc.totalAnnexT2 += Number(row.total_annex_t2 || 0);
        acc.totalHighestScoreWeighted += Number(
          row.total_highest_score_weighted || 0,
        );
        acc.totalObtainedScoreWeighted += Number(
          row.total_obtained_score_weighted || 0,
        );
        acc.percentToTotal += Number(row.percent_to_total || 0);
        return acc;
      },
      {
        totalQuestions: 0,
        totalNaQuestions: 0,
        totalQuestionsT1: 0,
        totalAnnexT2: 0,
        totalHighestScoreWeighted: 0,
        totalObtainedScoreWeighted: 0,
        percentToTotal: 0,
      },
    );

    if (rows.length) {
      rows.push({
        category: '',
        risk_type: 'Total',
        risk_weight: '',
        total_questions: totals.totalQuestions,
        total_na_questions: totals.totalNaQuestions,
        total_questions_t1: totals.totalQuestionsT1,
        total_annex_t2: totals.totalAnnexT2,
        total_questions_t1_t2: totals.totalQuestionsT1 + totals.totalAnnexT2,
        total_highest_score_weighted: this.formatDecimal(
          totals.totalHighestScoreWeighted,
          2,
        ),
        total_obtained_score_weighted: this.formatDecimal(
          totals.totalObtainedScoreWeighted,
          2,
        ),
        relative_performance: '',
        percent_to_total: this.formatDecimal(totals.percentToTotal, 2),
      });
    }

    const branchCode = branchInfo.audit_unit_code
      ? ` - ( BR. ${branchInfo.audit_unit_code} )`
      : '';
    const combinedName = `${branchInfo.name || 'Selected Audit Unit'}${branchCode}`;
    const periodText =
      searchType === '3' || searchType === '4'
        ? `${this.dateOnly(assessmentsResult.rows[0].assesment_period_from)} to ${this.dateOnly(assessmentsResult.rows[0].assesment_period_to)}`
        : `${startDate} to ${endDate}`;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId || ''),
        startDate,
        endDate,
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: periodText,
        auditUnit: combinedName,
      },
      rows,
      summary: {
        auditsConducted: assessmentIds.length,
        totalQuestions: totals.totalQuestions,
        totalObtainedScore: this.formatDecimal(
          totals.totalObtainedScoreWeighted,
          2,
        ),
        totalDepositsSampling: Number(
          depositsSamplingResult.rows[0]?.count || 0,
        ),
        totalAdvancesSampling: Number(
          advancesSamplingResult.rows[0]?.count || 0,
        ),
      },
      meta: {
        totalDeposits: Number(depositsResult.rows[0]?.count || 0),
        totalAdvances: Number(advancesResult.rows[0]?.count || 0),
      },
    };
  }
  async getQuestionWiseScoringReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    // Step 1: Fetch assessment master row
    const assessmentResult = await this.db.query(
      `
      SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency, menu_ids, cat_ids, question_ids
      FROM audit_assesment_master
      WHERE id = $1
        AND audit_unit_id = $2
        AND deleted_at IS NULL
      `,
      [assessmentId, auditUnitId],
    );

    if (!assessmentResult.rows.length) {
      throw new BadRequestException('No assessment data found for selected filters.');
    }

    const assessment = assessmentResult.rows[0];
    const firstYearId = Number(assessment.year_id || 0);

    // Fetch branch info
    const branchResult = await this.db.query(
      `
      SELECT name, audit_unit_code
      FROM audit_unit_master
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [auditUnitId],
    );
    const branchInfo = branchResult.rows[0] || {
      name: 'Selected Audit Unit',
      audit_unit_code: '',
    };

    const branchCode = branchInfo.audit_unit_code
      ? ` - ( BR. ${branchInfo.audit_unit_code} )`
      : '';
    const combinedName = `${branchInfo.name || 'Selected Audit Unit'}${branchCode}`;

    // Step 2: Fetch all deposits/advances for this assessment to map dump_ids to account numbers
    const [depositsAll, advancesAll] = await Promise.all([
      this.db.query(
        `SELECT id, account_no, account_holder_name FROM dump_deposits WHERE assesment_period_id = $1 AND deleted_at IS NULL`,
        [assessment.id],
      ),
      this.db.query(
        `SELECT id, account_no, account_holder_name FROM dump_advances WHERE assesment_period_id = $1 AND deleted_at IS NULL`,
        [assessment.id],
      ),
    ]);

    const depositsMap = new Map<number, { account_no: string; account_holder_name: string }>();
    depositsAll.rows.forEach((row: any) => {
      depositsMap.set(Number(row.id), {
        account_no: String(row.account_no || '').trim(),
        account_holder_name: String(row.account_holder_name || '').trim(),
      });
    });

    const advancesMap = new Map<number, { account_no: string; account_holder_name: string }>();
    advancesAll.rows.forEach((row: any) => {
      advancesMap.set(Number(row.id), {
        account_no: String(row.account_no || '').trim(),
        account_holder_name: String(row.account_holder_name || '').trim(),
      });
    });

    // Step 3: Fetch deposits/advances sampling accounts mapped to scheme categories
    const [depositsSampling, advancesSampling] = await Promise.all([
      this.db.query(
        `
        SELECT 
          dt.id, 
          dt.account_no, 
          dt.account_holder_name, 
          COALESCE(sm.category_id, 0)::int AS cat_id
        FROM dump_deposits dt
        LEFT JOIN scheme_master sm ON dt.scheme_id = sm.id
        WHERE dt.assesment_period_id = $1
          AND dt.sampling_filter = 1
          AND dt.deleted_at IS NULL
          AND sm.deleted_at IS NULL
        `,
        [assessment.id],
      ),
      this.db.query(
        `
        SELECT 
          dt.id, 
          dt.account_no, 
          dt.account_holder_name, 
          COALESCE(sm.category_id, 0)::int AS cat_id
        FROM dump_advances dt
        LEFT JOIN scheme_master sm ON dt.scheme_id = sm.id
        WHERE dt.assesment_period_id = $1
          AND dt.sampling_filter = 1
          AND dt.deleted_at IS NULL
          AND sm.deleted_at IS NULL
        `,
        [assessment.id],
      ),
    ]);

    const categoryAccountsMap = new Map<number, any[]>();
    depositsSampling.rows.forEach((row: any) => {
      const catId = Number(row.cat_id);
      if (catId) {
        if (!categoryAccountsMap.has(catId)) {
          categoryAccountsMap.set(catId, []);
        }
        categoryAccountsMap.get(catId)!.push(row);
      }
    });
    advancesSampling.rows.forEach((row: any) => {
      const catId = Number(row.cat_id);
      if (catId) {
        if (!categoryAccountsMap.has(catId)) {
          categoryAccountsMap.set(catId, []);
        }
        categoryAccountsMap.get(catId)!.push(row);
      }
    });

    // Step 4: Fetch Menus — use ALL menu_ids that actually appear in the categories
    // (assessment.menu_ids can be incomplete; category.menu_id is the source of truth)
    const catIds = String(assessment.cat_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    const menusResult = catIds.length ? await this.db.query(
      `
      SELECT DISTINCT mm.id, mm.name
      FROM menu_master mm
      INNER JOIN category_master cm ON cm.menu_id = mm.id
      WHERE cm.id = ANY($1::int[])
        AND mm.is_active = 1
        AND mm.deleted_at IS NULL
      `,
      [catIds],
    ) : { rows: [] };

    const menusMap = new Map<number, string>();
    menusResult.rows.forEach((row: any) => {
      menusMap.set(Number(row.id), String(row.name || '').trim());
    });

    // Step 5: Fetch Risk Category Weights
    const riskCategoriesResult = await this.db.query(
      `
      SELECT
        rcm.id,
        rcm.risk_category AS title,
        COALESCE(rcw.risk_weight, 0) AS risk_weight
      FROM risk_category_master rcm
      LEFT JOIN risk_category_weights rcw
        ON rcw.risk_category_id = rcm.id
        AND rcw.year_id = $1
        AND rcw.is_active = 1
        AND rcw.deleted_at IS NULL
      WHERE rcm.is_active = 1
        AND rcm.deleted_at IS NULL
      ORDER BY rcm.id ASC
      `,
      [firstYearId],
    );

    const riskCategoriesMap = new Map<number, { title: string; weight: number }>();
    riskCategoriesResult.rows.forEach((row: any) => {
      riskCategoriesMap.set(Number(row.id), {
        title: String(row.title || '').trim(),
        weight: Number(row.risk_weight || 0),
      });
    });

    // Step 6: Fetch Risk Matrix for score calculation
    const riskMatrixResult = await this.db.query(
      `
      SELECT risk_parameter, business_risk_score, control_risk_score
      FROM risk_matrix
      WHERE year_id = $1
        AND deleted_at IS NULL
      `,
      [firstYearId],
    );

    const businessRiskScores = new Map<number, number>();
    const controlRiskScores = new Map<number, number>();
    riskMatrixResult.rows.forEach((row: any) => {
      const parameter = Number(row.risk_parameter);
      businessRiskScores.set(parameter, Number(row.business_risk_score || 0));
      controlRiskScores.set(parameter, Number(row.control_risk_score || 0));
    });

    const matrixScore = (businessRisk: any, controlRisk: any) => {
      const businessRiskId = Number(businessRisk);
      const controlRiskId = Number(controlRisk);
      if (
        !businessRiskId ||
        !controlRiskId ||
        businessRiskId < 1 ||
        businessRiskId > 4 ||
        controlRiskId < 1 ||
        controlRiskId > 4
      ) {
        return 0;
      }
      return (
        Number(businessRiskScores.get(businessRiskId) || 0) +
        Number(controlRiskScores.get(controlRiskId) || 0)
      );
    };

    // Step 7: Fetch Category Master records
    const categoriesResult = catIds.length ? await this.db.query(
      `
      SELECT id, menu_id, name, linked_table_id, question_set_ids
      FROM category_master
      WHERE id = ANY($1::int[])
        AND is_active = 1
        AND deleted_at IS NULL
      `,
      [catIds],
    ) : { rows: [] };

    // Step 8: Fetch Question Master records
    const questionIds = String(assessment.question_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    const questionsResult = questionIds.length ? await this.db.query(
      `
      SELECT id, set_id, parameters, risk_category_id, question, option_id, annexure_id, subset_multi_id
      FROM question_master
      WHERE id = ANY($1::int[])
        AND is_active = 1
        AND deleted_at IS NULL
      `,
      [questionIds],
    ) : { rows: [] };

    const questionHighestRiskMap = new Map<number, number>();
    questionsResult.rows.forEach((qRow: any) => {
      const qId = Number(qRow.id);
      const optionId = Number(qRow.option_id);
      let highestRisk = 0;

      if (optionId !== 3 && qRow.parameters) {
        try {
          const params = JSON.parse(qRow.parameters);
          if (Array.isArray(params)) {
            params.forEach((param: any) => {
              const score = matrixScore(param.br, param.cr);
              if (score > highestRisk) {
                highestRisk = score;
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
      questionHighestRiskMap.set(qId, highestRisk);
    });

    // Step 9: Fetch Answers and Annexures
    const answersResult = await this.db.query(
      `
      SELECT
        id,
        menu_id,
        category_id,
        dump_id,
        question_id,
        answer_given,
        audit_comment,
        business_risk,
        control_risk
      FROM answers_data
      WHERE assesment_id = $1
        AND deleted_at IS NULL
      `,
      [assessment.id],
    );

    const answersMap = new Map<string, any>();
    answersResult.rows.forEach((row: any) => {
      const key = `${row.menu_id}_${row.category_id}_${row.dump_id}_${row.question_id}`;
      answersMap.set(key, row);
    });

    const answerIds = answersResult.rows.map((row: any) => Number(row.id));
    const annexuresResult = answerIds.length ? await this.db.query(
      `
      SELECT
        answer_id,
        business_risk,
        control_risk,
        risk_cat_id AS risk_category_id
      FROM answers_data_annexure
      WHERE answer_id = ANY($1::int[])
        AND assesment_id = $2
        AND deleted_at IS NULL
      `,
      [answerIds, assessment.id],
    ) : { rows: [] };

    const annexuresMap = new Map<number, any[]>();
    annexuresResult.rows.forEach((annRow: any) => {
      const answerId = Number(annRow.answer_id);
      if (!annexuresMap.has(answerId)) {
        annexuresMap.set(answerId, []);
      }
      annexuresMap.get(answerId)!.push(annRow);
    });

    // Step 10: Build nested report tree
    const menuWiseMap = new Map<number, any>();

    categoriesResult.rows.forEach((catRow: any) => {
      const menuId = Number(catRow.menu_id);
      const catId = Number(catRow.id);
      const linkedTableId = Number(catRow.linked_table_id);

      if (!menuWiseMap.has(menuId)) {
        menuWiseMap.set(menuId, {
          menu_name: menusMap.get(menuId) || 'UNKNOWN MENU',
          risk_category_wise: new Map<number, any>(),
        });
      }

      const menuNode = menuWiseMap.get(menuId)!;

      let dumpIds: number[] = [0];
      if (linkedTableId === 1 || linkedTableId === 2) {
        const accountIds = (categoryAccountsMap.get(catId) || []).map((acc: any) => Number(acc.id));
        const answerDumpIds = answersResult.rows
          .filter((row: any) => Number(row.category_id) === catId && Number(row.dump_id) !== 0)
          .map((row: any) => Number(row.dump_id));
        dumpIds = Array.from(new Set([...accountIds, ...answerDumpIds]));
        if (dumpIds.length === 0) {
          dumpIds.push(0);
        }
      }

      const catSetIds = String(catRow.question_set_ids || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));

      const catQuestions = questionsResult.rows.filter((qRow: any) => {
        const qSetId = Number(qRow.set_id);
        return catSetIds.includes(qSetId);
      });

      catQuestions.forEach((qRow: any) => {
        const questionId = Number(qRow.id);
        const riskCatId = Number(qRow.risk_category_id || 0);

        if (!riskCategoriesMap.has(riskCatId)) {
          return;
        }

        const riskCategoryMaster = riskCategoriesMap.get(riskCatId)!;

        if (!menuNode.risk_category_wise.has(riskCatId)) {
          menuNode.risk_category_wise.set(riskCatId, {
            risk_category_master: {
              risk_category: riskCategoryMaster.title,
              risk_weightage: riskCategoryMaster.weight,
            },
            questions: [],
          });
        }

        const riskNode = menuNode.risk_category_wise.get(riskCatId)!;

        // For linked categories: find the ONE dump_id that has an actual answer for this question.
        // Do NOT repeat per sampled account — that causes 200x row explosion.
        let resolvedDumpId = 0;
        if (linkedTableId === 1 || linkedTableId === 2) {
          // Check if any of the dumpIds have an answer for this specific question
          const answeredDump = dumpIds.find((dId) => {
            const k = `${menuId}_${catId}_${dId}_${questionId}`;
            return answersMap.has(k);
          });
          resolvedDumpId = answeredDump !== undefined ? answeredDump : 0;
        }

        const genKey = `${menuId}_${catId}_${resolvedDumpId}_${questionId}`;
        const ansRow = answersMap.get(genKey);

        let answerGiven = ansRow ? String(ansRow.answer_given || '').trim() : '';
        let auditComment = ansRow ? String(ansRow.audit_comment || '').trim() : '';
        let riskScore = 0;

        if (ansRow) {
          riskScore = matrixScore(ansRow.business_risk, ansRow.control_risk);
        }

        const annexData = ansRow ? (annexuresMap.get(Number(ansRow.id)) || []) : [];
        if (annexData.length > 0) {
          answerGiven = 'AS PER ANNEXURE';
        }

        if (answerGiven.toUpperCase() === 'NOT APPLICABLE') {
          riskScore = 0;
        }

        let annexWeighted = 0;
        const annexDetails: any[] = [];
        annexData.forEach((aRow: any) => {
          const annexRiskId = Number(aRow.risk_category_id || 0);
          const annexRiskWeight = riskCategoriesMap.get(annexRiskId)?.weight || 0;
          const aRiskScore = matrixScore(aRow.business_risk, aRow.control_risk);
          const weighted = aRiskScore * annexRiskWeight;
          annexWeighted += weighted;
          annexDetails.push({ risk_score_weighted: weighted });
        });

        const highestWeightageQuestionRisk = questionHighestRiskMap.get(questionId) || 0;
        const rowMaxScore = (highestWeightageQuestionRisk * riskCategoryMaster.weight) + annexWeighted;

        let accountNo = '';
        let accountHolderName = '';
        if (linkedTableId === 1 && depositsMap.has(resolvedDumpId)) {
          accountNo = depositsMap.get(resolvedDumpId)!.account_no;
          accountHolderName = depositsMap.get(resolvedDumpId)!.account_holder_name;
        } else if (linkedTableId === 2 && advancesMap.has(resolvedDumpId)) {
          accountNo = advancesMap.get(resolvedDumpId)!.account_no;
          accountHolderName = advancesMap.get(resolvedDumpId)!.account_holder_name;
        }

        riskNode.questions.push({
          category_name: String(catRow.name || '').trim(),
          linked_table_id: linkedTableId,
          account_id: resolvedDumpId,
          account_no: accountNo,
          account_holder_name: accountHolderName,
          question: String(qRow.question || '').trim(),
          answer_given: answerGiven,
          audit_comment: auditComment,
          risk_score: riskScore,
          weighted_risk_score: riskScore * riskCategoryMaster.weight,
          highest_weightage_risk: rowMaxScore,
          annex_details: annexDetails,
        });
      });
    });

    const menuWiseList: any[] = [];
    Array.from(menuWiseMap.keys()).sort((a: any, b: any) => Number(a) - Number(b)).forEach((mId) => {
      const menuNode = menuWiseMap.get(mId)!;
      const riskCategoryWiseList: any[] = [];
      Array.from(menuNode.risk_category_wise.keys()).sort((a: any, b: any) => Number(a) - Number(b)).forEach((rcId) => {
        const riskNode = menuNode.risk_category_wise.get(rcId)!;
        if (riskNode.questions.length > 0) {
          riskCategoryWiseList.push({
            risk_category_id: rcId,
            ...riskNode,
          });
        }
      });
      if (riskCategoryWiseList.length > 0) {
        menuWiseList.push({
          menu_id: mId,
          menu_name: menuNode.menu_name,
          risk_category_wise: riskCategoryWiseList,
        });
      }
    });

    const periodText = `${this.dateOnly(assessment.assesment_period_from)} to ${this.dateOnly(assessment.assesment_period_to)}`;

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
      },
      total: menuWiseList.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: periodText,
        auditUnit: combinedName,
      },
      rows: menuWiseList,
    };
  }

  async getBroaderAreaWiseScoringReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : null;
    const endDate = query.endDate ? String(query.endDate).trim() : null;
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';
    const isFreeFlow = query.freeFlow === 'true' || query.freeFlow === '1';

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if (
      (searchType === '5' || searchType === '6') &&
      (!startDate || !endDate)
    ) {
      throw new BadRequestException(
        'Date range (Start Date & End Date) is required',
      );
    }

    // Step 1: Find matching assessments
    let assessments: any[] = [];
    if (searchType === '3' || searchType === '4') {
      const result = await this.db.query(
        `
        SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency
        FROM audit_assesment_master
        WHERE id = $1
          AND audit_unit_id = $2
          AND deleted_at IS NULL
        `,
        [assessmentId, auditUnitId],
      );
      assessments = result.rows;
    } else {
      const statusCondition = removePending
        ? (isFreeFlow ? 'AND audit_status_id >= 4' : 'AND audit_status_id > 4')
        : (isFreeFlow ? 'AND audit_status_id >= 1' : 'AND audit_status_id > 1');
      const result = await this.db.query(
        `
        SELECT id, year_id, audit_unit_id, assesment_period_from, assesment_period_to, frequency
        FROM audit_assesment_master
        WHERE audit_unit_id = $1
          AND assesment_period_from >= $2
          AND assesment_period_to <= $3
          ${statusCondition}
          AND deleted_at IS NULL
        ORDER BY id ASC
        `,
        [auditUnitId, startDate, endDate],
      );
      assessments = result.rows;
    }

    if (!assessments.length) {
      throw new BadRequestException(
        'No assessments found for selected filters.',
      );
    }

    const assessmentIds = assessments.map((a) => Number(a.id));
    const firstYearId = Number(assessments[0].year_id);

    // Fetch branch info
    const branchResult = await this.db.query(
      `SELECT name, audit_unit_code FROM audit_unit_master WHERE id = $1 AND deleted_at IS NULL`,
      [auditUnitId],
    );
    const branchInfo = branchResult.rows[0] || {
      name: 'Unknown',
      audit_unit_code: '-',
    };

    // Step 2: Fetch Risk Category weightages for the financial year
    const riskCategoriesResult = await this.db.query(
      `
      SELECT
        rcm.id,
        rcm.risk_category AS title,
        COALESCE(rcw.risk_weight, 0) AS risk_weight
      FROM risk_category_master rcm
      LEFT JOIN risk_category_weights rcw
        ON rcw.risk_category_id = rcm.id
        AND rcw.year_id = $1
        AND rcw.is_active = 1
        AND rcw.deleted_at IS NULL
      WHERE rcm.is_active = 1
        AND rcm.deleted_at IS NULL
      ORDER BY rcm.id ASC
      `,
      [firstYearId],
    );
    const riskCategories = riskCategoriesResult.rows;

    // Step 3: Fetch Deposits/Advances Sampling Counts per Assessment
    const [depositsSamplingResult, advancesSamplingResult] = await Promise.all([
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_deposits
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds],
      ),
    ]);

    const totalDepositsSampling = Number(
      depositsSamplingResult.rows[0]?.count || 0,
    );
    const totalAdvancesSampling = Number(
      advancesSamplingResult.rows[0]?.count || 0,
    );

    // Fetch Broader Area names
    const broaderAreasResult = await this.db.query(
      `SELECT id, name FROM audit_area_master WHERE deleted_at IS NULL`,
    );
    const broaderAreasMap = new Map();
    for (const row of broaderAreasResult.rows) {
      broaderAreasMap.set(Number(row.id), String(row.name || '').trim());
    }

    // Step 4: Run Unified Aggregation Query in DB
    const aggregationResult = await this.db.query(
      `
      WITH unified_answers AS (
        -- Standard Answers
        SELECT
          ans.assesment_id::int,
          ans.category_id::int,
          ans.is_compliance::int AS is_compliance,
          qm.risk_category_id::int,
          qm.area_of_audit_id::int AS audit_area_id,
          cm.linked_table_id::int,
          CASE WHEN ans.business_risk::text ~ '^[0-9]+$' THEN ans.business_risk::int ELSE NULL END AS business_risk,
          CASE WHEN ans.control_risk::text ~ '^[0-9]+$' THEN ans.control_risk::int ELSE NULL END AS control_risk,
          0 AS is_annexure,
          qm.option_id::int
        FROM answers_data ans
        INNER JOIN question_master qm ON ans.question_id = qm.id
        LEFT JOIN category_master cm ON cm.id = ans.category_id
        WHERE ans.assesment_id = ANY($1::int[])
          AND (ans.business_risk IN ('1', '2', '3') OR ans.control_risk IN ('1', '2', '3') OR qm.option_id = 4)
          AND ans.deleted_at IS NULL
          AND qm.deleted_at IS NULL

        UNION ALL

        -- Annexure Answers
        SELECT
          ax.assesment_id::int,
          ans.category_id::int,
          CASE WHEN ax.audit_commpliance = '1' THEN 1 ELSE 0 END AS is_compliance,
          ax.risk_cat_id::int AS risk_category_id,
          qm.area_of_audit_id::int AS audit_area_id,
          cm.linked_table_id::int,
          CASE WHEN ax.business_risk::text ~ '^[0-9]+$' THEN ax.business_risk::int ELSE NULL END AS business_risk,
          CASE WHEN ax.control_risk::text ~ '^[0-9]+$' THEN ax.control_risk::int ELSE NULL END AS control_risk,
          1 AS is_annexure,
          qm.option_id::int
        FROM answers_data_annexure ax
        INNER JOIN answers_data ans ON ax.answer_id = ans.id
        INNER JOIN question_master qm ON ans.question_id = qm.id
        LEFT JOIN category_master cm ON cm.id = ans.category_id
        WHERE qm.option_id = 4
          AND ax.assesment_id = ANY($1::int[])
          AND (ax.business_risk IN ('1', '2', '3') OR ax.control_risk IN ('1', '2', '3'))
          AND ax.deleted_at IS NULL
      ),
      answers_with_scores AS (
        SELECT
          ua.linked_table_id,
          ua.audit_area_id,
          ua.risk_category_id,
          ua.is_compliance,
          ua.is_annexure,
          ua.option_id,
          ua.business_risk,
          ua.control_risk,
          COALESCE(rm_b.business_risk_score, 0) + COALESCE(rm_c.control_risk_score, 0) AS score
        FROM unified_answers ua
        LEFT JOIN risk_matrix rm_b 
          ON rm_b.risk_parameter::int = ua.business_risk 
          AND rm_b.year_id = $2 
          AND rm_b.deleted_at IS NULL
        LEFT JOIN risk_matrix rm_c 
          ON rm_c.risk_parameter::int = ua.control_risk 
          AND rm_c.year_id = $2 
          AND rm_c.deleted_at IS NULL
      )
      SELECT
        CASE 
          WHEN linked_table_id = 1 THEN 'deposits'
          WHEN linked_table_id = 2 THEN 'advances'
          ELSE 'general'
        END AS cat_key,
        audit_area_id,
        risk_category_id,
        SUM(CASE WHEN is_compliance = 1 THEN 1 ELSE 0 END)::int AS acc_non_compliant,
        SUM(CASE WHEN is_annexure = 1 THEN 1 ELSE 0 END)::int AS total_annex,
        
        -- Business Risk High (Business Risk = 1)
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 1 AND control_risk = 1 THEN score ELSE 0 END)::int AS qual_1_1,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 1 AND control_risk = 2 THEN score ELSE 0 END)::int AS qual_1_2,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 1 AND control_risk = 3 THEN score ELSE 0 END)::int AS qual_1_3,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 1 AND control_risk = 1 THEN score ELSE 0 END)::int AS quan_1_1,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 1 AND control_risk = 2 THEN score ELSE 0 END)::int AS quan_1_2,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 1 AND control_risk = 3 THEN score ELSE 0 END)::int AS quan_1_3,
        
        -- Business Risk Medium (Business Risk = 2)
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 2 AND control_risk = 1 THEN score ELSE 0 END)::int AS qual_2_1,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 2 AND control_risk = 2 THEN score ELSE 0 END)::int AS qual_2_2,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 2 AND control_risk = 3 THEN score ELSE 0 END)::int AS qual_2_3,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 2 AND control_risk = 1 THEN score ELSE 0 END)::int AS quan_2_1,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 2 AND control_risk = 2 THEN score ELSE 0 END)::int AS quan_2_2,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 2 AND control_risk = 3 THEN score ELSE 0 END)::int AS quan_2_3,
        
        -- Business Risk Low (Business Risk = 3)
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 3 AND control_risk = 1 THEN score ELSE 0 END)::int AS qual_3_1,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 3 AND control_risk = 2 THEN score ELSE 0 END)::int AS qual_3_2,
        SUM(CASE WHEN linked_table_id NOT IN (1, 2) AND is_annexure = 0 AND option_id != 4 AND business_risk = 3 AND control_risk = 3 THEN score ELSE 0 END)::int AS qual_3_3,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 3 AND control_risk = 1 THEN score ELSE 0 END)::int AS quan_3_1,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 3 AND control_risk = 2 THEN score ELSE 0 END)::int AS quan_3_2,
        SUM(CASE WHEN (linked_table_id IN (1, 2) OR is_annexure = 1) AND business_risk = 3 AND control_risk = 3 THEN score ELSE 0 END)::int AS quan_3_3
      FROM answers_with_scores
      GROUP BY cat_key, audit_area_id, risk_category_id
      `,
      [assessmentIds, firstYearId],
    );

    const rows = [];
    let tot_weighted_score = 0;

    for (const dbRow of aggregationResult.rows) {
      const catKey = String(dbRow.cat_key);
      const broaderAreaId = Number(dbRow.audit_area_id);
      const riskCatId = Number(dbRow.risk_category_id);

      if (!broaderAreaId || !riskCatId) continue;

      const rc = riskCategories.find((r) => Number(r.id) === riskCatId);
      const title = rc ? String(rc.title).toUpperCase() : `Risk #${riskCatId}`;
      const riskWeight = rc ? Number(rc.risk_weight || 0) : 0;

      // Sum totals
      const qual_tot =
        dbRow.qual_1_1 +
        dbRow.qual_1_2 +
        dbRow.qual_1_3 +
        dbRow.qual_2_1 +
        dbRow.qual_2_2 +
        dbRow.qual_2_3 +
        dbRow.qual_3_1 +
        dbRow.qual_3_2 +
        dbRow.qual_3_3;

      const quan_tot =
        dbRow.quan_1_1 +
        dbRow.quan_1_2 +
        dbRow.quan_1_3 +
        dbRow.quan_2_1 +
        dbRow.quan_2_2 +
        dbRow.quan_2_3 +
        dbRow.quan_3_1 +
        dbRow.quan_3_2 +
        dbRow.quan_3_3;

      if (qual_tot === 0 && quan_tot === 0) {
        continue; // Skip blank rows
      }

      const total_qual_quan = qual_tot + quan_tot;

      // no_of_acc_checked
      let no_of_acc_checked = 0;
      if (catKey === 'deposits') {
        no_of_acc_checked = totalDepositsSampling + dbRow.total_annex;
      } else if (catKey === 'advances') {
        no_of_acc_checked = totalAdvancesSampling + dbRow.total_annex;
      } else {
        no_of_acc_checked = dbRow.total_annex;
      }

      // avg_quan_score
      const avg_quan_score =
        quan_tot > 0 ? quan_tot / (no_of_acc_checked || 1) : 0;

      // tot_avg_score
      const tot_avg_score = qual_tot + avg_quan_score;

      // avg_tot_score_per_audit
      const avg_tot_score_per_audit = tot_avg_score / assessmentIds.length;

      // weighted_score
      const weighted_score = riskWeight * avg_tot_score_per_audit;

      tot_weighted_score += weighted_score;

      rows.push({
        branch_code: branchInfo.audit_unit_code,
        branch_name: branchInfo.name,
        risk_type: title,
        category_name: catKey.toUpperCase(),
        broader_area_name:
          broaderAreasMap.get(broaderAreaId) || `Area #${broaderAreaId}`,

        qual_1_1: dbRow.qual_1_1 || 0,
        qual_1_2: dbRow.qual_1_2 || 0,
        qual_1_3: dbRow.qual_1_3 || 0,
        quan_1_1: dbRow.quan_1_1 || 0,
        quan_1_2: dbRow.quan_1_2 || 0,
        quan_1_3: dbRow.quan_1_3 || 0,

        qual_2_1: dbRow.qual_2_1 || 0,
        qual_2_2: dbRow.qual_2_2 || 0,
        qual_2_3: dbRow.qual_2_3 || 0,
        quan_2_1: dbRow.quan_2_1 || 0,
        quan_2_2: dbRow.quan_2_2 || 0,
        quan_2_3: dbRow.quan_2_3 || 0,

        qual_3_1: dbRow.qual_3_1 || 0,
        qual_3_2: dbRow.qual_3_2 || 0,
        qual_3_3: dbRow.qual_3_3 || 0,
        quan_3_1: dbRow.quan_3_1 || 0,
        quan_3_2: dbRow.quan_3_2 || 0,
        quan_3_3: dbRow.quan_3_3 || 0,

        qual_tot: this.formatDecimal(qual_tot, 2),
        quan_tot: this.formatDecimal(quan_tot, 2),
        total_qual_quan: this.formatDecimal(total_qual_quan, 2),
        acc_non_compliant: dbRow.acc_non_compliant,
        no_of_acc_checked: no_of_acc_checked,
        avg_quan_score: this.formatDecimal(avg_quan_score, 2),
        tot_avg_score: this.formatDecimal(tot_avg_score, 2),
        no_of_audit_conduct: assessmentIds.length,
        avg_tot_score_per_audit: this.formatDecimal(avg_tot_score_per_audit, 2),
        risk_weight: riskWeight,
        weighted_score: this.formatDecimal(weighted_score, 2),
        __broader_area_id: broaderAreaId,
        __risk_cat_id: riskCatId,
      });
    }

    // Sort matching legacy looping hierarchy
    const catOrder: Record<string, number> = {
      GENERAL: 1,
      DEPOSITS: 2,
      ADVANCES: 3,
    };
    rows.sort((a, b) => {
      const catDiff =
        (catOrder[a.category_name] || 99) - (catOrder[b.category_name] || 99);
      if (catDiff !== 0) return catDiff;
      const areaDiff = a.__broader_area_id - b.__broader_area_id;
      if (areaDiff !== 0) return areaDiff;
      return a.__risk_cat_id - b.__risk_cat_id;
    });

    return {
      filters: {
        selectSearchTypeFilter: searchType,
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
        startDate: startDate || '',
        endDate: endDate || '',
        rmv_pending_assesments: removePending ? ['1'] : [],
      },
      total: rows.length,
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod:
          searchType === '3' || searchType === '4'
            ? `${this.dateOnly(assessments[0].assesment_period_from)} to ${this.dateOnly(assessments[0].assesment_period_to)}`
            : `${startDate} to ${endDate}`,
        auditUnit: branchInfo.name,
      },
      rows,
      summary: {
        total: this.formatDecimal(tot_weighted_score, 2),
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

    this.applyAssessmentAuditTypeFilter(where, params, query, 'asm.audit_type_id');

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
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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
    const auditTypeId = this.normalizeAuditType(query);

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
        AND ($3::int IS NULL OR COALESCE(asm.audit_type_id, 1) = $3)
        AND aut.deleted_at IS NULL
        AND asm.deleted_at IS NULL
      ORDER BY aut.type_id::int ASC, aut.created_at ASC, aut.id ASC
      `,
      [assessmentId, auditUnitId, auditTypeId],
    );

    const rows = result.rows.map((row: any, index: number) => ({
      sr_no: index + 1,
      inspection_type: this.timelineTypeLabel(row.type_id),
      rejected_count: [3, 6].includes(Number(row.status_id))
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
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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

  async getCarryForwardReport(query: any) {
    const auditUnitId = String(query.audit_unit_id || '').trim();
    const financialYear = String(query.financial_year || 'all').trim();
    const transferStatus = String(query.transfer_status || 'all').trim();
    const targetAssessmentId = Number(query.target_assessment_id || 0);
    const sourceAssessmentId = Number(query.source_assessment_id || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    const where: string[] = [
      'source_assessment.deleted_at IS NULL',
      'audit_unit.deleted_at IS NULL',
    ];
    const params: any[] = [];

    if (auditUnitId === 'all_branches') {
      where.push('audit_unit.section_type_id = 1');
    } else if (auditUnitId === 'all_head_of_dept') {
      where.push('audit_unit.section_type_id > 1');
    } else {
      params.push(Number(auditUnitId));
      where.push(`source_assessment.audit_unit_id = $${params.length}`);
    }

    if (financialYear !== 'all') {
      params.push(Number(financialYear));
      where.push(`source_assessment.year_id = $${params.length}`);
    }

    this.applyAssessmentAuditTypeFilter(
      where,
      params,
      query,
      'source_assessment.audit_type_id',
    );

    if (targetAssessmentId > 0) {
      params.push(targetAssessmentId);
      where.push(`points.target_assessment_id = $${params.length}`);
    }

    if (sourceAssessmentId > 0) {
      params.push(sourceAssessmentId);
      where.push(`points.source_assessment_id = $${params.length}`);
    }

    if (transferStatus === 'transferred') {
      where.push('COALESCE(points.target_assessment_id, 0) > 0');
    } else if (transferStatus === 'pending') {
      where.push('COALESCE(points.target_assessment_id, 0) = 0');
    }

    const authorityIds = String(query.audit_unit_authority || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    const userTypeId = Number(query.user_type_id || 0);

    if ([2, 3, 4, 6].includes(userTypeId) && authorityIds.length) {
      params.push(authorityIds);
      where.push(`source_assessment.audit_unit_id = ANY($${params.length}::int[])`);
    }

    const result = await this.db.query(
      `
      WITH carry_forward_points AS (
          SELECT
              ad.id AS answer_id,
              0::bigint AS annexure_id,
              ad.assesment_id AS source_assessment_id,
              ad.cf_asses_id AS target_assessment_id,
              ad.cf_transfer_date AS transfer_date,
              'question'::text AS point_type,
              ad.dump_id,
              ad.answer_given AS previous_answer,
              ad.audit_comment AS previous_audit_comment,
              ad.business_risk,
              ad.control_risk,
              ad.audit_commpliance AS manager_response,
              ad.compliance_reviewer_comment AS reviewer_comment,
              mm.name AS menu_name,
              cm.name AS category_name,
              cm.linked_table_id,
              qhm.name AS header_name,
              qm.question,
              qm.option_id,
              qm.annexure_id AS question_annexure_id,
              ac.columns_json AS annexure_columns,
              rc.risk_category
          FROM answers_data ad
          LEFT JOIN menu_master mm ON mm.id = ad.menu_id
          LEFT JOIN category_master cm ON cm.id = ad.category_id
          LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
          LEFT JOIN question_master qm ON qm.id = ad.question_id
          LEFT JOIN risk_category_master rc ON rc.id = qm.risk_category_id
          LEFT JOIN (
              SELECT columns_source.annexure_id,
                  jsonb_agg(jsonb_build_object('id', columns_source.id, 'name', columns_source.name, 'column_type_id', columns_source.column_type_id) ORDER BY columns_source.id) AS columns_json
              FROM annexure_columns columns_source
              WHERE columns_source.deleted_at IS NULL
              GROUP BY columns_source.annexure_id
          ) ac ON ac.annexure_id = qm.annexure_id
          WHERE ad.is_compliance = 1
              AND ad.compliance_status_id = 5
              AND ad.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM answers_data_annexure aa
                  WHERE aa.answer_id = ad.id
                      AND aa.assesment_id = ad.assesment_id
                      AND aa.compliance_status_id = 5
                      AND aa.deleted_at IS NULL
              )

          UNION ALL

          SELECT
              ad.id AS answer_id,
              aa.id AS annexure_id,
              aa.assesment_id AS source_assessment_id,
              aa.cf_asses_id AS target_assessment_id,
              aa.cf_transfer_date AS transfer_date,
              'annexure'::text AS point_type,
              ad.dump_id,
              aa.answer_given AS previous_answer,
              aa.audit_comment AS previous_audit_comment,
              aa.business_risk,
              aa.control_risk,
              aa.audit_commpliance AS manager_response,
              aa.compliance_reviewer_comment AS reviewer_comment,
              mm.name AS menu_name,
              cm.name AS category_name,
              cm.linked_table_id,
              qhm.name AS header_name,
              qm.question,
              qm.option_id,
              qm.annexure_id AS question_annexure_id,
              ac.columns_json AS annexure_columns,
              rc.risk_category
          FROM answers_data_annexure aa
          INNER JOIN answers_data ad
              ON ad.id = aa.answer_id
              AND ad.assesment_id = aa.assesment_id
              AND ad.is_compliance = 1
              AND ad.deleted_at IS NULL
          LEFT JOIN menu_master mm ON mm.id = ad.menu_id
          LEFT JOIN category_master cm ON cm.id = ad.category_id
          LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
          LEFT JOIN question_master qm ON qm.id = ad.question_id
          LEFT JOIN risk_category_master rc ON rc.id = qm.risk_category_id
          LEFT JOIN (
              SELECT columns_source.annexure_id,
                  jsonb_agg(jsonb_build_object('id', columns_source.id, 'name', columns_source.name, 'column_type_id', columns_source.column_type_id) ORDER BY columns_source.id) AS columns_json
              FROM annexure_columns columns_source
              WHERE columns_source.deleted_at IS NULL
              GROUP BY columns_source.annexure_id
          ) ac ON ac.annexure_id = qm.annexure_id
          WHERE aa.compliance_status_id = 5
              AND aa.deleted_at IS NULL
      )
      SELECT
          points.*,
          source_assessment.year_id,
          source_assessment.audit_unit_id,
          source_assessment.assesment_period_from AS source_period_from,
          source_assessment.assesment_period_to AS source_period_to,
          source_assessment.frequency AS source_frequency,
          target_assessment.assesment_period_from AS target_period_from,
          target_assessment.assesment_period_to AS target_period_to,
          target_assessment.frequency AS target_frequency,
          audit_unit.audit_unit_code,
          audit_unit.name AS audit_unit_name,
          COALESCE(deposit.account_no, advance.account_no) AS account_no,
          COALESCE(deposit.account_holder_name, advance.account_holder_name) AS account_holder_name,
          account_unit.name AS account_branch_name,
          account_unit.audit_unit_code AS account_branch_code,
          scheme.name AS scheme_name,
          scheme.scheme_code,
          COALESCE(deposit.ucic, advance.ucic) AS ucic,
          COALESCE(deposit.customer_type, advance.customer_type) AS customer_type,
          COALESCE(deposit.account_opening_date, advance.account_opening_date) AS account_opening_date,
          advance.renewal_date,
          COALESCE(deposit.principal_amount, advance.sanction_amount) AS account_amount,
          COALESCE(deposit.intrest_rate, advance.intrest_rate) AS interest_rate,
          COALESCE(deposit.balance, advance.outstanding_balance) AS outstanding_balance,
          COALESCE(deposit.balance_date, advance.balance_date) AS balance_date,
          advance.due_date,
          advance.npa_status,
          COALESCE(deposit.account_status, advance.account_status) AS account_status
      FROM carry_forward_points points
      INNER JOIN audit_assesment_master source_assessment
          ON source_assessment.id = points.source_assessment_id
      LEFT JOIN audit_assesment_master target_assessment
          ON target_assessment.id = points.target_assessment_id
          AND target_assessment.deleted_at IS NULL
      INNER JOIN audit_unit_master audit_unit
          ON audit_unit.id = source_assessment.audit_unit_id
      LEFT JOIN dump_deposits deposit
          ON points.linked_table_id = 1
          AND deposit.id = points.dump_id
          AND deposit.deleted_at IS NULL
      LEFT JOIN dump_advances advance
          ON points.linked_table_id = 2
          AND advance.id = points.dump_id
          AND advance.deleted_at IS NULL
      LEFT JOIN audit_unit_master account_unit
          ON account_unit.id = COALESCE(deposit.branch_id, advance.branch_id)
          AND account_unit.deleted_at IS NULL
      LEFT JOIN scheme_master scheme
          ON scheme.id = COALESCE(deposit.scheme_id, advance.scheme_id)
          AND scheme.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY
          audit_unit.audit_unit_code,
          source_assessment.assesment_period_from,
          points.menu_name,
          points.category_name,
          points.header_name,
          points.answer_id,
          points.annexure_id;
      `,
      params,
    );

    const questionRows = this.buildPointReportQuestionRows(
      result.rows,
      (row) => ({
        carry_forward_status: Number(row.target_assessment_id || 0) > 0
          ? 'Transferred'
          : 'Pending Transfer',
        source_assessment_id: Number(row.source_assessment_id),
        target_assessment_id: Number(row.target_assessment_id || 0),
      }),
    );
    const rows = this.buildAuditCompleteGroupedRows(questionRows);

    return {
      filters: {
        audit_unit_id: auditUnitId,
        financial_year: financialYear,
        audit_type_id: String(query.audit_type_id || 'all').trim(),
        transfer_status: transferStatus,
        target_assessment_id: targetAssessmentId || '',
        source_assessment_id: sourceAssessmentId || '',
      },
      total: questionRows.length,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        total: questionRows.length,
        transferred: questionRows.filter((row: any) => row.target_assessment_id > 0).length,
        pending: questionRows.filter((row: any) => row.target_assessment_id === 0).length,
        accountPoints: questionRows.filter((row: any) => Boolean(row.__account_key)).length,
        annexurePoints: result.rows.filter((row: any) => row.point_type === 'annexure').length,
      },
    };
  }

  async getPartiallyPassReport(query: any) {
    const auditUnitId = String(query.audit_unit_id || '').trim();
    const financialYear = String(query.financial_year || 'all').trim();
    const partialStatus = String(query.partial_status || 'all').trim();
    const sourceAssessmentId = Number(query.source_assessment_id || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    const where: string[] = [
      'assessment.deleted_at IS NULL',
      'audit_unit.deleted_at IS NULL',
    ];
    const params: any[] = [];

    if (auditUnitId === 'all_branches') {
      where.push('audit_unit.section_type_id = 1');
    } else if (auditUnitId === 'all_head_of_dept') {
      where.push('audit_unit.section_type_id > 1');
    } else {
      params.push(Number(auditUnitId));
      where.push(`assessment.audit_unit_id = $${params.length}`);
    }

    if (financialYear !== 'all') {
      params.push(Number(financialYear));
      where.push(`assessment.year_id = $${params.length}`);
    }

    this.applyAssessmentAuditTypeFilter(
      where,
      params,
      query,
      'assessment.audit_type_id',
    );

    if (sourceAssessmentId > 0) {
      params.push(sourceAssessmentId);
      where.push(`points.assesment_id = $${params.length}`);
    }

    const statusByFilter: Record<string, number> = {
      manager_pending: 7,
      reviewer_pending: 8,
      settled: 9,
    };
    if (statusByFilter[partialStatus]) {
      params.push(statusByFilter[partialStatus]);
      where.push(`points.compliance_status_id = $${params.length}`);
    }

    const authorityIds = String(query.audit_unit_authority || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    const userTypeId = Number(query.user_type_id || 0);

    if ([2, 3, 4, 6].includes(userTypeId) && authorityIds.length) {
      params.push(authorityIds);
      where.push(`assessment.audit_unit_id = ANY($${params.length}::int[])`);
    }

    const result = await this.db.query(
      `
      WITH partial_points AS (
          SELECT
              ad.id AS answer_id,
              0::bigint AS annexure_id,
              ad.assesment_id,
              'question'::text AS point_type,
              ad.dump_id,
              ad.answer_given AS previous_answer,
              ad.audit_comment AS previous_audit_comment,
              ad.business_risk,
              ad.control_risk,
              ad.compliance_status_id,
              ad.compliance_reviewer_comment AS reviewer_comment,
              ad.audit_commpliance AS manager_response,
              mm.name AS menu_name,
              cm.name AS category_name,
              cm.linked_table_id,
              qhm.name AS header_name,
              qm.question,
              qm.option_id,
              qm.annexure_id AS question_annexure_id,
              ac.columns_json AS annexure_columns,
              rc.risk_category
          FROM answers_data ad
          LEFT JOIN menu_master mm ON mm.id = ad.menu_id
          LEFT JOIN category_master cm ON cm.id = ad.category_id
          LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
          LEFT JOIN question_master qm ON qm.id = ad.question_id
          LEFT JOIN risk_category_master rc ON rc.id = qm.risk_category_id
          LEFT JOIN (
              SELECT columns_source.annexure_id,
                  jsonb_agg(jsonb_build_object('id', columns_source.id, 'name', columns_source.name, 'column_type_id', columns_source.column_type_id) ORDER BY columns_source.id) AS columns_json
              FROM annexure_columns columns_source
              WHERE columns_source.deleted_at IS NULL
              GROUP BY columns_source.annexure_id
          ) ac ON ac.annexure_id = qm.annexure_id
          WHERE ad.is_compliance = 1
              AND ad.compliance_status_id IN (7, 8, 9)
              AND ad.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM answers_data_annexure aa
                  WHERE aa.answer_id = ad.id
                      AND aa.assesment_id = ad.assesment_id
                      AND aa.compliance_status_id IN (7, 8, 9)
                      AND aa.deleted_at IS NULL
              )

          UNION ALL

          SELECT
              ad.id AS answer_id,
              aa.id AS annexure_id,
              aa.assesment_id,
              'annexure'::text AS point_type,
              ad.dump_id,
              aa.answer_given AS previous_answer,
              aa.audit_comment AS previous_audit_comment,
              aa.business_risk,
              aa.control_risk,
              aa.compliance_status_id,
              aa.compliance_reviewer_comment AS reviewer_comment,
              aa.audit_commpliance AS manager_response,
              mm.name AS menu_name,
              cm.name AS category_name,
              cm.linked_table_id,
              qhm.name AS header_name,
              qm.question,
              qm.option_id,
              qm.annexure_id AS question_annexure_id,
              ac.columns_json AS annexure_columns,
              rc.risk_category
          FROM answers_data_annexure aa
          INNER JOIN answers_data ad
              ON ad.id = aa.answer_id
              AND ad.assesment_id = aa.assesment_id
              AND ad.is_compliance = 1
              AND ad.deleted_at IS NULL
          LEFT JOIN menu_master mm ON mm.id = ad.menu_id
          LEFT JOIN category_master cm ON cm.id = ad.category_id
          LEFT JOIN question_header_master qhm ON qhm.id = ad.header_id
          LEFT JOIN question_master qm ON qm.id = ad.question_id
          LEFT JOIN risk_category_master rc ON rc.id = qm.risk_category_id
          LEFT JOIN (
              SELECT columns_source.annexure_id,
                  jsonb_agg(jsonb_build_object('id', columns_source.id, 'name', columns_source.name, 'column_type_id', columns_source.column_type_id) ORDER BY columns_source.id) AS columns_json
              FROM annexure_columns columns_source
              WHERE columns_source.deleted_at IS NULL
              GROUP BY columns_source.annexure_id
          ) ac ON ac.annexure_id = qm.annexure_id
          WHERE aa.compliance_status_id IN (7, 8, 9)
              AND aa.deleted_at IS NULL
      )
      SELECT
          points.*,
          assessment.audit_unit_id,
          assessment.assesment_period_from,
          assessment.assesment_period_to,
          assessment.frequency,
          audit_unit.audit_unit_code,
          audit_unit.name AS audit_unit_name,
          COALESCE(deposit.account_no, advance.account_no) AS account_no,
          COALESCE(deposit.account_holder_name, advance.account_holder_name) AS account_holder_name,
          account_unit.name AS account_branch_name,
          account_unit.audit_unit_code AS account_branch_code,
          scheme.name AS scheme_name,
          scheme.scheme_code,
          COALESCE(deposit.ucic, advance.ucic) AS ucic,
          COALESCE(deposit.customer_type, advance.customer_type) AS customer_type,
          COALESCE(deposit.account_opening_date, advance.account_opening_date) AS account_opening_date,
          advance.renewal_date,
          COALESCE(deposit.principal_amount, advance.sanction_amount) AS account_amount,
          COALESCE(deposit.intrest_rate, advance.intrest_rate) AS interest_rate,
          COALESCE(deposit.balance, advance.outstanding_balance) AS outstanding_balance,
          COALESCE(deposit.balance_date, advance.balance_date) AS balance_date,
          advance.due_date,
          advance.npa_status,
          COALESCE(deposit.account_status, advance.account_status) AS account_status
      FROM partial_points points
      INNER JOIN audit_assesment_master assessment ON assessment.id = points.assesment_id
      INNER JOIN audit_unit_master audit_unit ON audit_unit.id = assessment.audit_unit_id
      LEFT JOIN dump_deposits deposit
          ON points.linked_table_id = 1
          AND deposit.id = points.dump_id
          AND deposit.deleted_at IS NULL
      LEFT JOIN dump_advances advance
          ON points.linked_table_id = 2
          AND advance.id = points.dump_id
          AND advance.deleted_at IS NULL
      LEFT JOIN audit_unit_master account_unit
          ON account_unit.id = COALESCE(deposit.branch_id, advance.branch_id)
          AND account_unit.deleted_at IS NULL
      LEFT JOIN scheme_master scheme
          ON scheme.id = COALESCE(deposit.scheme_id, advance.scheme_id)
          AND scheme.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
      ORDER BY audit_unit.audit_unit_code, assessment.assesment_period_from,
          points.menu_name, points.category_name, points.header_name,
          points.answer_id, points.annexure_id;
      `,
      params,
    );

    const questionRows = this.buildPointReportQuestionRows(
      result.rows,
      (row) => {
        const status = Number(row.compliance_status_id || 0);
        return {
          partial_pass_status: status === 7
            ? 'Pending with Manager'
            : status === 8
              ? 'Pending with Reviewer'
              : 'Settled',
          compliance_status_id: status,
        };
      },
    );
    const rows = this.buildAuditCompleteGroupedRows(questionRows);

    return {
      filters: {
        audit_unit_id: auditUnitId,
        financial_year: financialYear,
        audit_type_id: String(query.audit_type_id || 'all').trim(),
        partial_status: partialStatus,
        source_assessment_id: sourceAssessmentId || '',
      },
      total: questionRows.length,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        total: questionRows.length,
        managerPending: questionRows.filter((row: any) => row.compliance_status_id === 7).length,
        reviewerPending: questionRows.filter((row: any) => row.compliance_status_id === 8).length,
        settled: questionRows.filter((row: any) => row.compliance_status_id === 9).length,
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

    this.applyAssessmentAuditTypeFilter(where, params, query, 'asm.audit_type_id');

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
        audit_type_id: String(query.audit_type_id || 'all').trim(),
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
        compliancePending: rows.filter((row) => row.audit_status_id === 4)
          .length,
        complianceReviewPending: rows.filter((row) => row.audit_status_id === 5)
          .length,
        reComplianceNeeded: rows.filter((row) => row.audit_status_id === 6)
          .length,
        completed: rows.filter((row) => row.audit_status_id === 7).length,
        blocked: rows.filter((row) => row.is_limit_blocked === 1).length,
        expired: rows.filter(
          (row) => row.audit_expired || row.compliance_expired,
        ).length,
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
    const auditExpired = Boolean(
      !auditCompleted &&
      [1, 3].includes(auditStatusId) &&
      !isBlocked &&
      auditDueDate &&
      auditDueDate < today &&
      !row.audit_end_date,
    );
    const complianceExpired = Boolean(
      auditCompleted &&
      [4, 6].includes(auditStatusId) &&
      !isBlocked &&
      complianceDueDate &&
      complianceDueDate < today,
    );

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
      audit_status_label: this.auditStatusLabel(
        auditStatusId,
        isBlocked,
        auditExpired,
      ),
      audit_due_date: row.audit_due_date,
      audit_expired: auditExpired,
      compliance_start_date: auditCompleted ? row.compliance_start_date : null,
      compliance_end_date: auditCompleted ? row.compliance_end_date : null,
      compliance_due_date: row.compliance_due_date,
      compliance_status_label: auditCompleted
        ? this.complianceStatusLabel(
          auditStatusId,
          isBlocked,
          complianceExpired,
        )
        : '-',
      compliance_expired: complianceExpired,
      is_limit_blocked: isBlocked ? 1 : 0,
    };
  }

  private auditStatusLabel(
    statusId: number,
    blocked: boolean,
    expired: boolean,
  ) {
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

  private complianceStatusLabel(
    statusId: number,
    blocked: boolean,
    expired: boolean,
  ) {
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

  private isPendingObservation(assessmentStatusId: number, observation: any) {
    const auditObservationStatusId = Number(observation.audit_status_id || 0);
    const complianceObservationStatusId = Number(
      observation.compliance_status_id || 0,
    );

    if ([2, 3].includes(assessmentStatusId)) {
      return ![1, 2].includes(auditObservationStatusId);
    }

    if (assessmentStatusId === 4) {
      return true;
    }

    if ([5, 6].includes(assessmentStatusId)) {
      return ![1, 2].includes(complianceObservationStatusId);
    }

    return false;
  }

  private auditTimelineStatusLabel(statusId: number) {
    const labels: Record<number, string> = {
      1: 'AUDIT (PENDING / ACTIVE)',
      2: 'REVIEW (PENDING / ACTIVE)',
      3: 'RE AUDIT (PENDING / ACTIVE)',
      4: 'COMPLIANCE (PENDING / ACTIVE)',
      5: 'REVIEW (PENDING / ACTIVE)',
      6: 'RE COMPLIANCE (PENDING / ACTIVE)',
      7: 'ASSESMENT COMPLETED',
      8: 'REVIEWER TO AUDIT (All OBSERVATIONS)',
      9: 'REVIEWER TO COMPLIANCE (All OBSERVATIONS)',
      10: 'ADMIN INCREASE ACCEPT / REJECT LIMIT IN AUDIT',
      11: 'ADMIN INCREASE ACCEPT / REJECT LIMIT IN COMPLIANCE',
      12: 'ADMIN INCREASE DUE DATE IN AUDIT',
      13: 'ADMIN INCREASE DUE DATE IN COMPLIANCE',
      14: 'REVIEWER TO AUDIT (ENTIRE ASSESMENT BACK TO AUDIT)',
    };

    return labels[statusId] || '-';
  }

  private async getAssessmentHeader(assessmentId: number) {
    const result = await this.db.query(
      `
      SELECT
        aam.id,
        aam.assesment_period_from,
        aam.assesment_period_to,
        aam.frequency,
        aam.is_multiple_auditors,
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
      isMultipleAuditors: !!row.is_multiple_auditors,
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
      const endDate = this.addDays(this.addMonths(startDate, frequency), -1);

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

    return (
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth())
    );
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

      if (
        (row.__annexure_rows || []).length
        && !(row.__vouching_rows || []).length
      ) {
        rows.push({
          __report_annexure: true,
          __annexure_title:
            row.__annexure_rows[0]?.title || 'Annexure Details',
          __annexure_rows: row.__annexure_rows,
        });
      }

      if ((row.__vouching_rows || []).length) {
        rows.push({
          __report_vouching: true,
          __vouching_columns: row.__vouching_rows[0].columns || [],
          __vouching_rows: row.__vouching_rows,
        });
      }
    });

    return rows;
  }

  private buildPointReportQuestionRows(
    rawRows: any[],
    extraFields: (row: any) => Record<string, any>,
  ) {
    const grouped = new Map<number, any[]>();

    rawRows.forEach((row) => {
      const answerId = Number(row.answer_id || 0);
      grouped.set(answerId, [...(grouped.get(answerId) || []), row]);
    });

    return Array.from(grouped.values()).map((points) => {
      const base = points.find((point) => Number(point.annexure_id || 0) === 0)
        || points[0];
      const annexureRows = points
        .filter((point) => Number(point.annexure_id || 0) > 0)
        .map((point) => ({
          ...point,
          answer_given: point.previous_answer,
          audit_commpliance: point.manager_response,
        }));

      return {
        ...base,
        ...extraFields(base),
        sr_no: 0,
        question: base.question || 'Assessment observation',
        answer_given: annexureRows.length
          ? 'As per annexure'
          : base.previous_answer || '-',
        audit_comment: base.previous_audit_comment || '-',
        manager_response: base.manager_response || '-',
        reviewer_comment: base.reviewer_comment || '-',
        __account_key: this.accountDetailKey(base),
        __account_details: this.accountDetailRows(base),
        __is_vouching: this.isVouchingTransactionRow(base),
        __annexure_rows: this.formatAnnexureRows(
          annexureRows,
          base.annexure_columns || [],
        ),
        __vouching_rows: this.isVouchingTransactionRow(base)
          ? this.formatVouchingRows(
            annexureRows,
            base.annexure_columns || [],
          )
          : [],
      };
    });
  }

  private buildAuditCompleteGroupedRowsWithAssessments(questionRows: any[]) {
    const rows: any[] = [];
    let currentAssessmentId = 0;
    let assessmentRows: any[] = [];

    const flushAssessmentRows = () => {
      if (!assessmentRows.length) {
        return;
      }

      rows.push(...this.buildAuditCompleteGroupedRows(assessmentRows));
      assessmentRows = [];
    };

    questionRows.forEach((row) => {
      const assessmentId = Number(row.assesment_id || 0);

      if (assessmentId !== currentAssessmentId) {
        flushAssessmentRows();
        rows.push({
          __report_group: true,
          __group_level: 'menu',
          __group_label: `Assessment: ${row.__assessment_label || assessmentId}`,
        });
        currentAssessmentId = assessmentId;
      }

      assessmentRows.push(row);
    });

    flushAssessmentRows();

    return rows;
  }

  private async getAuditCompleteAnnexureRows(
    assessmentId: number,
    answerIds: number[],
  ) {
    return this.getAuditCompleteAnnexureRowsForAssessments(
      [assessmentId],
      answerIds,
    );
  }

  private async getAuditCompleteAnnexureRowsForAssessments(
    assessmentIds: number[],
    answerIds: number[],
    extraWhere = '',
  ) {
    const rowsByAnswer = new Map<number, any[]>();

    if (!assessmentIds.length || !answerIds.length) {
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
        rc.risk_category,
        aa.audit_commpliance,
        aa.compliance_reviewer_comment
      FROM answers_data_annexure aa
      LEFT JOIN risk_category_master rc
        ON rc.id = aa.risk_cat_id
      WHERE aa.assesment_id = ANY($1::int[])
        AND aa.answer_id = ANY($2::int[])
        AND aa.deleted_at IS NULL
        ${extraWhere ? `AND ${extraWhere}` : ''}
      ORDER BY aa.answer_id, aa.id
      `,
      [assessmentIds, answerIds],
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
    const firstColumnName = String(
      annexureColumns[0]?.name || 'Annexure Details',
    ).trim();

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
        audit_commpliance: row.audit_commpliance || '-',
        compliance_reviewer_comment: row.compliance_reviewer_comment || '-',
      };
    });
  }

  private formatVouchingRows(rows: any[], columns: any[]) {
    const vouchingColumns = this.parseJsonArray(columns).map(
      (column: any, index: number) => ({
        label: String(column?.name || `Column ${index + 1}`).trim(),
      }),
    );

    return rows.map((row, index) => {
      const values = this.parseJsonArray(row.answer_given);
      const cells = vouchingColumns.map((_column: any, columnIndex: number) => {
        const value = String(values[columnIndex] || '').trim();

        return columnIndex === 0
          ? `${index + 1}) ${value || '-'}`
          : value || '-';
      });

      return {
        columns: vouchingColumns,
        cells,
        business_risk_label: this.riskParameterLabel(row.business_risk),
        control_risk_label: this.riskParameterLabel(row.control_risk),
        risk_category: row.risk_category || '-',
        audit_commpliance: row.audit_commpliance || '-',
        compliance_reviewer_comment: row.compliance_reviewer_comment || '-',
      };
    });
  }

  private isVouchingTransactionRow(row: any) {
    return [row.menu_name, row.category_name, row.header_name, row.question]
      .map((item) => String(item || '').toLowerCase())
      .some((item) => item.includes('vouching'));
  }

  private accountDetailKey(row: any) {
    if (!Number(row.dump_id || 0)) {
      return '';
    }

    return [row.scheme_code, row.account_no, row.ucic, row.account_holder_name]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(':');
  }

  private accountDetailRows(row: any) {
    if (!Number(row.dump_id || 0)) {
      return null;
    }

    return {
      title: `Account Details: ${String(row.account_holder_name || row.account_no || '').trim() || '-'}`,
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
          this.detailCell(
            'Account Open Date',
            this.dateOnly(row.account_opening_date),
          ),
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
      value:
        value === null || value === undefined || value === '' ? '-' : value,
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

  private async getExecutiveSummaryDefinition(isCompliance: boolean, isFreeFlow = false) {
    const lookups = isCompliance
      ? await this.getComplianceLookups(isFreeFlow)
      : await this.getAuditCompleteLookups(isFreeFlow);

    const slug = isCompliance
      ? 'executive-summary-compliance-report'
      : 'executive-summary-audit-report';

    const title = isCompliance
      ? 'Executive Summary Compliance Report'
      : 'Executive Summary Audit Report';

    const fileName = isCompliance
      ? 'executive-summary-compliance-report'
      : 'executive-summary-audit-report';

    return {
      slug,
      title,
      category: 'Audit Reports',
      page: 'A4',
      fileName,
      brand: {
        logoUrl: '/assets/images/logos/kredpool_logo.png',
        bankName: this.getBankName('The Kurla Nagrik Sahakari Bank Ltd'),
      },
      defaultFilters: {
        reportAuditUnit: '',
        financial_year: 'all',
        reportAuditAssesment: '',
      },
      filters: [
        {
          key: 'reportAuditUnit',
          label: 'Select Branch',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
        },
        {
          key: 'financial_year',
          label: 'Financial Year',
          type: 'select',
          required: true,
          options: lookups.years,
        },
        {
          key: 'reportAuditAssesment',
          label: 'Select Audit Assessment',
          type: 'select',
          required: true,
          dependsOn: 'reportAuditUnit',
          optionParentKey: 'audit_unit_id',
          options: lookups.assessments,
        },
      ],
      columns: [],
    };
  }

  async getExecutiveSummaryReport(query: any, isCompliance: boolean) {
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if (!assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    const assessmentQuery = `
      SELECT 
        aam.id,
        aam.year_id,
        aam.audit_unit_id,
        aam.frequency,
        aam.assesment_period_from,
        aam.assesment_period_to,
        aam.audit_start_date,
        aam.audit_end_date,
        aam.compliance_due_date,
        aam.compliance_end_date,
        aam.audit_status_id,
        ym.year AS financial_year,
        aum.name AS branch_name,
        aum.audit_unit_code AS branch_code,
        (
            aam.audit_end_date::date
            -
            aam.audit_start_date::date
        ) AS audit_duration_days,
        branch_manager.name AS branch_manager_name,
        branch_assitant_manager.name AS branch_assistant_manager,
        auditor_name.name AS auditor_name,
        td.deposit_target AS deposit_target,
        td.advances_target AS advances_target,
        td.npa_target AS npa_target,
        esb.id AS esb_id,
        esb.report_submitted_date AS report_submitted_date,
        esb.staff_count As staff_count,
        esb.manual_challans_per_day as manual_challans_per_day
      FROM audit_assesment_master aam
      LEFT JOIN audit_unit_master aum
          ON aum.id = aam.audit_unit_id
      LEFT JOIN year_master ym
          ON ym.id = aam.year_id
      LEFT JOIN employee_master auditor
          ON auditor.id = aam.audit_emp_id
      LEFT JOIN employee_master review
          ON review.id = aam.audit_review_emp_id
      LEFT JOIN employee_master branch_manager
          ON branch_manager.id = aam.branch_head_id
      LEFT JOIN employee_master branch_assitant_manager
          ON branch_assitant_manager.id = aam.branch_subhead_id
      LEFT JOIN employee_master auditor_name
          ON auditor_name.id = aam.audit_head_id
      LEFT JOIN target_details td
          ON td.audit_unit_id = aam.audit_unit_id
          AND td.year_id = aam.year_id
      LEFT JOIN executive_summary_basic_details esb
          ON esb.assesment_id = aam.id AND esb.deleted_at IS NULL
      WHERE aam.id = $1 AND aam.deleted_at IS NULL
      LIMIT 1;
    `;

    const assessmentResult = await this.db.query(assessmentQuery, [
      assessmentId,
    ]);

    if (!assessmentResult.rows.length) {
      throw new NotFoundException('Assessment not found');
    }

    const assessment = assessmentResult.rows[0];

    const [branchPositions, freshAccounts, marchPositions, schemes] =
      await Promise.all([
        this.db.query(
          `
        SELECT
            type_id,
            amount,
            year_id,
            audit_commpliance,
            audit_status_id AS review_action,
            audit_reviewer_comment AS reviewer_comment
        FROM executive_summary_branch_position
        WHERE assesment_id = $1
            AND deleted_at IS NULL;
        `,
          [assessmentId],
        ),
        this.db.query(
          `
        SELECT
            type_id,
            accounts,
            year_id,
            audit_commpliance,
            audit_status_id AS review_action,
            audit_reviewer_comment AS reviewer_comment
        FROM executive_summary_fresh_accounts
        WHERE assesment_id = $1
            AND deleted_at IS NULL;
        `,
          [assessmentId],
        ),
        this.db.query(
          `
        SELECT
            gl_type_id,
            march_position
        FROM exe_summary
        WHERE audit_unit_id = $1
            AND year_id = $2
            AND deleted_at IS NULL;
        `,
          [assessment.audit_unit_id, assessment.year_id],
        ),
        this.db.query(
          `
        SELECT
            scheme_type,
            scheme_id,
            scheme_code,
            scheme_name,
            category_id
        FROM (
            SELECT
                'DEPOSITS' AS scheme_type,
                sm.id AS scheme_id,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END AS category_id
            FROM dump_deposits dd
            INNER JOIN audit_assesment_master aam
                ON aam.id = $1
            LEFT JOIN scheme_master sm
                ON sm.id = dd.scheme_id
            WHERE
                dd.branch_id = aam.audit_unit_id
                AND dd.deleted_at IS NULL
            GROUP BY
                sm.id,
                sm.scheme_code,
                sm.name,
                sm.category_id
            UNION ALL
            SELECT
                'ADVANCES' AS scheme_type,
                sm.id AS scheme_id,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END AS category_id
            FROM dump_advances da
            INNER JOIN audit_assesment_master aam
                ON aam.id = $1
            LEFT JOIN scheme_master sm
                ON sm.id = da.scheme_id
            WHERE
                da.branch_id = aam.audit_unit_id
                AND da.deleted_at IS NULL
            GROUP BY
                sm.id,
                sm.scheme_code,
                sm.name,
                sm.category_id
            UNION ALL
            SELECT
                CASE WHEN cm.linked_table_id = 1 THEN 'DEPOSITS' ELSE 'ADVANCES' END AS scheme_type,
                sm.id AS scheme_id,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE 
                    WHEN cm.linked_table_id = 1 THEN
                        CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END
                    ELSE
                        CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END
                END AS category_id
            FROM executive_summary_branch_position bp
            INNER JOIN scheme_master sm ON sm.scheme_code = REPLACE(bp.type_id::text, '_NPA', '')
            LEFT JOIN category_master cm ON cm.id = sm.category_id
            WHERE bp.assesment_id = $1 AND bp.deleted_at IS NULL
            UNION ALL
            SELECT
                CASE WHEN cm.linked_table_id = 1 THEN 'DEPOSITS' ELSE 'ADVANCES' END AS scheme_type,
                sm.id AS scheme_id,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE 
                    WHEN cm.linked_table_id = 1 THEN
                        CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END
                    ELSE
                        CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END
                END AS category_id
            FROM executive_summary_fresh_accounts fa
            INNER JOIN scheme_master sm ON sm.scheme_code = REPLACE(fa.type_id::text, '_NPA', '')
            LEFT JOIN category_master cm ON cm.id = sm.category_id
            WHERE fa.assesment_id = $1 AND fa.deleted_at IS NULL
        ) x
        GROUP BY
            scheme_type,
            scheme_id,
            scheme_code,
            scheme_name,
            category_id
        ORDER BY
            scheme_type,
            scheme_code;
        `,
          [assessmentId],
        ),
      ]);

    const deduplicate = (rows: any[], targetYearId: number) => {
      const map = new Map<string, any>();
      for (const row of rows) {
        const key = String(row.type_id).trim();
        const existing = map.get(key);
        if (!existing || Number(row.year_id) === Number(targetYearId)) {
          map.set(key, row);
        }
      }
      return Array.from(map.values());
    };

    const dedupedBranchPositions = deduplicate(
      branchPositions.rows,
      assessment.year_id,
    );
    const dedupedFreshAccounts = deduplicate(
      freshAccounts.rows,
      assessment.year_id,
    );

    return {
      filters: {
        reportAuditUnit: String(auditUnitId),
        reportAuditAssesment: String(assessmentId),
      },
      generatedAt: new Date().toISOString(),
      header: {
        assessmentPeriod: `${this.dateOnly(assessment.assesment_period_from)} to ${this.dateOnly(assessment.assesment_period_to)}`,
        auditUnit: `${assessment.branch_code} - ${assessment.branch_name}`,
      },
      rows: [{}],
      summary: {},
      exeData: {
        assessment,
        branchPositions: dedupedBranchPositions,
        freshAccounts: dedupedFreshAccounts,
        marchPositions: marchPositions.rows,
        schemes: schemes.rows,

        // Snake_case mappings matching getExecutiveSummary format exactly:
        branch_positions: dedupedBranchPositions.map((row: any) => ({
          type_id: row.type_id,
          amount: row.amount,
          review_action: row.review_action,
          reviewer_comment: row.reviewer_comment,
          audit_commpliance: row.audit_commpliance,
        })),
        fresh_accounts: dedupedFreshAccounts.map((row: any) => ({
          type_id: row.type_id,
          accounts: row.accounts,
          review_action: row.review_action,
          reviewer_comment: row.reviewer_comment,
          audit_commpliance: row.audit_commpliance,
        })),
        march_positions: marchPositions.rows.map((row: any) => ({
          gl_type_id: Number(row.gl_type_id),
          march_position: Number(row.march_position || 0),
        })),
      },
    };
  }

  private async getInternalAssessmentDefinition() {
    const lookups = await this.getAuditStatusLookups();
    return {
      slug: 'internal-assesment-report',
      title: 'Internal Audit & Compliance Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'internal-assesment-report',
      brand: {
        logoUrl: '/assets/images/logos/assurepro-logo.svg',
        bankName: this.getBankName(),
      },
      defaultFilters: {
        audit_unit_id: 'all_branches',
        financial_year: 'all',
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
          required: true,
          options: lookups.years,
        },
      ],
      columns: [],
      summaryCards: [],
    };
  }

  async getInternalAssessmentReport(query: any) {
    const financialYear = String(query.financial_year || '').trim();
    const isAllYears = financialYear === 'all';
    if (!financialYear) {
      throw new BadRequestException('Financial year is required');
    }

    let yearObj: any;
    if (isAllYears) {
      yearObj = { id: 'all', year: 'All Years' };
    } else {
      const yearResult = await this.db.query(
        `
        SELECT id, year
        FROM year_master
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
        `,
        [Number(financialYear)],
      );
      if (yearResult.rows.length === 0) {
        throw new NotFoundException('Financial year not found');
      }
      yearObj = yearResult.rows[0];
    }

    const userTypeId = Number(query.user_type_id || 0);
    const auditUnitAuthority = String(query.audit_unit_authority || '').trim();
    const employeeId = Number(query.employee_id || 0);

    let whereClause = 'is_active = 1 AND deleted_at IS NULL';
    const params: any[] = [];

    if (userTypeId === 2 || userTypeId === 4) {
      if (auditUnitAuthority) {
        const assignedIds = auditUnitAuthority
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
        if (assignedIds.length > 0) {
          params.push(assignedIds);
          whereClause += ` AND id = ANY($${params.length}::int[])`;
        } else {
          whereClause += ' AND 1 = 0';
        }
      } else {
        whereClause += ' AND 1 = 0';
      }
    } else if (userTypeId === 3) {
      if (auditUnitAuthority) {
        const assignedIds = auditUnitAuthority
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
        if (assignedIds.length > 0) {
          params.push(assignedIds);
          const assignedIdsIndex = params.length;
          params.push(employeeId);
          const employeeIdIndex = params.length;
          whereClause += ` AND (id = ANY($${assignedIdsIndex}::int[]) OR branch_head_id = $${employeeIdIndex} OR branch_subhead_id = $${employeeIdIndex})`;
        } else {
          params.push(employeeId);
          whereClause += ` AND (branch_head_id = $${params.length} OR branch_subhead_id = $${params.length})`;
        }
      } else {
        params.push(employeeId);
        whereClause += ` AND (branch_head_id = $${params.length} OR branch_subhead_id = $${params.length})`;
      }
    } else if (userTypeId === 6) {
      const regionResult = await this.db.query(
        `SELECT region_name FROM employee_master WHERE id = $1 AND deleted_at IS NULL`,
        [employeeId]
      );
      const regionName = regionResult.rows[0]?.region_name || '';
      const assignedUnitsResult = await this.db.query(
        `SELECT audit_unit_ids FROM region_master WHERE LOWER(TRIM(region_name)) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
        [regionName]
      );
      const assignedIds = assignedUnitsResult.rows.flatMap((row: any) =>
        String(row.audit_unit_ids || '')
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n > 0)
      );
      if (assignedIds.length > 0) {
        params.push(assignedIds);
        whereClause += ` AND id = ANY($${params.length}::int[])`;
      } else {
        whereClause += ' AND 1 = 0';
      }
    }

    const auditUnitId = String(query.audit_unit_id || '').trim();
    if (
      auditUnitId &&
      auditUnitId !== 'all_branches' &&
      auditUnitId !== 'all_head_of_dept'
    ) {
      params.push(Number(auditUnitId));
      whereClause += ` AND id = $${params.length}`;
    } else if (auditUnitId === 'all_branches') {
      whereClause += ' AND section_type_id = 1';
    } else if (auditUnitId === 'all_head_of_dept') {
      whereClause += ' AND section_type_id > 1';
    }

    const unitsResult = await this.db.query(
      `
      SELECT
        id,
        audit_unit_code,
        name,
        section_type_id
      FROM audit_unit_master
      WHERE ${whereClause}
      ORDER BY section_type_id ASC, audit_unit_code ASC, name ASC
      `,
      params,
    );

    const auditUnits = unitsResult.rows.map((row: any) => ({
      id: row.id,
      audit_unit_code: row.audit_unit_code,
      name: row.name,
      combined_name: this.auditUnitName(row),
      asses_data: {} as Record<number, any>,
    }));

    if (auditUnits.length > 0) {
      const unitIds = auditUnits.map((u: any) => u.id);
      const assessmentsResult = isAllYears
        ? await this.db.query(
          `
            SELECT
              id,
              year_id,
              audit_unit_id,
              frequency,
              assesment_period_from,
              assesment_period_to,
              audit_status_id,
              audit_start_date,
              audit_review_date,
              compliance_start_date
            FROM audit_assesment_master
            WHERE deleted_at IS NULL
              AND audit_unit_id = ANY($1::int[])
            `,
          [unitIds],
        )
        : await this.db.query(
          `
            SELECT
              id,
              year_id,
              audit_unit_id,
              frequency,
              assesment_period_from,
              assesment_period_to,
              audit_status_id,
              audit_start_date,
              audit_review_date,
              compliance_start_date
            FROM audit_assesment_master
            WHERE deleted_at IS NULL
              AND year_id = $1
              AND audit_unit_id = ANY($2::int[])
            `,
          [Number(financialYear), unitIds],
        );

      const assessments = assessmentsResult.rows;
      for (const assessment of assessments) {
        const unit = auditUnits.find(
          (u: any) => u.id === assessment.audit_unit_id,
        );
        if (unit) {
          unit.asses_data[assessment.id] = {
            id: assessment.id,
            year_id: assessment.year_id,
            audit_unit_id: assessment.audit_unit_id,
            frequency: assessment.frequency,
            assesment_period_from: assessment.assesment_period_from,
            assesment_period_to: assessment.assesment_period_to,
            audit_status_id: assessment.audit_status_id,
            audit_start_date: assessment.audit_start_date,
            audit_review_date: assessment.audit_review_date,
            compliance_start_date: assessment.compliance_start_date,
          };
        }
      }
    }

    let auditUnitHeader = 'All Branches';
    if (auditUnitId === 'all_head_of_dept') {
      auditUnitHeader = 'All Head Of Departments';
    } else if (auditUnitId && auditUnitId !== 'all_branches') {
      if (auditUnits.length === 1) {
        auditUnitHeader = auditUnits[0].combined_name;
      } else {
        const selectedUnit = auditUnits.find(
          (u: any) => String(u.id) === auditUnitId,
        );
        if (selectedUnit) {
          auditUnitHeader = selectedUnit.combined_name;
        } else {
          const unitRow = await this.db.query(
            `SELECT audit_unit_code, name, section_type_id FROM audit_unit_master WHERE id = $1 LIMIT 1`,
            [Number(auditUnitId)],
          );
          if (unitRow.rows.length > 0) {
            auditUnitHeader = this.auditUnitName(unitRow.rows[0]);
          }
        }
      }
    } else if (auditUnits.length === 1) {
      auditUnitHeader = auditUnits[0].combined_name;
    }

    return {
      filters: {
        financial_year: financialYear,
        audit_unit_id: auditUnitId || 'all_branches',
      },
      generatedAt: new Date().toISOString(),
      header: {
        financialYear: yearObj.year,
        auditUnit: auditUnitHeader,
      },
      year: {
        id: yearObj.id,
        year: yearObj.year,
      },
      rows: auditUnits,
      summary: {},
    };
  }
}
