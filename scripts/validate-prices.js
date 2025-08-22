#!/usr/bin/env node
/**
 * Stripe Price Validation Script - Issue #171
 * 
 * Validates that Stripe Price objects have the required metadata
 * for the entitlements system to work correctly.
 * 
 * Usage:
 *   node scripts/validate-prices.js
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/validate-prices.js
 */

const config = require('../src/config');
const { flags } = require('../src/config/flags');

// Required metadata fields for each plan
const REQUIRED_METADATA = {
  free: [
    'plan_name',
    'analysis_limit_monthly',
    'roast_limit_monthly',
    'model',
    'shield_enabled',
    'rqc_mode'
  ],
  starter: [
    'plan_name',
    'analysis_limit_monthly',
    'roast_limit_monthly',
    'model',
    'shield_enabled',
    'rqc_mode'
  ],
  pro: [
    'plan_name',
    'analysis_limit_monthly',
    'roast_limit_monthly',
    'model',
    'shield_enabled',
    'rqc_mode'
  ],
  plus: [
    'plan_name',
    'analysis_limit_monthly',
    'roast_limit_monthly',
    'model',
    'shield_enabled',
    'rqc_mode'
  ]
};

// Expected values for validation
const EXPECTED_VALUES = {
  free: {
    plan_name: 'free',
    analysis_limit_monthly: '100',
    roast_limit_monthly: '100',
    model: 'gpt-3.5-turbo',
    shield_enabled: 'false',
    rqc_mode: 'basic'
  },
  starter: {
    plan_name: 'starter',
    analysis_limit_monthly: '500',
    roast_limit_monthly: '500',
    model: 'gpt-3.5-turbo',
    shield_enabled: 'false',
    rqc_mode: 'basic'
  },
  pro: {
    plan_name: 'pro',
    analysis_limit_monthly: '2000',
    roast_limit_monthly: '2000',
    model: 'gpt-4',
    shield_enabled: 'true',
    rqc_mode: 'advanced'
  },
  plus: {
    plan_name: 'plus',
    analysis_limit_monthly: '10000',
    roast_limit_monthly: '10000',
    model: 'gpt-4',
    shield_enabled: 'true',
    rqc_mode: 'premium'
  }
};

async function validateStripePrice(stripe, lookupKey, planName) {
  console.log(`\n🔍 Validating ${planName} plan (lookup_key: ${lookupKey})...`);
  
  try {
    // Find price by lookup_key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1
    });

    if (prices.data.length === 0) {
      console.error(`❌ No price found with lookup_key: ${lookupKey}`);
      return false;
    }

    const price = prices.data[0];
    console.log(`✅ Found price: ${price.id}`);
    
    // Validate metadata exists
    if (!price.metadata || Object.keys(price.metadata).length === 0) {
      console.error(`❌ Price ${price.id} has no metadata`);
      return false;
    }

    // Check required fields
    const requiredFields = REQUIRED_METADATA[planName];
    const missingFields = [];
    const incorrectValues = [];

    for (const field of requiredFields) {
      if (!price.metadata[field]) {
        missingFields.push(field);
      } else {
        const expected = EXPECTED_VALUES[planName][field];
        const actual = price.metadata[field];
        
        if (expected && actual !== expected) {
          incorrectValues.push({
            field,
            expected,
            actual
          });
        }
      }
    }

    // Report results
    if (missingFields.length > 0) {
      console.error(`❌ Missing required metadata fields: ${missingFields.join(', ')}`);
    }

    if (incorrectValues.length > 0) {
      console.error(`❌ Incorrect metadata values:`);
      incorrectValues.forEach(({ field, expected, actual }) => {
        console.error(`   ${field}: expected "${expected}", got "${actual}"`);
      });
    }

    if (missingFields.length === 0 && incorrectValues.length === 0) {
      console.log(`✅ All metadata is valid for ${planName} plan`);
      
      // Show metadata summary
      console.log(`📊 Metadata summary:`);
      requiredFields.forEach(field => {
        console.log(`   ${field}: ${price.metadata[field]}`);
      });
      
      return true;
    }

    return false;

  } catch (error) {
    console.error(`❌ Error validating ${planName} plan: ${error.message}`);
    return false;
  }
}

async function validateAllPrices() {
  console.log('🚀 Starting Stripe Price metadata validation...\n');

  // Check if billing is enabled OR if we're in CI mode with ENABLE_BILLING=true
  const billingEnabled = flags.isEnabled('ENABLE_BILLING') || process.env.ENABLE_BILLING === 'true';
  
  if (!billingEnabled) {
    console.log('⚠️  Billing is disabled, skipping validation');
    process.exit(0);
  }

  // Check Stripe configuration
  if (!config.billing.stripe.secretKey) {
    // In CI environment, this is expected - skip validation gracefully
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    
    if (isCI) {
      console.log('⚠️  STRIPE_SECRET_KEY not available in CI environment');
      console.log('✅ Skipping Stripe validation in CI - this is expected behavior');
      process.exit(0);
    } else {
      console.error('❌ STRIPE_SECRET_KEY is not configured');
      console.log('💡 Set STRIPE_SECRET_KEY environment variable and try again');
      process.exit(1);
    }
  }

  // Initialize Stripe
  const stripe = require('stripe')(config.billing.stripe.secretKey);
  
  console.log('🔑 Stripe client initialized');
  console.log(`📍 Using lookup keys from config:`);
  
  const lookupKeys = config.billing.stripe.priceLookupKeys;
  Object.entries(lookupKeys).forEach(([plan, key]) => {
    if (key) {
      console.log(`   ${plan}: ${key}`);
    }
  });

  let allValid = true;
  const plans = ['free', 'starter', 'pro', 'plus'];

  for (const plan of plans) {
    const lookupKey = lookupKeys[plan];
    
    if (!lookupKey) {
      console.log(`⚠️  Skipping ${plan} plan - no lookup key configured`);
      continue;
    }

    const isValid = await validateStripePrice(stripe, lookupKey, plan);
    allValid = allValid && isValid;
  }

  console.log('\n📋 Validation Summary:');
  if (allValid) {
    console.log('✅ All configured Stripe prices have valid metadata');
    console.log('🎉 Entitlements system is properly configured');
    process.exit(0);
  } else {
    console.log('❌ Some Stripe prices have invalid or missing metadata');
    console.log('🔧 Please update your Stripe prices and try again');
    console.log('\n💡 Example metadata for a pro plan:');
    console.log('   {');
    console.log('     "plan_name": "pro",');
    console.log('     "analysis_limit_monthly": "2000",');
    console.log('     "roast_limit_monthly": "2000",');
    console.log('     "model": "gpt-4",');
    console.log('     "shield_enabled": "true",');
    console.log('     "rqc_mode": "advanced"');
    console.log('   }');
    process.exit(1);
  }
}

// Add environment info for debugging
function showEnvironmentInfo() {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  console.log('🌍 Environment Information:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CI Environment: ${isCI ? '✅ Yes' : '❌ No'}`);
  console.log(`   ENABLE_BILLING: ${flags.isEnabled('ENABLE_BILLING')}`);
  console.log(`   Stripe Secret Key: ${config.billing.stripe.secretKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Config file: ${require.resolve('../src/config')}`);
}

// Handle unhandled errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error during validation:');
  console.error(error.message);
  console.error('\n🔍 Stack trace:');
  console.error(error.stack);
  process.exit(1);
});

// Main execution
if (require.main === module) {
  showEnvironmentInfo();
  validateAllPrices().catch(error => {
    console.error('\n💥 Validation failed with error:');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  validateStripePrice,
  validateAllPrices,
  REQUIRED_METADATA,
  EXPECTED_VALUES
};