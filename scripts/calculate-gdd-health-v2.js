#!/usr/bin/env node
/**
 * GDD Health Check v2 - Reader (SSOT-Driven)
 *
 * Este script NO calcula métricas. Solo lee las métricas oficiales desde docs/SSOT-V2.md
 * (Sección 15: GDD Health Score).
 *
 * El SSOT es la única fuente de verdad.
 * Para calcular/actualizar métricas, usar: node scripts/compute-health-v2-official.js --update-ssot
 *
 * Reglas:
 * - NO calcula nada
 * - NO infiere valores
 * - Solo lee del SSOT
 * - Si el SSOT no tiene la sección 15 → falla
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs/SSOT-V2.md');
const OUTPUT_JSON = path.join(ROOT_DIR, 'gdd-health-v2.json');
const OUTPUT_REPORT = path.join(ROOT_DIR, 'docs/GDD-V2-HEALTH-REPORT.md');

// Parse command line arguments
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

// Wrapper function to silence logs in JSON mode
function log(...msg) {
  if (!jsonMode) {
    logger.info(...msg);
  }
}

function logWarn(...msg) {
  if (!jsonMode) {
    logger.warn(...msg);
  }
}

function logError(...msg) {
  if (!jsonMode) {
    logger.error(...msg);
  }
}

function readMetricsFromSSOT() {
  let ssotContent;
  try {
    ssotContent = fs.readFileSync(SSOT_V2_PATH, 'utf8');
  } catch (e) {
    throw new Error(`SSOT-V2.md no encontrado en: ${SSOT_V2_PATH}`);
  }

  // Buscar sección 15 - usar índice de string para encontrar desde "## 15" hasta el siguiente "##" o fin de archivo
  const section15Start = ssotContent.indexOf('## 15. GDD Health Score');
  if (section15Start === -1) {
    throw new Error(
      'Sección 15 "GDD Health Score" no encontrada en SSOT-V2.md. Ejecuta: node scripts/compute-health-v2-official.js --update-ssot'
    );
  }

  // Encontrar el final de la sección (siguiente "##" o fin de archivo)
  const remainingContent = ssotContent.substring(section15Start);
  const nextSectionMatch = remainingContent.match(/\n## /);
  const section15End = nextSectionMatch
    ? section15Start + nextSectionMatch.index
    : ssotContent.length;
  const section15 = ssotContent.substring(section15Start, section15End);

  // Extraer métricas de la tabla
  const metrics = {};

  // Extraer métricas de la tabla - formato: | **Metric** | value% | description |
  // Usar un patrón más flexible que capture cualquier formato de tabla markdown

  // System Map Alignment
  const systemMapLine = section15.match(/\|\s*\*\*System Map Alignment\*\*\s*\|\s*(\d+\.?\d*)%/);
  if (systemMapLine) {
    metrics.system_map_alignment_score = parseFloat(systemMapLine[1]);
  } else {
    throw new Error('No se pudo extraer System Map Alignment del SSOT');
  }

  // SSOT Alignment
  const ssotLine = section15.match(/\|\s*\*\*SSOT Alignment\*\*\s*\|\s*(\d+\.?\d*)%/);
  if (ssotLine) {
    metrics.ssot_alignment_score = parseFloat(ssotLine[1]);
  } else {
    throw new Error('No se pudo extraer SSOT Alignment del SSOT');
  }

  // Dependency Density
  const dependencyLine = section15.match(/\|\s*\*\*Dependency Density\*\*\s*\|\s*(\d+\.?\d*)%/);
  if (dependencyLine) {
    metrics.dependency_density_score = parseFloat(dependencyLine[1]);
  } else {
    throw new Error('No se pudo extraer Dependency Density del SSOT');
  }

  // Crosslink Score
  const crosslinkLine = section15.match(/\|\s*\*\*Crosslink Score\*\*\s*\|\s*(\d+\.?\d*)%/);
  if (crosslinkLine) {
    metrics.crosslink_score = parseFloat(crosslinkLine[1]);
  } else {
    throw new Error('No se pudo extraer Crosslink Score del SSOT');
  }

  // Narrative Consistency
  const narrativeLine = section15.match(/\|\s*\*\*Narrative Consistency\*\*\s*\|\s*(\d+\.?\d*)%/);
  if (narrativeLine) {
    metrics.narrative_consistency_score = parseFloat(narrativeLine[1]);
  } else {
    throw new Error('No se pudo extraer Narrative Consistency del SSOT');
  }

  // Health Score Final - formato: | **Health Score Final** | **77.33/100** |
  const healthLine = section15.match(
    /\|\s*\*\*Health Score Final\*\*\s*\|\s*\*\*(\d+\.?\d*)\/100\*\*/
  );
  if (healthLine) {
    metrics.health_score = parseFloat(healthLine[1]);
  } else {
    throw new Error('No se pudo extraer Health Score Final del SSOT');
  }

  // Detalles adicionales
  const nodesDetectedMatch = section15.match(/\*\*Nodos detectados:\*\* (\d+) de (\d+)/);
  if (nodesDetectedMatch) {
    metrics.nodes_detected = parseInt(nodesDetectedMatch[1], 10);
    metrics.nodes_total = parseInt(nodesDetectedMatch[2], 10);
    metrics.nodes_missing = metrics.nodes_total - metrics.nodes_detected;
  }

  const timestampMatch = section15.match(/\*\*Última actualización:\*\* (.+)/);
  if (timestampMatch) {
    metrics.timestamp = timestampMatch[1].trim();
  }

  // Valores por defecto para compatibilidad
  metrics.version = '2.0';
  metrics.orphan_nodes = [];
  metrics.unused_nodes_in_system_map = [];
  metrics.unused_system_map_entries = [];
  metrics.warnings = [];
  metrics.errors = [];

  if (metrics.nodes_missing > 0) {
    metrics.warnings.push(
      `${metrics.nodes_missing} nodos definidos en system-map-v2.yaml no tienen documentación en docs/nodes-v2/`
    );
  }

  if (metrics.ssot_alignment_score < 100) {
    metrics.warnings.push(
      `Alineación SSOT incompleta: ${metrics.ssot_alignment_score.toFixed(1)}%`
    );
  }

  return metrics;
}

function generateReport(metrics) {
  const report = `# GDD v2 Health Report

**Fecha:** ${metrics.timestamp || new Date().toISOString()}  
**Versión:** 2.0  
**Health Score:** ${metrics.health_score}/100  
**Estado:** ${metrics.health_score >= 80 ? '🟢 HEALTHY' : metrics.health_score >= 50 ? '🟡 DEGRADED' : '🔴 CRITICAL'}

---

## 📊 Resumen Ejecutivo

Este reporte refleja las métricas oficiales leídas desde **docs/SSOT-V2.md (Sección 15)**.

**El SSOT es la única fuente de verdad.**  
Este script NO calcula métricas, solo las lee del SSOT.

Para actualizar métricas, ejecutar:
\`\`\`bash
node scripts/compute-health-v2-official.js --update-ssot
\`\`\`

---

## 📈 Puntuaciones Detalladas

| Métrica                   | Puntuación  | Peso | Contribución | Estado       |
| ------------------------- | ----------- | ---- | ------------ | ------------ |
| **System Map Alignment**  | ${metrics.system_map_alignment_score}%      | 30%  | ${(metrics.system_map_alignment_score * 0.3).toFixed(2)}        | ${metrics.system_map_alignment_score >= 90 ? '🟢' : metrics.system_map_alignment_score >= 70 ? '🟡' : '🔴'} |
| **Dependency Density**    | ${metrics.dependency_density_score}%      | 20%  | ${(metrics.dependency_density_score * 0.2).toFixed(2)}        | ${metrics.dependency_density_score >= 80 ? '🟢' : metrics.dependency_density_score >= 50 ? '🟡' : '🔴'} |
| **Crosslink Score**       | ${metrics.crosslink_score}%      | 20%  | ${(metrics.crosslink_score * 0.2).toFixed(2)}         | ${metrics.crosslink_score >= 80 ? '🟢' : metrics.crosslink_score >= 50 ? '🟡' : '🔴'} |
| **SSOT Alignment**        | ${metrics.ssot_alignment_score}%      | 20%  | ${(metrics.ssot_alignment_score * 0.2).toFixed(2)}        | ${metrics.ssot_alignment_score >= 80 ? '🟢' : metrics.ssot_alignment_score >= 50 ? '🟡' : '🔴'} |
| **Narrative Consistency** | ${metrics.narrative_consistency_score}%     | 10%  | ${(metrics.narrative_consistency_score * 0.1).toFixed(2)}        | ✅ Placeholder   |
| **HEALTH SCORE FINAL**    | **${metrics.health_score}/100** | -    | -            | ${metrics.health_score >= 80 ? '🟢 HEALTHY' : metrics.health_score >= 50 ? '🟡 DEGRADED' : '🔴 CRITICAL'} |

**Cálculo:** (${metrics.system_map_alignment_score} × 0.30) + (${metrics.dependency_density_score} × 0.20) + (${metrics.crosslink_score} × 0.20) + (${metrics.ssot_alignment_score} × 0.20) + (${metrics.narrative_consistency_score} × 0.10) = ${metrics.health_score}

---

## 🔍 Detalles

- **Nodos detectados:** ${metrics.nodes_detected || 'N/A'} de ${metrics.nodes_total || 'N/A'}
- **Nodos faltantes:** ${metrics.nodes_missing || 'N/A'}
- **Última actualización:** ${metrics.timestamp || 'N/A'}

---

## ⚠️ Warnings

${metrics.warnings.length > 0 ? metrics.warnings.map((w) => `- ${w}`).join('\n') : 'Ninguno'}

---

## 📝 Notas Técnicas

- **Script usado:** \`scripts/calculate-gdd-health-v2.js\` (solo lectura)
- **Fuente de datos:** \`docs/SSOT-V2.md\` (Sección 15)
- **Valores:** Leídos directamente del SSOT, sin cálculo
- **Para actualizar:** Ejecutar \`node scripts/compute-health-v2-official.js --update-ssot\`

---

**Generated by:** GDD Health Check v2 Reader (SSOT-Driven)  
**Last Updated:** ${metrics.timestamp || new Date().toISOString()}
`;

  return report;
}

function main() {
  try {
    log('📖 Leyendo métricas oficiales desde SSOT-V2.md (Sección 15)...\n');

    const metrics = readMetricsFromSSOT();

    // Add overall_score and status for compatibility with CI
    const outputMetrics = {
      ...metrics,
      overall_score: metrics.health_score,
      status: metrics.health_score >= 95 ? 'healthy' : metrics.health_score >= 80 ? 'warning' : 'critical'
    };

    // In JSON mode, output ONLY JSON and exit
    if (jsonMode) {
      console.log(JSON.stringify(outputMetrics, null, 2));
      return;
    }

    // Guardar JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outputMetrics, null, 2), 'utf8');
    log('✅ gdd-health-v2.json generado (valores desde SSOT)');

    // Generar reporte Markdown
    const report = generateReport(metrics);
    fs.writeFileSync(OUTPUT_REPORT, report, 'utf8');
    log('✅ docs/GDD-V2-HEALTH-REPORT.md generado (valores desde SSOT)\n');

    log('📊 Métricas Leídas del SSOT:');
    log(`   Health Score: ${metrics.health_score}/100`);
    log(`   Nodos detectados: ${metrics.nodes_detected || 'N/A'}`);
    log(`   Nodos faltantes: ${metrics.nodes_missing || 'N/A'}`);
    log(`   System Map Alignment: ${metrics.system_map_alignment_score}%`);
    log(`   SSOT Alignment: ${metrics.ssot_alignment_score}%`);
    log(`   Dependency Density: ${metrics.dependency_density_score}%`);
    log(`   Crosslink Score: ${metrics.crosslink_score}%`);

    if (metrics.warnings.length > 0) {
      logWarn('\n⚠️  Warnings:');
      metrics.warnings.forEach((w) => logWarn(`   - ${w}`));
    }

    log('\nℹ️  Para actualizar métricas, ejecutar:');
    log('   node scripts/compute-health-v2-official.js --update-ssot\n');
  } catch (error) {
    if (jsonMode) {
      // In JSON mode, output error as JSON
      console.log(JSON.stringify({
        error: error.message,
        overall_score: 0,
        status: 'error'
      }, null, 2));
      process.exit(1);
    } else {
      logError('❌ Error:', error.message);
      logError('\n💡 Solución: Ejecuta primero:');
      logError('   node scripts/compute-health-v2-official.js --update-ssot\n');
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { readMetricsFromSSOT, generateReport };
