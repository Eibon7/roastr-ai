/**
 * Git Utilities - Loop Autónomo Supervisado
 * 
 * Utilidades para manejar operaciones git del Loop:
 * - Stash/unstash
 * - Commits temporales
 * - Rollback
 * - Estado del repo
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// GIT STATE
// ============================================================================

/**
 * Verifica si el working directory está limpio
 * 
 * @returns {boolean} true si no hay cambios sin commitear
 */
function isWorkingDirectoryClean() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length === 0;
  } catch (error) {
    throw new Error(`Failed to check git status: ${error.message}`);
  }
}

/**
 * Obtiene el commit actual (HEAD)
 * 
 * @returns {string} SHA del commit actual
 */
function getCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Failed to get current commit: ${error.message}`);
  }
}

/**
 * Obtiene la rama actual
 * 
 * @returns {string} Nombre de la rama actual
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error.message}`);
  }
}

/**
 * Obtiene archivos modificados
 * 
 * @returns {string[]} Lista de archivos modificados
 */
function getModifiedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

/**
 * Obtiene archivos staged
 * 
 * @returns {string[]} Lista de archivos staged
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

// ============================================================================
// STASH OPERATIONS
// ============================================================================

/**
 * Crea un stash con mensaje específico del Loop
 * 
 * @param {string} taskId - ID de la tarea
 * @returns {boolean} true si stash creado, false si no había cambios
 */
function stashChanges(taskId) {
  try {
    const message = `Loop: Pre-task stash for ${taskId}`;
    
    // Verificar si hay cambios para stash
    if (isWorkingDirectoryClean()) {
      return false; // No hay cambios, no se crea stash
    }
    
    execSync(`git stash push -u -m "${message}"`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    throw new Error(`Failed to stash changes: ${error.message}`);
  }
}

/**
 * Aplica el último stash del Loop
 * 
 * @param {string} taskId - ID de la tarea (para validación)
 * @returns {boolean} true si stash aplicado, false si no había stash
 */
function popStash(taskId) {
  try {
    // Verificar si hay stash
    const stashList = execSync('git stash list', { encoding: 'utf-8' });
    if (!stashList.trim()) {
      return false; // No hay stash
    }
    
    // Verificar que el stash más reciente es del Loop para esta tarea
    const firstStash = stashList.split('\n')[0];
    if (!firstStash.includes(`Loop: Pre-task stash for ${taskId}`)) {
      console.warn(`⚠️  Warning: Latest stash is not for task ${taskId}`);
      // Continuar de todas formas (puede ser stash previo del usuario)
    }
    
    execSync('git stash pop', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    // Si pop falla (conflictos), dejar stash y reportar
    console.error(`⚠️  Failed to pop stash: ${error.message}`);
    console.error('   Stash left intact. Resolve conflicts manually.');
    return false;
  }
}

/**
 * Descarta el último stash del Loop (sin aplicar)
 * 
 * @param {string} taskId - ID de la tarea (para validación)
 * @returns {boolean} true si stash descartado, false si no había stash
 */
function dropStash(taskId) {
  try {
    const stashList = execSync('git stash list', { encoding: 'utf-8' });
    if (!stashList.trim()) {
      return false;
    }
    
    const firstStash = stashList.split('\n')[0];
    if (!firstStash.includes(`Loop: Pre-task stash for ${taskId}`)) {
      console.warn(`⚠️  Warning: Latest stash is not for task ${taskId}`);
    }
    
    execSync('git stash drop', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    throw new Error(`Failed to drop stash: ${error.message}`);
  }
}

// ============================================================================
// COMMIT OPERATIONS
// ============================================================================

/**
 * Crea un commit temporal del Loop
 * 
 * @param {string} taskId - ID de la tarea
 * @param {string} phase - Fase (temp, final, rollback)
 * @returns {string} SHA del commit creado
 */
function createTempCommit(taskId, phase = 'temp') {
  try {
    // Stage todos los cambios
    execSync('git add -A', { encoding: 'utf-8' });
    
    // Verificar que hay cambios staged
    const stagedFiles = getStagedFiles();
    if (stagedFiles.length === 0) {
      throw new Error('No changes to commit');
    }
    
    // Crear commit temporal
    const message = `Loop: ${phase} commit for task ${taskId}`;
    execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
    
    return getCurrentCommit();
  } catch (error) {
    throw new Error(`Failed to create temp commit: ${error.message}`);
  }
}

/**
 * Amend el último commit (convierte temp en final)
 * 
 * @param {string} taskId - ID de la tarea
 * @param {string} newMessage - Nuevo mensaje de commit (opcional)
 * @returns {string} SHA del commit enmendado
 */
function amendCommit(taskId, newMessage = null) {
  try {
    const message = newMessage || `Loop: Task ${taskId} completed`;
    execSync(`git commit --amend -m "${message}"`, { encoding: 'utf-8' });
    return getCurrentCommit();
  } catch (error) {
    throw new Error(`Failed to amend commit: ${error.message}`);
  }
}

/**
 * Revierte el último commit (rollback)
 * 
 * @param {string} commitSha - SHA del commit a revertir (opcional, por defecto HEAD)
 * @returns {boolean} true si revert exitoso
 */
function revertCommit(commitSha = 'HEAD') {
  try {
    // Revert sin crear commit (para poder hacer rollback limpio)
    execSync(`git revert --no-commit ${commitSha}`, { encoding: 'utf-8' });
    
    // Reset para eliminar el commit revertido
    execSync('git reset --hard HEAD~1', { encoding: 'utf-8' });
    
    return true;
  } catch (error) {
    throw new Error(`Failed to revert commit: ${error.message}`);
  }
}

/**
 * Reset hard a un commit específico
 * 
 * @param {string} commitSha - SHA del commit al que volver
 * @returns {boolean} true si reset exitoso
 */
function resetToCommit(commitSha) {
  try {
    execSync(`git reset --hard ${commitSha}`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    throw new Error(`Failed to reset to commit ${commitSha}: ${error.message}`);
  }
}

// ============================================================================
// ROLLBACK COMPLETO
// ============================================================================

/**
 * Ejecuta rollback completo: revert commit + restore stash
 * 
 * @param {string} taskId - ID de la tarea
 * @param {string} commitSha - SHA del commit a revertir (opcional)
 * @returns {Object} Resultado del rollback
 */
function rollbackTask(taskId, commitSha = null) {
  const result = {
    success: false,
    commitReverted: false,
    stashRestored: false,
    errors: [],
  };
  
  try {
    // 1. Revert commit si se especifica
    if (commitSha) {
      try {
        revertCommit(commitSha);
        result.commitReverted = true;
      } catch (error) {
        result.errors.push(`Commit revert failed: ${error.message}`);
        throw error; // No continuar si commit revert falla
      }
    }
    
    // 2. Restaurar stash
    try {
      const stashRestored = popStash(taskId);
      result.stashRestored = stashRestored;
    } catch (error) {
      result.errors.push(`Stash restore failed: ${error.message}`);
      // Continuar (stash no es crítico)
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(`Rollback failed: ${error.message}`);
    return result;
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  // State
  isWorkingDirectoryClean,
  getCurrentCommit,
  getCurrentBranch,
  getModifiedFiles,
  getStagedFiles,
  
  // Stash
  stashChanges,
  popStash,
  dropStash,
  
  // Commit
  createTempCommit,
  amendCommit,
  revertCommit,
  resetToCommit,
  
  // Rollback
  rollbackTask,
};
