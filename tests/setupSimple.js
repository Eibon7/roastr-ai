/**
 * Simple CI Test Setup
 * Minimal setup for stable smoke tests only
 */

// Set test environment flags
process.env.NODE_ENV = 'test';
process.env.ENABLE_RQC = 'false';
process.env.SKIP_E2E = 'true';

// Mock environment variables for CI
const requiredEnvFlags = [
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY', 
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'PERSPECTIVE_API_KEY'
];

requiredEnvFlags.forEach(flag => {
  if (!process.env[flag]) {
    process.env[flag] = '';
  }
});

// Set dummy URLs
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost/dummy';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'dummy';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy';

console.log('🧪 Simple CI Setup: Running smoke tests only with mock environment');