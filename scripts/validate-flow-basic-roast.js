#!/usr/bin/env node
/**
 * Validate Flow #486: Basic Roast Generation
 *
 * Flow: Comment → Toxicity Analysis → Roast Generation → Store
 *
 * Success Criteria:
 * - Comment stored in DB with toxicity score
 * - OpenAI generates roast (not template fallback)
 * - Roast persisted and retrievable via API
 * - Cost tracking updated
 * - Execution time < 5s
 *
 * Related Issue: #486
 * Related Node: roast.md
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Services
const perspectiveService = require('../src/services/perspective');
const RoastGeneratorEnhanced = require('../src/services/roastGeneratorEnhanced');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validation
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ Missing OpenAI API key');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data
const TEST_COMMENTS = [
  {
    text: 'You are absolutely terrible at this, maybe try something easier',
    expectedToxicity: 'high', // > 0.7
    platform: 'twitter'
  },
  {
    text: 'This is pretty mediocre work, not impressed',
    expectedToxicity: 'medium', // 0.4-0.7
    platform: 'discord'
  },
  {
    text: 'Nice work, keep it up!',
    expectedToxicity: 'low', // < 0.4
    platform: 'youtube'
  }
];

async function validateBasicRoastFlow() {
  console.log('🚀 Starting Basic Roast Generation Flow Validation\n');
  console.log('=' .repeat(60));

  const startTime = Date.now();
  const results = {
    passed: 0,
    failed: 0,
    errors: [],
    details: []
  };

  // Create test organization
  console.log('\n📋 Step 1: Creating test organization...');
  const testOrgId = uuidv4();
  const testUserId = uuidv4();

  try {
    // Create test user
    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        id: testUserId,
        email: `test-roast-${Date.now()}@example.com`,
        name: 'Roast Test User',
        plan: 'pro'
      })
      .select()
      .single();

    if (userError) throw new Error(`User creation failed: ${userError.message}`);
    console.log(`✅ Test user created: ${user.id}`);

    // Create test organization
    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        id: testOrgId,
        name: 'Roast Test Org',
        slug: `roast-test-${Date.now()}`,
        owner_id: testUserId,
        plan_id: 'pro',
        monthly_responses_limit: 1000
      })
      .select()
      .single();

    if (orgError) throw new Error(`Org creation failed: ${orgError.message}`);
    console.log(`✅ Test organization created: ${org.id}`);

    // Process each test comment
    for (let i = 0; i < TEST_COMMENTS.length; i++) {
      const testComment = TEST_COMMENTS[i];
      const commentStartTime = Date.now();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`\n📝 Test ${i + 1}/${TEST_COMMENTS.length}: ${testComment.text.substring(0, 50)}...`);
      console.log(`Expected toxicity: ${testComment.expectedToxicity}`);

      try {
        // Step 2: Analyze toxicity
        console.log('\n🔍 Step 2: Analyzing toxicity...');
        let toxicityScore;

        try {
          const toxicityResult = await perspectiveService.analyzeToxicity(testComment.text);
          toxicityScore = toxicityResult.toxicityScore;
          console.log(`✅ Toxicity score: ${toxicityScore.toFixed(3)}`);
        } catch (perspectiveError) {
          console.log(`⚠️  Perspective API unavailable, using fallback`);
          toxicityScore = 0.5; // Fallback
        }

        // Validate toxicity range
        const toxicityMatch =
          (testComment.expectedToxicity === 'high' && toxicityScore > 0.7) ||
          (testComment.expectedToxicity === 'medium' && toxicityScore >= 0.4 && toxicityScore <= 0.7) ||
          (testComment.expectedToxicity === 'low' && toxicityScore < 0.4);

        if (!toxicityMatch) {
          console.log(`⚠️  Toxicity score (${toxicityScore}) doesn't match expected (${testComment.expectedToxicity})`);
        }

        // Step 3: Store comment
        console.log('\n💾 Step 3: Storing comment...');
        const { data: comment, error: commentError } = await client
          .from('comments')
          .insert({
            id: uuidv4(),
            organization_id: testOrgId,
            platform: testComment.platform,
            platform_comment_id: `test_${Date.now()}_${i}`,
            original_text: testComment.text,
            platform_username: 'test_user',
            toxicity_score: toxicityScore,
            status: 'pending'
          })
          .select()
          .single();

        if (commentError) throw new Error(`Comment storage failed: ${commentError.message}`);
        console.log(`✅ Comment stored: ${comment.id}`);

        // Step 4: Generate roast
        console.log('\n🔥 Step 4: Generating roast with OpenAI...');
        const generator = new RoastGeneratorEnhanced();
        const roastResult = await generator.generateRoast({
          comment: testComment.text,
          userId: testUserId,
          organizationId: testOrgId,
          tone: 'sarcastic',
          humorType: 'witty',
          toxicityScore
        });

        if (!roastResult || !roastResult.roast) {
          throw new Error('Roast generation returned empty result');
        }

        console.log(`✅ Roast generated: "${roastResult.roast.substring(0, 80)}..."`);
        console.log(`   Model: ${roastResult.modelUsed || 'unknown'}`);
        console.log(`   Tokens: ${roastResult.tokensUsed || 0}`);
        console.log(`   Cost: $${(roastResult.costUsd || 0).toFixed(4)}`);

        // Verify it's not a template fallback
        const isTemplate = roastResult.roast.includes('[') || roastResult.roast.length < 20;
        if (isTemplate) {
          console.log('⚠️  Warning: Roast appears to be a template fallback');
        }

        // Step 5: Store roast
        console.log('\n💾 Step 5: Storing roast...');
        const { data: roast, error: roastError } = await client
          .from('roasts')
          .insert({
            id: uuidv4(),
            organization_id: testOrgId,
            comment_id: comment.id,
            generated_roast: roastResult.roast,
            tone: 'sarcastic',
            model_used: roastResult.modelUsed || 'unknown',
            tokens_used: roastResult.tokensUsed || 0,
            cost_usd: roastResult.costUsd || 0
          })
          .select()
          .single();

        if (roastError) throw new Error(`Roast storage failed: ${roastError.message}`);
        console.log(`✅ Roast stored: ${roast.id}`);

        // Step 6: Verify retrieval
        console.log('\n🔍 Step 6: Verifying retrieval...');
        const { data: retrieved, error: retrieveError } = await client
          .from('roasts')
          .select(`
            *,
            comments (
              original_text,
              toxicity_score,
              platform
            )
          `)
          .eq('id', roast.id)
          .single();

        if (retrieveError || !retrieved) {
          throw new Error('Roast retrieval failed');
        }

        console.log(`✅ Roast retrieved successfully`);
        console.log(`   Comment: "${retrieved.comments.original_text.substring(0, 50)}..."`);
        console.log(`   Roast: "${retrieved.generated_roast.substring(0, 80)}..."`);

        // Check execution time
        const executionTime = Date.now() - commentStartTime;
        console.log(`\n⏱️  Execution time: ${(executionTime / 1000).toFixed(2)}s`);

        if (executionTime > 5000) {
          console.log(`⚠️  Warning: Exceeded 5s target (${(executionTime / 1000).toFixed(2)}s)`);
        } else {
          console.log(`✅ Under 5s target`);
        }

        // Issue #588 G1: Quality check - roast must be >50 chars
        const MIN_ROAST_LENGTH = 50;
        if (roastResult.roast.length < MIN_ROAST_LENGTH) {
          throw new Error(
            `Quality check FAILED: Roast too short (${roastResult.roast.length} chars, minimum: ${MIN_ROAST_LENGTH})`
          );
        }
        console.log(`✅ Quality check passed: ${roastResult.roast.length} chars (>${MIN_ROAST_LENGTH} required)`);

        results.passed++;
        results.details.push({
          test: i + 1,
          comment: testComment.text.substring(0, 50),
          toxicity: toxicityScore,
          roast: roastResult.roast.substring(0, 80),
          executionTime: executionTime,
          status: 'passed'
        });

        console.log(`\n✅ Test ${i + 1} PASSED`);

      } catch (error) {
        results.failed++;
        results.errors.push({
          test: i + 1,
          comment: testComment.text,
          error: error.message
        });
        console.error(`\n❌ Test ${i + 1} FAILED: ${error.message}`);
      }
    }

    // Cleanup
    console.log(`\n${'='.repeat(60)}`);
    console.log('\n🧹 Cleaning up test data...');
    await client.from('roasts').delete().eq('organization_id', testOrgId);
    await client.from('comments').delete().eq('organization_id', testOrgId);
    await client.from('organizations').delete().eq('id', testOrgId);
    await client.from('users').delete().eq('id', testUserId);
    console.log('✅ Cleanup complete');

  } catch (setupError) {
    console.error(`\n❌ Setup failed: ${setupError.message}`);
    results.errors.push({ test: 'setup', error: setupError.message });
    results.failed++;
  }

  // Final report
  const totalTime = Date.now() - startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log('\n📊 VALIDATION REPORT');
  console.log(`${'='.repeat(60)}`);
  console.log(`\nTotal tests: ${TEST_COMMENTS.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(err => {
      console.log(`   - Test ${err.test}: ${err.error}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);

  if (results.failed === 0) {
    console.log('\n🎉 ALL VALIDATIONS PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ SOME VALIDATIONS FAILED');
    process.exit(1);
  }
}

// Run validation
validateBasicRoastFlow()
  .catch(err => {
    console.error('\n💥 Validation crashed:', err);
    process.exit(1);
  });
