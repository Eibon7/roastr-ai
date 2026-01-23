/**
 * Decision Engine - Loop Autónomo Supervisado
 * 
 * Sistema de decisión que determina si:
 * - CONTINUE: Continuar con siguiente paso
 * - BLOCK: Detener por violaciones
 * - ESCALATE: Requiere intervención humana
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// TIPOS DE DECISIÓN
// ============================================================================

const DECISION = {
  CONTINUE: 'CONTINUE',
  BLOCK: 'BLOCK',
  ESCALATE: 'ESCALATE',
  COMPLETED: 'COMPLETED',
  ROLLED_BACK: 'ROLLED_BACK',
};

// ============================================================================
// TIPOS DE VIOLACIÓN
// ============================================================================

const VIOLATION_SEVERITY = {
  CRITICAL: 'critical',     // BLOCK inmediato
  HIGH: 'high',             // BLOCK o ESCALATE
  MEDIUM: 'medium',         // ESCALATE
  LOW: 'low',               // Warning, CONTINUE
};

const CRITICAL_VIOLATION_TYPES = [
  'LEGACY_FILE_MODIFICATION',
  'LEGACY_IMPORT',
  'LEGACY_WORKER',
  'LEGACY_SERVICE',
];

const HIGH_VIOLATION_TYPES = [
  'LEGACY_ID_REFERENCE',
  'LEGACY_PLAN_ID',
  'LEGACY_TOKEN',
];

const MEDIUM_VIOLATION_TYPES = [
  'LEGACY_BILLING_PROVIDER',
  'LEGACY_PLATFORM',
];

// ============================================================================
// DECISION ENGINE
// ============================================================================

/**
 * Determina decisión basada en resultado de validación
 * 
 * @param {string} phase - Fase actual (pre-task, post-task, execution)
 * @param {Object} validationResult - Resultado de validación
 * @param {Object} context - Contexto adicional (opcional)
 * @returns {Object} Decisión con razón y metadata
 */
function makeDecision(phase, validationResult, context = {}) {
  // Pre-task: Solo CONTINUE o BLOCK
  if (phase === 'pre-task') {
    if (validationResult.status === 'CONTINUE' || validationResult.v2Only?.passed) {
      return {
        decision: DECISION.CONTINUE,
        reason: 'No violations detected in pre-task validation',
        severity: null,
        violations: [],
      };
    }
    
    return {
      decision: DECISION.BLOCK,
      reason: 'Violations detected in pre-task validation',
      severity: getSeverity(validationResult.v2Only?.violations || []),
      violations: validationResult.v2Only?.violations || [],
    };
  }
  
  // Post-task: CONTINUE, BLOCK o ESCALATE
  if (phase === 'post-task') {
    if (validationResult.status === 'CONTINUE' || validationResult.v2Only?.passed) {
      return {
        decision: DECISION.CONTINUE,
        reason: 'No violations detected in post-task validation',
        severity: null,
        violations: [],
      };
    }
    
    const violations = validationResult.v2Only?.violations || [];
    const severity = getSeverity(violations);
    
    // Violaciones críticas → BLOCK inmediato
    if (severity === VIOLATION_SEVERITY.CRITICAL) {
      return {
        decision: DECISION.BLOCK,
        reason: 'Critical violations detected - rollback required',
        severity,
        violations,
      };
    }
    
    // Violaciones altas → BLOCK (pero podría ser ESCALATE si contexto lo permite)
    if (severity === VIOLATION_SEVERITY.HIGH) {
      // Si hay contexto de "allow_high_violations", ESCALATE en vez de BLOCK
      if (context.allowHighViolations) {
        return {
          decision: DECISION.ESCALATE,
          reason: 'High-severity violations detected - human decision required',
          severity,
          violations,
        };
      }
      
      return {
        decision: DECISION.BLOCK,
        reason: 'High-severity violations detected - rollback required',
        severity,
        violations,
      };
    }
    
    // Violaciones medias/bajas → ESCALATE
    return {
      decision: DECISION.ESCALATE,
      reason: `${severity}-severity violations detected - human review recommended`,
      severity,
      violations,
    };
  }
  
  // Execution: Raramente se usa (solo si error durante ejecución)
  if (phase === 'execution') {
    if (context.error) {
      return {
        decision: DECISION.BLOCK,
        reason: `Execution error: ${context.error.message}`,
        severity: VIOLATION_SEVERITY.CRITICAL,
        violations: [],
      };
    }
    
    return {
      decision: DECISION.CONTINUE,
      reason: 'Execution successful',
      severity: null,
      violations: [],
    };
  }
  
  // Completion: COMPLETED o ROLLED_BACK
  if (phase === 'completion') {
    if (context.rolledBack) {
      return {
        decision: DECISION.ROLLED_BACK,
        reason: context.rollbackReason || 'Rollback applied',
        severity: context.severity || VIOLATION_SEVERITY.HIGH,
        violations: context.violations || [],
      };
    }
    
    return {
      decision: DECISION.COMPLETED,
      reason: 'Task completed successfully',
      severity: null,
      violations: [],
    };
  }
  
  // Default: ESCALATE (no se sabe qué hacer)
  return {
    decision: DECISION.ESCALATE,
    reason: `Unknown phase: ${phase}`,
    severity: VIOLATION_SEVERITY.MEDIUM,
    violations: [],
  };
}

/**
 * Determina severidad de un conjunto de violaciones
 * 
 * @param {Array} violations - Lista de violaciones
 * @returns {string} Severidad máxima encontrada
 */
function getSeverity(violations) {
  if (!violations || violations.length === 0) {
    return null;
  }
  
  // Buscar severidad máxima
  let maxSeverity = VIOLATION_SEVERITY.LOW;
  
  for (const v of violations) {
    const type = v.type || 'UNKNOWN';
    
    if (CRITICAL_VIOLATION_TYPES.includes(type)) {
      return VIOLATION_SEVERITY.CRITICAL; // CRITICAL gana siempre
    }
    
    if (HIGH_VIOLATION_TYPES.includes(type)) {
      maxSeverity = VIOLATION_SEVERITY.HIGH;
      continue;
    }
    
    if (MEDIUM_VIOLATION_TYPES.includes(type)) {
      if (maxSeverity === VIOLATION_SEVERITY.LOW) {
        maxSeverity = VIOLATION_SEVERITY.MEDIUM;
      }
      continue;
    }
  }
  
  return maxSeverity;
}

/**
 * Verifica si hay violaciones críticas
 * 
 * @param {Array} violations - Lista de violaciones
 * @returns {boolean} true si hay violaciones críticas
 */
function hasCriticalViolations(violations) {
  if (!violations || violations.length === 0) {
    return false;
  }
  
  return violations.some(v => 
    CRITICAL_VIOLATION_TYPES.includes(v.type || 'UNKNOWN')
  );
}

/**
 * Verifica si hay violaciones altas
 * 
 * @param {Array} violations - Lista de violaciones
 * @returns {boolean} true si hay violaciones altas
 */
function hasHighViolations(violations) {
  if (!violations || violations.length === 0) {
    return false;
  }
  
  return violations.some(v => 
    HIGH_VIOLATION_TYPES.includes(v.type || 'UNKNOWN')
  );
}

/**
 * Filtra violaciones por severidad
 * 
 * @param {Array} violations - Lista de violaciones
 * @param {string} severity - Severidad a filtrar
 * @returns {Array} Violaciones filtradas
 */
function filterBySeverity(violations, severity) {
  if (!violations || violations.length === 0) {
    return [];
  }
  
  let types = [];
  
  switch (severity) {
    case VIOLATION_SEVERITY.CRITICAL:
      types = CRITICAL_VIOLATION_TYPES;
      break;
    case VIOLATION_SEVERITY.HIGH:
      types = HIGH_VIOLATION_TYPES;
      break;
    case VIOLATION_SEVERITY.MEDIUM:
      types = MEDIUM_VIOLATION_TYPES;
      break;
    default:
      return violations;
  }
  
  return violations.filter(v => types.includes(v.type || 'UNKNOWN'));
}

/**
 * Genera resumen de violaciones
 * 
 * @param {Array} violations - Lista de violaciones
 * @returns {Object} Resumen con contadores por severidad
 */
function summarizeViolations(violations) {
  if (!violations || violations.length === 0) {
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {},
    };
  }
  
  const summary = {
    total: violations.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    byType: {},
  };
  
  for (const v of violations) {
    const type = v.type || 'UNKNOWN';
    
    // Contar por tipo
    summary.byType[type] = (summary.byType[type] || 0) + 1;
    
    // Contar por severidad
    if (CRITICAL_VIOLATION_TYPES.includes(type)) {
      summary.critical++;
    } else if (HIGH_VIOLATION_TYPES.includes(type)) {
      summary.high++;
    } else if (MEDIUM_VIOLATION_TYPES.includes(type)) {
      summary.medium++;
    } else {
      summary.low++;
    }
  }
  
  return summary;
}

/**
 * Determina si se debe aplicar rollback
 * 
 * @param {Object} decision - Decisión del engine
 * @returns {boolean} true si rollback requerido
 */
function shouldRollback(decision) {
  return decision.decision === DECISION.BLOCK;
}

/**
 * Determina si se debe escalar a humano
 * 
 * @param {Object} decision - Decisión del engine
 * @returns {boolean} true si escalación requerida
 */
function shouldEscalate(decision) {
  return decision.decision === DECISION.ESCALATE;
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  // Decisiones
  DECISION,
  makeDecision,
  
  // Severidad
  VIOLATION_SEVERITY,
  getSeverity,
  hasCriticalViolations,
  hasHighViolations,
  filterBySeverity,
  summarizeViolations,
  
  // Tipos de violación
  CRITICAL_VIOLATION_TYPES,
  HIGH_VIOLATION_TYPES,
  MEDIUM_VIOLATION_TYPES,
  
  // Helpers
  shouldRollback,
  shouldEscalate,
};
