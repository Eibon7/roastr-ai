#!/usr/bin/env node

/**
 * Interactive Redis Setup Script
 *
 * Helps configure Redis/Upstash step by step
 *
 * Usage:
 *   node scripts/setup-redis-interactive.js
 */

require('dotenv').config();
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupRedis() {
  console.log('\n🚀 Redis/Upstash Setup Wizard\n');
  console.log('='.repeat(60));
  console.log('Este script te ayudará a configurar Redis/Upstash');
  console.log('para reducir Disk IO en ~95%.\n');

  // Check current configuration
  const currentUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const currentToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const preferRedis = process.env.QUEUE_PREFER_REDIS !== 'false';

  if (currentUrl) {
    console.log('📋 Configuración actual encontrada:');
    console.log(`   URL: ${currentUrl.substring(0, 30)}...`);
    console.log(`   Token: ${currentToken ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   Prefer Redis: ${preferRedis ? '✅' : '❌'}\n`);

    const useCurrent = await question('¿Usar configuración actual? (s/n): ');
    if (useCurrent.toLowerCase() === 's' || useCurrent.toLowerCase() === 'y') {
      console.log('\n✅ Usando configuración actual');
      await verifyConnection(currentUrl, currentToken);
      rl.close();
      return;
    }
  }

  // Step 1: Choose provider
  console.log('\n📦 Paso 1: Elige proveedor\n');
  console.log('1. Upstash (Recomendado - Cloud, gratis hasta 10K comandos/día)');
  console.log('2. Redis Local (Desarrollo local)');
  console.log('3. Ya tengo credenciales, solo configurar\n');

  const providerChoice = await question('Elige opción (1-3): ');

  let redisUrl, redisToken;

  if (providerChoice === '1') {
    // Upstash
    console.log('\n📋 Configuración Upstash:\n');
    console.log('1. Ve a: https://upstash.com/');
    console.log('2. Crea cuenta (gratis)');
    console.log('3. Crea base de datos Redis');
    console.log('4. Copia REST URL y REST TOKEN\n');

    const ready = await question('¿Ya tienes las credenciales? (s/n): ');
    if (ready.toLowerCase() !== 's' && ready.toLowerCase() !== 'y') {
      console.log('\n⏸️  Ve a https://upstash.com/ y crea la base de datos.');
      console.log('   Luego ejecuta este script de nuevo.\n');
      rl.close();
      return;
    }

    redisUrl = await question('\nPega UPSTASH_REDIS_REST_URL (https://xxxxx.upstash.io): ');
    redisToken = await question('Pega UPSTASH_REDIS_REST_TOKEN: ');
  } else if (providerChoice === '2') {
    // Redis Local
    console.log('\n📋 Configuración Redis Local:\n');
    console.log('Asegúrate de tener Redis corriendo localmente:');
    console.log('  brew install redis  # macOS');
    console.log('  redis-server       # Iniciar Redis\n');

    const redisRunning = await question('¿Redis está corriendo? (s/n): ');
    if (redisRunning.toLowerCase() !== 's' && redisRunning.toLowerCase() !== 'y') {
      console.log('\n⏸️  Inicia Redis primero: redis-server\n');
      rl.close();
      return;
    }

    redisUrl =
      (await question('\nRedis URL (default: redis://localhost:6379): ')) ||
      'redis://localhost:6379';
    redisToken = null; // No token for local Redis
  } else if (providerChoice === '3') {
    // Manual
    redisUrl = await question('\nRedis URL: ');
    redisToken = (await question('Redis Token/Password (opcional para Redis local): ')) || null;
  } else {
    console.log('\n❌ Opción inválida');
    rl.close();
    return;
  }

  // Step 2: Verify connection
  console.log('\n🔍 Verificando conexión...\n');
  const verified = await verifyConnection(redisUrl, redisToken);

  if (!verified) {
    console.log('\n❌ Verificación falló. Revisa las credenciales.\n');
    rl.close();
    return;
  }

  // Step 3: Save to .env
  console.log('\n💾 Guardando configuración en .env...\n');

  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Remove old Redis config
  envContent = envContent.replace(/UPSTASH_REDIS_REST_URL=.*\n/g, '');
  envContent = envContent.replace(/REDIS_URL=.*\n/g, '');
  envContent = envContent.replace(/UPSTASH_REDIS_REST_TOKEN=.*\n/g, '');
  envContent = envContent.replace(/QUEUE_PREFER_REDIS=.*\n/g, '');

  // Add new config
  if (redisToken) {
    // Upstash
    envContent += `\n# Redis/Upstash Configuration\n`;
    envContent += `UPSTASH_REDIS_REST_URL=${redisUrl}\n`;
    envContent += `UPSTASH_REDIS_REST_TOKEN=${redisToken}\n`;
  } else {
    // Local Redis
    envContent += `\n# Redis Configuration (Local)\n`;
    envContent += `REDIS_URL=${redisUrl}\n`;
  }
  envContent += `QUEUE_PREFER_REDIS=true\n`;

  fs.writeFileSync(envPath, envContent);

  console.log('✅ Configuración guardada en .env\n');

  // Step 4: Final verification
  console.log('🔍 Verificación final...\n');
  require('dotenv').config({ override: true }); // Reload .env

  const { Redis } = require('@upstash/redis');
  try {
    // Initialize Upstash Redis (REST SDK)
    if (!redisUrl || !redisToken) {
      throw new Error('Redis URL and token are required');
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken
    });

    await redis.ping();
    // Note: Upstash SDK is stateless, no need to disconnect

    console.log('✅ ¡Configuración exitosa!\n');
    console.log('📋 Próximos pasos:');
    console.log('   1. Reinicia workers: npm run workers:start');
    console.log('   2. Verifica estado: npm run workers:status');
    console.log('   3. Deberías ver "Redis: ✅ Available"\n');
  } catch (error) {
    console.error('❌ Error en verificación final:', error.message);
    console.log('\n⚠️  Revisa la configuración manualmente.\n');
  }

  rl.close();
}

async function verifyConnection(redisUrl, redisToken) {
  try {
    const { Redis } = require('@upstash/redis');

    // Initialize Upstash Redis (REST SDK - much simpler!)
    if (!redisUrl || !redisToken) {
      return false;
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken
    });

    const pong = await redis.ping();

    if (pong === 'PONG') {
      // Test operations
      await redis.set('roastr:test:setup', 'ok', { ex: 10 });
      const value = await redis.get('roastr:test:setup');
      await redis.del('roastr:test:setup');
      // Note: Upstash SDK is stateless, no need to disconnect

      if (value === 'ok') {
        console.log('✅ Conexión exitosa!');
        console.log('✅ Operaciones básicas funcionando\n');
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

setupRedis().catch((error) => {
  console.error('❌ Error fatal:', error);
  rl.close();
  process.exit(1);
});
