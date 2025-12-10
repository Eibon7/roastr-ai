/**
 * Tests for detect-hardcoded-values.js
 *
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md: Values must come from SSOT, not hardcoded
 * - docs/nodes-v2/15-ssot-integration.md: CI must detect hardcoded SSOT values
 *
 * Created: 2025-12-10 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Normalize paths for Windows compatibility
const norm = (p) => p.replace(/\\/g, '/');

describe('detect-hardcoded-values.js', () => {
  const scriptPath = norm(
    path.join(__dirname, '../../../../scripts/ci/detect-hardcoded-values.js')
  );
  const testDir = path.join(os.tmpdir(), 'roastr-hardcoded-test-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should detect hardcoded plan value that exists in SSOT', () => {
    // SSOT v2 defines: starter, pro, plus
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'hardcoded-plan.js');
    fs.writeFileSync(invalidFile, `const plan = 'starter';`);

    try {
      execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
    }
  });

  test('should detect hardcoded threshold value', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'hardcoded-threshold.js');
    fs.writeFileSync(invalidFile, `const threshold = 0.5;`);

    try {
      execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
    }
  });

  test('should ignore constants internal to script (not SSOT)', () => {
    // Internal constants that are not SSOT-defined should be ignored
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'internal-const.js');
    fs.writeFileSync(
      validFile,
      `
      const INTERNAL_CONST = 'some-value';
      const localVar = 123;
    `
    );

    try {
      const result = execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      expect(result).toContain('✅');
    } catch (error) {
      // Should not fail for non-SSOT constants
      expect(error.status).toBeUndefined();
    }
  });

  test('should pass when no hardcoded SSOT values detected', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'valid.js');
    fs.writeFileSync(
      validFile,
      `
      // Values loaded from SSOT
      const plan = loadFromSSOT('plan');
      const threshold = getThresholdFromConfig();
    `
    );

    try {
      const result = execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      expect(result).toContain('✅');
    } catch (error) {
      expect(error.status).toBeUndefined();
    }
  });
});
