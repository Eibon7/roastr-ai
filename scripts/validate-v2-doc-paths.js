#!/usr/bin/env node
/**
 * GDD v2 Doc Paths Validator
 *
 * Valida que todos los paths declarados en system-map-v2.yaml (campo docs:)
 * existen realmente en el filesystem.
 *
 * Usage:
 *   node scripts/validate-v2-doc-paths.js
 *   node scripts/validate-v2-doc-paths.js --ci  # Exit 1 on failure
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');

function loadSystemMapV2() {
  try {
    const content = fs.readFileSync(SYSTEM_MAP_V2_PATH, 'utf8');
    return yaml.load(content);
  } catch (e) {
    throw new Error(`Error loading system-map-v2.yaml: ${e.message}`);
  }
}

function validateDocPaths() {
  const systemMap = loadSystemMapV2();
  const nodes = systemMap.nodes || {};
  const nodeNames = Object.keys(nodes);

  let totalPaths = 0;
  let missingPaths = 0;
  const missingDetails = [];

  nodeNames.forEach((nodeName) => {
    const nodeData = nodes[nodeName];
    const docs = nodeData?.docs || [];

    if (docs.length === 0) {
      missingPaths++;
      missingDetails.push({
        node: nodeName,
        path: 'NO ESPECIFICADO',
        reason: 'Campo docs: vacío o no existe'
      });
      return;
    }

    docs.forEach((docPath) => {
      totalPaths++;
      const fullPath = path.isAbsolute(docPath) ? docPath : path.join(ROOT_DIR, docPath);

      if (!fs.existsSync(fullPath)) {
        missingPaths++;
        missingDetails.push({
          node: nodeName,
          path: docPath,
          fullPath: fullPath,
          reason: 'Archivo no existe'
        });
      }
    });
  });

  // Report results
  logger.info(`\n📋 Validación de paths v2:`);
  logger.info(`   Total paths declarados: ${totalPaths}`);
  logger.info(`   Paths existentes: ${totalPaths - missingPaths}`);
  logger.info(`   Paths faltantes: ${missingPaths}`);

  if (missingDetails.length > 0) {
    logger.warn(`\n⚠️  Paths faltantes:`);
    missingDetails.forEach((detail) => {
      logger.warn(`   - ${detail.node}: ${detail.path}`);
      if (detail.fullPath) {
        logger.warn(`     Full path: ${detail.fullPath}`);
      }
      logger.warn(`     Razón: ${detail.reason}`);
    });
  }

  const isValid = missingPaths === 0;

  if (isValid) {
    logger.info(`\n✅ Todos los paths declarados existen`);
  } else {
    logger.error(`\n❌ ${missingPaths} path(s) faltante(s)`);
  }

  return { isValid, missingPaths, missingDetails, totalPaths };
}

function main() {
  const isCI = process.argv.includes('--ci');
  const result = validateDocPaths();

  if (!result.isValid && isCI) {
    process.exit(1);
  } else if (!result.isValid) {
    process.exit(0); // Warning only in local mode
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateDocPaths, loadSystemMapV2 };
