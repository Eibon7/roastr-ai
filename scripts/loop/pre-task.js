#!/usr/bin/env node

/**
 * Pre-Task Gate - V2-Only Enforcement
 * 
 * Propósito: Validar que NO hay violaciones V2-only ANTES de comenzar una tarea del Loop.
 * 
 * Responsabilidad ÚNICA:
 * - Invocar scripts/loop/validators/v2-only.js --pre-task
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
 * Ejecuta validación V2-only pre-task
 * 
 * @returns {Object} Resultado estructurado
 */
function runPreTaskValidation() {
  const result = {
    phase: 'pre-task',
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
    console.log('🔍 Ejecutando validación V2-only (pre-task)...\n');
    
    execSync(`node ${VALIDATOR_PATH} --pre-task`, {
      encoding: 'utf-8',
      stdio: 'inherit',
    });

    // Si llegamos aquí, exit code = 0 (PASS)
    result.status = 'CONTINUE';
    result.v2Only.passed = true;
    result.v2Only.exitCode = 0;
    result.message = '✅ Pre-task validation PASSED - No violaciones V2-only detectadas';

  } catch (error) {
    // Exit code != 0 (BLOCK)
    result.status = 'BLOCK';
    result.v2Only.passed = false;
    result.v2Only.exitCode = error.status || 1;
    result.message = '❌ Pre-task validation FAILED - Violaciones V2-only detectadas. Loop NO puede iniciar.';
    
    // Intentar extraer violaciones del error (si están disponibles)
    if (error.stdout) {
      result.v2Only.violations.push({
        source: 'v2-only-validator',
        details: 'Ver output arriba para detalles completos',
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
  console.log('   Pre-Task Gate - V2-Only Enforcement (ROA-538)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const result = runPreTaskValidation();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   RESULTADO:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  if (result.status === 'BLOCK') {
    console.log('🚨 BLOCK - Loop NO puede iniciar');
    console.log('   Acción requerida: Resolver violaciones V2-only antes de continuar\n');
    process.exit(1);
  }

  console.log('✅ CONTINUE - Loop puede iniciar\n');
  process.exit(0);
}

// ============================================================================
// EXPORTAR
// ============================================================================

if (require.main === module) {
  main();
} else {
  module.exports = { runPreTaskValidation };
}
