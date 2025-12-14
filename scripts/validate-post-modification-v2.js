#!/usr/bin/env node

/**
 * GDD v2 Post-Modification Consistency Validator
 *
 * Ejecuta todas las validaciones necesarias después de modificar nodos v2
 * o system-map-v2.yaml para asegurar consistencia.
 *
 * Este script ejecuta en secuencia:
 * 1. Detección de archivos modificados y mapeo a nodos
 * 2. Carga de contexto de nodos (system-map, dependencias)
 * 3. validate-v2-doc-paths.js - Valida paths de documentación
 * 4. validate-ssot-health.js - Valida sección 15 del SSOT
 * 5. check-system-map-drift.js - Valida drift del system-map
 * 6. validate-strong-concepts.js - Valida Strong Concepts
 * 7. Genera reporte completo con nodos afectados y análisis de impacto
 *
 * Usage:
 *   node scripts/validate-post-modification-v2.js
 *   node scripts/validate-post-modification-v2.js --ci  # Exit 1 on any failure
 *   node scripts/validate-post-modification-v2.js --base main  # Compare against main branch
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const logger = require('../src/utils/logger');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');

// Lista de validaciones a ejecutar en orden
const VALIDATIONS = [
  {
    name: 'Documentation Paths',
    script: 'validate-v2-doc-paths.js',
    description: 'Validates that all doc paths in system-map-v2.yaml exist'
  },
  {
    name: 'SSOT Health',
    script: 'validate-ssot-health.js',
    description: 'Validates SSOT section 15 (GDD Health Score)'
  },
  {
    name: 'System Map Drift',
    script: 'check-system-map-drift.js',
    description: 'Validates consistency between system-map-v2.yaml and nodes-v2/'
  },
  {
    name: 'Strong Concepts',
    script: 'validate-strong-concepts.js',
    description: 'Validates Strong Concepts ownership and no duplicates'
  }
];

class PostModificationValidator {
  constructor(options = {}) {
    this.options = options;
    this.isCIMode = options.ci || false;
    this.baseCommit = options.base || 'HEAD';
    this.results = [];
    this.modifiedFiles = [];
    this.affectedNodes = [];
    this.nodeContext = {};
    this.systemMap = null;
  }

  log(message, type = 'info') {
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        step: '📊'
      }[type] || 'ℹ️';

    const formattedMessage = `${prefix} ${message}`;

    if (type === 'error') {
      logger.error(formattedMessage);
    } else if (type === 'warning') {
      logger.warn(formattedMessage);
    } else {
      logger.info(formattedMessage);
    }
  }

  /**
   * Detecta archivos modificados usando git diff
   */
  async detectModifiedFiles() {
    this.log('Detecting modified files...', 'step');
    this.log('');

    try {
      let diff = '';

      // Si baseCommit es HEAD, usar staged + unstaged changes
      if (this.baseCommit === 'HEAD') {
        diff = execSync('git diff --cached --name-status', { encoding: 'utf8' });
        if (!diff.trim()) {
          diff = execSync('git diff --name-status', { encoding: 'utf8' });
        }
      } else {
        // Comparar con commit base
        diff = execSync(`git diff ${this.baseCommit} --name-status`, { encoding: 'utf8' });
      }

      if (!diff.trim()) {
        this.log('No changes detected', 'info');
        return [];
      }

      const changes = diff
        .trim()
        .split('\n')
        .map((line) => {
          const [status, ...fileParts] = line.split('\t');
          const file = fileParts.join('\t');
          return { status, file };
        })
        .filter((change) => {
          // Filtrar solo archivos relevantes para v2
          return (
            change.file.includes('docs/nodes-v2/') ||
            change.file.includes('docs/system-map-v2.yaml') ||
            change.file.includes('docs/SSOT-V2.md')
          );
        });

      this.log(`Detected ${changes.length} modified file(s)`, 'info');
      changes.forEach((change) => {
        this.log(`  ${change.status} ${change.file}`, 'info');
      });
      this.log('');

      return changes;
    } catch (error) {
      this.log(`Failed to detect modified files: ${error.message}`, 'warning');
      return [];
    }
  }

  /**
   * Mapea archivos modificados a nodos
   * Soporta tanto archivos directos como subnodos en subdirectorios
   */
  async mapFilesToNodes(files) {
    this.log('Mapping files to affected nodes...', 'step');
    this.log('');

    if (files.length === 0) {
      this.log('No files to map', 'info');
      return [];
    }

    const affectedNodes = new Set();

    // Cargar system-map para mapeo preciso
    if (!this.systemMap) {
      this.systemMap = await this.loadSystemMap();
    }

    // Mapeo directo desde paths de archivos
    for (const fileChange of files) {
      const file = fileChange.file;

      // Caso 1: Archivo en docs/nodes-v2/<node-id>.md
      const directMatch = file.match(/docs\/nodes-v2\/([^/]+)\.md$/);
      if (directMatch) {
        affectedNodes.add(directMatch[1]);
        continue;
      }

      // Caso 2: Subnodo en docs/nodes-v2/<node-id>/<subnode>.md
      const subnodeMatch = file.match(/docs\/nodes-v2\/([^/]+)\/.+\.md$/);
      if (subnodeMatch) {
        affectedNodes.add(subnodeMatch[1]);
        continue;
      }

      // Caso 3: system-map-v2.yaml modificado
      if (file.includes('system-map-v2.yaml')) {
        // Si se modifica system-map, todos los nodos pueden estar afectados
        // Pero por ahora solo marcamos que system-map fue modificado
        // Los nodos específicos se detectarán por otros archivos modificados
        continue;
      }

      // Caso 4: Mapeo desde system-map usando files del nodo
      if (this.systemMap?.nodes) {
        for (const [nodeName, nodeData] of Object.entries(this.systemMap.nodes)) {
          const nodeFiles = nodeData.files || [];
          const nodeDocs = nodeData.docs || [];

          // Verificar si el archivo está en la lista de files del nodo
          if (nodeFiles.some((nf) => file.includes(nf) || nf.includes(file))) {
            affectedNodes.add(nodeName);
            break;
          }

          // Verificar si el archivo está en la lista de docs del nodo
          if (nodeDocs.some((doc) => file.includes(doc) || doc.includes(file))) {
            affectedNodes.add(nodeName);
            break;
          }
        }
      }
    }

    const nodesArray = Array.from(affectedNodes).sort();

    if (nodesArray.length > 0) {
      this.log(`Affected nodes: ${nodesArray.join(', ')}`, 'success');
    } else {
      this.log('No nodes affected (files may not be mapped to nodes)', 'warning');
    }
    this.log('');

    return nodesArray;
  }

  /**
   * Carga system-map-v2.yaml
   */
  async loadSystemMap() {
    try {
      const content = await fs.readFile(SYSTEM_MAP_V2_PATH, 'utf8');
      return yaml.parse(content);
    } catch (error) {
      this.log(`Failed to load system-map-v2.yaml: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Carga contexto de nodos (dependencias, relaciones)
   */
  async loadNodeContext(nodeNames) {
    this.log('Loading node context (dependencies, relationships)...', 'step');
    this.log('');

    if (!this.systemMap) {
      this.systemMap = await this.loadSystemMap();
      if (!this.systemMap) {
        return {};
      }
    }

    const context = {};

    for (const nodeName of nodeNames) {
      const nodeData = this.systemMap.nodes?.[nodeName];
      if (!nodeData) {
        this.log(`Warning: Node "${nodeName}" not found in system-map-v2.yaml`, 'warning');
        continue;
      }

      // Recopilar nodos relacionados
      const relatedNodes = new Set();
      if (nodeData.depends_on) {
        nodeData.depends_on.forEach((dep) => relatedNodes.add(dep));
      }
      if (nodeData.required_by) {
        nodeData.required_by.forEach((req) => relatedNodes.add(req));
      }
      if (nodeData.related) {
        nodeData.related.forEach((rel) => relatedNodes.add(rel));
      }

      context[nodeName] = {
        node: nodeData,
        depends_on: nodeData.depends_on || [],
        required_by: nodeData.required_by || [],
        related: nodeData.related || [],
        all_related: Array.from(relatedNodes),
        docs: nodeData.docs || [],
        files: nodeData.files || [],
        workers: nodeData.workers || [],
        ssot_references: nodeData.ssot_references || []
      };
    }

    if (Object.keys(context).length > 0) {
      this.log(`Loaded context for ${Object.keys(context).length} node(s)`, 'success');
      this.log('');
    }

    return context;
  }

  /**
   * Ejecuta un script de validación y captura su resultado
   */
  async runValidation(validation) {
    return new Promise((resolve) => {
      const scriptPath = path.join(SCRIPTS_DIR, validation.script);
      const args = this.isCIMode ? ['--ci'] : [];

      this.log(`Running: ${validation.name}...`, 'info');
      this.log(`  ${validation.description}`, 'info');

      const child = spawn('node', [scriptPath, ...args], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const success = code === 0;
        const result = {
          name: validation.name,
          script: validation.script,
          success,
          exitCode: code,
          stdout,
          stderr
        };

        if (success) {
          this.log(`✅ ${validation.name} passed`, 'success');
        } else {
          this.log(`❌ ${validation.name} failed (exit code: ${code})`, 'error');
          if (stderr) {
            logger.error(`  Error output: ${stderr.trim()}`);
          }
        }

        this.log(''); // Línea en blanco para separar
        resolve(result);
      });

      child.on('error', (error) => {
        const result = {
          name: validation.name,
          script: validation.script,
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: error.message,
          error: error.message
        };

        this.log(`❌ ${validation.name} failed to execute: ${error.message}`, 'error');
        this.log('');
        resolve(result);
      });
    });
  }

  /**
   * Ejecuta todas las validaciones en secuencia
   */
  async validate() {
    this.log('🔍 GDD v2 Post-Modification Consistency Validation', 'step');
    this.log('');

    // Fase 1: Detectar archivos modificados
    this.modifiedFiles = await this.detectModifiedFiles();

    // Fase 2: Mapear archivos a nodos
    if (this.modifiedFiles.length > 0) {
      this.affectedNodes = await this.mapFilesToNodes(this.modifiedFiles);
    }

    // Fase 3: Cargar contexto de nodos
    if (this.affectedNodes.length > 0) {
      this.nodeContext = await this.loadNodeContext(this.affectedNodes);
    }

    // Fase 4: Ejecutar validaciones
    this.log('Running all validations to ensure consistency after modifications...', 'info');
    this.log('');

    for (const validation of VALIDATIONS) {
      const result = await this.runValidation(validation);
      this.results.push(result);
    }

    // Fase 5: Generar resumen completo
    this.printSummary();

    // Determinar si todas pasaron
    const allPassed = this.results.every((r) => r.success);

    return allPassed;
  }

  /**
   * Imprime resumen completo de resultados
   */
  printSummary() {
    this.log('');
    this.log('📊 Post-Modification Consistency Report', 'step');
    this.log('');

    // Sección 1: Archivos modificados
    if (this.modifiedFiles.length > 0) {
      this.log('Modified Files:', 'info');
      this.modifiedFiles.forEach((change) => {
        this.log(`  ${change.status} ${change.file}`, 'info');
      });
      this.log('');
    }

    // Sección 2: Nodos afectados
    if (this.affectedNodes.length > 0) {
      this.log('Affected Nodes:', 'info');
      this.affectedNodes.forEach((nodeName) => {
        const context = this.nodeContext[nodeName];
        if (context) {
          this.log(`  • ${nodeName}`, 'info');
          if (context.depends_on.length > 0) {
            this.log(`    Depends on: ${context.depends_on.join(', ')}`, 'info');
          }
          if (context.required_by.length > 0) {
            this.log(`    Required by: ${context.required_by.join(', ')}`, 'info');
          }
          if (context.all_related.length > 0) {
            this.log(`    Related nodes: ${context.all_related.join(', ')}`, 'info');
          }
        } else {
          this.log(`  • ${nodeName}`, 'info');
        }
      });
      this.log('');
    }

    // Sección 3: Resumen de validaciones
    this.log('Validation Results:', 'info');
    this.log('');

    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    // Resumen numérico
    this.log(`Total validations: ${total}`, 'info');
    this.log(`✅ Passed: ${passed}`, passed > 0 ? 'success' : 'info');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log('');

    // Detalles de validaciones fallidas
    if (failed > 0) {
      this.log('Failed validations:', 'error');
      this.results
        .filter((r) => !r.success)
        .forEach((result, index) => {
          this.log(`  ${index + 1}. ${result.name} (${result.script})`, 'error');
          if (result.error) {
            this.log(`     Error: ${result.error}`, 'error');
          }
          if (result.stderr && result.stderr.trim()) {
            const errorLines = result.stderr.trim().split('\n').slice(0, 3);
            errorLines.forEach((line) => {
              this.log(`     ${line}`, 'error');
            });
            if (result.stderr.split('\n').length > 3) {
              this.log(`     ... (${result.stderr.split('\n').length - 3} more lines)`, 'error');
            }
          }
        });
      this.log('');
    }

    // Sección 4: Impacto en system-map
    if (this.affectedNodes.length > 0 && this.systemMap) {
      this.log('System-Map Impact Analysis:', 'info');
      this.log('');

      let hasSystemMapChanges = false;
      for (const nodeName of this.affectedNodes) {
        const fileChange = this.modifiedFiles.find((f) =>
          f.file.includes('system-map-v2.yaml')
        );
        if (fileChange) {
          hasSystemMapChanges = true;
          this.log(`  • System-map-v2.yaml was modified`, 'info');
          break;
        }
      }

      if (!hasSystemMapChanges) {
        this.log('  • No system-map-v2.yaml changes detected', 'info');
        this.log('  • Node modifications are isolated to documentation', 'info');
      }
      this.log('');
    }

    // Sección 5: Recomendaciones
    if (failed > 0) {
      this.log('Recommendations:', 'info');
      this.log('  1. Review the error messages above', 'info');
      this.log('  2. Fix the issues in the relevant files', 'info');
      this.log('  3. Re-run this script to verify fixes', 'info');
      if (this.affectedNodes.length > 0) {
        this.log('  4. Verify related nodes are still consistent', 'info');
        this.log(
          `     Related nodes: ${this.affectedNodes
            .flatMap((n) => this.nodeContext[n]?.all_related || [])
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(', ')}`,
          'info'
        );
      }
      this.log('');
    }

    // Estado final
    if (failed === 0) {
      this.log('✅ All validations passed! System is consistent.', 'success');
      if (this.affectedNodes.length > 0) {
        this.log(`✅ ${this.affectedNodes.length} node(s) validated successfully`, 'success');
      }
    } else {
      this.log(
        `❌ ${failed} validation(s) failed. Please fix the issues before proceeding.`,
        'error'
      );
    }

    this.log('');
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const isCI = args.includes('--ci');
  const baseIndex = args.indexOf('--base');
  const baseCommit = baseIndex >= 0 && args[baseIndex + 1] ? args[baseIndex + 1] : 'HEAD';

  const validator = new PostModificationValidator({ ci: isCI, base: baseCommit });

  validator
    .validate()
    .then((allPassed) => {
      if (isCI && !allPassed) {
        process.exit(1);
      } else if (!allPassed) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((error) => {
      logger.error(`Fatal error: ${error.message}`);
      logger.error(error.stack);
      process.exit(1);
    });
}

module.exports = { PostModificationValidator };
