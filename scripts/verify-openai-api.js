#!/usr/bin/env node

/**
 * OpenAI API Verification Script
 *
 * Verifies OpenAI configuration and quota for Issue #490
 * Related: API Configuration Checklist
 */

const OpenAI = require('openai');
require('dotenv').config();
const logger = require('../src/utils/logger');

async function verifyOpenAI() {
  logger.info('🤖 Verifying OpenAI API Configuration...\n');

  // Check environment variable
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.error('❌ ERROR: OPENAI_API_KEY not found in .env');
    logger.error('   Add it to your .env file:');
    logger.error('   OPENAI_API_KEY=sk-...\n');
    process.exit(1);
  }

  logger.info('✅ API Key found in environment');
  // Security: Mask API key (show only last 4 chars) - GDPR/SOC2 compliance (CodeRabbit #3343936799)
  const masked = apiKey.length > 8 ? `****${apiKey.slice(-4)}` : '****';
  logger.info(`   Key: ${masked}\n`);

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey, maxRetries: 2, timeout: 30000 });

  try {
    // Test 1: List available models
    logger.info('📋 Test 1: Listing available models...');
    const models = await openai.models.list();

    const gptModels = models.data
      .filter(m => m.id.includes('gpt'))
      .map(m => m.id)
      .sort();

    if (gptModels.length === 0) {
      logger.error('❌ No GPT models found (API key may be invalid)');
      process.exit(1);
    }

    logger.info(`✅ Found ${gptModels.length} GPT models:`);
    gptModels.slice(0, 5).forEach(m => logger.info(`   - ${m}`));
    if (gptModels.length > 5) {
      logger.info(`   ... and ${gptModels.length - 5} more`);
    }
    logger.info();

    // Test 2: Generate a test roast
    logger.info('🔥 Test 2: Generating test roast...');

    const testComment = "Tu código es tan malo que ni ChatGPT lo arregla";

    // Use env var override or prefer gpt-4o-mini if available
    const testModel =
      process.env.OPENAI_TEST_MODEL ||
      (gptModels.includes('gpt-4o-mini') ? 'gpt-4o-mini' : gptModels[0]);
    logger.info(`   Using model: ${testModel}`);

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: testModel,
      messages: [
        {
          role: 'system',
          content: 'Eres un generador de respuestas sarcásticas e ingeniosas en español.'
        },
        {
          role: 'user',
          content: `Genera una respuesta sarcástica corta (máximo 280 caracteres) para este comentario: "${testComment}"`
        }
      ],
      max_tokens: 150,
      temperature: 0.9
    });
    const duration = Date.now() - startTime;

    const roast = completion.choices[0].message.content.trim();
    const tokensUsed = completion.usage.total_tokens;

    logger.info(`✅ Roast generated successfully!`);
    logger.info(`   Input: "${testComment}"`);
    logger.info(`   Output: "${roast}"`);
    logger.info(`   Duration: ${duration}ms`);
    logger.info(`   Tokens used: ${tokensUsed} (prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens})`);
    logger.info(`   Model: ${completion.model}\n`);

    // Test 3: Check moderation API
    logger.info('🛡️  Test 3: Testing Moderation API...');

    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest', // Required by OpenAI SDK v5.11.0+ (CodeRabbit #3343936799)
      input: testComment
    });

    const result = moderation.results[0];
    logger.info('✅ Moderation API working');
    logger.info(`   Flagged: ${result.flagged}`);
    logger.info(`   Categories flagged:`);
    Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .forEach(([category]) => logger.info(`      - ${category}`));

    if (!result.flagged) {
      logger.info('   (No concerning content detected)');
    }
    logger.info();

    // Summary
    logger.info('📊 Summary:\n');
    logger.info('✅ API Key: Valid');
    logger.info('✅ Models Access: OK');
    logger.info('✅ Chat Completions: Working');
    logger.info('✅ Moderation API: Working');
    logger.info('✅ Response Time: ' + (duration < 5000 ? 'Good' : 'Slow') + ` (${duration}ms)`);
    logger.info();

    // Recommendations
    logger.info('💡 Next Steps:\n');
    logger.info('1. Check quota/billing:');
    logger.info('   → https://platform.openai.com/account/usage');
    logger.info();
    logger.info('2. Review rate limits for your tier:');
    logger.info('   → https://platform.openai.com/account/rate-limits');
    logger.info('   (Free tier: 3 RPM, Tier 1: 3,500 RPM, Tier 2: 5,000 RPM)');
    logger.info();
    logger.info('3. Test full roast generation:');
    logger.info('   → npm run roast "tu comentario aquí"');
    logger.info();

    logger.info('🎉 OpenAI API verification complete!\n');

  } catch (error) {
    logger.error('\n❌ ERROR during verification:');

    if (error.status === 401) {
      logger.error('   Status: 401 Unauthorized');
      logger.error('   Message: Invalid API key');
      logger.error('\n💡 Solution:');
      logger.error('   1. Get a valid API key from: https://platform.openai.com/api-keys');
      logger.error('   2. Update your .env file: OPENAI_API_KEY=sk-...');
      logger.error('   3. Make sure to copy the FULL key (starts with sk-proj or sk-)');
    } else if (error.status === 429) {
      logger.error('   Status: 429 Rate Limited');
      logger.error('   Message: Too many requests or quota exceeded');
      logger.error('\n💡 Solution:');
      logger.error('   1. Check your quota: https://platform.openai.com/account/usage');
      logger.error('   2. Add billing method: https://platform.openai.com/account/billing');
      logger.error('   3. Wait a few minutes and try again');
    } else if (error.status === 500 || error.status === 503) {
      logger.error('   Status: ' + error.status);
      logger.error('   Message: OpenAI service temporarily unavailable');
      logger.error('\n💡 Solution:');
      logger.error('   Wait a few minutes and try again');
    } else {
      logger.error('   Status:', error.status || 'Unknown');
      logger.error('   Message:', error.message || 'Unknown error');

      if (error.code) {
        logger.error('   Code:', error.code);
      }
    }

    logger.error();
    process.exit(1);
  }
}

// Run verification
verifyOpenAI().catch(error => {
  logger.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
