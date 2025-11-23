# Analytics - Usage Analytics & Performance Insights

**Node ID:** `analytics`
**Owner:** Back-end Dev
**Priority:** Planned
**Status:** Roadmap
**Last Updated:** 2025-10-29
**Coverage:** 59%  
**Coverage Source:** auto
**Related PRs:** #499

## Dependencies

- `multi-tenant` - Organization-scoped analytics data
- `cost-control` - Usage and cost data
- `roast` - Roast generation metrics
- `shield` - Moderation action metrics

## Overview

Analytics provides comprehensive usage analytics, performance insights, and ROI tracking for Roastr.ai organizations. It enables data-driven decision-making through dashboards, reports, and actionable recommendations for optimizing roast generation, reducing costs, and improving engagement.

### Key Capabilities

1. **Usage Analytics** - Roast volume, platform distribution, peak times
2. **Performance Metrics** - Response quality, user approval rates, generation time
3. **Cost Analytics** - Spend tracking, cost per roast, budget forecasting
4. **Engagement Insights** - Platform engagement, viral roasts, audience growth
5. **Shield Analytics** - Moderation effectiveness, false positive rate, recidivism
6. **Recommendations** - AI-powered optimization suggestions

## Architecture

### Analytics Tables

**Table:** `analytics_snapshots`

```sql
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Snapshot period
  period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage metrics
  total_roasts INTEGER DEFAULT 0,
  total_analyses INTEGER DEFAULT 0,
  total_shield_actions INTEGER DEFAULT 0,

  -- Platform breakdown
  roasts_by_platform JSONB DEFAULT '{}', -- {twitter: 100, youtube: 50}

  -- Quality metrics
  avg_rqc_score DECIMAL(3,2),
  avg_response_time_ms INTEGER,
  user_approval_rate DECIMAL(3,2),

  -- Cost metrics
  total_cost_cents INTEGER DEFAULT 0,
  cost_by_operation JSONB DEFAULT '{}', -- {roast: 5000, analysis: 1000}

  -- Engagement metrics (from platforms)
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  viral_roasts INTEGER DEFAULT 0, -- Roasts with > 1000 likes

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, period_type, period_start),
  CONSTRAINT analytics_snapshots_period_check CHECK (
    period_type IN ('daily', 'weekly', 'monthly')
  )
);
```

**Table:** `analytics_events`

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- roast_generated, shield_action, limit_reached
  event_category VARCHAR(50) NOT NULL, -- usage, performance, cost, engagement

  -- Event data
  metadata JSONB DEFAULT '{}',

  -- Context
  platform VARCHAR(50),
  user_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (standalone statements)
CREATE INDEX idx_analytics_events_org_type_time
  ON analytics_events(organization_id, event_type, created_at);
CREATE INDEX idx_analytics_events_org_category_time
  ON analytics_events(organization_id, event_category, created_at);
```

## Safety Patterns

### Null Safety in Calculations

All aggregation queries use defensive null handling:

#### Pattern 1: COALESCE for default values

```sql
SELECT
  COALESCE(SUM(toxicity_score), 0) as total_toxicity,
  COALESCE(AVG(response_time_ms), 0) as avg_response_time
FROM analytics_events
WHERE organization_id = $1;
```

#### Pattern 2: NULLIF to prevent division by zero

```sql
SELECT
  COALESCE(
    SUM(successful_responses)::FLOAT /
    NULLIF(SUM(total_requests), 0),
    0
  ) * 100 as success_rate_pct
FROM analytics_aggregates;
```

#### Pattern 3: Safe percentage calculations

```sql
SELECT
  CASE
    WHEN total_count = 0 THEN 0
    ELSE (filtered_count::FLOAT / total_count * 100)
  END as percentage
FROM analytics_summary;
```

**Table:** `analytics_recommendations`

```sql
CREATE TABLE analytics_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Recommendation details
  type VARCHAR(50) NOT NULL, -- cost_optimization, quality_improvement, engagement
  priority VARCHAR(20) NOT NULL, -- low, medium, high, critical
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Impact estimation
  estimated_savings_cents INTEGER, -- For cost optimizations
  estimated_quality_improvement DECIMAL(3,2), -- For quality recommendations
  estimated_engagement_increase DECIMAL(3,2), -- For engagement recommendations

  -- Actions
  actions JSONB DEFAULT '[]', -- [{action: 'enable_rqc', params: {}}]

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, applied, dismissed
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT analytics_recommendations_type_check CHECK (
    type IN ('cost_optimization', 'quality_improvement', 'engagement_boost', 'shield_tuning')
  ),
  CONSTRAINT analytics_recommendations_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
  )
);
```

## Core Analytics

### 1. Usage Analytics

```javascript
async function getUsageAnalytics(organizationId, startDate, endDate) {
  // Get snapshots for period
  const { data: snapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('period_start', startDate)
    .lte('period_end', endDate)
    .order('period_start', { ascending: true });

  // Aggregate metrics
  const totalRoasts = snapshots.reduce((sum, s) => sum + s.total_roasts, 0);
  const totalAnalyses = snapshots.reduce((sum, s) => sum + s.total_analyses, 0);
  const totalShieldActions = snapshots.reduce((sum, s) => sum + s.total_shield_actions, 0);

  // Platform breakdown
  const platformBreakdown = {};
  snapshots.forEach((snapshot) => {
    Object.entries(snapshot.roasts_by_platform || {}).forEach(([platform, count]) => {
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + count;
    });
  });

  // Time series data
  const timeSeries = snapshots.map((s) => ({
    date: s.period_start,
    roasts: s.total_roasts,
    analyses: s.total_analyses,
    shieldActions: s.total_shield_actions
  }));

  return {
    summary: {
      totalRoasts,
      totalAnalyses,
      totalShieldActions,
      avgRoastsPerDay: totalRoasts / snapshots.length
    },
    platformBreakdown,
    timeSeries
  };
}
```

### 2. Performance Analytics

```javascript
async function getPerformanceAnalytics(organizationId, startDate, endDate) {
  // Get performance metrics from roast_metadata
  const { data: metrics } = await supabase
    .from('roast_metadata')
    .select(
      `
      rqc_score,
      response_time_ms,
      quality_metrics,
      responses!inner(organization_id, created_at)
    `
    )
    .eq('responses.organization_id', organizationId)
    .gte('responses.created_at', startDate)
    .lte('responses.created_at', endDate);

  // Calculate averages (with null safety to prevent divide-by-zero)
  const avgRQCScore =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.rqc_score || 0), 0) / metrics.length
      : 0;
  const avgResponseTime =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / metrics.length
      : 0;

  // Quality distribution
  const qualityDistribution = {
    excellent: metrics.filter((m) => m.rqc_score >= 0.9).length,
    good: metrics.filter((m) => m.rqc_score >= 0.7 && m.rqc_score < 0.9).length,
    fair: metrics.filter((m) => m.rqc_score >= 0.5 && m.rqc_score < 0.7).length,
    poor: metrics.filter((m) => m.rqc_score < 0.5).length
  };

  // User approval rate (from model_feedback if available)
  const { data: feedback } = await supabase
    .from('model_feedback')
    .select('feedback_type')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const approvals = feedback.filter((f) => f.feedback_type === 'approved').length;
  const rejections = feedback.filter((f) => f.feedback_type === 'rejected').length;
  const approvalRate = feedback.length > 0 ? approvals / feedback.length : null;

  return {
    avgRQCScore,
    avgResponseTime,
    qualityDistribution,
    userApprovalRate: approvalRate,
    totalRoastsAnalyzed: metrics.length
  };
}
```

### 3. Cost Analytics

```javascript
async function getCostAnalytics(organizationId, startDate, endDate) {
  // Get usage records
  const { data: usage } = await supabase
    .from('usage_records')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Total cost (with null safety using nullish coalescing)
  const totalCost = usage.reduce((sum, u) => sum + (u.cost_cents ?? 0), 0);

  // Cost by operation type (with null safety)
  const costByOperation = usage.reduce((acc, u) => {
    const type = u.metadata?.operation_type || 'unknown';
    acc[type] = (acc[type] ?? 0) + (u.cost_cents ?? 0);
    return acc;
  }, {});

  // Cost by platform (with null safety)
  const costByPlatform = usage.reduce((acc, u) => {
    const platform = u.platform || 'unknown';
    acc[platform] = (acc[platform] ?? 0) + (u.cost_cents ?? 0);
    return acc;
  }, {});

  // Get plan limit and budget
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_limits(max_roasts, monthly_analysis_limit)')
    .eq('id', organizationId)
    .single();

  // Calculate budget utilization
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { data: monthlyUsage } = await supabase
    .from('monthly_usage_summary')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .single();

  const roastBudgetUsed = monthlyUsage?.roasts_used || 0;
  const roastBudgetTotal = org.plan_limits.max_roasts;
  const budgetUtilization = (roastBudgetUsed / roastBudgetTotal) * 100;

  // Forecast next month cost
  const dailyAvgCost = totalCost / ((endDate - startDate) / (24 * 60 * 60 * 1000));
  const forecastNextMonth = dailyAvgCost * 30;

  return {
    totalCost,
    costByOperation,
    costByPlatform,
    budgetUtilization,
    forecastNextMonth,
    avgCostPerRoast: totalCost / (monthlyUsage?.roasts_used || 1)
  };
}
```

### 4. Engagement Analytics

```javascript
async function getEngagementAnalytics(organizationId, startDate, endDate) {
  // Get responses with engagement data
  const { data: responses } = await supabase
    .from('responses')
    .select(
      `
      *,
      comments(platform, platform_username)
    `
    )
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Aggregate engagement from metadata
  const totalLikes = responses.reduce((sum, r) => sum + (r.metadata?.likes || 0), 0);
  const totalReplies = responses.reduce((sum, r) => sum + (r.metadata?.replies || 0), 0);
  const totalShares = responses.reduce((sum, r) => sum + (r.metadata?.shares || 0), 0);

  // Identify viral roasts (> 1000 likes)
  const viralRoasts = responses.filter((r) => (r.metadata?.likes || 0) > 1000);

  // Engagement by platform
  const engagementByPlatform = responses.reduce((acc, r) => {
    const platform = r.comments.platform;
    if (!acc[platform]) {
      acc[platform] = { likes: 0, replies: 0, shares: 0, roasts: 0 };
    }
    acc[platform].likes += r.metadata?.likes || 0;
    acc[platform].replies += r.metadata?.replies || 0;
    acc[platform].shares += r.metadata?.shares || 0;
    acc[platform].roasts += 1;
    return acc;
  }, {});

  // Calculate engagement rate
  Object.keys(engagementByPlatform).forEach((platform) => {
    const data = engagementByPlatform[platform];
    data.engagementRate = (data.likes + data.replies + data.shares) / data.roasts;
  });

  // Top performing roasts
  const topRoasts = responses
    .sort((a, b) => (b.metadata?.likes || 0) - (a.metadata?.likes || 0))
    .slice(0, 10)
    .map((r) => ({
      text: r.response_text,
      likes: r.metadata?.likes || 0,
      platform: r.comments.platform,
      createdAt: r.created_at
    }));

  return {
    totalLikes,
    totalReplies,
    totalShares,
    viralRoasts: viralRoasts.length,
    engagementByPlatform,
    topRoasts
  };
}
```

### Safe Array Relationship Handling

When joining arrays or handling platform-specific data:

```sql
-- Safe array operations with existence checks
SELECT
  ae.id,
  ae.platform,
  COALESCE(
    ae.metadata->'platform_data',
    '{}'::jsonb
  ) as platform_data,
  CASE
    WHEN jsonb_typeof(ae.metadata->'tags') = 'array'
    THEN ae.metadata->'tags'
    ELSE '[]'::jsonb
  END as tags_array
FROM analytics_events ae
WHERE ae.organization_id = $1
  AND ae.metadata IS NOT NULL;
```

**Key safety checks**:

- COALESCE for missing JSONB fields
- jsonb_typeof to validate array types
- Explicit NULL checks before accessing nested fields

### 5. Shield Analytics

```javascript
async function getShieldAnalytics(organizationId, startDate, endDate) {
  // Get shield actions
  const { data: actions } = await supabase
    .from('shield_actions')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Action type breakdown
  const actionBreakdown = actions.reduce((acc, a) => {
    acc[a.action] = (acc[a.action] || 0) + 1;
    return acc;
  }, {});

  // Platform breakdown
  const actionsByPlatform = actions.reduce((acc, a) => {
    acc[a.platform] = (acc[a.platform] || 0) + 1;
    return acc;
  }, {});

  // Get recidivism data
  const { data: recidivism } = await supabase
    .from('user_behavior')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('updated_at', startDate);

  const recidivismRate = recidivism.filter((r) => r.total_warnings > 1).length / recidivism.length;

  // Calculate effectiveness
  const totalComments = await getTotalComments(organizationId, startDate, endDate);
  const moderationRate = (actions.length / totalComments) * 100;

  return {
    totalActions: actions.length,
    actionBreakdown,
    actionsByPlatform,
    recidivismRate,
    moderationRate,
    avgActionsPerDay: actions.length / ((endDate - startDate) / (24 * 60 * 60 * 1000))
  };
}
```

## AI-Powered Recommendations

### Generate Recommendations

```javascript
async function generateRecommendations(organizationId) {
  const recommendations = [];

  // Get analytics for last 30 days
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const costAnalytics = await getCostAnalytics(organizationId, startDate, endDate);
  const performanceAnalytics = await getPerformanceAnalytics(organizationId, startDate, endDate);
  const usageAnalytics = await getUsageAnalytics(organizationId, startDate, endDate);

  // Cost optimization recommendations
  if (costAnalytics.avgCostPerRoast > 10) {
    // > $0.10 per roast
    recommendations.push({
      type: 'cost_optimization',
      priority: 'high',
      title: 'Enable RQC to reduce failed generations',
      description: `Your average cost per roast ($${(costAnalytics.avgCostPerRoast / 100).toFixed(2)}) is higher than optimal. Enabling RQC can reduce failed generations by 15%, saving approximately $${((costAnalytics.totalCost * 0.15) / 100).toFixed(2)} per month.`,
      estimated_savings_cents: Math.floor(costAnalytics.totalCost * 0.15),
      actions: [{ action: 'enable_rqc', params: {} }]
    });
  }

  // Quality improvement recommendations
  if (performanceAnalytics.avgRQCScore < 0.7) {
    recommendations.push({
      type: 'quality_improvement',
      priority: 'critical',
      title: 'Improve roast quality with persona customization',
      description: `Your average quality score (${performanceAnalytics.avgRQCScore.toFixed(2)}) is below target. Customizing your persona can improve quality by 20-30%.`,
      estimated_quality_improvement: 0.25,
      actions: [{ action: 'customize_persona', params: {} }]
    });
  }

  // Engagement boost recommendations
  if (usageAnalytics.platformBreakdown.twitter > 0 && !usageAnalytics.platformBreakdown.youtube) {
    recommendations.push({
      type: 'engagement_boost',
      priority: 'medium',
      title: 'Expand to YouTube for higher engagement',
      description:
        'YouTube comments typically have 3x higher engagement than Twitter. Consider adding YouTube integration.',
      estimated_engagement_increase: 3.0,
      actions: [{ action: 'add_platform', params: { platform: 'youtube' } }]
    });
  }

  // Store recommendations
  for (const rec of recommendations) {
    await supabase.from('analytics_recommendations').insert({
      organization_id: organizationId,
      ...rec
    });
  }

  return recommendations;
}
```

## Dashboard API

### Analytics Dashboard Endpoint

```javascript
app.get('/api/organizations/:orgId/analytics/dashboard', async (req, res) => {
  const { orgId } = req.params;
  const { period = 30 } = req.query; // days

  const endDate = new Date();
  const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

  const [usage, performance, cost, engagement, shield, recommendations] = await Promise.all([
    getUsageAnalytics(orgId, startDate, endDate),
    getPerformanceAnalytics(orgId, startDate, endDate),
    getCostAnalytics(orgId, startDate, endDate),
    getEngagementAnalytics(orgId, startDate, endDate),
    getShieldAnalytics(orgId, startDate, endDate),
    getRecommendations(orgId)
  ]);

  res.json({
    period: { startDate, endDate, days: period },
    usage,
    performance,
    cost,
    engagement,
    shield,
    recommendations
  });
});
```

## Scheduled Jobs

### Daily Snapshot Generation

```javascript
// Cron job: daily at 00:00 UTC
async function generateDailySnapshots() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

  // Get all active organizations
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id')
    .eq('subscription_status', 'active');

  for (const org of organizations) {
    const usage = await getUsageAnalytics(org.id, startOfDay, endOfDay);
    const performance = await getPerformanceAnalytics(org.id, startOfDay, endOfDay);
    const cost = await getCostAnalytics(org.id, startOfDay, endOfDay);
    const engagement = await getEngagementAnalytics(org.id, startOfDay, endOfDay);

    // Create snapshot
    await supabase.from('analytics_snapshots').insert({
      organization_id: org.id,
      period_type: 'daily',
      period_start: startOfDay,
      period_end: endOfDay,
      total_roasts: usage.summary.totalRoasts,
      total_analyses: usage.summary.totalAnalyses,
      roasts_by_platform: usage.platformBreakdown,
      avg_rqc_score: performance.avgRQCScore,
      avg_response_time_ms: performance.avgResponseTime,
      user_approval_rate: performance.userApprovalRate,
      total_cost_cents: cost.totalCost,
      cost_by_operation: cost.costByOperation,
      total_likes: engagement.totalLikes,
      total_replies: engagement.totalReplies,
      total_shares: engagement.totalShares,
      viral_roasts: engagement.viralRoasts
    });
  }
}
```

## Testing

### Unit Tests

```javascript
describe('AnalyticsService', () => {
  test('calculates usage analytics correctly', async () => {
    const analytics = await getUsageAnalytics(orgId, startDate, endDate);

    expect(analytics.summary.totalRoasts).toBeGreaterThan(0);
    expect(analytics.platformBreakdown).toHaveProperty('twitter');
  });

  test('generates cost recommendations when cost is high', async () => {
    const recommendations = await generateRecommendations(highCostOrgId);

    const costRec = recommendations.find((r) => r.type === 'cost_optimization');
    expect(costRec).toBeDefined();
    expect(costRec.priority).toBe('high');
  });

  test('creates daily snapshots for all active organizations', async () => {
    await generateDailySnapshots();

    const { data: snapshots } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('period_type', 'daily')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

    expect(snapshots.length).toBeGreaterThan(0);
  });
});
```

## Error Handling

| Error                               | Cause                                | Resolution                          |
| ----------------------------------- | ------------------------------------ | ----------------------------------- |
| `Insufficient data`                 | < 1 day of usage data                | Return empty analytics with message |
| `Plan restriction`                  | Analytics not available on Free plan | Upgrade to Pro+ for analytics       |
| `Snapshot generation failed`        | Database error                       | Retry with exponential backoff      |
| `Recommendation generation timeout` | Complex calculations                 | Simplify recommendation logic       |

## Monitoring & Alerts

### Key Metrics

- **Snapshots generated** - Daily snapshot completion rate
- **Dashboard load time** - API response time for analytics
- **Recommendation accuracy** - % of recommendations applied by users
- **Data freshness** - Time since last snapshot

### Grafana Dashboard

```javascript
{
  daily_snapshots_generated: { type: 'counter', value: 1542 },
  dashboard_load_time_ms: { type: 'histogram', value: 450 },
  recommendation_application_rate: { type: 'gauge', value: 0.32 },
  data_freshness_hours: { type: 'gauge', value: 2 }
}
```

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Test Engineer**
- **Backend Developer**
- **Data Analyst**

## Related Nodes

- **multi-tenant** - Organization-scoped analytics
- **cost-control** - Cost data source
- **roast** - Roast performance metrics
- **shield** - Moderation analytics
- **plan-features** - Analytics feature gate (Pro+ only)

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Quarterly or on feature prioritization
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0 (Roadmap)
