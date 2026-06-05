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

    if (reportSlug === 'audit-observations-report') {
      return this.getAuditObservationsDefinition();
    }

    if (reportSlug === 'compliance-report') {
      return this.getComplianceDefinition();
    }

    if (reportSlug === 'compliance-summary-report') {
      return this.getComplianceSummaryDefinition();
    }

    if (reportSlug === 'risk-weightage-report') {
      return this.getRiskWeightageDefinition();
    }

    if (reportSlug === 'broader-areawise-scoring-report') {
      return this.getBroaderAreaWiseScoringDefinition();
    }

    if (reportSlug === 'executive-summary-audit-report') {
      return this.getExecutiveSummaryDefinition(false);
    }

    if (reportSlug === 'executive-summary-compliance-report') {
      return this.getExecutiveSummaryDefinition(true);
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

  private async getAuditObservationsDefinition() {
    const lookups = await this.getAuditCompleteLookups();

    return {
      slug: 'audit-observations-report',
      title: 'Audit Observations Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'audit-observations-report',
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

  private async getComplianceDefinition() {
    const lookups = await this.getComplianceLookups();

    return {
      slug: 'compliance-report',
      title: 'Compliance Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'compliance-report',
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

  private async getComplianceSummaryDefinition() {
    const lookups = await this.getComplianceLookups();

    return {
      slug: 'compliance-summary-report',
      title: 'Compliance Summary Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'compliance-summary-report',
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

  private async getRiskWeightageDefinition() {
    const lookups = await this.getComplianceLookups();

    return {
      slug: 'risk-weightage-report',
      title: 'Risk Weightage Report',
      category: 'Audit Reports',
      page: 'A4L',
      fileName: 'risk-weightage-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
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
        { key: 'branch_code', label: 'Branch Code', width: '10%', align: 'center' },
        { key: 'branch_name', label: 'Branch Name', width: '20%' },
        { key: 'category_name', label: 'Category', width: '10%' },
        { key: 'risk_type', label: 'Risk Type', width: '15%' },
        { key: 'total_score', label: 'Total Score', width: '10%', align: 'center' },
        { key: 'no_of_assessment', label: 'Number of Audits Conducted', width: '10%', align: 'center' },
        { key: 'avg_tot_score_per_audit', label: 'Averaged Total Score Per Audit', width: '10%', align: 'right' },
        { key: 'risk_weight', label: 'Risk Weight', width: '5%', align: 'center' },
        { key: 'weighted_score', label: 'Weighted Score', width: '10%', align: 'right' },
        { key: 'percent_to_total', label: '% To Total Weighted Score', width: '10%', align: 'right' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Weighted Score' },
      ],
    };
  }

  private async getBroaderAreaWiseScoringDefinition() {
    const lookups = await this.getAuditCompleteLookups();

    return {
      slug: 'broader-areawise-scoring-report',
      title: 'Broader Areawise Scoring Report',
      category: 'Advanced Reports',
      page: 'A4L',
      fileName: 'broader-areawise-scoring-report',
      brand: {
        logoUrl: '/assets/images/logos/auditpro-logo.png',
        bankName: 'Kredpool Co-Op Bank Ltd., Sangli',
      },
      defaultFilters: {
        selectSearchTypeFilter: '3',
        reportAuditUnit: '',
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
        { key: 'branch_code', label: 'Audit Unit Code', width: '5%', align: 'center' },
        { key: 'branch_name', label: 'Branch', width: '8%' },
        { key: 'risk_type', label: 'Risk Type', width: '6%' },
        { key: 'category_name', label: 'Category', width: '6%' },
        { key: 'broader_area_name', label: 'Broader Area of Audit Non-Compliance', width: '12%' },
        
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
        
        { key: 'qual_tot', label: 'Qualitative Score', width: '4%', align: 'center' },
        { key: 'quan_tot', label: 'Quantitative Score', width: '4%', align: 'center' },
        { key: 'total_qual_quan', label: 'Total Score Before Averaging', width: '5%', align: 'center' },
        { key: 'acc_non_compliant', label: 'No. Of Accounts Non-Compliant', width: '4%', align: 'center' },
        { key: 'no_of_acc_checked', label: 'No Of Accounts Checked', width: '4%', align: 'center' },
        { key: 'avg_quan_score', label: 'Averaged Quantitative Score', width: '4%', align: 'right' },
        { key: 'tot_avg_score', label: 'Total Averaged Score', width: '4%', align: 'right' },
        { key: 'no_of_audit_conduct', label: 'Number of Audits Conducted', width: '4%', align: 'center' },
        { key: 'avg_tot_score_per_audit', label: 'Averaged Total Score Per Audit', width: '4%', align: 'right' },
        { key: 'risk_weight', label: 'Risk Weight', width: '3%', align: 'center' },
        { key: 'weighted_score', label: 'Weighted Score', width: '4%', align: 'right' },
      ],
      summaryCards: [
        { key: 'total', label: 'Total Weighted Score' },
      ],
    };
  }

  async getReportData(reportSlug: string, query: any) {
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

    if (reportSlug === 'broader-areawise-scoring-report') {
      return this.getBroaderAreaWiseScoringReport(query);
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

  async getComplianceLookups() {
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
        WHERE asm.audit_status_id > 4
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

  async getAuditObservationsReport(query: any) {
    return this.getAuditCompleteReport(query);
  }

  async getComplianceReport(query: any) {
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
      'ad.is_compliance = 1',
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

    const questionRows = result.rows.map((row: any) => ({
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

  async getComplianceSummaryReport(query: any) {
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
      'ad.is_compliance = 1',
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

    const questionRows = result.rows.map((row: any) => ({
      sr_no: 0,
      ...row,
      question: row.question || 'Assessment observation',
      answer_given: this.auditAnswerLabel(row),
      audit_comment: row.audit_comment || '-',
      audit_commpliance: row.audit_commpliance || '-',
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

  async getRiskWeightageReport(query: any) {
    const searchType = String(query.selectSearchTypeFilter || '3').trim();
    const auditUnitId = Number(query.reportAuditUnit || 0);
    const assessmentId = Number(query.reportAuditAssesment || 0);
    const startDate = query.startDate ? String(query.startDate).trim() : null;
    const endDate = query.endDate ? String(query.endDate).trim() : null;
    const removePending = Array.isArray(query.rmv_pending_assesments)
      ? query.rmv_pending_assesments.includes('1')
      : String(query.rmv_pending_assesments) === '1';

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if ((searchType === '5' || searchType === '6') && (!startDate || !endDate)) {
      throw new BadRequestException('Date range (Start Date & End Date) is required');
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
        [assessmentId, auditUnitId]
      );
      assessments = result.rows;
    } else {
      // searchType 5 or 6 (date range filter)
      const statusCondition = removePending ? 'AND audit_status_id > 4' : 'AND audit_status_id > 1';
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
        [auditUnitId, startDate, endDate]
      );
      assessments = result.rows;
    }

    if (!assessments.length) {
      throw new BadRequestException('No assessments found for selected filters.');
    }

    const assessmentIds = assessments.map((a) => Number(a.id));
    const firstYearId = Number(assessments[0].year_id);

    // Fetch branch info
    const branchResult = await this.db.query(
      `SELECT name, audit_unit_code FROM audit_unit_master WHERE id = $1 AND deleted_at IS NULL`,
      [auditUnitId]
    );
    const branchInfo = branchResult.rows[0] || { name: 'Unknown', audit_unit_code: '-' };

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
      [firstYearId]
    );
    const riskCategories = riskCategoriesResult.rows;

    // Step 3: Fetch Risk Matrix
    const riskMatrixResult = await this.db.query(
      `SELECT risk_parameter, business_risk_score, control_risk_score FROM risk_matrix WHERE year_id = $1 AND deleted_at IS NULL`,
      [firstYearId]
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
      if (!bRisk || !cRisk || bRisk < 1 || bRisk > 4 || cRisk < 1 || cRisk > 4) {
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
      [assessmentIds]
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
      [assessmentIds]
    );

    const depositsSamplingByAssessment = new Map<number, number>();
    for (const r of depositsSamplingResult.rows) {
      depositsSamplingByAssessment.set(Number(r.assesment_period_id), Number(r.count || 0));
    }
    const advancesSamplingByAssessment = new Map<number, number>();
    for (const r of advancesSamplingResult.rows) {
      advancesSamplingByAssessment.set(Number(r.assesment_period_id), Number(r.count || 0));
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
      [assessmentIds]
    );
    const answers = answersResult.rows;

    const annexureAnswerIds = answers.filter((ans: any) => Number(ans.option_id) === 4).map((ans: any) => Number(ans.id));

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
        [annexureAnswerIds, assessmentIds]
      );
      annexures = annexuresResult.rows;
    }

    // Step 6: Perform Aggregations
    // Structure: assessmentId -> category -> broaderAreaId -> riskCategoryId -> { qualScoreSum, quanScoreSum, totalAnnexRows }
    const assessmentStats = new Map<number, Map<string, Map<number, Map<number, { qualScoreSum: number; quanScoreSum: number; totalAnnexRows: number }>>>>();

    const getStats = (assesId: number, category: string, broaderAreaId: number, riskCatId: number) => {
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
        riskMap.set(riskCatId, { qualScoreSum: 0, quanScoreSum: 0, totalAnnexRows: 0 });
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
    const finalMetrics = new Map<string, Map<number, { tot_avg_score: number; avg_tot_score_per_audit: number; weighted_score: number }>>();

    const categoriesList = ['general', 'deposits', 'advances'];
    for (const catKey of categoriesList) {
      finalMetrics.set(catKey, new Map());
      for (const rc of riskCategories) {
        finalMetrics.get(catKey)!.set(Number(rc.id), { tot_avg_score: 0, avg_tot_score_per_audit: 0, weighted_score: 0 });
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

          const avg_quan_score_all = quanScoreSum_all > 0 ? (quanScoreSum_all / (no_of_acc_checked_all || 1)) : 0;
          const tot_avg_score_all = qualScoreSum_all + avg_quan_score_all;
          const avg_tot_score_per_audit_all = tot_avg_score_all / noOfAssessments;
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

        const percent_to_total = tot_weighted_score > 0 ? ((metrics.weighted_score / tot_weighted_score) * 100) : 0;

        rows.push({
          branch_code: branchInfo.audit_unit_code,
          branch_name: branchInfo.name,
          category_name: catKey.toUpperCase(),
          risk_type: rc.title,
          total_score: this.formatDecimal(metrics.tot_avg_score, 2),
          no_of_assessment: noOfAssessments,
          avg_tot_score_per_audit: this.formatDecimal(metrics.avg_tot_score_per_audit, 2),
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
        assessmentPeriod: searchType === '3' || searchType === '4'
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

  private formatDecimal(val: number, decimals: number): string {
    return Number(val || 0).toFixed(decimals);
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

    if (!auditUnitId) {
      throw new BadRequestException('Audit unit is required');
    }

    if ((searchType === '3' || searchType === '4') && !assessmentId) {
      throw new BadRequestException('Audit assessment is required');
    }

    if ((searchType === '5' || searchType === '6') && (!startDate || !endDate)) {
      throw new BadRequestException('Date range (Start Date & End Date) is required');
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
        [assessmentId, auditUnitId]
      );
      assessments = result.rows;
    } else {
      const statusCondition = removePending ? 'AND audit_status_id > 4' : 'AND audit_status_id > 1';
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
        [auditUnitId, startDate, endDate]
      );
      assessments = result.rows;
    }

    if (!assessments.length) {
      throw new BadRequestException('No assessments found for selected filters.');
    }

    const assessmentIds = assessments.map((a) => Number(a.id));
    const firstYearId = Number(assessments[0].year_id);

    // Fetch branch info
    const branchResult = await this.db.query(
      `SELECT name, audit_unit_code FROM audit_unit_master WHERE id = $1 AND deleted_at IS NULL`,
      [auditUnitId]
    );
    const branchInfo = branchResult.rows[0] || { name: 'Unknown', audit_unit_code: '-' };

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
      [firstYearId]
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
        [assessmentIds]
      ),
      this.db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM dump_advances
        WHERE sampling_filter = 1
          AND assesment_period_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [assessmentIds]
      ),
    ]);

    const totalDepositsSampling = Number(depositsSamplingResult.rows[0]?.count || 0);
    const totalAdvancesSampling = Number(advancesSamplingResult.rows[0]?.count || 0);

    // Fetch Broader Area names
    const broaderAreasResult = await this.db.query(
      `SELECT id, name FROM audit_area_master WHERE deleted_at IS NULL`
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
      [assessmentIds, firstYearId]
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
        dbRow.qual_1_1 + dbRow.qual_1_2 + dbRow.qual_1_3 +
        dbRow.qual_2_1 + dbRow.qual_2_2 + dbRow.qual_2_3 +
        dbRow.qual_3_1 + dbRow.qual_3_2 + dbRow.qual_3_3;

      const quan_tot = 
        dbRow.quan_1_1 + dbRow.quan_1_2 + dbRow.quan_1_3 +
        dbRow.quan_2_1 + dbRow.quan_2_2 + dbRow.quan_2_3 +
        dbRow.quan_3_1 + dbRow.quan_3_2 + dbRow.quan_3_3;

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
      const avg_quan_score = quan_tot > 0 
        ? (quan_tot / (no_of_acc_checked || 1)) 
        : 0;

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
        broader_area_name: broaderAreasMap.get(broaderAreaId) || `Area #${broaderAreaId}`,
        
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
    const catOrder = { GENERAL: 1, DEPOSITS: 2, ADVANCES: 3 };
    rows.sort((a, b) => {
      const catDiff = (catOrder[a.category_name] || 99) - (catOrder[b.category_name] || 99);
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
        assessmentPeriod: searchType === '3' || searchType === '4'
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

      if ((row.__vouching_rows || []).length) {
        rows.push({
          __report_vouching: true,
          __vouching_columns:
            row.__vouching_rows[0].columns || [],
          __vouching_rows:
            row.__vouching_rows,
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
        rc.risk_category,
        aa.audit_commpliance
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
        audit_commpliance: row.audit_commpliance || '-',
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
        audit_commpliance:
          row.audit_commpliance || '-',
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

  private async getExecutiveSummaryDefinition(isCompliance: boolean) {
    const lookups = isCompliance
      ? await this.getComplianceLookups()
      : await this.getAuditCompleteLookups();

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
      page: 'A4L',
      fileName,
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
          label: 'Select Branch',
          type: 'select',
          required: true,
          options: lookups.auditUnits,
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

    const assessmentResult = await this.db.query(assessmentQuery, [assessmentId]);

    if (!assessmentResult.rows.length) {
      throw new NotFoundException('Assessment not found');
    }

    const assessment = assessmentResult.rows[0];

    const [
      branchPositions,
      freshAccounts,
      marchPositions,
      schemes,
    ] = await Promise.all([
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
            scheme_code,
            scheme_name,
            category_id
        FROM (
            SELECT
                'DEPOSITS' AS scheme_type,
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
                sm.scheme_code,
                sm.name,
                sm.category_id
            UNION ALL
            SELECT
                'ADVANCES' AS scheme_type,
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
                sm.scheme_code,
                sm.name,
                sm.category_id
            UNION ALL
            SELECT
                CASE WHEN cm.linked_table_id = 1 THEN 'DEPOSITS' ELSE 'ADVANCES' END AS scheme_type,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE 
                    WHEN cm.linked_table_id = 1 THEN
                        CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END
                    ELSE
                        CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END
                END AS category_id
            FROM executive_summary_branch_position bp
            INNER JOIN scheme_master sm ON sm.scheme_code = REPLACE(bp.type_id, '_NPA', '')
            LEFT JOIN category_master cm ON cm.id = sm.category_id
            WHERE bp.assesment_id = $1 AND bp.deleted_at IS NULL
            UNION ALL
            SELECT
                CASE WHEN cm.linked_table_id = 1 THEN 'DEPOSITS' ELSE 'ADVANCES' END AS scheme_type,
                sm.scheme_code,
                sm.name AS scheme_name,
                CASE 
                    WHEN cm.linked_table_id = 1 THEN
                        CASE WHEN sm.category_id = 63 THEN 1 ELSE 2 END
                    ELSE
                        CASE WHEN sm.category_id = 44 THEN 3 WHEN sm.category_id = 52 THEN 4 WHEN sm.category_id IN (58, 59) THEN 5 WHEN sm.category_id IN (51, 60) THEN 7 ELSE 6 END
                END AS category_id
            FROM executive_summary_fresh_accounts fa
            INNER JOIN scheme_master sm ON sm.scheme_code = REPLACE(fa.type_id, '_NPA', '')
            LEFT JOIN category_master cm ON cm.id = sm.category_id
            WHERE fa.assesment_id = $1 AND fa.deleted_at IS NULL
        ) x
        GROUP BY
            scheme_type,
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

    const dedupedBranchPositions = deduplicate(branchPositions.rows, assessment.year_id);
    const dedupedFreshAccounts = deduplicate(freshAccounts.rows, assessment.year_id);

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
}
