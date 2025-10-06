#!/usr/bin/env node

/**
 * GDD Auto-Repair Rollback System
 *
 * Rollback auto-repair changes to previous backup state.
 *
 * Usage:
 *   node scripts/rollback-gdd-repair.js --last         # Rollback last repair
 *   node scripts/rollback-gdd-repair.js --timestamp <timestamp>
 *   node scripts/rollback-gdd-repair.js --list         # List backups
 *   node scripts/rollback-gdd-repair.js --verify <timestamp>
 */

const fs = require('fs').promises;
const path = require('path');

class RollbackEngine {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.backupsRoot = path.join('/tmp', 'gdd-auto-repair-backups');
  }

  async rollback(timestamp) {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('      ↩️  GDD AUTO-REPAIR ROLLBACK');
    console.log('═══════════════════════════════════════════');
    console.log('');

    // Pre-flight safety checks
    await this.performPreFlightChecks();

    const backupDir = timestamp === 'last'
      ? await this.getLastBackup()
      : path.join(this.backupsRoot, timestamp);

    // Verify backup exists
    const manifest = await this.loadManifest(backupDir);
    if (!manifest) {
      console.error(`❌ Backup not found: ${backupDir}`);
      return false;
    }

    console.log(`📦 Restoring from: ${backupDir}`);
    console.log(`📅 Created: ${manifest.timestamp}`);
    console.log(`📊 Health before: ${manifest.health_before}/100`);
    console.log('');

    // Restore files
    let restored = 0;
    for (const file of manifest.files) {
      const sourcePath = path.join(backupDir, file);
      const destPath = path.join(this.rootDir, file);

      try {
        await fs.copyFile(sourcePath, destPath);
        restored++;
      } catch (error) {
        console.warn(`⚠️  Failed to restore: ${file}`);
      }
    }

    console.log(`✅ Restored ${restored}/${manifest.files.length} files`);
    console.log('');

    // Log rollback
    await this.logRollback(backupDir, manifest);

    console.log('═══════════════════════════════════════════');
    console.log('✅ ROLLBACK COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log('');

    return true;
  }

  async listBackups() {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('      📦 AVAILABLE BACKUPS');
    console.log('═══════════════════════════════════════════');
    console.log('');

    try {
      const backups = await fs.readdir(this.backupsRoot);
      const sorted = backups.sort().reverse();

      if (sorted.length === 0) {
        console.log('No backups found.');
        console.log('');
        return;
      }

      for (const backup of sorted) {
        const backupDir = path.join(this.backupsRoot, backup);
        const manifest = await this.loadManifest(backupDir);

        if (manifest) {
          console.log(`📦 ${backup}`);
          console.log(`   Created: ${manifest.timestamp}`);
          console.log(`   Trigger: ${manifest.trigger}`);
          console.log(`   Health: ${manifest.health_before}/100`);
          console.log(`   Files: ${manifest.files.length}`);
          console.log('');
        }
      }
    } catch (error) {
      console.log('No backups directory found.');
      console.log('');
    }
  }

  async verify(timestamp) {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('      ✓ VERIFY BACKUP');
    console.log('═══════════════════════════════════════════');
    console.log('');

    const backupDir = path.join(this.backupsRoot, timestamp);
    const manifest = await this.loadManifest(backupDir);

    if (!manifest) {
      console.error(`❌ Backup not found: ${timestamp}`);
      return false;
    }

    console.log(`📦 Backup: ${timestamp}`);
    console.log(`📅 Created: ${manifest.timestamp}`);
    console.log('');

    let verified = 0;
    let missing = 0;

    for (const file of manifest.files) {
      const filePath = path.join(backupDir, file);
      try {
        await fs.access(filePath);
        verified++;
      } catch (error) {
        console.warn(`❌ Missing: ${file}`);
        missing++;
      }
    }

    console.log(`✅ Verified: ${verified}/${manifest.files.length} files`);
    if (missing > 0) {
      console.log(`❌ Missing: ${missing} files`);
    }
    console.log('');

    const isValid = missing === 0;
    console.log(isValid ? '✅ Backup is valid' : '❌ Backup is incomplete');
    console.log('');

    return isValid;
  }

  async getLastBackup() {
    const backups = await fs.readdir(this.backupsRoot);
    const sorted = backups.sort().reverse();
    return sorted.length > 0 ? path.join(this.backupsRoot, sorted[0]) : null;
  }

  async performPreFlightChecks() {
    const { execSync } = require('child_process');

    try {
      // Check for uncommitted changes
      const gitStatus = execSync('git status --porcelain', {
        encoding: 'utf-8',
        cwd: this.rootDir
      });

      if (gitStatus.trim().length > 0) {
        console.warn('⚠️  WARNING: You have uncommitted changes!');
        console.warn('   Rollback may overwrite current work.');
        console.warn('');
        console.warn('   Run `git stash` to save your changes first.');
        console.warn('');
        throw new Error('Uncommitted changes detected. Rollback aborted.');
      }
    } catch (error) {
      if (error.message.includes('Uncommitted changes')) {
        throw error;
      }
      // Git not available or other error - log warning and continue
      console.warn('⚠️  Could not verify git status (git may not be available)');
      console.warn('');
    }

    try {
      // Log current commit for reference
      const currentCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf-8',
        cwd: this.rootDir
      }).trim();

      console.log(`📍 Current commit: ${currentCommit.substring(0, 8)}`);
      console.log('');
    } catch (error) {
      // Git not available, continue silently
    }
  }

  async loadManifest(backupDir) {
    try {
      const manifestPath = path.join(backupDir, 'backup-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async logRollback(backupDir, manifest) {
    const logPath = path.join(this.rootDir, 'docs', 'auto-repair-history.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'ROLLBACK',
      backup: backupDir,
      restored_from: manifest.timestamp,
      health_before_repair: manifest.health_before
    };

    try {
      const existingLog = await fs.readFile(logPath, 'utf-8');
      const logs = JSON.parse(existingLog);
      logs.push(logEntry);
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      await fs.writeFile(logPath, JSON.stringify([logEntry], null, 2));
    }
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
GDD Auto-Repair Rollback System

Usage:
  node scripts/rollback-gdd-repair.js [command]

Commands:
  --last                  Rollback to last backup
  --timestamp <timestamp> Rollback to specific backup
  --list                  List all available backups
  --verify <timestamp>    Verify backup integrity
  --help, -h              Show this help message

Examples:
  # Rollback last repair
  node scripts/rollback-gdd-repair.js --last

  # Rollback to specific backup
  node scripts/rollback-gdd-repair.js --timestamp 2025-10-06T14-42-00-000Z

  # List available backups
  node scripts/rollback-gdd-repair.js --list

  # Verify backup
  node scripts/rollback-gdd-repair.js --verify 2025-10-06T14-42-00-000Z
`);
    process.exit(0);
  }

  const engine = new RollbackEngine();

  if (args.includes('--list')) {
    await engine.listBackups();
  } else if (args.includes('--verify')) {
    const timestamp = args[args.indexOf('--verify') + 1];
    if (!timestamp) {
      console.error('❌ Missing timestamp argument');
      process.exit(1);
    }
    const valid = await engine.verify(timestamp);
    process.exit(valid ? 0 : 1);
  } else if (args.includes('--last') || args.includes('--timestamp')) {
    const timestamp = args.includes('--last')
      ? 'last'
      : args[args.indexOf('--timestamp') + 1];

    if (!timestamp && !args.includes('--last')) {
      console.error('❌ Missing timestamp argument');
      process.exit(1);
    }

    const success = await engine.rollback(timestamp);
    process.exit(success ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { RollbackEngine };
