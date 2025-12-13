/**
 * Legacy ID Mappings
 *
 * Shared module for legacy (v1) node ID mappings to v2 equivalents.
 * Used by validation and detection scripts.
 */

/**
 * Mapping only to IDs that exist in system-map-v2.yaml / SSOT v2.
 * When a legacy ID has no clear v2 equivalent, keep value null so it is detected as unmapped.
 */
const LEGACY_ID_MAPPINGS = new Map([
  // Nodes with clear v2 IDs
  ['roast', 'roasting-engine'],
  ['shield', 'shield-engine'],
  ['social-platforms', 'integraciones-redes-sociales'],
  ['billing', 'billing-integration'],
  ['frontend-dashboard', 'frontend-admin'],
  ['observability', 'observabilidad'],

  // Legacy without confirmed v2 node/subnode equivalents (kept as unmapped for detection)
  ['plan-features', null],
  ['persona', null],
  ['cost-control', null],
  ['queue-system', null],
  ['multi-tenant', null],
  ['analytics', null],
  ['trainer', null],
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
