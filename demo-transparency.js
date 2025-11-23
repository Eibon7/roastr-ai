/**
 * Demo script for Issue #187 - AI Transparency Settings
 *
 * This script demonstrates how the new transparency functionality works
 * for different transparency modes (bio, signature, creative).
 */

const transparencyService = require('./src/services/transparencyService');

async function demoTransparencyFeature() {
  console.log('🔍 AI Transparency Settings Demo - Issue #187');
  console.log('===============================================\n');

  const testRoast = 'Your comment has the creativity of a broken calculator.';
  const testUserId = 'demo-user-123';

  console.log('Original Roast:');
  console.log(`"${testRoast}"`);
  console.log();

  // Demo bio mode
  console.log('1. 📄 BIO MODE (Default)');
  console.log('-------------------------');

  // Mock the transparency mode
  const originalGetMode = transparencyService.getUserTransparencyMode;
  transparencyService.getUserTransparencyMode = () => Promise.resolve('bio');

  const bioResult = await transparencyService.applyTransparencyDisclaimer(
    testRoast,
    testUserId,
    'es'
  );

  console.log('Final Roast:', `"${bioResult.finalText}"`);
  console.log('Bio Text Suggestion:', `"${bioResult.bioText}"`);
  console.log('Transparency Mode:', bioResult.transparencyMode);
  console.log('✅ User needs to manually add bio text to their profile\n');

  // Demo signature mode
  console.log('2. ✍️  SIGNATURE MODE');
  console.log('--------------------');

  transparencyService.getUserTransparencyMode = () => Promise.resolve('signature');

  const signatureResult = await transparencyService.applyTransparencyDisclaimer(
    testRoast,
    testUserId,
    'es'
  );

  console.log('Final Roast:', `"${signatureResult.finalText}"`);
  console.log('Transparency Mode:', signatureResult.transparencyMode);
  console.log('✅ Classic signature automatically appended\n');

  // Demo creative mode
  console.log('3. 🎭 CREATIVE MODE');
  console.log('------------------');

  transparencyService.getUserTransparencyMode = () => Promise.resolve('creative');

  for (let i = 1; i <= 3; i++) {
    const creativeResult = await transparencyService.applyTransparencyDisclaimer(
      testRoast,
      testUserId,
      'es'
    );
    console.log(`Creative Example ${i}:`, `"${creativeResult.finalText}"`);
  }
  console.log('✅ Random creative disclaimers for variety\n');

  // Demo English language
  console.log('4. 🌍 ENGLISH LANGUAGE SUPPORT');
  console.log('------------------------------');

  transparencyService.getUserTransparencyMode = () => Promise.resolve('signature');

  const englishResult = await transparencyService.applyTransparencyDisclaimer(
    testRoast,
    testUserId,
    'en'
  );

  console.log('English Signature:', `"${englishResult.finalText}"`);
  console.log('✅ Multi-language support\n');

  // Demo transparency options for frontend
  console.log('5. ⚙️  FRONTEND CONFIGURATION OPTIONS');
  console.log('-----------------------------------');

  const spanishOptions = transparencyService.getTransparencyOptions('es');
  console.log('Spanish Options:');
  spanishOptions.forEach((option) => {
    console.log(
      `  • ${option.value}: ${option.label} - ${option.description} ${option.is_default ? '(default)' : ''}`
    );
  });

  console.log('\nEnglish Options:');
  const englishOptions = transparencyService.getTransparencyOptions('en');
  englishOptions.forEach((option) => {
    console.log(
      `  • ${option.value}: ${option.label} - ${option.description} ${option.is_default ? '(default)' : ''}`
    );
  });

  // Demo API integration
  console.log('\n6. 🔗 API INTEGRATION EXAMPLE');
  console.log('-----------------------------');
  console.log('GET /api/user/settings/transparency-mode');
  console.log('Response example:');
  console.log(
    JSON.stringify(
      {
        success: true,
        data: {
          transparency_mode: 'bio',
          bio_text: 'Respuestas a comentarios inapropiados proporcionados por @Roastr.AI',
          options: spanishOptions
        }
      },
      null,
      2
    )
  );

  console.log('\nPATCH /api/user/settings/transparency-mode');
  console.log('Request body: { "mode": "signature" }');
  console.log('Response example:');
  console.log(
    JSON.stringify(
      {
        success: true,
        message: 'Transparency mode updated successfully',
        data: {
          transparency_mode: 'signature',
          bio_text: null
        }
      },
      null,
      2
    )
  );

  // Restore original function
  transparencyService.getUserTransparencyMode = originalGetMode;

  console.log('\n🎉 Issue #187 Implementation Summary:');
  console.log('=====================================');
  console.log('✅ Database schema updated with transparency_mode column');
  console.log('✅ API endpoints for getting and setting transparency preferences');
  console.log('✅ Transparency service with multi-language support');
  console.log('✅ Integration with roast generation pipeline');
  console.log('✅ Creative disclaimers pool with weighted random selection');
  console.log('✅ Comprehensive test coverage');
  console.log('✅ Audit logging for transparency mode changes');
  console.log('✅ Compliance with OpenAI and social media policies');
  console.log('\n🚀 Ready for frontend integration!');
}

// Run the demo
if (require.main === module) {
  demoTransparencyFeature().catch(console.error);
}

module.exports = { demoTransparencyFeature };
