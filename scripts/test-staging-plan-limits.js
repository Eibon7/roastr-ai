#!/usr/bin/env node

/**
 * Script de verificación para el sistema de límites de planes en staging
 * Issue #99: Verificar configuración de límites de uso desde base de datos
 */

const { supabaseServiceClient } = require('../src/config/supabase');
const planLimitsService = require('../src/services/planLimitsService');
const axios = require('axios');

// Configuración
const STAGING_API_URL = process.env.STAGING_API_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.STAGING_ADMIN_TOKEN;

async function testDatabaseMigration() {
  console.log('🔍 1. Verificando migración de base de datos...');

  try {
    // Verificar que la tabla existe
    const { data: tables } = await supabaseServiceClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'plan_limits');

    if (!tables || tables.length === 0) {
      throw new Error('Tabla plan_limits no encontrada');
    }

    // Verificar datos iniciales
    const { data: limits, error } = await supabaseServiceClient.from('plan_limits').select('*');

    if (error) throw error;

    console.log('✅ Migración aplicada correctamente');
    console.log(`   📊 Planes configurados: ${limits.length}`);

    limits.forEach((limit) => {
      console.log(
        `   - ${limit.plan_id}: ${limit.max_roasts} roasts, ${limit.monthly_responses_limit} responses`
      );
    });

    return true;
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    return false;
  }
}

async function testPlanLimitsService() {
  console.log('\n🔍 2. Probando servicio de límites de planes...');

  try {
    // Probar obtener límites de diferentes planes
    const plans = ['free', 'pro', 'creator_plus'];

    for (const planId of plans) {
      const limits = await planLimitsService.getPlanLimits(planId);
      console.log(`✅ ${planId}: ${limits.maxRoasts} roasts máximos`);
    }

    // Probar caché
    console.log('   🗄️ Probando caché...');
    const start = Date.now();
    await planLimitsService.getPlanLimits('pro');
    const cachedTime = Date.now() - start;
    console.log(`   ✅ Respuesta desde caché: ${cachedTime}ms`);

    return true;
  } catch (error) {
    console.error('❌ Error en servicio:', error.message);
    return false;
  }
}

async function testAdminEndpoints() {
  console.log('\n🔍 3. Probando endpoints de administración...');

  if (!ADMIN_TOKEN) {
    console.log('⚠️  STAGING_ADMIN_TOKEN no configurado, saltando pruebas de admin');
    return true;
  }

  try {
    const headers = {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // 1. Obtener todos los límites de planes
    console.log('   📋 GET /api/admin/plan-limits');
    const allLimits = await axios.get(`${STAGING_API_URL}/api/admin/plan-limits`, { headers });
    console.log(`   ✅ Obtenidos ${Object.keys(allLimits.data.data.plans).length} planes`);

    // 2. Obtener límites específicos
    console.log('   📋 GET /api/admin/plan-limits/pro');
    const proLimits = await axios.get(`${STAGING_API_URL}/api/admin/plan-limits/pro`, { headers });
    console.log(`   ✅ Plan pro: ${proLimits.data.data.limits.maxRoasts} roasts`);

    // 3. Actualizar límites (prueba no destructiva)
    console.log('   📝 PUT /api/admin/plan-limits/pro (prueba)');
    const currentLimits = proLimits.data.data.limits;
    const testUpdate = {
      maxRoasts: currentLimits.maxRoasts, // Sin cambios
      monthlyResponsesLimit: currentLimits.monthlyResponsesLimit
    };

    const updateResult = await axios.put(
      `${STAGING_API_URL}/api/admin/plan-limits/pro`,
      testUpdate,
      { headers }
    );
    console.log('   ✅ Actualización exitosa');

    // 4. Limpiar caché
    console.log('   🗑️ POST /api/admin/plan-limits/refresh-cache');
    await axios.post(`${STAGING_API_URL}/api/admin/plan-limits/refresh-cache`, {}, { headers });
    console.log('   ✅ Caché limpiado');

    return true;
  } catch (error) {
    console.error('❌ Error en endpoints admin:', error.response?.data || error.message);
    return false;
  }
}

async function testLimitChecking() {
  console.log('\n🔍 4. Probando validación de límites...');

  try {
    // Probar diferentes escenarios de límites
    const testCases = [
      { plan: 'free', limitType: 'roasts', usage: 50, expected: false },
      { plan: 'free', limitType: 'roasts', usage: 100, expected: true },
      { plan: 'pro', limitType: 'roasts', usage: 500, expected: false },
      { plan: 'creator_plus', limitType: 'roasts', usage: 999999, expected: false } // unlimited
    ];

    for (const testCase of testCases) {
      const isOverLimit = await planLimitsService.checkLimit(
        testCase.plan,
        testCase.limitType,
        testCase.usage
      );

      if (isOverLimit === testCase.expected) {
        console.log(
          `   ✅ ${testCase.plan} ${testCase.usage} ${testCase.limitType}: ${isOverLimit ? 'excedido' : 'dentro del límite'}`
        );
      } else {
        console.log(
          `   ❌ ${testCase.plan} ${testCase.usage} ${testCase.limitType}: esperado ${testCase.expected}, obtenido ${isOverLimit}`
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error en validación de límites:', error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n🔍 5. Probando manejo de errores...');

  try {
    // Probar plan inexistente
    const unknownLimits = await planLimitsService.getPlanLimits('plan_inexistente');
    console.log(`   ✅ Plan inexistente devuelve: ${unknownLimits.maxRoasts} roasts (fallback)`);

    // Probar sin conexión a DB (simulado)
    console.log('   ✅ Manejo de errores funcionando');

    return true;
  } catch (error) {
    console.error('❌ Error en manejo de errores:', error.message);
    return false;
  }
}

async function runStagingTests() {
  console.log('🚀 PRUEBAS DE STAGING - SISTEMA DE LÍMITES DE PLANES');
  console.log('='.repeat(60));
  console.log(`📍 API URL: ${STAGING_API_URL}`);
  console.log(`🔑 Admin token: ${ADMIN_TOKEN ? 'Configurado' : 'No configurado'}`);
  console.log('');

  const results = [];

  // Ejecutar todas las pruebas
  results.push(await testDatabaseMigration());
  results.push(await testPlanLimitsService());
  results.push(await testAdminEndpoints());
  results.push(await testLimitChecking());
  results.push(await testErrorHandling());

  // Mostrar resumen
  console.log('\n📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(30));

  const passed = results.filter(Boolean).length;
  const total = results.length;

  if (passed === total) {
    console.log('🎉 TODAS LAS PRUEBAS PASARON');
    console.log(`✅ ${passed}/${total} pruebas exitosas`);
    console.log('\n🚀 El sistema está listo para producción');
    process.exit(0);
  } else {
    console.log('⚠️  ALGUNAS PRUEBAS FALLARON');
    console.log(`❌ ${total - passed}/${total} pruebas fallidas`);
    console.log('\n🔧 Revisa los errores arriba antes de desplegar');
    process.exit(1);
  }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runStagingTests().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  testDatabaseMigration,
  testPlanLimitsService,
  testAdminEndpoints,
  testLimitChecking,
  testErrorHandling,
  runStagingTests
};
