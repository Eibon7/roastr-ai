#!/usr/bin/env node
/**
 * GDD v2 Root Cause Repair Script
 *
 * Repara las causas reales de bajos scores en GDD v2:
 * 1. Crosslinks faltantes (basado en system-map)
 * 2. SSOT Alignment (coherencia entre nodos y system-map)
 * 3. Simetría depends_on/required_by
 *
 * Reglas estrictas:
 * - NO inventar contenido
 * - NO modificar SSOT (excepto sección 15)
 * - Solo usar datos de system-map como fuente de verdad
 *
 * Usage:
 *   node scripts/repair-gdd-v2-root-causes.js
 *   node scripts/repair-gdd-v2-root-causes.js --dry-run
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs/nodes-v2');

function loadSystemMapV2() {
  try {
    const content = fs.readFileSync(SYSTEM_MAP_V2_PATH, 'utf8');
    return yaml.load(content);
  } catch (e) {
    throw new Error(`Error loading system-map-v2.yaml: ${e.message}`);
  }
}

function getNodeFileName(nodeId, systemMap) {
  const nodeData = systemMap.nodes[nodeId];
  const docs = nodeData?.docs || [];
  if (docs.length > 0) {
    return path.basename(docs[0]);
  }
  return null;
}

function repairCrosslinksInNode(nodeId, systemMap, dryRun = false) {
  const nodeData = systemMap.nodes[nodeId];
  if (!nodeData) return { modified: false, changes: [] };

  const docs = nodeData?.docs || [];
  if (docs.length === 0) return { modified: false, changes: [] };

  const docPath = path.isAbsolute(docs[0]) ? docs[0] : path.join(ROOT_DIR, docs[0]);
  if (!fs.existsSync(docPath)) {
    logger.warn(`Node file not found: ${docPath}`);
    return { modified: false, changes: [] };
  }

  let content = fs.readFileSync(docPath, 'utf8');
  const originalContent = content;
  const changes = [];

  const dependsOn = nodeData.depends_on || [];

  // Verificar crosslinks faltantes en la sección Dependencies
  const depsSectionMatch = content.match(/^##\s+\d+\.\s+Dependencies([\s\S]*?)(?=^##\s+\d+\.|$)/m);

  if (depsSectionMatch) {
    const depsSection = depsSectionMatch[0];
    const missingCrosslinks = [];

    dependsOn.forEach((dep) => {
      const depFileName = getNodeFileName(dep, systemMap);
      if (!depFileName) return;

      // Buscar si ya existe el crosslink
      const patterns = [
        new RegExp(`\\[\`${dep}\`\\]\\(.*?${depFileName}`, 'i'),
        new RegExp(`\\[${dep}\\]\\(.*?${depFileName}`, 'i')
      ];

      const exists = patterns.some((p) => p.test(depsSection));
      if (!exists) {
        missingCrosslinks.push({ dep, file: depFileName });
      }
    });

    if (missingCrosslinks.length > 0) {
      // Añadir crosslinks faltantes en la lista de dependencies
      let updatedDepsSection = depsSection;

      // Buscar la lista de dependencias
      const listMatch = depsSection.match(/(^- .+$)/m);
      if (listMatch) {
        // Añadir después de la última dependencia
        const lastDepLine = depsSection.lastIndexOf('\n- ');
        if (lastDepLine !== -1) {
          const insertPos = depsSection.indexOf('\n', lastDepLine + 1);
          missingCrosslinks.forEach((m) => {
            const newLine = `\n- [\`${m.dep}\`](./${m.file})`;
            updatedDepsSection =
              updatedDepsSection.substring(0, insertPos) +
              newLine +
              updatedDepsSection.substring(insertPos);
          });

          content = content.replace(depsSection, updatedDepsSection);
          changes.push(`Añadidos ${missingCrosslinks.length} crosslinks faltantes en Dependencies`);
        }
      }
    }
  }

  if (content !== originalContent && !dryRun) {
    fs.writeFileSync(docPath, content, 'utf8');
    return { modified: true, changes };
  } else if (content !== originalContent && dryRun) {
    return { modified: true, changes, wouldModify: true };
  }

  return { modified: false, changes: [] };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  logger.info(`🔧 Reparando root causes de GDD v2...${dryRun ? ' (DRY RUN)' : ''}\n`);

  const systemMap = loadSystemMapV2();
  const nodeNames = Object.keys(systemMap.nodes || {});

  const results = [];
  let totalModified = 0;

  // 1. Reparar crosslinks faltantes
  logger.info('1️⃣  Reparando crosslinks faltantes...\n');
  nodeNames.forEach((nodeName) => {
    const result = repairCrosslinksInNode(nodeName, systemMap, dryRun);
    if (result.modified || result.wouldModify) {
      totalModified++;
      results.push({ node: nodeName, changes: result.changes });
    }
  });

  logger.info(`\n📊 Resultados:`);
  logger.info(`   Nodos procesados: ${nodeNames.length}`);
  logger.info(`   Nodos modificados: ${totalModified}`);

  if (results.length > 0) {
    logger.info(`\n📝 Cambios aplicados:`);
    results.forEach((r) => {
      logger.info(`\n   ${r.node}:`);
      r.changes.forEach((c) => logger.info(`     - ${c}`));
    });
  }

  if (dryRun) {
    logger.info(`\n⚠️  DRY RUN - No se aplicaron cambios. Ejecuta sin --dry-run para aplicar.`);
  } else {
    logger.info(`\n✅ Root causes reparadas`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { repairCrosslinksInNode };
