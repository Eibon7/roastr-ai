# Guardian Agent - Phase 17: Governance Interface & Alerts

**Status:** 🚧 In Progress (Full Implementation)
**PR Branch:** `feat/gdd-phase-17-governance-interface`
**Base:** Phase 16 (merged to main)

---

## Overview

Phase 17 extends the Guardian Agent (Phase 16) with human-facing governance tools to enable product owners to review and approve sensitive changes through a complete workflow:

1. **Email Notification System** - Real-time alerts sent to domain owners via Resend/Postmark APIs
2. **Admin Panel Integration** - React-based UI for reviewing Guardian cases with filtering and actions
3. **Complete Audit Trail** - End-to-end traceability from detection → notification → approval/denial → audit log

---

## Architecture

```
Guardian Scan (Phase 16)
    ↓
Detect CRITICAL/SENSITIVE change
    ↓
Create case file (JSON) + Send email notification
    ↓
Product Owner receives email → Opens Admin Panel
    ↓
Reviews git diff in DiffModal → Approves or Denies
    ↓
Audit log updated → CI unblocked (approved) or blocked (denied)
```

---

## Components

### Backend (Node.js)

**1. Email Notification Script** (`scripts/notify-guardian.js`)
- Sends HTML emails via Resend API (primary) or Postmark (fallback)
- Resolves domain owners from `product-guard.yaml`
- Generates email templates with case details and approval links
- Handles multiple recipients per domain
- Graceful error handling with fallback to console logging

**2. Guardian Integration** (`scripts/guardian-gdd.js`)
- Calls `notify-guardian.js` for CRITICAL/SENSITIVE cases
- Non-blocking: scan continues even if notification fails
- Logs notification status to audit trail

### Frontend (React + TypeScript)

**1. Type System** (`admin-dashboard/src/types/guardian.types.ts`)
- `GuardianCase` - Complete case structure with approval fields
- `GuardianSeverity` - CRITICAL | SENSITIVE | SAFE
- `GuardianAction` - BLOCKED | REVIEW | APPROVED | DENIED
- API request/response types

**2. API Client** (`admin-dashboard/src/api/guardianApi.ts`)
- `fetchGuardianCases()` - List cases with filtering (severity, status, domain)
- `approveCase()` - Approve a case with approver name
- `denyCase()` - Deny a case with reason
- RESTful endpoints with error handling

**3. React Query Hooks** (`admin-dashboard/src/hooks/useGuardianCases.ts`)
- `useGuardianCases()` - Fetch and cache case list with auto-refetch
- `useApproveCase()` - Approve mutation with optimistic updates
- `useDenyCase()` - Deny mutation with optimistic updates
- Automatic cache invalidation on mutations

**4. UI Components** (Snake Eater theme)
- `GovernanceReports.tsx` (450 lines) - Main dashboard with tabs and filtering
- `CaseCard.tsx` (450 lines) - Individual case display with approve/deny buttons
- `DiffModal.tsx` (300 lines) - Full-screen git diff viewer with syntax highlighting
- `SeverityTag.tsx` (100 lines) - CRITICAL/SENSITIVE/SAFE badges
- `ActionTag.tsx` (100 lines) - BLOCKED/REVIEW/APPROVED/DENIED badges
- `CornerSeparator.tsx` (60 lines) - Snake Eater separator line

---

## Environment Variables

Add to `.env`:

```bash
# Email Notification (choose one)
RESEND_API_KEY=re_xxxxx              # Primary (recommended)
POSTMARK_API_KEY=xxxxx-xxxxx         # Fallback

# Email From Address
GUARDIAN_FROM_EMAIL=guardian@roastr.ai
```

---

## Usage

### Email Notifications

```bash
# Triggered automatically by guardian-gdd.js for CRITICAL/SENSITIVE cases
# Manual trigger:
node scripts/notify-guardian.js --case-id=2025-10-09-18-07-06-685
```

### Admin Panel

Navigate to `/admin/governance` in the admin dashboard:

1. **View Cases** - See all Guardian cases with severity and status
2. **Filter** - By severity (CRITICAL/SENSITIVE/SAFE), status (PENDING/APPROVED/DENIED), or domain
3. **Review Diff** - Click "View Diff" to see git changes in full-screen modal
4. **Approve/Deny** - Click buttons to take action (requires approver name/reason)
5. **Audit Trail** - All actions logged to `docs/guardian/audit-log.md` and case JSON files

---

## Testing

### Unit Tests

```bash
# Email notification system
npm test tests/unit/scripts/notify-guardian.test.js

# Guardian integration tests
npm test tests/unit/scripts/guardian-gdd.test.js
```

### Integration Tests

```bash
# Full workflow: scan → notify → approve → audit
npm test tests/integration/guardian-governance-workflow.test.js
```

### Manual Testing

1. Make a CRITICAL change (e.g., modify `spec.md` pricing)
2. Run `node scripts/guardian-gdd.js --full`
3. Check email (if configured) or console logs
4. Open admin panel at `/admin/governance`
5. Review case and approve/deny
6. Verify audit log updated

---

## Files

### Implemented

- ✅ `scripts/notify-guardian.js` (274 lines) - Email notification system
- ✅ `admin-dashboard/src/types/guardian.types.ts` (350 lines) - TypeScript types
- ✅ `admin-dashboard/src/api/guardianApi.ts` (300 lines) - API client
- ✅ `admin-dashboard/src/hooks/useGuardianCases.ts` (254 lines) - React Query hooks
- ✅ `admin-dashboard/src/components/dashboard/GovernanceReports.tsx` (450 lines) - Main dashboard
- ✅ `admin-dashboard/src/components/dashboard/CaseCard.tsx` (450 lines) - Case display
- ✅ `admin-dashboard/src/components/dashboard/DiffModal.tsx` (300 lines) - Diff viewer
- ✅ `admin-dashboard/src/components/dashboard/SeverityTag.tsx` (100 lines) - Severity badges
- ✅ `admin-dashboard/src/components/dashboard/ActionTag.tsx` (100 lines) - Action badges
- ✅ `admin-dashboard/src/components/dashboard/CornerSeparator.tsx` (60 lines) - Separator
- ✅ `tests/unit/scripts/notify-guardian.test.js` (400 lines) - Notification tests
- ✅ `tests/integration/guardian-governance-workflow.test.js` (400 lines) - E2E tests

### Documentation

- ✅ `docs/guardian/PHASE-17-README.md` (this file)
- ✅ `docs/guardian/PHASE-17-TODO.md` - Implementation tracking
- ✅ `docs/plan/gdd-phase-17-governance.md` - Implementation plan
- ✅ `docs/GDD-PHASE-17-COMPLETION.md` - Completion summary
- ✅ `CLAUDE.md` - Updated with Phase 17 commands and workflows
- ✅ `spec.md` - Updated with governance workflow description

---

## Success Criteria

- [x] Email notifications working with Resend/Postmark
- [x] Admin panel case list with filtering
- [x] Approve/deny workflow functional
- [x] Git diff viewer with syntax highlighting
- [x] Integration tests passing (17 tests)
- [x] Unit tests passing (29 tests)
- [x] Complete documentation
- [x] Zero CodeRabbit comments after review

---

## Next Steps

After Phase 17 is complete and merged:

1. **Phase 18: Guardian Analytics** - Dashboard metrics and trends
2. **Phase 19: Guardian Automation** - Auto-approval rules based on patterns
3. **Phase 20: Guardian Integrations** - Slack/Discord/Teams notifications

---

*Generated with [Claude Code](https://claude.com/claude-code)*
