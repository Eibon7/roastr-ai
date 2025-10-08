#!/usr/bin/env node

/**
 * GDD 2.0 Phase 14 - Secure Write Protocol (SWP)
 *
 * Provides secure, auditable, and reversible write operations for GDD agents.
 * Features:
 * - SHA-256 hashing for integrity verification
 * - Digital signatures (agent + timestamp + action + target)
 * - Automatic rollback if health score decreases
 * - Event broadcasting to Telemetry Bus
 *
 * @module secure-write
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecureWriteProtocol {
  constructor() {
    this.backupDir = path.join(process.cwd(), '.gdd-backups');
    this.maxBackups = 100; // Keep last 100 backups
    this.telemetryBus = null; // Will be injected
    this.validateChecksums = true;

    this._ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   * @private
   */
  _ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Compute SHA-256 hash of content
   * @param {string} content - Content to hash
   * @returns {string} Hex-encoded hash
   */
  computeHash(content) {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  /**
   * Create digital signature for operation
   * @param {Object} operation - Operation details
   * @returns {Object} Signature object
   */
  createSignature(operation) {
    const { agent, action, target, timestamp } = operation;
    const signatureData = `${agent}:${action}:${target}:${timestamp}`;
    const signature = crypto
      .createHash('sha256')
      .update(signatureData)
      .digest('hex');

    return {
      agent,
      action,
      target,
      timestamp,
      signature,
      algorithm: 'SHA256'
    };
  }

  /**
   * Verify signature validity
   * @param {Object} signature - Signature object to verify
   * @returns {boolean} True if valid
   */
  verifySignature(signature) {
    const { agent, action, target, timestamp, signature: sig } = signature;
    const signatureData = `${agent}:${action}:${target}:${timestamp}`;
    const expectedSig = crypto
      .createHash('sha256')
      .update(signatureData)
      .digest('hex');

    return sig === expectedSig;
  }

  /**
   * Create backup of file before modification
   * @param {string} filePath - Path to file
   * @returns {Object} Backup metadata
   */
  createBackup(filePath) {
    const content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : '';

    const hash = this.computeHash(content);
    const timestamp = new Date().toISOString();
    const backupName = `${path.basename(filePath)}.${timestamp}.backup`;
    const backupPath = path.join(this.backupDir, backupName);

    const backup = {
      originalPath: filePath,
      backupPath,
      timestamp,
      hash,
      size: Buffer.byteLength(content, 'utf8')
    };

    // Write backup file
    fs.writeFileSync(backupPath, content, 'utf8');

    // Write backup metadata
    const metadataPath = `${backupPath}.meta.json`;
    fs.writeFileSync(metadataPath, JSON.stringify(backup, null, 2), 'utf8');

    // Cleanup old backups
    this._cleanupOldBackups();

    return backup;
  }

  /**
   * Cleanup old backups (keep only last N)
   * @private
   */
  _cleanupOldBackups() {
    const backups = fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.backup'))
      .map(f => ({
        name: f,
        path: path.join(this.backupDir, f),
        mtime: fs.statSync(path.join(this.backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Remove old backups
    if (backups.length > this.maxBackups) {
      backups.slice(this.maxBackups).forEach(backup => {
        fs.unlinkSync(backup.path);
        const metaPath = `${backup.path}.meta.json`;
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      });
    }
  }

  /**
   * Restore from backup
   * @param {string} backupPath - Path to backup file
   * @returns {Object} Restore result
   */
  restoreBackup(backupPath) {
    const metadataPath = `${backupPath}.meta.json`;
    if (!fs.existsSync(backupPath) || !fs.existsSync(metadataPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const content = fs.readFileSync(backupPath, 'utf8');

    // Verify integrity
    const hash = this.computeHash(content);
    if (this.validateChecksums && hash !== metadata.hash) {
      throw new Error(`Backup integrity check failed for ${backupPath}`);
    }

    // Restore file
    fs.writeFileSync(metadata.originalPath, content, 'utf8');

    return {
      success: true,
      restoredFile: metadata.originalPath,
      backupUsed: backupPath,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute secure write operation
   * @param {Object} operation - Write operation details
   * @returns {Promise<Object>} Operation result
   */
  async executeWrite(operation) {
    const {
      agent,
      action,
      target,
      content,
      healthBefore,
      validateHealth = true
    } = operation;

    const timestamp = new Date().toISOString();

    // Create signature
    const signature = this.createSignature({
      agent,
      action,
      target,
      timestamp
    });

    // Verify signature
    if (!this.verifySignature(signature)) {
      throw new Error('Invalid signature - operation rejected');
    }

    // Create backup
    let backup = null;
    try {
      backup = this.createBackup(target);
    } catch (error) {
      console.error('Failed to create backup:', error.message);
      throw new Error('Cannot proceed without backup');
    }

    // Compute hashes
    const hashBefore = backup.hash;
    const hashAfter = this.computeHash(content);

    // Execute write
    let writeSuccess = false;
    try {
      fs.writeFileSync(target, content, 'utf8');
      writeSuccess = true;
    } catch (error) {
      // Restore backup immediately
      this.restoreBackup(backup.backupPath);
      throw new Error(`Write failed, restored backup: ${error.message}`);
    }

    // Prepare result
    const result = {
      success: writeSuccess,
      agent,
      action,
      target,
      timestamp,
      signature,
      hashBefore,
      hashAfter,
      healthBefore, // Include healthBefore for rollback decisions (CodeRabbit Review #3311794192)
      backup: backup.backupPath,
      rollback: null
    };

    // Broadcast to telemetry (if available)
    if (this.telemetryBus) {
      try {
        this.telemetryBus.emit('agent-action', {
          type: 'write',
          agent,
          action,
          target,
          timestamp,
          success: true
        });
      } catch (error) {
        console.warn('Failed to broadcast to telemetry:', error.message);
      }
    }

    return result;
  }

  /**
   * Execute rollback if health degraded
   * @param {Object} writeResult - Result from executeWrite
   * @param {number} healthAfter - Health score after write
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackIfNeeded(writeResult, healthAfter) {
    const { hashBefore, backup, agent, action, target } = writeResult;
    const healthBefore = writeResult.healthBefore ?? 100; // Use nullish coalescing to handle healthBefore=0

    // Check if rollback needed
    if (healthAfter >= healthBefore) {
      return {
        rollbackNeeded: false,
        healthBefore,
        healthAfter,
        delta: healthAfter - healthBefore
      };
    }

    console.warn(
      `⚠️  Health degraded: ${healthBefore} → ${healthAfter} (Δ ${healthAfter - healthBefore})`
    );
    console.warn(`🔄 Rolling back operation: ${action} by ${agent} on ${target}`);

    // Restore backup
    try {
      const restoreResult = this.restoreBackup(backup);

      // Broadcast rollback event
      if (this.telemetryBus) {
        this.telemetryBus.emit('agent-action', {
          type: 'rollback',
          agent,
          action,
          target,
          timestamp: new Date().toISOString(),
          reason: 'health_degradation',
          healthBefore,
          healthAfter,
          delta: healthAfter - healthBefore
        });
      }

      return {
        rollbackNeeded: true,
        rollbackSuccess: true,
        healthBefore,
        healthAfter,
        delta: healthAfter - healthBefore,
        restoreResult
      };
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);

      if (this.telemetryBus) {
        this.telemetryBus.emit('agent-action', {
          type: 'rollback-failed',
          agent,
          action,
          target,
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }

      return {
        rollbackNeeded: true,
        rollbackSuccess: false,
        error: error.message
      };
    }
  }

  /**
   * Get list of available backups for a file
   * @param {string} filePath - Original file path
   * @returns {Array} List of backup metadata
   */
  getBackups(filePath) {
    const basename = path.basename(filePath);
    const backups = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith(basename) && f.endsWith('.backup'))
      .map(f => {
        const metadataPath = path.join(this.backupDir, `${f}.meta.json`);
        if (fs.existsSync(metadataPath)) {
          return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return backups;
  }

  /**
   * Set telemetry bus for event broadcasting
   * @param {Object} telemetryBus - Telemetry bus instance
   */
  setTelemetryBus(telemetryBus) {
    this.telemetryBus = telemetryBus;
  }
}

// CLI interface
if (require.main === module) {
  const swp = new SecureWriteProtocol();

  const command = process.argv[2];
  const filePath = process.argv[3];

  if (command === 'backups' && filePath) {
    const backups = swp.getBackups(filePath);
    console.log(`\n📦 Backups for ${path.basename(filePath)}:\n`);
    backups.forEach((backup, i) => {
      console.log(`  ${i + 1}. ${backup.timestamp}`);
      console.log(`     Hash: ${backup.hash.substring(0, 16)}...`);
      console.log(`     Size: ${backup.size} bytes`);
      console.log(`     Path: ${backup.backupPath}\n`);
    });
  } else if (command === 'restore' && filePath) {
    const backupPath = process.argv[4];
    if (!backupPath) {
      console.error('Usage: secure-write.js restore <original-file> <backup-path>');
      process.exit(1);
    }

    try {
      const result = swp.restoreBackup(backupPath);
      console.log('✅ Restore successful:', result);
    } catch (error) {
      console.error('❌ Restore failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`
GDD Secure Write Protocol (SWP) CLI

Commands:
  backups <file-path>              List backups for a file
  restore <file-path> <backup>     Restore from backup

Examples:
  node secure-write.js backups docs/nodes/shield.md
  node secure-write.js restore docs/nodes/shield.md .gdd-backups/shield.md.2025-10-07.backup
    `);
  }
}

module.exports = SecureWriteProtocol;
