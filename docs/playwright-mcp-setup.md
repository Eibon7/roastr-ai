# Playwright MCP Server Setup

## Overview

The Playwright MCP Server has been configured for automated visual testing and frontend validation in the roastr-ai project.

## Configuration

1. **MCP Configuration**: Located at `~/.config/claude/mcp.json`

   ```json
   {
     "servers": {
       "playwright": {
         "command": "node",
         "args": ["/Users/emiliopostigo/roastr-ai/playwright-mcp-server.js"],
         "name": "Playwright Server",
         "description": "MCP server for Playwright browser automation and visual testing"
       }
     }
   }
   ```

2. **Server Location**: `/Users/emiliopostigo/roastr-ai/playwright-mcp-server.js`

## Available Methods

### 1. browse

Navigate to a URL

```json
{ "method": "browse", "params": { "url": "http://localhost:3000" } }
```

### 2. screenshot

Take a screenshot of the current page

```json
{ "method": "screenshot", "params": { "path": "./screenshot.png", "fullPage": true } }
```

### 3. visual_test

Comprehensive visual testing with error detection

```json
{
  "method": "visual_test",
  "params": {
    "url": "http://localhost:3000",
    "outputDir": "./test-evidence",
    "testName": "homepage-test"
  }
}
```

### 4. multi_viewport_test

Test across multiple viewport sizes (mobile, tablet, desktop)

```json
{
  "method": "multi_viewport_test",
  "params": {
    "url": "http://localhost:3000",
    "outputDir": "./test-evidence",
    "testName": "responsive-test"
  }
}
```

### 5. check_console

Check for console errors and network failures

```json
{ "method": "check_console", "params": { "url": "http://localhost:3000" } }
```

### 6. inspect

Inspect an element on the page

```json
{ "method": "inspect", "params": { "selector": "#main-header" } }
```

### 7. close

Close the browser instance

```json
{ "method": "close", "params": {} }
```

## Usage in Claude Code

1. **Verify MCP is loaded**:

   ```
   /mcp list
   ```

2. **Execute visual tests**:

   ```
   /mcp exec playwright visual_test {"url":"http://localhost:3000","outputDir":"./test-evidence","testName":"ui-validation"}
   ```

3. **Multi-viewport testing**:
   ```
   /mcp exec playwright multi_viewport_test {"url":"http://localhost:3000","outputDir":"./test-evidence","testName":"responsive-check"}
   ```

## Testing

Run the test script to verify the setup:

```bash
node scripts/test-playwright-mcp.js
```

## Integration with CLAUDE.md

As per the project's orchestration rules, the Playwright MCP server should be used:

- After any frontend changes
- To validate UI implementations against specifications
- To capture visual evidence for PR documentation
- To check for console errors and network issues

## Test Evidence

All screenshots and test results are saved in:

- `./test-evidence/` - For visual test outputs
- `./docs/ui-review.md` - For comprehensive UI review reports

## Troubleshooting

1. **MCP not found**: Restart Claude Code after updating mcp.json
2. **Playwright errors**: Ensure Playwright is installed: `npm install --save-dev playwright`
3. **Permission denied**: Make sure the server file is executable: `chmod +x playwright-mcp-server.js`
