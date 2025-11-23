# GDPR Account Deletion Implementation

This document describes the comprehensive GDPR-compliant account deletion system implemented in Roastr.ai.

## Overview

The account deletion system provides full GDPR compliance for user data deletion requests, implementing:

- **Right to be forgotten** (GDPR Article 17)
- **Right to data portability** (GDPR Article 20)
- **Grace period** for user protection
- **Complete audit trail** for legal compliance
- **Automatic data export** before deletion
- **Email notifications** throughout the process

## System Components

### 1. Database Schema

#### Account Deletion Requests Table

```sql
CREATE TABLE account_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Request details
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_deletion_at TIMESTAMPTZ NOT NULL,
    grace_period_days INTEGER DEFAULT 30,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, cancelled, processing, completed

    -- User info at time of request (for audit trail)
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),

    -- Processing details
    data_exported_at TIMESTAMPTZ,
    data_export_url TEXT,
    data_export_expires_at TIMESTAMPTZ,

    -- Completion
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT
);
```

#### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    user_id UUID, -- Can be null after user deletion
    actor_type VARCHAR(20) DEFAULT 'user',
    legal_basis VARCHAR(100),
    retention_period_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. API Endpoints

#### Request Account Deletion

```http
DELETE /api/user/account
Content-Type: application/json
Authorization: Bearer <token>

{
  "password": "user_password",
  "confirmation": "DELETE"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Account deletion requested successfully",
  "data": {
    "requestId": "uuid",
    "scheduledDeletionDate": "2025-09-18T10:00:00Z",
    "gracePeriodDays": 30,
    "dataExportUrl": "https://app.roastr.ai/api/user/data-export/download/token",
    "dataExportExpiresAt": "2025-08-22T10:00:00Z",
    "cancellationUrl": "https://app.roastr.ai/api/user/account/deletion/cancel"
  }
}
```

#### Cancel Account Deletion

```http
POST /api/user/account/deletion/cancel
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "Changed my mind"
}
```

#### Check Deletion Status

```http
GET /api/user/account/deletion/status
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hasDeletionRequest": true,
    "status": "pending",
    "daysUntilDeletion": 25,
    "canCancel": true,
    "dataExportUrl": "https://...",
    "scheduledDeletionAt": "2025-09-18T10:00:00Z"
  }
}
```

#### Generate Data Export

```http
GET /api/user/data-export
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Data export generated successfully",
  "data": {
    "downloadUrl": "https://app.roastr.ai/api/user/data-export/download/secure-token",
    "filename": "user-data-export-12345678-1692432000000.zip",
    "size": 1048576,
    "expiresAt": "2025-08-22T10:00:00Z"
  }
}
```

### 3. Data Export Service

The `DataExportService` creates comprehensive GDPR-compliant data exports:

```javascript
const dataExportService = new DataExportService();
const exportResult = await dataExportService.exportUserData(userId);
```

**Export Contents:**

- `README.txt` - Explanation of export and user rights
- `user_profile.json` - Account information and preferences
- `organizations.json` - Organizations owned or member of
- `integrations.json` - Platform integrations (API keys redacted)
- `activity/comments.json` - User comments and interactions
- `activity/responses.json` - Generated responses
- `activity/user_activities.json` - Activity logs
- `billing/usage_records.json` - Usage and billing data
- `security/api_keys.json` - API keys (sensitive data redacted)
- `security/audit_logs.json` - Security and audit logs
- `data_summary.json` - Summary statistics and retention info
- `export_metadata.json` - Export metadata and legal basis

### 4. Account Deletion Worker

The `AccountDeletionWorker` processes scheduled deletions:

```bash
# Start the worker
npm run worker:account-deletion

# Or run directly
node src/workers/cli/start-account-deletion-worker.js
```

**Worker Process:**

1. **Polls for pending deletions** every 5 minutes
2. **Processes expired grace periods** automatically
3. **Generates final data export** if not already done
4. **Anonymizes historical data** for compliance retention
5. **Performs complete data deletion** with cascade cleanup
6. **Sends completion notifications** via email
7. **Logs all actions** for audit compliance

**Worker Configuration:**

```javascript
{
  pollInterval: 5 * 60 * 1000,     // 5 minutes
  maxConcurrency: 1,               // One deletion at a time
  maxRetries: 3,                   // Retry failed deletions
  retryDelay: 30 * 60 * 1000      // 30 minute retry delay
}
```

### 5. Email Notifications

The system sends automated emails at key stages:

#### Deletion Request Confirmation

- Sent immediately when deletion is requested
- Includes data export link and cancellation instructions
- Grace period information and timeline

#### Deletion Reminder

- Sent 3 days before scheduled deletion
- Final opportunity to cancel
- Re-includes data export and cancellation links

#### Deletion Cancelled

- Sent when user cancels deletion request
- Confirms account is safe and cancellation reason

#### Deletion Completed

- Sent after successful account deletion
- Confirms all personal data removed
- Legal retention information for anonymized data

### 6. Audit Service

Complete audit trail for all GDPR actions:

```javascript
// Log deletion request
await auditService.logAccountDeletionRequest(userId, requestId, details, req);

// Log data export
await auditService.logDataExport(userId, exportDetails);

// Log deletion cancellation
await auditService.logAccountDeletionCancellation(userId, requestId, details, req);

// Log completion
await auditService.logAccountDeletionCompleted(userId, requestId, details);
```

**Audit Actions Tracked:**

- `account_deletion_requested` - User requests deletion
- `gdpr_data_exported` - Data export generated
- `account_deletion_cancelled` - User cancels deletion
- `account_deletion_processing_started` - Worker begins processing
- `personal_data_anonymized` - Data anonymized for retention
- `account_deletion_completed` - Deletion fully complete

## GDPR Compliance Features

### Legal Basis

- **Article 17**: Right to be forgotten (account deletion)
- **Article 20**: Right to data portability (data export)
- **Article 15**: Right of access (audit trail access)

### Data Retention

- **Audit logs**: 7 years retention for legal compliance
- **Anonymized activity data**: 2 years for analytics (PII removed)
- **Personal data**: Completely deleted

### Security Measures

- **Re-authentication required** for deletion requests
- **Explicit confirmation** ("DELETE") required
- **Grace period** (30 days) for user protection
- **Secure download tokens** for data exports
- **Complete audit trail** for all actions

### Privacy Rights

- **Right to cancel** deletion during grace period
- **Data portability** via comprehensive export
- **Transparent process** with status tracking
- **Email notifications** at every stage

## Usage Examples

### Request Account Deletion

```javascript
const response = await fetch('/api/user/account', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`
  },
  body: JSON.stringify({
    password: userPassword,
    confirmation: 'DELETE'
  })
});

const result = await response.json();
```

### Check Deletion Status

```javascript
const response = await fetch('/api/user/account/deletion/status', {
  headers: {
    Authorization: `Bearer ${userToken}`
  }
});

const status = await response.json();
if (status.data.hasDeletionRequest) {
  console.log(`${status.data.daysUntilDeletion} days until deletion`);
}
```

### Cancel Deletion

```javascript
const response = await fetch('/api/user/account/deletion/cancel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`
  },
  body: JSON.stringify({
    reason: 'Changed my mind about leaving'
  })
});
```

### Generate Data Export

```javascript
const response = await fetch('/api/user/data-export', {
  headers: {
    Authorization: `Bearer ${userToken}`
  }
});

const exportData = await response.json();
// User can download from exportData.data.downloadUrl
```

## Deployment

### Environment Variables

```bash
# Required
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_service_key

# Optional but recommended
SENDGRID_API_KEY=your_sendgrid_key
APP_URL=https://app.roastr.ai

# Worker configuration (optional)
DELETION_POLL_INTERVAL=300000      # 5 minutes
DELETION_MAX_CONCURRENCY=1         # Safety limit
DELETION_MAX_RETRIES=3              # Retry attempts
DELETION_RETRY_DELAY=1800000        # 30 minutes
DELETION_SHUTDOWN_TIMEOUT=30000     # 30 seconds
```

### Database Migration

```bash
# Apply the GDPR schema changes
psql -h your_db_host -d your_database -f database/schema.sql
```

### Start Worker

```bash
# Start the account deletion worker
npm run worker:account-deletion

# Or with PM2 for production
pm2 start src/workers/cli/start-account-deletion-worker.js --name account-deletion-worker
```

### Monitoring

```bash
# Check worker status
npm run workers:status

# Monitor queue status
npm run queue:status

# Check processing logs
tail -f logs/account-deletion-worker.log
```

## Testing

### Unit Tests

```bash
# Test data export service
npm test tests/unit/services/dataExportService.test.js

# Test account deletion routes
npm test tests/unit/routes/account-deletion.test.js

# Test audit service GDPR functions
npm test tests/unit/services/auditService.test.js
```

### Integration Tests

```bash
# Full GDPR flow test
npm test tests/integration/gdpr-compliance.test.js

# Worker processing test
npm test tests/integration/account-deletion-worker.test.js
```

### Manual Testing

```bash
# Create test deletion request
curl -X DELETE http://localhost:3000/api/user/account \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"test","confirmation":"DELETE"}'

# Check status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/user/account/deletion/status

# Cancel deletion
curl -X POST http://localhost:3000/api/user/account/deletion/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing cancellation"}'
```

## Legal Compliance

This implementation provides:

✅ **GDPR Article 17** - Right to be forgotten  
✅ **GDPR Article 20** - Right to data portability  
✅ **GDPR Article 15** - Right of access (via audit trail)  
✅ **30-day grace period** for user protection  
✅ **Complete audit trail** with 7-year retention  
✅ **Secure data export** with encrypted downloads  
✅ **Email notifications** for transparency  
✅ **Data anonymization** for legal retention requirements  
✅ **Cascading deletion** of all related data  
✅ **Worker-based processing** for reliable execution

## Support

For issues or questions about the GDPR account deletion system:

1. Check the audit logs for processing status
2. Verify worker is running with `npm run workers:status`
3. Check email service configuration
4. Review database permissions for cascade deletes
5. Consult the audit trail via `/api/user/gdpr-audit` endpoint

The system is designed to be fully autonomous once configured, with comprehensive logging and monitoring for compliance verification.
