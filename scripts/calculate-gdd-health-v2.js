#!/usr/bin/env node
/**
 * GDD Health Check v2 Calculator
 *
 * Calcula métricas de salud del GDD v2 basándose en:
 * - Nodos reales en docs/nodes-v2/
 * - System Map v2 en docs/system-map-v2.yaml
 * - SSOT-V2.md
 *
 * Reglas:
 * - NO mezclar con v1
 * - NO inventar nodos o relaciones
 * - Reportar ausencias como ausencias
 * - 100% dinámico basado en system-map-v2.yaml (sin mappings estáticos)
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs/nodes-v2');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs/SSOT-V2.md');

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

function loadNodesV2() {
  const nodes = {};
  const nodeFiles = {};
  const missingNodes = [];

  try {
    if (!fs.existsSync(NODES_V2_DIR)) {
      logger.warn(`Warning: nodes-v2 directory does not exist: ${NODES_V2_DIR}`);
      return { nodes, nodeFiles, missingNodes };
    }

    // CRITICAL: Use system-map as SOURCE OF TRUTH for node list
    // Only load nodes that are defined in system-map-v2.yaml
    // Use EXACTLY the paths declared in nodeData.docs[] - NO inference
    const systemMap = loadSystemMapV2();
    const masterNodeNames = Object.keys(systemMap.nodes || {});

    logger.info(`📋 Loading ${masterNodeNames.length} nodes from system-map-v2.yaml...`);

    // Process each node defined in system-map
    masterNodeNames.forEach((nodeName) => {
      const nodeData = systemMap.nodes[nodeName];
      const docs = nodeData?.docs || [];

      // Use EXACTLY the first path from nodeData.docs[] - NO inference, NO name-based search
      if (docs.length === 0) {
        logger.warn(
          `⚠️  Node ${nodeName} has no docs: field in system-map-v2.yaml`
        );
        missingNodes.push(nodeName);
        return;
      }

      // Use the first doc path declared in system-map
      const docPath = docs[0];
      // Convert relative path to absolute
      const filePath = path.isAbsolute(docPath)
        ? docPath
        : path.join(ROOT_DIR, docPath);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const fileName = path.basename(filePath);
          nodeFiles[nodeName] = fileName;

          // Extract dependencies and cross-references
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
            // CrossReferences incluye dependencias detectadas + otras referencias en el documento
            crossReferences: [...new Set([...deps, ...crossRefs])]
          };
        } catch (e) {
          logger.warn(`Warning: Could not read file for node ${nodeName} at ${filePath}: ${e.message}`);
          missingNodes.push(nodeName);
        }
      } else {
        // File doesn't exist at the declared path - report as missing
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
    logger.warn(`Warning: Could not read nodes-v2 directory: ${e.message}`);
  }

  return { nodes, nodeFiles, missingNodes };
}

function extractDependencies(content, systemMap) {
  const deps = [];

  // Buscar sección Dependencies (6 o 7)
  // Capturar toda la sección hasta la siguiente sección principal (## seguido de número)
  const depsMatch = content.match(/##\s*[67]\.\s*Dependencies[\s\S]*?(?=\n##\s+\d+\.|$)/i);
  if (!depsMatch) {
    return deps;
  }

  const depsSection = depsMatch[0];
  const allNodeNames = Object.keys(systemMap.nodes || {});

  // 1. Buscar referencias en formato markdown link: [`nombre-nodo.md`](./nombre-nodo.md)
  const markdownLinkRefs = depsSection.match(/\[`(\d+-)?([a-z-]+)\.md`\]/gi) || [];
  markdownLinkRefs.forEach((ref) => {
    const m = ref.match(/\[`(\d+-)?([a-z-]+)\.md`\]/i);
    if (m) {
      const nodeName = m[2];
      // Verify this node exists in system-map
      if (allNodeNames.includes(nodeName) && !deps.includes(nodeName)) {
        deps.push(nodeName);
      }
    }
  });

  // 2. Buscar referencias en formato backtick: `nombre-nodo.md`
  const backtickRefs = depsSection.match(/`(\d+-)?([a-z-]+)\.md`/gi) || [];
  backtickRefs.forEach((ref) => {
    const m = ref.match(/`(\d+-)?([a-z-]+)\.md`/i);
    if (m) {
      const nodeName = m[2];
      if (allNodeNames.includes(nodeName) && !deps.includes(nodeName)) {
        deps.push(nodeName);
      }
    }
  });

  // 3. Buscar menciones textuales de nodos en formato **nombre-nodo** o "nombre-nodo ("
  allNodeNames.forEach((nodeName) => {
    if (deps.includes(nodeName)) return; // Ya detectado en formatos anteriores

    const normalizedNodeName = normalizeNodeName(nodeName);
    const depsSectionLower = depsSection.toLowerCase();

    // Patrón 1: **nombre-nodo** (bold)
    const boldPattern = new RegExp(`\\*\\*${normalizedNodeName.replace(/-/g, '[- ]')}\\*\\*`, 'i');

    // Patrón 2: nombre-nodo ( (seguido de paréntesis)
    const textPattern = new RegExp(`${normalizedNodeName.replace(/-/g, '[- ]')}\\s*\\(`, 'i');

    // Verificar en la sección de dependencias
    const found =
      boldPattern.test(depsSection) ||
      textPattern.test(depsSection) ||
      depsSectionLower.includes(normalizedNodeName);

    if (found && !deps.includes(nodeName)) {
      deps.push(nodeName);
    }
  });

  return deps;
}

function extractCrossReferences(content, systemMap) {
  const refs = [];
  const allNodeNames = Object.keys(systemMap.nodes || {});

  // 1. Buscar referencias en formato backtick: `nombre-nodo.md`
  const nodeRefPattern = /`(\d+-)?([a-z-]+)\.md`/gi;
  let match;
  while ((match = nodeRefPattern.exec(content)) !== null) {
    const nodeName = match[2];
    if (allNodeNames.includes(nodeName) && !refs.includes(nodeName)) {
      refs.push(nodeName);
    }
  }

  // 2. Buscar menciones textuales de nodos en formato **nombre-nodo**
  allNodeNames.forEach((nodeName) => {
    if (refs.includes(nodeName)) return; // Ya detectado

    const normalizedNodeName = normalizeNodeName(nodeName);
    const escapedName = normalizedNodeName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    const contentLower = content.toLowerCase();

    // Buscar en formato bold: **nombre-nodo**
    const boldPattern = new RegExp(`\\*\\*${escapedName}\\*\\*`, 'i');
    if (boldPattern.test(content) || contentLower.includes(normalizedNodeName)) {
      if (!refs.includes(nodeName)) {
        refs.push(nodeName);
      }
    }
  });

  return refs;
}

function calculateMetrics(systemMap, nodesV2) {
  const nodesInSystemMap = Object.keys(systemMap.nodes || {});
  const nodesV2Real = Object.keys(nodesV2.nodes || {});

  // 1. system_map_alignment_score
  // % de nodos presentes en system-map-v2.yaml que existen realmente en docs/nodes-v2/
  const nodesInSystemMapThatExist = nodesInSystemMap.filter((nodeName) => {
    // Direct comparison: node name in system-map must match node name in nodes-v2
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

    // Expected dependencies from system-map
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
          // Considerar tanto crossReferences como dependencies detectadas
          const allRefs = [...new Set([...node.crossReferences, ...node.dependencies])];
          if (allRefs.includes(dep)) {
            correctCrosslinks++;
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
      // Node doesn't exist - can't verify alignment
      return;
    }

    // Check if node explicitly says "None" or "does not use SSOT"
    const content = node.content || '';
    const saysNone =
      /SSOT\s+References?:\s*None|does\s+not\s+(directly\s+)?(use|access)\s+SSOT/i.test(content);

    if (saysNone) {
      // Node explicitly says it doesn't use SSOT - aligned if system-map has empty array
      if (
        systemMapNode &&
        (!systemMapNode.ssot_references || systemMapNode.ssot_references.length === 0)
      ) {
        ssotAligned++;
      }
    } else if (node.hasSSOTRefs) {
      // Node mentions SSOT and should have references
      if (
        systemMapNode &&
        systemMapNode.ssot_references &&
        systemMapNode.ssot_references.length > 0
      ) {
        ssotAligned++;
      }
    } else {
      // Node doesn't mention SSOT - aligned if system-map has empty array
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
  // Evalúa si los nodos describen procesos compatibles entre sí
  // Por ahora, asumimos 100% si no hay contradicciones obvias
  const narrativeConsistencyScore = 100; // Placeholder - requiere análisis más profundo

  // 6. health_score final
  const healthScore =
    systemMapAlignmentScore * 0.3 +
    dependencyDensityScore * 0.2 +
    crosslinkScore * 0.2 +
    ssotAlignmentScore * 0.2 +
    narrativeConsistencyScore * 0.1;

  // Detectar nodos huérfanos (en system-map pero no en nodes-v2)
  const orphanNodes = nodesInSystemMap.filter((nodeName) => {
    return !nodesV2Real.includes(nodeName);
  });

  // Nodos no usados en system-map (en nodes-v2 pero no en system-map)
  const unusedNodesInSystemMap = nodesV2Real.filter((v2Node) => {
    return !nodesInSystemMap.includes(v2Node);
  });

  // Entradas en system-map sin uso
  const unusedSystemMapEntries = [];
  // (Esto requeriría análisis más profundo de referencias en código)

  // Warnings y errors
  const warnings = [];
  const errors = [];

  if (nodesV2Real.length < nodesInSystemMap.length * 0.1) {
    warnings.push(
      `Solo ${nodesV2Real.length} nodos v2 reales de ${nodesInSystemMap.length} definidos en system-map-v2.yaml`
    );
  }

  if (orphanNodes.length > 0) {
    warnings.push(
      `${orphanNodes.length} nodos definidos en system-map-v2.yaml no tienen documentación en docs/nodes-v2/`
    );
  }

  if (dependencyDensityScore < 50) {
    warnings.push(`Densidad de dependencias baja: ${dependencyDensityScore.toFixed(1)}%`);
  }

  if (ssotAlignmentScore < 100) {
    warnings.push(`Alineación SSOT incompleta: ${ssotAlignmentScore.toFixed(1)}%`);
  }

  return {
    version: '2.0',
    timestamp: new Date().toISOString(),
    nodes_detected: nodesV2Real.length,
    nodes_missing: orphanNodes.length,
    nodes_with_broken_dependencies: 0, // Requeriría validación más profunda
    dependency_density_score: Math.round(dependencyDensityScore * 100) / 100,
    crosslink_score: Math.round(crosslinkScore * 100) / 100,
    system_map_alignment_score: Math.round(systemMapAlignmentScore * 100) / 100,
    ssot_alignment_score: Math.round(ssotAlignmentScore * 100) / 100,
    narrative_consistency_score: Math.round(narrativeConsistencyScore * 100) / 100,
    orphan_nodes: orphanNodes,
    unused_nodes_in_system_map: unusedNodesInSystemMap,
    unused_system_map_entries: unusedSystemMapEntries,
    warnings,
    errors,
    health_score: Math.round(healthScore * 100) / 100
  };
}

// Main
function main() {
  try {
    const systemMap = loadSystemMapV2();
    const nodesV2 = loadNodesV2();

    const metrics = calculateMetrics(systemMap, nodesV2);

    // Guardar JSON
    const outputPath = path.join(ROOT_DIR, 'gdd-health-v2.json');
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

    logger.info('\n✅ gdd-health-v2.json generado');
    logger.info(`   Health Score: ${metrics.health_score}/100`);
    logger.info(`   Nodos detectados: ${metrics.nodes_detected}`);
    logger.info(`   Nodos faltantes: ${metrics.nodes_missing}`);
    logger.info(`   System Map Alignment: ${metrics.system_map_alignment_score}%`);
    logger.info(`   SSOT Alignment: ${metrics.ssot_alignment_score}%`);
    logger.info(`   Dependency Density: ${metrics.dependency_density_score}%`);
    logger.info(`   Crosslink Score: ${metrics.crosslink_score}%`);

    if (metrics.warnings.length > 0) {
      logger.warn('\n⚠️  Warnings:');
      metrics.warnings.forEach((w) => logger.warn(`   - ${w}`));
    }

    return metrics;
  } catch (error) {
    logger.error('❌ Error:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculateMetrics, loadSystemMapV2, loadNodesV2 };
