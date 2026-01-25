/**
 * PRD Parser - Loop Autónomo Supervisado
 * 
 * Parser de PRDs (Product Requirements Documents) para generar subtareas.
 * 
 * Formato esperado de PRD:
 * ```markdown
 * # PRD: Feature X
 * 
 * ## Objetivos
 * - Objetivo 1
 * - Objetivo 2
 * 
 * ## Acceptance Criteria
 * 
 * ### AC1: Título del AC
 * - [ ] Checklist item 1
 * - [ ] Checklist item 2
 * 
 * ### AC2: Otro AC
 * - [ ] Checklist item
 * 
 * ## Out of Scope
 * - Item fuera de scope
 * 
 * ## Technical Notes
 * - Nota técnica 1
 * ```
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// PARSER DE PRD
// ============================================================================

/**
 * Parsea un PRD desde archivo
 * 
 * @param {string} prdPath - Path al archivo PRD
 * @returns {Object} PRD parseado
 */
function parsePRD(prdPath) {
  if (!fs.existsSync(prdPath)) {
    throw new Error(`PRD file not found: ${prdPath}`);
  }
  
  const content = fs.readFileSync(prdPath, 'utf-8');
  
  return {
    path: prdPath,
    title: extractTitle(content),
    objectives: extractObjectives(content),
    acceptanceCriteria: extractAcceptanceCriteria(content),
    outOfScope: extractOutOfScope(content),
    technicalNotes: extractTechnicalNotes(content),
    subtasks: generateSubtasksFromACs(content),
  };
}

/**
 * Extrae título del PRD
 * 
 * @param {string} content - Contenido del PRD
 * @returns {string} Título
 */
function extractTitle(content) {
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.trim().startsWith('# PRD:')) {
      return line.replace('# PRD:', '').trim();
    }
    if (line.trim().startsWith('# ')) {
      return line.replace('# ', '').trim();
    }
  }
  
  return 'Untitled PRD';
}

/**
 * Extrae objetivos del PRD
 * 
 * @param {string} content - Contenido del PRD
 * @returns {Array<string>} Lista de objetivos
 */
function extractObjectives(content) {
  return extractSection(content, '## Objetivos', '##');
}

/**
 * Extrae Acceptance Criteria del PRD
 * 
 * @param {string} content - Contenido del PRD
 * @returns {Array<Object>} Lista de ACs con checklists
 */
function extractAcceptanceCriteria(content) {
  const lines = content.split('\n');
  const acs = [];
  
  let inACSection = false;
  let currentAC = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detectar inicio de sección AC
    if (trimmed.match(/^## Acceptance Criteria/i)) {
      inACSection = true;
      continue;
    }
    
    // Detectar fin de sección AC (siguiente ## o ###)
    if (inACSection && trimmed.match(/^## [^#]/)) {
      break;
    }
    
    // Detectar nuevo AC (### ACX:)
    if (inACSection && trimmed.match(/^### AC\d+:/i)) {
      if (currentAC) {
        acs.push(currentAC);
      }
      
      const match = trimmed.match(/^### (AC\d+):\s*(.+)/i);
      currentAC = {
        id: match ? match[1].toUpperCase() : `AC${acs.length + 1}`,
        title: match ? match[2].trim() : trimmed.replace(/^### /, '').trim(),
        checklist: [],
      };
      continue;
    }
    
    // Extraer checklist items
    if (inACSection && currentAC && trimmed.match(/^- \[[ x]\]/)) {
      const item = trimmed.replace(/^- \[[ x]\]\s*/, '').trim();
      const completed = trimmed.includes('[x]');
      currentAC.checklist.push({
        item,
        completed,
      });
    }
  }
  
  // Añadir último AC
  if (currentAC) {
    acs.push(currentAC);
  }
  
  return acs;
}

/**
 * Extrae items fuera de scope
 * 
 * @param {string} content - Contenido del PRD
 * @returns {Array<string>} Lista de items fuera de scope
 */
function extractOutOfScope(content) {
  return extractSection(content, '## Out of Scope', '##');
}

/**
 * Extrae notas técnicas
 * 
 * @param {string} content - Contenido del PRD
 * @returns {Array<string>} Lista de notas técnicas
 */
function extractTechnicalNotes(content) {
  return extractSection(content, '## Technical Notes', '##');
}

/**
 * Extrae sección genérica de items con bullets
 * 
 * @param {string} content - Contenido del PRD
 * @param {string} sectionStart - Inicio de sección (ej: "## Objetivos")
 * @param {string} sectionEnd - Fin de sección (ej: "##")
 * @returns {Array<string>} Lista de items
 */
function extractSection(content, sectionStart, sectionEnd) {
  const lines = content.split('\n');
  const items = [];
  
  let inSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detectar inicio de sección
    if (trimmed.startsWith(sectionStart)) {
      inSection = true;
      continue;
    }
    
    // Detectar fin de sección
    if (inSection && trimmed.startsWith(sectionEnd) && !trimmed.startsWith(sectionStart)) {
      break;
    }
    
    // Extraer items (bullets)
    if (inSection && trimmed.startsWith('- ')) {
      items.push(trimmed.replace('- ', '').trim());
    }
  }
  
  return items;
}

/**
 * Genera subtareas desde Acceptance Criteria
 * 
 * @param {string} content - Contenido del PRD
 * @returns {Array<Object>} Lista de subtareas
 */
function generateSubtasksFromACs(content) {
  const acs = extractAcceptanceCriteria(content);
  const subtasks = [];
  
  for (const ac of acs) {
    subtasks.push({
      id: `subtask-${ac.id.toLowerCase()}`,
      acId: ac.id,
      title: ac.title,
      description: `Implementar ${ac.title}`,
      checklist: ac.checklist,
      status: 'pending',
      completed: false,
    });
  }
  
  return subtasks;
}

/**
 * Verifica si una tarea está dentro del scope del PRD
 * 
 * @param {Object} prd - PRD parseado
 * @param {string} taskDescription - Descripción de la tarea
 * @returns {boolean} true si está en scope
 */
function isInScope(prd, taskDescription) {
  const lowerDesc = taskDescription.toLowerCase();
  
  // STEP 1: Verificar si está explícitamente fuera de scope (PRIORITY)
  for (const outOfScope of prd.outOfScope) {
    const lowerOut = outOfScope.toLowerCase();
    if (lowerDesc.includes(lowerOut)) {
      return false; // Explícitamente fuera de scope (gana siempre)
    }
  }
  
  // STEP 2: Verificar si menciona algún AC
  for (const ac of prd.acceptanceCriteria) {
    const lowerTitle = ac.title.toLowerCase();
    if (lowerDesc.includes(lowerTitle) || lowerTitle.includes(lowerDesc)) {
      return true;
    }
  }
  
  // STEP 3: Verificar si menciona algún objetivo
  for (const objective of prd.objectives) {
    const lowerObj = objective.toLowerCase();
    if (lowerDesc.includes(lowerObj) || lowerObj.includes(lowerDesc)) {
      return true;
    }
  }
  
  // DEFAULT: Deny by default (unknown tasks are out of scope)
  return false;
}

/**
 * Encuentra subtarea por ID de AC
 * 
 * @param {Object} prd - PRD parseado
 * @param {string} acId - ID del AC (ej: "AC1")
 * @returns {Object|null} Subtarea encontrada o null
 */
function findSubtaskByAC(prd, acId) {
  return prd.subtasks.find(st => st.acId.toUpperCase() === acId.toUpperCase()) || null;
}

/**
 * Actualiza progreso de un AC en el PRD
 * 
 * @param {string} prdPath - Path al archivo PRD
 * @param {string} acId - ID del AC (ej: "AC1")
 * @param {number} itemIndex - Índice del item del checklist (opcional)
 */
function updateACProgress(prdPath, acId, itemIndex = null) {
  if (!fs.existsSync(prdPath)) {
    throw new Error(`PRD file not found: ${prdPath}`);
  }
  
  const content = fs.readFileSync(prdPath, 'utf-8');
  const lines = content.split('\n');
  
  let inTargetAC = false;
  let checklistItemCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detectar AC objetivo
    if (trimmed.match(new RegExp(`^### ${acId}:`, 'i'))) {
      inTargetAC = true;
      continue;
    }
    
    // Detectar fin de AC (siguiente ### o ##)
    if (inTargetAC && trimmed.match(/^###? /)) {
      break;
    }
    
    // Contar TODOS los items de checklist (marcados y sin marcar)
    if (inTargetAC && (trimmed.match(/^- \[ \]/) || trimmed.match(/^- \[x\]/))) {
      // Solo marcar si está sin marcar Y es el índice correcto
      if (trimmed.match(/^- \[ \]/) && (itemIndex === null || checklistItemCount === itemIndex)) {
        lines[i] = line.replace('- [ ]', '- [x]');
        
        if (itemIndex !== null) {
          break; // Solo marcar un item
        }
      }
      checklistItemCount++;
    }
  }
  
  // Guardar PRD actualizado
  fs.writeFileSync(prdPath, lines.join('\n'));
}

/**
 * Marca AC completo (todos los items)
 * 
 * @param {string} prdPath - Path al archivo PRD
 * @param {string} acId - ID del AC (ej: "AC1")
 */
function markACComplete(prdPath, acId) {
  updateACProgress(prdPath, acId, null); // null = todos los items
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  parsePRD,
  extractTitle,
  extractObjectives,
  extractAcceptanceCriteria,
  extractOutOfScope,
  extractTechnicalNotes,
  generateSubtasksFromACs,
  isInScope,
  findSubtaskByAC,
  updateACProgress,
  markACComplete,
};
