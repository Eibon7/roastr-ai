/**
 * Analytics Dashboard Service
 *
 * Service for aggregating and exporting analytics data for the dashboard UI.
 * Provides dashboard metrics, billing analytics with Polar integration, and
 * data export functionality (CSV/JSON).
 *
 * Features:
 * - Dashboard data aggregation (roasts, analyses, Shield actions, credits)
 * - Billing analytics with Polar SDK integration
 * - Data export with plan-based permissions
 * - Caching and performance optimization
 * - Multi-tenant data isolation
 *
 * Related Issues: #715
 * Related Nodes: analytics.md, cost-control.md, shield.md
 */

const { Polar } = require('@polar-sh/sdk');
const Papa = require('papaparse');

const { supabaseServiceClient } = require('../config/supabase');
const planLimitsService = require('./planLimitsService');
const { logger } = require('../utils/logger');

const PLATFORM_COLORS = [
    '#f97316', '#22d3ee', '#a855f7', '#10b981',
    '#ef4444', '#0ea5e9', '#eab308', '#14b8a6',
    '#fb7185', '#6366f1'
];

const EXPORT_ALLOWED_PLANS = new Set(['pro', 'plus', 'creator_plus', 'custom']);
const DEFAULT_PLAN = 'starter_trial';
const DEFAULT_CURRENCY = 'EUR';
const MAX_TIMELINE_POINTS = 365;
const MAX_USAGE_ROWS = 2000;
const MAX_SHIELD_ROWS = 1000;
const MAX_POLAR_PAGES = 5;
const MAX_POLAR_ORDERS = 250;

class AnalyticsPermissionError extends Error {
    constructor(message, statusCode = 403) {
        super(message);
        this.name = 'AnalyticsPermissionError';
        this.statusCode = statusCode;
    }
}

class AnalyticsDashboardService {
    /**
     * Initialize Analytics Dashboard Service
     * Sets up Polar client if POLAR_ACCESS_TOKEN is configured
     */
    constructor() {
        this.polarClient = null;
        if (process.env.POLAR_ACCESS_TOKEN) {
            try {
                this.polarClient = new Polar({
                    accessToken: process.env.POLAR_ACCESS_TOKEN
                });
            } catch (error) {
                logger.error('Polar client initialization failed', { error: error.message });
                this.polarClient = null;
            }
        }
    }

    /**
     * Get comprehensive dashboard analytics data
     *
     * @param {Object} params - Dashboard parameters
     * @param {Object} params.user - Authenticated user object (must have id and org_id)
     * @param {number} [params.rangeDays=30] - Number of days to analyze (7-365)
     * @param {string} [params.groupBy='day'] - Grouping: 'day', 'week', or 'month'
     * @param {string} [params.platformFilter='all'] - Platform filter or 'all'
     * @returns {Promise<Object>} Dashboard data with summary, charts, shield stats, credits, and costs
     * @throws {Error} If user is not authenticated or organization not found
     *
     * @example
     * const data = await analyticsDashboardService.getDashboardData({
     *   user: { id: 'user-123', org_id: 'org-456', plan: 'pro' },
     *   rangeDays: 30,
     *   groupBy: 'day',
     *   platformFilter: 'all'
     * });
     */
    async getDashboardData({ user, rangeDays = 30, groupBy = 'day', platformFilter = 'all' }) {
        const context = await this._resolveOrganizationContext(user);
        const planLimits = await planLimitsService.getPlanLimits(context.planId || DEFAULT_PLAN);

        const sanitizedRange = this._clampRange(rangeDays);
        const sanitizedGroupBy = this._sanitizeGroupBy(groupBy);
        const sanitizedPlatform = this._sanitizePlatform(platformFilter);

        const { startDate, endDate } = this._buildTimeframe(sanitizedRange);

        const [snapshots, usageRecords, shieldStats] = await Promise.all([
            this._fetchSnapshots(context.organizationId, startDate, endDate),
            this._fetchUsageRecords(context.organizationId, startDate, endDate),
            this._fetchShieldActions(context.organizationId, startDate, endDate, sanitizedPlatform)
        ]);

        const timeline = this._buildTimelineChart(snapshots, sanitizedGroupBy);
        const summary = this._buildSummary(snapshots, timeline);
        const platformChart = this._buildPlatformChart(snapshots, sanitizedPlatform);
        const credits = this._buildCredits(usageRecords, planLimits);
        const costs = this._buildCostOverview(snapshots, usageRecords, summary);

        return {
            organizationId: context.organizationId,
            planId: context.planId,
            timeframe: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                rangeDays: sanitizedRange,
                groupBy: sanitizedGroupBy
            },
            features: {
                analyticsEnabled: planLimits.analyticsEnabled !== false,
                exportAllowed: EXPORT_ALLOWED_PLANS.has(context.planId),
                polarAvailable: Boolean(this.polarClient)
            },
            summary,
            charts: {
                timeline: timeline.chart,
                platform: platformChart,
                credits: credits.chart
            },
            shield: shieldStats,
            credits: credits.summary,
            costs
        };
    }

    /**
     * Get billing analytics with Polar integration
     *
     * @param {Object} params - Billing analytics parameters
     * @param {Object} params.user - Authenticated user object (must have id and org_id)
     * @param {number} [params.rangeDays=90] - Number of days to analyze (30-365)
     * @returns {Promise<Object>} Billing data with local costs and Polar metrics
     * @throws {Error} If user is not authenticated or organization not found
     *
     * @example
     * const billing = await analyticsDashboardService.getBillingAnalytics({
     *   user: { id: 'user-123', org_id: 'org-456' },
     *   rangeDays: 90
     * });
     */
    async getBillingAnalytics({ user, rangeDays = 90 }) {
        const context = await this._resolveOrganizationContext(user);
        const sanitizedRange = this._clampRange(rangeDays);
        const { startDate, endDate } = this._buildTimeframe(sanitizedRange);

        const localCosts = await this._aggregateLocalBilling(context.organizationId, startDate, endDate);

        let polarSummary = {
            available: false,
            totals: {
                orders: 0,
                revenue_cents: 0,
                refunds_cents: 0
            },
            currency: localCosts.currency || DEFAULT_CURRENCY,
            avg_order_cents: 0,
            recurring_orders: 0,
            byProduct: {},
            message: 'Polar no está configurado. Se muestran métricas locales.'
        };

        if (this.polarClient) {
            try {
                polarSummary = await this._fetchPolarBilling(startDate, endDate);
            } catch (error) {
                logger.warn('Polar analytics fetch failed, using local data', { error: error.message });
                polarSummary = {
                    ...polarSummary,
                    error: 'No se pudo consultar Polar. Se muestran métricas locales.'
                };
            }
        }

        return {
            organizationId: context.organizationId,
            planId: context.planId,
            timeframe: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                rangeDays: sanitizedRange
            },
            localCosts,
            polar: polarSummary
        };
    }

    /**
     * Export analytics data as CSV or JSON
     *
     * @param {Object} params - Export parameters
     * @param {Object} params.user - Authenticated user object (must have id and org_id)
     * @param {string} [params.format='csv'] - Export format: 'csv' or 'json'
     * @param {string} [params.dataset='snapshots'] - Dataset: 'snapshots', 'usage', or 'events'
     * @param {number} [params.rangeDays=90] - Number of days to export (7-365)
     * @param {string} [params.locale='es-ES'] - Locale for date formatting
     * @param {string} [params.timezone='UTC'] - Timezone for timestamps
     * @returns {Promise<Object>} Export result with filename, contentType, and body
     * @throws {AnalyticsPermissionError} If format/dataset invalid, plan doesn't allow exports, or analytics disabled
     * @throws {Error} If user is not authenticated or organization not found
     *
     * @example
     * const export = await analyticsDashboardService.exportAnalytics({
     *   user: { id: 'user-123', org_id: 'org-456', plan: 'pro' },
     *   format: 'csv',
     *   dataset: 'snapshots',
     *   rangeDays: 90
     * });
     */
    async exportAnalytics({ user, format = 'csv', dataset = 'snapshots', rangeDays = 90, locale = 'es-ES', timezone = 'UTC' }) {
        const normalizedFormat = format.toLowerCase();
        if (!['csv', 'json'].includes(normalizedFormat)) {
            throw new AnalyticsPermissionError('Formato de exportación no soportado', 400);
        }

        const normalizedDataset = dataset.toLowerCase();
        if (!['snapshots', 'usage', 'events'].includes(normalizedDataset)) {
            throw new AnalyticsPermissionError('Dataset no soportado para exportación', 400);
        }

        const context = await this._resolveOrganizationContext(user);
        if (!EXPORT_ALLOWED_PLANS.has(context.planId)) {
            throw new AnalyticsPermissionError('Tu plan no permite exportar analytics. Mejora a Pro o superior.');
        }

        const planLimits = await planLimitsService.getPlanLimits(context.planId || DEFAULT_PLAN);
        if (planLimits.analyticsEnabled === false) {
            throw new AnalyticsPermissionError('Tu plan no tiene analytics habilitados.');
        }

        const sanitizedRange = this._clampRange(rangeDays);
        const { startDate, endDate } = this._buildTimeframe(sanitizedRange);

        let rows = [];
        if (normalizedDataset === 'usage') {
            rows = await this._fetchUsageRecords(context.organizationId, startDate, endDate);
        } else if (normalizedDataset === 'events') {
            rows = await this._fetchAnalyticsEvents(context.organizationId, startDate, endDate);
        } else {
            rows = await this._fetchSnapshots(context.organizationId, startDate, endDate);
        }

        const flattened = rows.map((row) => this._flattenRow(row, locale, timezone));
        const filename = `analytics-${normalizedDataset}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.${normalizedFormat}`;

        if (normalizedFormat === 'json') {
            return {
                filename,
                contentType: 'application/json',
                body: JSON.stringify({ dataset: normalizedDataset, rows: flattened }, null, 2)
            };
        }

        const csv = Papa.unparse(flattened);
        return {
            filename,
            contentType: 'text/csv; charset=utf-8',
            body: csv
        };
    }

    async _resolveOrganizationContext(user = {}) {
        if (!user || !user.id) {
            throw new Error('Usuario no autenticado');
        }

        if (user.org_id) {
            return {
                organizationId: user.org_id,
                planId: user.plan || DEFAULT_PLAN
            };
        }

        const { data, error } = await supabaseServiceClient
            .from('organizations')
            .select('id, plan_id')
            .eq('owner_id', user.id)
            .single();

        if (error || !data) {
            logger.error('Organization lookup failed for analytics', {
                userId: user.id,
                error: error?.message
            });
            throw new Error('No se encontró la organización del usuario');
        }

        return {
            organizationId: data.id,
            planId: data.plan_id || user.plan || DEFAULT_PLAN
        };
    }

    _clampRange(rangeDays) {
        const parsed = parseInt(rangeDays, 10);
        const safeValue = Number.isFinite(parsed) ? parsed : 30;
        return Math.max(7, Math.min(MAX_TIMELINE_POINTS, safeValue));
    }

    _sanitizeGroupBy(groupBy) {
        const normalized = typeof groupBy === 'string' ? groupBy.toLowerCase() : 'day';
        return ['day', 'week', 'month'].includes(normalized) ? normalized : 'day';
    }

    _sanitizePlatform(platform) {
        if (!platform) return 'all';
        const normalized = platform.toLowerCase();
        return normalized === 'all' ? 'all' : normalized;
    }

    _buildTimeframe(rangeDays) {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - rangeDays);
        return { startDate, endDate };
    }

    async _fetchSnapshots(orgId, startDate, endDate) {
        const { data, error } = await supabaseServiceClient
            .from('analytics_snapshots')
            .select('*')
            .eq('organization_id', orgId)
            .gte('period_start', startDate.toISOString())
            .lte('period_end', endDate.toISOString())
            .order('period_start', { ascending: true })
            .limit(MAX_TIMELINE_POINTS);

        if (error) {
            logger.error('Error fetching analytics_snapshots', { orgId, error: error.message });
            throw new Error('No se pudieron obtener los snapshots de analytics');
        }

        return data || [];
    }

    async _fetchUsageRecords(orgId, startDate, endDate) {
        const query = supabaseServiceClient
            .from('usage_records')
            .select('id, resource_type, quantity, cost_cents, created_at, metadata')
            .eq('organization_id', orgId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true })
            .limit(MAX_USAGE_ROWS);

        const { data, error } = await query;

        if (error) {
            logger.error('Usage records query failed', { orgId, error: error.message });
            throw new Error('No se pudo obtener el historial de uso');
        }

        return data || [];
    }

    async _fetchShieldActions(orgId, startDate, endDate, platform) {
        let query = supabaseServiceClient
            .from('shield_actions')
            .select('id, action_type, severity, platform, status, created_at')
            .eq('organization_id', orgId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(MAX_SHIELD_ROWS);

        if (platform !== 'all') {
            query = query.eq('platform', platform);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Shield analytics query failed', { orgId, error: error.message });
            return this._emptyShieldStats();
        }

        return this._buildShieldStats(data || []);
    }

    async _fetchAnalyticsEvents(orgId, startDate, endDate) {
        const { data, error } = await supabaseServiceClient
            .from('analytics_events')
            .select('id, event_type, event_category, metadata, platform, created_at, user_id')
            .eq('organization_id', orgId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true })
            .limit(MAX_USAGE_ROWS);

        if (error) {
            logger.error('Analytics events query failed', { orgId, error: error.message });
            throw new Error('No se pudieron obtener los eventos de analytics');
        }

        return data || [];
    }

    _buildTimelineChart(snapshots, groupBy) {
        const labels = [];
        const roasts = [];
        const analyses = [];
        const shieldActions = [];

        snapshots.forEach((snapshot) => {
            const label = this._formatLabel(snapshot.period_start || snapshot.period_end, groupBy);
            labels.push(label);
            roasts.push(this._toNumber(snapshot.total_roasts));
            analyses.push(this._toNumber(snapshot.total_analyses));
            shieldActions.push(this._toNumber(snapshot.total_shield_actions));
        });

        return {
            chart: {
                labels,
                datasets: [
                    {
                        label: 'Roasts generados',
                        data: roasts,
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    },
                    {
                        label: 'Análisis completados',
                        data: analyses,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderDash: [6, 4],
                        borderWidth: 2
                    },
                    {
                        label: 'Acciones Shield',
                        data: shieldActions,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    }
                ]
            },
            series: {
                roasts,
                analyses,
                shieldActions
            }
        };
    }

    _buildSummary(snapshots, timeline) {
        const totals = snapshots.reduce(
            (acc, snapshot) => ({
                roasts: acc.roasts + this._toNumber(snapshot.total_roasts),
                analyses: acc.analyses + this._toNumber(snapshot.total_analyses),
                shieldActions: acc.shieldActions + this._toNumber(snapshot.total_shield_actions),
                cost: acc.cost + this._toNumber(snapshot.total_cost_cents)
            }),
            { roasts: 0, analyses: 0, shieldActions: 0, cost: 0 }
        );

        const avgResponseTime = this._averageField(snapshots, 'avg_response_time_ms');
        const avgRqcScore = this._averageField(snapshots, 'avg_rqc_score');
        const approvalRate = this._averageField(snapshots, 'user_approval_rate');

        const roastsTrend = this._calculateTrend(timeline.series.roasts);
        const shieldTrend = this._calculateTrend(timeline.series.shieldActions);

        const highlights = [];
        if (roastsTrend > 0) {
            highlights.push(`Los roasts crecieron ${roastsTrend.toFixed(1)}% respecto al periodo anterior.`);
        }
        if (approvalRate) {
            highlights.push(`Tasa de aprobación media: ${approvalRate.toFixed(1)}%.`);
        }

        return {
            totals,
            averages: {
                response_time_ms: Math.round(avgResponseTime),
                rqc_score: avgRqcScore ? Number(avgRqcScore.toFixed(2)) : 0,
                approval_rate: approvalRate ? Number(approvalRate.toFixed(1)) : 0
            },
            growth: {
                roasts_pct: roastsTrend,
                shield_pct: shieldTrend
            },
            highlights
        };
    }

    _buildPlatformChart(snapshots, platformFilter) {
        const aggregated = {};
        snapshots.forEach((snapshot) => {
            const platformMap = snapshot.roasts_by_platform || {};
            Object.entries(platformMap).forEach(([platform, count]) => {
                if (platformFilter !== 'all' && platform !== platformFilter) {
                    return;
                }
                aggregated[platform] = (aggregated[platform] || 0) + (count || 0);
            });
        });

        const labels = Object.keys(aggregated);
        if (labels.length === 0) {
            return {
                labels: [],
                datasets: []
            };
        }

        return {
            labels,
            datasets: [
                {
                    label: 'Distribución por plataforma',
                    data: labels.map((label) => aggregated[label]),
                    backgroundColor: labels.map((_, index) => PLATFORM_COLORS[index % PLATFORM_COLORS.length]),
                    borderWidth: 0
                }
            ]
        };
    }

    _buildCredits(usageRecords, planLimits = {}) {
        const totals = {};
        usageRecords.forEach((record) => {
            const key = record.resource_type || record?.metadata?.resource_type || 'otros';
            if (!totals[key]) {
                totals[key] = { quantity: 0, cost_cents: 0 };
            }
            totals[key].quantity += this._toNumber(record.quantity);
            totals[key].cost_cents += this._toNumber(record.cost_cents);
        });

        const labels = Object.keys(totals);
        const chart = {
            labels,
            datasets: [
                {
                    label: 'Consumo de créditos',
                    data: labels.map((key) => totals[key].quantity),
                    backgroundColor: labels.map((_, index) => PLATFORM_COLORS[index % PLATFORM_COLORS.length])
                }
            ]
        };

        const limits = {
            roasts: planLimits.maxRoasts ?? null,
            analyses: planLimits.monthlyAnalysisLimit ?? null,
            platforms: planLimits.maxPlatforms ?? null,
            daily_api_calls: planLimits.dailyApiCallsLimit ?? null
        };

        return {
            summary: {
                totals,
                limits
            },
            chart
        };
    }

    _buildCostOverview(snapshots, usageRecords, summary) {
        const snapshotCost = snapshots.reduce((sum, snapshot) => sum + this._toNumber(snapshot.total_cost_cents), 0);
        const usageCost = usageRecords.reduce((sum, record) => sum + this._toNumber(record.cost_cents), 0);

        const totalRoasts = summary?.totals?.roasts || 0;
        const avgCostPerRoast = totalRoasts > 0 ? Math.round(snapshotCost / totalRoasts) : 0;

        return {
            total_snapshot_cents: snapshotCost,
            usage_cost_cents: usageCost,
            average_cost_per_roast: avgCostPerRoast || 0
        };
    }

    _buildShieldStats(records) {
        if (!records || records.length === 0) {
            return this._emptyShieldStats();
        }

        const actionsByType = {};
        const severityDistribution = {};
        const platformEffectiveness = {};

        records.forEach((action) => {
            const actionType = action.action_type || 'unknown';
            actionsByType[actionType] = (actionsByType[actionType] || 0) + 1;

            const severity = action.severity || 'unknown';
            severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;

            if (action.platform) {
                platformEffectiveness[action.platform] = (platformEffectiveness[action.platform] || 0) + 1;
            }
        });

        return {
            total_actions: records.length,
            actions_by_type: actionsByType,
            severity_distribution: severityDistribution,
            platform_distribution: platformEffectiveness,
            recent: records.slice(0, 5).map((record) => ({
                id: record.id,
                action_type: record.action_type,
                severity: record.severity,
                platform: record.platform,
                status: record.status,
                created_at: record.created_at
            }))
        };
    }

    _emptyShieldStats() {
        return {
            total_actions: 0,
            actions_by_type: {},
            severity_distribution: {},
            platform_distribution: {},
            recent: []
        };
    }

    async _aggregateLocalBilling(orgId, startDate, endDate) {
        const usageRecords = await this._fetchUsageRecords(orgId, startDate, endDate);
        const totalCost = usageRecords.reduce((sum, record) => sum + this._toNumber(record.cost_cents), 0);

        return {
            currency: DEFAULT_CURRENCY,
            total_cost_cents: totalCost,
            records: usageRecords.length
        };
    }

    async _fetchPolarBilling(startDate, endDate) {
        if (!this.polarClient) {
            return {
                available: false,
                totals: { orders: 0, revenue_cents: 0, refunds_cents: 0 },
                currency: DEFAULT_CURRENCY,
                avg_order_cents: 0,
                recurring_orders: 0,
                byProduct: {}
            };
        }

        const iterator = await this.polarClient.orders.list({
            limit: 50,
            sorting: ['-created_at']
        });

        const collected = [];
        let pageCount = 0;
        let finished = false;

        for await (const page of iterator) {
            pageCount += 1;
            const items = page?.result?.items || [];
            for (const order of items) {
                const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
                if (createdAt && createdAt < startDate) {
                    finished = true;
                    break;
                }
                if (createdAt && createdAt <= endDate) {
                    collected.push(order);
                }
                if (collected.length >= MAX_POLAR_ORDERS) {
                    finished = true;
                    break;
                }
            }

            if (finished || pageCount >= MAX_POLAR_PAGES) {
                break;
            }
        }

        const paidOrders = collected.filter((order) => order.paid);
        const revenue = paidOrders.reduce((sum, order) => sum + this._toNumber(order.totalAmount), 0);
        const refunds = paidOrders.reduce((sum, order) => sum + this._toNumber(order.refundedAmount), 0);
        const recurring = paidOrders.filter((order) => order.subscriptionId).length;

        const byProduct = {};
        paidOrders.forEach((order) => {
            const key = order?.product?.name || order.productId || 'Desconocido';
            if (!byProduct[key]) {
                byProduct[key] = { orders: 0, revenue_cents: 0 };
            }
            byProduct[key].orders += 1;
            byProduct[key].revenue_cents += this._toNumber(order.totalAmount);
        });

        return {
            available: true,
            totals: {
                orders: paidOrders.length,
                revenue_cents: revenue,
                refunds_cents: refunds
            },
            currency: paidOrders[0]?.currency || DEFAULT_CURRENCY,
            avg_order_cents: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
            recurring_orders: recurring,
            byProduct
        };
    }

    _flattenRow(row, locale, timezone) {
        const flat = {};
        Object.entries(row || {}).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                flat[key] = '';
            } else if (value instanceof Date) {
                flat[key] = value.toISOString();
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                Object.entries(value || {}).forEach(([childKey, childValue]) => {
                    const nestedKey = `${key}.${childKey}`;
                    if (childValue instanceof Date) {
                        flat[nestedKey] = childValue.toISOString();
                    } else if (typeof childValue === 'number' && Number.isFinite(childValue)) {
                        flat[nestedKey] = childValue;
                    } else if (childValue && typeof childValue === 'object') {
                        flat[nestedKey] = JSON.stringify(childValue);
                    } else {
                        flat[nestedKey] = childValue ?? '';
                    }
                });
            } else if (typeof value === 'number' && Number.isFinite(value)) {
                flat[key] = value;
            } else {
                flat[key] = value;
            }
        });

        flat['export_locale'] = locale;
        flat['export_timezone'] = timezone;

        return flat;
    }

    _formatLabel(dateInput, groupBy) {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) return '';

        if (groupBy === 'month') {
            return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        }

        if (groupBy === 'week') {
            const weekNumber = this._getWeekNumber(date);
            return `Sem ${weekNumber} ${date.getFullYear()}`;
        }

        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }

    _getWeekNumber(date) {
        const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = tempDate.getUTCDay() || 7;
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        return Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
    }

    _toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    _averageField(rows, field) {
        if (!rows || rows.length === 0) return 0;
        const validValues = rows
            .map((row) => this._toNumber(row[field]))
            .filter((value) => Number.isFinite(value) && value > 0);

        if (validValues.length === 0) return 0;
        const sum = validValues.reduce((total, value) => total + value, 0);
        return sum / validValues.length;
    }

    _calculateTrend(series = []) {
        if (!series || series.length < 2) return 0;
        const latest = series[series.length - 1];
        const previous = series[series.length - 2] || 0;
        if (previous === 0) {
            return latest > 0 ? 100 : 0;
        }
        return ((latest - previous) / previous) * 100;
    }
}

module.exports = new AnalyticsDashboardService();
module.exports.AnalyticsPermissionError = AnalyticsPermissionError;

