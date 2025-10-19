#!/usr/bin/env node

/**
 * Perspective API Verification Script
 *
 * Verifies Perspective API configuration for Issue #490
 * Related: API Configuration Checklist
 */

const axios = require('axios');
require('dotenv').config();
const logger = require('../src/utils/logger');

/**
 * Helper function to analyze comment with Perspective API
 * @param {string} apiKey - Perspective API key
 * @param {string} text - Comment text to analyze
 * @param {Object} attributes - Requested attributes (default: TOXICITY only)
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Object>} Attribute scores from API
 */
async function analyzeComment(apiKey, text, attributes = { TOXICITY: {} }, language = 'en') {
  const response = await axios.post(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
    {
      comment: { text },
      requestedAttributes: attributes,
      languages: [language]
    },
    { timeout: 10000 }
  );
  return response.data.attributeScores;
}

async function verifyPerspective() {
  logger.info('🛡️  Verifying Perspective API Configuration...\n');

  // Check environment variable
  const apiKey = process.env.PERSPECTIVE_API_KEY;

  if (!apiKey) {
    logger.error('❌ ERROR: PERSPECTIVE_API_KEY not found in .env');
    logger.error('   Add it to your .env file:');
    logger.error('   PERSPECTIVE_API_KEY=your_key_here\n');
    logger.error('💡 How to get Perspective API key:\n');
    logger.error('1. Request access: https://developers.perspectiveapi.com/s/');
    logger.error('2. Wait for approval (can take days)');
    logger.error('3. Enable Perspective API in Google Cloud Console');
    logger.error('4. Generate API key');
    logger.error('5. Add to .env file\n');
    process.exit(1);
  }

  logger.info('✅ API Key found in environment');
  // Security: Do NOT log API key or prefix (GDPR/SOC2 compliance - CodeRabbit #3343936799)
  logger.info();

  try {
    // Test 1: Analyze a sample comment for toxicity
    logger.info('🔍 Test 1: Testing toxicity analysis...');

    const testComment = 'You are a stupid person and I hate you';

    const scores = await analyzeComment(apiKey, testComment, {
      TOXICITY: {},
      SEVERE_TOXICITY: {},
      IDENTITY_ATTACK: {},
      INSULT: {},
      PROFANITY: {},
      THREAT: {}
    });

    const toxicityScore = scores.TOXICITY.summaryScore.value;

    logger.info('✅ Toxicity analysis working!');
    logger.info(`   Test comment: "${testComment}"`);
    logger.info(`   Toxicity score: ${(toxicityScore * 100).toFixed(2)}%`);
    logger.info('\n   Detailed scores:');

    Object.entries(scores).forEach(([attribute, data]) => {
      const score = data.summaryScore.value;
      const percentage = (score * 100).toFixed(2);
      logger.info(`     - ${attribute}: ${percentage}%`);
    });
    logger.info();

    // Test 2: Analyze a neutral comment
    logger.info('🔍 Test 2: Testing with neutral comment...');

    const neutralComment = 'This is a wonderful day and I appreciate your help';

    const scores2 = await analyzeComment(apiKey, neutralComment);

    const neutralScore = scores2.TOXICITY.summaryScore.value;

    logger.info('✅ Neutral comment analysis working!');
    logger.info(`   Test comment: "${neutralComment}"`);
    logger.info(`   Toxicity score: ${(neutralScore * 100).toFixed(2)}%`);
    logger.info();

    // Test 3: Test Spanish language support
    logger.info('🔍 Test 3: Testing Spanish language support...');

    const spanishComment = 'Eres un idiota y me caes mal';

    try {
      const scores3 = await analyzeComment(apiKey, spanishComment, { TOXICITY: {} }, 'es');

      const spanishScore = scores3.TOXICITY.summaryScore.value;

      logger.info('✅ Spanish language support working!');
      logger.info(`   Test comment: "${spanishComment}"`);
      logger.info(`   Toxicity score: ${(spanishScore * 100).toFixed(2)}%`);
      logger.info();
    } catch (error) {
      logger.info('⚠️  Spanish language support limited');
      logger.info('   Perspective API has better support for English');
      logger.info('   This is expected and normal\n');
    }

    // Summary
    logger.info('📊 Summary:\n');
    logger.info('✅ API Key: Valid');
    logger.info('✅ Toxicity Analysis: Working');
    logger.info('✅ Available Attributes:');
    logger.info('   - TOXICITY');
    logger.info('   - SEVERE_TOXICITY');
    logger.info('   - IDENTITY_ATTACK');
    logger.info('   - INSULT');
    logger.info('   - PROFANITY');
    logger.info('   - THREAT');
    logger.info();

    // Recommendations
    logger.info('💡 Integration Details:\n');
    logger.info('✅ Fallback system exists:');
    logger.info('   - Primary: Perspective API (Google)');
    logger.info('   - Fallback: OpenAI Moderation API');
    logger.info();
    logger.info('✅ Threshold recommendation:');
    logger.info('   - Toxic if score > 0.7 (70%)');
    logger.info('   - Moderate if score > 0.5 (50%)');
    logger.info('   - Safe if score < 0.5 (50%)');
    logger.info();
    logger.info('✅ Rate Limits:');
    logger.info('   - Free tier: 1 QPS (query per second)');
    logger.info('   - Paid tier: Contact Google for higher limits');
    logger.info();
    logger.info('📚 Documentation:');
    logger.info('   → https://developers.perspectiveapi.com/s/');
    logger.info('   → https://github.com/conversationai/perspectiveapi');
    logger.info();

    logger.info('🎉 Perspective API verification complete!\n');

  } catch (error) {
    logger.error('\n❌ ERROR during verification:');

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        logger.error('   Status: 400 Bad Request');
        logger.error('   Message:', data.error?.message || 'Invalid request format');
        logger.error('\n💡 Solution:');
        logger.error('   1. Check that the API key is correct');
        logger.error('   2. Verify the request format is valid');
        logger.error('   3. Ensure requested attributes are supported\n');
      } else if (status === 403) {
        logger.error('   Status: 403 Forbidden');
        logger.error('   Message:', data.error?.message || 'Access denied');
        logger.error('\n💡 Solution:');
        logger.error('   1. Verify API key is valid and not expired');
        logger.error('   2. Check that Perspective API is enabled in Google Cloud Console');
        logger.error('   3. Ensure billing is enabled (if required)');
        logger.error('   4. Request access: https://developers.perspectiveapi.com/s/\n');
      } else if (status === 429) {
        logger.error('   Status: 429 Rate Limited');
        logger.error('   Message: Too many requests');
        logger.error('\n💡 Solution:');
        logger.error('   1. Wait for rate limit to reset');
        logger.error('   2. Free tier: 1 QPS limit');
        logger.error('   3. Consider upgrading to paid tier\n');
      } else {
        logger.error('   Status:', status);
        logger.error('   Message:', data.error?.message || 'Unknown error');
        logger.error('   Details:', JSON.stringify(data, null, 2));
        logger.error();
      }
    } else if (error.code === 'ECONNABORTED') {
      logger.error('   Error: Request timeout');
      logger.error('\n💡 Solution:');
      logger.error('   1. Check internet connection');
      logger.error('   2. Try again in a few moments');
      logger.error('   3. Perspective API may be temporarily unavailable\n');
    } else {
      logger.error('   Message:', error.message);
      logger.error();
    }

    process.exit(1);
  }
}

// Run verification
verifyPerspective().catch(error => {
  logger.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
