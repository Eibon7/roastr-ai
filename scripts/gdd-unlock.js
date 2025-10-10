#!/usr/bin/env node
/**
 * GDD Unlock Utility
 *
 * Disables GDD 2.0 Maintenance Mode and re-enables all automation.
 * Creates a checkpoint for rollback before unlocking.
 *
 * Usage:
 *   node scripts/gdd-unlock.js
 *   node scripts/gdd-unlock.js --force    # Skip confirmation
 *   node scripts/gdd-unlock.js --dry-run  # Show what would be changed
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { disableMaintenanceMode, getMaintenanceConfig } = require('./gdd-maintenance-mode');

class GDDUnlocker {
  constructor(options = {}) {
    this.options = {
      force: options.force || false,
      dryRun: options.dryRun || false
    };
    this.rootDir = path.resolve(__dirname, '..');
    this.checkpointDir = null;
    this.changes = [];
  }

  /**
   * Main unlock flow
   */
  async unlock() {
    try {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  🔓 GDD 2.0 UNLOCK UTILITY                                ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');

      // 1. Check if maintenance mode is active
      const config = getMaintenanceConfig();
      if (!config.maintenance_mode) {
        console.log('⚠️  Maintenance mode is already DISABLED');
        console.log('   No action needed.\n');
        return { success: true, alreadyUnlocked: true };
      }

      console.log('📊 Current Status: MAINTENANCE MODE ACTIVE');
      console.log(`   Enabled: ${config.enabled_date}`);
      console.log(`   Snapshot: ${config.snapshot_reference}`);
      console.log('');

      // 2. Create checkpoint before unlock
      if (!this.options.dryRun) {
        console.log('💾 Creating checkpoint before unlock...');
        this.checkpointDir = await this.createCheckpoint();
        console.log(`   ✅ Checkpoint created: ${this.checkpointDir}`);
        console.log('');
      }

      // 3. Analyze what will be changed
      console.log('🔍 Analyzing changes...');
      await this.analyzeChanges();
      console.log(`   Found ${this.changes.length} items to unlock:`);

      this.changes.forEach((change, i) => {
        console.log(`   ${i + 1}. ${change.description}`);
      });
      console.log('');

      // 4. Confirm action (unless --force)
      if (!this.options.force && !this.options.dryRun) {
        console.log('⚠️  This will re-enable all GDD automation.');
        console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        await this.delay(5000);
      }

      // 5. Execute unlock
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN - Would execute these changes:');
        this.changes.forEach((change, i) => {
          console.log(`   ${i + 1}. ${change.action}`);
        });
      } else {
        console.log('🔧 Executing unlock...');
        await this.executeUnlock();
        console.log('   ✅ All changes applied');
      }
      console.log('');

      // 6. Verify unlock
      if (!this.options.dryRun) {
        console.log('✓ Verifying unlock...');
        const verified = await this.verifyUnlock();
        if (verified) {
          console.log('   ✅ Unlock verified successfully');
        } else {
          console.log('   ⚠️  Verification warnings (check logs)');
        }
        console.log('');
      }

      // 7. Summary
      console.log('╔════════════════════════════════════════════════════════════╗');
      if (this.options.dryRun) {
        console.log('║  🔍 DRY RUN COMPLETE                                      ║');
        console.log(`║     Would unlock: ${String(this.changes.length).padEnd(2)} items                               ║`);
      } else {
        console.log('║  ✅ GDD 2.0 UNLOCKED SUCCESSFULLY                         ║');
        console.log('║                                                            ║');
        console.log('║  All automation re-enabled:                                ║');
        console.log('║  • Auto-repair: ACTIVE ✅                                 ║');
        console.log('║  • Issue creation: ACTIVE ✅                              ║');
        console.log('║  • File modifications: ACTIVE ✅                          ║');
      }
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');

      if (!this.options.dryRun) {
        console.log(`💾 Rollback checkpoint: ${this.checkpointDir}`);
        console.log('');
        console.log('To rollback: node scripts/rollback-gdd-repair.js');
        console.log('');
      }

      return {
        success: true,
        changes: this.changes.length,
        checkpoint: this.checkpointDir
      };

    } catch (error) {
      console.error('❌ Unlock failed:', error.message);
      if (!this.options.dryRun && this.checkpointDir) {
        console.log('');
        console.log('💾 Checkpoint preserved for manual recovery:');
        console.log(`   ${this.checkpointDir}`);
      }
      throw error;
    }
  }

  /**
   * Create checkpoint before unlock
   */
  async createCheckpoint() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointDir = path.join('/tmp', 'gdd-unlock-checkpoints', timestamp);

    await fs.mkdir(checkpointDir, { recursive: true });

    // Backup critical files
    const filesToBackup = [
      '.gdd-maintenance',
      'docs/system-map.yaml',
      'docs/GDD-FINAL-SUMMARY.md',
      'docs/nodes/roast.md' // Sample node with protection metadata
    ];

    for (const file of filesToBackup) {
      const sourcePath = path.join(this.rootDir, file);
      const destPath = path.join(checkpointDir, file);

      try {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
      } catch (error) {
        // File might not exist
      }
    }

    // Create manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      action: 'unlock',
      maintenance_config: getMaintenanceConfig(),
      files: filesToBackup
    };

    await fs.writeFile(
      path.join(checkpointDir, 'checkpoint-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    return checkpointDir;
  }

  /**
   * Analyze what will be changed
   */
  async analyzeChanges() {
    this.changes = [
      {
        description: 'Disable maintenance mode',
        action: 'Update .gdd-maintenance to set maintenance_mode=false',
        type: 'config'
      },
      {
        description: 'Re-enable auto-repair',
        action: 'Auto-repair will run in normal mode (not dry-run)',
        type: 'behavior'
      },
      {
        description: 'Re-enable issue creation',
        action: 'Drift prediction can create GitHub issues',
        type: 'behavior'
      },
      {
        description: 'Remove protection metadata (optional)',
        action: 'Protected flags in system-map.yaml and nodes can be removed',
        type: 'metadata'
      }
    ];
  }

  /**
   * Execute unlock changes
   */
  async executeUnlock() {
    // 1. Disable maintenance mode
    disableMaintenanceMode();

    // 2. Log unlock event
    await this.logUnlockEvent();

    // 3. Update metrics
    await this.updateMetrics();
  }

  /**
   * Log unlock event
   */
  async logUnlockEvent() {
    const logPath = path.join(this.rootDir, 'docs', 'gdd-maintenance-history.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'UNLOCK',
      reason: 'manual',
      checkpoint: this.checkpointDir,
      user: process.env.USER || 'unknown'
    };

    try {
      let logs = [];
      try {
        const existingLog = await fs.readFile(logPath, 'utf-8');
        logs = JSON.parse(existingLog);
      } catch (error) {
        // No existing log
      }

      logs.push(logEntry);
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.warn('⚠️  Could not write log:', error.message);
    }
  }

  /**
   * Update metrics after unlock
   */
  async updateMetrics() {
    try {
      const statusPath = path.join(this.rootDir, 'gdd-status.json');
      const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));

      status.maintenance_mode = false;
      status.unlocked_at = new Date().toISOString();
      status.checkpoint = this.checkpointDir;

      await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
    } catch (error) {
      // Status file might not exist
    }
  }

  /**
   * Verify unlock successful
   */
  async verifyUnlock() {
    const config = getMaintenanceConfig();
    return config.maintenance_mode === false;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GDD Unlock Utility

Disables GDD 2.0 Maintenance Mode and re-enables all automation.

Usage:
  node scripts/gdd-unlock.js [options]

Options:
  --force      Skip confirmation prompt
  --dry-run    Show what would be changed without applying
  --help, -h   Show this help message

Examples:
  # Interactive unlock (with confirmation)
  node scripts/gdd-unlock.js

  # Force unlock without confirmation
  node scripts/gdd-unlock.js --force

  # See what would be changed
  node scripts/gdd-unlock.js --dry-run

Notes:
  - Creates a checkpoint before unlock for rollback
  - All GDD automation will be re-enabled
  - Use with caution on production systems
    `);
    process.exit(0);
  }

  const unlocker = new GDDUnlocker(options);
  const result = await unlocker.unlock();

  if (options.dryRun || result.alreadyUnlocked) {
    process.exit(0);
  }

  if (!result.success) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { GDDUnlocker };
