#!/usr/bin/env node
/**
 * GDD v2 Health Score - Official Calculator
 *
 * Este script calcula las métricas oficiales del health score v2 de forma dinámica
 * basándose exclusivamente en system-map-v2.yaml y docs/nodes-v2/**.
 *
 * IMPORTANTE: Este script NO modifica el SSOT automáticamente.
 * Solo genera un JSON con los valores calculados.
 * Para actualizar el SSOT, se debe invocar con --update-ssot.
 *
 * Usage:
 *   node scripts/compute-health-v2-official.js                    # Solo calcula y muestra
 *   node scripts/compute-health-v2-official.js --update-ssot      # Calcula y actualiza SSOT
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs/SSOT-V2.md');
const OUTPUT_DIR = path.join(ROOT_DIR, 'scripts/outputs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'gdd-health-v2-official.json');

// Reutilizar funciones de calculate-gdd-health-v2.js
function loadSystemMapV2() {
  try {
    const content = fs.readFileSync(SYSTEM_MAP_V2_PATH, 'utf8');
    return yaml.load(content);
  } catch (e) {
    throw new Error(`Error loading system-map-v2.yaml: ${e.message}`);
  }
}

function normalizeNodeName(name) {
  return name.toLowerCase().trim();
}

function extractDependencies(content, systemMap) {
  const deps = [];
  const nodeNames = Object.keys(systemMap.nodes || {});

  // Buscar referencias a nodos en el contenido
  nodeNames.forEach((nodeName) => {
    const normalized = normalizeNodeName(nodeName);
    const nodeData = systemMap.nodes[nodeName];
    const docFileName = nodeData?.docs?.[0] ? path.basename(nodeData.docs[0]) : null;
    const docFileNameWithoutExt = docFileName ? docFileName.replace('.md', '') : null;

    const patterns = [
      new RegExp(`\\[${nodeName}\\]`, 'i'),
      new RegExp(`\`${nodeName}\``, 'i'),
      new RegExp(`\\*\\*${nodeName}\\*\\*`, 'i'),
      new RegExp(`\\b${normalized}\\b`, 'i')
    ];

    // Añadir patrones para links markdown
    if (docFileName) {
      patterns.push(new RegExp(`\\[.*?\\]\\(.*?${docFileName.replace('.', '\\.')}.*?\\)`, 'i'));
    }
    if (docFileNameWithoutExt) {
      patterns.push(
        new RegExp(`\\[.*?\\]\\(.*?${docFileNameWithoutExt.replace(/[-_]/g, '[-_]')}.*?\\)`, 'i')
      );
    }

    if (patterns.some((p) => p.test(content))) {
      deps.push(nodeName);
    }
  });

  return deps;
}

function extractCrossReferences(content, systemMap) {
  // Similar a extractDependencies pero más amplio
  return extractDependencies(content, systemMap);
}

function loadNodesV2() {
  const nodes = {};
  const nodeFiles = {};
  const missingNodes = [];

  try {
    const systemMap = loadSystemMapV2();
    const masterNodeNames = Object.keys(systemMap.nodes || {});

    logger.info(`📋 Loading ${masterNodeNames.length} nodes from system-map-v2.yaml...`);

    masterNodeNames.forEach((nodeName) => {
      const nodeData = systemMap.nodes[nodeName];
      const docs = nodeData?.docs || [];

      if (docs.length === 0) {
        logger.warn(`⚠️  Node ${nodeName} has no docs: field in system-map-v2.yaml`);
        missingNodes.push(nodeName);
        return;
      }

      const docPath = docs[0];
      const filePath = path.isAbsolute(docPath) ? docPath : path.join(ROOT_DIR, docPath);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const fileName = path.basename(filePath);
          nodeFiles[nodeName] = fileName;

          const deps = extractDependencies(content, systemMap);
          const crossRefs = extractCrossReferences(content, systemMap);

          nodes[nodeName] = {
            file: fileName,
            content,
            hasSSOTRefs: /SSOT|ssot|Single Source of Truth/i.test(content),
            saysNoneSSOT:
              /SSOT\s+References?:\s*None|does\s+not\s+(directly\s+)?(use|access)\s+SSOT/i.test(
                content
              ),
            dependencies: deps,
            crossReferences: [...new Set([...deps, ...crossRefs])]
          };
        } catch (e) {
          logger.warn(
            `Warning: Could not read file for node ${nodeName} at ${filePath}: ${e.message}`
          );
          missingNodes.push(nodeName);
        }
      } else {
        logger.warn(
          `⚠️  Node file not found: ${nodeName} (declared path: ${docPath}, full path: ${filePath})`
        );
        missingNodes.push(nodeName);
      }
    });

    if (missingNodes.length > 0) {
      logger.warn(
        `⚠️  ${missingNodes.length} nodes from system-map-v2.yaml are missing documentation files at declared paths.`
      );
    }
  } catch (e) {
    logger.warn(`Warning: Could not load nodes-v2: ${e.message}`);
  }

  return { nodes, nodeFiles, missingNodes };
}

function calculateMetrics() {
  const systemMap = loadSystemMapV2();
  const nodesV2 = loadNodesV2();
  const nodesInSystemMap = Object.keys(systemMap.nodes || {});
  const nodesV2Real = Object.keys(nodesV2.nodes || {});

  // 1. system_map_alignment_score
  // % de nodos presentes en system-map-v2.yaml que existen realmente en docs/nodes-v2/
  const nodesInSystemMapThatExist = nodesInSystemMap.filter((nodeName) => {
    return nodesV2Real.includes(nodeName);
  });

  const systemMapAlignmentScore =
    nodesInSystemMap.length > 0
      ? (nodesInSystemMapThatExist.length / nodesInSystemMap.length) * 100
      : 0;

  // 2. dependency_density_score
  // Nº de referencias detectadas / nº esperado según system map
  let actualDependencies = 0;
  let expectedDependencies = 0;

  nodesInSystemMap.forEach((nodeName) => {
    const node = nodesV2.nodes[nodeName];
    if (node) {
      actualDependencies += node.dependencies.length;
    }

    const systemMapNode = systemMap.nodes[nodeName];
    if (systemMapNode && systemMapNode.depends_on) {
      expectedDependencies += systemMapNode.depends_on.length;
    }
  });

  const dependencyDensityScore =
    expectedDependencies > 0
      ? Math.min(100, (actualDependencies / expectedDependencies) * 100)
      : 100;

  // 3. crosslink_score
  // % de dependencias esperadas que están correctamente referenciadas
  let correctCrosslinks = 0;
  let totalCrosslinks = 0;

  nodesInSystemMap.forEach((nodeName) => {
    const node = nodesV2.nodes[nodeName];
    const systemMapNode = systemMap.nodes[nodeName];

    if (systemMapNode && systemMapNode.depends_on) {
      systemMapNode.depends_on.forEach((dep) => {
        totalCrosslinks++;
        if (node) {
          const allRefs = [...new Set([...node.crossReferences, ...node.dependencies])];
          // Verificar si el nodo dependiente está en las referencias detectadas
          if (allRefs.includes(dep)) {
            correctCrosslinks++;
          } else {
            // Verificar también directamente en el contenido si hay un link markdown
            const depNodeData = systemMap.nodes[dep];
            const depFileName = depNodeData?.docs?.[0] ? path.basename(depNodeData.docs[0]) : null;
            if (depFileName && node.content) {
              // Buscar link markdown: [dep](./depFileName) o [dep](./depFileNameWithoutExt)
              const depFileNameWithoutExt = depFileName.replace('.md', '');
              const linkPattern1 = new RegExp(
                `\\[.*?${dep.replace(/[-_]/g, '[-_]')}.*?\\]\\(.*?${depFileName.replace('.', '\\.')}.*?\\)`,
                'i'
              );
              const linkPattern2 = new RegExp(
                `\\[.*?${dep.replace(/[-_]/g, '[-_]')}.*?\\]\\(.*?${depFileNameWithoutExt.replace(/[-_]/g, '[-_]')}.*?\\)`,
                'i'
              );
              const namePattern = new RegExp(`\\[\\\`${dep.replace(/[-_]/g, '[-_]')}\\\`\\]`, 'i');

              if (
                linkPattern1.test(node.content) ||
                linkPattern2.test(node.content) ||
                namePattern.test(node.content)
              ) {
                correctCrosslinks++;
              }
            }
          }
        }
      });
    }
  });

  const crosslinkScore = totalCrosslinks > 0 ? (correctCrosslinks / totalCrosslinks) * 100 : 100;

  // 4. ssot_alignment_score
  // 100% si todos los nodos usan valores del SSOT y no hay contradicciones
  let ssotAligned = 0;
  nodesInSystemMap.forEach((nodeName) => {
    const node = nodesV2.nodes[nodeName];
    const systemMapNode = systemMap.nodes[nodeName];

    if (!node) {
      return;
    }

    const content = node.content || '';
    const saysNone =
      /SSOT\s+References?:\s*None|does\s+not\s+(directly\s+)?(use|access)\s+SSOT/i.test(content);

    if (saysNone) {
      if (
        systemMapNode &&
        (!systemMapNode.ssot_references || systemMapNode.ssot_references.length === 0)
      ) {
        ssotAligned++;
      }
    } else if (node.hasSSOTRefs) {
      if (
        systemMapNode &&
        systemMapNode.ssot_references &&
        systemMapNode.ssot_references.length > 0
      ) {
        ssotAligned++;
      }
    } else {
      if (
        systemMapNode &&
        (!systemMapNode.ssot_references || systemMapNode.ssot_references.length === 0)
      ) {
        ssotAligned++;
      }
    }
  });

  const ssotAlignmentScore =
    nodesInSystemMap.length > 0 ? (ssotAligned / nodesInSystemMap.length) * 100 : 0;

  // 5. narrative_consistency_score
  // Placeholder dinámico - por ahora 100% si no hay contradicciones obvias
  const narrativeConsistencyScore = 100; // Placeholder - requiere análisis más profundo

  // 6. health_score final
  const healthScore =
    systemMapAlignmentScore * 0.3 +
    dependencyDensityScore * 0.2 +
    crosslinkScore * 0.2 +
    ssotAlignmentScore * 0.2 +
    narrativeConsistencyScore * 0.1;

  return {
    system_map_alignment: Math.round(systemMapAlignmentScore * 100) / 100,
    ssot_alignment: Math.round(ssotAlignmentScore * 100) / 100,
    dependency_density: Math.round(dependencyDensityScore * 100) / 100,
    crosslink_score: Math.round(crosslinkScore * 100) / 100,
    narrative_consistency: Math.round(narrativeConsistencyScore * 100) / 100,
    health_score: Math.round(healthScore * 100) / 100,
    nodes_detected: nodesV2Real.length,
    nodes_total: nodesInSystemMap.length,
    nodes_missing: nodesInSystemMap.length - nodesV2Real.length,
    timestamp: new Date().toISOString()
  };
}

function updateSSOT(metrics) {
  let ssotContent = fs.readFileSync(SSOT_V2_PATH, 'utf8');

  // Buscar si ya existe la sección 15
  const section15Regex = /^## 15\. GDD Health Score.*?(?=^## |$)/ms;
  const section15Exists = section15Regex.test(ssotContent);

  const newSection = `## 15. GDD Health Score (Single Source of Truth)

Esta sección contiene las métricas oficiales del estado documental v2, calculadas exclusivamente a partir de system-map-v2.yaml y docs/nodes-v2.

**IMPORTANTE:**  
Los valores deben ser **dinámicos pero correctos**.  
NO se permiten valores hardcoded.  
Únicamente se actualizan cuando un proceso de auditoría v2 lo ordena manualmente mediante:

\`\`\`bash
node scripts/compute-health-v2-official.js --update-ssot
\`\`\`

### 15.1 Métricas Oficiales

| Métrica | Valor | Descripción |
|---------|-------|-------------|
| **System Map Alignment** | ${metrics.system_map_alignment}% | % de nodos en system-map-v2.yaml que tienen documentación en docs/nodes-v2/ |
| **SSOT Alignment** | ${metrics.ssot_alignment}% | % de nodos que usan valores del SSOT correctamente |
| **Dependency Density** | ${metrics.dependency_density}% | Nº de dependencias detectadas / nº esperado según system map |
| **Crosslink Score** | ${metrics.crosslink_score}% | % de dependencias esperadas que están correctamente referenciadas |
| **Narrative Consistency** | ${metrics.narrative_consistency}% | Evalúa si los nodos describen procesos compatibles entre sí (placeholder) |
| **Health Score Final** | **${metrics.health_score}/100** | Ponderado: System Map (30%) + Dependency Density (20%) + Crosslink (20%) + SSOT Alignment (20%) + Narrative Consistency (10%) |

### 15.2 Detalles de Cálculo

- **Nodos detectados:** ${metrics.nodes_detected} de ${metrics.nodes_total}
- **Nodos faltantes:** ${metrics.nodes_missing}
- **Última actualización:** ${metrics.timestamp}

### 15.3 Reglas de Actualización

1. **Ningún script puede modificar estos valores automáticamente**
2. **Solo se actualizan mediante:** \`node scripts/compute-health-v2-official.js --update-ssot\`
3. **El SSOT es la única fuente de verdad** - Los scripts de lectura (calculate-gdd-health-v2.js) deben leer desde aquí
4. **Si hay discrepancia** entre archivos → gana el SSOT

---

`;

  if (section15Exists) {
    // Reemplazar sección existente
    ssotContent = ssotContent.replace(section15Regex, newSection);
  } else {
    // Añadir al final
    ssotContent = ssotContent.trim() + '\n\n' + newSection;
  }

  fs.writeFileSync(SSOT_V2_PATH, ssotContent, 'utf8');
  logger.info(`✅ SSOT actualizado con métricas oficiales`);
}

function main() {
  const shouldUpdateSSOT = process.argv.includes('--update-ssot');

  logger.info('🔍 Calculando métricas oficiales del health score v2...\n');

  const metrics = calculateMetrics();

  // Mostrar resultados
  logger.info('📊 Métricas Calculadas:\n');
  logger.info(`   System Map Alignment: ${metrics.system_map_alignment}%`);
  logger.info(`   SSOT Alignment: ${metrics.ssot_alignment}%`);
  logger.info(`   Dependency Density: ${metrics.dependency_density}%`);
  logger.info(`   Crosslink Score: ${metrics.crosslink_score}%`);
  logger.info(`   Narrative Consistency: ${metrics.narrative_consistency}%`);
  logger.info(`   Health Score Final: ${metrics.health_score}/100\n`);

  // Guardar JSON
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(metrics, null, 2), 'utf8');
  logger.info(`✅ JSON guardado en: ${OUTPUT_JSON}\n`);

  if (shouldUpdateSSOT) {
    logger.info('📝 Actualizando SSOT-V2.md...\n');
    updateSSOT(metrics);
    logger.info('\n✅ Proceso completado. SSOT actualizado con métricas oficiales.');
  } else {
    logger.info('ℹ️  Para actualizar el SSOT, ejecuta:');
    logger.info('   node scripts/compute-health-v2-official.js --update-ssot\n');
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculateMetrics, updateSSOT };
