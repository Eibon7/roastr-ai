/**
 * Tests for detect-legacy-v1.js
 * 
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md (lines 39-46): Legacy plans prohibited
 * - docs/SSOT/roastr-ssot-v2.md (lines 95-96): Stripe prohibited
 * 
 * Created: 2025-12-10 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

describe('detect-legacy-v1.js', () => {
  const scriptPath = path.join(__dirname, '../../scripts/ci/detect-legacy-v1.js');
  const testDir = path.join(os.tmpdir(), 'roastr-legacy-test-' + Date.now());
  
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
  
  test('should fail with legacy v1 plan (free)', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'legacy-plan.js');
    fs.writeFileSync(invalidFile, `const plan = 'free';`);
    
    try {
      execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('free');
    }
  });
  
  test('should fail with legacy v1 plan (basic)', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'legacy-plan.js');
    fs.writeFileSync(invalidFile, `const plan = 'basic';`);
    
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
  
  test('should fail with legacy v1 plan (creator_plus)', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'legacy-plan.js');
    fs.writeFileSync(invalidFile, `const plan = 'creator_plus';`);
    
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
  
  test('should fail with Stripe reference', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const invalidFile = path.join(backendV2Dir, 'stripe.js');
    fs.writeFileSync(invalidFile, `const stripe = require('stripe');`);
    
    try {
      execSync(`node ${scriptPath} --path=${testDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      fail('Should have exited with code 1');
    } catch (error) {
      expect(error.status).toBe(1);
      const output = (error.stdout || '') + (error.stderr || '');
      expect(output).toContain('Stripe');
    }
  });
  
  test('should pass when no legacy references found', () => {
    const backendV2Dir = path.join(testDir, 'apps', 'backend-v2');
    fs.mkdirSync(backendV2Dir, { recursive: true });
    const validFile = path.join(backendV2Dir, 'valid.js');
    fs.writeFileSync(validFile, `
      const plan = 'starter'; // Valid SSOT v2 plan
      const billing = 'polar'; // Valid SSOT v2 billing
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

