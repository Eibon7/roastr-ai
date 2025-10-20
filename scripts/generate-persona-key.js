#!/usr/bin/env node

/**
 * Generate Persona Encryption Key
 *
 * Generates a secure 32-byte (256-bit) encryption key for AES-256-GCM
 * encryption of persona fields.
 *
 * Usage:
 *   node scripts/generate-persona-key.js
 *
 * Output:
 *   PERSONA_ENCRYPTION_KEY=<64-character-hex-string>
 *
 * Security:
 *   - Key is 32 bytes (256 bits) for AES-256
 *   - Generated using crypto.randomBytes (cryptographically secure)
 *   - Output is hex-encoded for easy environment variable storage
 *
 * @see docs/nodes/persona.md for encryption architecture
 * @see src/utils/encryption.js for encryption implementation
 */

const crypto = require('crypto');

function generatePersonaKey() {
  // Generate 32 bytes (256 bits) of random data
  const key = crypto.randomBytes(32);

  // Convert to hex string (64 characters)
  const hexKey = key.toString('hex');

  return hexKey;
}

function main() {
  console.log('\n🔐 Persona Encryption Key Generator');
  console.log('====================================\n');

  const key = generatePersonaKey();

  console.log('Add this to your .env file:\n');
  console.log(`PERSONA_ENCRYPTION_KEY=${key}\n`);

  console.log('⚠️  Security Reminders:');
  console.log('  1. NEVER commit this key to git');
  console.log('  2. NEVER log this key in application code');
  console.log('  3. Store securely in environment variables');
  console.log('  4. Rotate key periodically (requires re-encryption)');
  console.log('  5. Use different keys for dev/staging/production\n');

  console.log('✅ Key length: 32 bytes (256 bits)');
  console.log('✅ Algorithm: AES-256-GCM');
  console.log('✅ Hex encoding: ' + key.length + ' characters\n');
}

if (require.main === module) {
  main();
}

module.exports = { generatePersonaKey };
