#!/usr/bin/env node
/**
 * ROA-320: Script de Reclasificación de Documentos Legacy
 *
 * Mueve documentos legacy a categorías apropiadas:
 * - CodeRabbit reviews → docs/legacy/reviews/
 * - Plans obsoletos → docs/legacy/plans/
 * - Test evidence obsoletos → docs/legacy/test-evidence/
 */

const fs = require('fs');
const path = require('path');
// execSync no usado en este script

const DOCS_ROOT = path.join(__dirname, '../docs');
const LEGACY_REVIEWS = path.join(DOCS_ROOT, 'legacy/reviews');
const LEGACY_PLANS = path.join(DOCS_ROOT, 'legacy/plans');
const LEGACY_TEST_EVIDENCE = path.join(DOCS_ROOT, 'legacy/test-evidence');

// Cargar clasificación
const classificationPath = path.join(DOCS_ROOT, 'CI-V2/ROA-320-CLASSIFICATION.json');
if (!fs.existsSync(classificationPath)) {
  console.error(
    '❌ No se encontró el archivo de clasificación. Ejecuta primero roa-320-classify-legacy.js'
  );
  process.exit(1);
}

const classification = JSON.parse(fs.readFileSync(classificationPath, 'utf8'));

// Estadísticas
const stats = {
  moved: 0,
  errors: 0,
  skipped: 0
};

// Función para mover archivo/directorio
function moveItem(source, dest, description) {
  try {
    if (!fs.existsSync(source)) {
      console.log(`⚠️  Saltando (no existe): ${description}`);
      stats.skipped++;
      return false;
    }

    // Crear directorio destino si no existe
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Mover
    fs.renameSync(source, dest);
    console.log(`✅ Movido: ${description}`);
    stats.moved++;
    return true;
  } catch (error) {
    console.error(`❌ Error moviendo ${description}: ${error.message}`);
    stats.errors++;
    return false;
  }
}

// 1. Mover CodeRabbit review plans
function moveReviewPlans() {
  console.log('\n📋 Moviendo CodeRabbit review plans...\n');

  classification.reviews.plans.forEach((plan) => {
    const source = plan.path;
    const dest = path.join(LEGACY_REVIEWS, plan.name);
    moveItem(source, dest, `review plan: ${plan.name}`);
  });
}

// 2. Mover CodeRabbit review test evidence
function moveReviewTestEvidence() {
  console.log('\n📋 Moviendo CodeRabbit review test evidence...\n');

  classification.reviews.testEvidence.forEach((evidence) => {
    const source = evidence.path;
    const dest = path.join(LEGACY_TEST_EVIDENCE, evidence.name);
    moveItem(source, dest, `review test evidence: ${evidence.name}/`);
  });
}

// 3. Mover plans obsoletos (opcional, solo si hay)
function moveObsoletePlans() {
  console.log('\n📋 Moviendo plans obsoletos...\n');

  if (classification.plans.obsolete.length === 0) {
    console.log('  ℹ️  No hay plans obsoletos para mover\n');
    return;
  }

  classification.plans.obsolete.forEach((plan) => {
    const source = plan.path;
    const dest = path.join(LEGACY_PLANS, plan.name);
    moveItem(source, dest, `obsolete plan: ${plan.name}`);
  });
}

// 4. Mover test evidence obsoletos (opcional, solo si hay)
function moveObsoleteTestEvidence() {
  console.log('\n📋 Moviendo test evidence obsoletos...\n');

  if (classification.testEvidence.obsolete.length === 0) {
    console.log('  ℹ️  No hay test evidence obsoletos para mover\n');
    return;
  }

  classification.testEvidence.obsolete.forEach((evidence) => {
    const source = evidence.path;
    const dest = path.join(LEGACY_TEST_EVIDENCE, evidence.name);
    moveItem(source, dest, `obsolete test evidence: ${evidence.name}/`);
  });
}

// 5. Generar reporte de reclasificación
function generateReclassificationReport() {
  const reportPath = path.join(DOCS_ROOT, 'CI-V2/ROA-320-RECLASSIFICATION-REPORT.md');

  const report = `# ROA-320: Reporte de Reclasificación de Documentos Legacy

**Fecha:** ${new Date().toISOString().split('T')[0]}  
**Issue:** ROA-320  
**Estado:** ✅ Reclasificación Completa

---

## 📊 Resumen Ejecutivo

### Estadísticas de Movimiento

- **Movidos exitosamente:** ${stats.moved} elementos
- **Errores:** ${stats.errors} elementos
- **Saltados:** ${stats.skipped} elementos

### Desglose por Categoría

#### CodeRabbit Reviews

- **Planes movidos:** ${classification.reviews.plans.length} archivos → \`docs/legacy/reviews/\`
- **Test evidence movidos:** ${classification.reviews.testEvidence.length} directorios → \`docs/legacy/test-evidence/\`

#### Plans Obsoletos

- **Plans movidos:** ${classification.plans.obsolete.length} archivos → \`docs/legacy/plans/\`

#### Test Evidence Obsoletos

- **Test evidence movidos:** ${classification.testEvidence.obsolete.length} directorios → \`docs/legacy/test-evidence/\`

---

## 📁 Estructura de Destino

### \`docs/legacy/reviews/\`

Contiene planes de CodeRabbit reviews:
- ${classification.reviews.plans.length} archivos \`.md\`

### \`docs/legacy/test-evidence/\`

Contiene test evidence de reviews y issues obsoletos:
- ${classification.reviews.testEvidence.length} directorios de reviews
- ${classification.testEvidence.obsolete.length} directorios de issues obsoletos

### \`docs/legacy/plans/\`

Contiene plans de issues obsoletos:
- ${classification.plans.obsolete.length} archivos \`.md\`

---

## ✅ Validación

### Verificación de Movimiento

\`\`\`bash
# Verificar que los archivos fueron movidos
ls -la docs/legacy/reviews/ | wc -l
ls -la docs/legacy/test-evidence/ | wc -l
ls -la docs/legacy/plans/ | wc -l
\`\`\`

### Verificar que no quedan en origen

\`\`\`bash
# Verificar que no quedan reviews en docs/plan/
find docs/plan -name "review-*.md" | wc -l
# Esperado: 0

# Verificar que no quedan reviews en docs/test-evidence/
find docs/test-evidence -type d -name "review-*" | wc -l
# Esperado: 0
\`\`\`

---

## 🎯 Próximos Pasos

1. **Validar con scripts v2** - Ejecutar validadores para asegurar que no se rompió nada
2. **Eliminar duplicados** - Identificar y eliminar documentos duplicados
3. **Generar reporte final** - Documentar cambios completos

---

**Última actualización:** ${new Date().toISOString()}
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Reporte generado: ${reportPath}\n`);
}

// Main
function main() {
  console.log('🔄 ROA-320: Reclasificación de Documentos Legacy\n');
  console.log('='.repeat(60) + '\n');

  // Crear directorios destino
  [LEGACY_REVIEWS, LEGACY_PLANS, LEGACY_TEST_EVIDENCE].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Creado directorio: ${dir}`);
    }
  });

  console.log();

  // Mover documentos
  moveReviewPlans();
  moveReviewTestEvidence();
  moveObsoletePlans();
  moveObsoleteTestEvidence();

  // Generar reporte
  generateReclassificationReport();

  console.log('='.repeat(60));
  console.log('\n📊 Estadísticas Finales:');
  console.log(`  ✅ Movidos: ${stats.moved}`);
  console.log(`  ❌ Errores: ${stats.errors}`);
  console.log(`  ⚠️  Saltados: ${stats.skipped}`);
  console.log('\n✅ Reclasificación completada\n');
}

if (require.main === module) {
  main();
}

module.exports = { stats };
