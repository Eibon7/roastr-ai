# Analytics Dashboard API Documentation

**Version:** 1.0.0  
**Base Path:** `/api/analytics`  
**Authentication:** Required (Bearer token)  
**Issue:** [#715](https://github.com/Eibon7/roastr-ai/issues/715)

---

## Overview

The Analytics Dashboard API provides comprehensive analytics data for roasts, Shield actions, credits usage, and billing metrics. All endpoints support multi-tenant filtering, caching, and plan-based access control.

---

## Authentication

All endpoints require authentication via Bearer token:

```http
Authorization: Bearer <token>
```

Tokens are obtained via the authentication system and stored in `localStorage` on the frontend.

---

## Rate Limiting

All analytics endpoints are rate-limited to prevent abuse:

- **Default:** 100 requests per 15 minutes per user
- **Plan-based:** Limits vary by subscription tier

---

## Endpoints

### 1. GET /api/analytics/dashboard

Get comprehensive dashboard analytics data with charts, summaries, and metrics.

#### Request

```http
GET /api/analytics/dashboard?range=30&group_by=day&platform=all
```

#### Query Parameters

| Parameter  | Type    | Default | Description                      |
| ---------- | ------- | ------- | -------------------------------- |
| `range`    | integer | `30`    | Number of days (7-365)           |
| `group_by` | string  | `day`   | Grouping: `day`, `week`, `month` |
| `platform` | string  | `all`   | Platform filter or `all`         |

#### Response

```json
{
  "success": true,
  "data": {
    "organizationId": "org-123",
    "planId": "pro",
    "timeframe": {
      "start": "2025-10-18T00:00:00.000Z",
      "end": "2025-11-17T23:59:59.999Z",
      "rangeDays": 30,
      "groupBy": "day"
    },
    "features": {
      "analyticsEnabled": true,
      "exportAllowed": true,
      "polarAvailable": true
    },
    "summary": {
      "totals": {
        "roasts": 42,
        "analyses": 10,
        "shieldActions": 5,
        "cost": 1234
      },
      "averages": {
        "response_time_ms": 120,
        "rqc_score": 0.8
      },
      "growth": {
        "roasts_pct": 5.2,
        "shield_pct": -2.1
      }
    },
    "charts": {
      "timeline": {
        "labels": ["2025-10-18", "2025-10-19", ...],
        "datasets": [
          {
            "label": "Roasts",
            "data": [10, 15, 12, ...],
            "borderColor": "#f97316"
          },
          {
            "label": "Análisis",
            "data": [5, 8, 6, ...],
            "borderColor": "#22d3ee"
          },
          {
            "label": "Acciones Shield",
            "data": [2, 3, 1, ...],
            "borderColor": "#ef4444"
          }
        ]
      },
      "platform": {
        "labels": ["Twitter", "YouTube", "Instagram"],
        "datasets": [{
          "data": [25, 15, 10],
          "backgroundColor": ["#f97316", "#22d3ee", "#a855f7"]
        }]
      },
      "credits": {
        "labels": ["OpenAI", "Perspective"],
        "datasets": [{
          "label": "Créditos usados",
          "data": [100, 50],
          "backgroundColor": ["#10b981", "#0ea5e9"]
        }]
      }
    },
    "shield": {
      "total_actions": 5,
      "actions_by_type": {
        "block": 2,
        "warn": 3
      },
      "severity_distribution": {
        "high": 1,
        "medium": 2,
        "low": 2
      },
      "recent": [
        {
          "id": "action-123",
          "action_type": "block",
          "severity": "high",
          "created_at": "2025-11-17T10:00:00Z"
        }
      ]
    },
    "credits": {
      "summary": {
        "total_used": 150,
        "by_source": {
          "openai": 100,
          "perspective": 50
        }
      }
    },
    "costs": {
      "total_cents": 1234,
      "currency": "EUR",
      "breakdown": {
        "api_calls": 800,
        "storage": 434
      }
    }
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Failed to retrieve dashboard analytics"
}
```

#### Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Plan doesn't allow analytics
- `500 Internal Server Error` - Server error

#### Caching

- **TTL:** 5 minutes
- **Key:** Based on user ID, range, group_by, and platform
- **LRU Eviction:** When cache exceeds 1000 entries

---

### 2. GET /api/analytics/billing

Get billing analytics with Polar integration and local cost tracking.

#### Request

```http
GET /api/analytics/billing?range=90
```

#### Query Parameters

| Parameter | Type    | Default | Description             |
| --------- | ------- | ------- | ----------------------- |
| `range`   | integer | `90`    | Number of days (30-365) |

#### Response

```json
{
  "success": true,
  "data": {
    "organizationId": "org-123",
    "planId": "pro",
    "timeframe": {
      "start": "2025-08-19T00:00:00.000Z",
      "end": "2025-11-17T23:59:59.999Z",
      "rangeDays": 90
    },
    "localCosts": {
      "total_cents": 5000,
      "currency": "EUR",
      "breakdown": {
        "api_calls": 3000,
        "storage": 2000
      }
    },
    "polar": {
      "available": true,
      "totals": {
        "orders": 10,
        "revenue_cents": 15000,
        "refunds_cents": 500
      },
      "currency": "EUR",
      "avg_order_cents": 1500,
      "recurring_orders": 8,
      "byProduct": {
        "pro_monthly": {
          "orders": 8,
          "revenue_cents": 12000
        },
        "plus_monthly": {
          "orders": 2,
          "revenue_cents": 3000
        }
      }
    }
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Failed to retrieve billing analytics"
}
```

#### Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Missing or invalid token
- `500 Internal Server Error` - Server error

#### Polar Fallback

If Polar is not configured or fails:

- `polar.available` = `false`
- `polar.message` = "Polar no está configurado. Se muestran métricas locales."
- Local costs are still returned

---

### 3. GET /api/analytics/export

Export analytics data as CSV or JSON file.

#### Request

```http
GET /api/analytics/export?format=csv&dataset=snapshots&range=90&locale=es-ES&timezone=UTC
```

#### Query Parameters

| Parameter  | Type    | Default     | Description                             |
| ---------- | ------- | ----------- | --------------------------------------- |
| `format`   | string  | `csv`       | Export format: `csv` or `json`          |
| `dataset`  | string  | `snapshots` | Dataset: `snapshots`, `usage`, `events` |
| `range`    | integer | `90`        | Number of days (7-365)                  |
| `locale`   | string  | `es-ES`     | Locale for date formatting              |
| `timezone` | string  | `UTC`       | Timezone for timestamps                 |

#### Response

**CSV Format:**

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="analytics-snapshots-2025-10-18-2025-11-17.csv"

id,created_at,organization_id,roasts_count,analyses_count,...
```

**JSON Format:**

```http
Content-Type: application/json
Content-Disposition: attachment; filename="analytics-snapshots-2025-10-18-2025-11-17.json"

{
  "dataset": "snapshots",
  "rows": [
    {
      "id": "snapshot-123",
      "created_at": "2025-11-17T10:00:00Z",
      "organization_id": "org-123",
      "roasts_count": 10,
      ...
    }
  ]
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Export failed: Plan does not allow exports"
}
```

#### Status Codes

- `200 OK` - Success (file stream)
- `400 Bad Request` - Invalid format or dataset
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Plan doesn't allow exports (Free/Starter)
- `500 Internal Server Error` - Server error

#### Plan Restrictions

**Export Allowed Plans:**

- ✅ Pro
- ✅ Plus
- ✅ Creator Plus
- ✅ Custom

**Export Blocked Plans:**

- ❌ Free
- ❌ Starter Trial
- ❌ Starter

---

## Usage Examples

### JavaScript/TypeScript

```javascript
// Get dashboard data
const response = await fetch('/api/analytics/dashboard?range=30&group_by=day&platform=all', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
const data = await response.json();

// Get billing analytics
const billingResponse = await fetch('/api/analytics/billing?range=90', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
const billingData = await billingResponse.json();

// Export CSV
const exportResponse = await fetch('/api/analytics/export?format=csv&dataset=snapshots&range=90', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
const blob = await exportResponse.blob();
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'analytics.csv';
link.click();
```

### cURL

```bash
# Dashboard
curl -X GET "http://localhost:3000/api/analytics/dashboard?range=30&group_by=day" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Billing
curl -X GET "http://localhost:3000/api/analytics/billing?range=90" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Export CSV
curl -X GET "http://localhost:3000/api/analytics/export?format=csv&dataset=snapshots&range=90" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o analytics.csv
```

---

## Data Models

### Dashboard Summary

```typescript
interface DashboardSummary {
  totals: {
    roasts: number;
    analyses: number;
    shieldActions: number;
    cost: number;
  };
  averages: {
    response_time_ms: number;
    rqc_score: number;
  };
  growth: {
    roasts_pct: number;
    shield_pct: number;
  };
}
```

### Chart Data

```typescript
interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string | string[];
  }>;
}
```

### Shield Statistics

```typescript
interface ShieldStats {
  total_actions: number;
  actions_by_type: Record<string, number>;
  severity_distribution: Record<string, number>;
  recent: Array<{
    id: string;
    action_type: string;
    severity: string;
    created_at: string;
  }>;
}
```

---

## Performance

### Caching Strategy

- **Dashboard endpoint:** 5-minute TTL with LRU eviction
- **Cache key:** SHA-256 hash of user ID + parameters
- **Max cache size:** 1000 entries

### Response Times

- **Target:** <2 seconds for dashboard data
- **Cached:** <100ms
- **Uncached:** 1-2 seconds (depends on data volume)

### Optimization Tips

1. Use appropriate `range` values (smaller = faster)
2. Leverage caching (same parameters = instant response)
3. Use `group_by=month` for longer ranges (fewer data points)

---

## Error Handling

### Common Errors

**401 Unauthorized:**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden (Export):**

```json
{
  "success": false,
  "error": "Export not allowed for your plan. Upgrade to Pro or higher."
}
```

**400 Bad Request:**

```json
{
  "success": false,
  "error": "Invalid range parameter. Must be between 7 and 365."
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "error": "Failed to retrieve dashboard analytics"
}
```

---

## Security

### Input Validation

- All parameters are validated and sanitized
- Integer parameters are clamped to valid ranges
- String parameters are length-limited
- SQL injection protection via parameterized queries

### Rate Limiting

- Prevents abuse and DoS attacks
- Plan-based limits (higher tiers = more requests)
- Automatic blocking after threshold

### Data Isolation

- Multi-tenant filtering via `organization_id`
- Row Level Security (RLS) policies enforced
- Users can only access their organization's data

---

## References

- **Issue #715:** https://github.com/Eibon7/roastr-ai/issues/715
- **PR #847:** https://github.com/Eibon7/roastr-ai/pull/847
- **Service:** `src/services/analyticsDashboardService.js`
- **Routes:** `src/routes/analytics.js`

---

## Changelog

### v1.0.0 (2025-11-17)

- Initial release
- Dashboard endpoint with charts and summaries
- Billing analytics with Polar integration
- CSV/JSON export functionality
- Caching and rate limiting
- Plan-based access control
