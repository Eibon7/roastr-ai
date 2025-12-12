/**
 * Tests for validate-ssot-compliance.js
 *
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md: SSOT compliance rules
 * - docs/nodes-v2/15-ssot-integration.md: CI validation requirements
 *
 * Created: 2025-12-10 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

describe('validate-ssot-compliance.js', () => {
  const scriptPath = path.join(__dirname, '../../scripts/ci/validate-ssot-compliance.js');
  const testDir = path.join(os.tmpdir(), 'roastr-ssot-test-' + Date.now());

  beforeEach(() => {
    // Create temporary test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should exit with code 0 when no SSOT violations are found', () => {
    // Create a valid file that doesn't violate SSOT
    const validFile = path.join(testDir, 'valid.js');
    fs.writeFileSync(
      validFile,
      `
      const plan = 'starter'; // Valid SSOT v2 plan
      const billing = 'polar'; // Valid SSOT v2 billing
    `
    );

    try {
      const result = execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      expect(result).toContain('✅');
    } catch (error) {
      // If exit code is 0, execSync doesn't throw
      expect(error.status).toBeUndefined();
    }
  });

  test('should exit with code 1 when SSOT violation is detected (Stripe)', () => {
    // Create a file with Stripe reference (prohibited in SSOT v2)
    const invalidFile = path.join(testDir, 'invalid.js');
    fs.writeFileSync(
      invalidFile,
      `
      const stripe = require('stripe'); // SSOT v2 prohibits Stripe
    `
    );

    try {
      execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      expect(error.stdout).toContain('Stripe');
    }
  });

  test('should pass when file does not change (no violations)', () => {
    // Empty directory or file with no changes
    const emptyFile = path.join(testDir, 'empty.js');
    fs.writeFileSync(emptyFile, '// No SSOT-related content');

    try {
      const result = execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      expect(result).toContain('✅');
    } catch (error) {
      // Should not fail for files with no SSOT-related content
      expect(error.status).toBeUndefined();
    }
  });

  test('should detect legacy plan violation', () => {
    // Create a file with legacy plan (prohibited in SSOT v2)
    const invalidFile = path.join(testDir, 'legacy-plan.js');
    fs.writeFileSync(
      invalidFile,
      `
      const plan = 'free'; // Legacy v1 plan prohibited in SSOT v2
    `
    );

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
});
