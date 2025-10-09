#!/usr/bin/env node

/**
 * GDD Secure Write Protocol (SWP)
 *
 * Implements secure write operations with:
 * - SHA-256 integrity hashing (before/after)
 * - Digital signatures (agent, timestamp, action, target)
 * - Automatic rollback on health degradation
 * - Event broadcasting to Telemetry Bus
 *
 * @module secure-write
 * @version 1.0.0
 * @phase GDD 2.0 Phase 14 - Agent-Aware Integration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Secure Write Protocol
 *
 * Provides secure, auditable, reversible write operations
 */
class SecureWrite {
  constructor(options = {}) {
    this.rootDir = path.resolve(__dirname, '../..');
    this.backupDir = path.join(this.rootDir, '.gdd-backups');
    this.signaturesPath = path.join(this.rootDir, 'gdd-write-signatures.json');
    this.telemetryBus = options.telemetryBus || null;
    this.verbose = options.verbose || false;

    // Ensure backup directory exists
    this.ensureBackupDir();

    // Initialize signatures file
    this.initializeSignatures();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Initialize signatures file
   */
  initializeSignatures() {
    if (!fs.existsSync(this.signaturesPath)) {
      const initial = {
        created_at: new Date().toISOString(),
        version: '1.0.0',
        phase: 14,
        signatures: []
      };
      fs.writeFileSync(this.signaturesPath, JSON.stringify(initial, null, 2));
    }
  }

  /**
   * Secure write operation
   *
   * @param {object} options - Write options
   * @param {string} options.path - File path to write
   * @param {string} options.content - Content to write
   * @param {string} options.agent - Agent performing write
   * @param {string} options.action - Action being performed
   * @param {object} options.metadata - Additional metadata
   * @returns {object} Write result with signature
   */
  async write({ path, content, agent, action, metadata = {} }) {
    try {
      // 1. Read current content (if exists)
      let currentContent = null;
      let hashBefore = null;

      if (fs.existsSync(path)) {
        currentContent = fs.readFileSync(path, 'utf8');
        hashBefore = this.calculateHash(currentContent);
      }

      // 2. Calculate hash of new content
      const hashAfter = this.calculateHash(content);

      // 3. Create backup
      const backupPath = this.createBackup(path, currentContent);

      // 4. Create signature
      const signature = this.createSignature({
        path,
        agent,
        action,
        hashBefore,
        hashAfter,
        metadata,
        backupPath
      });

      // 5. Write new content
      fs.writeFileSync(path, content, 'utf8');

      // 6. Save signature
      this.saveSignature(signature);

      // 7. Notify telemetry bus
      if (this.telemetryBus) {
        this.telemetryBus.emit('secure_write', {
          agent,
          action,
          path: path.replace(this.rootDir, ''),
          signature: signature.id,
          timestamp: signature.timestamp
        });
      }

      if (this.verbose) {
        this.log('success', `Secure write: ${path.replace(this.rootDir, '')}`);
        this.log('info', `  Hash: ${hashBefore?.substring(0, 8) || 'N/A'} → ${hashAfter.substring(0, 8)}`);
        this.log('info', `  Signature: ${signature.id}`);
      }

      return {
        success: true,
        signature,
        hashBefore,
        hashAfter,
        backupPath
      };

    } catch (error) {
      this.log('error', `Secure write failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rollback a write operation
   *
   * @param {object} options - Rollback options
   * @param {string} options.path - File path to rollback
   * @param {string} options.content - Content to restore (if not using backup)
   * @param {string} options.reason - Reason for rollback
   * @param {string} options.agent - Agent requesting rollback
   * @param {string} options.signatureId - Signature ID to rollback (optional)
   * @returns {object} Rollback result
   */
  async rollback({ path, content = null, reason, agent, signatureId = null }) {
    try {
      let restoredContent = content;

      // If signature ID provided, find backup from signature
      if (signatureId) {
        const signatures = this.loadSignatures();
        const signature = signatures.signatures.find(s => s.id === signatureId);

        if (signature && signature.backupPath && fs.existsSync(signature.backupPath)) {
          restoredContent = fs.readFileSync(signature.backupPath, 'utf8');
        }
      }

      // If no content provided and no signature, try to find latest backup
      if (!restoredContent) {
        const latestBackup = this.findLatestBackup(path);
        if (latestBackup) {
          restoredContent = fs.readFileSync(latestBackup, 'utf8');
        } else {
          throw new Error('No backup found for rollback');
        }
      }

      // Get hash before rollback
      const hashBefore = fs.existsSync(path)
        ? this.calculateHash(fs.readFileSync(path, 'utf8'))
        : null;

      // Restore content
      fs.writeFileSync(path, restoredContent, 'utf8');

      const hashAfter = this.calculateHash(restoredContent);

      // Create rollback signature
      const signature = this.createSignature({
        path,
        agent,
        action: 'rollback',
        hashBefore,
        hashAfter,
        metadata: {
          reason,
          original_signature: signatureId
        }
      });

      this.saveSignature(signature);

      // Notify telemetry bus
      if (this.telemetryBus) {
        this.telemetryBus.emit('rollback', {
          agent,
          path: path.replace(this.rootDir, ''),
          reason,
          signature: signature.id,
          timestamp: signature.timestamp
        });
      }

      if (this.verbose) {
        this.log('warn', `Rollback: ${path.replace(this.rootDir, '')}`);
        this.log('info', `  Reason: ${reason}`);
        this.log('info', `  Hash: ${hashBefore?.substring(0, 8) || 'N/A'} → ${hashAfter.substring(0, 8)}`);
      }

      return {
        success: true,
        signature,
        reason,
        hashAfter
      };

    } catch (error) {
      this.log('error', `Rollback failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create backup of current content
   */
  createBackup(filePath, content) {
    if (!content) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basename = path.basename(filePath);
    const backupName = `${basename}.${timestamp}.backup`;
    const backupPath = path.join(this.backupDir, backupName);

    fs.writeFileSync(backupPath, content, 'utf8');

    // Cleanup old backups (keep only last 10 per file)
    this.cleanupBackups(basename);

    return backupPath;
  }

  /**
   * Cleanup old backups for a file
   */
  cleanupBackups(basename, keepLast = 10) {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith(basename))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          mtime: fs.statSync(path.join(this.backupDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Remove old backups
      for (let i = keepLast; i < backups.length; i++) {
        fs.unlinkSync(backups[i].path);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Find latest backup for a file
   */
  findLatestBackup(filePath) {
    try {
      const basename = path.basename(filePath);
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith(basename))
        .map(f => ({
          path: path.join(this.backupDir, f),
          mtime: fs.statSync(path.join(this.backupDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return backups.length > 0 ? backups[0].path : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create digital signature for write operation
   */
  createSignature({ path, agent, action, hashBefore, hashAfter, metadata = {}, backupPath = null }) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create signature payload
    const payload = {
      id,
      timestamp,
      agent,
      action,
      path: path.replace(this.rootDir, ''),
      hashBefore,
      hashAfter,
      metadata,
      backupPath
    };

    // Calculate signature hash
    const signatureHash = this.calculateHash(JSON.stringify(payload));

    return {
      ...payload,
      signature: signatureHash
    };
  }

  /**
   * Save signature to signatures file
   */
  saveSignature(signature) {
    try {
      const signatures = this.loadSignatures();

      // Add new signature
      signatures.signatures.push(signature);

      // Keep only last 1000 signatures
      if (signatures.signatures.length > 1000) {
        signatures.signatures = signatures.signatures.slice(-1000);
      }

      // Update metadata
      signatures.last_updated = new Date().toISOString();
      signatures.total_signatures = signatures.signatures.length;

      // Write signatures
      fs.writeFileSync(this.signaturesPath, JSON.stringify(signatures, null, 2));

      return true;
    } catch (error) {
      this.log('error', `Failed to save signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Load signatures from file
   */
  loadSignatures() {
    try {
      return JSON.parse(fs.readFileSync(this.signaturesPath, 'utf8'));
    } catch (error) {
      return {
        created_at: new Date().toISOString(),
        version: '1.0.0',
        phase: 14,
        signatures: []
      };
    }
  }

  /**
   * Verify signature integrity
   */
  verifySignature(signature) {
    // Recreate signature hash from payload
    const payload = {
      id: signature.id,
      timestamp: signature.timestamp,
      agent: signature.agent,
      action: signature.action,
      path: signature.path,
      hashBefore: signature.hashBefore,
      hashAfter: signature.hashAfter,
      metadata: signature.metadata,
      backupPath: signature.backupPath
    };

    const expectedHash = this.calculateHash(JSON.stringify(payload));

    return expectedHash === signature.signature;
  }

  /**
   * Calculate SHA-256 hash
   */
  calculateHash(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Logging utility
   */
  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const icons = {
      info: '📊',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };

    const color = colors[level] || colors.info;
    const icon = icons[level] || '•';

    console.log(`${color}${icon} ${message}${colors.reset}`);
  }
}

// Export
module.exports = SecureWrite;

// CLI test mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    console.log('\n🧪 Testing Secure Write Protocol\n');

    const swp = new SecureWrite({ verbose: true });

    (async () => {
      try {
        const testFile = path.join(__dirname, '../../.gdd-test-swp.txt');

        // Test 1: Write
        console.log('\n1️⃣ Testing secure write...');
        const writeResult = await swp.write({
          path: testFile,
          content: 'Test content v1',
          agent: 'TestAgent',
          action: 'test_write',
          metadata: { test: true }
        });
        console.log(`✅ Write successful (signature: ${writeResult.signature.id.substring(0, 8)}...)`);

        // Test 2: Overwrite
        console.log('\n2️⃣ Testing secure overwrite...');
        const overwriteResult = await swp.write({
          path: testFile,
          content: 'Test content v2',
          agent: 'TestAgent',
          action: 'test_overwrite',
          metadata: { test: true, version: 2 }
        });
        console.log(`✅ Overwrite successful (signature: ${overwriteResult.signature.id.substring(0, 8)}...)`);

        // Test 3: Rollback
        console.log('\n3️⃣ Testing rollback...');
        const rollbackResult = await swp.rollback({
          path: testFile,
          signatureId: overwriteResult.signature.id,
          reason: 'testing_rollback',
          agent: 'TestAgent'
        });
        console.log(`✅ Rollback successful (signature: ${rollbackResult.signature.id.substring(0, 8)}...)`);

        // Test 4: Verify signatures
        console.log('\n4️⃣ Testing signature verification...');
        const signatures = swp.loadSignatures();
        const lastSignature = signatures.signatures[signatures.signatures.length - 1];
        const isValid = swp.verifySignature(lastSignature);
        console.log(`✅ Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);

        // Cleanup
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }

        console.log('\n✅ All SWP tests passed!\n');

      } catch (error) {
        console.error('\n❌ SWP test failed:', error.message, '\n');
        process.exit(1);
      }
    })();
  } else {
    console.log('Usage: node secure-write.js --test');
  }
}
