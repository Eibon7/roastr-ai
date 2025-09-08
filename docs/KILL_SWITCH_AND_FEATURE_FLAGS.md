# Kill Switch and Feature Flags System

**Issue #294: Kill Switch global y panel de control de feature flags para administradores**

## Overview

This document describes the comprehensive Kill Switch and Feature Flags system implemented for Roastr.ai. This system provides administrators with emergency controls and dynamic feature management capabilities without requiring code deployments.

## Features

### 🚨 Emergency Kill Switch
- **Global Autopost Kill Switch**: Instantly disable all automatic posting across all platforms and users
- **Emergency Response**: Immediate effect with comprehensive audit logging
- **Fail-Safe Design**: Kill switch fails closed (blocks operations) when status cannot be determined, with local cache fallback for database outages

### 🎛️ Dynamic Feature Flags
- **Runtime Control**: Enable/disable features without deployments
- **Platform-Specific Controls**: Individual autopost controls per social media platform
- **Categorized Management**: Organized by system, autopost, UI, and experimental features
- **Real-time Updates**: Changes take effect immediately with cache invalidation

### 📊 Comprehensive Audit Trail
- **Complete Logging**: All admin actions are logged with full context
- **User Tracking**: Track which admin performed what action and when
- **Change History**: Before/after values for all modifications
- **Export Capabilities**: Export audit logs for compliance and analysis

### 🔒 Security & Access Control
- **Admin-Only Access**: All controls restricted to verified admin users
- **Row Level Security**: Database-level security policies
- **IP and User Agent Tracking**: Complete request context logging
- **Confirmation Dialogs**: Critical actions require explicit confirmation

## Architecture

### Database Schema

#### Feature Flags Table
```sql
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(100) NOT NULL UNIQUE,
    flag_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    flag_type VARCHAR(50) NOT NULL DEFAULT 'boolean',
    flag_value JSONB DEFAULT 'false'::jsonb,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

#### Audit Logs Table
```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(200),
    old_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Backend Components

#### Kill Switch Middleware (`src/middleware/killSwitch.js`)
- **KillSwitchService**: Singleton service with caching and real-time updates
- **checkKillSwitch**: Express middleware for API endpoints
- **shouldBlockAutopost**: Function for worker processes
- **Platform-specific checks**: Individual platform autopost controls

#### Admin API Routes (`src/routes/admin/featureFlags.js`)
- `GET /api/admin/feature-flags` - List all feature flags
- `PUT /api/admin/feature-flags/:flagKey` - Update specific flag
- `POST /api/admin/kill-switch` - Toggle global kill switch
- `GET /api/admin/audit-logs` - Retrieve audit logs

### Frontend Components

#### System Control Panel (`frontend/src/pages/admin/SystemControlPanel.jsx`)
- **Tabbed Interface**: Kill Switch, Feature Flags, and Audit Logs
- **Real-time Status**: Live system health monitoring
- **Quick Actions**: Common administrative tasks

#### Kill Switch Panel (`frontend/src/components/admin/KillSwitchPanel.jsx`)
- **Emergency Toggle**: Large, prominent kill switch control
- **Confirmation Dialog**: Requires reason and explicit confirmation
- **Status Indicators**: Clear visual feedback on current state

#### Feature Flags Panel (`frontend/src/components/admin/FeatureFlagsPanel.jsx`)
- **Categorized View**: Organized by feature category
- **Search and Filter**: Find specific flags quickly
- **Bulk Operations**: Manage multiple flags efficiently

#### Audit Logs Panel (`frontend/src/components/admin/AuditLogsPanel.jsx`)
- **Comprehensive History**: All administrative actions
- **Advanced Filtering**: By action type, resource, user, date range
- **Export Functionality**: CSV export for compliance

## Feature Flags Reference

### System Flags
- `KILL_SWITCH_AUTOPOST` - Emergency kill switch for all autopost operations
- `ENABLE_SHIELD_MODE` - Shield automated moderation system
- `ENABLE_TOXICITY_FILTER` - Content toxicity filtering
- `ENABLE_CONTENT_WARNINGS` - Content warning system

### Autopost Flags
- `ENABLE_AUTOPOST` - Global autopost functionality
- `ENABLE_MANUAL_APPROVAL` - Require manual approval before posting
- `AUTOPOST_TWITTER` - Twitter/X autopost
- `AUTOPOST_YOUTUBE` - YouTube comments autopost
- `AUTOPOST_INSTAGRAM` - Instagram autopost
- `AUTOPOST_FACEBOOK` - Facebook autopost
- `AUTOPOST_DISCORD` - Discord autopost
- `AUTOPOST_TWITCH` - Twitch autopost
- `AUTOPOST_REDDIT` - Reddit autopost
- `AUTOPOST_TIKTOK` - TikTok autopost
- `AUTOPOST_BLUESKY` - Bluesky autopost

### UI Flags
- `ENABLE_STYLE_STUDIO` - Style Studio feature
- `ENABLE_HALL_OF_FAME` - Hall of Fame feature
- `ENABLE_POLICY_SIMULATOR` - Policy Simulator feature
- `ENABLE_ENGAGEMENT_COPILOT` - Engagement Copilot feature

### Experimental Flags
- `ENABLE_AI_PERSONAS` - Custom AI personas
- `ENABLE_ADVANCED_ANALYTICS` - Advanced analytics and insights
- `ENABLE_BULK_OPERATIONS` - Bulk operations on responses

## Usage Examples

### Checking Kill Switch in Worker
```javascript
const { shouldBlockAutopost } = require('../middleware/killSwitch');

// In worker process
const autopostCheck = await shouldBlockAutopost('twitter');
if (autopostCheck.blocked) {
    logger.warn('Autopost blocked', {
        reason: autopostCheck.reason,
        message: autopostCheck.message
    });
    return; // Skip processing
}
```

### Using Middleware in Routes
```javascript
const { checkKillSwitch } = require('../middleware/killSwitch');

// Apply to autopost routes
router.post('/autopost', checkKillSwitch, async (req, res) => {
    // Route handler
});
```

### Frontend API Usage
```javascript
import { adminApi } from '../services/adminApi';

// Toggle kill switch
await adminApi.toggleKillSwitch(true, 'Emergency maintenance');

// Update feature flag
await adminApi.updateFeatureFlag('AUTOPOST_TWITTER', {
    is_enabled: false
});
```

## Security Considerations

1. **Admin Verification**: All endpoints verify admin status
2. **Audit Logging**: Every action is logged with full context
3. **Fail-Safe Design**: Kill switch fails closed (blocks operations) when database is unavailable, with encrypted local cache fallback
4. **Local Cache Security**: Kill switch state cached locally with AES-256 encryption and restricted file permissions (0600)
5. **Cache TTL**: Local cache expires after 1 hour to prevent stale state from persisting indefinitely
6. **Atomic Updates**: Local cache uses atomic write operations (write-temp-rename) to prevent corruption
7. **Rate Limiting**: Consider implementing rate limits for flag changes
8. **Backup Access**: Ensure database-level access for emergency situations

### Local Cache Fallback Behavior

The kill switch implements a secure local cache fallback system to handle database outages:

- **Primary**: Always attempt to read kill switch state from database first
- **Fallback**: If database is unavailable, use encrypted local cache file (`.cache/kill-switch-state.json`)
- **Fail-Closed**: If both database and cache are unavailable, kill switch activates (blocks operations)
- **Cache Refresh**: Successful database reads update the local cache automatically
- **TTL Protection**: Cached state expires after 1 hour to prevent indefinite stale state
- **Security**: Cache file is encrypted with AES-256 and has restricted permissions (owner read/write only)

## Monitoring and Alerting

### Recommended Alerts
- Kill switch activation/deactivation
- Multiple feature flag changes in short time
- Failed kill switch checks
- Unusual admin activity patterns

### Metrics to Track
- Kill switch activation frequency
- Feature flag change frequency
- Autopost blocking events
- Admin action patterns

## Testing

Comprehensive test suites are provided:
- `tests/unit/middleware/killSwitch.test.js` - Kill switch middleware tests
- `tests/unit/routes/admin/featureFlags.test.js` - Admin API tests

Run tests with:
```bash
npm test -- --testPathPatterns="killSwitch.test.js"
npm test -- --testPathPatterns="featureFlags.test.js"
```

## Deployment Notes

1. **Database Migration**: Apply the feature flags migration first
2. **Cache Warming**: Initialize kill switch service on startup
3. **Admin Access**: Ensure admin users are properly configured
4. **Monitoring Setup**: Configure alerts for kill switch events

## Future Enhancements

- **Scheduled Flag Changes**: Time-based flag toggles
- **Percentage Rollouts**: Gradual feature rollouts
- **A/B Testing Integration**: Feature flag-based testing
- **Slack/Discord Notifications**: Real-time admin alerts
- **API Rate Limiting**: Prevent abuse of admin endpoints

## Support

For issues or questions regarding the Kill Switch and Feature Flags system:
1. Check the audit logs for recent changes
2. Verify admin permissions
3. Review system health status
4. Contact the development team with specific error details
