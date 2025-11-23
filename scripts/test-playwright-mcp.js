#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testPlaywrightMCP() {
  console.log('🧪 Testing Playwright MCP Server...\n');

  const serverPath = path.join(__dirname, '..', 'playwright-mcp-server.js');

  const tests = [
    {
      name: 'Browse Test',
      request: {
        method: 'browse',
        params: { url: 'http://localhost:3000' }
      }
    },
    {
      name: 'Screenshot Test',
      request: {
        method: 'screenshot',
        params: { path: './test-evidence/localhost-screenshot.png', fullPage: true }
      }
    },
    {
      name: 'Multi-Viewport Test',
      request: {
        method: 'multi_viewport_test',
        params: {
          url: 'http://localhost:3000',
          outputDir: './test-evidence',
          testName: 'roastr-viewports'
        }
      }
    },
    {
      name: 'Console Error Check',
      request: {
        method: 'check_console',
        params: { url: 'http://localhost:3000' }
      }
    }
  ];

  for (const test of tests) {
    console.log(`📋 Running: ${test.name}`);

    const child = spawn('node', [serverPath], {
      env: { ...process.env, MCP_TEST_MODE: 'true' }
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      // Ignore stderr (initialization messages)
    });

    // Send request
    child.stdin.write(JSON.stringify(test.request) + '\n');
    child.stdin.end();

    await new Promise((resolve) => {
      child.on('close', () => {
        try {
          const response = JSON.parse(output.trim());
          if (response.error) {
            console.log(`❌ Error: ${response.error}`);
          } else {
            console.log(`✅ Success:`, JSON.stringify(response, null, 2));
          }
        } catch (e) {
          console.log(`❌ Parse error: ${e.message}`);
          console.log(`Output: ${output}`);
        }
        console.log('');
        resolve();
      });
    });
  }

  console.log('🎉 Playwright MCP Server testing complete!');
  console.log('\nTo use in Claude:');
  console.log('1. Restart Claude Code to load the MCP configuration');
  console.log('2. Use /mcp list to verify Playwright server is loaded');
  console.log('3. Use /mcp exec playwright <method> <params> to run tests');
}

testPlaywrightMCP().catch(console.error);
