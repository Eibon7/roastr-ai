#!/usr/bin/env node
/**
 * Shared RLS Table Constants
 * 
 * Extracted from scripts/check-all-rls-tables.js and scripts/identify-untested-tables.js
 * to reduce duplication and maintenance risk.
 * 
 * Source: docs/nodes/multi-tenant.md (lines 108-129)
 */

// 22 tables from multi-tenant.md
const ALL_TABLES = [
  'organization_settings',
  'platform_settings',
  'integration_configs',
  'comments',
  'responses',
  'usage_records',
  'monthly_usage',
  'shield_actions',
  'shield_events',
  'roast_metadata',
  'analysis_usage',
  'user_activities',
  'app_logs',
  'api_keys',
  'audit_logs',
  'account_deletion_requests',
  'password_history',
  'stylecards',
  'notifications',
  'webhook_events',
  'subscription_audit_log',
  'feature_flags'
];

// Tables already tested (from issue #412 and related work)
// Note: Some tables (posts, roasts) are tested but not in multi-tenant.md list
const TESTED_TABLES = [
  'comments',
  'integration_configs',
  'monthly_usage',
  'posts', // tested but not in multi-tenant.md list
  'responses',
  'roasts', // tested but not in multi-tenant.md list
  'usage_records',
  'user_activities',
  'user_behaviors' // also tested but not in multi-tenant.md
];

module.exports = {
  ALL_TABLES,
  TESTED_TABLES
};

