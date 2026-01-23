#!/usr/bin/env node

/**
 * Execute Task - Loop Autónomo Supervisado
 * 
 * Motor principal del Loop que orquesta:
 * - Pre-task validation (V2-only gate)
 * - Task execution
 * - Post-task validation (V2-only gate)
 * - Rollback automático si violaciones
 * - Progress tracking
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Libs
const { executeWithRollback } = require('./lib/rollback');
const gitUtils = require('./lib/git-utils');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const PRE_TASK_SCRIPT = path.resolve(__dirname, 'pre-task.js');
const POST_TASK_SCRIPT = path.resolve(__dirname, 'post-task.js');
const PROGRESS_DIR = path.resolve(__dirname, '../../docs/autonomous-progress');

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Sanitiza y valida taskId para prevenir path traversal
 */
function sanitizeTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Invalid taskId: must be a non-empty string');
  }
  
  // Solo permitir alphanumeric, dashes, underscores
  const sanitized = taskId.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized !== taskId) {
    throw new Error(`Invalid taskId: contains forbidden characters. Only alphanumeric, dashes and underscores allowed. Got: ${taskId}`);
  }
  
  if (sanitized.length === 0) {
    throw new Error('Invalid taskId: empty after sanitization');
  }
  
  return sanitized;
}

/**
 * Valida que el path resuelto esté dentro de PROGRESS_DIR
 */
function validateTaskPath(taskId) {
  const sanitized = sanitizeTaskId(taskId);
  const resolvedPath = path.resolve(PROGRESS_DIR, sanitized);
  const resolvedBase = path.resolve(PROGRESS_DIR);
  
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Path traversal detected: ${taskId} resolves outside PROGRESS_DIR`);
  }
  
  return { sanitized, resolvedPath };
}

/**
 * Inicializa directorio de progreso para la tarea
 */
function initializeProgressDir(taskId) {
  const { resolvedPath: taskDir } = validateTaskPath(taskId);
  
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }
  
  // Crear subdirectorios
  const artifactsDir = path.join(taskDir, 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  return taskDir;
}

/**
 * Crea archivo progress.json inicial
 */
function createProgressFile(taskId, options) {
  const taskDir = initializeProgressDir(taskId);
  const progressPath = path.join(taskDir, 'progress.json');
  
  const progress = {
    taskId,
    description: options.description || 'No description provided',
    prdPath: options.prdPath || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    validation: {
      preTask: {
        passed: null,
        timestamp: null,
        violations: [],
      },
      postTask: {
        passed: null,
        timestamp: null,
        violations: [],
      },
    },
    metrics: {
      executionTimeMs: 0,
      filesModified: 0,
      filesCreated: 0,
      testsAdded: 0,
      violationsDetected: 0,
      rollbacksApplied: 0,
    },
    currentPhase: 'pending',
    lastUpdate: new Date().toISOString(),
  };
  
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  return progress;
}

/**
 * Deep merge helper para preservar objetos anidados
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Actualiza archivo progress.json
 */
function updateProgress(taskId, updates) {
  const { resolvedPath: taskDir } = validateTaskPath(taskId);
  const progressPath = path.join(taskDir, 'progress.json');
  
  if (!fs.existsSync(progressPath)) {
    throw new Error(`Progress file not found for task ${taskId}`);
  }
  
  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  
  // Deep merge para preservar nested objects
  const merged = deepMerge(progress, updates);
  merged.lastUpdate = new Date().toISOString();
  
  fs.writeFileSync(progressPath, JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Log de decisión en decisions.jsonl (append-only)
 */
function logDecision(taskId, phase, decision, reason, metadata = {}) {
  const { resolvedPath: taskDir } = validateTaskPath(taskId);
  const decisionsPath = path.join(taskDir, 'decisions.jsonl');
  
  const entry = {
    timestamp: new Date().toISOString(),
    phase,
    decision,
    reason,
    ...metadata,
  };
  
  fs.appendFileSync(decisionsPath, JSON.stringify(entry) + '\n');
}

/**
 * Log de violación en violations.jsonl (append-only)
 */
function logViolation(taskId, phase, type, file, details, suggestion) {
  const { resolvedPath: taskDir } = validateTaskPath(taskId);
  const violationsPath = path.join(taskDir, 'violations.jsonl');
  
  const entry = {
    timestamp: new Date().toISOString(),
    phase,
    type,
    file,
    details,
    suggestion,
  };
  
  fs.appendFileSync(violationsPath, JSON.stringify(entry) + '\n');
}

// ============================================================================
// VALIDACIONES
// ============================================================================

/**
 * Ejecuta pre-task validation
 */
function runPreTaskValidation() {
  try {
    const output = execSync(`node ${PRE_TASK_SCRIPT}`, { encoding: 'utf-8' });
    
    // Parse resultado (el script retorna JSON multilinea)
    // Buscar el inicio del JSON y extraer hasta el final
    const lines = output.trim().split('\n');
    const startIndex = lines.findIndex(line => line.trim().startsWith('{'));
    
    if (startIndex === -1) {
      throw new Error('Pre-task script did not return valid JSON');
    }
    
    // Extraer desde { hasta }
    const jsonLines = [];
    let braceCount = 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      jsonLines.push(line);
      
      // Contar llaves
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      // Si braceCount == 0, terminamos el JSON
      if (braceCount === 0) break;
    }
    
    const jsonString = jsonLines.join('\n');
    const result = JSON.parse(jsonString);
    return result;
    
  } catch (error) {
    // Si exit code != 0, capturar output
    if (error.stdout) {
      const lines = error.stdout.trim().split('\n');
      const startIndex = lines.findIndex(line => line.trim().startsWith('{'));
      
      if (startIndex !== -1) {
        const jsonLines = [];
        let braceCount = 0;
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          jsonLines.push(line);
          
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
          
          if (braceCount === 0) break;
        }
        
        const jsonString = jsonLines.join('\n');
        return JSON.parse(jsonString);
      }
    }
    
    // Fallback si no hay JSON
    return {
      status: 'BLOCK',
      phase: 'pre-task',
      message: error.message,
      v2Only: {
        passed: false,
        exitCode: error.status || 1,
      },
    };
  }
}

/**
 * Ejecuta post-task validation
 */
function runPostTaskValidation() {
  try {
    const output = execSync(`node ${POST_TASK_SCRIPT}`, { encoding: 'utf-8' });
    
    // Parse resultado (el script retorna JSON multilinea)
    const lines = output.trim().split('\n');
    const startIndex = lines.findIndex(line => line.trim().startsWith('{'));
    
    if (startIndex === -1) {
      throw new Error('Post-task script did not return valid JSON');
    }
    
    // Extraer desde { hasta }
    const jsonLines = [];
    let braceCount = 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      jsonLines.push(line);
      
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      if (braceCount === 0) break;
    }
    
    const jsonString = jsonLines.join('\n');
    const result = JSON.parse(jsonString);
    return result;
    
  } catch (error) {
    if (error.stdout) {
      const lines = error.stdout.trim().split('\n');
      const startIndex = lines.findIndex(line => line.trim().startsWith('{'));
      
      if (startIndex !== -1) {
        const jsonLines = [];
        let braceCount = 0;
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          jsonLines.push(line);
          
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
          
          if (braceCount === 0) break;
        }
        
        const jsonString = jsonLines.join('\n');
        return JSON.parse(jsonString);
      }
    }
    
    return {
      status: 'BLOCK',
      phase: 'post-task',
      message: error.message,
      v2Only: {
        passed: false,
        exitCode: error.status || 1,
      },
    };
  }
}

// ============================================================================
// EJECUCIÓN DE TAREA
// ============================================================================

/**
 * Ejecuta tarea según instrucción
 * 
 * @param {string} instruction - Instrucción para Cursor (o comando shell)
 * @returns {Promise<void>}
 */
async function executeInstruction(instruction) {
  console.log(`\n📝 Instrucción: ${instruction}\n`);
  
  // Por ahora, asumimos que la instrucción es un comando shell
  // En futuras versiones, esto se integrará con Cursor API
  try {
    execSync(instruction, { 
      encoding: 'utf-8',
      stdio: 'inherit', // Mostrar output en tiempo real
    });
  } catch (error) {
    throw new Error(`Instruction execution failed: ${error.message}`);
  }
}

// ============================================================================
// FLUJO PRINCIPAL
// ============================================================================

/**
 * Ejecuta tarea completa con validaciones y rollback
 * 
 * @param {Object} options
 * @param {string} options.taskId - ID único de la tarea
 * @param {string} options.description - Descripción de la tarea
 * @param {string} options.instruction - Instrucción para ejecutar
 * @param {string} options.prdPath - Path al PRD (opcional)
 * @param {boolean} options.dryRun - Si true, solo valida sin ejecutar
 * @param {number} options.timeout - Timeout en ms (default: 10 min)
 * @returns {Promise<Object>} Resultado estructurado
 */
async function executeTask(options) {
  const {
    taskId,
    description = 'No description',
    instruction,
    prdPath = null,
    dryRun = false,
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`   LOOP AUTÓNOMO SUPERVISADO - Task ${taskId}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  console.log(`Description: ${description}`);
  if (prdPath) console.log(`PRD: ${prdPath}`);
  console.log(`Instruction: ${instruction}`);
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Timeout: ${timeout}ms`);
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // 1. Inicializar progress tracking
    console.log(`📊 Inicializando progress tracking...`);
    createProgressFile(taskId, { description, prdPath });
    updateProgress(taskId, { 
      status: 'validating-pre',
      currentPhase: 'pre-task-validation',
      startedAt: new Date().toISOString(),
    });
    logDecision(taskId, 'initialization', 'CONTINUE', 'Task initialized');
    
    // 2. Pre-task validation
    console.log(`\n🔍 FASE 1: Pre-Task Validation`);
    console.log(`─────────────────────────────────────────────────────────\n`);
    
    const preTaskResult = runPreTaskValidation();
    
    updateProgress(taskId, {
      validation: {
        preTask: {
          passed: preTaskResult.status === 'CONTINUE',
          timestamp: new Date().toISOString(),
          violations: preTaskResult.v2Only?.violations || [],
        },
      },
    });
    
    if (preTaskResult.status === 'BLOCK') {
      console.log(`\n🚨 Pre-task validation FAILED`);
      console.log(`   Razón: ${preTaskResult.message}`);
      
      logDecision(taskId, 'pre-task', 'BLOCK', preTaskResult.message, {
        v2Only: preTaskResult.v2Only,
      });
      
      // Registrar violaciones
      if (preTaskResult.v2Only?.violations) {
        for (const v of preTaskResult.v2Only.violations) {
          logViolation(taskId, 'pre-task', v.type || 'UNKNOWN', v.file || 'N/A', v.details || v.message, v.suggestion || '');
        }
      }
      
      updateProgress(taskId, {
        status: 'blocked',
        currentPhase: 'pre-task-validation-failed',
        completedAt: new Date().toISOString(),
        metrics: {
          executionTimeMs: Date.now() - startTime,
          violationsDetected: preTaskResult.v2Only?.violations?.length || 0,
        },
      });
      
      return {
        success: false,
        taskId,
        phase: 'pre-task-validation',
        status: 'BLOCKED',
        reason: 'Pre-task validation failed',
        validationResult: preTaskResult,
      };
    }
    
    console.log(`✅ Pre-task validation PASSED\n`);
    logDecision(taskId, 'pre-task', 'CONTINUE', 'No violations detected', {
      v2Only: preTaskResult.v2Only,
    });
    
    // Si dry-run, detener aquí
    if (dryRun) {
      console.log(`\n🏁 Dry-run completado (validación exitosa, no se ejecutó tarea)\n`);
      updateProgress(taskId, {
        status: 'completed',
        currentPhase: 'dry-run-completed',
        completedAt: new Date().toISOString(),
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      });
      
      return {
        success: true,
        taskId,
        phase: 'dry-run',
        status: 'COMPLETED',
        reason: 'Dry-run completed (validation only)',
      };
    }
    
    // 3. Ejecutar tarea con rollback protection
    console.log(`\n⚙️  FASE 2: Task Execution (con protección de rollback)`);
    console.log(`─────────────────────────────────────────────────────────\n`);
    
    updateProgress(taskId, {
      status: 'in-progress',
      currentPhase: 'execution',
    });
    
    const executionResult = await executeWithRollback(
      taskId,
      async () => {
        // Task function
        await executeInstruction(instruction);
      },
      async () => {
        // Post-task validation function
        const postTaskResult = runPostTaskValidation();
        
        const { resolvedPath: taskDir } = validateTaskPath(taskId);
        const existingProgress = JSON.parse(fs.readFileSync(path.join(taskDir, 'progress.json'), 'utf-8'));
        
        updateProgress(taskId, {
          validation: {
            ...existingProgress.validation,
            postTask: {
              passed: postTaskResult.status === 'CONTINUE',
              timestamp: new Date().toISOString(),
              violations: postTaskResult.v2Only?.violations || [],
            },
          },
        });
        
        if (postTaskResult.status === 'BLOCK') {
          // Registrar violaciones
          if (postTaskResult.v2Only?.violations) {
            for (const v of postTaskResult.v2Only.violations) {
              logViolation(taskId, 'post-task', v.type || 'UNKNOWN', v.file || 'N/A', v.details || v.message, v.suggestion || '');
            }
          }
          
          logDecision(taskId, 'post-task', 'BLOCK', postTaskResult.message, {
            v2Only: postTaskResult.v2Only,
          });
        } else {
          logDecision(taskId, 'post-task', 'CONTINUE', 'No violations detected', {
            v2Only: postTaskResult.v2Only,
          });
        }
        
        return postTaskResult;
      }
    );
    
    // 4. Procesar resultado
    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;
    
    if (executionResult.success) {
      console.log(`\n✅ TAREA COMPLETADA EXITOSAMENTE\n`);
      
      // Calcular métricas
      const modifiedFiles = gitUtils.getModifiedFiles();
      const stagedFiles = gitUtils.getStagedFiles();
      const allFiles = [...new Set([...modifiedFiles, ...stagedFiles])];
      
      // Contar archivos creados (existen Y creados durante/después de startTime)
      const filesCreated = allFiles.filter(f => {
        try {
          if (!fs.existsSync(f)) return false;
          const stat = fs.statSync(f);
          return stat.birthtimeMs >= startTime;
        } catch (error) {
          return false;
        }
      }).length;
      
      updateProgress(taskId, {
        status: 'completed',
        currentPhase: 'completed',
        completedAt: new Date().toISOString(),
        metrics: {
          executionTimeMs,
          filesModified: allFiles.length,
          filesCreated,
          testsAdded: allFiles.filter(f => f.includes('test')).length,
          violationsDetected: 0,
          rollbacksApplied: 0,
        },
      });
      
      logDecision(taskId, 'completion', 'COMPLETED', 'Task completed successfully', {
        metrics: {
          executionTimeMs,
          filesModified: allFiles.length,
        },
      });
      
      return {
        success: true,
        taskId,
        phase: 'completed',
        status: 'COMPLETED',
        reason: 'Task completed successfully',
        executionTimeMs,
        executionResult,
      };
      
    } else {
      console.log(`\n❌ TAREA FALLIDA (violaciones detectadas + rollback aplicado)\n`);
      
      updateProgress(taskId, {
        status: 'rolled-back',
        currentPhase: 'rolled-back',
        completedAt: new Date().toISOString(),
        metrics: {
          executionTimeMs,
          filesModified: 0,
          filesCreated: 0,
          testsAdded: 0,
          violationsDetected: executionResult.state?.validation?.postTask?.violations?.length || 0,
          rollbacksApplied: executionResult.rolledBack ? 1 : 0,
        },
      });
      
      logDecision(taskId, 'rollback', 'ROLLED_BACK', executionResult.rollbackReason || 'Unknown reason', {
        executionResult,
      });
      
      return {
        success: false,
        taskId,
        phase: 'rolled-back',
        status: 'ROLLED_BACK',
        reason: executionResult.rollbackReason,
        executionTimeMs,
        executionResult,
      };
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR FATAL: ${error.message}\n`);
    
    // Intentar actualizar progress, pero no permitir que falle y enmascare el error original
    try {
      updateProgress(taskId, {
        status: 'blocked',
        currentPhase: 'error',
        completedAt: new Date().toISOString(),
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      });
    } catch (progressError) {
      // Loggear error secundario pero no reemplazar el original
      console.warn(`⚠️ Warning: Failed to update progress during error handling: ${progressError.message}`);
    }
    
    // Intentar log de decisión, también guardado
    try {
      logDecision(taskId, 'error', 'BLOCKED', `Fatal error: ${error.message}`);
    } catch (logError) {
      console.warn(`⚠️ Warning: Failed to log decision during error handling: ${logError.message}`);
    }
    
    // PRESERVAR Y RETORNAR EL ERROR ORIGINAL
    return {
      success: false,
      taskId,
      phase: 'error',
      status: 'BLOCKED',
      reason: error.message,
      executionTimeMs: Date.now() - startTime,
    };
  } finally {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`   RESUMEN - Task ${taskId}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    // Leer progress.json solo si existe (podría fallar en createProgressFile)
    const { resolvedPath: taskDir } = validateTaskPath(taskId);
    const progressPath = path.join(taskDir, 'progress.json');
    
    if (fs.existsSync(progressPath)) {
      try {
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
        console.log(`Status: ${progress.status}`);
        console.log(`Fase: ${progress.currentPhase}`);
        console.log(`Tiempo: ${progress.metrics.executionTimeMs}ms`);
        console.log(`Archivos modificados: ${progress.metrics.filesModified}`);
        console.log(`Violaciones: ${progress.metrics.violationsDetected}`);
        console.log(`Rollbacks: ${progress.metrics.rollbacksApplied}`);
      } catch (parseError) {
        console.log(`Status: unknown (error reading progress file)`);
        console.log(`Error: ${parseError.message}`);
      }
    } else {
      console.log(`Status: unknown (progress file not created)`);
      console.log(`Task ID: ${taskId}`);
    }
    console.log('');
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse argumentos
  const getArg = (name) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    if (!arg) return null;
    
    // Encontrar primer '=' y retornar todo después
    const firstEqualIndex = arg.indexOf('=');
    return firstEqualIndex !== -1 ? arg.substring(firstEqualIndex + 1) : null;
  };
  
  const hasFlag = (name) => args.includes(`--${name}`);
  
  const taskId = getArg('task-id');
  const description = getArg('description');
  const instruction = getArg('instruction');
  const prdPath = getArg('prd');
  const dryRun = hasFlag('dry-run');
  const timeout = parseInt(getArg('timeout') || DEFAULT_TIMEOUT_MS, 10);
  
  // Validar argumentos requeridos
  if (!taskId) {
    console.error(`❌ Error: --task-id is required\n`);
    printUsage();
    process.exit(1);
  }
  
  if (!instruction && !dryRun) {
    console.error(`❌ Error: --instruction is required (unless --dry-run)\n`);
    printUsage();
    process.exit(1);
  }
  
  // Ejecutar tarea
  const result = await executeTask({
    taskId,
    description: description || `Task ${taskId}`,
    instruction: instruction || 'echo "dry-run"',
    prdPath,
    dryRun,
    timeout,
  });
  
  // Exit code según resultado
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage:
  node scripts/loop/execute-task.js [opciones]

Opciones requeridas:
  --task-id=<id>          ID único de la tarea (ej: task-001)
  --instruction=<cmd>     Instrucción a ejecutar (comando shell o Cursor)

Opciones opcionales:
  --description=<text>    Descripción de la tarea
  --prd=<path>            Path al PRD (ej: docs/prd/feature-x.md)
  --dry-run               Solo validar, no ejecutar tarea
  --timeout=<ms>          Timeout en ms (default: 600000 = 10 min)
  --help, -h              Mostrar esta ayuda

Ejemplos:
  # Ejecutar tarea simple
  node scripts/loop/execute-task.js \\
    --task-id="task-001" \\
    --description="Create roast endpoint" \\
    --instruction="touch apps/backend-v2/src/routes/roast.ts"

  # Ejecutar desde PRD
  node scripts/loop/execute-task.js \\
    --task-id="roast-v2-ac1" \\
    --prd="docs/prd/feature-roast-v2.md" \\
    --instruction="..."

  # Dry-run (solo validar)
  node scripts/loop/execute-task.js \\
    --task-id="test" \\
    --dry-run

Issue: ROA-539
Versión: 1.0.0
  `.trim());
}

if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  main().catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    process.exit(1);
  });
} else {
  module.exports = { executeTask };
}
