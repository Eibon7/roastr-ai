#!/usr/bin/env node

/**
 * SCRIPT: verify-env-config.js
 * PROPÓSITO: Verificar configuración de .env y detectar keys faltantes
 * USO: node scripts/verify-env-config.js
 */

const fs = require('fs');
const path = require('path');

// Simple .env parser (no dotenv needed)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  
  const env = {};
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
// Override process.env for checks
Object.assign(process.env, env);

const REQUIRED_KEYS = {
  'Polar (Billing)': [
    'POLAR_ACCESS_TOKEN',
    'POLAR_STARTER_PRODUCT_ID',
    'POLAR_PRO_PRODUCT_ID',
    'POLAR_PLUS_PRODUCT_ID'
  ],
  'Supabase (Database)': [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY'
  ],
  'OpenAI (AI)': [
    'OPENAI_API_KEY'
  ],
  'Email (Resend)': [
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL'
  ]
};

const OPTIONAL_KEYS = {
  'Polar (Optional)': [
    'POLAR_WEBHOOK_SECRET'
  ],
  'Social Media': [
    'TWITTER_BEARER_TOKEN',
    'YOUTUBE_API_KEY',
    'INSTAGRAM_ACCESS_TOKEN',
    'FACEBOOK_ACCESS_TOKEN',
    'DISCORD_BOT_TOKEN'
  ],
  'Security': [
    'IDEMPOTENCY_SECRET',
    'TRIAGE_CACHE_SECRET',
    'STYLE_PROFILE_ENCRYPTION_KEY',
    'PERSONA_ENCRYPTION_KEY'
  ],
  'Monitoring': [
    'SENTRY_DSN',
    'ALERT_WEBHOOK_URL'
  ]
};

const DEPRECATED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'POLAR_STARTER_PRICE_ID',
  'POLAR_PRO_PRICE_ID',
  'POLAR_PLUS_PRICE_ID'
];

console.log('🔍 Verificando configuración de .env...\n');

// Check if .env exists
if (!fs.existsSync(path.join(__dirname, '..', '.env'))) {
  console.error('❌ ERROR: .env no encontrado');
  console.error('   Ejecuta: npm run verify:env:create\n');
  process.exit(1);
}

console.log('✅ .env encontrado\n');

// === REQUIRED KEYS ===
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 KEYS REQUERIDAS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let missingRequired = [];
let hasAllRequired = true;

Object.entries(REQUIRED_KEYS).forEach(([category, keys]) => {
  console.log(`\n🔹 ${category}:`);
  keys.forEach(key => {
    const value = process.env[key];
    if (value && value.trim() !== '' && !value.startsWith('your-') && !value.startsWith('sk-your-')) {
      console.log(`  ✅ ${key}: configurado`);
    } else {
      console.log(`  ❌ ${key}: FALTA`);
      missingRequired.push({ category, key });
      hasAllRequired = false;
    }
  });
});

// === OPTIONAL KEYS ===
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 KEYS OPCIONALES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let optionalConfigured = 0;
let optionalTotal = 0;

Object.entries(OPTIONAL_KEYS).forEach(([category, keys]) => {
  console.log(`\n🔸 ${category}:`);
  keys.forEach(key => {
    optionalTotal++;
    const value = process.env[key];
    if (value && value.trim() !== '' && !value.startsWith('your-') && !value.startsWith('sk-your-')) {
      console.log(`  ✅ ${key}: configurado`);
      optionalConfigured++;
    } else {
      console.log(`  ⚪ ${key}: no configurado (opcional)`);
    }
  });
});

// === DEPRECATED KEYS ===
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  KEYS DEPRECADAS (DEBEN ELIMINARSE)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let hasDeprecated = false;
DEPRECATED_KEYS.forEach(key => {
  const value = process.env[key];
  if (value && value.trim() !== '') {
    console.log(`  ❌ ${key}: PRESENTE (debe eliminarse del .env)`);
    hasDeprecated = true;
  }
});

if (!hasDeprecated) {
  console.log('  ✅ No se encontraron keys deprecadas\n');
}

// === SUMMARY ===
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESUMEN');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (hasAllRequired) {
  console.log('✅ Todas las keys requeridas están configuradas');
} else {
  console.log(`❌ Faltan ${missingRequired.length} keys requeridas:`);
  missingRequired.forEach(({ category, key }) => {
    console.log(`   - ${key} (${category})`);
  });
}

console.log(`\n🔸 Keys opcionales: ${optionalConfigured}/${optionalTotal} configuradas`);

if (hasDeprecated) {
  console.log('\n⚠️  ADVERTENCIA: Hay keys deprecadas en tu .env');
  console.log('   Elimínalas manualmente o el código podría usarlas por error');
}

// === CODE VERIFICATION ===
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 VERIFICACIÓN DE CÓDIGO');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔎 Buscando referencias a keys deprecadas en el código...\n');

const { execSync } = require('child_process');

// Check for Stripe references
try {
  const stripeRefs = execSync(
    'grep -r "process\\.env\\.STRIPE" src/ --include="*.js" | wc -l',
    { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
  ).trim();
  
  if (parseInt(stripeRefs) > 0) {
    console.log(`⚠️  ${stripeRefs} referencias a STRIPE_* encontradas en src/`);
    console.log('   Nota: Stripe puede ser legacy code que aún no se ha eliminado');
  }
} catch (e) {
  // No grep matches
}

// Check for Sendgrid references
try {
  const sendgridRefs = execSync(
    'grep -r "process\\.env\\.SENDGRID" src/ --include="*.js" | wc -l',
    { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
  ).trim();
  
  if (parseInt(sendgridRefs) > 0) {
    console.log(`⚠️  ${sendgridRefs} referencias a SENDGRID_* encontradas en src/`);
    console.log('   Nota: Sendgrid está siendo reemplazado por Resend');
  }
} catch (e) {
  // No grep matches
}

// Check for PRICE_ID instead of PRODUCT_ID
try {
  const priceIdRefs = execSync(
    'grep -r "POLAR_.*PRICE_ID" src/ --include="*.js" | wc -l',
    { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
  ).trim();
  
  if (parseInt(priceIdRefs) > 0) {
    console.log(`⚠️  ${priceIdRefs} referencias a POLAR_*_PRICE_ID encontradas en src/`);
    console.log('   Nota: Polar usa PRODUCT_ID, no PRICE_ID');
  }
} catch (e) {
  // No grep matches
}

// === NEXT STEPS ===
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 PRÓXIMOS PASOS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (missingRequired.length > 0) {
  console.log('1. ⚠️  Configura las keys requeridas faltantes en .env');
  console.log('2. 🔄 Ejecuta este script nuevamente para verificar');
}

if (hasDeprecated) {
  console.log('3. 🧹 Elimina keys deprecadas del .env');
}

console.log('4. 🧪 Ejecuta npm test para verificar que todo funciona');
console.log('5. 🚀 Ejecuta npm start para iniciar el servidor\n');

// Exit code
if (!hasAllRequired) {
  process.exit(1);
} else {
  process.exit(0);
}

