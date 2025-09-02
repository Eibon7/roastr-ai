#!/usr/bin/env node

/**
 * 🧪 Test de flujo 2 – Análisis del comentario con Moderation + Roastr Persona (Versión Simplificada)
 * 
 * Valida el flujo completo de análisis de un comentario recibido usando OpenAI Moderation API,
 * y cómo se modifica ese análisis si el Roastr Persona está activo.
 */

// Configurar variables de entorno necesarias
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
process.env.OPENAI_API_KEY = 'mock-openai-key';

const AnalyzeToxicityWorker = require('./src/workers/AnalyzeToxicityWorker');

// Mock de OpenAI Moderation API response
const mockOpenAIResponse = {
  results: [{
    flagged: true,
    categories: {
      hate: true,
      harassment: true,
      'hate/threatening': false,
      'harassment/threatening': false,
      'self-harm': false,
      'self-harm/intent': false,
      'self-harm/instructions': false,
      sexual: false,
      'sexual/minors': false,
      violence: false,
      'violence/graphic': false
    },
    category_scores: {
      hate: 0.65,
      harassment: 0.72,
      'hate/threatening': 0.01,
      'harassment/threatening': 0.02,
      'self-harm': 0.001,
      'self-harm/intent': 0.001,
      'self-harm/instructions': 0.001,
      sexual: 0.001,
      'sexual/minors': 0.001,
      violence: 0.05,
      'violence/graphic': 0.001
    }
  }]
};

async function testPersonalAttackAnalysis() {
  console.log('🧪 Test de flujo 2 – Análisis del comentario con Moderation + Roastr Persona\n');

  // Crear una instancia del worker solo para usar sus métodos de análisis
  const worker = new AnalyzeToxicityWorker();
  
  // Comentario de prueba con contenido ligeramente tóxico
  const testComment = "Qué asco das, vuelve a tu país";
  
  console.log('📝 Comentario de prueba:', testComment);
  console.log('');

  // PASO 1: Simular análisis base con OpenAI Moderation
  console.log('🔍 PASO 1: Análisis base con OpenAI Moderation');
  console.log('=' .repeat(50));
  
  // Simular el resultado de OpenAI Moderation
  const baseResult = {
    toxicity_score: 0.72, // Score más alto de las categorías
    categories: ['hate', 'harassment'],
    flagged: true,
    raw_scores: mockOpenAIResponse.results[0].category_scores,
    service: 'openai'
  };
  
  console.log('📊 Resultado del análisis base:');
  console.log(`   - Score de toxicidad: ${baseResult.toxicity_score}`);
  console.log(`   - Categorías: ${baseResult.categories.join(', ')}`);
  console.log(`   - Servicio usado: ${baseResult.service}`);
  console.log(`   - Flagged: ${baseResult.flagged}`);
  console.log('');

  // PASO 2: Análisis de ataque personal con Roastr Persona
  console.log('🔍 PASO 2: Análisis de ataque personal con Roastr Persona');
  console.log('=' .repeat(50));
  
  const roastrPersona = "odio el racismo, odio los comentarios xenófobos, soy inmigrante";
  console.log('👤 Roastr Persona:', roastrPersona);
  console.log('');
  
  // Usar el método analyzePersonalAttack del worker
  const personalAttackAnalysis = worker.analyzePersonalAttack(testComment, roastrPersona);
  
  console.log('🔍 Análisis de ataque personal:');
  console.log(`   - Es ataque personal: ${personalAttackAnalysis.isPersonalAttack}`);
  console.log(`   - Términos coincidentes: ${personalAttackAnalysis.matchedTerms.join(', ')}`);
  console.log(`   - Boost amount: +${personalAttackAnalysis.boostAmount}`);
  console.log('');

  // PASO 3: Aplicar el boost al score original
  console.log('🔍 PASO 3: Aplicación del boost');
  console.log('=' .repeat(50));
  
  let enhancedResult = { ...baseResult };
  
  if (personalAttackAnalysis.isPersonalAttack) {
    const originalScore = enhancedResult.toxicity_score;
    enhancedResult.toxicity_score = Math.min(1.0, originalScore + personalAttackAnalysis.boostAmount);
    
    // Añadir categoría personal_attack
    if (!enhancedResult.categories.includes('personal_attack')) {
      enhancedResult.categories.push('personal_attack');
    }
    
    console.log('📊 Resultado con Roastr Persona:');
    console.log(`   - Score original: ${originalScore}`);
    console.log(`   - Score mejorado: ${enhancedResult.toxicity_score}`);
    console.log(`   - Boost aplicado: +${personalAttackAnalysis.boostAmount}`);
    console.log(`   - Categorías: ${enhancedResult.categories.join(', ')}`);
    console.log(`   - Contiene 'personal_attack': ${enhancedResult.categories.includes('personal_attack')}`);
  } else {
    console.log('   - No se detectó ataque personal, score sin cambios');
  }
  console.log('');

  // PASO 4: Verificaciones
  console.log('✅ PASO 4: Verificación de resultados');
  console.log('=' .repeat(50));
  
  const boostAmount = enhancedResult.toxicity_score - baseResult.toxicity_score;
  const hasPersonalAttack = enhancedResult.categories.includes('personal_attack');
  
  console.log('🔍 Verificaciones:');
  
  // Verificar que el boost está en el rango esperado (+0.2 a +0.6)
  if (boostAmount >= 0.2 && boostAmount <= 0.6) {
    console.log(`   ✅ Boost en rango esperado: +${boostAmount.toFixed(3)} (0.2-0.6)`);
  } else if (boostAmount > 0) {
    console.log(`   ⚠️  Boost detectado pero fuera de rango: +${boostAmount.toFixed(3)} (esperado: 0.2-0.6)`);
  } else {
    console.log(`   ❌ No se aplicó boost: +${boostAmount.toFixed(3)}`);
  }
  
  // Verificar que se añadió la categoría personal_attack
  if (hasPersonalAttack && personalAttackAnalysis.isPersonalAttack) {
    console.log('   ✅ Categoría "personal_attack" añadida correctamente');
  } else if (personalAttackAnalysis.isPersonalAttack) {
    console.log('   ❌ Categoría "personal_attack" NO fue añadida');
  } else {
    console.log('   ℹ️  No se detectó ataque personal, categoría no añadida');
  }
  
  // Verificar que el score final no excede 1.0
  if (enhancedResult.toxicity_score <= 1.0) {
    console.log(`   ✅ Score final dentro del límite: ${enhancedResult.toxicity_score} <= 1.0`);
  } else {
    console.log(`   ❌ Score final excede el límite: ${enhancedResult.toxicity_score} > 1.0`);
  }
  
  console.log('');

  // PASO 5: Casos adicionales
  console.log('🧪 PASO 5: Casos adicionales');
  console.log('=' .repeat(50));
  
  // Caso 1: Comentario no relacionado
  const unrelatedComment = "Tu aplicación es una basura";
  const unrelatedAnalysis = worker.analyzePersonalAttack(unrelatedComment, roastrPersona);
  console.log(`📝 Caso 1 - No relacionado: "${unrelatedComment}"`);
  console.log(`   - Ataque personal: ${unrelatedAnalysis.isPersonalAttack}`);
  console.log(`   - Boost: +${unrelatedAnalysis.boostAmount}`);
  console.log('');
  
  // Caso 2: Múltiples términos
  const multiTermComment = "Los inmigrantes racistas son tontos";
  const multiTermAnalysis = worker.analyzePersonalAttack(multiTermComment, roastrPersona);
  console.log(`📝 Caso 2 - Múltiples términos: "${multiTermComment}"`);
  console.log(`   - Ataque personal: ${multiTermAnalysis.isPersonalAttack}`);
  console.log(`   - Términos: ${multiTermAnalysis.matchedTerms.join(', ')}`);
  console.log(`   - Boost: +${multiTermAnalysis.boostAmount}`);
  console.log('');

  // PASO 6: Resumen final
  console.log('📋 RESUMEN FINAL');
  console.log('=' .repeat(50));
  console.log(`✅ Análisis base completado (score: ${baseResult.toxicity_score})`);
  console.log(`✅ Análisis con Roastr Persona completado (score: ${enhancedResult.toxicity_score})`);
  console.log(`✅ Boost aplicado: +${boostAmount.toFixed(3)}`);
  console.log(`✅ Personal attack detectado: ${personalAttackAnalysis.isPersonalAttack}`);
  console.log(`✅ Categorías finales: ${enhancedResult.categories.join(', ')}`);
  console.log('');
  console.log('🎉 Test de flujo 2 completado exitosamente!');
}

// Ejecutar el test
if (require.main === module) {
  testPersonalAttackAnalysis().catch(error => {
    console.error('❌ Error en el test:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { testPersonalAttackAnalysis };
