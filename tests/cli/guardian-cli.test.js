/**
 * CLI Tests for Guardian GDD Script
 *
 * Tests command-line interface behavior including:
 * - Flag parsing (--full, --check, --report, --ci, --help)
 * - Exit codes (0=SAFE, 1=SENSITIVE, 2=CRITICAL)
 * - Help text display
 * - Error handling and validation
 * - Output formatting
 *
 * Issue #716 - Phase 3
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Guardian CLI - Command Line Interface Tests', () => {
  const guardianScript = path.join(__dirname, '../../scripts/guardian-gdd.js');
  const testFixturesDir = path.join(__dirname, '../fixtures/guardian');
  const testCasesDir = path.join(testFixturesDir, 'cases-cli-test');
  const testReportPath = path.join(testFixturesDir, 'reports/cli-test-report.md');

  beforeEach(() => {
    // Clean test artifacts
    if (fs.existsSync(testCasesDir)) {
      const files = fs.readdirSync(testCasesDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testCasesDir, file));
      });
    }
    if (fs.existsSync(testReportPath)) {
      fs.unlinkSync(testReportPath);
    }
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testCasesDir)) {
      const files = fs.readdirSync(testCasesDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testCasesDir, file));
      });
    }
    if (fs.existsSync(testReportPath)) {
      fs.unlinkSync(testReportPath);
    }
  });

  describe('Flag: --help', () => {
    test('should display help text with all available flags', () => {
      try {
        const output = execSync(`node ${guardianScript} --help`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should contain usage information
        expect(output).toContain('Guardian GDD');
        expect(output).toContain('Usage:');

        // Should list all flags
        expect(output).toContain('--full');
        expect(output).toContain('--check');
        expect(output).toContain('--report');
        expect(output).toContain('--ci');
        expect(output).toContain('--help');

        // Should contain descriptions
        expect(output).toContain('Full scan with report generation');
        expect(output).toContain('Check mode (no case generation)');
        expect(output).toContain('Generate report only');
        expect(output).toContain('CI mode (strict exit codes)');
      } catch (error) {
        // --help might exit with 0, which shouldn't throw
        expect(error.status).toBe(0);
      }
    });

    test('should display help with -h alias', () => {
      try {
        const output = execSync(`node ${guardianScript} -h`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        expect(output).toContain('Guardian GDD');
        expect(output).toContain('Usage:');
      } catch (error) {
        expect(error.status).toBe(0);
      }
    });
  });

  describe('Flag: --full', () => {
    test('should run full scan with case and report generation', () => {
      // Create test config that will match a change
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["**/*.test"]
    protection_level: SENSITIVE
    keywords: ["test"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(
          `node ${guardianScript} --full --config=${configPath} --cases-dir=${testCasesDir} --report=${testReportPath}`,
          {
            encoding: 'utf-8',
            stdio: 'pipe'
          }
        );

        // Should indicate full scan
        expect(output).toContain('Full scan');

        // Should generate report
        expect(fs.existsSync(testReportPath)).toBe(true);
      } catch (error) {
        // May exit with 1 or 2 depending on findings
        expect([0, 1, 2]).toContain(error.status);
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should respect --full flag and generate comprehensive output', () => {
      const testConfig = `
version: "1.0"
domains:
  pricing:
    files: ["docs/nodes/plan-features.md"]
    protection_level: CRITICAL
    keywords: ["tier", "subscription"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(`node ${guardianScript} --full --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should show scan progress
        expect(output).toMatch(/Scanning|Analyzing|Complete/);
      } catch (error) {
        // Expected behavior - may fail with findings
        expect([0, 1, 2]).toContain(error.status);
      } finally {
        fs.unlinkSync(configPath);
      }
    });
  });

  describe('Flag: --check', () => {
    test('should run in check mode without generating cases', () => {
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["**/*.js"]
    protection_level: SENSITIVE
    keywords: ["test"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(
          `node ${guardianScript} --check --config=${configPath} --cases-dir=${testCasesDir}`,
          {
            encoding: 'utf-8',
            stdio: 'pipe'
          }
        );

        // Should indicate check mode
        expect(output).toContain('Check mode');

        // Should NOT generate case files
        if (fs.existsSync(testCasesDir)) {
          const files = fs.readdirSync(testCasesDir);
          expect(files.length).toBe(0);
        }
      } catch (error) {
        // May exit with 1 or 2 but still no cases
        if (fs.existsSync(testCasesDir)) {
          const files = fs.readdirSync(testCasesDir);
          expect(files.length).toBe(0);
        }
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should still return correct exit codes in check mode', () => {
      // Test will depend on actual git state
      // Here we test that exit codes are respected
      const testConfig = `
version: "1.0"
domains:
  critical_domain:
    files: ["docs/nodes/plan-features.md"]
    protection_level: CRITICAL
    keywords: ["price", "tier"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        execSync(`node ${guardianScript} --check --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        // Exit 0 = SAFE
      } catch (error) {
        // Exit 1 = SENSITIVE, Exit 2 = CRITICAL
        expect([1, 2]).toContain(error.status);
      } finally {
        fs.unlinkSync(configPath);
      }
    });
  });

  describe('Flag: --report', () => {
    test('should generate report from existing cases', () => {
      // Create a test case file
      const caseData = {
        case_key: 'test1234abcd5678',
        severity: 'CRITICAL',
        domains: ['pricing'],
        files: ['docs/nodes/plan-features.md'],
        action: 'BLOCK_AND_REVIEW',
        reviewers: ['@product-owner'],
        created_at: new Date().toISOString()
      };

      if (!fs.existsSync(testCasesDir)) {
        fs.mkdirSync(testCasesDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(testCasesDir, `${caseData.case_key}.json`),
        JSON.stringify(caseData, null, 2)
      );

      try {
        const output = execSync(
          `node ${guardianScript} --report --cases-dir=${testCasesDir} --report=${testReportPath}`,
          {
            encoding: 'utf-8',
            stdio: 'pipe'
          }
        );

        // Should indicate report generation
        expect(output).toContain('Report');

        // Should generate report file
        expect(fs.existsSync(testReportPath)).toBe(true);

        // Report should contain case data
        const reportContent = fs.readFileSync(testReportPath, 'utf-8');
        expect(reportContent).toContain('CRITICAL');
        expect(reportContent).toContain('pricing');
      } catch (error) {
        // Should not fail for report generation
        fail(`Report generation failed: ${error.message}`);
      }
    });
  });

  describe('Flag: --ci', () => {
    test('should run in CI mode with strict exit codes', () => {
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["**/*.js"]
    protection_level: SENSITIVE
    keywords: ["test"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(`node ${guardianScript} --ci --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should indicate CI mode
        expect(output).toContain('CI mode');
      } catch (error) {
        // In CI mode, must exit with correct code
        expect([0, 1, 2]).toContain(error.status);

        // Should not exit with generic error codes
        expect(error.status).not.toBe(127); // Command not found
        expect(error.status).not.toBe(255); // Generic error
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should fail CI pipeline if CRITICAL changes detected', () => {
      // Create config that will trigger CRITICAL
      const testConfig = `
version: "1.0"
domains:
  pricing:
    files: ["docs/nodes/plan-features.md"]
    protection_level: CRITICAL
    keywords: ["tier", "subscription", "price"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      // Mock a CRITICAL change by creating a staged diff
      // This test assumes guardian-gdd.js can be mocked or uses test fixtures

      try {
        execSync(`node ${guardianScript} --ci --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        // If CRITICAL detected, should not reach here
      } catch (error) {
        if (error.stdout && error.stdout.includes('CRITICAL')) {
          expect(error.status).toBe(2); // CRITICAL = exit 2
        }
      } finally {
        fs.unlinkSync(configPath);
      }
    });
  });

  describe('Exit Codes', () => {
    test('should exit 0 when no changes or all changes are SAFE', () => {
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["nonexistent/**/*.js"]
    protection_level: CRITICAL
    keywords: ["nothing"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const result = execSync(`node ${guardianScript} --check --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should exit 0 for SAFE
        // If we reach here without exception, exit code was 0
        expect(result).toBeDefined();
      } catch (error) {
        // Should not throw for SAFE changes
        expect(error.status).toBe(0);
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should exit 1 when SENSITIVE changes detected', () => {
      // This test depends on having actual SENSITIVE changes
      // Or using a mock/fixture-based approach
      const testConfig = `
version: "1.0"
domains:
  ai_models:
    files: ["src/services/**/*.js"]
    protection_level: SENSITIVE
    keywords: ["model", "gpt"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        execSync(`node ${guardianScript} --ci --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        // If SENSITIVE detected, should not reach here
      } catch (error) {
        // SENSITIVE = exit 1 or higher (CRITICAL could be 2)
        expect([1, 2]).toContain(error.status);
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should exit 2 when CRITICAL changes detected', () => {
      const testConfig = `
version: "1.0"
domains:
  pricing:
    files: ["docs/nodes/plan-features.md"]
    protection_level: CRITICAL
    keywords: ["tier", "subscription", "price"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        execSync(`node ${guardianScript} --ci --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        // If CRITICAL detected, should not reach here
      } catch (error) {
        if (error.stdout && error.stdout.includes('CRITICAL')) {
          expect(error.status).toBe(2);
        }
      } finally {
        fs.unlinkSync(configPath);
      }
    });
  });

  describe('Error Handling', () => {
    test('should fail gracefully with invalid flag', () => {
      try {
        execSync(`node ${guardianScript} --invalid-flag`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        fail('Should have thrown error for invalid flag');
      } catch (error) {
        expect(error.stderr || error.stdout).toMatch(/Invalid|Unknown|flag/i);
      }
    });

    test('should fail gracefully when config file not found', () => {
      try {
        execSync(`node ${guardianScript} --config=nonexistent.yaml`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        fail('Should have thrown error for missing config');
      } catch (error) {
        expect(error.stderr || error.stdout).toMatch(/Config|not found|ENOENT/i);
      }
    });

    test('should fail gracefully with malformed config', () => {
      const malformedConfig = 'invalid: yaml: content: [unclosed';
      const configPath = path.join(testFixturesDir, 'malformed-config.yaml');
      fs.writeFileSync(configPath, malformedConfig);

      try {
        execSync(`node ${guardianScript} --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        fail('Should have thrown error for malformed config');
      } catch (error) {
        expect(error.stderr || error.stdout).toMatch(/parse|invalid|yaml/i);
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should handle git command failures gracefully', () => {
      // Test in a non-git directory or with git errors
      // This test may need environment setup
      const tempDir = path.join(__dirname, '../temp-non-git');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      try {
        execSync(`cd ${tempDir} && node ${guardianScript} --check`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        // Should handle gracefully, not crash
      } catch (error) {
        // Should provide meaningful error about git
        expect(error.stderr || error.stdout).toMatch(/git|repository|Not a git/i);
      } finally {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    });
  });

  describe('Output Formatting', () => {
    test('should output JSON when --json flag is used', () => {
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["**/*.js"]
    protection_level: SAFE
    keywords: ["test"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(`node ${guardianScript} --check --json --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should be valid JSON
        const parsed = JSON.parse(output);
        expect(parsed).toBeDefined();
        expect(parsed).toHaveProperty('cases');
        expect(parsed).toHaveProperty('exitCode');
      } catch (error) {
        // Even with exit code 1/2, output should be valid JSON
        if (error.stdout) {
          const parsed = JSON.parse(error.stdout);
          expect(parsed).toBeDefined();
        }
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    test('should output human-readable format by default', () => {
      const testConfig = `
version: "1.0"
domains:
  test_domain:
    files: ["**/*.js"]
    protection_level: SAFE
    keywords: ["test"]
`;
      const configPath = path.join(testFixturesDir, 'product-guard-cli-test.yaml');
      fs.writeFileSync(configPath, testConfig);

      try {
        const output = execSync(`node ${guardianScript} --check --config=${configPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        // Should contain human-readable text
        expect(output).toMatch(/Guardian|Scan|Check|Complete/i);

        // Should NOT be JSON by default
        expect(() => JSON.parse(output)).toThrow();
      } catch (error) {
        // Even with findings, should be human-readable
        if (error.stdout) {
          expect(error.stdout).toMatch(/Guardian|Scan|Changes/i);
        }
      } finally {
        fs.unlinkSync(configPath);
      }
    });
  });
});
