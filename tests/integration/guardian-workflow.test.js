/**
 * Integration Tests for Guardian GDD Workflow
 *
 * Tests complete end-to-end workflows including:
 * - Configuration loading and validation
 * - Git diff detection and parsing
 * - Change classification and case generation
 * - Report and audit log generation
 * - Case deduplication across runs
 * - Exit code scenarios
 *
 * Issue #716 - Phase 3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock the Guardian script by requiring it and exposing methods
// Note: Guardian script will need to export its class for testing
const GuardianGDD = require('../../../scripts/guardian-gdd');

describe('Guardian Workflow - Integration Tests', () => {
  let guardian;
  let testConfigPath;
  let testCasesDir;
  let testReportPath;
  let testAuditPath;

  beforeEach(() => {
    // Setup test directories
    testConfigPath = path.join(__dirname, '../fixtures/guardian/product-guard-test.yaml');
    testCasesDir = path.join(__dirname, '../fixtures/guardian/cases-test');
    testReportPath = path.join(__dirname, '../fixtures/guardian/reports/test-report.md');
    testAuditPath = path.join(__dirname, '../fixtures/guardian/reports/test-audit.md');

    // Create directories
    if (!fs.existsSync(testCasesDir)) {
      fs.mkdirSync(testCasesDir, { recursive: true });
    }
    if (!fs.existsSync(path.dirname(testReportPath))) {
      fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
    }

    // Clean existing case files
    if (fs.existsSync(testCasesDir)) {
      const files = fs.readdirSync(testCasesDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testCasesDir, file));
      });
    }

    // Initialize Guardian with test config
    guardian = new GuardianGDD({
      configPath: testConfigPath,
      casesDir: testCasesDir,
      reportPath: testReportPath,
      auditPath: testAuditPath
    });
  });

  afterEach(() => {
    // Cleanup test artifacts
    if (fs.existsSync(testCasesDir)) {
      const files = fs.readdirSync(testCasesDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testCasesDir, file));
      });
    }
    if (fs.existsSync(testReportPath)) {
      fs.unlinkSync(testReportPath);
    }
    if (fs.existsSync(testAuditPath)) {
      fs.unlinkSync(testAuditPath);
    }
  });

  describe('E2E: CRITICAL Change Detection', () => {
    test('should detect pricing change, classify as CRITICAL, generate case, and exit 2', () => {
      // Mock git diff to return pricing change
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'docs/nodes/plan-features.md': {
          diff: fs.readFileSync(
            path.join(__dirname, '../fixtures/guardian/mock-diffs/pricing-change.diff'),
            'utf-8'
          ),
          added: 1,
          removed: 1
        }
      });

      // Mock config with pricing domain
      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'subscription', 'price', 'billing'],
            reviewers: ['@product-owner', '@finance-lead']
          }
        }
      };

      // Run full scan
      const result = guardian.scan();

      // Assertions
      expect(result.exitCode).toBe(2); // CRITICAL = exit 2
      expect(result.cases.length).toBe(1);
      expect(result.cases[0].severity).toBe('CRITICAL');
      expect(result.cases[0].domains).toContain('pricing');
      expect(result.cases[0].files).toContain('docs/nodes/plan-features.md');

      // Verify case file created
      const caseFiles = fs.readdirSync(testCasesDir);
      expect(caseFiles.length).toBe(1);

      // Verify case content
      const caseContent = JSON.parse(
        fs.readFileSync(path.join(testCasesDir, caseFiles[0]), 'utf-8')
      );
      expect(caseContent.severity).toBe('CRITICAL');
      expect(caseContent.domains).toContain('pricing');
      expect(caseContent.action).toBe('BLOCK_AND_REVIEW');
      expect(caseContent.reviewers).toEqual(['@product-owner', '@finance-lead']);

      // Verify report generated
      expect(fs.existsSync(testReportPath)).toBe(true);
      const reportContent = fs.readFileSync(testReportPath, 'utf-8');
      expect(reportContent).toContain('🚨 CRITICAL');
      expect(reportContent).toContain('pricing');

      // Verify audit log generated
      expect(fs.existsSync(testAuditPath)).toBe(true);
      const auditContent = fs.readFileSync(testAuditPath, 'utf-8');
      expect(auditContent).toContain('CRITICAL');
      expect(auditContent).toContain('docs/nodes/plan-features.md');
    });
  });

  describe('E2E: SENSITIVE Change Detection', () => {
    test('should detect AI model change, classify as SENSITIVE, generate case, and exit 1', () => {
      // Mock git diff to return AI model change
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'src/services/roastGeneratorEnhanced.js': {
          diff: fs.readFileSync(
            path.join(__dirname, '../fixtures/guardian/mock-diffs/ai-model.diff'),
            'utf-8'
          ),
          added: 1,
          removed: 1
        }
      });

      // Mock config with ai_models domain
      guardian.config = {
        domains: {
          ai_models: {
            files: ['src/services/roastGeneratorEnhanced.js'],
            protection_level: 'SENSITIVE',
            keywords: ['gpt-4', 'model', 'temperature', 'max_tokens'],
            reviewers: ['@ai-lead']
          }
        }
      };

      // Run full scan
      const result = guardian.scan();

      // Assertions
      expect(result.exitCode).toBe(1); // SENSITIVE = exit 1
      expect(result.cases.length).toBe(1);
      expect(result.cases[0].severity).toBe('SENSITIVE');
      expect(result.cases[0].domains).toContain('ai_models');

      // Verify case file created
      const caseFiles = fs.readdirSync(testCasesDir);
      expect(caseFiles.length).toBe(1);

      // Verify report contains warning
      const reportContent = fs.readFileSync(testReportPath, 'utf-8');
      expect(reportContent).toContain('⚠️  SENSITIVE');
    });
  });

  describe('E2E: SAFE Change Detection', () => {
    test('should detect safe doc change, classify as SAFE, and exit 0', () => {
      // Mock git diff to return safe documentation change
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'docs/guides/tutorial.md': {
          diff: fs.readFileSync(
            path.join(__dirname, '../fixtures/guardian/mock-diffs/safe-doc-change.diff'),
            'utf-8'
          ),
          added: 3,
          removed: 0
        }
      });

      // Mock config without matching domain (safe by default)
      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'subscription']
          }
        }
      };

      // Run full scan
      const result = guardian.scan();

      // Assertions
      expect(result.exitCode).toBe(0); // SAFE = exit 0
      expect(result.cases.length).toBe(0); // No cases generated for SAFE changes

      // Verify report shows all clear
      const reportContent = fs.readFileSync(testReportPath, 'utf-8');
      expect(reportContent).toContain('All changes are SAFE');
    });
  });

  describe('E2E: Case Deduplication Across Runs', () => {
    test('should not create duplicate cases for identical changes across multiple runs', () => {
      // Mock git diff with consistent pricing change
      const mockDiff = {
        'docs/nodes/plan-features.md': {
          diff: '+tier: pro price: $49',
          added: 1,
          removed: 0
        }
      };

      jest.spyOn(guardian, 'getGitDiff').mockReturnValue(mockDiff);

      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'price'],
            reviewers: ['@product-owner']
          }
        }
      };

      // Run 1: Should create case
      const result1 = guardian.scan();
      expect(result1.cases.length).toBe(1);
      const caseFiles1 = fs.readdirSync(testCasesDir);
      expect(caseFiles1.length).toBe(1);
      const caseKey1 = result1.cases[0].case_key;

      // Run 2: Same change, should deduplicate
      const result2 = guardian.scan();
      expect(result2.cases.length).toBe(1);
      const caseFiles2 = fs.readdirSync(testCasesDir);
      expect(caseFiles2.length).toBe(1); // Still only 1 case file
      const caseKey2 = result2.cases[0].case_key;

      // Case keys should be identical (deduplication)
      expect(caseKey1).toBe(caseKey2);

      // Case file should be updated, not duplicated
      const caseContent = JSON.parse(
        fs.readFileSync(path.join(testCasesDir, caseFiles2[0]), 'utf-8')
      );
      expect(caseContent.last_detected_at).toBeDefined();
    });

    test('should create separate cases for different changes', () => {
      // Mock config with multiple domains
      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'price'],
            reviewers: ['@product-owner']
          },
          ai_models: {
            files: ['src/services/roastGeneratorEnhanced.js'],
            protection_level: 'SENSITIVE',
            keywords: ['model', 'temperature'],
            reviewers: ['@ai-lead']
          }
        }
      };

      // Run 1: Pricing change
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'docs/nodes/plan-features.md': {
          diff: '+tier: pro price: $49',
          added: 1,
          removed: 0
        }
      });
      const result1 = guardian.scan();
      expect(result1.cases.length).toBe(1);
      const caseKey1 = result1.cases[0].case_key;

      // Run 2: AI model change (different)
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'src/services/roastGeneratorEnhanced.js': {
          diff: '+model: gpt-4-turbo',
          added: 1,
          removed: 0
        }
      });
      const result2 = guardian.scan();
      expect(result2.cases.length).toBe(1);
      const caseKey2 = result2.cases[0].case_key;

      // Case keys should be different (not deduplicated)
      expect(caseKey1).not.toBe(caseKey2);

      // Should now have 2 case files
      const caseFiles = fs.readdirSync(testCasesDir);
      expect(caseFiles.length).toBe(2);
    });
  });

  describe('E2E: Multi-Domain Change', () => {
    test('should classify change affecting multiple domains with highest severity', () => {
      // Mock git diff with change matching multiple domains
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'src/billing/subscriptionManager.js': {
          diff: '+subscription tier: pro\n+model: gpt-4\n+auth: required',
          added: 3,
          removed: 0
        }
      });

      // Mock config with overlapping domains
      guardian.config = {
        domains: {
          pricing: {
            files: ['src/billing/**'],
            protection_level: 'CRITICAL',
            keywords: ['subscription', 'tier', 'billing'],
            reviewers: ['@product-owner']
          },
          ai_models: {
            files: ['src/billing/**'],
            protection_level: 'SENSITIVE',
            keywords: ['model', 'gpt'],
            reviewers: ['@ai-lead']
          },
          auth: {
            files: ['src/billing/**'],
            protection_level: 'SENSITIVE',
            keywords: ['auth', 'authentication'],
            reviewers: ['@security-lead']
          }
        }
      };

      // Run scan
      const result = guardian.scan();

      // Should use highest severity (CRITICAL > SENSITIVE)
      expect(result.exitCode).toBe(2);
      expect(result.cases[0].severity).toBe('CRITICAL');

      // Should include all matching domains
      expect(result.cases[0].domains).toContain('pricing');
      expect(result.cases[0].domains).toContain('ai_models');
      expect(result.cases[0].domains).toContain('auth');

      // Should aggregate all reviewers
      expect(result.cases[0].reviewers).toContain('@product-owner');
      expect(result.cases[0].reviewers).toContain('@ai-lead');
      expect(result.cases[0].reviewers).toContain('@security-lead');
    });
  });

  describe('E2E: Report Generation', () => {
    test('should generate comprehensive markdown report with all case details', () => {
      // Mock multiple changes
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'docs/nodes/plan-features.md': {
          diff: '+tier: pro price: $49',
          added: 1,
          removed: 1
        },
        'src/services/roastGeneratorEnhanced.js': {
          diff: '+model: gpt-4-turbo',
          added: 1,
          removed: 1
        }
      });

      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'price'],
            reviewers: ['@product-owner']
          },
          ai_models: {
            files: ['src/services/**'],
            protection_level: 'SENSITIVE',
            keywords: ['model', 'gpt'],
            reviewers: ['@ai-lead']
          }
        }
      };

      // Run scan
      guardian.scan();

      // Verify report file exists and has content
      expect(fs.existsSync(testReportPath)).toBe(true);
      const reportContent = fs.readFileSync(testReportPath, 'utf-8');

      // Report should contain summary
      expect(reportContent).toContain('# Guardian GDD Report');
      expect(reportContent).toContain('## Summary');

      // Report should list both cases
      expect(reportContent).toContain('🚨 CRITICAL');
      expect(reportContent).toContain('⚠️  SENSITIVE');

      // Report should include case details
      expect(reportContent).toContain('pricing');
      expect(reportContent).toContain('ai_models');
      expect(reportContent).toContain('@product-owner');
      expect(reportContent).toContain('@ai-lead');

      // Report should include action items
      expect(reportContent).toContain('BLOCK_AND_REVIEW');
      expect(reportContent).toContain('REQUIRE_REVIEW');
    });
  });

  describe('E2E: Audit Log Generation', () => {
    test('should generate audit log with timestamp and change details', () => {
      // Mock change
      jest.spyOn(guardian, 'getGitDiff').mockReturnValue({
        'docs/nodes/plan-features.md': {
          diff: '+tier: pro price: $49',
          added: 1,
          removed: 1
        }
      });

      guardian.config = {
        domains: {
          pricing: {
            files: ['docs/nodes/plan-features.md'],
            protection_level: 'CRITICAL',
            keywords: ['tier', 'price'],
            reviewers: ['@product-owner']
          }
        }
      };

      // Run scan
      const scanTime = new Date();
      guardian.scan();

      // Verify audit log exists
      expect(fs.existsSync(testAuditPath)).toBe(true);
      const auditContent = fs.readFileSync(testAuditPath, 'utf-8');

      // Audit should contain timestamp
      expect(auditContent).toContain('Timestamp:');

      // Audit should contain change details
      expect(auditContent).toContain('CRITICAL');
      expect(auditContent).toContain('docs/nodes/plan-features.md');
      expect(auditContent).toContain('pricing');

      // Audit should contain case key for traceability
      expect(auditContent).toMatch(/Case Key: [a-f0-9]{16}/);
    });
  });
});
