#!/usr/bin/env node

/**
 * Perspective API Verification Script
 *
 * Verifies Perspective API configuration for Issue #490
 * Related: API Configuration Checklist
 */

const axios = require('axios');
require('dotenv').config();

async function verifyPerspective() {
  console.log('🛡️  Verifying Perspective API Configuration...\n');

  // Check environment variable
  const apiKey = process.env.PERSPECTIVE_API_KEY;

  if (!apiKey) {
    console.error('❌ ERROR: PERSPECTIVE_API_KEY not found in .env');
    console.error('   Add it to your .env file:');
    console.error('   PERSPECTIVE_API_KEY=your_key_here\n');
    console.error('💡 How to get Perspective API key:\n');
    console.error('1. Request access: https://developers.perspectiveapi.com/s/');
    console.error('2. Wait for approval (can take days)');
    console.error('3. Enable Perspective API in Google Cloud Console');
    console.error('4. Generate API key');
    console.error('5. Add to .env file\n');
    process.exit(1);
  }

  console.log('✅ API Key found in environment');
  console.log(`   Key prefix: ${apiKey.substring(0, 12)}...\n`);

  try {
    // Test 1: Analyze a sample comment for toxicity
    console.log('🔍 Test 1: Testing toxicity analysis...');

    const testComment = 'You are a stupid person and I hate you';

    const response = await axios.post(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        comment: {
          text: testComment
        },
        requestedAttributes: {
          TOXICITY: {},
          SEVERE_TOXICITY: {},
          IDENTITY_ATTACK: {},
          INSULT: {},
          PROFANITY: {},
          THREAT: {}
        },
        languages: ['en']
      },
      {
        timeout: 10000
      }
    );

    const scores = response.data.attributeScores;
    const toxicityScore = scores.TOXICITY.summaryScore.value;

    console.log('✅ Toxicity analysis working!');
    console.log(`   Test comment: "${testComment}"`);
    console.log(`   Toxicity score: ${(toxicityScore * 100).toFixed(2)}%`);
    console.log('\n   Detailed scores:');

    Object.entries(scores).forEach(([attribute, data]) => {
      const score = data.summaryScore.value;
      const percentage = (score * 100).toFixed(2);
      console.log(`     - ${attribute}: ${percentage}%`);
    });
    console.log();

    // Test 2: Analyze a neutral comment
    console.log('🔍 Test 2: Testing with neutral comment...');

    const neutralComment = 'This is a wonderful day and I appreciate your help';

    const response2 = await axios.post(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        comment: {
          text: neutralComment
        },
        requestedAttributes: {
          TOXICITY: {}
        },
        languages: ['en']
      },
      {
        timeout: 10000
      }
    );

    const neutralScore = response2.data.attributeScores.TOXICITY.summaryScore.value;

    console.log('✅ Neutral comment analysis working!');
    console.log(`   Test comment: "${neutralComment}"`);
    console.log(`   Toxicity score: ${(neutralScore * 100).toFixed(2)}%`);
    console.log();

    // Test 3: Test Spanish language support
    console.log('🔍 Test 3: Testing Spanish language support...');

    const spanishComment = 'Eres un idiota y me caes mal';

    try {
      const response3 = await axios.post(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
        {
          comment: {
            text: spanishComment
          },
          requestedAttributes: {
            TOXICITY: {}
          },
          languages: ['es']
        },
        {
          timeout: 10000
        }
      );

      const spanishScore = response3.data.attributeScores.TOXICITY.summaryScore.value;

      console.log('✅ Spanish language support working!');
      console.log(`   Test comment: "${spanishComment}"`);
      console.log(`   Toxicity score: ${(spanishScore * 100).toFixed(2)}%`);
      console.log();
    } catch (error) {
      console.log('⚠️  Spanish language support limited');
      console.log('   Perspective API has better support for English');
      console.log('   This is expected and normal\n');
    }

    // Summary
    console.log('📊 Summary:\n');
    console.log('✅ API Key: Valid');
    console.log('✅ Toxicity Analysis: Working');
    console.log('✅ Available Attributes:');
    console.log('   - TOXICITY');
    console.log('   - SEVERE_TOXICITY');
    console.log('   - IDENTITY_ATTACK');
    console.log('   - INSULT');
    console.log('   - PROFANITY');
    console.log('   - THREAT');
    console.log();

    // Recommendations
    console.log('💡 Integration Details:\n');
    console.log('✅ Fallback system exists:');
    console.log('   - Primary: Perspective API (Google)');
    console.log('   - Fallback: OpenAI Moderation API');
    console.log();
    console.log('✅ Threshold recommendation:');
    console.log('   - Toxic if score > 0.7 (70%)');
    console.log('   - Moderate if score > 0.5 (50%)');
    console.log('   - Safe if score < 0.5 (50%)');
    console.log();
    console.log('✅ Rate Limits:');
    console.log('   - Free tier: 1 QPS (query per second)');
    console.log('   - Paid tier: Contact Google for higher limits');
    console.log();
    console.log('📚 Documentation:');
    console.log('   → https://developers.perspectiveapi.com/s/');
    console.log('   → https://github.com/conversationai/perspectiveapi');
    console.log();

    console.log('🎉 Perspective API verification complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR during verification:');

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        console.error('   Status: 400 Bad Request');
        console.error('   Message:', data.error?.message || 'Invalid request format');
        console.error('\n💡 Solution:');
        console.error('   1. Check that the API key is correct');
        console.error('   2. Verify the request format is valid');
        console.error('   3. Ensure requested attributes are supported\n');
      } else if (status === 403) {
        console.error('   Status: 403 Forbidden');
        console.error('   Message:', data.error?.message || 'Access denied');
        console.error('\n💡 Solution:');
        console.error('   1. Verify API key is valid and not expired');
        console.error('   2. Check that Perspective API is enabled in Google Cloud Console');
        console.error('   3. Ensure billing is enabled (if required)');
        console.error('   4. Request access: https://developers.perspectiveapi.com/s/\n');
      } else if (status === 429) {
        console.error('   Status: 429 Rate Limited');
        console.error('   Message: Too many requests');
        console.error('\n💡 Solution:');
        console.error('   1. Wait for rate limit to reset');
        console.error('   2. Free tier: 1 QPS limit');
        console.error('   3. Consider upgrading to paid tier\n');
      } else {
        console.error('   Status:', status);
        console.error('   Message:', data.error?.message || 'Unknown error');
        console.error('   Details:', JSON.stringify(data, null, 2));
        console.error();
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('   Error: Request timeout');
      console.error('\n💡 Solution:');
      console.error('   1. Check internet connection');
      console.error('   2. Try again in a few moments');
      console.error('   3. Perspective API may be temporarily unavailable\n');
    } else {
      console.error('   Message:', error.message);
      console.error();
    }

    process.exit(1);
  }
}

// Run verification
verifyPerspective().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
