# Analytics Dashboard - User Guide

**Feature:** Analytics Dashboard  
**Issue:** [#715](https://github.com/Eibon7/roastr-ai/issues/715)  
**Route:** `/dashboard/analytics`  
**Access:** Requires `ENABLE_ANALYTICS_UI` feature flag

---

## Overview

The Analytics Dashboard provides comprehensive insights into your Roastr usage, including roasts generated, Shield actions, credits consumed, and billing metrics. All data is visualized with interactive charts and can be exported for further analysis.

---

## Accessing the Dashboard

1. **Navigate to Analytics:**
   - Click the "Analytics" icon in the sidebar (BarChart3 icon)
   - Or visit `/dashboard/analytics` directly

2. **Feature Flag:**
   - Ensure `ENABLE_ANALYTICS_UI` is enabled in your organization settings
   - Contact admin if the Analytics link is not visible

---

## Dashboard Sections

### 1. Summary Cards (Top Row)

Four key metrics displayed as cards:

- **Roasts generados:** Total roasts created in the selected time range
- **Análisis realizados:** Total toxicity analyses performed
- **Acciones Shield:** Total Shield moderation actions
- **Coste acumulado:** Total costs in your currency (EUR by default)

Each card shows:

- Current value
- Subtitle with additional context
- Trend indicator (if applicable)

### 2. Timeline Chart

**Location:** Top-left, large card

**Shows:**

- Roasts over time (orange line)
- Analyses over time (cyan line)
- Shield actions over time (red line)

**Controls:**

- **Range:** 7, 30, 90, or 365 days
- **Group By:** Day, Week, or Month

**Empty State:**

- Shows icon and message when no data available
- Suggests trying a different time range

### 3. Platform Distribution Chart

**Location:** Top-right, medium card

**Shows:**

- Distribution of activity across social media platforms
- Doughnut chart with color-coded segments

**Controls:**

- **Platform Filter:** All platforms or specific platform

**Empty State:**

- Shows icon when insufficient data

### 4. Shield Actions Panel

**Location:** Middle-left, large card

**Shows:**

- Total Shield actions
- Breakdown by action type (block, warn, etc.)
- Severity distribution (high, medium, low)
- Recent actions list with timestamps

### 5. Credits Usage Chart

**Location:** Middle-right, medium card

**Shows:**

- Bar chart of credits used by source (OpenAI, Perspective, etc.)
- Total credits consumed

**Empty State:**

- Shows wallet icon when no data

### 6. Billing Analytics Panel

**Location:** Bottom section

**Shows:**

- **Local Costs:** Costs tracked internally
- **Polar Integration:** Revenue and order data (if configured)
- **Currency:** Display currency (EUR default)

**Polar Status:**

- ✅ Available: Shows live billing data
- ❌ Not Available: Shows message to configure `POLAR_ACCESS_TOKEN`

---

## Filters and Controls

### Time Range

**Options:**

- Últimos 7 días
- Últimos 30 días
- Últimos 90 días
- Último año (365 días)

**Default:** 30 days

### Group By

**Options:**

- Diario (day)
- Semanal (week)
- Mensual (month)

**Default:** Day

**Impact:**

- Day: More granular, more data points
- Week: Balanced view
- Month: High-level overview

### Platform Filter

**Options:**

- Todas (all platforms)
- Specific platform (Twitter, YouTube, etc.)

**Default:** All

---

## Export Functionality

### Supported Formats

1. **CSV:** Comma-separated values (Excel-compatible)
2. **JSON:** Structured data format

### Supported Datasets

1. **Snapshots:** Analytics snapshots (default)
2. **Usage:** Usage records
3. **Events:** Analytics events

### How to Export

1. **Select Dataset:**
   - Choose from dropdown (Snapshots, Usage, Events)

2. **Click Export Button:**
   - Button shows format (CSV or JSON)
   - Click to download

3. **Download:**
   - File downloads automatically
   - Toast notification confirms success
   - Filename includes dataset and date range

### Export Permissions

**Allowed Plans:**

- ✅ Pro
- ✅ Plus
- ✅ Creator Plus
- ✅ Custom

**Blocked Plans:**

- ❌ Free
- ❌ Starter Trial
- ❌ Starter

**Error Message:**
If export is blocked, you'll see: "Tu plan no permite exportar analytics. Mejora a Pro o superior."

---

## Performance

### Loading States

- **Skeleton Loaders:** Shown while data is fetching
- **Loading Time:** Typically <2 seconds (cached) or 1-2 seconds (uncached)

### Caching

- Dashboard data is cached for 5 minutes
- Same parameters = instant response
- Cache automatically refreshes after TTL

### Optimization Tips

1. **Use appropriate ranges:** Smaller ranges = faster loads
2. **Leverage caching:** Don't refresh unnecessarily
3. **Use monthly grouping:** For longer ranges (fewer data points)

---

## Troubleshooting

### "No hay datos para el rango seleccionado"

**Causes:**

- No activity in selected time range
- Organization has no data yet
- Time range too narrow

**Solutions:**

- Try a longer time range
- Check that you have activity in the system
- Verify organization is correctly configured

### "Polar no disponible"

**Causes:**

- `POLAR_ACCESS_TOKEN` not configured
- Polar API unavailable
- Integration error

**Solutions:**

- Configure `POLAR_ACCESS_TOKEN` in environment
- Check Polar API status
- Review error logs

### "Export not allowed"

**Causes:**

- Plan doesn't support exports
- Analytics disabled for plan

**Solutions:**

- Upgrade to Pro or higher plan
- Contact support for plan upgrade

### Charts not loading

**Causes:**

- JavaScript errors
- Missing Chart.js dependencies
- Network issues

**Solutions:**

- Check browser console for errors
- Verify `chart.js` and `react-chartjs-2` are installed
- Refresh page

---

## Keyboard Navigation

- **Tab:** Navigate between filters and buttons
- **Enter/Space:** Activate selected control
- **Arrow Keys:** Navigate dropdown options

---

## Accessibility

### Screen Readers

All charts include `aria-label` attributes:

- Timeline chart: "Gráfico de línea mostrando timeline de roasts, análisis y acciones Shield a lo largo del tiempo"
- Platform chart: "Gráfico de dona mostrando distribución de actividad por plataforma social"
- Credits chart: "Gráfico de barras mostrando uso de créditos por período de tiempo"

### Color Contrast

- All text meets WCAG AA standards
- Charts use color-blind friendly palettes
- Icons supplement color information

---

## Best Practices

### For Data Analysis

1. **Start with 30-day view:** Good balance of detail and overview
2. **Use weekly grouping:** For 90+ day ranges
3. **Export regularly:** Keep historical data
4. **Compare time periods:** Export and compare in Excel/Sheets

### For Performance Monitoring

1. **Monitor response times:** Check average response time metric
2. **Track Shield actions:** Identify patterns in moderation
3. **Review costs:** Monitor cost trends over time

### For Billing

1. **Check Polar integration:** Ensure billing data is syncing
2. **Review revenue trends:** Use Polar analytics for revenue insights
3. **Export billing data:** Keep records for accounting

---

## Screenshots

_Note: Screenshots should be added to `docs/test-evidence/issue-715/screenshots/` after visual validation._

---

## API Reference

For API documentation, see [Analytics Dashboard API](api/analytics-dashboard.md).

---

## References

- **Issue #715:** https://github.com/Eibon7/roastr-ai/issues/715
- **PR #847:** https://github.com/Eibon7/roastr-ai/pull/847
- **API Docs:** `docs/api/analytics-dashboard.md`
