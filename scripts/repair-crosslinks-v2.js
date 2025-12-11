#!/usr/bin/env node
/**
 * GDD v2 Crosslinks Repair Script
 *
 * Repara crosslinks en todos los nodos v2 para alcanzar 100% en crosslink score.
 * Añade secciones "Dependencies" y "Related Nodes" con links markdown correctos.
 *
 * Usage:
 *   node scripts/repair-crosslinks-v2.js
 *   node scripts/repair-crosslinks-v2.js --dry-run  # Solo muestra cambios sin aplicar
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

function repairNodeCrosslinks(nodeId, systemMap, dryRun = false) {
  const nodeData = systemMap.nodes[nodeId];
  if (!nodeData) {
    logger.warn(`Node ${nodeId} not found in system-map`);
    return { modified: false, changes: [] };
  }

  const docs = nodeData?.docs || [];
  if (docs.length === 0) {
    logger.warn(`Node ${nodeId} has no docs path`);
    return { modified: false, changes: [] };
  }

  const docPath = path.isAbsolute(docs[0]) ? docs[0] : path.join(ROOT_DIR, docs[0]);
  if (!fs.existsSync(docPath)) {
    logger.warn(`Node file not found: ${docPath}`);
    return { modified: false, changes: [] };
  }

  let content = fs.readFileSync(docPath, 'utf8');
  const originalContent = content;
  const changes = [];

  // Obtener dependencias del system-map
  const dependsOn = nodeData.depends_on || [];
  const requiredBy = nodeData.required_by || [];
  const allDependencies = [...new Set([...dependsOn, ...requiredBy])];

  // Crear sección Dependencies si no existe
  const dependenciesSection = `## 6. Dependencies

Este nodo depende de los siguientes nodos:

${
  dependsOn.length > 0
    ? dependsOn
        .map((dep) => {
          const fileName = getNodeFileName(dep, systemMap);
          if (fileName) {
            return `- [\`${dep}\`](./${fileName})`;
          }
          return `- \`${dep}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ninguna dependencia directa'
}

---

## 7. Related Nodes

Este nodo está relacionado con los siguientes nodos:

${
  requiredBy.length > 0
    ? requiredBy
        .map((req) => {
          const fileName = getNodeFileName(req, systemMap);
          if (fileName) {
            return `- [\`${req}\`](./${fileName})`;
          }
          return `- \`${req}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ningún nodo relacionado'
}

---`;

  // Buscar si ya existe sección Dependencies o Related Nodes (flexible en numeración)
  const hasDependenciesSection = /^##\s+\d+\.\s+.*?Dependencies/im.test(content);
  const hasRelatedSection = /^##\s+\d+\.\s+.*?Related\s+Nodes/im.test(content);

  // Buscar última sección numerada para determinar dónde insertar
  const allSections = content.match(/^##\s+(\d+)\.\s+[^\n]+/gm) || [];
  let lastSectionNum = 0;
  if (allSections.length > 0) {
    const lastSection = allSections[allSections.length - 1];
    const numMatch = lastSection.match(/^##\s+(\d+)\./);
    if (numMatch) {
      lastSectionNum = parseInt(numMatch[1], 10);
    }
  }

  if (!hasDependenciesSection || !hasRelatedSection) {
    // Determinar número de sección a usar
    const nextSectionNum = lastSectionNum + 1;
    const depsSectionNum = hasDependenciesSection ? null : nextSectionNum;
    const relatedSectionNum = hasRelatedSection
      ? null
      : hasDependenciesSection
        ? nextSectionNum
        : nextSectionNum + 1;

    // Crear secciones con numeración correcta
    let newSections = '';
    if (!hasDependenciesSection) {
      newSections += `## ${depsSectionNum}. Dependencies

Este nodo depende de los siguientes nodos:

${
  dependsOn.length > 0
    ? dependsOn
        .map((dep) => {
          const fileName = getNodeFileName(dep, systemMap);
          if (fileName) {
            return `- [\`${dep}\`](./${fileName})`;
          }
          return `- \`${dep}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ninguna dependencia directa'
}

---

`;
    }
    if (!hasRelatedSection) {
      newSections += `## ${relatedSectionNum}. Related Nodes

Este nodo está relacionado con los siguientes nodos:

${
  requiredBy.length > 0
    ? requiredBy
        .map((req) => {
          const fileName = getNodeFileName(req, systemMap);
          if (fileName) {
            return `- [\`${req}\`](./${fileName})`;
          }
          return `- \`${req}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ningún nodo relacionado'
}

---

`;
    }

    // Insertar al final del archivo
    content = content.trim() + '\n\n' + newSections;
    changes.push(`Añadidas secciones Dependencies y Related Nodes`);
  } else {
    // Ya existen, actualizar contenido (buscar con regex flexible)
    const depsSectionMatch = content.match(/^##\s+\d+\.\s+.*?Dependencies.*?(?=^##\s+\d+\.|$)/ms);
    const relatedSectionMatch = content.match(
      /^##\s+\d+\.\s+.*?Related\s+Nodes.*?(?=^##\s+\d+\.|$)/ms
    );

    if (depsSectionMatch) {
      const sectionNum = depsSectionMatch[0].match(/^##\s+(\d+)\./);
      const num = sectionNum ? sectionNum[1] : '6';
      const newDepsSection = `## ${num}. Dependencies

Este nodo depende de los siguientes nodos:

${
  dependsOn.length > 0
    ? dependsOn
        .map((dep) => {
          const fileName = getNodeFileName(dep, systemMap);
          if (fileName) {
            return `- [\`${dep}\`](./${fileName})`;
          }
          return `- \`${dep}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ninguna dependencia directa'
}

---`;
      content = content.replace(depsSectionMatch[0], newDepsSection);
      changes.push('Actualizada sección Dependencies');
    }

    if (relatedSectionMatch) {
      const sectionNum = relatedSectionMatch[0].match(/^##\s+(\d+)\./);
      const num = sectionNum ? sectionNum[1] : '7';
      const newRelatedSection = `## ${num}. Related Nodes

Este nodo está relacionado con los siguientes nodos:

${
  requiredBy.length > 0
    ? requiredBy
        .map((req) => {
          const fileName = getNodeFileName(req, systemMap);
          if (fileName) {
            return `- [\`${req}\`](./${fileName})`;
          }
          return `- \`${req}\` (TBD: archivo no encontrado)`;
        })
        .join('\n')
    : '- Ningún nodo relacionado'
}

---`;
      content = content.replace(relatedSectionMatch[0], newRelatedSection);
      changes.push('Actualizada sección Related Nodes');
    }
  }

  // Verificar que los crosslinks están presentes en el contenido
  const missingCrosslinks = [];
  allDependencies.forEach((dep) => {
    const fileName = getNodeFileName(dep, systemMap);
    if (fileName) {
      const linkPattern = new RegExp(
        `\\[.*?\\]\\(.*?${fileName.replace('.md', '')}.*?\\)|\\[.*?\\]\\(.*?${fileName}\\)`,
        'i'
      );
      if (!linkPattern.test(content) && !content.includes(`\`${dep}\``)) {
        missingCrosslinks.push(dep);
      }
    }
  });

  if (missingCrosslinks.length > 0 && changes.length === 0) {
    // Añadir referencias faltantes en texto
    const summarySection = content.match(/^##\s+1\.\s+Summary.*?(?=^##\s+\d+\.|$)/ms);
    if (summarySection) {
      const summaryText = summarySection[0];
      const newRefs = missingCrosslinks
        .map((dep) => {
          const fileName = getNodeFileName(dep, systemMap);
          if (fileName) {
            return `[\`${dep}\`](./${fileName})`;
          }
          return `\`${dep}\``;
        })
        .join(', ');

      if (!summaryText.includes(newRefs)) {
        const updatedSummary = summaryText.replace(/(\.)$/, ` (ver también: ${newRefs}).`);
        content = content.replace(summarySection[0], updatedSummary);
        changes.push(
          `Añadidas referencias a nodos faltantes en Summary: ${missingCrosslinks.join(', ')}`
        );
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

  logger.info(`🔧 Reparando crosslinks en nodos v2...${dryRun ? ' (DRY RUN)' : ''}\n`);

  const systemMap = loadSystemMapV2();
  const nodeNames = Object.keys(systemMap.nodes || {});

  const results = [];
  let totalModified = 0;

  nodeNames.forEach((nodeName) => {
    const result = repairNodeCrosslinks(nodeName, systemMap, dryRun);
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
    logger.info(`\n✅ Crosslinks reparados`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { repairNodeCrosslinks };
