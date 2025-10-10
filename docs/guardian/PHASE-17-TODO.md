# Phase 17: Governance Interface & Alerts - Implementation Tracking

**Branch:** `feat/gdd-phase-17-governance-interface`
**Status:** 🚧 IN PROGRESS (Full Implementation)
**Started:** 2025-10-10 (restarted after Phase 16 merge)

---

## Progress Overview

**Total:** 13 files, ~4,770 lines of code
**Completed:** 0/13 (0%)
**Remaining:** 13 files, ~4,770 lines

---

## 📋 Implementation Plan

### Commit 1: Email Notification System

**Priority:** 1 (Foundation)
**Files:** 1
**Lines:** ~274

#### Backend Components

- ⏳ `scripts/notify-guardian.js` (274 lines)
  - Resend API integration (primary)
  - Postmark API integration (fallback)
  - HTML email template generation
  - Domain owner resolution from `product-guard.yaml`
  - Multi-recipient support
  - Error handling and logging
  - CLI interface: `--case-id=<id>`

**Testing:** Manual test with real case ID from `docs/guardian/cases/`

---

### Commit 2: Frontend Types & API

**Priority:** 1 (Foundation)
**Files:** 2
**Lines:** ~650

#### Frontend Core

- ⏳ `admin-dashboard/src/types/guardian.types.ts` (350 lines)
  - `GuardianCase` interface (case_id, timestamp, actor, domains, files, severity, action, violations, approval fields)
  - `GuardianSeverity` type (CRITICAL | SENSITIVE | SAFE)
  - `GuardianAction` type (BLOCKED | REVIEW | APPROVED | DENIED)
  - `GuardianCaseListParams` (filtering options)
  - API request/response types
  - Validation helpers

- ⏳ `admin-dashboard/src/api/guardianApi.ts` (300 lines)
  - `fetchGuardianCases(params?)` - GET /api/guardian/cases
  - `approveCase(caseId, approver)` - POST /api/guardian/cases/:id/approve
  - `denyCase(caseId, reason, denier)` - POST /api/guardian/cases/:id/deny
  - Error handling and logging
  - Mock data for development (if API not ready)

**Testing:** TypeScript compilation, ESLint passing

---

### Commit 3: React Query Hooks

**Priority:** 1 (Foundation)
**Files:** 1
**Lines:** ~254

#### Data Fetching Layer

- ⏳ `admin-dashboard/src/hooks/useGuardianCases.ts` (254 lines)
  - `useGuardianCases(params?)` - Query hook with auto-refetch (30s stale, 60s refetch)
  - `useApproveCase()` - Mutation hook with optimistic updates
  - `useDenyCase()` - Mutation hook with optimistic updates
  - Query key factory for cache management
  - Error handling and retry logic

**Testing:** Hook renders, mutations update cache correctly

---

### Commit 4: UI Components (Part 1 - Tags & Separator)

**Priority:** 2 (Visual)
**Files:** 3
**Lines:** ~260

#### Visual Components

- ⏳ `admin-dashboard/src/components/dashboard/SeverityTag.tsx` (100 lines)
  - Props: `severity: GuardianSeverity`
  - Styles: CRITICAL (red), SENSITIVE (yellow), SAFE (green)
  - Snake Eater theme: sharp corners, Matrix green accents, dark background

- ⏳ `admin-dashboard/src/components/dashboard/ActionTag.tsx` (100 lines)
  - Props: `action: GuardianAction`
  - Styles: BLOCKED (red), REVIEW (yellow), APPROVED (green), DENIED (gray)
  - Consistent with SeverityTag styling

- ⏳ `admin-dashboard/src/components/dashboard/CornerSeparator.tsx` (60 lines)
  - Snake Eater separator line (ASCII art: └─────┘)
  - Used between case sections
  - Matrix green (#00FF41)

**Testing:** Storybook stories, visual regression tests

---

### Commit 5: UI Components (Part 2 - DiffModal)

**Priority:** 2 (Core functionality)
**Files:** 1
**Lines:** ~300

#### Diff Viewer

- ⏳ `admin-dashboard/src/components/dashboard/DiffModal.tsx` (300 lines)
  - Props: `isOpen, onClose, caseData`
  - Full-screen modal overlay (ESC to close, click outside to close)
  - Git diff display with syntax highlighting
  - Line-by-line view: +additions in green, -deletions in red
  - File tabs if multiple files changed
  - Snake Eater theme: dark background, Matrix green highlights

**Testing:** Open/close modal, keyboard navigation, diff rendering

---

### Commit 6: UI Components (Part 3 - CaseCard)

**Priority:** 2 (Core functionality)
**Files:** 1
**Lines:** ~450

#### Case Display & Actions

- ⏳ `admin-dashboard/src/components/dashboard/CaseCard.tsx` (450 lines)
  - Props: `caseData, onApprove, onDeny, onViewDiff`
  - Layout: Case header (ID, timestamp, actor), severity/action tags, domain list, file count
  - Actions: "View Diff" button, "Approve" button (green), "Deny" button (red)
  - Approval form: Input for approver name (required)
  - Denial form: Textarea for reason (required)
  - Loading states, error handling
  - Snake Eater theme: card borders, button styles

**Testing:** Approve/deny actions, form validation, loading states

---

### Commit 7: UI Components (Part 4 - GovernanceReports)

**Priority:** 2 (Integration)
**Files:** 1
**Lines:** ~450

#### Main Dashboard

- ⏳ `admin-dashboard/src/components/dashboard/GovernanceReports.tsx` (450 lines)
  - Layout: Tabs (All | CRITICAL | SENSITIVE | SAFE | APPROVED | DENIED)
  - Filtering: Severity, status, domain (dropdown or search)
  - Case list: Sorted by timestamp DESC
  - Empty states: "No cases found" with helpful message
  - Loading states: Skeleton loaders
  - Error states: Retry button
  - Uses `useGuardianCases()` hook for data
  - Renders `CaseCard` components
  - Opens `DiffModal` on "View Diff" click
  - Snake Eater theme: tab styles, dark background

**Testing:** Tab switching, filtering, case actions, empty/loading/error states

---

### Commit 8: Unit Tests

**Priority:** 3 (Quality)
**Files:** 1
**Lines:** ~400

#### Email Notification Tests

- ⏳ `tests/unit/scripts/notify-guardian.test.js` (400 lines)
  - **Test Suite 1: Configuration Loading**
    - Should load product-guard.yaml successfully
    - Should handle missing config file
    - Should parse domain owners correctly
  - **Test Suite 2: Email Template Generation**
    - Should generate HTML email for CRITICAL case
    - Should generate HTML email for SENSITIVE case
    - Should include case details (ID, timestamp, domains, files)
    - Should include approval link
  - **Test Suite 3: Owner Resolution**
    - Should resolve single owner
    - Should resolve multiple owners
    - Should handle domain without owner
  - **Test Suite 4: Resend API**
    - Should send email via Resend (mocked)
    - Should handle Resend API errors
  - **Test Suite 5: Postmark Fallback**
    - Should fallback to Postmark if Resend fails
    - Should handle Postmark API errors
  - **Test Suite 6: CLI Interface**
    - Should accept --case-id argument
    - Should exit with error if case not found
    - Should exit with success if email sent

**Coverage Target:** 90%+

---

### Commit 9: Integration Tests

**Priority:** 3 (Quality)
**Files:** 1
**Lines:** ~400

#### E2E Governance Workflow Tests

- ⏳ `tests/integration/guardian-governance-workflow.test.js` (400 lines)
  - **Test Suite 1: Detection → Notification**
    - Should detect CRITICAL change
    - Should create case file
    - Should send email notification
    - Should log to audit trail
  - **Test Suite 2: Approval Workflow**
    - Should approve case via API
    - Should update case JSON with approval data
    - Should update audit log with approval
    - Should mark action as APPROVED
  - **Test Suite 3: Denial Workflow**
    - Should deny case via API
    - Should update case JSON with denial data
    - Should update audit log with denial
    - Should mark action as DENIED
  - **Test Suite 4: Frontend Integration**
    - Should fetch cases and display in UI
    - Should filter cases by severity
    - Should approve case from UI
    - Should deny case from UI
    - Should refresh after action
  - **Test Suite 5: Error Handling**
    - Should handle missing case file
    - Should handle API errors gracefully
    - Should show error message in UI

**Coverage Target:** 85%+

---

### Commit 10: Documentation

**Priority:** 4 (Polish)
**Files:** 3
**Lines:** ~1,630

#### User Documentation

- ⏳ `docs/guardian/USER-GUIDE.md` (600 lines)
  - Phase 17 overview
  - Email notification setup
  - Admin panel walkthrough
  - Approval/denial workflow
  - Troubleshooting common issues
  - FAQ

- ⏳ `docs/plan/gdd-phase-17-governance.md` (500 lines)
  - Implementation plan (this file, expanded)
  - Architecture diagrams
  - API specifications
  - Component hierarchy
  - Testing strategy

- ⏳ `docs/GDD-PHASE-17-COMPLETION.md` (530 lines)
  - Summary of Phase 17 implementation
  - Files added/modified with line counts
  - Testing results (unit + integration)
  - Performance metrics
  - Success criteria verification
  - Screenshots of UI components

- ⏳ `CLAUDE.md` - Update "GDD Commands" section
  - Add Phase 17 commands
  - Add governance workflow description
  - Add email notification setup

- ⏳ `spec.md` - Update "Guardian Agent" section
  - Add Phase 17 governance layer
  - Add admin panel description
  - Add approval workflow diagram

---

## Testing Checklist

### Unit Tests

- [ ] notify-guardian.js (29 tests)
  - [ ] Configuration loading (3 tests)
  - [ ] Email template generation (4 tests)
  - [ ] Owner resolution (3 tests)
  - [ ] Resend API (2 tests)
  - [ ] Postmark fallback (2 tests)
  - [ ] CLI interface (3 tests)

### Integration Tests

- [ ] guardian-governance-workflow.test.js (17 tests)
  - [ ] Detection → Notification (4 tests)
  - [ ] Approval workflow (3 tests)
  - [ ] Denial workflow (3 tests)
  - [ ] Frontend integration (5 tests)
  - [ ] Error handling (2 tests)

### Manual Testing

- [ ] Email notifications sent successfully (Resend or Postmark)
- [ ] Admin panel loads without errors
- [ ] Case list displays correctly
- [ ] Filtering works (severity, status, domain)
- [ ] DiffModal opens and displays git diff
- [ ] Approve button works, updates audit log
- [ ] Deny button works, updates audit log
- [ ] Case JSON files updated correctly
- [ ] Snake Eater theme consistent across UI

---

## Success Criteria

- [ ] All 13 files implemented (~4,770 lines)
- [ ] All 46 tests passing (29 unit + 17 integration)
- [ ] Code coverage ≥ 85% for new files
- [ ] Email notifications working (tested with real case)
- [ ] Admin panel functional (tested manually)
- [ ] Approve/deny workflow complete (tested E2E)
- [ ] Documentation complete (README, USER-GUIDE, COMPLETION)
- [ ] CodeRabbit review with 0 comments (CRITICAL quality standard)
- [ ] PR approved and merged to main

---

## Notes

- **Incremental Commits:** Each commit should be self-contained and deployable
- **Quality Standards:** Follow "Calidad > Velocidad" - 0 CodeRabbit comments before merge
- **Testing:** Run tests after each commit, ensure all pass before pushing
- **Documentation:** Update docs alongside code, not as afterthought
- **Snake Eater Theme:** Maintain dark cyberpunk aesthetic, NO emojis in UI

---

*Last Updated: 2025-10-10*
*Status: Ready to implement*
