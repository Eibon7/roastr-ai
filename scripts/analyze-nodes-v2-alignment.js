#!/usr/bin/env node

/**
 * Script para analizar la alineación entre system-map-v2.yaml y docs/nodes-v2
 * Identifica:
 * 1. Nodos en system-map sin archivo correspondiente en docs/nodes-v2
 * 2. Archivos en docs/nodes-v2 sin nodo correspondiente en system-map (huérfanos)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const rootDir = path.resolve(__dirname, '..');
const systemMapPath = path.join(rootDir, 'docs', 'system-map-v2.yaml');
const nodesV2Dir = path.join(rootDir, 'docs', 'nodes-v2');

// Leer system-map-v2.yaml
const systemMapContent = fs.readFileSync(systemMapPath, 'utf-8');
const systemMap = yaml.load(systemMapContent);

// Leer archivos en docs/nodes-v2
const nodeFiles = fs
  .readdirSync(nodesV2Dir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => file.replace('.md', ''));

// Extraer nodos del system-map y sus archivos docs esperados
const nodesInSystemMap = Object.keys(systemMap.nodes || {});
const docsByNode = {};

nodesInSystemMap.forEach((nodeId) => {
  const node = systemMap.nodes[nodeId];
  if (node.docs && node.docs.length > 0) {
    // Extraer el nombre del archivo sin la ruta completa
    const docFiles = node.docs.map((doc) => {
      const fileName = path.basename(doc);
      return fileName.replace('.md', '');
    });
    docsByNode[nodeId] = docFiles;
  } else {
    docsByNode[nodeId] = [];
  }
});

// Crear mapeo inverso: nombre de archivo -> nodos que lo esperan
const fileToNodes = {};
Object.entries(docsByNode).forEach(([nodeId, files]) => {
  files.forEach((file) => {
    if (!fileToNodes[file]) {
      fileToNodes[file] = [];
    }
    fileToNodes[file].push(nodeId);
  });
});

// 1. Encontrar nodos sin archivo correspondiente
const nodesWithoutFiles = [];
nodesInSystemMap.forEach((nodeId) => {
  const expectedFiles = docsByNode[nodeId] || [];
  if (expectedFiles.length === 0) {
    nodesWithoutFiles.push({
      node: nodeId,
      reason: 'No docs field in system-map'
    });
  } else {
    const missingFiles = expectedFiles.filter((file) => !nodeFiles.includes(file));
    if (missingFiles.length > 0) {
      nodesWithoutFiles.push({
        node: nodeId,
        expectedFiles: expectedFiles,
        missingFiles: missingFiles
      });
    }
  }
});

// 2. Encontrar archivos huérfanos (sin nodo correspondiente)
const orphanFiles = [];
nodeFiles.forEach((file) => {
  if (!fileToNodes[file] || fileToNodes[file].length === 0) {
    orphanFiles.push(file);
  }
});

// 3. Archivos con múltiples nodos (potencial problema)
const filesWithMultipleNodes = [];
Object.entries(fileToNodes).forEach(([file, nodes]) => {
  if (nodes.length > 1) {
    filesWithMultipleNodes.push({
      file,
      nodes
    });
  }
});

// Mostrar resultados
console.log('🔍 Análisis de Alineación: system-map-v2.yaml ↔ docs/nodes-v2\n');

console.log(`📊 Estadísticas:`);
console.log(`   - Nodos en system-map: ${nodesInSystemMap.length}`);
console.log(`   - Archivos en docs/nodes-v2: ${nodeFiles.length}`);
console.log(`   - Nodos sin archivos: ${nodesWithoutFiles.length}`);
console.log(`   - Archivos huérfanos: ${orphanFiles.length}`);
console.log(`   - Archivos con múltiples nodos: ${filesWithMultipleNodes.length}\n`);

if (nodesWithoutFiles.length > 0) {
  console.log('❌ NODOS SIN ARCHIVOS CORRESPONDIENTES:');
  nodesWithoutFiles.forEach(({ node, expectedFiles, missingFiles, reason }) => {
    console.log(`\n   ${node}:`);
    if (reason) {
      console.log(`      - ${reason}`);
    } else {
      console.log(`      - Archivos esperados: ${expectedFiles.join(', ')}`);
      console.log(`      - Archivos faltantes: ${missingFiles.join(', ')}`);
    }
    const nodeInfo = systemMap.nodes[node];
    if (nodeInfo) {
      console.log(`      - Descripción: ${nodeInfo.description || 'N/A'}`);
      console.log(`      - Estado: ${nodeInfo.status || 'N/A'}`);
    }
  });
  console.log('');
}

if (orphanFiles.length > 0) {
  console.log('🔴 ARCHIVOS HUÉRFANOS (sin nodo en system-map):');
  orphanFiles.forEach((file) => {
    const fullPath = path.join(nodesV2Dir, `${file}.md`);
    const stats = fs.statSync(fullPath);
    console.log(`\n   ${file}.md`);
    console.log(`      - Tamaño: ${stats.size} bytes`);
    console.log(`      - Modificado: ${stats.mtime.toISOString().split('T')[0]}`);
  });
  console.log('');
}

if (filesWithMultipleNodes.length > 0) {
  console.log('⚠️  ARCHIVOS CON MÚLTIPLES NODOS (revisar):');
  filesWithMultipleNodes.forEach(({ file, nodes }) => {
    console.log(`\n   ${file}.md:`);
    nodes.forEach((node) => console.log(`      - ${node}`));
  });
  console.log('');
}

if (
  nodesWithoutFiles.length === 0 &&
  orphanFiles.length === 0 &&
  filesWithMultipleNodes.length === 0
) {
  console.log(
    '✅ Perfecta alineación: Todos los nodos tienen archivos y todos los archivos tienen nodos.\n'
  );
}

// Exit codes
if (orphanFiles.length > 0 || nodesWithoutFiles.length > 0) {
  process.exit(1);
}
process.exit(0);
