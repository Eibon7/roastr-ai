#!/usr/bin/env node
/**
 * Auto GDD Activation Script
 *
 * Detecta automáticamente cuándo activar GDD basándose en:
 * - Issue labels
 * - Archivos modificados
 * - Título de issue
 * - Keywords en código
 *
 * Uso:
 *   node scripts/cursor-agents/auto-gdd-activation.js [issue-number]
 *   node scripts/cursor-agents/auto-gdd-activation.js --from-branch
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GDD_ACTIVATION_GUIDE = path.join(__dirname, '../../docs/GDD-ACTIVATION-GUIDE.md');

// Mapeo labels → nodos (desde GDD-ACTIVATION-GUIDE.md)
const LABEL_TO_NODES = {
  'area:shield': ['shield-engine', 'infraestructura'],
  'area:billing': ['billing-integration'],
  'area:platforms': ['integraciones-redes-sociales'],
  'area:workers': ['workers', 'infraestructura'],
  'area:ui': ['frontend-user-app', 'frontend-admin'],
  'area:demo': ['roasting-engine', 'shield-engine', 'workers'],
  'area:multitenant': ['infraestructura'],
  'area:publisher': ['workers', 'integraciones-redes-sociales'],
  'area:observability': ['ALL'], // Todos los nodos
  'area:reliability': ['workers', 'shield-engine', 'infraestructura'],
  'test:e2e': ['ALL'], // Todos los nodos
  'test:integration': null, // Depende de otros labels
  'test:unit': null // Se infiere del título
};

// Keywords → nodos (fallback)
const KEYWORD_TO_NODES = {
  shield: 'shield-engine',
  moderación: 'shield-engine',
  ofensor: 'shield-engine',
  billing: 'billing-integration',
  stripe: 'billing-integration',
  plan: 'billing-integration',
  entitlements: 'billing-integration',
  worker: 'workers',
  queue: 'workers',
  redis: 'infraestructura',
  job: 'workers',
  roast: 'roasting-engine',
  generación: 'roasting-engine',
  prompt: 'roasting-engine',
  variante: 'roasting-engine',
  'multi-tenant': 'infraestructura',
  rls: 'infraestructura',
  organization: 'infraestructura',
  platform: 'integraciones-redes-sociales',
  twitter: 'integraciones-redes-sociales',
  discord: 'integraciones-redes-sociales',
  integration: 'integraciones-redes-sociales',
  persona: 'analysis-engine',
  tone: 'roasting-engine',
  style: 'roasting-engine',
  humor: 'roasting-engine',
  'demo mode': 'roasting-engine',
  fixtures: 'roasting-engine',
  seeds: 'roasting-engine',
  publisher: 'workers',
  publicación: 'workers',
  post: 'workers'
};

// Obtener issue desde rama o número
function getIssueInfo(issueNum = null) {
  if (issueNum) {
    try {
      const output = execSync(`gh issue view ${issueNum} --json labels,title,body`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    } catch (e) {
      console.error(`❌ No se pudo obtener issue #${issueNum}`);
      return null;
    }
  }

  // Intentar desde rama
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const match = branch.match(/issue[_-]?(\d+)/i);
    if (match) {
      const num = match[1];
      const output = execSync(`gh issue view ${num} --json labels,title,body`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    }
  } catch (e) {
    // No hay issue asociado
  }

  return null;
}

// Detectar nodos desde labels
function detectNodesFromLabels(labels) {
  const nodes = new Set();

  for (const label of labels) {
    const mapped = LABEL_TO_NODES[label.name || label];
    if (mapped === 'ALL') {
      return 'ALL'; // Cargar todos los nodos
    } else if (mapped) {
      mapped.forEach((n) => nodes.add(n));
    }
  }

  return Array.from(nodes);
}

// Detectar nodos desde keywords en título/body
function detectNodesFromKeywords(text) {
  const nodes = new Set();
  const lowerText = text.toLowerCase();

  for (const [keyword, node] of Object.entries(KEYWORD_TO_NODES)) {
    if (lowerText.includes(keyword.toLowerCase())) {
      nodes.add(node);
    }
  }

  return Array.from(nodes);
}

// Detectar nodos desde archivos modificados
function detectNodesFromFiles(files) {
  const nodes = new Set();

  const fileToNode = {
    shield: 'shield-engine',
    costControl: 'billing-integration',
    billing: 'billing-integration',
    queue: 'workers',
    worker: 'workers',
    roast: 'roasting-engine',
    persona: 'analysis-engine',
    tone: 'roasting-engine',
    platform: 'integraciones-redes-sociales',
    integration: 'integraciones-redes-sociales'
  };

  for (const file of files) {
    for (const [pattern, node] of Object.entries(fileToNode)) {
      if (file.toLowerCase().includes(pattern.toLowerCase())) {
        nodes.add(node);
      }
    }
  }

  return Array.from(nodes);
}

// Resolver dependencias con resolve-graph.js
function resolveGraph(nodes) {
  if (nodes === 'ALL') {
    console.log('📚 Cargando TODOS los nodos (test:e2e o area:observability)');
    return { command: 'cat docs/nodes-v2/*.md', nodes: 'ALL' };
  }

  if (nodes.length === 0) {
    console.log('⚠️  No se detectaron nodos específicos. Usando nodos comunes.');
    nodes = ['roasting-engine', 'shield-engine', 'workers'];
  }

  const command = `node scripts/resolve-graph.js ${nodes.join(' ')}`;
  return { command, nodes };
}

// Generar instrucciones para Cursor
function generateCursorInstructions(resolution, issueInfo) {
  const instructions = {
    phase: 'FASE_0',
    nodes: resolution.nodes,
    command: resolution.command,
    cursorMentions:
      resolution.nodes === 'ALL'
        ? '@docs/nodes-v2/'
        : resolution.nodes.map((n) => `@docs/nodes-v2/${n}.md`).join(' '),
    workflow: []
  };

  // Workflow paso a paso
  instructions.workflow.push({
    step: 1,
    action: 'Ejecutar resolución de dependencias',
    command: resolution.command,
    note: 'Esto carga solo los nodos necesarios, no spec.md completo'
  });

  instructions.workflow.push({
    step: 2,
    action: 'Leer nodos resueltos en Cursor',
    command: `En Cursor Chat: ${instructions.cursorMentions}`,
    note: 'Usar @-mentions para contexto selectivo'
  });

  instructions.workflow.push({
    step: 3,
    action: 'Identificar dependencias',
    note: 'Los nodos resueltos ya incluyen dependencias transitivas'
  });

  if (issueInfo) {
    instructions.workflow.push({
      step: 4,
      action: 'Leer coderabbit-lessons.md',
      command: '@docs/patterns/coderabbit-lessons.md',
      note: 'Siempre antes de implementar'
    });
  }

  return instructions;
}

// Main
function main() {
  const args = process.argv.slice(2);
  const fromBranch = args.includes('--from-branch');
  const issueNum = args.find((arg) => /^\d+$/.test(arg)) || null;

  console.log('🔍 Auto GDD Activation Detector\n');

  // 1. Obtener info de issue
  const issueInfo = getIssueInfo(issueNum);
  let labels = [];
  let title = '';
  let body = '';

  if (issueInfo) {
    labels = issueInfo.labels || [];
    title = issueInfo.title || '';
    body = issueInfo.body || '';
    console.log(`📋 Issue detectado: "${title}"`);
    console.log(`🏷️  Labels: ${labels.map((l) => l.name || l).join(', ')}\n`);
  } else {
    console.log('ℹ️  No se detectó issue. Usando detección por archivos.\n');
  }

  // 2. Detectar nodos desde labels
  let nodes = [];
  if (labels.length > 0) {
    nodes = detectNodesFromLabels(labels);
    if (nodes === 'ALL') {
      console.log('✅ Activación GDD: TODOS los nodos (test:e2e o area:observability)\n');
    } else if (nodes.length > 0) {
      console.log(`✅ Nodos detectados desde labels: ${nodes.join(', ')}\n`);
    }
  }

  // 3. Fallback: keywords en título/body
  if (nodes.length === 0 && (title || body)) {
    const keywordNodes = detectNodesFromKeywords(`${title} ${body}`);
    if (keywordNodes.length > 0) {
      console.log(`✅ Nodos detectados desde keywords: ${keywordNodes.join(', ')}\n`);
      keywordNodes.forEach((n) => {
        if (!nodes.includes(n)) nodes.push(n);
      });
    }
  }

  // 4. Fallback: archivos modificados
  if (nodes.length === 0) {
    try {
      const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter((f) => f);

      if (changedFiles.length > 0) {
        const fileNodes = detectNodesFromFiles(changedFiles);
        if (fileNodes.length > 0) {
          console.log(`✅ Nodos detectados desde archivos: ${fileNodes.join(', ')}\n`);
          fileNodes.forEach((n) => {
            if (!nodes.includes(n)) nodes.push(n);
          });
        }
      }
    } catch (e) {
      // Git no disponible o no hay cambios
    }
  }

  // 5. Resolver dependencias
  const resolution = resolveGraph(nodes);
  console.log('🔗 Resolución de dependencias:');
  console.log(`   Comando: ${resolution.command}\n`);

  // 6. Generar instrucciones para Cursor
  const instructions = generateCursorInstructions(resolution, issueInfo);

  console.log('📝 Instrucciones para Cursor:\n');
  console.log(`   FASE: ${instructions.phase}`);
  console.log(
    `   Nodos: ${instructions.nodes === 'ALL' ? 'TODOS' : instructions.nodes.join(', ')}`
  );
  console.log(`   @-mentions: ${instructions.cursorMentions}\n`);

  console.log('🔄 Workflow:\n');
  instructions.workflow.forEach((w) => {
    console.log(`   ${w.step}. ${w.action}`);
    if (w.command) console.log(`      → ${w.command}`);
    if (w.note) console.log(`      ℹ️  ${w.note}`);
    console.log();
  });

  // 7. Guardar instrucciones en archivo temporal
  const instructionsPath = path.join(__dirname, '../../.gdd-activation-instructions.json');
  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2));
  console.log(`💾 Instrucciones guardadas en: ${instructionsPath}\n`);

  console.log('✅ GDD activado automáticamente. Sigue el workflow arriba.\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  detectNodesFromLabels,
  detectNodesFromKeywords,
  detectNodesFromFiles,
  resolveGraph
};
