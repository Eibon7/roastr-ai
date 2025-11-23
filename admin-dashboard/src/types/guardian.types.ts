/**
 * Guardian Agent - TypeScript Type Definitions
 * Phase 17: Governance Interface & Alerts
 */

// ============================================================
// Core Types
// ============================================================

/**
 * Guardian severity levels
 */
export type GuardianSeverity = 'CRITICAL' | 'SENSITIVE' | 'SAFE';

/**
 * Guardian action states
 */
export type GuardianAction = 'BLOCKED' | 'REVIEW' | 'APPROVED' | 'DENIED';

/**
 * Guardian case status (derived from action + approval fields)
 */
export type GuardianStatus = 'PENDING' | 'APPROVED' | 'DENIED';

// ============================================================
// Case Data Structures
// ============================================================

/**
 * Individual violation detail
 */
export interface GuardianViolationDetail {
  file: string;
  domains: string[];
  severity: GuardianSeverity;
  lines_added: number;
  lines_removed: number;
}

/**
 * Violation counts by severity
 */
export interface GuardianViolationCounts {
  critical: number;
  sensitive: number;
  safe: number;
}

/**
 * Complete Guardian case data
 */
export interface GuardianCase {
  case_id: string;
  timestamp: string;
  actor: string;
  domains: string[];
  files_changed: string[];
  severity: GuardianSeverity;
  action: GuardianAction;
  violations: GuardianViolationCounts;
  details: GuardianViolationDetail[];
  approval_required: boolean;
  approved_by: string | null;
  approved_at?: string | null;
  denied_by?: string | null;
  denied_at?: string | null;
  denial_reason?: string | null;
  notes: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * Parameters for fetching Guardian cases
 */
export interface GuardianCaseListParams {
  severity?: GuardianSeverity | 'ALL';
  status?: GuardianStatus | 'ALL';
  domain?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response from case list API
 */
export interface GuardianCaseListResponse {
  cases: GuardianCase[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    severity?: GuardianSeverity | 'ALL';
    status?: GuardianStatus | 'ALL';
    domain?: string;
  };
}

/**
 * Approve case request body
 */
export interface ApproveGuardianCaseRequest {
  approver: string;
}

/**
 * Approve case response
 */
export interface ApproveGuardianCaseResponse {
  success: boolean;
  case_id: string;
  approved_by: string;
  approved_at: string;
  message: string;
}

/**
 * Deny case request body
 */
export interface DenyGuardianCaseRequest {
  denier: string;
  reason: string;
}

/**
 * Deny case response
 */
export interface DenyGuardianCaseResponse {
  success: boolean;
  case_id: string;
  denied_by: string;
  denied_at: string;
  denial_reason: string;
  message: string;
}

// ============================================================
// UI Component Props
// ============================================================

/**
 * Props for SeverityTag component
 */
export interface SeverityTagProps {
  severity: GuardianSeverity;
  className?: string;
}

/**
 * Props for ActionTag component
 */
export interface ActionTagProps {
  action: GuardianAction;
  className?: string;
}

/**
 * Props for CaseCard component
 */
export interface CaseCardProps {
  caseData: GuardianCase;
  onApprove: (caseId: string, approver: string) => Promise<void>;
  onDeny: (caseId: string, denier: string, reason: string) => Promise<void>;
  onViewDiff: (caseId: string) => void;
  isLoading?: boolean;
}

/**
 * Props for DiffModal component
 */
export interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: GuardianCase | null;
}

/**
 * Props for GovernanceReports component
 */
export interface GovernanceReportsProps {
  // No required props - standalone page component
}

// ============================================================
// Utility Types
// ============================================================

/**
 * Guardian tab types (for filtering)
 */
export type GuardianTab = 'ALL' | 'CRITICAL' | 'SENSITIVE' | 'SAFE' | 'APPROVED' | 'DENIED';

/**
 * Guardian color mappings
 */
export interface GuardianColors {
  critical: string;
  sensitive: string;
  safe: string;
  blocked: string;
  review: string;
  approved: string;
  denied: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * Guardian color palette (Snake Eater theme)
 */
export const GUARDIAN_COLORS: GuardianColors = {
  critical: '#FF0000', // Red
  sensitive: '#FFA500', // Orange
  safe: '#00FF41', // Matrix green
  blocked: '#FF0000', // Red
  review: '#FFA500', // Orange
  approved: '#00FF41', // Matrix green
  denied: '#888888' // Gray
};

/**
 * Severity display names
 */
export const SEVERITY_LABELS: Record<GuardianSeverity, string> = {
  CRITICAL: 'Critical',
  SENSITIVE: 'Sensitive',
  SAFE: 'Safe'
};

/**
 * Action display names
 */
export const ACTION_LABELS: Record<GuardianAction, string> = {
  BLOCKED: 'Blocked',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  DENIED: 'Denied'
};

/**
 * Status display names
 */
export const STATUS_LABELS: Record<GuardianStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DENIED: 'Denied'
};

// ============================================================
// Type Guards
// ============================================================

/**
 * Check if severity is CRITICAL
 */
export function isCritical(severity: GuardianSeverity): boolean {
  return severity === 'CRITICAL';
}

/**
 * Check if severity is SENSITIVE
 */
export function isSensitive(severity: GuardianSeverity): boolean {
  return severity === 'SENSITIVE';
}

/**
 * Check if severity is SAFE
 */
export function isSafe(severity: GuardianSeverity): boolean {
  return severity === 'SAFE';
}

/**
 * Check if case is pending approval
 */
export function isPending(caseData: GuardianCase): boolean {
  return caseData.approval_required && !caseData.approved_by && !caseData.denied_by;
}

/**
 * Check if case is approved
 */
export function isApproved(caseData: GuardianCase): boolean {
  return !!caseData.approved_by;
}

/**
 * Check if case is denied
 */
export function isDenied(caseData: GuardianCase): boolean {
  return !!caseData.denied_by;
}

/**
 * Get case status from case data
 */
export function getCaseStatus(caseData: GuardianCase): GuardianStatus {
  if (isApproved(caseData)) return 'APPROVED';
  if (isDenied(caseData)) return 'DENIED';
  return 'PENDING';
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validate approver name
 */
export function validateApprover(approver: string): { valid: boolean; error?: string } {
  if (!approver || approver.trim().length === 0) {
    return { valid: false, error: 'Approver name is required' };
  }
  if (approver.trim().length < 2) {
    return { valid: false, error: 'Approver name must be at least 2 characters' };
  }
  if (approver.trim().length > 100) {
    return { valid: false, error: 'Approver name must be less than 100 characters' };
  }
  return { valid: true };
}

/**
 * Validate denial reason
 */
export function validateDenialReason(reason: string): { valid: boolean; error?: string } {
  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: 'Denial reason is required' };
  }
  if (reason.trim().length < 10) {
    return { valid: false, error: 'Denial reason must be at least 10 characters' };
  }
  if (reason.trim().length > 500) {
    return { valid: false, error: 'Denial reason must be less than 500 characters' };
  }
  return { valid: true };
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return timestamp;
  }
}

/**
 * Format case ID for display (truncate if needed)
 */
export function formatCaseId(caseId: string, maxLength: number = 20): string {
  if (caseId.length <= maxLength) return caseId;
  return `${caseId.substring(0, maxLength - 3)}...`;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: GuardianSeverity): string {
  return (
    GUARDIAN_COLORS[severity.toLowerCase() as keyof typeof GUARDIAN_COLORS] || GUARDIAN_COLORS.safe
  );
}

/**
 * Get action color
 */
export function getActionColor(action: GuardianAction): string {
  return (
    GUARDIAN_COLORS[action.toLowerCase() as keyof typeof GUARDIAN_COLORS] || GUARDIAN_COLORS.review
  );
}
