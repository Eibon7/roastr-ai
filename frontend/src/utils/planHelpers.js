/**
 * Plan normalization and helper functions
 * Issue #841: Centralized plan ID normalization for frontend
 */

/**
 * Normalize plan ID to current plan names
 * Maps legacy plan IDs to current plan structure:
 * - 'free' and 'basic' → 'starter_trial'
 * - 'creator_plus' → 'plus'
 * - unknown → 'starter_trial' (default fallback)
 *
 * @param {string} planId - Plan ID to normalize
 * @returns {string} Normalized plan ID
 */
export function normalizePlanId(planId) {
  if (!planId) return 'starter_trial';

  const normalized = planId.toLowerCase().trim();

  // Map legacy plans to current structure
  if (normalized === 'free' || normalized === 'basic') {
    return 'starter_trial';
  }

  if (normalized === 'creator_plus') {
    return 'plus';
  }

  // Valid current plans
  const validPlans = ['starter_trial', 'starter', 'pro', 'plus', 'custom'];
  if (validPlans.includes(normalized)) {
    return normalized;
  }

  // Unknown plan → default to starter_trial
  return 'starter_trial';
}

/**
 * Get display name for a plan
 * @param {string} planId - Plan ID
 * @returns {string} Display name
 */
export function getPlanDisplayName(planId) {
  const normalized = normalizePlanId(planId);
  const displayNames = {
    starter_trial: 'Starter Trial',
    starter: 'Starter',
    pro: 'Pro',
    plus: 'Plus',
    custom: 'Custom'
  };
  return displayNames[normalized] || 'Starter Trial';
}

/**
 * Get plan badge color classes
 * @param {string} planId - Plan ID
 * @returns {string} Tailwind CSS classes
 */
export function getPlanBadgeColor(planId) {
  const normalized = normalizePlanId(planId);
  const colors = {
    starter_trial: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    plus: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    custom: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300'
  };
  return colors[normalized] || colors.starter_trial;
}

/**
 * Check if plan is premium (Pro, Plus, or Custom)
 * @param {string} planId - Plan ID
 * @returns {boolean}
 */
export function isPremiumPlan(planId) {
  const normalized = normalizePlanId(planId);
  return ['pro', 'plus', 'custom'].includes(normalized);
}
