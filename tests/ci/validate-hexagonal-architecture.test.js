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

describe('validate-hexagonal-architecture.js', () => {
  const scriptPath = path.join(__dirname, '../../scripts/ci/validate-hexagonal-architecture.js');
  const testDir = path.join(os.tmpdir(), 'roastr-arch-test-' + Date.now());
  const servicesDir = path.join(testDir, 'apps', 'backend-v2', 'src', 'services');

  beforeEach(() => {
    if (!fs.existsSync(servicesDir)) {
      fs.mkdirSync(servicesDir, { recursive: true });
    }
  });

  afterEach(() => {
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
      expect(error.stdout).toContain('HTTP');
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
      expect(error.stdout).toContain('DB');
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
      expect(error.stdout).toContain('Express');
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
      expect(error.stdout).toContain('worker');
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

    try {
      const result = execSync(`node ${scriptPath} --path=${servicesDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      expect(result).toContain('✅');
    } catch (error) {
      expect(error.status).toBeUndefined();
    }
  });
});
