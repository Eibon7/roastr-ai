/**
 * Revenue dashboard routes for admin analytics
 * Provides MRR, churn, and billing insights for administrators
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const Stripe = require('stripe');
const { flags } = require('../config/flags');

const router = express.Router();

// Initialize Stripe
let stripe = null;
if (flags.isEnabled('ENABLE_BILLING')) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Middleware to check admin access
 */
const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Check if user is admin
        const { data: user, error } = await supabaseServiceClient
            .from('users')
            .select('is_admin')
            .eq('id', userId)
            .single();

        if (error || !user?.is_admin) {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        next();
    } catch (error) {
        logger.error('Admin check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify admin access'
        });
    }
};

/**
 * GET /api/admin/revenue/overview
 * Get revenue overview with MRR, total customers, and growth metrics
 */
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period) || 30;
        
        // Date range for comparison
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

        // Get current period subscriptions
        const { data: currentSubs, error: currentError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, created_at, current_period_start, current_period_end')
            .gte('created_at', startDate.toISOString())
            .neq('plan', 'free');

        if (currentError) {
            throw currentError;
        }

        // Get previous period for comparison
        const { data: previousSubs, error: previousError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, created_at')
            .gte('created_at', previousStartDate.toISOString())
            .lt('created_at', startDate.toISOString())
            .neq('plan', 'free');

        if (previousError) {
            throw previousError;
        }

        // Get all active subscriptions for MRR calculation
        const { data: activeSubs, error: activeError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, current_period_start, current_period_end')
            .eq('status', 'active')
            .neq('plan', 'free');

        if (activeError) {
            throw activeError;
        }

        // Plan pricing (in cents)
        const planPricing = {
            pro: 2000,      // €20.00
            creator_plus: 5000  // €50.00
        };

        // Calculate MRR
        const mrr = activeSubs.reduce((total, sub) => {
            const price = planPricing[sub.plan] || 0;
            return total + price;
        }, 0);

        // Calculate metrics
        const currentCustomers = currentSubs.length;
        const previousCustomers = previousSubs.length;
        const customerGrowth = previousCustomers > 0 
            ? ((currentCustomers - previousCustomers) / previousCustomers * 100)
            : 0;

        const currentRevenue = currentSubs.reduce((total, sub) => {
            return total + (planPricing[sub.plan] || 0);
        }, 0);

        const previousRevenue = previousSubs.reduce((total, sub) => {
            return total + (planPricing[sub.plan] || 0);
        }, 0);

        const revenueGrowth = previousRevenue > 0 
            ? ((currentRevenue - previousRevenue) / previousRevenue * 100)
            : 0;

        // Plan distribution
        const planDistribution = activeSubs.reduce((dist, sub) => {
            dist[sub.plan] = (dist[sub.plan] || 0) + 1;
            return dist;
        }, {});

        // Get Stripe data if available
        let stripeMetrics = null;
        if (stripe) {
            try {
                const stripeCustomers = await stripe.customers.list({ 
                    limit: 100,
                    created: { gte: Math.floor(startDate.getTime() / 1000) }
                });
                
                const stripeSubscriptions = await stripe.subscriptions.list({ 
                    limit: 100,
                    status: 'active',
                    created: { gte: Math.floor(startDate.getTime() / 1000) }
                });

                stripeMetrics = {
                    totalCustomers: stripeCustomers.data.length,
                    activeSubscriptions: stripeSubscriptions.data.length
                };
            } catch (stripeError) {
                logger.warn('Failed to fetch Stripe metrics:', stripeError);
            }
        }

        const overview = {
            mrr: {
                current: Math.round(mrr / 100), // Convert to euros
                currency: 'EUR'
            },
            customers: {
                total: activeSubs.length,
                new: currentCustomers,
                growth: Math.round(customerGrowth * 100) / 100
            },
            revenue: {
                current: Math.round(currentRevenue / 100),
                previous: Math.round(previousRevenue / 100),
                growth: Math.round(revenueGrowth * 100) / 100,
                currency: 'EUR'
            },
            planDistribution,
            stripe: stripeMetrics,
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: now.toISOString()
            }
        };

        res.json({
            success: true,
            data: overview
        });

    } catch (error) {
        logger.error('Error fetching revenue overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch revenue overview'
        });
    }
});

/**
 * GET /api/admin/revenue/churn
 * Get churn rate and retention metrics
 */
router.get('/churn', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period) || 30;
        
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get subscriptions that started before the period
        const { data: cohortSubs, error: cohortError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('user_id, plan, status, created_at, updated_at')
            .lt('created_at', startDate.toISOString())
            .neq('plan', 'free');

        if (cohortError) {
            throw cohortError;
        }

        // Get subscriptions that were canceled during the period
        const { data: canceledSubs, error: canceledError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('user_id, plan, status, created_at, updated_at')
            .eq('status', 'canceled')
            .gte('updated_at', startDate.toISOString())
            .neq('plan', 'free');

        if (canceledError) {
            throw canceledError;
        }

        // Calculate churn rate
        const cohortSize = cohortSubs.length;
        const churned = canceledSubs.length;
        const churnRate = cohortSize > 0 ? (churned / cohortSize * 100) : 0;

        // Calculate retention rate
        const retained = cohortSize - churned;
        const retentionRate = cohortSize > 0 ? (retained / cohortSize * 100) : 100;

        // Churn by plan
        const churnByPlan = canceledSubs.reduce((churn, sub) => {
            churn[sub.plan] = (churn[sub.plan] || 0) + 1;
            return churn;
        }, {});

        // Cohort analysis - group by creation month
        const cohortAnalysis = cohortSubs.reduce((cohorts, sub) => {
            const month = new Date(sub.created_at).toISOString().substring(0, 7); // YYYY-MM
            if (!cohorts[month]) {
                cohorts[month] = { total: 0, active: 0, churned: 0 };
            }
            cohorts[month].total++;
            if (sub.status === 'active') {
                cohorts[month].active++;
            } else {
                cohorts[month].churned++;
            }
            return cohorts;
        }, {});

        // Calculate average customer lifetime (in months)
        const avgLifetime = cohortSize > 0 ? 
            cohortSubs.reduce((total, sub) => {
                const createdAt = new Date(sub.created_at);
                const endDate = sub.status === 'canceled' ? new Date(sub.updated_at) : now;
                const lifetimeMonths = (endDate - createdAt) / (1000 * 60 * 60 * 24 * 30);
                return total + lifetimeMonths;
            }, 0) / cohortSize : 0;

        const churnMetrics = {
            churnRate: Math.round(churnRate * 100) / 100,
            retentionRate: Math.round(retentionRate * 100) / 100,
            churned: {
                total: churned,
                byPlan: churnByPlan
            },
            cohort: {
                size: cohortSize,
                retained: retained
            },
            avgCustomerLifetime: Math.round(avgLifetime * 100) / 100,
            cohortAnalysis,
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: now.toISOString()
            }
        };

        res.json({
            success: true,
            data: churnMetrics
        });

    } catch (error) {
        logger.error('Error fetching churn metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch churn metrics'
        });
    }
});

/**
 * GET /api/admin/revenue/trends
 * Get revenue trends over time with chart data
 */
router.get('/trends', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { period = '90', granularity = 'week' } = req.query;
        const days = parseInt(period) || 90;
        
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get all subscription events in the period
        const { data: subscriptions, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, created_at, updated_at')
            .gte('created_at', startDate.toISOString())
            .neq('plan', 'free');

        if (error) {
            throw error;
        }

        // Group by time period
        const timeFormat = granularity === 'day' ? 10 : granularity === 'week' ? 10 : 7; // YYYY-MM-DD or YYYY-MM
        const trends = {};

        subscriptions.forEach(sub => {
            const date = sub.created_at.substring(0, timeFormat);
            
            if (!trends[date]) {
                trends[date] = {
                    newSubscriptions: 0,
                    revenue: 0,
                    churn: 0
                };
            }

            trends[date].newSubscriptions++;
            
            // Add revenue (monthly)
            const planRevenue = sub.plan === 'pro' ? 20 : sub.plan === 'creator_plus' ? 50 : 0;
            trends[date].revenue += planRevenue;

            // Track churn if applicable
            if (sub.status === 'canceled') {
                trends[date].churn++;
            }
        });

        // Sort by date and fill missing periods
        const sortedDates = Object.keys(trends).sort();
        const chartData = sortedDates.map(date => ({
            date,
            newSubscriptions: trends[date].newSubscriptions,
            revenue: trends[date].revenue,
            churn: trends[date].churn,
            netGrowth: trends[date].newSubscriptions - trends[date].churn
        }));

        res.json({
            success: true,
            data: {
                trends: chartData,
                summary: {
                    totalRevenue: chartData.reduce((sum, item) => sum + item.revenue, 0),
                    totalNewSubs: chartData.reduce((sum, item) => sum + item.newSubscriptions, 0),
                    totalChurn: chartData.reduce((sum, item) => sum + item.churn, 0),
                    netGrowth: chartData.reduce((sum, item) => sum + item.netGrowth, 0)
                },
                period: {
                    days,
                    granularity,
                    startDate: startDate.toISOString(),
                    endDate: now.toISOString()
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching revenue trends:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch revenue trends'
        });
    }
});

module.exports = router;