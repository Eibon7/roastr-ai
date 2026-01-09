#!/usr/bin/env node

/**
 * ROA-525: Global Tests Validation Script
 * 
 * Script de validación global que:
 * 1. Ejecuta tests y clasifica fallos
 * 2. Genera reporte detallado
 * 3. Crea issues de seguimiento si es necesario
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper: safe percentage calculation
const safePercent = (value, total, decimals = 1) => 
  total > 0 ? ((value / total) * 100).toFixed(decimals) : '0.0';

console.log('🔍 ROA-525: Global Tests Validation\n');
console.log('═══════════════════════════════════════════════════════\n');

// 1. Detectar tipo de tests que fallan
console.log('📊 FASE 1: Análisis de Tests Fallidos\n');

const testCategories = {
  'Jest/Vitest Migration': {
    pattern: /jest is not defined|jest\.mock/,
    severity: 'P0',
    description: 'Tests usando Jest syntax en Vitest',
    fix: 'Migrar de jest.mock() a vi.mock()'
  },
  'JSX in .js files': {
    pattern: /invalid JS syntax.*\.js.*JSX/,
    severity: 'P1',
    description: 'Archivos .js con sintaxis JSX',
    fix: 'Renombrar archivos .js a .jsx o configurar parser'
  },
  'Database/Supabase': {
    pattern: /DATABASE_URL|SUPABASE_|Connection.*timeout/i,
    severity: 'P0',
    description: 'Tests que requieren infraestructura de DB',
    fix: 'Configurar DB test o mock Supabase client'
  },
  'Property Access on undefined': {
    pattern: /Cannot read propert.*undefined/,
    severity: 'P1',
    description: 'Errores de acceso a propiedades undefined',
    fix: 'Revisar mocks y setup de tests'
  },
  'Playwright/E2E': {
    pattern: /tests\/e2e\/|playwright/i,
    severity: 'P1',
    description: 'Tests E2E fallando',
    fix: 'Verificar Playwright config y browser setup'
  },
  'RLS Tests': {
    pattern: /tests\/rls\//,
    severity: 'P1',
    description: 'Tests de Row Level Security fallando',
    fix: 'Revisar políticas RLS en Supabase test DB'
  }
};

// 2. Ejecutar npm test y capturar output
console.log('⏳ Ejecutando tests (esto puede tardar 30-60 segundos)...\n');

let testOutput;
try {
  testOutput = execSync('npm test 2>&1', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    maxBuffer: 100 * 1024 * 1024, // 100MB
    timeout: 120000 // 2 minutos timeout
  });
} catch (error) {
  testOutput = error.stdout || '';
}

// 3. Parsear y clasificar
const results = {
  timestamp: new Date().toISOString(),
  summary: {
    filesTotal: 0,
    filesPassing: 0,
    filesFailing: 0,
    filesSkipped: 0,
    testsTotal: 0,
    testsPassing: 0,
    testsFailing: 0,
    testsSkipped: 0
  },
  categorizedFailures: {},
  failedFiles: [],
  recommendations: []
};

// Parse summary
const filesSummary = testOutput.match(/Test Files\s+(\d+)\s+failed.*\|.*(\d+)\s+passed.*\|.*(\d+)\s+skipped.*\((\d+)\)/);
if (filesSummary) {
  results.summary.filesFailing = parseInt(filesSummary[1]);
  results.summary.filesPassing = parseInt(filesSummary[2]);
  results.summary.filesSkipped = parseInt(filesSummary[3]);
  results.summary.filesTotal = parseInt(filesSummary[4]);
}

const testsSummary = testOutput.match(/Tests\s+(\d+)\s+failed.*\|.*(\d+)\s+passed.*\|.*(\d+)\s+skipped.*\((\d+)\)/);
if (testsSummary) {
  results.summary.testsFailing = parseInt(testsSummary[1]);
  results.summary.testsPassing = parseInt(testsSummary[2]);
  results.summary.testsSkipped = parseInt(testsSummary[3]);
  results.summary.testsTotal = parseInt(testsSummary[4]);
}

// Clasificar fallos
const failLines = testOutput.split('\n');
Object.entries(testCategories).forEach(([category, config]) => {
  results.categorizedFailures[category] = {
    count: 0,
    files: [],
    severity: config.severity,
    description: config.description,
    fix: config.fix
  };

  failLines.forEach(line => {
    if (config.pattern.test(line) && line.includes('FAIL')) {
      results.categorizedFailures[category].count++;
      // Extraer nombre de archivo
      const fileMatch = line.match(/tests\/[^\s]+\.(test|spec)\.(js|jsx|ts|tsx)/);
      if (fileMatch && !results.categorizedFailures[category].files.includes(fileMatch[0])) {
        results.categorizedFailures[category].files.push(fileMatch[0]);
      }
    }
  });
});

// 4. Generar recomendaciones
console.log('✅ Tests completados\n');
console.log('═══════════════════════════════════════════════════════\n');
console.log('📈 RESUMEN GLOBAL\n');
console.log(`  Archivos de Test:`);
console.log(`    Total: ${results.summary.filesTotal}`);
console.log(`    ✅ Pasando: ${results.summary.filesPassing} (${safePercent(results.summary.filesPassing, results.summary.filesTotal)}%)`);
console.log(`    ❌ Fallando: ${results.summary.filesFailing} (${safePercent(results.summary.filesFailing, results.summary.filesTotal)}%)`);
console.log(`    ⏭️  Skipped: ${results.summary.filesSkipped}\n`);

console.log(`  Tests Individuales:`);
console.log(`    Total: ${results.summary.testsTotal}`);
console.log(`    ✅ Pasando: ${results.summary.testsPassing} (${safePercent(results.summary.testsPassing, results.summary.testsTotal)}%)`);
console.log(`    ❌ Fallando: ${results.summary.testsFailing} (${safePercent(results.summary.testsFailing, results.summary.testsTotal)}%)`);
console.log(`    ⏭️  Skipped: ${results.summary.testsSkipped}\n`);

console.log('═══════════════════════════════════════════════════════\n');
console.log('🔍 FALLOS CLASIFICADOS POR CATEGORÍA\n');

Object.entries(results.categorizedFailures)
  .filter(([_, data]) => data.count > 0)
  .sort((a, b) => {
    if (a[1].severity !== b[1].severity) {
      return a[1].severity.localeCompare(b[1].severity);
    }
    return b[1].count - a[1].count;
  })
  .forEach(([category, data]) => {
    console.log(`\n  [${data.severity}] ${category}`);
    console.log(`  ${data.description}`);
    console.log(`  Archivos afectados: ${data.files.length}`);
    console.log(`  Fix sugerido: ${data.fix}`);
    
    if (data.files.length > 0 && data.files.length <= 10) {
      console.log(`  Archivos:`);
      data.files.slice(0, 10).forEach(file => {
        console.log(`    - ${file}`);
      });
    } else if (data.files.length > 10) {
      console.log(`  Archivos (primeros 10):`);
      data.files.slice(0, 10).forEach(file => {
        console.log(`    - ${file}`);
      });
      console.log(`    ... y ${data.files.length - 10} más`);
    }

    // Generar recomendación
    results.recommendations.push({
      priority: data.severity,
      category,
      description: data.description,
      affectedFiles: data.files.length,
      fix: data.fix,
      files: data.files
    });
  });

// 5. Guardar reporte
console.log('\n\n═══════════════════════════════════════════════════════\n');
console.log('💾 Guardando reportes...\n');

const reportDir = path.join(__dirname, '..', 'docs', 'test-evidence', 'ROA-525');
fs.mkdirSync(reportDir, { recursive: true });

const reportPath = path.join(reportDir, 'validation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`✅ Reporte JSON: ${reportPath}`);

// Generar reporte Markdown
const mdReport = `# ROA-525: Global Tests Validation Report

**Fecha:** ${new Date().toISOString().split('T')[0]}
**Generado por:** scripts/validate-global-tests.js

---

## 📊 Resumen Ejecutivo

### Archivos de Test

- **Total:** ${results.summary.filesTotal}
- **✅ Pasando:** ${results.summary.filesPassing} (${((results.summary.filesPassing / results.summary.filesTotal) * 100).toFixed(1)}%)
- **❌ Fallando:** ${results.summary.filesFailing} (${((results.summary.filesFailing / results.summary.filesTotal) * 100).toFixed(1)}%)
- **⏭️ Skipped:** ${results.summary.filesSkipped}

### Tests Individuales

- **Total:** ${results.summary.testsTotal}
- **✅ Pasando:** ${results.summary.testsPassing} (${((results.summary.testsPassing / results.summary.testsTotal) * 100).toFixed(1)}%)
- **❌ Fallando:** ${results.summary.testsFailing} (${((results.summary.testsFailing / results.summary.testsTotal) * 100).toFixed(1)}%)
- **⏭️ Skipped:** ${results.summary.testsSkipped}

---

## 🔍 Fallos Clasificados

${Object.entries(results.categorizedFailures)
  .filter(([_, data]) => data.count > 0)
  .sort((a, b) => {
    if (a[1].severity !== b[1].severity) {
      return a[1].severity.localeCompare(b[1].severity);
    }
    return b[1].count - a[1].count;
  })
  .map(([category, data]) => `
### [${data.severity}] ${category}

**Descripción:** ${data.description}
**Archivos afectados:** ${data.files.length}
**Fix sugerido:** ${data.fix}

${data.files.length > 0 ? `**Archivos:**\n${data.files.slice(0, 20).map(f => `- \`${f}\``).join('\n')}${data.files.length > 20 ? `\n- ... y ${data.files.length - 20} más` : ''}` : ''}
`).join('\n---\n')}

---

## 🎯 Recomendaciones

${results.recommendations.map((rec, i) => `
### ${i + 1}. [${rec.priority}] ${rec.category}

**Descripción:** ${rec.description}
**Archivos afectados:** ${rec.affectedFiles}
**Acción requerida:** ${rec.fix}

**Issues relacionadas:**
${rec.category === 'Jest/Vitest Migration' ? '- #1070, #1071, #1072, #1073 (Workers & Integration tests migration)' : ''}
${rec.category === 'Database/Supabase' ? '- #719 (Real test database implementation)' : ''}
${rec.category === 'RLS Tests' ? '- Requiere Supabase test DB setup' : ''}

**Prioridad de fix:** ${rec.priority === 'P0' ? 'Inmediato' : rec.priority === 'P1' ? 'Alto' : 'Medio'}
`).join('\n---\n')}

---

## 📝 Siguiente Pasos

1. **P0 Issues:** Resolver inmediatamente
   - Configurar infraestructura de tests (DB, Supabase)
   - Migrar Jest syntax a Vitest

2. **P1 Issues:** Resolver en siguiente sprint
   - Fix JSX in .js files
   - Stabilize E2E tests
   - Fix RLS tests

3. **P2 Issues:** Backlog
   - Code quality improvements
   - Test refactoring

---

**Última actualización:** ${new Date().toISOString().split('T')[0]}
**Mantenido por:** Test Engineer
`;

const mdPath = path.join(reportDir, 'validation-report.md');
fs.writeFileSync(mdPath, mdReport);
console.log(`✅ Reporte Markdown: ${mdPath}`);

console.log('\n═══════════════════════════════════════════════════════\n');
console.log('✅ Validación completada\n');

// Exit code según resultados
if (results.summary.filesFailing > 0) {
  console.log(`⚠️  ${results.summary.filesFailing} archivos de test fallando`);
  console.log(`⚠️  Ver reporte para más detalles: ${mdPath}\n`);
  process.exit(1);
} else {
  console.log('🎉 Todos los tests pasando!\n');
  process.exit(0);
}


