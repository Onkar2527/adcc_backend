/**
 * internal-audit.constants.ts
 * Shared constants used across InternalAuditService, ReviewerService, ComplianceService.
 */

export const AUDITOR_STATUS_IDS = [1, 3];

export const REMARK_TYPES: Record<number, string> = {
  1: 'Remark for Auditor',
  2: 'Remark for Reviewer',
  3: 'Remark for Compliance',
  4: 'Remark for Reviewer & Compliance',
  5: 'Remark for Auditor & Compliance',
  6: 'Remark for Auditor & Reviewer',
};

export const AUDITOR_REMARK_RECIPIENT_IDS = [2, 3, 4];
export const AUDITOR_INCOMING_REMARK_IDS = [1, 5, 6];

export const EVIDENCE_MAX_SIZE = 5 * 1024 * 1024;

export const EVIDENCE_FILE_TYPES: Record<string, { id: number; extension: string }> = {
  'image/jpeg': { id: 1, extension: '.jpg' },
  'image/jpg': { id: 2, extension: '.jpg' },
  'image/png': { id: 3, extension: '.png' },
  'application/pdf': { id: 4, extension: '.pdf' },
};

export const STATUS_LABELS: Record<number, string> = {
  1: 'AUDIT (PENDING / ACTIVE)',
  2: 'REVIEW (PENDING / ACTIVE)',
  3: 'RE AUDIT (PENDING / ACTIVE)',
  4: 'COMPLIANCE (PENDING / ACTIVE)',
  5: 'REVIEW (PENDING / ACTIVE)',
  6: 'RE COMPLIANCE (PENDING / ACTIVE)',
  7: 'ASSESMENT COMPLETED',
};

export const LIVE_COMPLIANCE_STATUS = {
  AUDITOR_PENDING: 10,
  REVIEWER_PENDING: 11,
  MANAGER_REWORK_PENDING: 12,
  AUDITOR_SETTLED: 13,
  REVIEWER_SETTLED: 14,
  MAKER_PENDING: 15,
  CHECKER_PENDING: 16,
} as const;

export const LIVE_COMPLIANCE_VISIBLE_STATUSES = [
  0, 2, 3, 5, 8, 9,
  LIVE_COMPLIANCE_STATUS.AUDITOR_PENDING,
  LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
  LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING,
  LIVE_COMPLIANCE_STATUS.AUDITOR_SETTLED,
  LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED,
  LIVE_COMPLIANCE_STATUS.MAKER_PENDING,
  LIVE_COMPLIANCE_STATUS.CHECKER_PENDING,
];

export const LIVE_COMPLIANCE_MANAGER_PENDING_STATUSES = [
  3,
  7,
  LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING,
  LIVE_COMPLIANCE_STATUS.MAKER_PENDING,
  LIVE_COMPLIANCE_STATUS.CHECKER_PENDING,
];

export const LIVE_COMPLIANCE_REVIEWER_PENDING_STATUSES = [
  3,
  LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
];

export const LIVE_COMPLIANCE_REVIEWER_QUEUE_STATUSES = [
  3, 4, 5, 8, 9,
  LIVE_COMPLIANCE_STATUS.AUDITOR_PENDING,
  LIVE_COMPLIANCE_STATUS.REVIEWER_PENDING,
  LIVE_COMPLIANCE_STATUS.MANAGER_REWORK_PENDING,
  LIVE_COMPLIANCE_STATUS.REVIEWER_SETTLED,
];
