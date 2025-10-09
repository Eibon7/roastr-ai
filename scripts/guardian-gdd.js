#!/usr/bin/env node

/**
 * Guardian Agent - Product Governance Layer
 *
 * Monitors and protects sensitive changes in product logic and documentation.
 * Part of GDD 2.0 Phase 16: Guardian Agent Core
 *
 * Usage:
 *   node scripts/guardian-gdd.js [options]
 *
 * Options:
 *   --full         Full system scan
 *   --check        Quick validation
 *   --report       Generate markdown report
 *   --ci           CI mode (strict exit codes)
 *   --help         Show help
 *
 * Exit Codes:
 *   0 - All checks passed (SAFE)
 *   1 - Warnings detected (SENSITIVE - requires review)
 *   2 - Critical violations (CRITICAL - blocked)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('yaml');

// ============================================================
// Configuration
// ============================================================

const PRODUCT_GUARD_CONFIG = path.join(__dirname, '../config/product-guard.yaml');
const AUDIT_LOG_PATH = path.join(__dirname, '../docs/guardian/audit-log.md');
const CASES_DIR = path.join(__dirname, '../docs/guardian/cases');
const DIFFS_DIR = path.join(__dirname, '../docs/guardian/diffs');

// ============================================================
// CLI Arguments
// ============================================================

const args = process.argv.slice(2);
const flags = {
  full: args.includes('--full'),
  check: args.includes('--check'),
  report: args.includes('--report'),
  ci: args.includes('--ci'),
  help: args.includes('--help')
};

// ============================================================
// Guardian Engine Class
// ============================================================

class GuardianEngine {
  constructor() {
    this.config = null;
    this.violations = {
      critical: [],
      sensitive: [],
      safe: []
    };
    this.changesSummary = {
      total_files: 0,
      total_lines_added: 0,
      total_lines_removed: 0,
      domains_affected: new Set()
    };
  }

  /**
   * Load product guard configuration
   */
  loadConfig() {
    try {
      const configContent = fs.readFileSync(PRODUCT_GUARD_CONFIG, 'utf8');
      this.config = yaml.parse(configContent);
      console.log('✅ Configuration loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      return false;
    }
  }

  /**
   * Get git diff for current changes
   */
  getGitDiff() {
    try {
      // Get staged changes first
      let diff = execSync('git diff --cached --name-status', { encoding: 'utf8' });

      // If no staged changes (empty output), check unstaged changes
      if (!diff.trim()) {
        diff = execSync('git diff --name-status', { encoding: 'utf8' });
      }

      if (!diff.trim()) {
        console.log('ℹ️  No changes detected');
        return [];
      }

      // Parse diff output
      const changes = diff.trim().split('\n').map(line => {
        const [status, ...fileParts] = line.split('\t');
        const file = fileParts.join('\t');
        return { status, file };
      });

      this.changesSummary.total_files = changes.length;
      console.log(`📊 Detected ${changes.length} changed file(s)`);

      return changes;
    } catch (error) {
      console.error('❌ Failed to get git diff:', error.message);
      return null; // Signal error (distinguishable from valid empty array)
    }
  }

  /**
   * Get detailed diff for a file
   */
  getFileDiff(file) {
    try {
      // Try staged first, fallback to unstaged
      let diff = '';
      try {
        diff = execSync(`git diff --cached -- "${file}"`, { encoding: 'utf8' });
      } catch (e) {
        diff = execSync(`git diff -- "${file}"`, { encoding: 'utf8' });
      }

      // Count lines (exclude diff headers +++ and ---)
      const lines = diff.split('\n');
      const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

      this.changesSummary.total_lines_added += added;
      this.changesSummary.total_lines_removed += removed;

      return { diff, added, removed };
    } catch (error) {
      return { diff: '', added: 0, removed: 0 };
    }
  }

  /**
   * Classify a file change
   */
  classifyChange(file, fileDiff) {
    const domains = this.config.domains;
    let highestSeverity = 'SAFE';
    const matchedDomains = [];

    // Check each domain
    for (const [domainName, domain] of Object.entries(domains)) {
      let matched = false;

      // 1. Check file path match
      if (domain.files) {
        for (const protectedFile of domain.files) {
          if (file.includes(protectedFile) || protectedFile.includes(file)) {
            matched = true;
            break;
          }
        }
      }

      // 2. Check keyword match in diff
      if (!matched && domain.keywords && fileDiff.diff) {
        const diffLower = fileDiff.diff.toLowerCase();
        for (const keyword of domain.keywords) {
          if (diffLower.includes(keyword.toLowerCase())) {
            matched = true;
            break;
          }
        }
      }

      // Record match
      if (matched) {
        matchedDomains.push(domainName);
        this.changesSummary.domains_affected.add(domainName);

        // Update severity (CRITICAL > SENSITIVE > SAFE)
        if (domain.protection_level === 'CRITICAL') {
          highestSeverity = 'CRITICAL';
        } else if (domain.protection_level === 'SENSITIVE' && highestSeverity !== 'CRITICAL') {
          highestSeverity = 'SENSITIVE';
        }
      }
    }

    return {
      severity: highestSeverity,
      domains: matchedDomains,
      file,
      ...fileDiff
    };
  }

  /**
   * Scan all changes
   */
  scan() {
    console.log('\n🔍 Guardian Agent - Scanning for sensitive changes...\n');

    // Load config
    if (!this.loadConfig()) {
      return 2; // Critical error
    }

    // Get changes
    const changes = this.getGitDiff();

    // Check for error state (null) first
    if (changes === null) {
      console.error('❌ Guardian scan failed to read git changes.');
      console.error('   This is a blocking error. Fix git setup and retry.\n');
      return 2; // Critical error - block
    }

    // Check for valid empty array (no changes)
    if (changes.length === 0) {
      console.log('✅ No changes to scan\n');
      return 0; // Safe
    }

    // Analyze each change
    for (const change of changes) {
      const { file } = change;
      const fileDiff = this.getFileDiff(file);
      const classification = this.classifyChange(file, fileDiff);

      // Store violation
      if (classification.severity === 'CRITICAL') {
        this.violations.critical.push(classification);
      } else if (classification.severity === 'SENSITIVE') {
        this.violations.sensitive.push(classification);
      } else {
        this.violations.safe.push(classification);
      }
    }

    // Print results
    this.printResults();

    // Generate audit log
    this.generateAuditLog();

    // Determine exit code
    if (this.violations.critical.length > 0) {
      return 2; // Critical - block
    } else if (this.violations.sensitive.length > 0) {
      return 1; // Sensitive - review required
    } else {
      return 0; // Safe
    }
  }

  /**
   * Print scan results
   */
  printResults() {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  Guardian Scan Results                        ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    // Summary
    console.log(`║ Total Files Changed: ${this.changesSummary.total_files}`.padEnd(64) + '║');
    console.log(`║ Lines Added: ${this.changesSummary.total_lines_added}`.padEnd(64) + '║');
    console.log(`║ Lines Removed: ${this.changesSummary.total_lines_removed}`.padEnd(64) + '║');
    console.log(`║ Domains Affected: ${Array.from(this.changesSummary.domains_affected).join(', ')}`.padEnd(64) + '║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    // Violations by severity
    const criticalCount = this.violations.critical.length;
    const sensitiveCount = this.violations.sensitive.length;
    const safeCount = this.violations.safe.length;

    if (criticalCount > 0) {
      console.log(`║ 🔴 CRITICAL: ${criticalCount} violation(s) - BLOCKED`.padEnd(64) + '║');
      this.violations.critical.forEach(v => {
        console.log(`║   • ${v.file} (${v.domains.join(', ')})`.padEnd(64) + '║');
      });
    }

    if (sensitiveCount > 0) {
      console.log(`║ 🟡 SENSITIVE: ${sensitiveCount} change(s) - REVIEW REQUIRED`.padEnd(64) + '║');
      this.violations.sensitive.forEach(v => {
        console.log(`║   • ${v.file} (${v.domains.join(', ')})`.padEnd(64) + '║');
      });
    }

    if (safeCount > 0) {
      console.log(`║ 🟢 SAFE: ${safeCount} change(s) - APPROVED`.padEnd(64) + '║');
    }

    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // Final status
    if (criticalCount > 0) {
      console.log('❌ CRITICAL VIOLATIONS DETECTED - Merge blocked');
      console.log('   → Required: Product Owner approval');
      console.log('   → See audit log for details\n');
    } else if (sensitiveCount > 0) {
      console.log('⚠️  SENSITIVE CHANGES DETECTED - Manual review required');
      console.log('   → Required: Tech Lead approval');
      console.log('   → See audit log for details\n');
    } else {
      console.log('✅ All changes approved - Safe to merge\n');
    }
  }

  /**
   * Generate audit log
   */
  generateAuditLog() {
    const timestamp = new Date().toISOString();
    const caseId = timestamp.replace(/[:.]/g, '-').split('T').join('-').substring(0, 19);

    // Create audit log entry
    const allViolations = [
      ...this.violations.critical,
      ...this.violations.sensitive,
      ...this.violations.safe
    ];

    if (allViolations.length === 0) {
      return; // Nothing to log
    }

    // Initialize audit log if it doesn't exist
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });

      const header = `# Guardian Audit Log

**Generated:** ${timestamp}

This file contains a chronological record of all Guardian Agent events.

| Timestamp | Case ID | Actor | Domains | Files | Severity | Action | Notes |
|-----------|---------|-------|---------|-------|----------|--------|-------|
`;
      fs.writeFileSync(AUDIT_LOG_PATH, header);
    }

    // Append to audit log
    const actor = process.env.USER || 'unknown';
    const domains = Array.from(this.changesSummary.domains_affected).join(', ') || 'none';
    const files = allViolations.length;
    const severity = this.violations.critical.length > 0 ? 'CRITICAL' :
                     this.violations.sensitive.length > 0 ? 'SENSITIVE' : 'SAFE';
    const action = severity === 'CRITICAL' ? 'BLOCKED' :
                   severity === 'SENSITIVE' ? 'REVIEW' : 'APPROVED';
    const notes = severity === 'CRITICAL' ? 'Requires Product Owner approval' :
                  severity === 'SENSITIVE' ? 'Requires Tech Lead review' : 'Auto-approved';

    const logEntry = `| ${timestamp} | ${caseId} | ${actor} | ${domains} | ${files} | ${severity} | ${action} | ${notes} |\n`;

    fs.appendFileSync(AUDIT_LOG_PATH, logEntry);

    // Create case file
    // Ensure cases directory exists
    fs.mkdirSync(CASES_DIR, { recursive: true });

    const caseFile = path.join(CASES_DIR, `${caseId}.json`);
    const caseData = {
      case_id: caseId,
      timestamp,
      actor,
      domains: Array.from(this.changesSummary.domains_affected),
      files_changed: allViolations.map(v => v.file),
      severity,
      action,
      violations: {
        critical: this.violations.critical.length,
        sensitive: this.violations.sensitive.length,
        safe: this.violations.safe.length
      },
      details: allViolations.map(v => ({
        file: v.file,
        domains: v.domains,
        severity: v.severity,
        lines_added: v.added,
        lines_removed: v.removed
      })),
      approval_required: severity !== 'SAFE',
      approved_by: null,
      notes
    };

    fs.writeFileSync(caseFile, JSON.stringify(caseData, null, 2));

    console.log(`📝 Audit log updated: ${AUDIT_LOG_PATH}`);
    console.log(`📁 Case file created: ${caseFile}\n`);

    // Send notification for CRITICAL/SENSITIVE cases (Phase 17)
    if (severity !== 'SAFE') {
      this.sendNotification(caseId);
    }
  }

  /**
   * Send email notification for case (Phase 17)
   */
  sendNotification(caseId) {
    try {
      console.log(`📧 Sending notification for case: ${caseId}`);
      const notifyScript = path.join(__dirname, 'notify-guardian.js');
      execSync(`node "${notifyScript}" --case-id=${caseId}`, {
        stdio: 'inherit',
        env: { ...process.env }
      });
      console.log(`✅ Notification sent successfully`);
    } catch (error) {
      console.error(`⚠️  Failed to send notification: ${error.message}`);
      console.error(`   (Continuing without notification)`);
    }
  }

  /**
   * Generate markdown report
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const reportPath = path.join(__dirname, '../docs/guardian/guardian-report.md');

    // Ensure directory exists
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });

    const report = `# Guardian Scan Report

**Generated:** ${timestamp}

## Summary

- **Total Files Changed:** ${this.changesSummary.total_files}
- **Lines Added:** ${this.changesSummary.total_lines_added}
- **Lines Removed:** ${this.changesSummary.total_lines_removed}
- **Domains Affected:** ${Array.from(this.changesSummary.domains_affected).join(', ') || 'None'}

## Violations

### 🔴 Critical (${this.violations.critical.length})

${this.violations.critical.length > 0 ? this.violations.critical.map(v => `
- **File:** ${v.file}
- **Domains:** ${v.domains.join(', ')}
- **Changes:** +${v.added} -${v.removed} lines
`).join('\n') : '_None_'}

### 🟡 Sensitive (${this.violations.sensitive.length})

${this.violations.sensitive.length > 0 ? this.violations.sensitive.map(v => `
- **File:** ${v.file}
- **Domains:** ${v.domains.join(', ')}
- **Changes:** +${v.added} -${v.removed} lines
`).join('\n') : '_None_'}

### 🟢 Safe (${this.violations.safe.length})

${this.violations.safe.length > 0 ? this.violations.safe.map(v => `
- **File:** ${v.file}
`).join('\n') : '_None_'}

## Recommendation

${this.violations.critical.length > 0 ? '❌ **BLOCK MERGE** - Critical violations detected. Product Owner approval required.' :
  this.violations.sensitive.length > 0 ? '⚠️ **MANUAL REVIEW** - Sensitive changes detected. Tech Lead approval required.' :
  '✅ **APPROVE** - All changes are safe to merge.'}

---

*Generated by Guardian Agent - GDD 2.0 Phase 16*
`;

    fs.writeFileSync(reportPath, report);
    console.log(`📄 Report generated: ${reportPath}`);
  }
}

// ============================================================
// Main Execution
// ============================================================

function main() {
  if (flags.help) {
    console.log(`
Guardian Agent - Product Governance Layer

Usage:
  node scripts/guardian-gdd.js [options]

Options:
  --full         Full system scan
  --check        Quick validation
  --report       Generate markdown report
  --ci           CI mode (strict exit codes)
  --help         Show help

Exit Codes:
  0 - All checks passed (SAFE)
  1 - Warnings detected (SENSITIVE - requires review)
  2 - Critical violations (CRITICAL - blocked)

Examples:
  node scripts/guardian-gdd.js --full
  node scripts/guardian-gdd.js --ci
  node scripts/guardian-gdd.js --report
`);
    process.exit(0);
  }

  const guardian = new GuardianEngine();
  const exitCode = guardian.scan();

  if (flags.report) {
    guardian.generateReport();
  }

  if (flags.ci) {
    process.exit(exitCode);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GuardianEngine };
