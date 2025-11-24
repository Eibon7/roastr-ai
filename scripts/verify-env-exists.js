#!/usr/bin/env node

/**
 * SCRIPT: verify-env-exists.js
 * PROPÓSITO: Verificar que .env existe antes de commits y ejecuciones
 * USO: node scripts/verify-env-exists.js [--create-if-missing]
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE = path.join(__dirname, '..', '.env.example');
const ENV_BACKUP = path.join(__dirname, '..', '.env.backup');

const args = process.argv.slice(2);
const createIfMissing = args.includes('--create-if-missing');
const silent = args.includes('--silent');

function log(msg, isError = false) {
  if (!silent) {
    if (isError) {
      console.error('❌', msg);
    } else {
      console.log('✅', msg);
    }
  }
}

function main() {
  // Verificar si .env existe
  if (fs.existsSync(ENV_FILE)) {
    log('.env existe');

    // Crear backup automático con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(__dirname, '..', `.env.backup-${timestamp}`);
    fs.copyFileSync(ENV_FILE, backupPath);

    // Mantener solo los últimos 5 backups
    const backupDir = path.dirname(backupPath);
    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('.env.backup-'))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > 5) {
      backups.slice(5).forEach((b) => {
        fs.unlinkSync(path.join(backupDir, b.name));
        if (!silent) console.log(`🗑️  Backup antiguo eliminado: ${b.name}`);
      });
    }

    if (!silent) console.log(`💾 Backup automático creado: ${path.basename(backupPath)}`);
    return 0;
  }

  // .env NO existe
  log('.env NO ENCONTRADO', true);

  if (createIfMissing) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      log('.env recreado desde .env.example');
      console.warn('⚠️  IMPORTANTE: Configura tus variables de entorno reales en .env');

      // Validate the recreated .env
      try {
        require('child_process').execSync('node scripts/verify-env-config.js', {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit'
        });
      } catch (error) {
        console.warn('⚠️  Validación: Algunas configuraciones requieren atención');
      }

      return 0;
    } else if (fs.existsSync(ENV_BACKUP)) {
      fs.copyFileSync(ENV_BACKUP, ENV_FILE);
      log('.env recreado desde .env.backup');
      console.warn('⚠️  IMPORTANTE: Verifica que el backup esté actualizado');
      return 0;
    } else {
      log('No se encontró .env.example ni .env.backup para recrear', true);
      return 1;
    }
  }

  // No auto-crear, solo reportar error
  console.error('\n⚠️  ACCIÓN REQUERIDA:');
  console.error('   Crea .env ejecutando: cp .env.example .env');
  console.error('   O ejecuta este script con: --create-if-missing\n');
  return 1;
}

process.exit(main());
