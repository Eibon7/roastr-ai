/**
 * Mock Mode Detection and Configuration
 * 
 * Automatically detects if Supabase environment variables are available
 * and enables mock mode when they're missing.
 */

/**
 * Check if Supabase environment variables are configured
 */
const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  
  return !!(supabaseUrl && supabaseAnonKey);
};

/**
 * Check if mock mode should be enabled
 * Priority:
 * 1. If Supabase variables are missing -> force mock mode
 * 2. If REACT_APP_ENABLE_MOCK_MODE is explicitly set -> respect it
 * 3. Default to false when everything is configured
 */
const isMockModeEnabled = () => {
  // If Supabase is not configured, force mock mode
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔄 Supabase environment variables not found - enabling mock mode automatically');
    }
    return true;
  }
  
  // If Supabase is configured, check explicit mock mode flag
  return process.env.REACT_APP_ENABLE_MOCK_MODE === 'true';
};

/**
 * Get mock mode status with detailed info
 */
const getMockModeStatus = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const mockModeForced = !supabaseConfigured;
  const mockModeExplicit = process.env.REACT_APP_ENABLE_MOCK_MODE === 'true';
  const mockModeEnabled = isMockModeEnabled();
  
  return {
    enabled: mockModeEnabled,
    supabaseConfigured,
    mockModeForced,
    mockModeExplicit,
    reason: mockModeForced 
      ? 'Missing Supabase environment variables'
      : mockModeExplicit 
        ? 'Explicitly enabled via REACT_APP_ENABLE_MOCK_MODE'
        : 'Disabled - using real Supabase client'
  };
};

/**
 * Log mock mode status for debugging
 */
const logMockModeStatus = () => {
  if (process.env.NODE_ENV === 'development') {
    const status = getMockModeStatus();
    console.log('🎭 Mock Mode Status:', status);
  }
};

export {
  isMockModeEnabled,
  isSupabaseConfigured,
  getMockModeStatus,
  logMockModeStatus
};