#!/usr/bin/env node

/**
 * UTILITY: uncomment-env-keys.js
 * PROPÓSITO: Lógica compartida para descomentar keys en archivos .env
 * USO: const { uncommentKeys } = require('./utils/uncomment-env-keys');
 */

/**
 * Descomenta líneas específicas de un archivo .env
 * @param {string} envContent - Contenido completo del archivo .env
 * @param {string[]} keysToUncomment - Array de nombres de keys a descomentar
 * @returns {string} Contenido del .env con keys descomentadas
 */
function uncommentKeys(envContent, keysToUncomment) {
  const lines = envContent.split('\n');
  
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Skip empty lines and section headers
    if (!trimmed || trimmed === '#' || trimmed.startsWith('# ===')) {
      return line;
    }
    
    // Skip lines that are already uncommented
    if (!trimmed.startsWith('#')) {
      return line;
    }
    
    // Check if it's a commented key=value line
    const uncommentedLine = trimmed.substring(1).trim();
    if (!uncommentedLine.includes('=')) {
      return line; // Not a key=value, keep as is
    }
    
    const [key] = uncommentedLine.split('=');
    const keyName = key.trim();
    
    // Check if this key should be uncommented
    if (keysToUncomment.includes(keyName)) {
      return uncommentedLine;
    }
    
    return line;
  });
  
  return newLines.join('\n');
}

module.exports = { uncommentKeys };
