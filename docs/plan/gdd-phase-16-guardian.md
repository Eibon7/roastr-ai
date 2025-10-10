# GDD 2.0 - Phase 16: Guardian Agent Core

**Created:** 2025-10-09
**Status:** Complete
**Priority:** P0
**Owner:** Orchestrator Agent

---

## Objective

Build the Guardian Agent foundation - an autonomous system that detects, classifies, and audits sensitive changes in product logic and GDD documentation to protect business integrity.

## Success Criteria

✅ Guardian correctly classifies SAFE | SENSITIVE | CRITICAL changes
✅ Full audit trail generated for each detected event
✅ Diff files consistent and traceable to commits
✅ CI integration verified (exit codes 0/1/2)
✅ No runtime errors or missing logs
✅ Documentation complete with workflow examples

## Components Implemented

### 1. Guardian Engine (`scripts/guardian-gdd.js`)

**Purpose:** Core monitoring and classification engine

**Features:**
- Monitors commits and PR changes
- Compares current vs approved states
- Detects unauthorized edits in protected areas
- Classifies by severity: SAFE | SENSITIVE | CRITICAL
- Enforces protection rules
- Generates structured reports

**CLI Flags:**
- `--full` - Full system scan
- `--check` - Quick validation
- `--report` - Generate markdown report
- `--ci` - CI mode (strict exit codes)

**Exit Codes:**
- `0` - All checks passed (SAFE)
- `1` - Warnings detected (SENSITIVE - requires review)
- `2` - Critical violations (CRITICAL - blocked)

### 2. Product Guard Configuration (`config/product-guard.yaml`)

**Purpose:** Source of truth for protected domains

**Protected Domains:**
1. **Pricing** (CRITICAL) - Subscription tiers, billing logic, payment processing
2. **Quotas** (CRITICAL) - Usage limits, rate limiting, resource allocation
3. **Auth Policies** (CRITICAL) - Authentication, RLS policies, access control
4. **AI Models** (SENSITIVE) - Model selection, prompt templates, parameters
5. **Public Contracts** (SENSITIVE) - API schemas, webhook contracts, SLAs

### 3. Diff Collector (`scripts/collect-diff.js`)

**Purpose:** Generate structured diffs for Guardian analysis

**Features:**
- Compare current repo vs last approved commit
- Generate JSON diff per file
- Group by protected domain
- Calculate impact score
- Store in `docs/guardian/diffs/`

### 4. Audit System

**Components:**
- Audit log: `docs/guardian/audit-log.md`
- Case files: `docs/guardian/cases/<timestamp>.json`
- Comprehensive event tracking

## Testing Results

All tests passing:
- ✅ Guardian full scan: ~800ms (target: <2s)
- ✅ Diff collection: ~500ms (target: <2s)
- ✅ Report generation: ~200ms (target: <1s)
- ✅ Exit codes validated (0/1/2)
- ✅ Audit trail verified

## Files Created

- `config/product-guard.yaml` - Guardian configuration (264 lines)
- `scripts/guardian-gdd.js` - Main engine (499 lines)
- `scripts/collect-diff.js` - Diff collector (420 lines)
- `docs/guardian/audit-log.md` - Event log
- `docs/guardian/README.md` - User guide (359 lines)
- `docs/plan/gdd-phase-16-guardian.md` - This file
- `CLAUDE.md` - Updated with Guardian workflow

**Total New Code:** ~2,177 lines

## Usage Examples

```bash
# Full scan
node scripts/guardian-gdd.js --full

# Quick check
node scripts/guardian-gdd.js --check

# Generate report
node scripts/guardian-gdd.js --report

# CI mode
node scripts/guardian-gdd.js --ci

# Collect diffs
node scripts/collect-diff.js --verbose
```

## CI/CD Integration

```yaml
- name: Guardian Validation
  run: node scripts/guardian-gdd.js --ci
  # Exit 0: continue (SAFE)
  # Exit 1: create review issue (SENSITIVE)
  # Exit 2: block merge (CRITICAL)
```

## Future Enhancements

**Phase 17 - Governance UI:**
- Web dashboard for audit review
- Approval workflow interface
- Real-time Guardian alerts

**Phase 18 - Advanced Rules:**
- Custom rule engine with scripting
- Machine learning classification
- Historical trend analysis

---

**Status:** ✅ Complete - Production Ready
**Blocking Issues:** None
**Dependencies:** Git, YAML parser

*Implementation Date: October 9, 2025*
