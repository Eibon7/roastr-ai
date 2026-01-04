/**
 * Feature Flag Hook
 * 
 * Simple hook to check if a feature flag is enabled.
 * Reads from environment variables.
 * 
 * TODO: Replace with proper feature flag system (LaunchDarkly, etc.) when needed
 */

export const useFeatureFlag = (flagName: string): boolean => {
  // Check environment variable
  const envVar = `REACT_APP_${flagName}`;
  const value = process.env[envVar];
  
  // Return true if explicitly set to 'true', false otherwise
  return value === 'true';
};
