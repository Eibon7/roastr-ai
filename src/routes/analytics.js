const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/analytics/config-performance
 * Get performance analytics for platform configurations
 */
router.get('/config-performance', async (req, res) => {
    try {
        const { user } = req;
        const { 
            days = 30, 
            platform = null, 
            group_by = 'day' // day, week, month
        } = req.query;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

        // Get response data with engagement metrics
        let query = supabaseServiceClient
            .from('responses')
            .select(`
                id,
                tone,
                humor_type,
                created_at,
                post_status,
                platform_response_id,
                tokens_used,
                cost_cents,
                comments!inner (
                    platform,
                    toxicity_score,
                    severity_level,
                    created_at
                )
            `)
            .eq('organization_id', orgData.id)
            .gte('created_at', dateThreshold.toISOString());

        if (platform) {
            query = query.eq('comments.platform', platform);
        }

        const { data: responses, error } = await query;

        if (error) {
            throw error;
        }

        // Calculate performance metrics
        const analytics = {
            summary: {
                total_responses: responses.length,
                successful_posts: responses.filter(r => r.platform_response_id).length,
                total_cost_cents: responses.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
                total_tokens: responses.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
                avg_toxicity_score: responses.length > 0 
                    ? (responses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) / responses.length).toFixed(3)
                    : 0
            },
            by_tone: {},
            by_humor_type: {},
            by_platform: {},
            by_severity: {},
            timeline: []
        };

        // Group by tone
        const toneGroups = responses.reduce((acc, r) => {
            const tone = r.tone || 'unknown';
            if (!acc[tone]) {
                acc[tone] = [];
            }
            acc[tone].push(r);
            return acc;
        }, {});

        Object.entries(toneGroups).forEach(([tone, toneResponses]) => {
            analytics.by_tone[tone] = {
                count: toneResponses.length,
                success_rate: toneResponses.length > 0 
                    ? ((toneResponses.filter(r => r.platform_response_id).length / toneResponses.length) * 100).toFixed(1)
                    : 0,
                avg_cost_cents: toneResponses.length > 0 
                    ? (toneResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0) / toneResponses.length).toFixed(2)
                    : 0,
                avg_tokens: toneResponses.length > 0 
                    ? Math.round(toneResponses.reduce((sum, r) => sum + (r.tokens_used || 0), 0) / toneResponses.length)
                    : 0
            };
        });

        // Group by humor type
        const humorGroups = responses.reduce((acc, r) => {
            const humor = r.humor_type || 'unknown';
            if (!acc[humor]) {
                acc[humor] = [];
            }
            acc[humor].push(r);
            return acc;
        }, {});

        Object.entries(humorGroups).forEach(([humor, humorResponses]) => {
            analytics.by_humor_type[humor] = {
                count: humorResponses.length,
                success_rate: humorResponses.length > 0 
                    ? ((humorResponses.filter(r => r.platform_response_id).length / humorResponses.length) * 100).toFixed(1)
                    : 0,
                avg_cost_cents: humorResponses.length > 0 
                    ? (humorResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0) / humorResponses.length).toFixed(2)
                    : 0
            };
        });

        // Group by platform
        const platformGroups = responses.reduce((acc, r) => {
            const platform = r.comments.platform;
            if (!acc[platform]) {
                acc[platform] = [];
            }
            acc[platform].push(r);
            return acc;
        }, {});

        Object.entries(platformGroups).forEach(([platform, platformResponses]) => {
            analytics.by_platform[platform] = {
                count: platformResponses.length,
                success_rate: platformResponses.length > 0 
                    ? ((platformResponses.filter(r => r.platform_response_id).length / platformResponses.length) * 100).toFixed(1)
                    : 0,
                avg_toxicity: platformResponses.length > 0 
                    ? (platformResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) / platformResponses.length).toFixed(3)
                    : 0
            };
        });

        // Group by severity level
        const severityGroups = responses.reduce((acc, r) => {
            const severity = r.comments.severity_level || 'unknown';
            if (!acc[severity]) {
                acc[severity] = [];
            }
            acc[severity].push(r);
            return acc;
        }, {});

        Object.entries(severityGroups).forEach(([severity, severityResponses]) => {
            analytics.by_severity[severity] = {
                count: severityResponses.length,
                percentage: responses.length > 0 
                    ? ((severityResponses.length / responses.length) * 100).toFixed(1)
                    : 0
            };
        });

        // Create timeline data
        const timeGroups = responses.reduce((acc, r) => {
            let dateKey;
            const date = new Date(r.created_at);
            
            if (group_by === 'week') {
                // Get start of week (Sunday)
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                dateKey = weekStart.toISOString().split('T')[0];
            } else if (group_by === 'month') {
                dateKey = date.toISOString().substr(0, 7); // YYYY-MM
            } else {
                dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            }
            
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(r);
            return acc;
        }, {});

        Object.entries(timeGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([date, timeResponses]) => {
                analytics.timeline.push({
                    date,
                    count: timeResponses.length,
                    successful_posts: timeResponses.filter(r => r.platform_response_id).length,
                    total_cost_cents: timeResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
                    avg_toxicity: timeResponses.length > 0 
                        ? (timeResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) / timeResponses.length).toFixed(3)
                        : 0
                });
            });

        res.status(200).json({
            success: true,
            data: {
                period_days: parseInt(days),
                platform_filter: platform,
                group_by,
                analytics
            }
        });

    } catch (error) {
        logger.error('Get config performance analytics error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance analytics'
        });
    }
});

/**
 * GET /api/analytics/shield-effectiveness  
 * Get Shield system effectiveness analytics
 */
router.get('/shield-effectiveness', async (req, res) => {
    try {
        const { user } = req;
        const { days = 30 } = req.query;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

        // Get Shield actions and user behaviors
        const [shieldActionsResult, userBehaviorsResult] = await Promise.all([
            // Get Shield responses (responses with shield actions)
            supabaseServiceClient
                .from('responses')
                .select('*')
                .eq('organization_id', orgData.id)
                .eq('is_shield_mode', true)
                .gte('created_at', dateThreshold.toISOString()),
            
            // Get user behavior data
            supabaseServiceClient
                .from('user_behaviors')
                .select('*')
                .eq('organization_id', orgData.id)
                .gte('last_seen_at', dateThreshold.toISOString())
        ]);

        if (shieldActionsResult.error) throw shieldActionsResult.error;
        if (userBehaviorsResult.error) throw userBehaviorsResult.error;

        const shieldResponses = shieldActionsResult.data;
        const userBehaviors = userBehaviorsResult.data;

        // Calculate Shield effectiveness metrics
        const shieldAnalytics = {
            total_shield_actions: shieldResponses.length,
            actions_by_type: {},
            platform_effectiveness: {},
            user_reincidence: {
                total_tracked_users: userBehaviors.length,
                blocked_users: userBehaviors.filter(u => u.is_blocked).length,
                repeat_offenders: userBehaviors.filter(u => u.total_violations > 3).length,
                avg_violations_per_user: userBehaviors.length > 0 
                    ? (userBehaviors.reduce((sum, u) => sum + u.total_violations, 0) / userBehaviors.length).toFixed(1)
                    : 0
            },
            severity_distribution: {},
            action_success_rate: 0
        };

        // Group Shield actions by type
        const actionGroups = shieldResponses.reduce((acc, r) => {
            const action = r.shield_action || 'unknown';
            if (!acc[action]) {
                acc[action] = 0;
            }
            acc[action]++;
            return acc;
        }, {});

        shieldAnalytics.actions_by_type = actionGroups;

        // Calculate severity distribution from user behaviors
        userBehaviors.forEach(user => {
            const severityCounts = user.severity_counts || { low: 0, medium: 0, high: 0, critical: 0 };
            Object.entries(severityCounts).forEach(([severity, count]) => {
                if (!shieldAnalytics.severity_distribution[severity]) {
                    shieldAnalytics.severity_distribution[severity] = 0;
                }
                shieldAnalytics.severity_distribution[severity] += count;
            });
        });

        // Calculate platform effectiveness
        const platformGroups = userBehaviors.reduce((acc, user) => {
            if (!acc[user.platform]) {
                acc[user.platform] = {
                    total_users: 0,
                    blocked_users: 0,
                    total_violations: 0
                };
            }
            acc[user.platform].total_users++;
            if (user.is_blocked) {
                acc[user.platform].blocked_users++;
            }
            acc[user.platform].total_violations += user.total_violations;
            return acc;
        }, {});

        Object.entries(platformGroups).forEach(([platform, data]) => {
            shieldAnalytics.platform_effectiveness[platform] = {
                ...data,
                block_rate: data.total_users > 0 ? ((data.blocked_users / data.total_users) * 100).toFixed(1) : 0,
                avg_violations: data.total_users > 0 ? (data.total_violations / data.total_users).toFixed(1) : 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                period_days: parseInt(days),
                shield_analytics: shieldAnalytics
            }
        });

    } catch (error) {
        logger.error('Get Shield effectiveness analytics error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve Shield effectiveness analytics'
        });
    }
});

/**
 * GET /api/analytics/usage-trends
 * Get usage trends and forecasting data
 */
router.get('/usage-trends', async (req, res) => {
    try {
        const { user } = req;
        const { months = 6 } = req.query;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id, monthly_responses_limit')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        // Get monthly usage data
        const { data: monthlyUsage, error } = await supabaseServiceClient
            .from('monthly_usage')
            .select('*')
            .eq('organization_id', orgData.id)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(parseInt(months));

        if (error) {
            throw error;
        }

        // Calculate trends
        const trends = {
            monthly_data: monthlyUsage.map(usage => ({
                period: `${usage.year}-${String(usage.month).padStart(2, '0')}`,
                total_responses: usage.total_responses,
                limit: usage.responses_limit,
                utilization_rate: usage.responses_limit > 0 
                    ? ((usage.total_responses / usage.responses_limit) * 100).toFixed(1)
                    : 0,
                total_cost_cents: usage.total_cost_cents,
                limit_exceeded: usage.limit_exceeded,
                responses_by_platform: usage.responses_by_platform || {}
            })),
            current_limit: orgData.monthly_responses_limit,
            growth_rate: 0,
            projected_usage: 0
        };

        // Calculate growth rate (if we have at least 2 months of data)
        if (monthlyUsage.length >= 2) {
            const currentMonth = monthlyUsage[0];
            const previousMonth = monthlyUsage[1];
            
            if (previousMonth.total_responses > 0) {
                trends.growth_rate = (
                    ((currentMonth.total_responses - previousMonth.total_responses) / previousMonth.total_responses) * 100
                ).toFixed(1);
            }

            // Simple projection for next month based on growth rate
            trends.projected_usage = Math.round(
                currentMonth.total_responses * (1 + (parseFloat(trends.growth_rate) / 100))
            );
        }

        res.status(200).json({
            success: true,
            data: {
                period_months: parseInt(months),
                trends
            }
        });

    } catch (error) {
        logger.error('Get usage trends analytics error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve usage trends'
        });
    }
});

module.exports = router;