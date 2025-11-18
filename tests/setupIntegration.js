/**
 * Test setup file for REAL integration tests
 * Loads Supabase credentials safely for local + worktree setups
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

const loadedEnvFiles = new Set();

function safelyLoadEnvFile(envPath) {
  if (!envPath) return;
  const absolutePath = path.isAbsolute(envPath)
    ? envPath
    : path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(absolutePath)) return;

  dotenv.config({ path: absolutePath, override: false });
  loadedEnvFiles.add(absolutePath);
}

const explicitEnv =
  process.env.TEST_ENV_FILE ||
  process.env.SUPABASE_TEST_ENV_FILE ||
  process.env.SUPABASE_ENV_FILE;
safelyLoadEnvFile(explicitEnv);

const envCandidates = [
  '.env.test.local',
  '.env.integration.local',
  '.env.test',
  '.env.integration',
  '.env'
];

for (const candidate of envCandidates) {
  safelyLoadEnvFile(candidate);
}

function loadAncestorEnv(maxDepth = 3) {
  let dir = process.cwd();
  for (let depth = 0; depth < maxDepth; depth += 1) {
    dir = path.resolve(dir, '..');
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      safelyLoadEnvFile(candidate);
      break;
    }
  }
}

function loadRepoRootEnv() {
  const gitPath = path.resolve(process.cwd(), '.git');
  if (!fs.existsSync(gitPath)) return;

  try {
    const stats = fs.statSync(gitPath);
    if (stats.isDirectory()) {
      return;
    }

    const gitFileContent = fs.readFileSync(gitPath, 'utf8');
    const match = gitFileContent.match(/gitdir:\s*(.*)/i);
    if (!match) return;

    const gitDirAbsolute = path.resolve(path.dirname(gitPath), match[1].trim());
    let gitCursor = gitDirAbsolute;
    while (
      gitCursor &&
      path.basename(gitCursor) !== '.git' &&
      gitCursor !== path.dirname(gitCursor)
    ) {
      gitCursor = path.dirname(gitCursor);
    }

    const repoRoot =
      path.basename(gitCursor) === '.git'
        ? path.dirname(gitCursor)
        : path.resolve(gitDirAbsolute, '..');

    const repoEnvPath = path.join(repoRoot, '.env');
    if (fs.existsSync(repoEnvPath)) {
      safelyLoadEnvFile(repoEnvPath);
    }
  } catch (error) {
    console.warn('⚠️  Unable to resolve repo root env file:', error.message);
  }
}

loadAncestorEnv();
loadRepoRootEnv();

if (loadedEnvFiles.size > 0) {
  const sanitized = Array.from(loadedEnvFiles).map((absPath) =>
    path.relative(process.cwd(), absPath)
  );
  console.info(`🔐 Loaded test credentials from: ${sanitized.join(', ')}`);
}

const SUPABASE_ENV_FALLBACKS = {
  SUPABASE_URL: ['SUPABASE_TEST_URL', 'SUPABASE_INTEGRATION_URL'],
  SUPABASE_SERVICE_KEY: [
    'SUPABASE_TEST_SERVICE_KEY',
    'SUPABASE_INTEGRATION_SERVICE_KEY'
  ],
  SUPABASE_ANON_KEY: ['SUPABASE_TEST_ANON_KEY', 'SUPABASE_INTEGRATION_ANON_KEY']
};

for (const [primary, fallbacks] of Object.entries(SUPABASE_ENV_FALLBACKS)) {
  if (!process.env[primary]) {
    const fallbackKey = fallbacks.find((key) => process.env[key]);
    if (fallbackKey) {
      process.env[primary] = process.env[fallbackKey];
    }
  }
}

const hasSupabaseCredentials =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_KEY &&
  process.env.SUPABASE_ANON_KEY;

if (!hasSupabaseCredentials) {
  if (process.env.CI || process.env.IS_TEST) {
    console.info('ℹ️  No Supabase credentials found - enabling mock mode for smoke tests');
    process.env.MOCK_MODE = 'true';
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'mock-service-key';
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'mock-anon-key';
  } else {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY');
    process.exit(1);
  }
}

global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

global.console = {
  ...console,
  log: jest.fn((...args) => {
    if (args[0] && typeof args[0] === 'string' && /^[🔌📊✅❌🧹📝🎉⚠️🚀🔄]/.test(args[0])) {
      console.info(...args);
    }
  })
};

afterAll(async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    // Ignore cleanup errors in tests
  }
});
