/**
 * Rollback Manager - Loop Autónomo Supervisado
 * 
 * Maneja el rollback automático cuando el Loop detecta violaciones V2-only.
 * 
 * Estrategia:
 * 1. Stash antes de ejecutar tarea
 * 2. Commit temporal después de ejecución
 * 3. Revert si post-task BLOCK
 * 4. Restaurar stash original
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const gitUtils = require('./git-utils');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ROLLBACK_LOG_DIR = path.resolve(__dirname, '../../../docs/autonomous-progress');

// ============================================================================
// PATH VALIDATION (Security)
// ============================================================================

/**
 * Valida y resuelve un taskId a un path seguro dentro de ROLLBACK_LOG_DIR
 * 
 * Previene path traversal attacks (../../../etc/passwd)
 * 
 * @param {string} taskId - ID de la tarea
 * @returns {string} Path resuelto y validado
 * @throws {Error} Si el taskId contiene path traversal o resulta fuera del dir base
 */
function validateTaskPath(taskId) {
  // Validar que taskId no esté vacío
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Invalid taskId: must be a non-empty string');
  }
  
  // Validar que no contenga caracteres de path traversal
  if (taskId.includes('..') || taskId.includes('/') || taskId.includes('\\')) {
    throw new Error(`Invalid taskId: contains path traversal characters (${taskId})`);
  }
  
  // Resolver el path completo
  const taskDir = path.join(ROLLBACK_LOG_DIR, taskId);
  const resolvedPath = path.resolve(taskDir);
  
  // Verificar que el path resuelto está dentro de ROLLBACK_LOG_DIR
  const baseDir = path.resolve(ROLLBACK_LOG_DIR);
  if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
    throw new Error(`Security: resolved path is outside base directory (${resolvedPath})`);
  }
  
  return resolvedPath;
}

// ============================================================================
// ROLLBACK STATE
// ============================================================================

/**
 * Estado del rollback (para poder restaurar)
 */
class RollbackState {
  constructor(taskId) {
    this.taskId = taskId;
    this.originalCommit = null;
    this.originalBranch = null;
    this.tempCommit = null;
    this.stashCreated = false;
    this.timestamp = new Date().toISOString();
  }
  
  /**
   * Captura el estado actual antes de ejecutar tarea
   */
  capture() {
    this.originalCommit = gitUtils.getCurrentCommit();
    this.originalBranch = gitUtils.getCurrentBranch();
  }
  
  /**
   * Registra que se creó un stash
   */
  markStashCreated() {
    this.stashCreated = true;
  }
  
  /**
   * Registra el commit temporal creado
   */
  markTempCommit(commitSha) {
    this.tempCommit = commitSha;
  }
  
  /**
   * Serializa el estado a JSON
   */
  toJSON() {
    return {
      taskId: this.taskId,
      originalCommit: this.originalCommit,
      originalBranch: this.originalBranch,
      tempCommit: this.tempCommit,
      stashCreated: this.stashCreated,
      timestamp: this.timestamp,
    };
  }
  
  /**
   * Guarda el estado a archivo
   */
  save() {
    const taskDir = validateTaskPath(this.taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    
    const statePath = path.join(taskDir, 'rollback-state.json');
    fs.writeFileSync(statePath, JSON.stringify(this.toJSON(), null, 2));
  }
  
  /**
   * Carga el estado desde archivo
   */
  static load(taskId) {
    const taskDir = validateTaskPath(taskId);
    const statePath = path.join(taskDir, 'rollback-state.json');
    if (!fs.existsSync(statePath)) {
      throw new Error(`Rollback state not found for task ${taskId}`);
    }
    
    const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const state = new RollbackState(taskId);
    Object.assign(state, data);
    return state;
  }
}

// ============================================================================
// ROLLBACK MANAGER
// ============================================================================

/**
 * Ejecuta una tarea con protección de rollback
 * 
 * @param {string} taskId - ID de la tarea
 * @param {Function} taskFn - Función a ejecutar (async)
 * @param {Function} postTaskValidationFn - Función de validación post-task (async)
 * @returns {Object} Resultado con status y detalles
 */
async function executeWithRollback(taskId, taskFn, postTaskValidationFn) {
  const result = {
    taskId,
    success: false,
    executed: false,
    validated: false,
    rolledBack: false,
    rollbackReason: null,
    state: null,
    errors: [],
  };
  
  const state = new RollbackState(taskId);
  
  try {
    // 1. Capturar estado inicial
    console.log(`📸 Capturando estado inicial...`);
    state.capture();
    state.save();
    result.state = state.toJSON();
    
    // 2. Stash cambios previos (si los hay)
    console.log(`💾 Stashing cambios previos...`);
    const stashCreated = gitUtils.stashChanges(taskId);
    if (stashCreated) {
      state.markStashCreated();
      state.save();
      console.log(`✅ Stash creado`);
    } else {
      console.log(`✅ No hay cambios para stash (working directory limpio)`);
    }
    
    // 3. Ejecutar tarea
    console.log(`\n⚙️  Ejecutando tarea...`);
    await taskFn();
    result.executed = true;
    console.log(`✅ Tarea ejecutada`);
    
    // 4. Verificar si hay cambios para commitear
    const modifiedFiles = gitUtils.getModifiedFiles();
    if (modifiedFiles.length === 0) {
      console.log(`\n⚠️  Warning: No se detectaron cambios después de ejecutar tarea`);
      // Restaurar stash y salir
      if (state.stashCreated) {
        gitUtils.popStash(taskId);
      }
      result.success = true; // No es error, simplemente no hubo cambios
      return result;
    }
    
    // 5. Crear commit temporal
    console.log(`\n💾 Creando commit temporal...`);
    const tempCommit = gitUtils.createTempCommit(taskId, 'temp');
    state.markTempCommit(tempCommit);
    state.save();
    console.log(`✅ Commit temporal creado: ${tempCommit.substring(0, 8)}`);
    
    // 6. Ejecutar validación post-task
    console.log(`\n🔍 Ejecutando validación post-task...`);
    const validationResult = await postTaskValidationFn();
    result.validated = true;
    
    if (validationResult.status === 'BLOCK') {
      // 7a. Rollback: Violaciones detectadas
      console.log(`\n🚨 BLOCK detectado - Iniciando rollback...`);
      result.rollbackReason = 'Post-task validation BLOCK';
      
      const rollbackResult = await rollback(taskId, state);
      result.rolledBack = rollbackResult.success;
      
      if (!rollbackResult.success) {
        result.errors.push(...rollbackResult.errors);
        throw new Error(`Rollback failed: ${rollbackResult.errors.join(', ')}`);
      }
      
      console.log(`✅ Rollback completado exitosamente`);
      logRollback(taskId, validationResult, rollbackResult);
      
      result.success = false; // Task falló (violaciones)
      return result;
    }
    
    // 7b. Success: Convertir commit temporal en final
    console.log(`\n✅ Validación post-task PASSED`);
    console.log(`💾 Convirtiendo commit temporal en final...`);
    
    const finalCommit = gitUtils.amendCommit(taskId, `Loop: Task ${taskId} completed`);
    console.log(`✅ Commit final: ${finalCommit.substring(0, 8)}`);
    
    // 8. Restaurar stash original (si existe)
    if (state.stashCreated) {
      console.log(`\n💾 Restaurando stash original...`);
      const stashRestored = gitUtils.popStash(taskId);
      if (stashRestored) {
        console.log(`✅ Stash restaurado`);
      } else {
        console.log(`⚠️  No se pudo restaurar stash (puede requerir resolución manual de conflictos)`);
      }
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    // Error durante ejecución → rollback
    console.error(`\n❌ Error durante ejecución: ${error.message}`);
    result.errors.push(error.message);
    result.rollbackReason = `Execution error: ${error.message}`;
    
    try {
      const rollbackResult = await rollback(taskId, state);
      result.rolledBack = rollbackResult.success;
      
      if (!rollbackResult.success) {
        result.errors.push(...rollbackResult.errors);
      }
    } catch (rollbackError) {
      result.errors.push(`Rollback error: ${rollbackError.message}`);
    }
    
    result.success = false;
    return result;
  }
}

/**
 * Ejecuta rollback completo
 * 
 * @param {string} taskId - ID de la tarea
 * @param {RollbackState} state - Estado del rollback
 * @returns {Object} Resultado del rollback
 */
async function rollback(taskId, state) {
  const result = {
    success: false,
    commitReverted: false,
    stashRestored: false,
    errors: [],
    steps: [],
  };
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`   ROLLBACK - Task ${taskId}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  try {
    // Paso 1: Revert commit temporal (si existe)
    if (state.tempCommit) {
      console.log(`1. Revirtiendo commit temporal: ${state.tempCommit.substring(0, 8)}`);
      try {
        gitUtils.revertCommit(state.tempCommit);
        result.commitReverted = true;
        result.steps.push('Commit reverted');
        console.log(`   ✅ Commit revertido\n`);
      } catch (error) {
        result.errors.push(`Commit revert failed: ${error.message}`);
        result.steps.push(`Commit revert failed: ${error.message}`);
        console.error(`   ❌ Error: ${error.message}\n`);
        
        // Intentar reset como fallback
        console.log(`   🔄 Intentando reset hard como fallback...`);
        try {
          gitUtils.resetToCommit(state.originalCommit);
          result.commitReverted = true;
          result.steps.push('Reset to original commit (fallback)');
          console.log(`   ✅ Reset exitoso\n`);
        } catch (resetError) {
          result.errors.push(`Reset fallback failed: ${resetError.message}`);
          result.steps.push(`Reset failed: ${resetError.message}`);
          console.error(`   ❌ Reset fallback falló: ${resetError.message}\n`);
          throw new Error('Failed to revert commit (both revert and reset failed)');
        }
      }
    } else {
      console.log(`1. No hay commit temporal para revertir\n`);
      result.steps.push('No temp commit to revert');
    }
    
    // Paso 2: Restaurar stash (si existe)
    if (state.stashCreated) {
      console.log(`2. Restaurando stash original...`);
      try {
        const stashRestored = gitUtils.popStash(taskId);
        result.stashRestored = stashRestored;
        result.steps.push('Stash restored');
        console.log(`   ✅ Stash restaurado\n`);
      } catch (error) {
        result.errors.push(`Stash restore failed: ${error.message}`);
        result.steps.push(`Stash restore failed: ${error.message}`);
        console.warn(`   ⚠️  Warning: ${error.message}`);
        console.warn(`   Stash left intact. Resolve conflicts manually.\n`);
        // No es crítico, continuar
      }
    } else {
      console.log(`2. No hay stash para restaurar\n`);
      result.steps.push('No stash to restore');
    }
    
    // Paso 3: Verificar que estamos en el estado original
    const currentCommit = gitUtils.getCurrentCommit();
    if (currentCommit !== state.originalCommit) {
      console.warn(`⚠️  Warning: Current commit (${currentCommit.substring(0, 8)}) differs from original (${state.originalCommit.substring(0, 8)})`);
      result.errors.push('Commit mismatch after rollback');
    } else {
      console.log(`✅ Verificado: Estado restaurado a commit original\n`);
    }
    
    // Determinar éxito: commit revertido (o no había temp commit) Y stash restaurado (si había stash)
    const commitSuccess = result.commitReverted || state.tempCommit === null;
    const stashSuccess = !state.stashCreated || result.stashRestored === true;
    
    if (!stashSuccess) {
      result.errors.push('Stash restore failed');
      console.warn(`⚠️  Rollback parcialmente exitoso: commit revertido pero stash no restaurado\n`);
    }
    
    result.success = commitSuccess && stashSuccess;
    
    console.log(`═══════════════════════════════════════════════════════════\n`);
    return result;
    
  } catch (error) {
    result.errors.push(`Rollback failed: ${error.message}`);
    result.steps.push(`Fatal error: ${error.message}`);
    console.error(`❌ Rollback falló: ${error.message}\n`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    return result;
  }
}

/**
 * Registra detalles del rollback en archivo
 * 
 * @param {string} taskId - ID de la tarea
 * @param {Object} validationResult - Resultado de validación que causó rollback
 * @param {Object} rollbackResult - Resultado del rollback
 */
function logRollback(taskId, validationResult, rollbackResult) {
  const taskDir = validateTaskPath(taskId);
  const artifactsDir = path.join(taskDir, 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  const log = {
    taskId,
    timestamp: new Date().toISOString(),
    validation: validationResult,
    rollback: rollbackResult,
  };
  
  const logPath = path.join(artifactsDir, 'rollback-log.json');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  
  // También log en texto plano para fácil lectura
  const textLog = `
═══════════════════════════════════════════════════════════
ROLLBACK LOG - Task ${taskId}
═══════════════════════════════════════════════════════════

Timestamp: ${log.timestamp}

VALIDATION RESULT:
- Status: ${validationResult.status}
- Passed: ${validationResult.v2Only?.passed || false}
- Violations: ${validationResult.v2Only?.violations?.length || 0}

ROLLBACK RESULT:
- Success: ${rollbackResult.success}
- Commit Reverted: ${rollbackResult.commitReverted}
- Stash Restored: ${rollbackResult.stashRestored}
- Errors: ${rollbackResult.errors.length}

STEPS EXECUTED:
${rollbackResult.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${rollbackResult.errors.length > 0 ? `\nERRORS:\n${rollbackResult.errors.map(err => `- ${err}`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════
  `.trim();
  
  const textLogPath = path.join(artifactsDir, 'rollback-log.txt');
  fs.writeFileSync(textLogPath, textLog);
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  executeWithRollback,
  rollback,
  RollbackState,
  logRollback,
};
