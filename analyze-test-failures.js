#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');

// List of test files to analyze
const testFiles = [
  'tests/smoke/api-health.test.js',
  'tests/unit/routes/user.test.js', 
  'tests/unit/routes/billing.test.js',
  'tests/unit/config/__tests__/flags.test.js',
  'tests/unit/routes/plan.test.js',
  'tests/unit/frontend/billing.test.js',
  'tests/unit/middleware/requirePlan.test.js',
  'tests/unit/middleware/isAdmin.test.js',
  'tests/smoke/feature-flags.test.js'
];

const results = [];

async function runTest(testFile) {
  return new Promise((resolve) => {
    const cmd = `ENABLE_MOCK_MODE=true npx jest ${testFile} --verbose --no-coverage --passWithNoTests`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      const result = {
        file: testFile,
        passed: !error,
        output: stdout + stderr,
        error: error ? error.message : null
      };
      resolve(result);
    });
  });
}

async function main() {
  console.log('🔍 Analyzing test failures...\n');
  
  for (const testFile of testFiles) {
    console.log(`Testing ${testFile}...`);
    const result = await runTest(testFile);
    results.push(result);
  }
  
  // Generate summary
  console.log('\n📊 SUMMARY:');
  console.log('='.repeat(50));
  
  const failed = results.filter(r => !r.passed);
  const passed = results.filter(r => r.passed);
  
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📁 Total: ${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n🚨 FAILED TESTS:');
    failed.forEach(result => {
      console.log(`\n📄 ${result.file}:`);
      
      // Extract key error information
      const lines = result.output.split('\n');
      const failedTests = lines.filter(line => 
        line.includes('✕') || 
        line.includes('● ') ||
        line.includes('expect(')
      ).slice(0, 5); // First 5 relevant errors
      
      failedTests.forEach(line => console.log(`  ${line.trim()}`));
      
      if (result.output.includes('timeout')) {
        console.log('  ⏰ TIMEOUT ISSUE');
      }
      if (result.output.includes('ECONNREFUSED')) {
        console.log('  🔌 CONNECTION REFUSED');
      }
      if (result.output.includes('mock')) {
        console.log('  🎭 MOCK RELATED');
      }
    });
  }
  
  // Save detailed results
  fs.writeFileSync('test-failure-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to test-failure-analysis.json');
}

main().catch(console.error);