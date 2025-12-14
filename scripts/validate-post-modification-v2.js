#!/usr/bin/env node

/**
 * GDD v2 Post-Modification Consistency Validator
 *
 * Ejecuta todas las validaciones necesarias después de modificar nodos v2
 * o system-map-v2.yaml para asegurar consistencia.
 *
 * Este script ejecuta en secuencia:
 * 1. validate-v2-doc-paths.js - Valida paths de documentación
 * 2. validate-ssot-health.js - Valida sección 15 del SSOT
 * 3. check-system-map-drift.js - Valida drift del system-map
 * 4. validate-strong-concepts.js - Valida Strong Concepts
 *
 * Usage:
 *   node scripts/validate-post-modification-v2.js
 *   node scripts/validate-post-modification-v2.js --ci  # Exit 1 on any failure
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

// Lista de validaciones a ejecutar en orden
const VALIDATIONS = [
  {
    name: 'Documentation Paths',
    script: 'validate-v2-doc-paths.js',
    description: 'Validates that all doc paths in system-map-v2.yaml exist'
  },
  {
    name: 'SSOT Health',
    script: 'validate-ssot-health.js',
    description: 'Validates SSOT section 15 (GDD Health Score)'
  },
  {
    name: 'System Map Drift',
    script: 'check-system-map-drift.js',
    description: 'Validates consistency between system-map-v2.yaml and nodes-v2/'
  },
  {
    name: 'Strong Concepts',
    script: 'validate-strong-concepts.js',
    description: 'Validates Strong Concepts ownership and no duplicates'
  }
];

class PostModificationValidator {
  constructor(options = {}) {
    this.options = options;
    this.isCIMode = options.ci || false;
    this.results = [];
  }

  log(message, type = 'info') {
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        step: '📊'
      }[type] || 'ℹ️';

    const formattedMessage = `${prefix} ${message}`;

    if (type === 'error') {
      logger.error(formattedMessage);
    } else if (type === 'warning') {
      logger.warn(formattedMessage);
    } else {
      logger.info(formattedMessage);
    }
  }

  /**
   * Ejecuta un script de validación y captura su resultado
   */
  async runValidation(validation) {
    return new Promise((resolve) => {
      const scriptPath = path.join(SCRIPTS_DIR, validation.script);
      const args = this.isCIMode ? ['--ci'] : [];

      this.log(`Running: ${validation.name}...`, 'info');
      this.log(`  ${validation.description}`, 'info');

      const child = spawn('node', [scriptPath, ...args], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const success = code === 0;
        const result = {
          name: validation.name,
          script: validation.script,
          success,
          exitCode: code,
          stdout,
          stderr
        };

        if (success) {
          this.log(`✅ ${validation.name} passed`, 'success');
        } else {
          this.log(`❌ ${validation.name} failed (exit code: ${code})`, 'error');
          if (stderr) {
            logger.error(`  Error output: ${stderr.trim()}`);
          }
        }

        this.log(''); // Línea en blanco para separar
        resolve(result);
      });

      child.on('error', (error) => {
        const result = {
          name: validation.name,
          script: validation.script,
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: error.message,
          error: error.message
        };

        this.log(`❌ ${validation.name} failed to execute: ${error.message}`, 'error');
        this.log('');
        resolve(result);
      });
    });
  }

  /**
   * Ejecuta todas las validaciones en secuencia
   */
  async validate() {
    this.log('🔍 GDD v2 Post-Modification Consistency Validation', 'step');
    this.log('');
    this.log('Running all validations to ensure consistency after modifications...', 'info');
    this.log('');

    // Ejecutar todas las validaciones
    for (const validation of VALIDATIONS) {
      const result = await this.runValidation(validation);
      this.results.push(result);
    }

    // Generar resumen
    this.printSummary();

    // Determinar si todas pasaron
    const allPassed = this.results.every((r) => r.success);

    return allPassed;
  }

  /**
   * Imprime resumen de resultados
   */
  printSummary() {
    this.log('');
    this.log('📊 Validation Summary', 'step');
    this.log('');

    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    // Resumen numérico
    this.log(`Total validations: ${total}`, 'info');
    this.log(`✅ Passed: ${passed}`, passed > 0 ? 'success' : 'info');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log('');

    // Detalles de validaciones fallidas
    if (failed > 0) {
      this.log('Failed validations:', 'error');
      this.results
        .filter((r) => !r.success)
        .forEach((result, index) => {
          this.log(`  ${index + 1}. ${result.name} (${result.script})`, 'error');
          if (result.error) {
            this.log(`     Error: ${result.error}`, 'error');
          }
          if (result.stderr && result.stderr.trim()) {
            const errorLines = result.stderr.trim().split('\n').slice(0, 3);
            errorLines.forEach((line) => {
              this.log(`     ${line}`, 'error');
            });
            if (result.stderr.split('\n').length > 3) {
              this.log(`     ... (${result.stderr.split('\n').length - 3} more lines)`, 'error');
            }
          }
        });
      this.log('');
    }

    // Estado final
    if (failed === 0) {
      this.log('✅ All validations passed! System is consistent.', 'success');
    } else {
      this.log(
        `❌ ${failed} validation(s) failed. Please fix the issues before proceeding.`,
        'error'
      );
      this.log('');
      this.log('To fix issues:', 'info');
      this.log('  1. Review the error messages above', 'info');
      this.log('  2. Fix the issues in the relevant files', 'info');
      this.log('  3. Re-run this script to verify fixes', 'info');
    }

    this.log('');
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const isCI = args.includes('--ci');

  const validator = new PostModificationValidator({ ci: isCI });

  validator
    .validate()
    .then((allPassed) => {
      if (isCI && !allPassed) {
        process.exit(1);
      } else if (!allPassed) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((error) => {
      logger.error(`Fatal error: ${error.message}`);
      logger.error(error.stack);
      process.exit(1);
    });
}

module.exports = { PostModificationValidator };
