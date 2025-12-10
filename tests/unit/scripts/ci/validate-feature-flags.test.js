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
  const scriptPath = path.join(__dirname, '../../../../scripts/ci/validate-feature-flags.js');
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
    // Must use pattern that matches validator: featureFlag('name') or flag = 'name'
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'valid-flag.js');
    fs.writeFileSync(validFile, `
      featureFlag('autopost_enabled'); // Valid SSOT flag
      const flag = 'manual_approval_enabled'; // Valid SSOT flag
    `);
    
    const result = execSync(`node ${scriptPath} --path=${testDir}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(result).toContain('✅');
  });
  
  test('should fail with unauthorized flag', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'invalid-flag.js');
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
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'comments.js');
    fs.writeFileSync(validFile, `
      // This is a comment about 'some_flag'
      /* Another comment with 'another_flag' */
      featureFlag('autopost_enabled'); // Valid flag
    `);
    
    const result = execSync(`node ${scriptPath} --path=${testDir}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(result).toContain('✅');
  });
  
  test('should accept multiple valid flags', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'multiple-flags.js');
    fs.writeFileSync(validFile, `
      featureFlag('autopost_enabled');
      featureFlag('manual_approval_enabled');
      featureFlag('enable_shield');
    `);
    
    const result = execSync(`node ${scriptPath} --path=${testDir}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(result).toContain('✅');
  });
});

