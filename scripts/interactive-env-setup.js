#!/usr/bin/env node

/**
 * SCRIPT: interactive-env-setup.js
 * PROPÓSITO: Descomentar interactivamente keys que ya tienes configuradas
 * USO: node scripts/interactive-env-setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE = path.join(__dirname, '..', '.env');

const KEYS_TO_CHECK = [
  { key: 'SUPABASE_URL', name: 'Supabase URL' },
  { key: 'SUPABASE_SERVICE_KEY', name: 'Supabase Service Key' },
  { key: 'SUPABASE_ANON_KEY', name: 'Supabase Anon Key' },
  { key: 'OPENAI_API_KEY', name: 'OpenAI API Key' },
  { key: 'POLAR_ACCESS_TOKEN', name: 'Polar Access Token' },
  { key: 'POLAR_STARTER_PRODUCT_ID', name: 'Polar Starter Product ID' },
  { key: 'POLAR_PRO_PRODUCT_ID', name: 'Polar Pro Product ID' },
  { key: 'POLAR_PLUS_PRODUCT_ID', name: 'Polar Plus Product ID' },
];

console.log('🔧 CONFIGURACIÓN INTERACTIVA DE .env\n');
console.log('Te voy a preguntar qué keys ya tienes configuradas.');
console.log('Responde "s" (sí) o "n" (no) para cada una.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let keysToUncomment = [];
let currentIndex = 0;

function askNext() {
  if (currentIndex >= KEYS_TO_CHECK.length) {
    rl.close();
    applyChanges();
    return;
  }
  
  const item = KEYS_TO_CHECK[currentIndex];
  rl.question(`¿Tienes configurado ${item.name} (${item.key})? (s/n): `, (answer) => {
    const trimmed = answer.trim().toLowerCase();
    if (trimmed === 's' || trimmed === 'si' || trimmed === 'sí' || trimmed === 'y' || trimmed === 'yes') {
      keysToUncomment.push(item.key);
      console.log(`  ✅ ${item.key} será descomentado\n`);
    } else {
      console.log(`  ⚪ ${item.key} quedará comentado\n`);
    }
    currentIndex++;
    askNext();
  });
}

function applyChanges() {
  if (keysToUncomment.length === 0) {
    console.log('\n⚠️  No se seleccionó ninguna key para descomentar.');
    console.log('   El .env no ha sido modificado.\n');
    return;
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 APLICANDO CAMBIOS...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Read .env
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');
  
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Skip non-key lines
    if (!trimmed.startsWith('#') || !trimmed.includes('=')) {
      return line;
    }
    
    // Extract key name
    const uncommented = trimmed.substring(1).trim();
    const keyName = uncommented.split('=')[0].trim();
    
    // Check if this key should be uncommented
    if (keysToUncomment.includes(keyName)) {
      console.log(`✅ Descomentado: ${keyName}`);
      return uncommented;
    }
    
    return line;
  });
  
  // Write back
  fs.writeFileSync(ENV_FILE, newLines.join('\n'), 'utf-8');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ .env ACTUALIZADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Líneas descomentadas: ${keysToUncomment.length}`);
  console.log('\n🔄 Ejecuta: node scripts/verify-env-config.js para verificar\n');
}

// Start
askNext();

