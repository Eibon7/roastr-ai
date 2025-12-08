/**
 * Legacy ID Mappings
 *
 * Shared module for legacy (v1) node ID mappings to v2 equivalents.
 * Used by validation and detection scripts.
 */

const LEGACY_ID_MAPPINGS = new Map([
  ['roast', 'roast-generation'],
  ['shield', 'shield-moderation'],
  ['social-platforms', 'platform-integrations'],
  ['frontend-dashboard', 'admin-dashboard'],
  ['plan-features', 'plan-configuration'],
  ['persona', 'persona-config'],
  ['billing', 'billing-integration'],
  ['cost-control', 'cost-management'],
  ['queue-system', 'queue-management'],
  ['multi-tenant', 'tenant-management'],
  ['observability', 'monitoring'],
  ['analytics', 'analytics-dashboard'],
  ['trainer', 'model-training'],
  ['guardian', null] // Deprecated, cannot be recreated
]);

const LEGACY_IDS = new Set(LEGACY_ID_MAPPINGS.keys());

/**
 * Get v2 equivalent for a legacy ID
 * @param {string} legacyId - Legacy v1 ID
 * @returns {string|null} - v2 equivalent, or null if deprecated
 */
function getV2Equivalent(legacyId) {
  return LEGACY_ID_MAPPINGS.get(legacyId) || null;
}

/**
 * Check if an ID is a legacy ID
 * @param {string} id - ID to check
 * @returns {boolean} - True if legacy ID
 */
function isLegacyId(id) {
  return LEGACY_IDS.has(id);
}

/**
 * Get all legacy IDs
 * @returns {string[]} - Array of legacy IDs
 */
function getAllLegacyIds() {
  return Array.from(LEGACY_IDS);
}

/**
 * Get all legacy ID mappings
 * @returns {Map<string, string|null>} - Map of legacy ID to v2 equivalent
 */
function getAllMappings() {
  return new Map(LEGACY_ID_MAPPINGS);
}

module.exports = {
  LEGACY_ID_MAPPINGS,
  LEGACY_IDS,
  getV2Equivalent,
  isLegacyId,
  getAllLegacyIds,
  getAllMappings
};
