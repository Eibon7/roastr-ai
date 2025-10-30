# Guardian Case Schema

**Version:** 1.0
**Last Updated:** 2025-10-30

## Overview

This document defines the expected schema for Guardian Agent case files stored in `docs/guardian/cases/`.

## Complete Schema (Current Standard)

All new Guardian cases MUST include the following fields:

```json
{
  "case_id": "string (ISO timestamp format: YYYY-MM-DD-HH-MM-SS-mmm)",
  "timestamp": "string (ISO 8601)",
  "actor": "string (GitHub username or system user)",
  "domains": ["array", "of", "domain", "strings"],
  "files_changed": ["array/of/file/paths.js"],
  "severity": "SAFE | SENSITIVE | CRITICAL",
  "action": "APPROVED | REVIEW | BLOCKED",
  "violations": {
    "critical": "number",
    "sensitive": "number",
    "safe": "number"
  },
  "details": [
    {
      "file": "string (file path)",
      "domains": ["array", "of", "domains"],
      "severity": "SAFE | SENSITIVE | CRITICAL",
      "lines_added": "number",
      "lines_removed": "number"
    }
  ],
  "approval_required": "boolean",
  "approved_by": "string | null",
  "notes": "string"
}
```

## Field Requirements

### Required Fields (All Cases)
- `case_id`: Unique identifier based on timestamp
- `timestamp`: ISO 8601 timestamp of case creation
- `actor`: User who triggered the case
- `files_changed`: Array of modified files
- `severity`: Overall severity level
- `action`: Resulting action
- `violations`: Count of violations by severity
- `approval_required`: Whether manual approval is needed
- `notes`: Human-readable notes

### Required Fields (details array entries)
- `file`: File path (REQUIRED)
- `domains`: GDD domains affected (REQUIRED - may be empty array)
- `severity`: File-level severity (REQUIRED)
- `lines_added`: Lines added in change (REQUIRED)
- `lines_removed`: Lines removed in change (REQUIRED)

### Optional Fields
- `approved_by`: Null until case is manually approved
- `domains` (root level): May be empty array if no domains affected

## Historical Cases (Pre-2025-10-30)

Cases created before the schema standardization (2025-10-30) may have **incomplete `details` entries**:

```json
"details": [
  {
    "file": "test.js"
    // Missing: domains, severity, lines_added, lines_removed
  }
]
```

**Why Fields Are Omitted:**
- Historical cases were generated before full schema enforcement
- Retroactive data population is not feasible
- Incomplete cases remain valid for audit trail purposes

**Impact:**
- Historical cases are still valid for compliance auditing
- Deduplication logic handles both complete and incomplete schemas
- New cases (post-2025-10-30) MUST follow complete schema

## Schema Validation

The Guardian generator script (`scripts/guardian-gdd.js`) enforces complete schema for all new cases. Validation checks:

✅ All required fields present
✅ `details` array entries have all 5 fields
✅ Severity values are valid (SAFE/SENSITIVE/CRITICAL)
✅ Violations counts match details array

## Deduplication

As of 2025-10-30, Guardian implements case deduplication using:

**Deduplication Key Formula:**
```text
SHA256(sorted_files + severity + action + sorted_domains)[0:16]
```

**Prevents:**
- Multiple identical cases for the same change
- Audit log clutter
- Duplicate case files

**Implementation:** `scripts/guardian-gdd.js:76-117`

## Examples

### Complete Case (Current Standard)
```json
{
  "case_id": "2025-10-30-12-00-00-000",
  "timestamp": "2025-10-30T12:00:00.000Z",
  "actor": "developer",
  "domains": ["billing", "pricing"],
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
      "domains": ["billing", "pricing"],
      "severity": "CRITICAL",
      "lines_added": 10,
      "lines_removed": 5
    }
  ],
  "approval_required": true,
  "approved_by": null,
  "notes": "Requires Product Owner approval"
}
```

### Historical Case (Pre-Standardization)
```json
{
  "case_id": "2025-10-22-22-45-30-798",
  "timestamp": "2025-10-22T22:45:30.798Z",
  "actor": "emiliopostigo",
  "domains": [],
  "files_changed": ["test.js"],
  "severity": "SAFE",
  "action": "APPROVED",
  "violations": {
    "critical": 0,
    "sensitive": 0,
    "safe": 1
  },
  "details": [
    {
      "file": "test.js"
      // Note: Incomplete - missing domains, severity, lines_added, lines_removed
    }
  ],
  "approval_required": false,
  "approved_by": null,
  "notes": "Auto-approved"
}
```

## Migration Strategy

No migration of historical cases is required. The incomplete schema for historical cases:

✅ Maintains audit trail integrity
✅ Preserves chronological record
✅ Does not break tooling
✅ Is documented as acceptable variance

All **new cases** generated after 2025-10-30 **MUST** follow the complete schema.

## See Also

- `scripts/guardian-gdd.js` - Generator implementation
- `docs/guardian/audit-log.md` - Chronological case index
- `config/product-guard.yaml` - Guardian configuration
