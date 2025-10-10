/**
 * Guardian Agent API Client
 * Phase 17: Governance Interface & Alerts
 */

import {
  GuardianCase,
  GuardianCaseListParams,
  GuardianCaseListResponse,
  ApproveGuardianCaseRequest,
  ApproveGuardianCaseResponse,
  DenyGuardianCaseRequest,
  DenyGuardianCaseResponse
} from '../types/guardian.types';

// ============================================================
// Configuration
// ============================================================

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
const GUARDIAN_API_PREFIX = '/api/guardian';

// Enable mock mode for development if API not ready
const MOCK_MODE = process.env.REACT_APP_GUARDIAN_MOCK === 'true';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Build query string from params
 */
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Handle API errors
 */
function handleApiError(error: any, operation: string): never {
  console.error(`Guardian API Error (${operation}):`, error);

  if (error.response) {
    // Server responded with error
    throw new Error(error.response.data?.message || `Server error: ${error.response.status}`);
  } else if (error.request) {
    // Request made but no response
    throw new Error('No response from server. Check network connection.');
  } else {
    // Error setting up request
    throw new Error(error.message || 'Unknown error occurred');
  }
}

// ============================================================
// Mock Data (for development)
// ============================================================

const MOCK_CASES: GuardianCase[] = [
  {
    case_id: '2025-10-09-18-07-06-685',
    timestamp: '2025-10-09T18:07:06.000Z',
    actor: 'emiliopostigo',
    domains: ['pricing', 'billing'],
    files_changed: ['spec.md', 'CLAUDE.md'],
    severity: 'CRITICAL',
    action: 'BLOCKED',
    violations: { critical: 2, sensitive: 0, safe: 0 },
    details: [
      {
        file: 'spec.md',
        domains: ['pricing'],
        severity: 'CRITICAL',
        lines_added: 5,
        lines_removed: 2
      },
      {
        file: 'CLAUDE.md',
        domains: ['billing'],
        severity: 'CRITICAL',
        lines_added: 3,
        lines_removed: 1
      }
    ],
    approval_required: true,
    approved_by: null,
    notes: 'Requires Product Owner approval'
  },
  {
    case_id: '2025-10-09-17-11-10-814',
    timestamp: '2025-10-09T17:11:10.000Z',
    actor: 'claude',
    domains: ['roast-generation'],
    files_changed: ['src/services/roastGeneratorEnhanced.js'],
    severity: 'SENSITIVE',
    action: 'REVIEW',
    violations: { critical: 0, sensitive: 1, safe: 0 },
    details: [
      {
        file: 'src/services/roastGeneratorEnhanced.js',
        domains: ['roast-generation'],
        severity: 'SENSITIVE',
        lines_added: 15,
        lines_removed: 8
      }
    ],
    approval_required: true,
    approved_by: null,
    notes: 'Requires Tech Lead review'
  },
  {
    case_id: '2025-10-09-16-37-00-742',
    timestamp: '2025-10-09T16:37:00.000Z',
    actor: 'emiliopostigo',
    domains: ['pricing', 'billing'],
    files_changed: ['spec.md'],
    severity: 'CRITICAL',
    action: 'APPROVED',
    violations: { critical: 1, sensitive: 0, safe: 0 },
    details: [
      {
        file: 'spec.md',
        domains: ['pricing', 'billing'],
        severity: 'CRITICAL',
        lines_added: 2,
        lines_removed: 2
      }
    ],
    approval_required: true,
    approved_by: 'Emilio Postigo',
    approved_at: '2025-10-09T16:45:00.000Z',
    notes: 'Requires Product Owner approval'
  }
];

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch Guardian cases with optional filtering
 */
export async function fetchGuardianCases(
  params?: GuardianCaseListParams
): Promise<GuardianCaseListResponse> {
  if (MOCK_MODE) {
    // Return mock data for development
    console.log('[Guardian API] MOCK MODE - Returning mock cases');

    // Apply filters
    let filteredCases = [...MOCK_CASES];

    if (params?.severity && params.severity !== 'ALL') {
      filteredCases = filteredCases.filter(c => c.severity === params.severity);
    }

    if (params?.status && params.status !== 'ALL') {
      if (params.status === 'PENDING') {
        filteredCases = filteredCases.filter(c => !c.approved_by && !c.denied_by);
      } else if (params.status === 'APPROVED') {
        filteredCases = filteredCases.filter(c => !!c.approved_by);
      } else if (params.status === 'DENIED') {
        filteredCases = filteredCases.filter(c => !!c.denied_by);
      }
    }

    if (params?.domain) {
      filteredCases = filteredCases.filter(c => c.domains.includes(params.domain!));
    }

    // Apply pagination
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;
    const paginatedCases = filteredCases.slice(offset, offset + limit);

    return {
      cases: paginatedCases,
      total: filteredCases.length,
      limit,
      offset,
      filters: {
        severity: params?.severity,
        status: params?.status,
        domain: params?.domain
      }
    };
  }

  try {
    const queryString = buildQueryString(params || {});
    const url = `${API_BASE_URL}${GUARDIAN_API_PREFIX}/cases${queryString}`;

    console.log('[Guardian API] Fetching cases:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'fetchGuardianCases');
  }
}

/**
 * Approve a Guardian case
 */
export async function approveCase(
  caseId: string,
  approver: string
): Promise<ApproveGuardianCaseResponse> {
  if (MOCK_MODE) {
    // Mock approval
    console.log('[Guardian API] MOCK MODE - Approving case:', caseId);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      case_id: caseId,
      approved_by: approver,
      approved_at: new Date().toISOString(),
      message: 'Case approved successfully'
    };
  }

  try {
    const url = `${API_BASE_URL}${GUARDIAN_API_PREFIX}/cases/${caseId}/approve`;

    console.log('[Guardian API] Approving case:', caseId);

    const body: ApproveGuardianCaseRequest = { approver };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'approveCase');
  }
}

/**
 * Deny a Guardian case
 */
export async function denyCase(
  caseId: string,
  denier: string,
  reason: string
): Promise<DenyGuardianCaseResponse> {
  if (MOCK_MODE) {
    // Mock denial
    console.log('[Guardian API] MOCK MODE - Denying case:', caseId);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      case_id: caseId,
      denied_by: denier,
      denied_at: new Date().toISOString(),
      denial_reason: reason,
      message: 'Case denied successfully'
    };
  }

  try {
    const url = `${API_BASE_URL}${GUARDIAN_API_PREFIX}/cases/${caseId}/deny`;

    console.log('[Guardian API] Denying case:', caseId);

    const body: DenyGuardianCaseRequest = { denier, reason };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'denyCase');
  }
}
