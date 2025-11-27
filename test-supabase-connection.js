/**
 * Quick script to test Supabase connection and roast_tones table
 */
require('dotenv').config();
const { supabaseServiceClient } = require('./src/config/supabase');

async function test() {
  console.log('🔍 Testing Supabase connection...\n');

  // Test 1: Check if we can query any table
  console.log('Test 1: Querying users table...');
  const { data: users, error: usersError } = await supabaseServiceClient
    .from('users')
    .select('id')
    .limit(1);

  if (usersError) {
    console.error('❌ Error querying users:', usersError);
  } else {
    console.log('✅ Users table accessible, found', users?.length || 0, 'users');
  }

  console.log('\nTest 2: Querying roast_tones table...');
  const { data: tones, error: tonesError } = await supabaseServiceClient
    .from('roast_tones')
    .select('*')
    .limit(5);

  if (tonesError) {
    console.error('❌ Error querying roast_tones:');
    console.error('  Type:', typeof tonesError);
    console.error('  Value:', tonesError);
    console.error('  JSON:', JSON.stringify(tonesError, null, 2));
    console.error('  Message:', tonesError.message);
    console.error('  Code:', tonesError.code);
    console.error('  Details:', tonesError.details);
    console.error('  Hint:', tonesError.hint);
  } else {
    console.log('✅ Roast_tones table accessible, found', tones?.length || 0, 'tones');
    if (tones && tones.length > 0) {
      console.log('   Sample:', tones[0].name);
    }
  }

  console.log('\nTest 3: Inserting test record...');
  const { data: inserted, error: insertError } = await supabaseServiceClient
    .from('roast_tones')
    .insert({
      name: 'test-connection-check',
      display_name: { es: 'Test', en: 'Test' },
      description: { es: 'Test', en: 'Test' },
      intensity: 3,
      personality: 'Test',
      resources: ['Test'],
      restrictions: ['Test'],
      examples: [{ es: { input: 'test', output: 'test' }, en: { input: 'test', output: 'test' } }],
      active: false,
      is_default: false,
      sort_order: 999
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error inserting test record:');
    console.error('  Type:', typeof insertError);
    console.error('  Value:', insertError);
    console.error('  JSON:', JSON.stringify(insertError, null, 2));
    console.error('  Message:', insertError.message);
    console.error('  Code:', insertError.code);
    console.error('  Details:', insertError.details);
    console.error('  Hint:', insertError.hint);
  } else {
    console.log('✅ Insert successful, ID:', inserted?.id);

    // Clean up
    await supabaseServiceClient
      .from('roast_tones')
      .delete()
      .eq('name', 'test-connection-check');
    console.log('✅ Cleanup complete');
  }
}

test().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
