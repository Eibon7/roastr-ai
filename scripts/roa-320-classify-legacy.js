#!/usr/bin/env node
/**
 * ROA-320: Script de Clasificación de Documentos Legacy
 *
 * Clasifica documentos legacy según criterios:
 * - CodeRabbit reviews → docs/legacy/reviews/
 * - Plans obsoletos → docs/legacy/plans/
 * - Test evidence obsoletos → docs/legacy/test-evidence/
 * - Duplicados → eliminar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOCS_ROOT = path.join(__dirname, '../docs');
const LEGACY_REVIEWS = path.join(DOCS_ROOT, 'legacy/reviews');
const LEGACY_PLANS = path.join(DOCS_ROOT, 'legacy/plans');
const LEGACY_TEST_EVIDENCE = path.join(DOCS_ROOT, 'legacy/test-evidence');

// Crear directorios si no existen
[LEGACY_REVIEWS, LEGACY_PLANS, LEGACY_TEST_EVIDENCE].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Clasificación de documentos
const classification = {
  reviews: {
    plans: [],
    testEvidence: []
  },
  plans: {
    obsolete: [],
    active: []
  },
  testEvidence: {
    obsolete: [],
    active: []
  },
  duplicates: []
};

// 1. Clasificar CodeRabbit reviews
function classifyCodeRabbitReviews() {
  console.log('📋 Clasificando CodeRabbit reviews...\n');

  // Planes de reviews
  const reviewPlans = execSync(`find ${DOCS_ROOT}/plan -name "review-*.md" -type f`, {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter((f) => f);

  classification.reviews.plans = reviewPlans.map((f) => ({
    path: f,
    name: path.basename(f),
    size: fs.statSync(f).size,
    category: 'codeRabbit-review-plan'
  }));

  console.log(`  ✅ Encontrados ${reviewPlans.length} planes de reviews`);

  // Test evidence de reviews
  const reviewDirs = execSync(`find ${DOCS_ROOT}/test-evidence -type d -name "review-*"`, {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter((f) => f);

  classification.reviews.testEvidence = reviewDirs.map((f) => ({
    path: f,
    name: path.basename(f),
    files: fs.readdirSync(f).length,
    category: 'codeRabbit-review-evidence'
  }));

  console.log(`  ✅ Encontrados ${reviewDirs.length} directorios de test evidence de reviews\n`);
}

// 2. Clasificar plans de issues
function classifyIssuePlans() {
  console.log('📋 Clasificando plans de issues...\n');

  const issuePlans = execSync(`find ${DOCS_ROOT}/plan -name "issue-*.md" -type f`, {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter((f) => f);

  issuePlans.forEach((planPath) => {
    const name = path.basename(planPath);
    const stats = fs.statSync(planPath);
    const mtime = stats.mtime;
    const daysSinceModified = (Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24);

    // Extraer issue number del nombre
    const issueMatch = name.match(/issue[_-]?(\d+)/i);
    const issueNum = issueMatch ? issueMatch[1] : null;

    // Clasificar como obsoleto si >6 meses
    const isObsolete = daysSinceModified > 180;

    const entry = {
      path: planPath,
      name,
      issueNum,
      daysSinceModified: Math.floor(daysSinceModified),
      isObsolete,
      category: isObsolete ? 'obsolete-plan' : 'active-plan'
    };

    if (isObsolete) {
      classification.plans.obsolete.push(entry);
    } else {
      classification.plans.active.push(entry);
    }
  });

  console.log(`  ✅ Encontrados ${issuePlans.length} planes de issues`);
  console.log(`    - Obsoletos (>6 meses): ${classification.plans.obsolete.length}`);
  console.log(`    - Activos: ${classification.plans.active.length}\n`);
}

// 3. Clasificar test evidence de issues
function classifyIssueTestEvidence() {
  console.log('📋 Clasificando test evidence de issues...\n');

  const issueDirs = execSync(`find ${DOCS_ROOT}/test-evidence -type d -name "issue-*"`, {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter((f) => f);

  issueDirs.forEach((dirPath) => {
    const name = path.basename(dirPath);
    const stats = fs.statSync(dirPath);
    const mtime = stats.mtime;
    const daysSinceModified = (Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24);

    // Extraer issue number del nombre
    const issueMatch = name.match(/issue[_-]?(\d+)/i);
    const issueNum = issueMatch ? issueMatch[1] : null;

    // Clasificar como obsoleto si >3 meses
    const isObsolete = daysSinceModified > 90;

    const entry = {
      path: dirPath,
      name,
      issueNum,
      daysSinceModified: Math.floor(daysSinceModified),
      isObsolete,
      files: fs.readdirSync(dirPath).length,
      category: isObsolete ? 'obsolete-test-evidence' : 'active-test-evidence'
    };

    if (isObsolete) {
      classification.testEvidence.obsolete.push(entry);
    } else {
      classification.testEvidence.active.push(entry);
    }
  });

  console.log(`  ✅ Encontrados ${issueDirs.length} directorios de test evidence de issues`);
  console.log(`    - Obsoletos (>3 meses): ${classification.testEvidence.obsolete.length}`);
  console.log(`    - Activos: ${classification.testEvidence.active.length}\n`);
}

// 4. Generar reporte de clasificación
function generateClassificationReport() {
  const reportPath = path.join(DOCS_ROOT, 'CI-V2/ROA-320-CLASSIFICATION-REPORT.md');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = `# ROA-320: Reporte de Clasificación de Documentos Legacy

**Fecha:** ${new Date().toISOString().split('T')[0]}  
**Issue:** ROA-320  
**Estado:** 📋 Clasificación Completa

---

## 📊 Resumen Ejecutivo

### CodeRabbit Reviews

- **Planes de reviews:** ${classification.reviews.plans.length} archivos
- **Test evidence de reviews:** ${classification.reviews.testEvidence.length} directorios
- **Total CodeRabbit reviews:** ${classification.reviews.plans.length + classification.reviews.testEvidence.length} elementos

### Plans de Issues

- **Obsoletos (>6 meses):** ${classification.plans.obsolete.length} archivos
- **Activos:** ${classification.plans.active.length} archivos
- **Total plans:** ${classification.plans.obsolete.length + classification.plans.active.length} archivos

### Test Evidence de Issues

- **Obsoletos (>3 meses):** ${classification.testEvidence.obsolete.length} directorios
- **Activos:** ${classification.testEvidence.active.length} directorios
- **Total test evidence:** ${classification.testEvidence.obsolete.length + classification.testEvidence.active.length} directorios

---

## 📁 Detalle de Clasificación

### 1. CodeRabbit Review Plans

**Total:** ${classification.reviews.plans.length} archivos

\`\`\`
${classification.reviews.plans.map((p) => `- ${p.name} (${(p.size / 1024).toFixed(2)} KB)`).join('\n')}
\`\`\`

**Acción:** Mover a \`docs/legacy/reviews/\`

---

### 2. CodeRabbit Review Test Evidence

**Total:** ${classification.reviews.testEvidence.length} directorios

\`\`\`
${classification.reviews.testEvidence.map((e) => `- ${e.name}/ (${e.files} archivos)`).join('\n')}
\`\`\`

**Acción:** Mover a \`docs/legacy/test-evidence/\`

---

### 3. Plans de Issues Obsoletos

**Total:** ${classification.plans.obsolete.length} archivos

\`\`\`
${classification.plans.obsolete.map((p) => `- ${p.name} (Issue #${p.issueNum || 'N/A'}, ${p.daysSinceModified} días)`).join('\n')}
\`\`\`

**Acción:** Mover a \`docs/legacy/plans/\` o eliminar

---

### 4. Test Evidence de Issues Obsoletos

**Total:** ${classification.testEvidence.obsolete.length} directorios

\`\`\`
${classification.testEvidence.obsolete.map((e) => `- ${e.name}/ (Issue #${e.issueNum || 'N/A'}, ${e.daysSinceModified} días, ${e.files} archivos)`).join('\n')}
\`\`\`

**Acción:** Mover a \`docs/legacy/test-evidence/\` o eliminar

---

## 🎯 Próximos Pasos

1. **Revisar clasificación** - Verificar que todos los documentos están correctamente clasificados
2. **Mover documentos** - Ejecutar script de reclasificación
3. **Eliminar duplicados** - Identificar y eliminar documentos duplicados
4. **Validar** - Ejecutar validadores v2

---

**Última actualización:** ${new Date().toISOString()}
`;

  fs.writeFileSync(reportPath, report);
  console.log(`✅ Reporte generado: ${reportPath}\n`);
}

// Main
function main() {
  console.log('🔍 ROA-320: Clasificación de Documentos Legacy\n');
  console.log('='.repeat(60) + '\n');

  classifyCodeRabbitReviews();
  classifyIssuePlans();
  classifyIssueTestEvidence();
  generateClassificationReport();

  // Guardar clasificación en JSON para uso posterior
  const jsonPath = path.join(DOCS_ROOT, 'CI-V2/ROA-320-CLASSIFICATION.json');
  fs.writeFileSync(jsonPath, JSON.stringify(classification, null, 2));
  console.log(`✅ Clasificación guardada en JSON: ${jsonPath}\n`);

  console.log('='.repeat(60));
  console.log('✅ Clasificación completada\n');
}

if (require.main === module) {
  main();
}

module.exports = { classification };
