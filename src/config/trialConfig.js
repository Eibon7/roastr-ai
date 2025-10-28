/**
 * Trial Configuration
 * Issue #678: Free → Starter Trial Migration
 * 
 * Central configuration for trial periods, plan names, and trial-related constants.
 */

/**
 * Plan identifiers used across the application
 */
const PLAN_IDS = {
    STARTER_TRIAL: 'starter_trial',
    STARTER: 'starter',
    PRO: 'pro',
    PLUS: 'plus',
    CUSTOM: 'custom'
};

/**
 * Trial duration configuration
 */
const TRIAL_DURATION = {
    DEFAULT_DAYS: 30,
    MAX_DAYS: 90,
    MIN_DAYS: 7
};

/**
 * Trial status constants
 */
const TRIAL_STATUS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CONVERTED: 'converted',
    CANCELLED: 'cancelled',
    NONE: 'none'
};

/**
 * Plan pricing (in cents)
 * @type {Object.<string, {monthly: number, yearly: number}>}
 */
const PLAN_PRICING = {
    [PLAN_IDS.STARTER_TRIAL]: { monthly: 0, yearly: 0 },
    [PLAN_IDS.STARTER]: { monthly: 500, yearly: 5000 }, // €5/mo, €50/yr
    [PLAN_IDS.PRO]: { monthly: 1500, yearly: 15000 }, // €15/mo, €150/yr
    [PLAN_IDS.PLUS]: { monthly: 5000, yearly: 50000 } // €50/mo, €500/yr
};

/**
 * Default conversion plan when trial expires
 */
const DEFAULT_CONVERSION_PLAN = PLAN_IDS.STARTER;

module.exports = {
    PLAN_IDS,
    TRIAL_DURATION,
    TRIAL_STATUS,
    PLAN_PRICING,
    DEFAULT_CONVERSION_PLAN
};

