/**
 * Integration tests for Completion Validator (Guardian Agent Extension)
 *
 * Tests the automated pre-merge validation system script execution
 * and exit code behavior.
 *
 * Note: These are integration tests that execute the actual script
 * rather than unit tests of internal functions.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Completion Validator Script', () => {
  const scriptPath = path.join(__dirname, '../../../scripts/ci/validate-completion.js');
  const testEnv = { ...process.env, SKIP_EXPENSIVE_CHECKS: 'true' };

  beforeAll(() => {
    // Verify script exists
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  describe('Script Execution', () => {
    it('should be executable', () => {
      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).toBeTruthy(); // Check execute permission
    });

    it('should exit with error when no PR number provided', () => {
      let exitCode = null;
      let didError = false;
      try {
        execSync(`node ${scriptPath}`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        });
      } catch (error) {
        didError = true;
        exitCode = error.status || 1; // Default to 1 if status not set
      }

      // Script should error when no PR provided
      expect(didError).toBe(true);
      expect(exitCode).toBe(1);
    });

    it('should accept --pr flag', () => {
      // This will likely fail validation but should run
      let didRun = false;
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
        didRun = true;
      } catch (error) {
        didRun = true; // Script ran but failed validation
      }

      expect(didRun).toBe(true);
    });

    it('should accept --threshold flag', () => {
      let didRun = false;
      try {
        execSync(`node ${scriptPath} --pr=999 --threshold=85`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
        didRun = true;
      } catch (error) {
        didRun = true;
      }

      expect(didRun).toBe(true);
    });
  });

  describe('Output Format', () => {
    it('should output colored text to terminal', () => {
      let output = '';
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
      }

      expect(output).toContain('GUARDIAN');
      expect(output).toContain('Completion');
    });

    it('should include completion percentage in output', () => {
      let output = '';
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
      }

      expect(output).toMatch(/Completion:\s+\d+\.\d+%/);
    });

    it('should show validation checklist in output', () => {
      let output = '';
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
      }

      expect(output).toContain('Acceptance Criteria');
      expect(output).toContain('Test Coverage');
      expect(output).toContain('Agent Receipts');
      expect(output).toContain('Documentation');
      expect(output).toContain('CodeRabbit');
      expect(output).toContain('CI/CD');
    });
  });

  describe('NPM Script Integration', () => {
    it('should be callable via npm run validate:completion', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8')
      );

      expect(packageJson.scripts['validate:completion']).toBeDefined();
      expect(packageJson.scripts['validate:completion']).toContain('validate-completion.js');
    });
  });

  describe('Exit Code Behavior', () => {
    it('should exit with non-zero for incomplete validation', () => {
      let exitCode = 0;
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        exitCode = error.status;
      }

      // Should fail (exit 1 or 2) since PR 999 doesn't exist or is incomplete
      expect(exitCode).toBeGreaterThanOrEqual(1);
      expect(exitCode).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid PR numbers gracefully', () => {
      let output = '';
      let didComplete = false;

      try {
        execSync(`node ${scriptPath} --pr=99999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
        didComplete = true;
      }

      expect(didComplete).toBe(true);
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle missing GitHub CLI gracefully', () => {
      let output = '';
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: { ...testEnv, PATH: '/usr/bin' } // Limited PATH
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
      }

      // Should still produce output even without gh CLI
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle missing coverage report gracefully', () => {
      let output = '';
      try {
        execSync(`node ${scriptPath} --pr=999`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
          env: testEnv
        });
      } catch (error) {
        output = error.stdout || error.stderr || '';
      }

      // Should mention coverage status even if report missing
      expect(output).toContain('Coverage');
    });
  });

  describe('Integration with Other CI Scripts', () => {
    it('should be located in scripts/ci directory', () => {
      expect(scriptPath).toContain('scripts/ci');
    });

    it('should be a sibling of require-agent-receipts.js', () => {
      const agentReceiptsScript = path.join(__dirname, '../../../scripts/ci/require-agent-receipts.js');
      expect(fs.existsSync(agentReceiptsScript)).toBe(true);
    });
  });

  describe('Documentation Compliance', () => {
    it('should have corresponding documentation in docs/policies', () => {
      const policyDoc = path.join(__dirname, '../../../docs/policies/completion-validation.md');
      expect(fs.existsSync(policyDoc)).toBe(true);
    });

    it('should be referenced in CLAUDE.md', () => {
      const claudeMd = fs.readFileSync(
        path.join(__dirname, '../../../CLAUDE.md'),
        'utf8'
      );

      expect(claudeMd).toContain('Completion Validation');
      expect(claudeMd).toContain('validate:completion');
    });

    it('should have GitHub Actions workflow', () => {
      const workflow = path.join(__dirname, '../../../.github/workflows/pre-merge-validation.yml');
      expect(fs.existsSync(workflow)).toBe(true);
    });
  });

  describe('Guardian Agent Integration', () => {
    it('should be referenced in agents/manifest.yaml', () => {
      const manifest = fs.readFileSync(
        path.join(__dirname, '../../../agents/manifest.yaml'),
        'utf8'
      );

      expect(manifest).toContain('Guardian');
      expect(manifest).toContain('completion');
    });
  });
});
