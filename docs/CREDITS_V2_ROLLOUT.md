# Credits v2 Rollout Guide

**Issue #297: Dual Credit System Implementation**

## Overview

This document outlines the rollout strategy for the Credits v2 dual credit system, including feature flag management, testing procedures, and monitoring guidelines.

## Feature Flag: ENABLE_CREDITS_V2

### Configuration

```bash
# Environment Variable
ENABLE_CREDITS_V2=true  # Enable Credits v2 system
ENABLE_CREDITS_V2=false # Use legacy system (default)
```

### Rollout Phases

#### Phase 1: Development & Testing (Week 1)

- **Target**: Development and staging environments only
- **Flag Status**: `ENABLE_CREDITS_V2=true` in dev/staging
- **Validation**:
  - Run migration: `node scripts/backfill_credits_v2.js --dry-run`
  - Execute unit tests: `npm test -- --testPathPattern=credits`
  - Verify API endpoints: `/api/user/credits/status`
  - Test frontend components in dashboard

#### Phase 2: Internal Beta (Week 2)

- **Target**: Internal team accounts (5-10 users)
- **Flag Status**: `ENABLE_CREDITS_V2=true` for beta users only
- **Implementation**: User-specific feature flag override
- **Validation**:
  - Monitor credit consumption patterns
  - Verify billing cycle resets
  - Test upgrade/downgrade flows
  - Validate Stripe webhook integration

#### Phase 3: Limited Production (Week 3)

- **Target**: 10% of production users (new signups first)
- **Flag Status**: Gradual rollout with monitoring
- **Implementation**: Percentage-based rollout
- **Validation**:
  - Monitor error rates and performance
  - Verify credit accuracy vs. legacy system
  - Check billing integration stability

#### Phase 4: Full Rollout (Week 4)

- **Target**: All production users
- **Flag Status**: `ENABLE_CREDITS_V2=true` globally
- **Implementation**: Complete migration
- **Validation**:
  - Monitor system stability
  - Verify all users migrated successfully
  - Performance benchmarking

## Pre-Rollout Checklist

### Database Preparation

- [ ] Apply migration: `database/migrations/004_credits_v2_dual_system.sql`
- [ ] Run backfill script: `node scripts/backfill_credits_v2.js`
- [ ] Verify database functions: `get_or_create_active_period`, `consume_credits`
- [ ] Test database performance with expected load

### Code Deployment

- [ ] Deploy backend services with Credits v2 code
- [ ] Deploy frontend with CreditsCard component
- [ ] Verify API routes: `/api/user/credits/*`
- [ ] Test middleware integration: `requireAnalysisCredits`, `requireRoastCredits`

### Monitoring Setup

- [ ] Configure credit consumption alerts
- [ ] Set up billing cycle monitoring
- [ ] Monitor Stripe webhook processing
- [ ] Track API error rates and response times

### Testing Validation

- [ ] All unit tests passing: `npm test`
- [ ] Integration tests verified: `npm run test:integration`
- [ ] End-to-end scenarios tested
- [ ] Load testing completed

## Rollout Commands

### Enable Credits v2 (Production)

```bash
# Set environment variable
export ENABLE_CREDITS_V2=true

# Restart services to pick up new flag
pm2 restart roastr-api

# Verify flag status
curl -H "Authorization: Bearer $TOKEN" \
  https://api.roastr.ai/api/credits/config
```

### Rollback to Legacy System

```bash
# Disable Credits v2
export ENABLE_CREDITS_V2=false

# Restart services
pm2 restart roastr-api

# Verify rollback
curl -H "Authorization: Bearer $TOKEN" \
  https://api.roastr.ai/api/user/credits/status
# Should return fallback: true
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Credit Consumption Accuracy**
   - Compare Credits v2 vs legacy consumption
   - Monitor for unexpected spikes or drops
   - Alert on >5% variance

2. **API Performance**
   - `/api/user/credits/status` response time <200ms
   - Credit consumption middleware latency <50ms
   - Database query performance

3. **Billing Integration**
   - Stripe webhook processing success rate >99%
   - Credit reset accuracy on billing cycles
   - Plan upgrade/downgrade handling

4. **Error Rates**
   - Credit consumption failures <1%
   - API endpoint error rates <0.5%
   - Database connection issues

### Alert Thresholds

```yaml
# Example monitoring configuration
alerts:
  credit_consumption_failure:
    threshold: 1%
    window: 5m
    severity: warning

  api_error_rate:
    threshold: 0.5%
    window: 1m
    severity: critical

  billing_webhook_failure:
    threshold: 1%
    window: 10m
    severity: critical

  database_query_slow:
    threshold: 500ms
    window: 1m
    severity: warning
```

## Troubleshooting

### Common Issues

#### Credits Not Resetting on Billing Cycle

```bash
# Check Stripe webhook logs
grep "Credits reset for" /var/log/roastr/api.log

# Manually reset credits for user
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.roastr.ai/api/admin/credits/reset \
  -d '{"userId": "user_id", "reason": "manual_reset"}'
```

#### Credit Consumption Failures

```bash
# Check database function status
psql -c "SELECT consume_credits('user_id', 'analysis', 1, 'test', null, '{}');"

# Verify user has active period
psql -c "SELECT * FROM usage_counters WHERE user_id = 'user_id' AND period_end > NOW();"
```

#### Frontend Not Showing Credits

```bash
# Verify API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://api.roastr.ai/api/user/credits/status

# Check feature flag
curl https://api.roastr.ai/api/credits/config
```

### Emergency Procedures

#### Immediate Rollback

1. Set `ENABLE_CREDITS_V2=false`
2. Restart all services
3. Verify legacy system functioning
4. Investigate issues in staging

#### Data Corruption Recovery

1. Stop credit consumption
2. Restore from backup if needed
3. Re-run backfill script
4. Validate data integrity

## Success Criteria

### Phase Completion Requirements

1. **Technical Metrics**
   - Zero data loss or corruption
   - API response times within SLA
   - Error rates below thresholds
   - All tests passing

2. **Business Metrics**
   - Credit consumption matches expected patterns
   - Billing accuracy maintained
   - User experience not degraded
   - Support ticket volume normal

3. **Operational Metrics**
   - Monitoring and alerts functioning
   - Rollback procedures tested
   - Documentation complete
   - Team trained on new system

## Post-Rollout

### Week 1 After Full Rollout

- [ ] Monitor all metrics daily
- [ ] Review support tickets for credit-related issues
- [ ] Validate billing accuracy for first full cycle
- [ ] Performance optimization if needed

### Month 1 After Full Rollout

- [ ] Analyze credit consumption patterns
- [ ] Optimize database queries if needed
- [ ] Review and update plan limits if necessary
- [ ] Plan legacy system deprecation

### Legacy System Deprecation (Month 3)

- [ ] Remove legacy credit code
- [ ] Clean up old database tables
- [ ] Update documentation
- [ ] Archive old monitoring

## Support Documentation

### User-Facing Changes

- New credit types: Analysis and Roast credits
- Separate limits for different operations
- Real-time credit tracking in dashboard
- Improved upgrade prompts

### Admin Tools

- Credit status monitoring
- Manual credit adjustments
- Billing cycle management
- Usage analytics and reporting

## Contact Information

- **Technical Lead**: Development Team
- **Product Owner**: Product Team
- **DevOps**: Infrastructure Team
- **Support**: Customer Success Team

For issues during rollout, contact the on-call engineer or escalate through normal support channels.
