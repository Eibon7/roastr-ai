#!/usr/bin/env node

/**
 * ROA-525: Global Tests and Validation Analysis
 * 
 * Analiza el estado actual del sistema de tests y clasifica fallos
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper: safe percentage calculation
const percent = (value, total, decimals = 2) => 
  total > 0 ? ((value / total) * 100).toFixed(decimals) : '0.00';

console.log('🔍 ROA-525: Global Tests and Validation Analysis\n');

// Ejecutar tests y capturar output
console.log('📊 Ejecutando tests...\n');
let testOutput;
try {
  testOutput = execSync('npm test', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    timeout: 120000 // 2 minutes timeout
  });
} catch (error) {
  testOutput = error.stdout || '';
}

// Parsear resultados
const results = {
  timestamp: new Date().toISOString(),
  summary: {},
  failureCategories: {
    accessibility: [],
    e2e: [],
    rls: [],
    smoke: [],
    visual: [],
    unit: [],
    integration: [],
  },
  errorPatterns: {},
  recommendations: []
};

// Extraer resumen
const summaryMatch = testOutput.match(/Test Files\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\|\s+(\d+)\s+skipped\s+\((\d+)\)/);
if (summaryMatch) {
  results.summary = {
    failed: parseInt(summaryMatch[1]),
    passed: parseInt(summaryMatch[2]),
    skipped: parseInt(summaryMatch[3]),
    total: parseInt(summaryMatch[4]),
    failureRate: ((parseInt(summaryMatch[1]) / parseInt(summaryMatch[4])) * 100).toFixed(2) + '%'
  };
}

const testsSummaryMatch = testOutput.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\|\s+(\d+)\s+skipped\s+\((\d+)\)/);
if (testsSummaryMatch) {
  results.summary.testsFailed = parseInt(testsSummaryMatch[1]);
  results.summary.testsPassed = parseInt(testsSummaryMatch[2]);
  results.summary.testsSkipped = parseInt(testsSummaryMatch[3]);
  results.summary.testsTotal = parseInt(testsSummaryMatch[4]);
  results.summary.testFailureRate = ((parseInt(testsSummaryMatch[1]) / parseInt(testsSummaryMatch[4])) * 100).toFixed(2) + '%';
}

// Clasificar fallos por categoría
const failLines = testOutput.split('\n').filter(line => line.includes('FAIL'));
failLines.forEach(line => {
  if (line.includes('tests/accessibility/')) {
    results.failureCategories.accessibility.push(line.trim());
  } else if (line.includes('tests/e2e/')) {
    results.failureCategories.e2e.push(line.trim());
  } else if (line.includes('tests/rls/')) {
    results.failureCategories.rls.push(line.trim());
  } else if (line.includes('tests/smoke/')) {
    results.failureCategories.smoke.push(line.trim());
  } else if (line.includes('tests/visual/')) {
    results.failureCategories.visual.push(line.trim());
  } else if (line.includes('tests/unit/')) {
    results.failureCategories.unit.push(line.trim());
  } else if (line.includes('tests/integration/')) {
    results.failureCategories.integration.push(line.trim());
  }
});

// Detectar patrones de error comunes
const errorPatterns = [
  'Cannot read properties of undefined',
  'TypeError',
  'AssertionError',
  'Connection timeout',
  'ECONNREFUSED',
  'done() callback is deprecated',
  'Timeout',
  'Module not found',
  'DATABASE_URL',
  'SUPABASE',
];

errorPatterns.forEach(pattern => {
  const count = (testOutput.match(new RegExp(pattern, 'g')) || []).length;
  if (count > 0) {
    results.errorPatterns[pattern] = count;
  }
});

// Generar recomendaciones
results.recommendations = [
  {
    priority: 'P0',
    category: 'Infrastructure',
    issue: 'Database/Supabase connection issues',
    action: 'Verificar configuración de DATABASE_URL y SUPABASE_* vars',
    affectedTests: results.failureCategories.rls.length + results.failureCategories.integration.filter(t => t.includes('db') || t.includes('rls')).length
  },
  {
    priority: 'P0',
    category: 'Integration',
    issue: `${results.failureCategories.integration.length} integration tests failing`,
    action: 'Revisar setup de tests de integración y dependencias externas',
    affectedTests: results.failureCategories.integration.length
  },
  {
    priority: 'P1',
    category: 'E2E',
    issue: `${results.failureCategories.e2e.length} E2E tests failing`,
    action: 'Verificar Playwright setup y browser context',
    affectedTests: results.failureCategories.e2e.length
  },
  {
    priority: 'P1',
    category: 'RLS',
    issue: `${results.failureCategories.rls.length} RLS tests failing`,
    action: 'Revisar políticas RLS en Supabase y setup de DB test',
    affectedTests: results.failureCategories.rls.length
  },
  {
    priority: 'P2',
    category: 'Code Quality',
    issue: 'Tests usando done() callback deprecated',
    action: 'Migrar a promises en tests afectados',
    affectedTests: results.errorPatterns['done() callback is deprecated'] || 0
  },
  {
    priority: 'P2',
    category: 'Unit Tests',
    issue: `${results.failureCategories.unit.length} unit tests failing`,
    action: 'Revisar mocks y dependencias de unit tests',
    affectedTests: results.failureCategories.unit.length
  },
];

// Output reporte
console.log('📈 RESUMEN GLOBAL\n');
console.log(`  Total de archivos de test: ${results.summary.total}`);
console.log(`  ✅ Pasando: ${results.summary.passed} (${((results.summary.passed / results.summary.total) * 100).toFixed(2)}%)`);
console.log(`  ❌ Fallando: ${results.summary.failed} (${results.summary.failureRate})`);
console.log(`  ⏭️  Skipped: ${results.summary.skipped}\n`);

console.log(`  Total de tests individuales: ${results.summary.testsTotal}`);
console.log(`  ✅ Pasando: ${results.summary.testsPassed} (${((results.summary.testsPassed / results.summary.testsTotal) * 100).toFixed(2)}%)`);
console.log(`  ❌ Fallando: ${results.summary.testsFailed} (${results.summary.testFailureRate})`);
console.log(`  ⏭️  Skipped: ${results.summary.testsSkipped}\n`);

console.log('📂 FALLOS POR CATEGORÍA\n');
Object.entries(results.failureCategories).forEach(([category, failures]) => {
  if (failures.length > 0) {
    console.log(`  ${category.toUpperCase()}: ${failures.length} archivos`);
  }
});

console.log('\n🔍 PATRONES DE ERROR COMUNES\n');
Object.entries(results.errorPatterns)
  .sort((a, b) => b[1] - a[1])
  .forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count} ocurrencias`);
  });

console.log('\n🎯 RECOMENDACIONES PRIORIZADAS\n');
results.recommendations
  .sort((a, b) => a.priority.localeCompare(b.priority))
  .forEach((rec, i) => {
    console.log(`  ${i + 1}. [${rec.priority}] ${rec.category}: ${rec.issue}`);
    console.log(`     → ${rec.action}`);
    console.log(`     → Tests afectados: ${rec.affectedTests}\n`);
  });

// Guardar reporte JSON
const reportPath = path.join(__dirname, '..', 'docs', 'test-evidence', 'ROA-525-test-analysis.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n💾 Reporte guardado en: ${reportPath}`);

// Generar plan de acción
const planPath = path.join(__dirname, '..', 'docs', 'plan', 'issue-525.md');
const planContent = `# ROA-525: Global Tests and Validation - Plan de Acción

**Fecha:** ${new Date().toISOString().split('T')[0]}
**Estado:** En Progreso
**Prioridad:** P0

---

## 📊 Estado Actual

### Métricas Globales

- **Archivos de test:** ${results.summary.total}
  - ✅ Pasando: ${results.summary.passed} (${percent(results.summary.passed, results.summary.total)}%)
  - ❌ Fallando: ${results.summary.failed} (${results.summary.failureRate})
  - ⏭️ Skipped: ${results.summary.skipped}

- **Tests individuales:** ${results.summary.testsTotal}
  - ✅ Pasando: ${results.summary.testsPassed} (${percent(results.summary.testsPassed, results.summary.testsTotal)}%)
  - ❌ Fallando: ${results.summary.testsFailed} (${results.summary.testFailureRate})
  - ⏭️ Skipped: ${results.summary.testsSkipped}

### Fallos por Categoría

${Object.entries(results.failureCategories)
  .filter(([_, failures]) => failures.length > 0)
  .map(([category, failures]) => `- **${category}**: ${failures.length} archivos`)
  .join('\n')}

### Patrones de Error

${Object.entries(results.errorPatterns)
  .sort((a, b) => b[1] - a[1])
  .map(([pattern, count]) => `- **${pattern}**: ${count} ocurrencias`)
  .join('\n')}

---

## 🎯 Plan de Acción

${results.recommendations
  .sort((a, b) => a.priority.localeCompare(b.priority))
  .map((rec, i) => `### ${i + 1}. [${rec.priority}] ${rec.category}: ${rec.issue}

**Acción:** ${rec.action}
**Tests afectados:** ${rec.affectedTests}

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con \`npm test -- <ruta>\`
4. Commit con mensaje: \`fix(ROA-525): ${rec.action}\`

---`)
  .join('\n')}

## 📝 Validación

Una vez completados los fixes:

\`\`\`bash
# 1. Ejecutar todos los tests
npm test

# 2. Verificar cobertura
npm run test:coverage

# 3. Validar GDD
node scripts/validate-gdd-runtime.js --full

# 4. Score de health
node scripts/score-gdd-health.js --ci
\`\`\`

**Criterios de éxito:**
- ✅ 0 tests fallando (100% passing)
- ✅ Coverage >= 90%
- ✅ GDD health >= 87
- ✅ 0 comentarios CodeRabbit

---

**Mantenido por:** Test Engineer
**Última actualización:** ${new Date().toISOString().split('T')[0]}
`;

fs.mkdirSync(path.dirname(planPath), { recursive: true });
fs.writeFileSync(planPath, planContent);
console.log(`📋 Plan de acción guardado en: ${planPath}\n`);

console.log('✅ Análisis completado\n');

// Exit con código según estado
process.exit(results.summary.failed > 0 ? 1 : 0);


