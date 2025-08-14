// Load test environment variables
const fs = require('fs');
const path = require('path');

// Try to load .env.test.real for local development (not committed)
const envPath = path.resolve(__dirname, '../../../.env.test.real');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ Loaded .env.test.real for integration tests');
} else {
  console.log('ℹ️  No .env.test.real found, using environment variables');
}

// Set test environment
process.env.NODE_ENV = 'test';