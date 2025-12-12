/**
 * Tests for validate-hexagonal-architecture.js
 *
 * Source Requirements:
 * - docs/spec/roastr-spec-v2.md (lines 630-637): Hexagonal architecture rules
 * - Domain layer (services/) must not have HTTP, DB, Express, or worker logic
 *
 * Created: 2025-12-10 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Normalize paths for Windows compatibility
const norm = (p) => p.replace(/\\/g, '/');

describe('validate-hexagonal-architecture.js', () => {
  const scriptPath = path.join(
    __dirname,
    '../../../../scripts/ci/validate-hexagonal-architecture.js'
  );
  const testDir = path.join(os.tmpdir(), 'roastr-arch-test-' + Date.now());
  const servicesDir = path.join(testDir, 'apps', 'backend-v2', 'src', 'services');

  beforeEach(() => {
    if (!fs.existsSync(servicesDir)) {
      fs.mkdirSync(servicesDir, { recursive: true });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should detect HTTP calls in domain layer (services/)', () => {
    const invalidFile = path.join(servicesDir, 'http-service.js');
    fs.writeFileSync(
      invalidFile,
      `
      const response = await fetch('https://api.example.com');
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('HTTP');
    }
  });

  test('should detect direct DB access in domain layer', () => {
    const invalidFile = path.join(servicesDir, 'db-service.js');
    fs.writeFileSync(
      invalidFile,
      `
      const result = supabase.from('users').select('*');
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('DB');
    }
  });

  test('should detect Express logic in domain layer', () => {
    const invalidFile = path.join(servicesDir, 'express-service.js');
    fs.writeFileSync(
      invalidFile,
      `
      router.get('/api/users', (req, res) => {});
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('Express');
    }
  });

  test('should detect worker logic in domain layer', () => {
    const invalidFile = path.join(servicesDir, 'worker-service.js');
    fs.writeFileSync(
      invalidFile,
      `
      enqueue('task', { data: 'value' });
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('worker');
    }
  });

  test('should detect serialization logic in domain layer', () => {
    const invalidFile = path.join(servicesDir, 'serialize-service.js');
    fs.writeFileSync(
      invalidFile,
      `
      const data = JSON.stringify({ value: 'test' });
      const parsed = JSON.parse(data);
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('serialization');
    }
  });

  test('should pass when structure is clean (no violations)', () => {
    const validFile = path.join(servicesDir, 'clean-service.js');
    fs.writeFileSync(
      validFile,
      `
      // Clean domain service with no infrastructure concerns
      export function processData(data) {
        return data.map(item => item.value);
      }
    `
    );

    const result = execSync(`node ${scriptPath} --path=${servicesDir}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(result).toContain('✅');
  });
});
