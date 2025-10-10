#!/usr/bin/env node
/**
 * GDD Maintenance Mode Utility
 *
 * Manages maintenance (read-only observer) mode for GDD automation.
 * When enabled, all validators run but no modifications or auto-repairs are performed.
 */

const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '..', '.gdd-maintenance');

/**
 * Check if maintenance mode is enabled
 * @returns {boolean} True if maintenance mode is active
 */
function isMaintenanceMode() {
  try {
    if (!fs.existsSync(MAINTENANCE_FILE)) {
      return false;
    }
    const config = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
    return config.maintenance_mode === true;
  } catch (error) {
    console.error('⚠️  Error reading maintenance config:', error.message);
    return false;
  }
}

/**
 * Check if a flag is present in command line arguments
 * @param {string} flag - The flag to check (e.g., '--maintenance')
 * @returns {boolean} True if flag is present
 */
function hasMaintenanceFlag() {
  return process.argv.includes('--maintenance');
}

/**
 * Display maintenance mode banner
 */
function showMaintenanceBanner() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧊 GDD 2.0 - MAINTENANCE MODE (Read-Only Observer)      ║');
  console.log('║                                                            ║');
  console.log('║  • Validation: ACTIVE ✓                                   ║');
  console.log('║  • Auto-Repair: DISABLED                                  ║');
  console.log('║  • Issue Creation: DISABLED                               ║');
  console.log('║  • File Modifications: BLOCKED                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

/**
 * Enable maintenance mode
 * @param {string} snapshotRef - Reference to the snapshot directory
 */
function enableMaintenanceMode(snapshotRef = null) {
  const config = {
    maintenance_mode: true,
    enabled_date: new Date().toISOString(),
    snapshot_reference: snapshotRef || `docs/snapshots/gdd-${new Date().toISOString().split('T')[0]}`,
    notes: "Maintenance mode enabled - all GDD operations are read-only"
  };

  fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(config, null, 2));
  console.log('✅ Maintenance mode ENABLED');
  console.log(`📸 Snapshot reference: ${config.snapshot_reference}`);
  showMaintenanceBanner();
}

/**
 * Disable maintenance mode
 */
function disableMaintenanceMode() {
  const config = {
    maintenance_mode: false,
    enabled_date: null,
    snapshot_reference: null,
    notes: "Set maintenance_mode to true to enable read-only observer mode for all GDD automation"
  };

  fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(config, null, 2));
  console.log('✅ Maintenance mode DISABLED');
  console.log('🔓 GDD automation fully active');
}

/**
 * Get maintenance mode status and configuration
 * @returns {object} Maintenance configuration
 */
function getMaintenanceConfig() {
  if (!fs.existsSync(MAINTENANCE_FILE)) {
    return {
      maintenance_mode: false,
      enabled_date: null,
      snapshot_reference: null
    };
  }
  return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
}

/**
 * Block operation if in maintenance mode
 * @param {string} operation - Name of the operation being blocked
 * @throws {Error} If in maintenance mode
 */
function blockIfMaintenance(operation = 'operation') {
  if (isMaintenanceMode() || hasMaintenanceFlag()) {
    throw new Error(`🧊 BLOCKED: ${operation} disabled in maintenance mode`);
  }
}

module.exports = {
  isMaintenanceMode,
  hasMaintenanceFlag,
  showMaintenanceBanner,
  enableMaintenanceMode,
  disableMaintenanceMode,
  getMaintenanceConfig,
  blockIfMaintenance
};

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'enable':
      enableMaintenanceMode(process.argv[3]);
      break;
    case 'disable':
      disableMaintenanceMode();
      break;
    case 'status':
      {
        const config = getMaintenanceConfig();
        console.log('\n📊 GDD Maintenance Mode Status\n');
        console.log(`Mode: ${config.maintenance_mode ? '🧊 ENABLED (Read-Only)' : '🔓 DISABLED (Active)'}`);
        if (config.maintenance_mode) {
          console.log(`Enabled: ${config.enabled_date}`);
          console.log(`Snapshot: ${config.snapshot_reference}`);
        }
        console.log('');
      }
      break;
    default:
      console.log(`
GDD Maintenance Mode Utility

Usage:
  node scripts/gdd-maintenance-mode.js enable [snapshot-ref]
  node scripts/gdd-maintenance-mode.js disable
  node scripts/gdd-maintenance-mode.js status

Commands:
  enable   - Enable maintenance (read-only) mode
  disable  - Disable maintenance mode
  status   - Show current maintenance mode status
      `);
  }
}
