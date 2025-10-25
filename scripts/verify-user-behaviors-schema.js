#!/usr/bin/env node

/**
 * Verify user_behaviors table schema
 *
 * Queries information_schema to see current columns in user_behaviors table.
 *
 * Related: Issue #653, Migration 024
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Verifying user_behaviors Table Schema');
console.log('==========================================\n');

// Query to get table columns
const query = `
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
  FROM
    information_schema.columns
  WHERE
    table_schema = 'public'
    AND table_name = 'user_behaviors'
  ORDER BY
    ordinal_position;
`;

supabase.rpc('exec_sql', { sql: query })
  .then(result => {
    if (result.error) {
      // exec_sql might not exist, try direct query
      return supabase.from('information_schema.columns').select('*').eq('table_name', 'user_behaviors');
    }
    return result;
  })
  .then(result => {
    console.log('Current schema:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Error querying schema:', error.message);
    console.log('\nℹ️  Supabase JS client cannot query information_schema directly.');
    console.log('   We need to check the schema via SQL Editor or create the ALTER TABLE migration.');
    process.exit(1);
  });
