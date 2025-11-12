#!/usr/bin/env node

/**
 * SCRIPT: uncomment-configured-keys.js
 * PROPÓSITO: Descomentar líneas del .env que tienen valores reales (no placeholders)
 * USO: node scripts/uncomment-configured-keys.js
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

// Placeholders que indican que la key NO está configurada
const PLACEHOLDERS = [
  'your-',
  'sk-your-',
  'polar_at_your',
  'polar_webhook_secret_here',
  'product_id_for',
  'price_id_for',
  're_your_resend',
  'noreply@roastr.ai',  // Email de ejemplo
  'http://localhost',   // URLs de ejemplo
  'https://your-project',
  'SG.your-'
];

function isPlaceholder(value) {
  if (!value || value.trim() === '') return true;
  const val = value.toLowerCase();
  return PLACEHOLDERS.some(ph => val.includes(ph.toLowerCase()));
}

console.log('🔍 Analizando .env...\n');

// Read .env with error handling
let content, lines;
try {
  content = fs.readFileSync(ENV_FILE, 'utf-8');
  lines = content.split('\n');
} catch (error) {
  console.error('❌ Error leyendo .env:', error.message);
  process.exit(1);
}

let uncommented = 0;
let skipped = 0;
let alreadyActive = 0;

const newLines = lines.map(line => {
  const trimmed = line.trim();
  
  // Skip empty lines and section headers
  if (!trimmed || trimmed === '#' || trimmed.startsWith('# ===')) {
    return line;
  }
  
  // Skip lines that are already uncommented
  if (!trimmed.startsWith('#')) {
    if (trimmed.includes('=')) {
      alreadyActive++;
    }
    return line;
  }
  
  // Check if it's a commented key=value line
  const uncommentedLine = trimmed.substring(1).trim();
  if (!uncommentedLine.includes('=')) {
    return line; // Not a key=value, keep as is
  }
  
  const [key, ...valueParts] = uncommentedLine.split('=');
  const value = valueParts.join('=').trim();
  
  // Check if value is NOT a placeholder
  if (!isPlaceholder(value)) {
    console.log(`✅ Descomentando: ${key.trim()} (valor configurado)`);
    uncommented++;
    return uncommentedLine; // Return without the #
  } else {
    skipped++;
    return line; // Keep commented (placeholder detected)
  }
});

// Write back with error handling
try {
  fs.writeFileSync(ENV_FILE, newLines.join('\n'), 'utf-8');
} catch (error) {
  console.error('❌ Error escribiendo .env:', error.message);
  process.exit(1);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESUMEN');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`✅ Líneas descomentadas: ${uncommented}`);
console.log(`⚪ Líneas ya activas: ${alreadyActive}`);
console.log(`💤 Líneas sin configurar (quedan comentadas): ${skipped}`);

if (uncommented > 0) {
  console.log('\n✅ .env actualizado correctamente');
  console.log('🔄 Ejecuta: npm run verify:env:config para verificar\n');
} else {
  console.log('\n⚠️  No se descomentó ninguna línea');
  console.log('   Posibles razones:');
  console.log('   - Las keys aún tienen valores placeholder (your-, sk-your-, etc.)');
  console.log('   - Ya están descomentadas');
  console.log('   - No hay valores configurados\n');
}

