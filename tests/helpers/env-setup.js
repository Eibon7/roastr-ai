/**
 * Environment Setup for Testing MVP
 * Issue #403 - Testing MVP
 */

// Set test environment variables before any modules are loaded
process.env.NODE_ENV = 'test';
process.env.ENABLE_MOCK_MODE = 'true';

// Database configuration
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost/dummy';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'dummy-service-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key';

// API keys for testing
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'mock-openai-key';
process.env.PERSPECTIVE_API_KEY = process.env.PERSPECTIVE_API_KEY || 'mock-perspective-key';

// Disable external integrations
process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-token';
process.env.YOUTUBE_API_KEY = 'mock-youtube-key';
process.env.INSTAGRAM_ACCESS_TOKEN = 'mock-instagram-token';
process.env.FACEBOOK_ACCESS_TOKEN = 'mock-facebook-token';

// Feature flags for testing
process.env.ENABLE_SHIELD = 'true';
process.env.ENABLE_RQC = 'false';
process.env.ENABLE_BILLING = 'true';
process.env.ENABLE_PERSPECTIVE_API = 'true';

// Logging configuration
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

console.log('Test environment variables configured');
