#!/usr/bin/env node

/**
 * OpenAI API Verification Script
 *
 * Verifies OpenAI configuration and quota for Issue #490
 * Related: API Configuration Checklist
 */

const OpenAI = require('openai');
require('dotenv').config();

async function verifyOpenAI() {
  console.log('🤖 Verifying OpenAI API Configuration...\n');

  // Check environment variable
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ ERROR: OPENAI_API_KEY not found in .env');
    console.error('   Add it to your .env file:');
    console.error('   OPENAI_API_KEY=sk-...\n');
    process.exit(1);
  }

  console.log('✅ API Key found in environment');
  // Security: Mask API key (show only last 4 chars) - GDPR/SOC2 compliance (CodeRabbit #3343936799)
  const masked = apiKey.length > 8 ? `****${apiKey.slice(-4)}` : '****';
  console.log(`   Key: ${masked}\n`);

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey, maxRetries: 2, timeout: 30000 });

  try {
    // Test 1: List available models
    console.log('📋 Test 1: Listing available models...');
    const models = await openai.models.list();

    const gptModels = models.data
      .filter(m => m.id.includes('gpt'))
      .map(m => m.id)
      .sort();

    if (gptModels.length === 0) {
      console.error('❌ No GPT models found (API key may be invalid)');
      process.exit(1);
    }

    console.log(`✅ Found ${gptModels.length} GPT models:`);
    gptModels.slice(0, 5).forEach(m => console.log(`   - ${m}`));
    if (gptModels.length > 5) {
      console.log(`   ... and ${gptModels.length - 5} more`);
    }
    console.log();

    // Test 2: Generate a test roast
    console.log('🔥 Test 2: Generating test roast...');

    const testComment = "Tu código es tan malo que ni ChatGPT lo arregla";

    // Use env var override or prefer gpt-4o-mini if available
    const testModel =
      process.env.OPENAI_TEST_MODEL ||
      (gptModels.includes('gpt-4o-mini') ? 'gpt-4o-mini' : gptModels[0]);
    console.log(`   Using model: ${testModel}`);

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

    console.log(`✅ Roast generated successfully!`);
    console.log(`   Input: "${testComment}"`);
    console.log(`   Output: "${roast}"`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Tokens used: ${tokensUsed} (prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens})`);
    console.log(`   Model: ${completion.model}\n`);

    // Test 3: Check moderation API
    console.log('🛡️  Test 3: Testing Moderation API...');

    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest', // Required by OpenAI SDK v5.11.0+ (CodeRabbit #3343936799)
      input: testComment
    });

    const result = moderation.results[0];
    console.log('✅ Moderation API working');
    console.log(`   Flagged: ${result.flagged}`);
    console.log(`   Categories flagged:`);
    Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .forEach(([category]) => console.log(`      - ${category}`));

    if (!result.flagged) {
      console.log('   (No concerning content detected)');
    }
    console.log();

    // Summary
    console.log('📊 Summary:\n');
    console.log('✅ API Key: Valid');
    console.log('✅ Models Access: OK');
    console.log('✅ Chat Completions: Working');
    console.log('✅ Moderation API: Working');
    console.log('✅ Response Time: ' + (duration < 5000 ? 'Good' : 'Slow') + ` (${duration}ms)`);
    console.log();

    // Recommendations
    console.log('💡 Next Steps:\n');
    console.log('1. Check quota/billing:');
    console.log('   → https://platform.openai.com/account/usage');
    console.log();
    console.log('2. Review rate limits for your tier:');
    console.log('   → https://platform.openai.com/account/rate-limits');
    console.log('   (Free tier: 3 RPM, Tier 1: 3,500 RPM, Tier 2: 5,000 RPM)');
    console.log();
    console.log('3. Test full roast generation:');
    console.log('   → npm run roast "tu comentario aquí"');
    console.log();

    console.log('🎉 OpenAI API verification complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR during verification:');

    if (error.status === 401) {
      console.error('   Status: 401 Unauthorized');
      console.error('   Message: Invalid API key');
      console.error('\n💡 Solution:');
      console.error('   1. Get a valid API key from: https://platform.openai.com/api-keys');
      console.error('   2. Update your .env file: OPENAI_API_KEY=sk-...');
      console.error('   3. Make sure to copy the FULL key (starts with sk-proj or sk-)');
    } else if (error.status === 429) {
      console.error('   Status: 429 Rate Limited');
      console.error('   Message: Too many requests or quota exceeded');
      console.error('\n💡 Solution:');
      console.error('   1. Check your quota: https://platform.openai.com/account/usage');
      console.error('   2. Add billing method: https://platform.openai.com/account/billing');
      console.error('   3. Wait a few minutes and try again');
    } else if (error.status === 500 || error.status === 503) {
      console.error('   Status: ' + error.status);
      console.error('   Message: OpenAI service temporarily unavailable');
      console.error('\n💡 Solution:');
      console.error('   Wait a few minutes and try again');
    } else {
      console.error('   Status:', error.status || 'Unknown');
      console.error('   Message:', error.message || 'Unknown error');

      if (error.code) {
        console.error('   Code:', error.code);
      }
    }

    console.error();
    process.exit(1);
  }
}

// Run verification
verifyOpenAI().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
