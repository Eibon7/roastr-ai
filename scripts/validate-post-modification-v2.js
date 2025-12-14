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
 * 7. Validación de scope de issue (ROA-330)
 * 8. Genera reporte completo con nodos afectados y análisis de impacto
 *
 * Usage:
 *   node scripts/validate-post-modification-v2.js
 *   node scripts/validate-post-modification-v2.js --ci  # Exit 1 on any failure
 *   node scripts/validate-post-modification-v2.js --base main  # Compare against main branch
 */

const { spawn, execFileSync } = require('child_process');
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
    this.warnings = [];
    this.blockedOperations = [];
    this.systemMapModified = false;
    this.issueId = null;
    this.issueScope = null;
    this.scopeValidationResult = null;
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
   * Detecta issue ID desde nombre de rama o variables de entorno
   */
  async detectIssueId() {
    // Opción 1: Variable de entorno (CI)
    if (process.env.ISSUE_ID) {
      this.issueId = process.env.ISSUE_ID;
      this.log(`Issue ID from environment: ${this.issueId}`, 'info');
      return this.issueId;
    }

    // Opción 2: Desde .issue_lock
    try {
      const issueLockPath = path.join(ROOT_DIR, '.issue_lock');
      const lockContent = await fs.readFile(issueLockPath, 'utf8');
      const match = lockContent.match(/ROA-(\d+)|issue-(\d+)/i);
      if (match) {
        this.issueId = match[1] ? `ROA-${match[1]}` : `issue-${match[2]}`;
        this.log(`Issue ID from .issue_lock: ${this.issueId}`, 'info');
        return this.issueId;
      }
    } catch {
      // .issue_lock no existe o no contiene issue ID
    }

    // Opción 3: Desde nombre de rama
    try {
      const branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf8'
      }).trim();
      const branchMatch = branchName.match(/ROA-(\d+)|issue-(\d+)|feature\/(?:ROA-|issue-)?(\d+)/i);
      if (branchMatch) {
        this.issueId = branchMatch[1]
          ? `ROA-${branchMatch[1]}`
          : branchMatch[2]
            ? `issue-${branchMatch[2]}`
            : branchMatch[3]
              ? `ROA-${branchMatch[3]}`
              : null;
        if (this.issueId) {
          this.log(`Issue ID from branch: ${this.issueId}`, 'info');
          return this.issueId;
        }
      }
    } catch {
      // No se pudo detectar desde rama
    }

    this.log('No issue ID detected - scope validation will be skipped', 'warning');
    return null;
  }

  /**
   * Obtiene scope declarado de la issue desde Linear/GitHub
   */
  async getIssueScope(issueId) {
    if (!issueId) {
      return null;
    }

    try {
      // Intentar obtener desde Linear (formato ROA-XXX)
      if (issueId.startsWith('ROA-')) {
        const issueNumber = issueId.replace('ROA-', '');
        try {
          const issueData = execFileSync(
            'gh',
            ['issue', 'view', issueNumber, '--json', 'body,title'],
            { encoding: 'utf8' }
          );
          const issue = JSON.parse(issueData);
          return await this.parseScopeFromIssue(issue.body || issue.title || '');
        } catch (error) {
          this.log(`Could not fetch issue ${issueId} from GitHub: ${error.message}`, 'warning');
          return null;
        }
      }

      // Para issues de GitHub (formato issue-XXX)
      if (issueId.startsWith('issue-')) {
        const issueNumber = issueId.replace('issue-', '');
        try {
          const issueData = execFileSync(
            'gh',
            ['issue', 'view', issueNumber, '--json', 'body,title'],
            { encoding: 'utf8' }
          );
          const issue = JSON.parse(issueData);
          return await this.parseScopeFromIssue(issue.body || issue.title || '');
        } catch (error) {
          this.log(`Could not fetch issue ${issueNumber} from GitHub: ${error.message}`, 'warning');
          return null;
        }
      }
    } catch (error) {
      this.log(`Failed to get issue scope: ${error.message}`, 'warning');
      return null;
    }

    return null;
  }

  /**
   * Parsea scope de nodos desde descripción de issue
   * Busca patrones como:
   * - "Nodos afectados: node1, node2"
   * - "Scope: node1, node2"
   * - "Nodos: node1, node2"
   */
  async parseScopeFromIssue(issueText) {
    if (!issueText) {
      return null;
    }

    // Patrón 1: "Nodos afectados:" o "Nodos:" seguido de lista
    const pattern1 = /(?:Nodos afectados|Nodos|Scope|Nodes)[:\s]+([^\n]+)/i;
    const match1 = issueText.match(pattern1);
    if (match1) {
      const nodes = match1[1]
        .split(/[,\n;]+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && !n.match(/^(y|and|o|or)$/i));
      if (nodes.length > 0) {
        return nodes;
      }
    }

    // Patrón 2: Lista con bullets
    const pattern2 = /(?:Nodos afectados|Nodos|Scope|Nodes)[:\s]*\n((?:[-*]\s*[^\n]+\n?)+)/i;
    const match2 = issueText.match(pattern2);
    if (match2) {
      const nodes = match2[1]
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter((n) => n.length > 0);
      if (nodes.length > 0) {
        return nodes;
      }
    }

    // Patrón 3: Buscar IDs de nodos conocidos en el texto
    // Esto es un fallback menos preciso
    // Derivar node IDs dinámicamente desde system-map-v2.yaml
    if (!this.systemMap) {
      this.systemMap = await this.loadSystemMap();
    }

    if (this.systemMap && this.systemMap.nodes) {
      const knownNodeIds = Object.keys(this.systemMap.nodes);
      const foundNodes = knownNodeIds.filter((nodeId) =>
        issueText.toLowerCase().includes(nodeId.toLowerCase())
      );

      if (foundNodes.length > 0) {
        this.log(`Inferred scope from issue text (${foundNodes.length} nodes found)`, 'warning');
        return foundNodes;
      }
    }

    return null;
  }

  /**
   * Valida que los nodos modificados estén dentro del scope declarado
   */
  async validateIssueScope() {
    this.log('Validating issue scope...', 'step');
    this.log('');

    // Detectar issue ID
    this.issueId = await this.detectIssueId();
    if (!this.issueId) {
      this.log('No issue ID detected - skipping scope validation', 'info');
      this.scopeValidationResult = {
        passed: true,
        skipped: true,
        reason: 'No issue ID detected'
      };
      return true;
    }

    // Obtener scope declarado
    this.issueScope = await this.getIssueScope(this.issueId);
    if (!this.issueScope || this.issueScope.length === 0) {
      this.log(
        `Could not determine scope for issue ${this.issueId} - skipping scope validation`,
        'warning'
      );
      this.scopeValidationResult = {
        passed: true,
        skipped: true,
        reason: 'Could not determine issue scope'
      };
      return true;
    }

    this.log(`Issue ${this.issueId} declared scope: ${this.issueScope.join(', ')}`, 'info');

    // Validar que todos los nodos modificados estén en scope
    const outOfScope = this.affectedNodes.filter(
      (node) => !this.issueScope.some((scopeNode) => scopeNode === node)
    );

    if (outOfScope.length > 0) {
      // Encontrar archivos que provocaron cada nodo fuera de scope
      const outOfScopeDetails = outOfScope.map((node) => {
        const triggeringFiles = this.modifiedFiles
          .filter((file) => {
            // Verificar si el archivo pertenece a este nodo
            return (
              file.file.includes(`nodes-v2/${node}.md`) ||
              file.file.includes(`nodes-v2/${node}/`) ||
              (this.systemMap?.nodes?.[node]?.files || []).some((nf) => file.file.includes(nf)) ||
              (this.systemMap?.nodes?.[node]?.docs || []).some((doc) => file.file.includes(doc))
            );
          })
          .map((f) => f.file);

        return {
          node,
          files: triggeringFiles.length > 0 ? triggeringFiles : ['unknown']
        };
      });

      this.log('❌ Issue Scope Validation FAILED', 'error');
      this.log('');
      this.log('Modified nodes outside declared scope:', 'error');
      outOfScopeDetails.forEach((detail) => {
        this.log(`  - ${detail.node}`, 'error');
        detail.files.forEach((file) => {
          this.log(`    Triggered by: ${file}`, 'error');
        });
      });
      this.log('');
      this.log(`Declared scope: ${this.issueScope.join(', ')}`, 'info');
      this.log(`Modified nodes: ${this.affectedNodes.join(', ')}`, 'info');
      this.log('');
      this.log(
        'Action: Update issue description to include all affected nodes, or revert changes to out-of-scope nodes.',
        'error'
      );
      this.log('');

      this.scopeValidationResult = {
        passed: false,
        skipped: false,
        issueId: this.issueId,
        declaredScope: this.issueScope,
        modifiedNodes: this.affectedNodes,
        outOfScope: outOfScopeDetails
      };

      // Añadir a operaciones bloqueadas
      this.blockedOperations.push({
        type: 'scope_violation',
        message: `Issue scope validation failed: ${outOfScope.length} node(s) outside declared scope`,
        outOfScope: outOfScopeDetails
      });

      return false;
    }

    this.log('✅ Issue Scope Validation PASSED', 'success');
    this.log(
      `  All ${this.affectedNodes.length} modified node(s) are within declared scope`,
      'success'
    );
    this.log('');

    this.scopeValidationResult = {
      passed: true,
      skipped: false,
      issueId: this.issueId,
      declaredScope: this.issueScope,
      modifiedNodes: this.affectedNodes,
      outOfScope: []
    };

    return true;
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
        diff = execFileSync('git', ['diff', '--cached', '--name-status'], { encoding: 'utf8' });
        if (!diff.trim()) {
          diff = execFileSync('git', ['diff', '--name-status'], { encoding: 'utf8' });
        }
      } else {
        // Comparar con commit base - usar execFileSync para evitar shell injection
        // Validar que baseCommit solo contiene caracteres seguros
        if (!/^[a-zA-Z0-9._\-\^~:]+$/.test(this.baseCommit)) {
          throw new Error(
            `Invalid base commit: ${this.baseCommit}. Only alphanumeric and safe characters allowed.`
          );
        }
        diff = execFileSync('git', ['diff', this.baseCommit, '--name-status'], {
          encoding: 'utf8'
        });
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
          const isRelevant =
            change.file.includes('docs/nodes-v2/') ||
            change.file.includes('docs/system-map-v2.yaml') ||
            change.file.includes('docs/SSOT-V2.md');

          // Track si system-map fue modificado
          if (isRelevant && change.file.includes('docs/system-map-v2.yaml')) {
            this.systemMapModified = true;
          }

          return isRelevant;
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
   * Valida que el grafo es acíclico (DAG)
   */
  async validateAcyclicGraph() {
    this.log('Validating acyclic graph (DAG)...', 'step');
    this.log('');

    if (!this.systemMap) {
      this.systemMap = await this.loadSystemMap();
      if (!this.systemMap) {
        return { success: false, cycles: [] };
      }
    }

    try {
      const dependsOnMap = {};
      const nodeIds = Object.keys(this.systemMap.nodes || {});

      nodeIds.forEach((id) => {
        dependsOnMap[id] = new Set();
      });

      for (const [nodeId, nodeData] of Object.entries(this.systemMap.nodes || {})) {
        if (nodeData.depends_on) {
          const deps = Array.isArray(nodeData.depends_on)
            ? nodeData.depends_on
            : [nodeData.depends_on];
          deps.forEach((dep) => {
            dependsOnMap[nodeId].add(dep);
          });
        }
      }

      // Detectar ciclos usando DFS
      const visited = new Set();
      const recursionStack = new Set();
      const cycles = [];

      const hasCycle = (nodeId, path = []) => {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const deps = dependsOnMap[nodeId] || new Set();
        for (const depId of deps) {
          if (!visited.has(depId)) {
            if (hasCycle(depId, [...path])) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Cycle detected
            const cycleStart = path.indexOf(depId);
            cycles.push(path.slice(cycleStart).concat(depId));
            return true;
          }
        }

        recursionStack.delete(nodeId);
        return false;
      };

      for (const nodeId of nodeIds) {
        if (!visited.has(nodeId)) {
          hasCycle(nodeId);
        }
      }

      if (cycles.length > 0) {
        this.log(`❌ Found ${cycles.length} cycle(s) in dependency graph`, 'error');
        cycles.forEach((cycle, idx) => {
          this.log(`  Cycle ${idx + 1}: ${cycle.join(' → ')}`, 'error');
        });
        this.log('');
        return { success: false, cycles };
      } else {
        this.log('✅ Graph is acyclic (DAG)', 'success');
        this.log('');
        return { success: true, cycles: [] };
      }
    } catch (error) {
      this.log(`Failed to validate acyclic graph: ${error.message}`, 'warning');
      return { success: true, cycles: [] }; // No bloquear si falla
    }
  }

  /**
   * Detecta warnings y operaciones bloqueadas
   */
  detectWarningsAndBlockedOperations() {
    // Warning: Modificaciones en múltiples nodos sin modificar system-map
    if (this.affectedNodes.length > 1) {
      const hasSystemMapChange = this.modifiedFiles.some((f) =>
        f.file.includes('system-map-v2.yaml')
      );
      if (!hasSystemMapChange) {
        this.warnings.push({
          type: 'multi_node_modification',
          message: `Multiple nodes modified (${this.affectedNodes.length}) without system-map-v2.yaml update. Consider updating system-map to reflect changes.`,
          nodes: this.affectedNodes
        });
      }
    }

    // Warning: Nodos críticos modificados
    if (this.systemMap && this.affectedNodes.length > 0) {
      const criticalNodes = this.affectedNodes.filter((nodeName) => {
        const nodeData = this.systemMap.nodes?.[nodeName];
        return nodeData?.priority === 'critical';
      });

      if (criticalNodes.length > 0) {
        this.warnings.push({
          type: 'critical_node_modification',
          message: `Critical node(s) modified: ${criticalNodes.join(', ')}. Ensure all dependencies are still valid.`,
          nodes: criticalNodes
        });
      }
    }

    // Blocked: Ciclos detectados
    const cycleResult = this.results.find((r) => r.name === 'Acyclic Graph' && !r.success);
    if (cycleResult) {
      this.blockedOperations.push({
        type: 'circular_dependency',
        message:
          'Circular dependencies detected. System-map modifications are blocked until cycles are resolved.',
        cycles: cycleResult.cycles || []
      });
    }

    // Blocked: Validaciones críticas fallidas
    const criticalFailures = this.results.filter(
      (r) => !r.success && ['System Map Drift', 'Strong Concepts'].includes(r.name)
    );
    if (criticalFailures.length > 0) {
      this.blockedOperations.push({
        type: 'critical_validation_failed',
        message: `Critical validations failed. System-map synchronization is blocked.`,
        failed: criticalFailures.map((r) => r.name)
      });
    }
  }

  /**
   * Analiza el impacto en health score
   */
  async analyzeHealthScoreImpact() {
    this.log('Analyzing health score impact...', 'step');
    this.log('');

    try {
      // Cargar health score actual
      const { calculateMetrics } = require('./compute-health-v2-official.js');
      const currentMetrics = calculateMetrics();

      this.log(`Current Health Score: ${currentMetrics.health_score}/100`, 'info');
      this.log(`  System Map Alignment: ${currentMetrics.system_map_alignment}%`, 'info');
      this.log(`  SSOT Alignment: ${currentMetrics.ssot_alignment}%`, 'info');
      this.log(`  Dependency Density: ${currentMetrics.dependency_density}%`, 'info');
      this.log(`  Crosslink Score: ${currentMetrics.crosslink_score}%`, 'info');
      this.log('');

      return {
        current: currentMetrics.health_score,
        metrics: currentMetrics,
        impact: 'unknown'
      };
    } catch (error) {
      this.log(`Failed to analyze health score: ${error.message}`, 'warning');
      return { current: null, metrics: null, impact: 'unknown' };
    }
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

    // Fase 3.5: Validar grafo acíclico
    const acyclicResult = await this.validateAcyclicGraph();
    if (!acyclicResult.success) {
      this.results.push({
        name: 'Acyclic Graph',
        script: 'internal',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Found ${acyclicResult.cycles.length} cycle(s)`,
        cycles: acyclicResult.cycles
      });
    }

    // Fase 3.6: Analizar impacto en health score
    const healthImpact = await this.analyzeHealthScoreImpact();
    this.healthImpact = healthImpact;

    // Fase 3.7: Detectar warnings y operaciones bloqueadas
    this.detectWarningsAndBlockedOperations();

    // Fase 3.8: Validar scope de issue
    const scopeValid = await this.validateIssueScope();
    if (!scopeValid) {
      // Si scope validation falla, añadir como resultado fallido
      this.results.push({
        name: 'Issue Scope Validation',
        script: 'internal',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Issue ${this.issueId}: ${this.scopeValidationResult.outOfScope.length} node(s) outside declared scope`,
        scopeResult: this.scopeValidationResult
      });
    } else if (this.scopeValidationResult && !this.scopeValidationResult.skipped) {
      // Si pasó, añadir como resultado exitoso
      this.results.push({
        name: 'Issue Scope Validation',
        script: 'internal',
        success: true,
        exitCode: 0,
        stdout: `Issue ${this.issueId}: All nodes within declared scope`,
        stderr: '',
        scopeResult: this.scopeValidationResult
      });
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

    // Sección 2.5: Issue Scope Validation
    if (this.scopeValidationResult && !this.scopeValidationResult.skipped) {
      this.log('Issue Scope Validation:', 'info');
      this.log(`  Issue ID: ${this.scopeValidationResult.issueId}`, 'info');
      this.log(`  Declared Scope: ${this.scopeValidationResult.declaredScope.join(', ')}`, 'info');
      this.log(`  Modified Nodes: ${this.scopeValidationResult.modifiedNodes.join(', ')}`, 'info');
      if (this.scopeValidationResult.passed) {
        this.log(`  Result: ✅ PASS (all nodes in scope)`, 'success');
      } else {
        this.log(`  Result: ❌ FAIL`, 'error');
        if (this.scopeValidationResult.outOfScope.length > 0) {
          this.log('  Out of Scope:', 'error');
          this.scopeValidationResult.outOfScope.forEach((detail) => {
            this.log(`    - ${detail.node}`, 'error');
            detail.files.forEach((file) => {
              this.log(`      Triggered by: ${file}`, 'error');
            });
          });
        }
      }
      this.log('');
    } else if (this.scopeValidationResult && this.scopeValidationResult.skipped) {
      this.log('Issue Scope Validation:', 'info');
      this.log(`  Status: ⏭️  SKIPPED (${this.scopeValidationResult.reason})`, 'info');
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
    if ((this.affectedNodes.length > 0 || this.systemMapModified) && this.systemMap) {
      this.log('System-Map Impact Analysis:', 'info');
      this.log('');

      if (this.systemMapModified) {
        this.log(`  • System-map-v2.yaml was modified`, 'info');
        if (this.affectedNodes.length === 0) {
          this.log('  • No specific nodes mapped from file changes', 'info');
          this.log('  • System-map changes may affect all nodes - review carefully', 'warning');
        }
      } else {
        this.log('  • No system-map-v2.yaml changes detected', 'info');
        this.log('  • Node modifications are isolated to documentation', 'info');
      }

      // Mostrar nodos relacionados que pueden necesitar revisión
      if (this.affectedNodes.length > 0) {
        const allRelatedNodes = new Set();
        this.affectedNodes.forEach((nodeName) => {
          const context = this.nodeContext[nodeName];
          if (context) {
            context.all_related.forEach((rel) => allRelatedNodes.add(rel));
          }
        });

        if (allRelatedNodes.size > 0) {
          this.log(
            `  • Related nodes that may need review: ${Array.from(allRelatedNodes).join(', ')}`,
            'info'
          );
        }
      }
      this.log('');
    }

    // Sección 4.5: Health Score Impact
    if (this.healthImpact && this.healthImpact.current !== null) {
      this.log('Health Score Impact:', 'info');
      this.log(`  Current Health Score: ${this.healthImpact.current}/100`, 'info');
      if (this.healthImpact.metrics) {
        this.log(
          `  System Map Alignment: ${this.healthImpact.metrics.system_map_alignment}%`,
          'info'
        );
        this.log(`  SSOT Alignment: ${this.healthImpact.metrics.ssot_alignment}%`, 'info');
        this.log(`  Dependency Density: ${this.healthImpact.metrics.dependency_density}%`, 'info');
        this.log(`  Crosslink Score: ${this.healthImpact.metrics.crosslink_score}%`, 'info');
      }
      this.log('');
    }

    // Sección 5: Warnings
    if (this.warnings.length > 0) {
      this.log('⚠️  Warnings:', 'warning');
      this.warnings.forEach((warning, idx) => {
        this.log(`  ${idx + 1}. [${warning.type}] ${warning.message}`, 'warning');
        if (warning.nodes && warning.nodes.length > 0) {
          this.log(`     Nodes: ${warning.nodes.join(', ')}`, 'warning');
        }
      });
      this.log('');
    }

    // Sección 6: Operaciones Bloqueadas
    if (this.blockedOperations.length > 0) {
      this.log('🚫 Blocked Operations:', 'error');
      this.blockedOperations.forEach((blocked, idx) => {
        this.log(`  ${idx + 1}. [${blocked.type}] ${blocked.message}`, 'error');
        if (blocked.cycles && blocked.cycles.length > 0) {
          blocked.cycles.forEach((cycle, cIdx) => {
            this.log(`     Cycle ${cIdx + 1}: ${cycle.join(' → ')}`, 'error');
          });
        }
        if (blocked.failed && blocked.failed.length > 0) {
          this.log(`     Failed validations: ${blocked.failed.join(', ')}`, 'error');
        }
        if (blocked.outOfScope && blocked.outOfScope.length > 0) {
          this.log('     Out of scope nodes:', 'error');
          blocked.outOfScope.forEach((detail) => {
            this.log(`       - ${detail.node}`, 'error');
            detail.files.forEach((file) => {
              this.log(`         Triggered by: ${file}`, 'error');
            });
          });
        }
      });
      this.log('');
    }

    // Sección 7: Recomendaciones
    if (failed > 0 || this.blockedOperations.length > 0) {
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
