// Default plan configurations for different environments
// These are used as fallbacks when actual data is not available
// Issue #841: Updated to match backend planService.js structure

export const PLAN_DEFAULTS = {
  starter_trial: {
    analysis_limit_monthly: 100,
    roast_limit_monthly: 5,
    plan_name: 'starter_trial',
    model: 'gpt-5.1',
    shield_enabled: true,
    rqc_mode: null
  },
  starter: {
    analysis_limit_monthly: 1000,
    roast_limit_monthly: 5,
    plan_name: 'starter',
    model: 'gpt-5.1',
    shield_enabled: true,
    rqc_mode: 'basic'
  },
  pro: {
    analysis_limit_monthly: 10000,
    roast_limit_monthly: 1000,
    plan_name: 'pro',
    model: 'gpt-5.1',
    shield_enabled: true,
    rqc_mode: 'basic'
  },
  plus: {
    analysis_limit_monthly: 100000,
    roast_limit_monthly: 5000,
    plan_name: 'plus',
    model: 'gpt-5.1',
    shield_enabled: true,
    rqc_mode: 'advanced'
  }
};

// Default usage for development/testing
export const DEFAULT_USAGE = {
  analysis_used: 0,
  roast_used: 0,
  costCents: 0
};

// Get default entitlements based on plan or environment
export function getDefaultEntitlements(planName = null) {
  // Check if we're in mock mode
  const isMockMode = process.env.REACT_APP_ENABLE_MOCK_MODE === 'true' || 
                     window.localStorage?.getItem('mockMode') === 'true';
  
  // In production or when plan is specified, use that plan's defaults
  if (planName && PLAN_DEFAULTS[planName]) {
    return PLAN_DEFAULTS[planName];
  }
  
  // Default to starter plan in development/mock mode
  if (isMockMode || process.env.NODE_ENV === 'development') {
    return PLAN_DEFAULTS.starter;
  }
  
  // Default to starter_trial plan in production when no plan specified
  return PLAN_DEFAULTS.starter_trial;
}

// Get default usage based on environment
export function getDefaultUsage() {
  const isMockMode = process.env.REACT_APP_ENABLE_MOCK_MODE === 'true' || 
                     window.localStorage?.getItem('mockMode') === 'true';
  
  // In mock/development mode, return some usage
  if (isMockMode || process.env.NODE_ENV === 'development') {
    return {
      analysis_used: 750,
      roast_used: 45,
      costCents: 1500
    };
  }
  
  // In production, return empty usage
  return DEFAULT_USAGE;
}