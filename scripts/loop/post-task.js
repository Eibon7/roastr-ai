#!/usr/bin/env node

/**
 * Post-Task Gate - V2-Only Enforcement
 * 
 * Propósito: Validar que NO hay violaciones V2-only DESPUÉS de completar una tarea del Loop.
 * 
 * Responsabilidad ÚNICA:
 * - Invocar scripts/loop/validators/v2-only.js --post-task
 * - Interpretar exit code
 * - Retornar JSON estructurado con resultado
 * 
 * NO hace:
 * - Ejecutar otros validadores
 * - Modificar archivos
 * - Decidir qué hacer (solo reporta)
 * - Tocar progress.json
 * - Avanzar automáticamente
 * 
 * Issue: ROA-538
 * AC: AC4 (Integración validada)
 * Versión: 1.0.0
 * Fecha: 2025-01-22
 */

const { execSync } = require('child_process');
const path = require('path');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const VALIDATOR_PATH = path.resolve(__dirname, 'validators/v2-only.js');

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Ejecuta validación V2-only post-task
 * 
 * @returns {Object} Resultado estructurado
 */
function runPostTaskValidation() {
  const result = {
    phase: 'post-task',
    timestamp: new Date().toISOString(),
    status: null,
    v2Only: {
      passed: false,
      violations: [],
      exitCode: null,
    },
    message: '',
  };

  try {
    // Ejecutar validador v2-only
    console.log('🔍 Ejecutando validación V2-only (post-task)...\n');
    
    const output = execSync(`node ${VALIDATOR_PATH} --post-task`, {
      encoding: 'utf-8',
    });
    
    // Mostrar output
    console.log(output);

    // Si llegamos aquí, exit code = 0 (PASS)
    result.status = 'CONTINUE';
    result.v2Only.passed = true;
    result.v2Only.exitCode = 0;
    result.message = '✅ Post-task validation PASSED - No violaciones V2-only detectadas';

  } catch (error) {
    // Mostrar output capturado
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    
    // Exit code != 0 (BLOCK)
    result.status = 'BLOCK';
    result.v2Only.passed = false;
    result.v2Only.exitCode = error.status || 1;
    result.message = '❌ Post-task validation FAILED - Violaciones V2-only detectadas. Revertir cambios requerido.';
    
    // Extraer violaciones del output capturado
    const capturedOutput = error.stdout || error.stderr || '';
    if (capturedOutput) {
      result.v2Only.violations.push({
        source: 'v2-only-validator',
        details: capturedOutput.trim().substring(0, 500) + (capturedOutput.length > 500 ? '...' : ''),
      });
    }
  }

  return result;
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Post-Task Gate - V2-Only Enforcement (ROA-538)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const result = runPostTaskValidation();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   RESULTADO:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  if (result.status === 'BLOCK') {
    console.log('🚨 BLOCK - Cambios contienen violaciones V2-only');
    console.log('   Acción requerida: Revertir cambios problemáticos antes de continuar\n');
    process.exit(1);
  }

  console.log('✅ CONTINUE - Cambios son válidos (V2-only)\n');
  process.exit(0);
}

// ============================================================================
// EXPORTAR
// ============================================================================

if (require.main === module) {
  main();
} else {
  module.exports = { runPostTaskValidation };
}
