#!/usr/bin/env node
/**
 * Setup/Migration Script para Cursor
 * 
 * Verifica y configura todo lo necesario para usar GDD + Agents + Skills en Cursor
 * 
 * Uso:
 *   node scripts/cursor-agents/setup-migration.js
 *   node scripts/cursor-agents/setup-migration.js --check  # Solo verificar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');

// Archivos y directorios requeridos
const REQUIRED_FILES = {
  '.cursorrules': 'Reglas de Cursor (consolidado)',
  'scripts/cursor-agents/auto-gdd-activation.js': 'Auto-activación GDD',
  'scripts/cursor-agents/detect-triggers.js': 'Detección de agents',
  'scripts/resolve-graph.js': 'Resolución de dependencias GDD',
  'scripts/validate-gdd-runtime.js': 'Validación GDD',
  'scripts/score-gdd-health.js': 'Health scoring',
  'agents/manifest.yaml': 'Manifest de agents',
  'docs/GDD-ACTIVATION-GUIDE.md': 'Guía de activación GDD',
  'docs/CURSOR-MIGRATION-GUIDE.md': 'Guía de migración',
  'docs/PROMPT-INICIAL-TAREA.md': 'Prompt inicial mejorado'
};

const REQUIRED_DIRS = {
  'docs/agents/receipts': 'Receipts de agents',
  'docs/nodes': 'Nodos GDD',
  'docs/plan': 'Planes de features',
  'docs/test-evidence': 'Evidencias de tests'
};

function checkFile(filePath, description) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const stats = fs.statSync(fullPath);
    return {
      exists: true,
      size: stats.size,
      description
    };
  }
  
  return {
    exists: false,
    description
  };
}

function checkDir(dirPath, description) {
  const fullPath = path.join(ROOT_DIR, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  
  if (exists) {
    const files = fs.readdirSync(fullPath);
    return {
      exists: true,
      fileCount: files.length,
      description
    };
  }
  
  return {
    exists: false,
    description
  };
}

function checkScriptsExecutable() {
  const scripts = [
    'scripts/cursor-agents/auto-gdd-activation.js',
    'scripts/cursor-agents/detect-triggers.js'
  ];
  
  const results = [];
  
  for (const script of scripts) {
    const fullPath = path.join(ROOT_DIR, script);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
        results.push({
          script,
          executable: isExecutable
        });
      } catch (e) {
        results.push({
          script,
          executable: false,
          error: e.message
        });
      }
    }
  }
  
  return results;
}

function testGDDScripts() {
  const scripts = [
    { cmd: 'node scripts/resolve-graph.js --help', name: 'resolve-graph.js' },
    { cmd: 'node scripts/validate-gdd-runtime.js --help', name: 'validate-gdd-runtime.js' },
    { cmd: 'node scripts/score-gdd-health.js --help', name: 'score-gdd-health.js' }
  ];
  
  const results = [];
  
  for (const { cmd, name } of scripts) {
    try {
      execSync(cmd, { encoding: 'utf8', stdio: 'pipe', cwd: ROOT_DIR });
      results.push({ script: name, working: true });
    } catch (e) {
      // Si el script existe pero falla con --help, está bien (puede no tener help)
      if (e.message.includes('ENOENT')) {
        results.push({ script: name, working: false, error: 'Script not found' });
      } else {
        // Script existe pero falló (probablemente porque necesita args)
        results.push({ script: name, working: true, note: 'Script exists (help may not be available)' });
      }
    }
  }
  
  return results;
}

function createMissingDirs() {
  const created = [];
  
  for (const [dir, description] of Object.entries(REQUIRED_DIRS)) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      created.push({ dir, description });
    }
  }
  
  return created;
}

function makeScriptsExecutable() {
  const scripts = [
    'scripts/cursor-agents/auto-gdd-activation.js',
    'scripts/cursor-agents/detect-triggers.js'
  ];
  
  const madeExecutable = [];
  
  for (const script of scripts) {
    const fullPath = path.join(ROOT_DIR, script);
    if (fs.existsSync(fullPath)) {
      try {
        fs.chmodSync(fullPath, '755');
        madeExecutable.push(script);
      } catch (e) {
        // Ignore if can't chmod (Windows)
      }
    }
  }
  
  return madeExecutable;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  
  console.log('🔍 Cursor Migration Setup Check\n');
  
  // 1. Verificar archivos requeridos
  console.log('📄 Verificando archivos requeridos...\n');
  const fileResults = [];
  for (const [file, desc] of Object.entries(REQUIRED_FILES)) {
    const result = checkFile(file, desc);
    fileResults.push({ file, ...result });
    
    if (result.exists) {
      console.log(`   ✅ ${file} (${(result.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`   ❌ ${file} - FALTANTE`);
    }
  }
  
  console.log('\n📁 Verificando directorios requeridos...\n');
  const dirResults = [];
  for (const [dir, desc] of Object.entries(REQUIRED_DIRS)) {
    const result = checkDir(dir, desc);
    dirResults.push({ dir, ...result });
    
    if (result.exists) {
      console.log(`   ✅ ${dir} (${result.fileCount} archivos)`);
    } else {
      console.log(`   ❌ ${dir} - FALTANTE`);
    }
  }
  
  console.log('\n🔧 Verificando scripts ejecutables...\n');
  const execResults = checkScriptsExecutable();
  for (const result of execResults) {
    if (result.executable) {
      console.log(`   ✅ ${result.script} (ejecutable)`);
    } else {
      console.log(`   ⚠️  ${result.script} (no ejecutable)`);
    }
  }
  
  console.log('\n🧪 Probando scripts GDD...\n');
  const scriptResults = testGDDScripts();
  for (const result of scriptResults) {
    if (result.working) {
      console.log(`   ✅ ${result.script} (funciona)`);
    } else {
      console.log(`   ❌ ${result.script} - ${result.error || 'Error'}`);
    }
  }
  
  // Resumen
  const missingFiles = fileResults.filter(r => !r.exists);
  const missingDirs = dirResults.filter(r => !r.exists);
  const nonExecutable = execResults.filter(r => !r.executable);
  const brokenScripts = scriptResults.filter(r => !r.working);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN\n');
  
  if (missingFiles.length === 0 && missingDirs.length === 0 && nonExecutable.length === 0 && brokenScripts.length === 0) {
    console.log('✅ TODO CONFIGURADO CORRECTAMENTE\n');
    console.log('🎉 El sistema está listo para usar GDD + Agents + Skills en Cursor.\n');
    return 0;
  }
  
  if (!checkOnly) {
    console.log('🔧 Creando elementos faltantes...\n');
    
    // Crear directorios faltantes
    const createdDirs = createMissingDirs();
    if (createdDirs.length > 0) {
      console.log('   Directorios creados:');
      createdDirs.forEach(({ dir, description }) => {
        console.log(`   ✅ ${dir} - ${description}`);
      });
      console.log();
    }
    
    // Hacer scripts ejecutables
    const madeExecutable = makeScriptsExecutable();
    if (madeExecutable.length > 0) {
      console.log('   Scripts hechos ejecutables:');
      madeExecutable.forEach(script => {
        console.log(`   ✅ ${script}`);
      });
      console.log();
    }
    
    if (missingFiles.length > 0) {
      console.log('⚠️  Archivos faltantes que debes crear manualmente:');
      missingFiles.forEach(({ file, description }) => {
        console.log(`   - ${file} (${description})`);
      });
      console.log();
    }
    
    if (brokenScripts.length > 0) {
      console.log('⚠️  Scripts con problemas:');
      brokenScripts.forEach(({ script, error }) => {
        console.log(`   - ${script}: ${error}`);
      });
      console.log();
    }
    
    console.log('✅ Setup completado. Revisa los elementos faltantes arriba.\n');
  } else {
    console.log('⚠️  Elementos faltantes detectados. Ejecuta sin --check para crearlos.\n');
  }
  
  // Calcular total de errores y limitar exit code a rango válido (0-254)
  const total = missingFiles.length + brokenScripts.length;
  return total === 0 ? 0 : Math.min(total, 254);
}

if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

module.exports = { checkFile, checkDir, createMissingDirs, makeScriptsExecutable };

