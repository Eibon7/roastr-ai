#!/usr/bin/env node

/**
 * V2-Only Validator - Loop Autónomo Supervisado
 * 
 * Propósito: Garantizar que TODO desarrollo nuevo SOLO use artefactos Roastr V2.
 * Bloquea cualquier acceso (modificación/import) a artefactos legacy V1.
 * 
 * Scope: scripts/loop/, docs/prd/, docs/autonomous-progress/
 * 
 * NO bloquea: Lectura pasiva de legacy para contexto (inspección sin modificar)
 * 
 * Issue: ROA-538
 * Versión: 1.0.0
 * Fecha: 2025-01-22
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../../src/utils/logger');
const {
  getLegacyIDs,
  getLegacyPlanIDs,
  getLegacyBillingProviders,
  getLegacyWorkers,
  getLegacyServices,
  getLegacyPlatforms,
} = require('../shared/legacy-ids');

// ============================================================================
// CONFIGURACIÓN - Rutas Legacy Prohibidas
// ============================================================================

const LEGACY_PATHS = [
  'docs/legacy/',
  'docs/nodes/',          // No docs/nodes-v2/
  'docs/system-map.yaml', // No system-map-v2.yaml
  'spec.md',
];

const LEGACY_PATH_PATTERNS = [
  /^docs\/nodes\/.*\.md$/,            // Cualquier archivo bajo docs/nodes/ (excepto docs/nodes-v2/)
  /docs\/system-map\.yaml$/,           // docs/system-map.yaml pero NO system-map-v2.yaml
  /^spec\.md$/,                        // spec.md en root
  /docs\/legacy\//,                    // Cualquier cosa en docs/legacy/
];

// IDs legacy prohibidos (cargados dinámicamente desde system-map-v2.yaml)
const LEGACY_IDS = getLegacyIDs();
const LEGACY_PLAN_IDS = getLegacyPlanIDs();
const LEGACY_BILLING_PROVIDERS = getLegacyBillingProviders();
const LEGACY_WORKERS = getLegacyWorkers();
const LEGACY_SERVICES = getLegacyServices();
const LEGACY_PLATFORMS = getLegacyPlatforms();

// Excepciones: Scripts que PUEDEN acceder a legacy (con justificación)
const EXCEPTIONS = [
  /scripts\/migrate-.*\.js$/,          // Scripts de migración
  /scripts\/compare-v1-v2\.js$/,       // Comparación V1/V2
  /tests\/integration\/v1-v2-.*\.js$/, // Tests de paridad V1/V2
  /scripts\/ci\/detect-legacy-v1\.js$/, // El propio detector de CI
];

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica si un archivo es una excepción documentada
 */
function isException(filePath) {
  return EXCEPTIONS.some(pattern => pattern.test(filePath));
}

/**
 * Obtiene archivos modificados en el working directory
 */
function getModifiedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    logger.warn('⚠️  No se pudo obtener archivos modificados con git diff');
    return [];
  }
}

/**
 * Obtiene archivos staged
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    logger.warn('⚠️  No se pudo obtener archivos staged con git diff');
    return [];
  }
}

/**
 * Lee contenido de un archivo
 */
function readFileContent(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return '';
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    return '';
  }
}

// ============================================================================
// DETECTORES DE VIOLACIONES
// ============================================================================

/**
 * Detecta modificación de archivos legacy
 */
function detectLegacyFileModifications(files) {
  const violations = [];

  for (const file of files) {
    // Verificar si es excepción
    if (isException(file)) continue;

    // Verificar si toca ruta legacy
    const isLegacy = LEGACY_PATH_PATTERNS.some(pattern => pattern.test(file));
    if (isLegacy) {
      violations.push({
        type: 'LEGACY_FILE_MODIFICATION',
        file,
        message: `Modificación de archivo legacy detectada: ${file}`,
        suggestion: mapLegacyToV2(file),
      });
    }
  }

  return violations;
}

/**
 * Detecta imports desde módulos legacy
 */
function detectLegacyImports(files) {
  const violations = [];

  for (const file of files) {
    if (isException(file)) continue;
    if (!file.match(/\.(js|ts|jsx|tsx)$/)) continue;

    const content = readFileContent(file);
    if (!content) continue;

    // Buscar imports desde src/ (V1 backend)
    // Solo matchea cuando src/ viene directamente después de ./ o ../
    const srcImports = content.match(/(?:import|require)\s*\(?['"](?:\.\.?\/)+src\//g);
    if (srcImports) {
      violations.push({
        type: 'LEGACY_IMPORT',
        file,
        imports: srcImports,
        message: `Import desde src/ (V1) detectado en ${file}`,
        suggestion: 'Usar módulos de apps/backend-v2/ en su lugar',
      });
    }

    // Buscar imports desde frontend/ (V1 frontend)
    const frontendImports = content.match(/(?:import|require)\s*\(?['"](?:\.\.?\/)+frontend\//g);
    if (frontendImports) {
      violations.push({
        type: 'LEGACY_IMPORT',
        file,
        imports: frontendImports,
        message: `Import desde frontend/ (V1) detectado en ${file}`,
        suggestion: 'Usar módulos de apps/frontend-v2/ en su lugar',
      });
    }

    // Buscar imports desde docs/legacy/
    const legacyDocsImports = content.match(/(?:import|require)\s*\(?['"].*?\/docs\/legacy\//g);
    if (legacyDocsImports) {
      violations.push({
        type: 'LEGACY_IMPORT',
        file,
        imports: legacyDocsImports,
        message: `Import desde docs/legacy/ detectado en ${file}`,
        suggestion: 'Usar documentación de docs/nodes-v2/ o docs/SSOT-V2.md',
      });
    }
  }

  return violations;
}

/**
 * Detecta referencias a IDs legacy en código
 */
function detectLegacyIDReferences(files) {
  const violations = [];

  for (const file of files) {
    if (isException(file)) continue;
    if (!file.match(/\.(js|ts|jsx|tsx)$/)) continue;

    const content = readFileContent(file);
    if (!content) continue;

    // Buscar IDs legacy de nodos
    for (const legacyID of LEGACY_IDS) {
      // Buscar en strings literales y constantes (NO en comentarios)
      const pattern = new RegExp(`['"\`]${legacyID}['"\`]|const\\s+\\w+\\s*=\\s*['"\`]${legacyID}['"\`]`, 'g');
      const matches = content.match(pattern);
      
      if (matches) {
        // Filtrar comentarios
        const lines = content.split('\n');
        const realMatches = lines.filter(line => {
          return !line.trim().startsWith('//') && 
                 !line.trim().startsWith('*') && 
                 line.includes(legacyID);
        });

        if (realMatches.length > 0) {
          violations.push({
            type: 'LEGACY_ID_REFERENCE',
            file,
            legacyID,
            message: `Referencia a ID legacy '${legacyID}' detectada en ${file}`,
            suggestion: mapLegacyIDToV2(legacyID),
          });
        }
      }
    }

    // Buscar plan IDs legacy
    for (const planID of LEGACY_PLAN_IDS) {
      const pattern = new RegExp(`['"\`]${planID}['"\`]`, 'g');
      const matches = content.match(pattern);
      
      if (matches) {
        const lines = content.split('\n');
        const realMatches = lines.filter(line => {
          return !line.trim().startsWith('//') && 
                 !line.trim().startsWith('*') && 
                 line.includes(planID);
        });

        if (realMatches.length > 0) {
          violations.push({
            type: 'LEGACY_PLAN_ID',
            file,
            planID,
            message: `Referencia a plan ID legacy '${planID}' detectada en ${file}`,
            suggestion: 'Usar plan IDs de Polar (verificar en docs/SSOT-V2.md)',
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Detecta uso de workers legacy
 */
function detectLegacyWorkers(files) {
  const violations = [];

  for (const file of files) {
    if (isException(file)) continue;
    if (!file.match(/\.(js|ts|jsx|tsx)$/)) continue;

    const content = readFileContent(file);
    if (!content) continue;

    for (const worker of LEGACY_WORKERS) {
      if (content.includes(worker)) {
        // Verificar que NO es comentario
        const lines = content.split('\n');
        const realMatches = lines.filter(line => {
          return !line.trim().startsWith('//') && 
                 !line.trim().startsWith('*') && 
                 line.includes(worker);
        });

        if (realMatches.length > 0) {
          violations.push({
            type: 'LEGACY_WORKER',
            file,
            worker,
            message: `Uso de worker legacy '${worker}' detectado en ${file}`,
            suggestion: mapLegacyWorkerToV2(worker),
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Detecta uso de servicios legacy
 */
function detectLegacyServices(files) {
  const violations = [];

  for (const file of files) {
    if (isException(file)) continue;
    if (!file.match(/\.(js|ts|jsx|tsx)$/)) continue;

    const content = readFileContent(file);
    if (!content) continue;

    for (const service of LEGACY_SERVICES) {
      if (content.includes(service)) {
        const lines = content.split('\n');
        const realMatches = lines.filter(line => {
          return !line.trim().startsWith('//') && 
                 !line.trim().startsWith('*') && 
                 line.includes(service);
        });

        if (realMatches.length > 0) {
          violations.push({
            type: 'LEGACY_SERVICE',
            file,
            service,
            message: `Uso de servicio legacy '${service}' detectado en ${file}`,
            suggestion: 'Usar Polar billing (docs/SSOT-V2.md → billing_provider)',
          });
        }
      }
    }
  }

  return violations;
}

// ============================================================================
// MAPEOS LEGACY → V2
// ============================================================================

/**
 * Mapea archivo legacy a su equivalente V2
 */
function mapLegacyToV2(legacyPath) {
  if (legacyPath.includes('docs/nodes/')) {
    return 'Usar docs/nodes-v2/ en su lugar (verificar system-map-v2.yaml)';
  }
  if (legacyPath.includes('docs/system-map.yaml')) {
    return 'Usar docs/system-map-v2.yaml en su lugar';
  }
  if (legacyPath.includes('spec.md')) {
    return 'Usar docs/SSOT-V2.md y docs/nodes-v2/ en su lugar';
  }
  if (legacyPath.includes('docs/legacy/')) {
    return 'Documentación archivada. Leer pasivamente para contexto, NO modificar.';
  }
  return 'Verificar equivalente V2 en system-map-v2.yaml';
}

/**
 * Mapea ID legacy a su equivalente V2
 */
function mapLegacyIDToV2(legacyID) {
  const mapping = {
    'roast': 'roasting-engine',
    'shield': 'shield-engine',
    'social-platforms': 'integraciones-redes-sociales',
    'frontend-dashboard': 'frontend-admin o frontend-user-app',
    'plan-features': 'billing-integration',
    'persona': 'analysis-engine (subnode: persona-integration)',
  };
  return mapping[legacyID] || 'Verificar en system-map-v2.yaml';
}

/**
 * Mapea worker legacy a su equivalente V2
 */
function mapLegacyWorkerToV2(legacyWorker) {
  const mapping = {
    'GenerateReplyWorker': 'GenerateRoast',
    'PublisherWorker': 'SocialPosting',
    'BillingWorker': 'BillingUpdate',
  };
  return mapping[legacyWorker] || 'Verificar en system-map-v2.yaml → workers';
}

// ============================================================================
// VALIDACIÓN PRINCIPAL
// ============================================================================

/**
 * Ejecuta todas las validaciones y retorna violaciones
 */
function validateV2Only(mode = 'pre-task') {
  console.log(`🔍 Ejecutando validación V2-only (${mode})...\n`);

  // Obtener archivos modificados
  const modifiedFiles = getModifiedFiles();
  const stagedFiles = getStagedFiles();
  const allFiles = [...new Set([...modifiedFiles, ...stagedFiles])];

  if (allFiles.length === 0) {
    console.log('✅ No hay archivos modificados para validar.\n');
    return { violations: [], passed: true };
  }

  console.log(`📁 Analizando ${allFiles.length} archivo(s) modificado(s)...\n`);

  // Ejecutar detectores
  const violations = [
    ...detectLegacyFileModifications(allFiles),
    ...detectLegacyImports(allFiles),
    ...detectLegacyIDReferences(allFiles),
    ...detectLegacyWorkers(allFiles),
    ...detectLegacyServices(allFiles),
  ];

  return {
    violations,
    passed: violations.length === 0,
    filesAnalyzed: allFiles.length,
  };
}

/**
 * Imprime reporte de violaciones
 */
function printViolationsReport(result) {
  if (result.passed) {
    console.log('✅ PASS - No se detectaron violaciones V2-only\n');
    console.log(`   Archivos analizados: ${result.filesAnalyzed}`);
    console.log('   Violaciones: 0\n');
    return;
  }

  console.log('🚨 BLOCK - Violaciones V2-only detectadas\n');
  console.log(`   Archivos analizados: ${result.filesAnalyzed}`);
  console.log(`   Violaciones: ${result.violations.length}\n`);

  // Agrupar violaciones por tipo
  const byType = {};
  for (const v of result.violations) {
    if (!byType[v.type]) byType[v.type] = [];
    byType[v.type].push(v);
  }

  // Imprimir por tipo
  for (const [type, violations] of Object.entries(byType)) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`   ${type} (${violations.length})`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    for (const v of violations) {
      console.log(`❌ Archivo: ${v.file}`);
      console.log(`   Mensaje: ${v.message}`);
      if (v.legacyID) console.log(`   ID legacy: ${v.legacyID}`);
      if (v.worker) console.log(`   Worker legacy: ${v.worker}`);
      if (v.service) console.log(`   Servicio legacy: ${v.service}`);
      if (v.planID) console.log(`   Plan ID legacy: ${v.planID}`);
      if (v.imports) console.log(`   Imports: ${v.imports.join(', ')}`);
      console.log(`   💡 Sugerencia: ${v.suggestion}`);
      console.log('');
    }
  }

  console.log(`═══════════════════════════════════════════════════════════\n`);
  console.log('⚠️  ACCIÓN REQUERIDA:\n');
  console.log('   1. Revertir cambios en archivos legacy');
  console.log('   2. Usar artefactos V2 equivalentes (ver sugerencias arriba)');
  console.log('   3. Si necesitas contexto legacy, léelo pasivamente (sin modificar)');
  console.log('   4. Re-ejecutar validación antes de continuar\n');
  console.log('📚 Referencias:');
  console.log('   - SSOT V2: docs/SSOT-V2.md');
  console.log('   - System Map V2: docs/system-map-v2.yaml');
  console.log('   - Reglas V2: .cursor/rules/v2-only-strict.mdc\n');
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--pre-task') ? 'pre-task' : 
               args.includes('--post-task') ? 'post-task' : 
               'manual';

  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
V2-Only Validator - Loop Autónomo Supervisado

Uso:
  node scripts/loop/validators/v2-only.js [opciones]

Opciones:
  --pre-task    Ejecutar validación pre-task
  --post-task   Ejecutar validación post-task
  --help, -h    Mostrar esta ayuda

Descripción:
  Valida que TODO desarrollo nuevo SOLO use artefactos Roastr V2.
  Bloquea cualquier acceso (modificación/import) a artefactos legacy V1.

  NO bloquea: Lectura pasiva de legacy para contexto.

Ejemplos:
  node scripts/loop/validators/v2-only.js --pre-task
  node scripts/loop/validators/v2-only.js --post-task

Issue: ROA-538
Versión: 1.0.0
`);
    process.exit(0);
  }

  const result = validateV2Only(mode);
  printViolationsReport(result);

  if (!result.passed) {
    console.log('❌ Validación FALLÓ - Código de salida: 1\n');
    process.exit(1);
  }

  console.log('✅ Validación PASÓ - Código de salida: 0\n');
  process.exit(0);
}

// ============================================================================
// EXPORTAR PARA TESTS
// ============================================================================

if (require.main === module) {
  main();
} else {
  module.exports = {
    validateV2Only,
    detectLegacyFileModifications,
    detectLegacyImports,
    detectLegacyIDReferences,
    detectLegacyWorkers,
    detectLegacyServices,
    mapLegacyToV2,
    mapLegacyIDToV2,
    mapLegacyWorkerToV2,
    LEGACY_PATHS,
    LEGACY_IDS,
    LEGACY_WORKERS,
    LEGACY_SERVICES,
  };
}
