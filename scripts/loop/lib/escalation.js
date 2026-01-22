/**
 * Escalation Handler - Loop Autónomo Supervisado
 * 
 * Maneja escalación a humanos cuando el Loop no puede decidir automáticamente.
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ESCALATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const PROGRESS_DIR = path.resolve(__dirname, '../../../docs/autonomous-progress');

// ============================================================================
// ESCALATION OPTIONS
// ============================================================================

const ESCALATION_OPTIONS = {
  APPROVE: 'approve',           // Aprobar cambios (ignorar violaciones)
  REJECT: 'reject',             // Rechazar cambios (rollback + reintento)
  MODIFY: 'modify',             // Modificar manualmente (intervenir en código)
  ABORT: 'abort',               // Abortar tarea completamente
};

// ============================================================================
// ESCALATION HANDLER
// ============================================================================

/**
 * Escala decisión a humano
 * 
 * @param {string} taskId - ID de la tarea
 * @param {string} reason - Razón de la escalación
 * @param {Array} violations - Lista de violaciones
 * @param {Object} options - Opciones de configuración
 * @returns {Promise<Object>} Decisión del humano
 */
async function escalateToHuman(taskId, reason, violations, options = {}) {
  const {
    timeout = ESCALATION_TIMEOUT_MS,
    interactive = true,
    escalationFile = null,
  } = options;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   🚨 ESCALACIÓN REQUERIDA - DECISIÓN HUMANA NECESARIA');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Task ID: ${taskId}`);
  console.log(`Razón: ${reason}\n`);
  
  // Mostrar violaciones
  if (violations && violations.length > 0) {
    console.log('Violaciones detectadas:\n');
    for (const v of violations) {
      console.log(`  ❌ ${v.type || 'UNKNOWN'}`);
      console.log(`     Archivo: ${v.file || 'N/A'}`);
      console.log(`     Detalles: ${v.details || v.message || 'No details'}`);
      console.log(`     Sugerencia: ${v.suggestion || 'N/A'}`);
      console.log('');
    }
  }
  
  // Guardar escalación en archivo
  saveEscalation(taskId, reason, violations);
  
  // Si hay archivo de escalación predefinido, leer de ahí
  if (escalationFile && fs.existsSync(escalationFile)) {
    console.log(`📄 Leyendo decisión desde: ${escalationFile}\n`);
    const decision = readEscalationFile(escalationFile);
    console.log(`✅ Decisión recibida: ${decision.option}\n`);
    return decision;
  }
  
  // Si no es interactivo, esperar archivo o timeout
  if (!interactive) {
    console.log('⏳ Esperando decisión humana...');
    console.log(`   Archivo esperado: ${getEscalationFilePath(taskId)}`);
    console.log(`   Timeout: ${timeout}ms\n`);
    
    return await waitForEscalationFile(taskId, timeout);
  }
  
  // Modo interactivo: Pedir input por stdin
  return await promptHumanDecision(taskId, violations, timeout);
}

/**
 * Prompt interactivo para decisión humana
 * 
 * @param {string} taskId - ID de la tarea
 * @param {Array} violations - Lista de violaciones
 * @param {number} timeout - Timeout en ms
 * @returns {Promise<Object>} Decisión del humano
 */
async function promptHumanDecision(taskId, violations, timeout) {
  console.log('Opciones:\n');
  console.log('  1. APPROVE  - Aprobar cambios (ignorar violaciones)');
  console.log('  2. REJECT   - Rechazar cambios (rollback + reintento)');
  console.log('  3. MODIFY   - Modificar manualmente (intervenir en código)');
  console.log('  4. ABORT    - Abortar tarea completamente\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve, reject) => {
    // Timeout
    const timer = setTimeout(() => {
      rl.close();
      console.log('\n⏱️  Timeout - Escalando a ABORT por defecto\n');
      resolve({
        option: ESCALATION_OPTIONS.ABORT,
        reason: 'Timeout - no human decision received',
        timestamp: new Date().toISOString(),
      });
    }, timeout);
    
    rl.question('Ingresa tu decisión [1/2/3/4]: ', (answer) => {
      clearTimeout(timer);
      rl.close();
      
      let option;
      switch (answer.trim()) {
        case '1':
          option = ESCALATION_OPTIONS.APPROVE;
          break;
        case '2':
          option = ESCALATION_OPTIONS.REJECT;
          break;
        case '3':
          option = ESCALATION_OPTIONS.MODIFY;
          break;
        case '4':
          option = ESCALATION_OPTIONS.ABORT;
          break;
        default:
          console.log('\n⚠️  Opción inválida - Escalando a ABORT por defecto\n');
          option = ESCALATION_OPTIONS.ABORT;
      }
      
      console.log(`\n✅ Decisión recibida: ${option}\n`);
      
      resolve({
        option,
        reason: `Human decision: ${option}`,
        timestamp: new Date().toISOString(),
      });
    });
  });
}

/**
 * Espera archivo de escalación con decisión
 * 
 * @param {string} taskId - ID de la tarea
 * @param {number} timeout - Timeout en ms
 * @returns {Promise<Object>} Decisión del humano
 */
async function waitForEscalationFile(taskId, timeout) {
  const filePath = getEscalationFilePath(taskId);
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      // Verificar timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.log('\n⏱️  Timeout - Escalando a ABORT por defecto\n');
        resolve({
          option: ESCALATION_OPTIONS.ABORT,
          reason: 'Timeout - no human decision received',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      // Verificar si archivo existe
      if (fs.existsSync(filePath)) {
        clearInterval(checkInterval);
        console.log(`\n✅ Archivo de decisión encontrado: ${filePath}\n`);
        
        try {
          const decision = readEscalationFile(filePath);
          console.log(`✅ Decisión recibida: ${decision.option}\n`);
          resolve(decision);
        } catch (error) {
          console.error(`\n❌ Error leyendo archivo de decisión: ${error.message}\n`);
          resolve({
            option: ESCALATION_OPTIONS.ABORT,
            reason: `Error reading escalation file: ${error.message}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, 1000); // Check cada segundo
  });
}

/**
 * Lee archivo de escalación
 * 
 * @param {string} filePath - Path al archivo
 * @returns {Object} Decisión del humano
 */
function readEscalationFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse JSON
  try {
    const data = JSON.parse(content);
    return {
      option: data.option || ESCALATION_OPTIONS.ABORT,
      reason: data.reason || 'Decision from file',
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    // Parse texto plano (opción en primera línea)
    const lines = content.trim().split('\n');
    const firstLine = lines[0].trim().toLowerCase();
    
    let option = ESCALATION_OPTIONS.ABORT;
    if (firstLine.includes('approve')) option = ESCALATION_OPTIONS.APPROVE;
    else if (firstLine.includes('reject')) option = ESCALATION_OPTIONS.REJECT;
    else if (firstLine.includes('modify')) option = ESCALATION_OPTIONS.MODIFY;
    else if (firstLine.includes('abort')) option = ESCALATION_OPTIONS.ABORT;
    
    return {
      option,
      reason: 'Decision from text file',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Guarda escalación en archivo para registro
 * 
 * @param {string} taskId - ID de la tarea
 * @param {string} reason - Razón de la escalación
 * @param {Array} violations - Lista de violaciones
 */
function saveEscalation(taskId, reason, violations) {
  const taskDir = path.join(PROGRESS_DIR, taskId, 'artifacts');
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }
  
  const escalation = {
    taskId,
    reason,
    violations: violations || [],
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  
  const escalationPath = path.join(taskDir, 'escalation.json');
  fs.writeFileSync(escalationPath, JSON.stringify(escalation, null, 2));
  
  // También crear archivo de instrucciones para humano
  const instructionsPath = path.join(taskDir, 'ESCALATION-INSTRUCTIONS.txt');
  const instructions = `
═══════════════════════════════════════════════════════════
ESCALACIÓN REQUERIDA - Task ${taskId}
═══════════════════════════════════════════════════════════

Razón: ${reason}

Violaciones detectadas: ${violations ? violations.length : 0}

${violations && violations.length > 0 ? `
Detalles de violaciones:
${violations.map(v => `
  - Tipo: ${v.type || 'UNKNOWN'}
    Archivo: ${v.file || 'N/A'}
    Detalles: ${v.details || v.message || 'No details'}
    Sugerencia: ${v.suggestion || 'N/A'}
`).join('\n')}
` : ''}

───────────────────────────────────────────────────────────
OPCIONES DE DECISIÓN
───────────────────────────────────────────────────────────

1. APPROVE  - Aprobar cambios (ignorar violaciones)
2. REJECT   - Rechazar cambios (rollback + reintento)
3. MODIFY   - Modificar manualmente (intervenir en código)
4. ABORT    - Abortar tarea completamente

───────────────────────────────────────────────────────────
CÓMO RESPONDER
───────────────────────────────────────────────────────────

Opción A: Crear archivo de decisión JSON
  Archivo: ${getEscalationFilePath(taskId)}
  Formato:
  {
    "option": "approve|reject|modify|abort",
    "reason": "Justificación de la decisión",
    "timestamp": "2026-01-22T10:00:00Z"
  }

Opción B: Crear archivo de decisión texto
  Archivo: ${getEscalationFilePath(taskId)}
  Formato:
  approve
  (o reject, modify, abort en primera línea)

Opción C: Responder en terminal (si modo interactivo)
  Ingresa: 1, 2, 3, o 4

───────────────────────────────────────────────────────────

Timestamp: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════
  `.trim();
  
  fs.writeFileSync(instructionsPath, instructions);
}

/**
 * Obtiene path del archivo de decisión de escalación
 * 
 * @param {string} taskId - ID de la tarea
 * @returns {string} Path al archivo
 */
function getEscalationFilePath(taskId) {
  return path.join(PROGRESS_DIR, taskId, 'escalation-decision.json');
}

/**
 * Marca escalación como resuelta
 * 
 * @param {string} taskId - ID de la tarea
 * @param {Object} decision - Decisión del humano
 */
function markEscalationResolved(taskId, decision) {
  const escalationPath = path.join(PROGRESS_DIR, taskId, 'artifacts', 'escalation.json');
  
  if (!fs.existsSync(escalationPath)) {
    return;
  }
  
  const escalation = JSON.parse(fs.readFileSync(escalationPath, 'utf-8'));
  escalation.status = 'resolved';
  escalation.decision = decision;
  escalation.resolvedAt = new Date().toISOString();
  
  fs.writeFileSync(escalationPath, JSON.stringify(escalation, null, 2));
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  ESCALATION_OPTIONS,
  escalateToHuman,
  promptHumanDecision,
  waitForEscalationFile,
  readEscalationFile,
  saveEscalation,
  getEscalationFilePath,
  markEscalationResolved,
};
