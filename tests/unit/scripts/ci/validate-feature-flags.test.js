/**
 * Tests for validate-feature-flags.js
 * 
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md (section 3.2): Authorized feature flags list
 * - docs/nodes-v2/15-ssot-integration.md: CI must validate feature flags
 * 
 * Created: 2025-12-10 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

describe('validate-feature-flags.js', () => {
  const scriptPath = path.join(__dirname, '../../scripts/ci/validate-feature-flags.js');
  const testDir = path.join(os.tmpdir(), 'roastr-flags-test-' + Date.now());
  
  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  test('should accept valid SSOT-authorized flags', () => {
    // Valid flags from SSOT v2: autopost_enabled, manual_approval_enabled, etc.
    const validFile = path.join(testDir, 'valid-flag.js');
    fs.writeFileSync(validFile, `
      const flag = 'autopost_enabled'; // Valid SSOT flag
      featureFlag('manual_approval_enabled');
    `);
    
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
  
  test('should fail with unauthorized flag', () => {
    const invalidFile = path.join(testDir, 'invalid-flag.js');
    fs.writeFileSync(invalidFile, `
      const flag = 'unauthorized_flag_name'; // Not in SSOT v2
    `);
    
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
  
  test('should ignore comments', () => {
    const validFile = path.join(testDir, 'comments.js');
    fs.writeFileSync(validFile, `
      // This is a comment about 'some_flag'
      /* Another comment with 'another_flag' */
      const actualFlag = 'autopost_enabled'; // Valid flag
    `);
    
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
  
  test('should accept multiple valid flags', () => {
    const validFile = path.join(testDir, 'multiple-flags.js');
    fs.writeFileSync(validFile, `
      const flags = {
        autopost: 'autopost_enabled',
        manual: 'manual_approval_enabled',
        shield: 'enable_shield'
      };
    `);
    
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

