#!/usr/bin/env node

/**
 * Agent Receipt Validator for CI
 *
 * Validates that all required agents have receipts (normal or SKIPPED) in PRs.
 * Fails build if receipts are missing.
 *
 * Usage:
 *   node scripts/ci/require-agent-receipts.js
 *
 * Environment variables:
 *   GITHUB_BASE_REF - Base branch for PR (e.g., "main")
 *   GITHUB_EVENT_PATH - Path to GitHub event JSON (contains labels)
 *   GITHUB_HEAD_REF - Head branch for PR
 *   PR_NUMBER - PR number (optional, for better error messages)
 *
 * Exit codes:
 *   0 - All required agents have receipts
 *   1 - Missing receipts or validation errors
 *
 * @note LOGGING GUIDELINE EXCEPTION
 * This CI script uses console.log with ANSI colors instead of utils/logger.js.
 * Rationale:
 * - CI scripts require colored terminal output for readability
 * - utils/logger.js does not currently support ANSI color codes
 * - Colored output is critical for quick visual scanning of CI results
 * - This is a CI tool, not production logging (different requirements)
 * Exception approved: CodeRabbit Review #3354598820 (C1 comment)
 * Future: Consider extending logger with color support for CI tools
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for terminal output (CI script exception)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  // Using console.log here is intentional (see header comment for exception rationale)
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadManifest() {
  const manifestPath = path.join(__dirname, '../../agents/manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    log('❌ ERROR: agents/manifest.yaml not found', 'red');
    process.exit(1);
  }

  try {
    const yaml = require('js-yaml');
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = yaml.load(content);

    if (!manifest || !manifest.agents) {
      log('❌ ERROR: Invalid manifest format (missing agents array)', 'red');
      process.exit(1);
    }

    return manifest.agents;
  } catch (error) {
    log(`❌ ERROR: Failed to parse manifest: ${error.message}`, 'red');
    process.exit(1);
  }
}

function getChangedFiles() {
  const baseBranch = process.env.GITHUB_BASE_REF || 'main';

  try {
    // Fetch latest from base branch
    execSync(`git fetch origin ${baseBranch}:${baseBranch}`, { stdio: 'pipe' });

    // Get list of changed files
    const output = execSync(`git diff --name-only origin/${baseBranch}...HEAD`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const files = output.trim().split('\n').filter(f => f.length > 0);
    log(`📂 Found ${files.length} changed files`, 'cyan');

    return files;
  } catch (error) {
    log(`⚠️  WARNING: Could not get changed files: ${error.message}`, 'yellow');
    log('   Assuming local development mode, checking all files', 'yellow');

    // Fallback: use git status for local development
    try {
      const output = execSync('git diff --name-only HEAD', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return output.trim().split('\n').filter(f => f.length > 0);
    } catch (fallbackError) {
      log('   No changed files detected', 'yellow');
      return [];
    }
  }
}

function getPRLabels() {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath || !fs.existsSync(eventPath)) {
    log('⚠️  WARNING: GITHUB_EVENT_PATH not found, cannot read labels', 'yellow');
    return [];
  }

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const labels = event.pull_request?.labels?.map(l => l.name) || [];
    log(`🏷️  Found ${labels.length} PR labels: ${labels.join(', ')}`, 'cyan');
    return labels;
  } catch (error) {
    log(`⚠️  WARNING: Could not parse event JSON: ${error.message}`, 'yellow');
    return [];
  }
}

function matchesPattern(file, pattern) {
  // Simple glob-like matching
  // Supports: *.js, **/*.js, exact paths

  if (pattern === '*') {
    return true;
  }

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(file);
}

function identifyRequiredAgents(agents, changedFiles, labels) {
  const required = new Set();
  const reasons = {};

  agents.forEach(agent => {
    const triggers = agent.triggers || {};
    const agentLabels = triggers.labels || [];
    const diffIncludes = triggers.diffIncludes || [];

    // Check label triggers
    agentLabels.forEach(labelPattern => {
      if (labelPattern === '*') {
        // Wildcard - matches any label
        if (labels.length > 0) {
          required.add(agent.name);
          reasons[agent.name] = reasons[agent.name] || [];
          reasons[agent.name].push(`label: * (wildcard, ${labels.length} labels present)`);
        }
      } else if (labelPattern.includes('*')) {
        // Pattern like "area:*"
        const prefix = labelPattern.replace('*', '');
        const matched = labels.filter(l => l.startsWith(prefix));
        if (matched.length > 0) {
          required.add(agent.name);
          reasons[agent.name] = reasons[agent.name] || [];
          reasons[agent.name].push(`label: ${matched.join(', ')}`);
        }
      } else {
        // Exact match
        if (labels.includes(labelPattern)) {
          required.add(agent.name);
          reasons[agent.name] = reasons[agent.name] || [];
          reasons[agent.name].push(`label: ${labelPattern}`);
        }
      }
    });

    // Check diff triggers
    diffIncludes.forEach(pattern => {
      const matched = changedFiles.filter(f => matchesPattern(f, pattern));
      if (matched.length > 0) {
        required.add(agent.name);
        reasons[agent.name] = reasons[agent.name] || [];
        reasons[agent.name].push(`diff: ${pattern} (${matched.length} files)`);
      }
    });
  });

  return { required: Array.from(required), reasons };
}

function findReceipt(agentName, prNumber) {
  const receiptsDir = path.join(__dirname, '../../docs/agents/receipts');

  if (!fs.existsSync(receiptsDir)) {
    return null;
  }

  // Try to find receipt with PR number if provided
  if (prNumber) {
    const normalReceipt = path.join(receiptsDir, `${prNumber}-${agentName}.md`);
    const skippedReceipt = path.join(receiptsDir, `${prNumber}-${agentName}-SKIPPED.md`);

    if (fs.existsSync(normalReceipt)) {
      return { type: 'normal', path: normalReceipt };
    }
    if (fs.existsSync(skippedReceipt)) {
      return { type: 'skipped', path: skippedReceipt };
    }
  }

  // Fallback: search for any receipt matching agent name (for local dev)
  const files = fs.readdirSync(receiptsDir);
  const normalPattern = new RegExp(`\\d+-${agentName}\\.md$`);
  const skippedPattern = new RegExp(`\\d+-${agentName}-SKIPPED\\.md$`);

  const normal = files.find(f => normalPattern.test(f));
  if (normal) {
    return { type: 'normal', path: path.join(receiptsDir, normal) };
  }

  const skipped = files.find(f => skippedPattern.test(f));
  if (skipped) {
    return { type: 'skipped', path: path.join(receiptsDir, skipped) };
  }

  return null;
}

function validateReceipts(requiredAgents, reasons, prNumber) {
  log('\n📋 Validating agent receipts...', 'cyan');

  if (requiredAgents.length === 0) {
    log('✅ No agents required for this PR', 'green');
    return true;
  }

  log(`\n🔍 Required agents (${requiredAgents.length}):`, 'blue');
  requiredAgents.forEach(agent => {
    log(`   • ${agent}`, 'blue');
    if (reasons[agent]) {
      reasons[agent].forEach(reason => {
        log(`     └─ ${reason}`, 'cyan');
      });
    }
  });

  log('\n📄 Checking receipts...', 'cyan');

  const missing = [];
  const found = [];

  requiredAgents.forEach(agent => {
    const receipt = findReceipt(agent, prNumber);

    if (receipt) {
      const relPath = path.relative(process.cwd(), receipt.path);
      if (receipt.type === 'normal') {
        log(`   ✅ ${agent}: ${relPath}`, 'green');
      } else {
        log(`   ⚠️  ${agent}: ${relPath} (SKIPPED)`, 'yellow');
      }
      found.push(agent);
    } else {
      log(`   ❌ ${agent}: NO RECEIPT FOUND`, 'red');
      missing.push(agent);
    }
  });

  if (missing.length > 0) {
    log('\n❌ VALIDATION FAILED', 'red');
    log(`\n${missing.length} agent(s) missing receipts:`, 'red');
    missing.forEach(agent => {
      log(`   • ${agent}`, 'red');
    });

    log('\n📝 To fix:', 'yellow');
    log('   1. For each missing agent:', 'yellow');
    log('      a) If agent was invoked:', 'yellow');
    log(`         - Create: docs/agents/receipts/${prNumber || 'XXX'}-<AgentName>.md`, 'yellow');
    log('         - Use template: docs/agents/receipts/_TEMPLATE.md', 'yellow');
    log('      b) If agent should be skipped:', 'yellow');
    log(`         - Create: docs/agents/receipts/${prNumber || 'XXX'}-<AgentName>-SKIPPED.md`, 'yellow');
    log('         - Use template: docs/agents/receipts/_TEMPLATE-SKIPPED.md', 'yellow');
    log('   2. Commit and push receipts', 'yellow');
    log('   3. Re-run CI', 'yellow');

    return false;
  }

  log('\n✅ ALL RECEIPTS VALID', 'green');
  log(`   ${found.length} agent(s) have receipts`, 'green');

  return true;
}

function main() {
  log('🤖 Agent Receipt Validator', 'cyan');
  log('=' .repeat(50), 'cyan');

  // Get PR number from environment or git branch
  let prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const match = branch.match(/(\d+)/);
      if (match) {
        prNumber = match[1];
      }
    } catch (error) {
      // Ignore
    }
  }

  if (prNumber) {
    log(`📌 PR Number: #${prNumber}`, 'cyan');
  } else {
    log('⚠️  PR Number not detected (using fallback search)', 'yellow');
  }

  // Load manifest
  log('\n📖 Loading agent manifest...', 'cyan');
  const agents = loadManifest();
  log(`   Found ${agents.length} agents in manifest`, 'green');

  // Get changed files
  const changedFiles = getChangedFiles();

  // Get PR labels
  const labels = getPRLabels();

  // Identify required agents
  log('\n🔎 Identifying required agents...', 'cyan');
  const { required, reasons } = identifyRequiredAgents(agents, changedFiles, labels);

  // Validate receipts
  const valid = validateReceipts(required, reasons, prNumber);

  if (!valid) {
    log('\n💡 See CLAUDE.md "Lead Orchestrator Rules" for agent invocation protocol', 'blue');
    process.exit(1);
  }

  log('\n✅ Validation complete', 'green');
  process.exit(0);
}

// Run
main();
