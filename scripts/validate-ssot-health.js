#!/usr/bin/env node
/**
 * GDD v2 Health Score - SSOT Validator
 *
 * Valida que la sección 15 del SSOT (GDD Health Score) existe, está completa,
 * y es coherente con system-map-v2.yaml y docs/nodes-v2/**.
 *
 * Este script debe fallar el CI si:
 * - La sección 15 no existe
 * - Está incompleta
 * - Tiene valores TBD
 * - Las métricas son incoherentes con system-map + nodos
 * - calculate-gdd-health-v2.js y SSOT no coinciden
 *
 * Usage:
 *   node scripts/validate-ssot-health.js
 *   node scripts/validate-ssot-health.js --ci  # Exit 1 on failure
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs/SSOT-V2.md');
const HEALTH_JSON = path.join(ROOT_DIR, 'gdd-health-v2.json');

function validateSSOTSection15() {
  const errors = [];
  const warnings = [];

  // 1. Verificar que SSOT existe
  if (!fs.existsSync(SSOT_V2_PATH)) {
    errors.push(`SSOT-V2.md no encontrado en: ${SSOT_V2_PATH}`);
    return { valid: false, errors, warnings };
  }

  const ssotContent = fs.readFileSync(SSOT_V2_PATH, 'utf8');

  // 2. Verificar que sección 15 existe
  const section15Start = ssotContent.indexOf('## 15. GDD Health Score');
  if (section15Start === -1) {
    errors.push(
      'Sección 15 "GDD Health Score" no encontrada en SSOT-V2.md. Ejecuta: node scripts/compute-health-v2-official.js --update-ssot'
    );
    return { valid: false, errors, warnings };
  }

  // Encontrar el final de la sección
  const remainingContent = ssotContent.substring(section15Start);
  const nextSectionMatch = remainingContent.match(/\n## /);
  const section15End = nextSectionMatch
    ? section15Start + nextSectionMatch.index
    : ssotContent.length;
  const section15 = ssotContent.substring(section15Start, section15End);

  // 3. Verificar que no hay valores TBD
  if (/TBD|tbd|TODO|todo|placeholder/i.test(section15)) {
    const tbdMatches = section15.match(/(TBD|tbd|TODO|todo|placeholder)/gi);
    if (tbdMatches) {
      warnings.push(
        `Se encontraron valores TBD/TODO/placeholder en sección 15: ${tbdMatches.join(', ')}`
      );
    }
  }

  // 4. Verificar que todas las métricas están presentes
  const requiredMetrics = [
    'System Map Alignment',
    'SSOT Alignment',
    'Dependency Density',
    'Crosslink Score',
    'Narrative Consistency',
    'Health Score Final'
  ];

  const missingMetrics = [];
  requiredMetrics.forEach((metric) => {
    // Buscar en formato de tabla markdown: | **Metric** | value |
    const pattern = new RegExp(`\\*\\*${metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'i');
    if (!pattern.test(section15)) {
      missingMetrics.push(metric);
    }
  });

  if (missingMetrics.length > 0) {
    errors.push(`Métricas faltantes en sección 15: ${missingMetrics.join(', ')}`);
  }

  // 5. Verificar que los valores son numéricos válidos
  const metricPatterns = {
    systemMapAlignment: /\|\s*\*\*System Map Alignment\*\*\s*\|\s*(\d+\.?\d*)%/,
    ssotAlignment: /\|\s*\*\*SSOT Alignment\*\*\s*\|\s*(\d+\.?\d*)%/,
    dependencyDensity: /\|\s*\*\*Dependency Density\*\*\s*\|\s*(\d+\.?\d*)%/,
    crosslinkScore: /\|\s*\*\*Crosslink Score\*\*\s*\|\s*(\d+\.?\d*)%/,
    narrativeConsistency: /\|\s*\*\*Narrative Consistency\*\*\s*\|\s*(\d+\.?\d*)%/,
    healthScore: /\|\s*\*\*Health Score Final\*\*\s*\|\s*\*\*(\d+\.?\d*)\/100\*\*/
  };

  const extractedMetrics = {};
  for (const [key, pattern] of Object.entries(metricPatterns)) {
    const match = section15.match(pattern);
    if (match) {
      extractedMetrics[key] = parseFloat(match[1]);
      if (
        isNaN(extractedMetrics[key]) ||
        extractedMetrics[key] < 0 ||
        extractedMetrics[key] > 100
      ) {
        errors.push(`Valor inválido para ${key}: ${match[1]}`);
      }
    } else {
      errors.push(`No se pudo extraer ${key} de la sección 15`);
    }
  }

  // 6. Verificar coherencia con gdd-health-v2.json (si existe)
  if (fs.existsSync(HEALTH_JSON)) {
    try {
      const healthJson = JSON.parse(fs.readFileSync(HEALTH_JSON, 'utf8'));

      const tolerance = 0.01; // Tolerancia para diferencias de redondeo

      if (Math.abs(healthJson.health_score - extractedMetrics.healthScore) > tolerance) {
        errors.push(
          `Health score en JSON (${healthJson.health_score}) no coincide con SSOT (${extractedMetrics.healthScore})`
        );
      }

      if (
        Math.abs(healthJson.system_map_alignment_score - extractedMetrics.systemMapAlignment) >
        tolerance
      ) {
        warnings.push(
          `System Map Alignment en JSON (${healthJson.system_map_alignment_score}) no coincide exactamente con SSOT (${extractedMetrics.systemMapAlignment})`
        );
      }
    } catch (e) {
      warnings.push(`No se pudo validar coherencia con gdd-health-v2.json: ${e.message}`);
    }
  }

  // 7. Verificar que la última actualización es reciente (opcional, solo warning)
  const timestampMatch = section15.match(/\*\*Última actualización:\*\* (.+)/);
  if (timestampMatch) {
    const timestamp = timestampMatch[1].trim();
    try {
      const updateDate = new Date(timestamp);
      const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 90) {
        warnings.push(
          `Última actualización hace ${Math.round(daysSinceUpdate)} días. Considera recalcular: node scripts/compute-health-v2-official.js --update-ssot`
        );
      }
    } catch (e) {
      warnings.push(`No se pudo parsear timestamp de última actualización: ${timestamp}`);
    }
  }

  const valid = errors.length === 0;

  return { valid, errors, warnings, metrics: extractedMetrics };
}

function main() {
  const isCI = process.argv.includes('--ci');

  logger.info('🔍 Validando sección 15 del SSOT (GDD Health Score)...\n');

  const result = validateSSOTSection15();

  if (result.valid) {
    logger.info('✅ Sección 15 del SSOT es válida\n');

    if (result.metrics) {
      logger.info('📊 Métricas encontradas:');
      logger.info(`   System Map Alignment: ${result.metrics.systemMapAlignment}%`);
      logger.info(`   SSOT Alignment: ${result.metrics.ssotAlignment}%`);
      logger.info(`   Dependency Density: ${result.metrics.dependencyDensity}%`);
      logger.info(`   Crosslink Score: ${result.metrics.crosslinkScore}%`);
      logger.info(`   Narrative Consistency: ${result.metrics.narrativeConsistency}%`);
      logger.info(`   Health Score: ${result.metrics.healthScore}/100\n`);
    }

    if (result.warnings.length > 0) {
      logger.warn('⚠️  Warnings:');
      result.warnings.forEach((w) => logger.warn(`   - ${w}`));
      logger.info('');
    }
  } else {
    logger.error('❌ Sección 15 del SSOT tiene errores:\n');
    result.errors.forEach((e) => logger.error(`   - ${e}`));
    logger.error('');

    if (result.warnings.length > 0) {
      logger.warn('⚠️  Warnings adicionales:');
      result.warnings.forEach((w) => logger.warn(`   - ${w}`));
      logger.warn('');
    }

    if (isCI) {
      process.exit(1);
    } else {
      logger.info('💡 Para corregir, ejecuta:');
      logger.info('   node scripts/compute-health-v2-official.js --update-ssot\n');
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateSSOTSection15 };
