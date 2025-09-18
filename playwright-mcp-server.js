#!/usr/bin/env node

const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create readline interface for MCP communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// MCP Server implementation
class PlaywrightMCPServer {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.serverName = 'playwright-server';
    this.serverVersion = '1.0.0';
  }

  async initialize() {
    // Send initialization complete notification
    this.sendNotification('server/initialized', {
      serverInfo: {
        name: this.serverName,
        version: this.serverVersion
      }
    });
    
    console.error('[MCP] Playwright server initialized');
  }

  // Send JSON-RPC response
  sendResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id: id,
      result: result
    };
    console.log(JSON.stringify(response));
  }

  // Send JSON-RPC error
  sendError(id, code, message, data = null) {
    const error = {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: code,
        message: message,
        data: data
      }
    };
    console.log(JSON.stringify(error));
  }

  // Send JSON-RPC notification (no id, no response expected)
  sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };
    console.log(JSON.stringify(notification));
  }

  async handleRequest(request) {
    // Validate JSON-RPC request
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      this.sendError(request.id, -32600, 'Invalid Request: Missing or invalid jsonrpc field');
      return;
    }

    if (!request.method) {
      this.sendError(request.id, -32600, 'Invalid Request: Missing method field');
      return;
    }

    const { method, params, id } = request;
    
    try {
      // Handle different MCP methods
      switch (method) {
        case 'initialize':
          await this.handleInitialize(id, params);
          break;
          
        case 'initialized':
          // Client confirms initialization
          console.error('[MCP] Client initialization confirmed');
          break;
          
        case 'tools/list':
          await this.handleToolsList(id);
          break;
          
        case 'tools/call':
          await this.handleToolCall(id, params);
          break;
          
        case 'shutdown':
          await this.handleShutdown(id);
          break;
          
        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      console.error('[MCP] Error handling request:', error);
      this.sendError(id, -32603, 'Internal error', error.message);
    }
  }

  async handleInitialize(id, params) {
    // Send capabilities
    this.sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: {
        name: this.serverName,
        version: this.serverVersion
      }
    });
  }

  async handleToolsList(id) {
    const tools = [
      {
        name: 'browse',
        description: 'Navigate to a URL in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to save the screenshot'
            },
            fullPage: {
              type: 'boolean',
              description: 'Whether to capture the full page',
              default: false
            }
          }
        }
      },
      {
        name: 'inspect',
        description: 'Inspect an element on the page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element'
            }
          },
          required: ['selector']
        }
      },
      {
        name: 'visual_test',
        description: 'Perform comprehensive visual testing',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to test'
            },
            outputDir: {
              type: 'string',
              description: 'Directory for test outputs',
              default: './test-evidence'
            },
            testName: {
              type: 'string',
              description: 'Name for the test',
              default: 'visual-test'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'multi_viewport_test',
        description: 'Test across multiple viewport sizes',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to test'
            },
            outputDir: {
              type: 'string',
              description: 'Directory for test outputs',
              default: './test-evidence'
            },
            testName: {
              type: 'string',
              description: 'Name for the test',
              default: 'viewport-test'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'check_console',
        description: 'Check for console errors and network failures',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to check'
            }
          },
          required: ['url']
        }
      }
    ];

    this.sendResponse(id, { tools });
  }

  async handleToolCall(id, params) {
    const { name, arguments: args } = params;

    if (!name) {
      this.sendError(id, -32602, 'Invalid params: Missing tool name');
      return;
    }

    try {
      let result;
      
      switch (name) {
        case 'browse':
          result = await this.browse(args.url);
          break;
          
        case 'screenshot':
          result = await this.screenshot(args);
          break;
          
        case 'inspect':
          result = await this.inspect(args);
          break;
          
        case 'visual_test':
          result = await this.visualTest(args);
          break;
          
        case 'multi_viewport_test':
          result = await this.multiViewportTest(args);
          break;
          
        case 'check_console':
          result = await this.checkConsoleErrors(args);
          break;
          
        default:
          this.sendError(id, -32602, `Unknown tool: ${name}`);
          return;
      }

      this.sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      });
    } catch (error) {
      console.error(`[MCP] Error executing tool ${name}:`, error);
      this.sendError(id, -32603, `Tool execution failed: ${error.message}`);
    }
  }

  async handleShutdown(id) {
    console.error('[MCP] Shutdown requested');
    await this.close();
    this.sendResponse(id, {});
    process.exit(0);
  }

  // Tool implementations
  async browse(url) {
    if (!url) {
      throw new Error('URL is required');
    }

    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
    }
    
    await this.page.goto(url);
    return { success: true, url };
  }

  async screenshot(params = {}) {
    if (!this.page) {
      throw new Error('No page loaded. Call browse first.');
    }
    
    const screenshotPath = params.path || `screenshot-${Date.now()}.png`;
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: params.fullPage || false 
    });
    
    return { success: true, path: screenshotPath };
  }

  async inspect(params) {
    if (!this.page) {
      throw new Error('No page loaded. Call browse first.');
    }
    
    const selector = params.selector;
    if (!selector) {
      throw new Error('Selector is required');
    }

    const element = await this.page.$(selector);
    
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const text = await element.textContent();
    const isVisible = await element.isVisible();
    
    return { text, isVisible, selector };
  }

  async visualTest(params) {
    const { url, outputDir = './test-evidence', testName = 'visual-test' } = params;
    
    if (!url) {
      throw new Error('URL is required');
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Browse to URL
    await this.browse(url);
    
    // Take screenshot
    const screenshotPath = path.join(outputDir, `${testName}-${Date.now()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Get page title
    const title = await this.page.title();
    
    // Collect console errors
    const consoleErrors = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit for any console errors
    await this.page.waitForTimeout(1000);
    
    return {
      success: true,
      screenshot: screenshotPath,
      title,
      consoleErrors,
      url
    };
  }

  async multiViewportTest(params) {
    const { url, outputDir = './test-evidence', testName = 'viewport-test' } = params;
    
    if (!url) {
      throw new Error('URL is required');
    }

    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = [];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.page.goto(url);
      
      const screenshotPath = path.join(outputDir, `${testName}-${viewport.name}-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: false });
      
      results.push({
        viewport: viewport.name,
        screenshot: screenshotPath,
        dimensions: `${viewport.width}x${viewport.height}`
      });
    }
    
    return {
      success: true,
      results,
      url
    };
  }

  async checkConsoleErrors(params) {
    const { url } = params;
    
    if (!url) {
      throw new Error('URL is required');
    }

    const consoleMessages = [];
    const networkErrors = [];
    
    // Create fresh page for clean monitoring
    if (this.page) {
      await this.page.close();
    }
    
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
    }
    
    this.page = await this.context.newPage();
    
    // Set up console monitoring
    this.page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    // Set up network monitoring
    this.page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()
      });
    });
    
    await this.page.goto(url);
    await this.page.waitForTimeout(2000); // Wait for any async operations
    
    return {
      success: true,
      consoleMessages,
      networkErrors,
      hasErrors: consoleMessages.some(msg => msg.type === 'error') || networkErrors.length > 0
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

// Main server loop
const server = new PlaywrightMCPServer();

// Initialize server
server.initialize().catch(error => {
  console.error('[MCP] Failed to initialize:', error);
  process.exit(1);
});

// Handle incoming messages
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    await server.handleRequest(request);
  } catch (error) {
    console.error('[MCP] Failed to parse request:', error);
    // Send parse error if we can
    server.sendError(null, -32700, 'Parse error', error.message);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[MCP] SIGINT received, shutting down...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCP] SIGTERM received, shutting down...');
  await server.close();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[MCP] Uncaught exception:', error);
  server.close().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MCP] Unhandled rejection at:', promise, 'reason:', reason);
  server.close().then(() => process.exit(1));
});