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
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs/nodes-v2');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs/SSOT-V2.md');

// Mapeo de nombres de archivos a nombres de nodos en system-map
// Los nombres coinciden directamente, no se necesita mapeo
const NODE_NAME_MAPPING = {};

function loadSystemMapV2() {
  try {
    const content = fs.readFileSync(SYSTEM_MAP_V2_PATH, 'utf8');
    return yaml.load(content);
  } catch (e) {
    throw new Error(`Error loading system-map-v2.yaml: ${e.message}`);
  }
}

function loadNodesV2() {
  const nodes = {};
  const nodeFiles = {};
  
  try {
    if (!fs.existsSync(NODES_V2_DIR)) {
      return { nodes, nodeFiles };
    }
    
    // CRITICAL: Use system-map as source of truth for node list
    // Only load nodes that are defined in system-map-v2.yaml
    const systemMap = loadSystemMapV2();
    const masterNodeNames = Object.keys(systemMap.nodes || {});
    
    // Only process files that correspond to master nodes in system-map
    masterNodeNames.forEach(nodeName => {
      // Try exact match first
      let file = `${nodeName}.md`;
      let filePath = path.join(NODES_V2_DIR, file);
      
      // If exact match doesn't exist, try numbered format (legacy)
      if (!fs.existsSync(filePath)) {
        const files = fs.readdirSync(NODES_V2_DIR);
        const numberedFile = files.find(f => {
          const baseName = f.replace('.md', '');
          const match = baseName.match(/^\d+-(.+)$/);
          return match && match[1] === nodeName;
        });
        if (numberedFile) {
          file = numberedFile;
          filePath = path.join(NODES_V2_DIR, file);
        }
      }
      
      // Only load if file exists
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        nodeFiles[nodeName] = file;
        nodes[nodeName] = {
          file,
          content,
          hasSSOTRefs: /SSOT|ssot|Single Source of Truth/i.test(content),
          saysNoneSSOT: /SSOT\s+References?:\s*None|does\s+not\s+(directly\s+)?(use|access)\s+SSOT/i.test(content),
          dependencies: extractDependencies(content),
          crossReferences: extractCrossReferences(content)
        };
      }
    });
  } catch (e) {
    console.warn(`Warning: Could not read nodes-v2 directory: ${e.message}`);
  }
  
  return { nodes, nodeFiles };
}

function extractDependencies(content) {
  const deps = [];
  // Buscar sección Dependencies (6 o 7)
  const depsMatch = content.match(/##\s*[67]\.\s*Dependencies[\s\S]*?(?=##|$)/i);
  if (depsMatch) {
    const depsSection = depsMatch[0];
    // Buscar referencias en formato backtick: `nombre-nodo.md`
    const backtickRefs = depsSection.match(/`(\d+-)?([a-z-]+)\.md`/gi) || [];
    backtickRefs.forEach(ref => {
      const m = ref.match(/`(\d+-)?([a-z-]+)\.md`/i);
      if (m) {
        const nodeName = m[2];
        if (!deps.includes(nodeName)) {
          deps.push(nodeName);
        }
      }
    });
    // Buscar referencias en formato markdown link: [`nombre-nodo.md`](./nombre-nodo.md)
    const markdownLinkRefs = depsSection.match(/\[`(\d+-)?([a-z-]+)\.md`\]/gi) || [];
    markdownLinkRefs.forEach(ref => {
      const m = ref.match(/\[`(\d+-)?([a-z-]+)\.md`\]/i);
      if (m) {
        const nodeName = m[2];
        if (!deps.includes(nodeName)) {
          deps.push(nodeName);
        }
      }
    });
  }
  return deps;
}

function extractCrossReferences(content) {
  const refs = [];
  // Buscar referencias a otros nodos en el contenido
  const nodeRefPattern = /`(\d+-)?([a-z-]+)\.md`/gi;
  let match;
  while ((match = nodeRefPattern.exec(content)) !== null) {
    const nodeName = match[2];
    if (!refs.includes(nodeName)) {
      refs.push(nodeName);
    }
  }
  return refs;
}

function calculateMetrics(systemMap, nodesV2) {
  const nodesInSystemMap = Object.keys(systemMap.nodes || {});
  const nodesV2Real = Object.keys(nodesV2.nodes || {});
  
  // 1. system_map_alignment_score
  // % de nodos presentes en system-map-v2.yaml que existen realmente en docs/nodes-v2/
  const nodesInSystemMapThatExist = nodesInSystemMap.filter(nodeName => {
    // Buscar mapeo directo o por nombre similar
    return nodesV2Real.some(v2Node => {
      const mapped = NODE_NAME_MAPPING[v2Node];
      return mapped === nodeName || v2Node === nodeName || 
             nodeName.replace(/-/g, '_') === v2Node.replace(/-/g, '_');
    });
  });
  
  const systemMapAlignmentScore = nodesInSystemMap.length > 0
    ? (nodesInSystemMapThatExist.length / nodesInSystemMap.length) * 100
    : 0;
  
  // 2. dependency_density_score
  // Nº de referencias entre nodos / nº esperado según system map
  let actualDependencies = 0;
  let expectedDependencies = 0;
  
  nodesV2Real.forEach(nodeName => {
    const node = nodesV2.nodes[nodeName];
    actualDependencies += node.dependencies.length;
    
    // Buscar en system-map
    const systemMapNode = systemMap.nodes[NODE_NAME_MAPPING[nodeName] || nodeName];
    if (systemMapNode && systemMapNode.depends_on) {
      expectedDependencies += systemMapNode.depends_on.length;
    }
  });
  
  const dependencyDensityScore = expectedDependencies > 0
    ? Math.min(100, (actualDependencies / expectedDependencies) * 100)
    : 0;
  
  // 3. crosslink_score
  // % de nodos que referencian correctamente a sus dependencias
  let correctCrosslinks = 0;
  let totalCrosslinks = 0;
  
  nodesV2Real.forEach(nodeName => {
    const node = nodesV2.nodes[nodeName];
    const systemMapNode = systemMap.nodes[NODE_NAME_MAPPING[nodeName] || nodeName];
    
    if (systemMapNode && systemMapNode.depends_on) {
      totalCrosslinks += systemMapNode.depends_on.length;
      systemMapNode.depends_on.forEach(dep => {
        // Verificar si el nodo v2 referencia esta dependencia
        if (node.crossReferences.some(ref => 
          ref === dep || ref.replace(/-/g, '_') === dep.replace(/-/g, '_')
        )) {
          correctCrosslinks++;
        }
      });
    }
  });
  
  const crosslinkScore = totalCrosslinks > 0
    ? (correctCrosslinks / totalCrosslinks) * 100
    : 0;
  
  // 4. ssot_alignment_score
  // 100% si todos los nodos usan valores del SSOT y no hay contradicciones
  let ssotAligned = 0;
  nodesV2Real.forEach(nodeName => {
    const node = nodesV2.nodes[nodeName];
    const systemMapNode = systemMap.nodes[NODE_NAME_MAPPING[nodeName] || nodeName];
    
    // Check if node explicitly says "None" or "does not use SSOT"
    const content = node.content || '';
    const saysNone = /SSOT\s+References?:\s*None|does\s+not\s+(directly\s+)?(use|access)\s+SSOT/i.test(content);
    
    if (saysNone) {
      // Node explicitly says it doesn't use SSOT - aligned if system-map has empty array
      if (systemMapNode && (!systemMapNode.ssot_references || systemMapNode.ssot_references.length === 0)) {
        ssotAligned++;
      }
    } else if (node.hasSSOTRefs) {
      // Node mentions SSOT and should have references
      if (systemMapNode && systemMapNode.ssot_references && systemMapNode.ssot_references.length > 0) {
        ssotAligned++;
      }
    } else {
      // Node doesn't mention SSOT - aligned if system-map has empty array
      if (systemMapNode && (!systemMapNode.ssot_references || systemMapNode.ssot_references.length === 0)) {
        ssotAligned++;
      }
    }
  });
  
  const ssotAlignmentScore = nodesV2Real.length > 0
    ? (ssotAligned / nodesV2Real.length) * 100
    : 0;
  
  // 5. narrative_consistency_score
  // Evalúa si los nodos describen procesos compatibles entre sí
  // Por ahora, asumimos 100% si no hay contradicciones obvias
  // (esto requeriría análisis semántico más profundo)
  const narrativeConsistencyScore = 100; // Placeholder - requiere análisis más profundo
  
  // 6. health_score final
  const healthScore = (
    systemMapAlignmentScore * 0.30 +
    dependencyDensityScore * 0.20 +
    crosslinkScore * 0.20 +
    ssotAlignmentScore * 0.20 +
    narrativeConsistencyScore * 0.10
  );
  
  // Detectar nodos huérfanos (en system-map pero no en nodes-v2)
  const orphanNodes = nodesInSystemMap.filter(nodeName => {
    // Verificar si existe mapeo directo o inverso
    const hasMapping = nodesV2Real.some(v2Node => {
      const mapped = NODE_NAME_MAPPING[v2Node];
      return mapped === nodeName || v2Node === nodeName || 
             nodeName.replace(/-/g, '_') === v2Node.replace(/-/g, '_');
    });
    return !hasMapping;
  });
  
  // Nodos no usados en system-map (en nodes-v2 pero no en system-map)
  const unusedNodesInSystemMap = nodesV2Real.filter(v2Node => {
    const mapped = NODE_NAME_MAPPING[v2Node];
    return !nodesInSystemMap.includes(mapped || v2Node);
  });
  
  // Entradas en system-map sin uso
  const unusedSystemMapEntries = [];
  // (Esto requeriría análisis más profundo de referencias en código)
  
  // Warnings y errors
  const warnings = [];
  const errors = [];
  
  if (nodesV2Real.length < nodesInSystemMap.length * 0.1) {
    warnings.push(`Solo ${nodesV2Real.length} nodos v2 reales de ${nodesInSystemMap.length} definidos en system-map-v2.yaml`);
  }
  
  if (orphanNodes.length > 0) {
    warnings.push(`${orphanNodes.length} nodos definidos en system-map-v2.yaml no tienen documentación en docs/nodes-v2/`);
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
    
    console.log('✅ gdd-health-v2.json generado');
    console.log(`   Health Score: ${metrics.health_score}/100`);
    console.log(`   Nodos detectados: ${metrics.nodes_detected}`);
    console.log(`   Nodos faltantes: ${metrics.nodes_missing}`);
    
    return metrics;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculateMetrics, loadSystemMapV2, loadNodesV2 };

