#!/usr/bin/env node

/**
 * Script de migración para añadir frontmatter YAML v2 a nodos v2
 * 
 * Este script:
 * 1. Lee system-map-v2.yaml para obtener metadata de cada nodo
 * 2. Mapea cada archivo de nodo v2 a su ID en system-map-v2.yaml
 * 3. Genera frontmatter YAML con la metadata
 * 4. Inserta el frontmatter al inicio del archivo (después del título)
 * 
 * Usage:
 *   node scripts/migrate-nodes-v2-frontmatter.js [--dry-run] [--backup]
 * 
 * Options:
 *   --dry-run: Muestra qué se haría sin modificar archivos
 *   --backup: Crea backups antes de modificar
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

const ROOT_DIR = path.join(__dirname, '..');
const SYSTEM_MAP_PATH = path.join(ROOT_DIR, 'docs', 'system-map-v2.yaml');
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs', 'nodes-v2');

class FrontmatterMigrator {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.backup = options.backup || false;
    this.systemMap = null;
    this.nodeIdToFileMap = new Map(); // node_id -> file path
    this.fileToNodeIdMap = new Map(); // file path -> node_id
  }

  /**
   * Cargar system-map-v2.yaml
   */
  async loadSystemMap() {
    console.log('📖 Cargando system-map-v2.yaml...');
    const content = await fs.readFile(SYSTEM_MAP_PATH, 'utf-8');
    this.systemMap = yaml.parse(content);
    
    // Crear mapeo: node_id -> file path
    for (const [nodeId, nodeData] of Object.entries(this.systemMap.nodes || {})) {
      if (nodeData.docs && Array.isArray(nodeData.docs)) {
        for (const docPath of nodeData.docs) {
          // Normalizar path: docs/nodes-v2/06-motor-roasting.md -> 06-motor-roasting.md
          const fileName = path.basename(docPath);
          const fullPath = path.join(NODES_V2_DIR, fileName);
          this.nodeIdToFileMap.set(nodeId, fullPath);
          this.fileToNodeIdMap.set(fullPath, nodeId);
        }
      }
    }
    
    console.log(`✅ Cargados ${this.nodeIdToFileMap.size} nodos del system-map`);
  }

  /**
   * Generar frontmatter YAML desde metadata del nodo
   */
  generateFrontmatter(nodeId, nodeData) {
    const frontmatter = {
      version: '2.0',
      node_id: nodeId,
      status: nodeData.status || 'production',
      priority: nodeData.priority || 'medium',
      owner: nodeData.owner || 'Back-end Dev',
      last_updated: nodeData.last_updated 
        ? new Date(nodeData.last_updated).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      coverage: nodeData.coverage || 0,
      coverage_source: 'auto'
    };

    // Añadir depends_on si existe
    if (nodeData.depends_on && nodeData.depends_on.length > 0) {
      frontmatter.depends_on = nodeData.depends_on;
    }

    // Añadir required_by si existe
    if (nodeData.required_by && nodeData.required_by.length > 0) {
      frontmatter.required_by = nodeData.required_by;
    }

    // Añadir workers si existe
    if (nodeData.workers && nodeData.workers.length > 0) {
      frontmatter.workers = nodeData.workers;
    }

    // Añadir ssot_references si existe
    if (nodeData.ssot_references && nodeData.ssot_references.length > 0) {
      frontmatter.ssot_references = nodeData.ssot_references;
    }

    // Añadir subnodes si existe
    if (nodeData.subnodes && nodeData.subnodes.length > 0) {
      frontmatter.subnodes = nodeData.subnodes;
    }

    // Convertir a YAML
    const yamlContent = yaml.stringify(frontmatter, {
      lineWidth: 0,
      indent: 2,
      sortKeys: false
    });

    return `---\n${yamlContent}---`;
  }

  /**
   * Verificar si el archivo ya tiene frontmatter YAML
   */
  hasFrontmatter(content) {
    return /^---\n[\s\S]*?\n---/.test(content);
  }

  /**
   * Extraer título del archivo
   */
  extractTitle(content) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1] : null;
  }

  /**
   * Insertar frontmatter después del título
   */
  insertFrontmatter(content, frontmatter) {
    const lines = content.split('\n');
    let titleIndex = -1;

    // Buscar título (# al inicio)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^#\s+/)) {
        titleIndex = i;
        break;
      }
    }

    if (titleIndex === -1) {
      throw new Error('No se encontró título en el archivo');
    }

    // Insertar frontmatter después del título y una línea en blanco
    const newLines = [
      ...lines.slice(0, titleIndex + 1),
      '',
      frontmatter,
      '',
      ...lines.slice(titleIndex + 1)
    ];

    return newLines.join('\n');
  }

  /**
   * Procesar un archivo de nodo
   */
  async processNodeFile(filePath) {
    const fileName = path.basename(filePath);
    const nodeId = this.fileToNodeIdMap.get(filePath);

    if (!nodeId) {
      console.warn(`⚠️  No se encontró node_id para ${fileName}, saltando...`);
      return null;
    }

    const nodeData = this.systemMap.nodes[nodeId];
    if (!nodeData) {
      console.warn(`⚠️  No se encontró metadata para ${nodeId}, saltando...`);
      return null;
    }

    console.log(`\n📝 Procesando: ${fileName} (${nodeId})`);

    // Leer archivo
    const content = await fs.readFile(filePath, 'utf-8');

    // Verificar si ya tiene frontmatter
    if (this.hasFrontmatter(content)) {
      console.log(`   ⚠️  Ya tiene frontmatter YAML, saltando...`);
      return null;
    }

    // Generar frontmatter
    const frontmatter = this.generateFrontmatter(nodeId, nodeData);

    // Crear backup si se solicita
    if (this.backup && !this.dryRun) {
      const backupPath = `${filePath}.backup-${Date.now()}`;
      await fs.writeFile(backupPath, content);
      console.log(`   💾 Backup creado: ${path.basename(backupPath)}`);
    }

    // Insertar frontmatter
    const newContent = this.insertFrontmatter(content, frontmatter);

    if (this.dryRun) {
      console.log(`   🔍 DRY RUN: Se añadiría frontmatter:`);
      console.log(`   ${frontmatter.split('\n').slice(0, 5).join('\n   ')}...`);
      return { filePath, nodeId, frontmatter, newContent };
    } else {
      // Escribir archivo
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log(`   ✅ Frontmatter añadido`);
      return { filePath, nodeId, frontmatter };
    }
  }

  /**
   * Procesar todos los archivos de nodos v2
   */
  async migrate() {
    console.log('🚀 Iniciando migración de frontmatter YAML v2\n');

    if (this.dryRun) {
      console.log('🔍 MODO DRY RUN - No se modificarán archivos\n');
    }

    // Cargar system-map
    await this.loadSystemMap();

    // Listar archivos en nodes-v2
    const files = await fs.readdir(NODES_V2_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    console.log(`\n📁 Encontrados ${mdFiles.length} archivos .md en nodes-v2\n`);

    const results = [];
    for (const fileName of mdFiles) {
      const filePath = path.join(NODES_V2_DIR, fileName);
      const result = await this.processNodeFile(filePath);
      if (result) {
        results.push(result);
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen de Migración');
    console.log('='.repeat(60));
    console.log(`✅ Archivos procesados: ${results.length}`);
    console.log(`📁 Total archivos: ${mdFiles.length}`);
    console.log(`⏭️  Saltados: ${mdFiles.length - results.length}`);

    if (this.dryRun) {
      console.log('\n🔍 DRY RUN completado. Ejecuta sin --dry-run para aplicar cambios.');
    } else {
      console.log('\n✅ Migración completada');
    }

    return results;
  }
}

// Ejecutar
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    backup: args.includes('--backup')
  };

  const migrator = new FrontmatterMigrator(options);
  migrator.migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = FrontmatterMigrator;
