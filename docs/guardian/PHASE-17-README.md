# Guardian Agent - Phase 17: Governance Interface & Alerts

**Status:** 🚧 In Progress (Incremental Implementation)
**PR Branch:** `feat/gdd-phase-17-governance-interface`
**Base:** Phase 16 (`feat/gdd-phase-16-guardian`)

---

## Overview

Phase 17 extends Guardian Agent (Phase 16) with human-facing governance tools:

1. **Email Notification System** - Real-time alerts to domain owners
2. **Admin Panel Integration** - UI for reviewing and approving cases
3. **Complete Audit Trail** - End-to-end traceability

---

## What's Included in This PR (So Far)

### ✅ Commit 1: Foundation & Planning

**Files Added:**
- `docs/guardian/PHASE-17-TODO.md` - Implementation tracking (all pending work documented)
- `docs/guardian/PHASE-17-README.md` - This file (Phase 17 overview)

**Files Modified:**
- `scripts/guardian-gdd.js` - Added `sendNotification()` method placeholder

**Purpose:**
- ✅ Establish Phase 17 branch structure
- ✅ Document complete implementation plan
- ✅ Track all 16 files to be implemented (~4,770 lines)
- ✅ Set up incremental commit workflow

**Next Commit:** Email notification system (`notify-guardian.js`)

---

## Quick Start

### 1. Test Email Notification (Mock Mode)

```bash
# Create a test case file first
mkdir -p docs/guardian/cases

cat > docs/guardian/cases/test-case.json << 'EOF'
{
  "case_id": "test-case",
  "timestamp": "2025-10-09T12:00:00Z",
  "actor": "testuser",
  "domains": ["pricing"],
  "files_changed": ["src/services/costControl.js"],
  "severity": "CRITICAL",
  "action": "BLOCKED",
  "violations": {
    "critical": 1,
    "sensitive": 0,
    "safe": 0
  },
  "details": [
    {
      "file": "src/services/costControl.js",
      "domains": ["pricing"],
      "severity": "CRITICAL",
      "lines_added": 10,
      "lines_removed": 5
    }
  ],
  "approval_required": true,
  "approved_by": null,
  "notes": "Test case for email notification"
}
EOF

# Test notification in mock mode (no actual email sent)
MOCK_EMAIL=true node scripts/notify-guardian.js --case-id=test-case
```

**Expected output:**
```
✅ Configuration loaded successfully
✅ Case file loaded: test-case
📧 Domain "pricing" → Owner "Product Owner" → Email "admin@roastr.ai"
📧 Sending notification to: admin@roastr.ai

🔧 MOCK mode
To: [ 'admin@roastr.ai' ]
Subject: [GUARDIAN] CRITICAL: pricing changes require approval

✅ Notification sent successfully for case: test-case
```

### 2. Test with Guardian Scan

```bash
# Make a change to a protected file
echo "// Test change" >> src/services/costControl.js
git add src/services/costControl.js

# Run Guardian scan (will auto-send notification if CRITICAL/SENSITIVE)
MOCK_EMAIL=true node scripts/guardian-gdd.js --full
```

### 3. Environment Variables

Add to `.env` for production:

```bash
# Email Provider (choose one)
RESEND_API_KEY=re_xxxxx              # Recommended
# OR
POSTMARK_API_KEY=xxxxx

# Notification Settings
ADMIN_EMAIL=admin@roastr.ai          # Fallback recipient
ADMIN_PANEL_URL=http://localhost:3001/dashboard

# Owner Email Overrides (optional)
PRODUCT_OWNER_EMAIL=owner@roastr.ai
TECH_LEAD_EMAIL=lead@roastr.ai
BACKEND_DEV_EMAIL=dev@roastr.ai

# Testing/Dev Modes
MOCK_EMAIL=false                      # Set to 'true' to mock emails
DEV_MODE=false                        # Set to 'true' to send all to ADMIN_EMAIL
```

---

## What's Coming Next

See `docs/guardian/PHASE-17-TODO.md` for complete tracking.

**Priority 1: Frontend Core** (Next commit)
- TypeScript type system (`guardian.types.ts`)
- API client (`guardianApi.ts`)
- React Query hooks (`useGuardianCases.ts`)

**Priority 2: UI Components**
- GovernanceReports dashboard
- CaseCard component
- DiffModal viewer
- SeverityTag + ActionTag

**Priority 3: Testing**
- Integration tests (E2E workflow)
- Unit tests (email notifier)

**Priority 4: Documentation**
- Complete user guide
- Implementation plan
- Completion summary

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Guardian Scan (Phase 16)                   │
│                                                             │
│  Detects CRITICAL/SENSITIVE change → Creates case file     │
│                         ↓                                   │
│              Calls: sendNotification(caseId)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│            Email Notification System (Phase 17)             │
│                                                             │
│  1. Load case file: docs/guardian/cases/<case-id>.json     │
│  2. Load config: config/product-guard.yaml                 │
│  3. Resolve domains → owners → emails                      │
│  4. Generate HTML + plain text email                       │
│  5. Send via Resend API                                    │
│  6. Log result (success/failure)                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Product Owner (Email Inbox)                    │
│                                                             │
│  Receives email → Clicks approval link                     │
│  Dashboard opens to case → Reviews diff                    │
│  (Admin Panel UI - Coming in next commits)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Email Example

**Subject:**
```
[GUARDIAN] CRITICAL: pricing changes require approval
```

**Body (HTML - Snake Eater themed):**
```html
Guardian Agent

CRITICAL

Case ID: 2025-10-09-12-00-00
Timestamp: 2025-10-09T12:00:00Z
Actor: emiliopostigo
Domains: pricing
Files: src/services/costControl.js (+10 -5)
Notes: Requires Product Owner approval

[View Case & Approve] (button with #00FF41 color)
```

---

## Testing

```bash
# Test email notifier directly
MOCK_EMAIL=true node scripts/notify-guardian.js --case-id=test-case

# Test Guardian integration
MOCK_EMAIL=true node scripts/guardian-gdd.js --full

# Test with actual email (requires RESEND_API_KEY)
RESEND_API_KEY=re_xxxxx node scripts/notify-guardian.js --case-id=test-case

# Test dev mode (sends to ADMIN_EMAIL only)
DEV_MODE=true RESEND_API_KEY=re_xxxxx node scripts/notify-guardian.js --case-id=test-case
```

---

## Notes

- Email notifications are **automatic** for CRITICAL/SENSITIVE cases
- NO emails sent for SAFE changes (auto-approved)
- Notification failure does NOT block Guardian scan (graceful degradation)
- MOCK_EMAIL mode useful for development and CI/CD testing
- DEV_MODE redirects all emails to ADMIN_EMAIL (safe for staging)

---

## Support

For questions or issues:
- See tracking doc: `docs/guardian/PHASE-17-TODO.md`
- Check Phase 16 docs: `docs/guardian/` (base functionality)
- Open issue: https://github.com/Eibon7/roastr-ai/issues

---

**Phase 17 Status:** 2/16 files complete (12.5%)
**Next Update:** Frontend type system + API client
**Last Updated:** 2025-10-09
