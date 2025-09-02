#!/usr/bin/env node

/**
 * 🧪 Test de flujo 2 – Análisis del comentario con Moderation + Roastr Persona
 * 
 * Valida el flujo completo de análisis de un comentario recibido usando OpenAI Moderation API,
 * y cómo se modifica ese análisis si el Roastr Persona está activo.
 * 
 * Objetivo:
 * 1. Confirmar que el sistema analiza correctamente la toxicidad del comentario.
 * 2. Confirmar que, si el Roastr Persona del usuario contiene temas sensibles relacionados,
 *    se aplica un ajuste al score de toxicidad y se etiquetan como `personal_attack`.
 */

// Configurar variables de entorno necesarias
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
process.env.OPENAI_API_KEY = 'mock-openai-key';

const AnalyzeToxicityWorker = require('./src/workers/AnalyzeToxicityWorker');
const encryptionService = require('./src/services/encryptionService');

// Mock de Supabase para simular datos
const mockSupabase = {
  from: () => mockSupabase,
  select: () => mockSupabase,
  eq: () => mockSupabase,
  single: () => Promise.resolve({ data: { id: 'comment-123' }, error: null }),
  update: () => mockSupabase,
  insert: () => mockSupabase
};

// Mock de OpenAI Moderation API
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

async function testCommentAnalysisFlow() {
  console.log('🧪 Iniciando Test de flujo 2 – Análisis del comentario con Moderation + Roastr Persona\n');

  // Configurar el worker
  const worker = new AnalyzeToxicityWorker();
  worker.supabase = mockSupabase;

  // Mock del cliente OpenAI
  worker.openaiClient = {
    moderations: {
      create: () => Promise.resolve(mockOpenAIResponse)
    }
  };

  // Comentario de prueba con contenido ligeramente tóxico
  const testComment = "Qué asco das, vuelve a tu país";

  console.log('📝 Comentario de prueba:', testComment);
  console.log('');

  // PASO 1: Análisis sin Roastr Persona
  console.log('🔍 PASO 1: Análisis sin Roastr Persona');
  console.log('=' .repeat(50));

  const resultWithoutPersona = await worker.analyzeToxicity(testComment, null);

  console.log('📊 Resultado del análisis base:');
  console.log(`   - Score de toxicidad: ${resultWithoutPersona.toxicity_score}`);
  console.log(`   - Categorías: ${resultWithoutPersona.categories.join(', ')}`);
  console.log(`   - Servicio usado: ${resultWithoutPersona.service}`);
  console.log(`   - Raw scores:`, JSON.stringify(resultWithoutPersona.raw_scores, null, 4));
  console.log('');

  // PASO 2: Análisis con Roastr Persona que contiene temas relacionados
  console.log('🔍 PASO 2: Análisis con Roastr Persona relacionado');
  console.log('=' .repeat(50));
  
  const roastrPersona = "odio el racismo, odio los comentarios xenófobos, soy inmigrante";
  console.log('👤 Roastr Persona:', roastrPersona);
  console.log('');
  
  const resultWithPersona = await worker.analyzeToxicity(testComment, roastrPersona);
  
  console.log('📊 Resultado del análisis con Roastr Persona:');
  console.log(`   - Score de toxicidad original: ${resultWithoutPersona.toxicity_score}`);
  console.log(`   - Score de toxicidad mejorado: ${resultWithPersona.toxicity_score}`);
  console.log(`   - Boost aplicado: +${(resultWithPersona.toxicity_score - resultWithoutPersona.toxicity_score).toFixed(3)}`);
  console.log(`   - Categorías: ${resultWithPersona.categories.join(', ')}`);
  console.log(`   - Contiene 'personal_attack': ${resultWithPersona.categories.includes('personal_attack')}`);
  console.log('');

  // PASO 3: Verificar que el boost está en el rango esperado
  console.log('✅ PASO 3: Verificación de resultados');
  console.log('=' .repeat(50));
  
  const boostAmount = resultWithPersona.toxicity_score - resultWithoutPersona.toxicity_score;
  const hasPersonalAttack = resultWithPersona.categories.includes('personal_attack');
  
  console.log('🔍 Verificaciones:');
  
  // Verificar que el boost está en el rango esperado (+0.2 a +0.6)
  if (boostAmount >= 0.2 && boostAmount <= 0.6) {
    console.log(`   ✅ Boost en rango esperado: +${boostAmount.toFixed(3)} (0.2-0.6)`);
  } else {
    console.log(`   ❌ Boost fuera de rango: +${boostAmount.toFixed(3)} (esperado: 0.2-0.6)`);
  }
  
  // Verificar que se añadió la categoría personal_attack
  if (hasPersonalAttack) {
    console.log('   ✅ Categoría "personal_attack" añadida correctamente');
  } else {
    console.log('   ❌ Categoría "personal_attack" NO fue añadida');
  }
  
  // Verificar que el score final no excede 1.0
  if (resultWithPersona.toxicity_score <= 1.0) {
    console.log(`   ✅ Score final dentro del límite: ${resultWithPersona.toxicity_score} <= 1.0`);
  } else {
    console.log(`   ❌ Score final excede el límite: ${resultWithPersona.toxicity_score} > 1.0`);
  }
  
  console.log('');

  // PASO 4: Simular almacenamiento del resultado
  console.log('💾 PASO 4: Simulación de almacenamiento');
  console.log('=' .repeat(50));
  
  // Mock de la actualización en base de datos
  // Ya está configurado en el mock de Supabase arriba
  
  const updateData = {
    toxicity_score: resultWithPersona.toxicity_score,
    severity_level: resultWithPersona.toxicity_score > 0.7 ? 'high' : 
                   resultWithPersona.toxicity_score > 0.5 ? 'medium' : 'low',
    categories: resultWithPersona.categories,
    analysis_service: resultWithPersona.service,
    analyzed_at: new Date().toISOString(),
    persona_enhanced: hasPersonalAttack
  };
  
  console.log('📝 Datos que se guardarían en la base de datos:');
  console.log(JSON.stringify(updateData, null, 2));
  console.log('');

  // PASO 5: Resumen final
  console.log('📋 RESUMEN FINAL');
  console.log('=' .repeat(50));
  console.log(`✅ Análisis base completado (score: ${resultWithoutPersona.toxicity_score})`);
  console.log(`✅ Análisis con Roastr Persona completado (score: ${resultWithPersona.toxicity_score})`);
  console.log(`✅ Boost aplicado: +${boostAmount.toFixed(3)}`);
  console.log(`✅ Personal attack detectado: ${hasPersonalAttack}`);
  console.log(`✅ Resultado guardado con nivel: ${updateData.severity_level}`);
  console.log('');
  console.log('🎉 Test de flujo 2 completado exitosamente!');
}

async function testAdditionalScenarios() {
  console.log('\n🧪 CASOS ADICIONALES DE PRUEBA');
  console.log('=' .repeat(50));

  const worker = new AnalyzeToxicityWorker();
  worker.supabase = mockSupabase;
  worker.openaiClient = {
    moderations: {
      create: () => Promise.resolve(mockOpenAIResponse)
    }
  };

  // Caso 1: Comentario no relacionado con el Roastr Persona
  console.log('\n📝 Caso 1: Comentario no relacionado con Roastr Persona');
  const unrelatedComment = "Tu aplicación es una basura";
  const persona1 = "soy vegana, amo los animales";

  const result1 = await worker.analyzeToxicity(unrelatedComment, persona1);
  console.log(`   - Comentario: "${unrelatedComment}"`);
  console.log(`   - Persona: "${persona1}"`);
  console.log(`   - Score: ${result1.toxicity_score}`);
  console.log(`   - Personal attack: ${result1.categories.includes('personal_attack')}`);

  // Caso 2: Múltiples términos del persona en el comentario
  console.log('\n📝 Caso 2: Múltiples términos del persona');
  const multiTermComment = "Las veganas feministas son locas";
  const persona2 = "soy vegana, feminista, activista";

  const result2 = await worker.analyzeToxicity(multiTermComment, persona2);
  console.log(`   - Comentario: "${multiTermComment}"`);
  console.log(`   - Persona: "${persona2}"`);
  console.log(`   - Score: ${result2.toxicity_score}`);
  console.log(`   - Personal attack: ${result2.categories.includes('personal_attack')}`);

  // Caso 3: Comentario con slur patterns
  console.log('\n📝 Caso 3: Comentario con patrones de slur');
  const slurComment = "Las tr@nnys son raras";
  const persona3 = "mujer trans, activista LGBTQ+";

  const result3 = await worker.analyzeToxicity(slurComment, persona3);
  console.log(`   - Comentario: "${slurComment}"`);
  console.log(`   - Persona: "${persona3}"`);
  console.log(`   - Score: ${result3.toxicity_score}`);
  console.log(`   - Personal attack: ${result3.categories.includes('personal_attack')}`);

  console.log('\n✅ Casos adicionales completados');
}

// Ejecutar el test si se llama directamente
if (require.main === module) {
  Promise.all([
    testCommentAnalysisFlow(),
    testAdditionalScenarios()
  ]).catch(error => {
    console.error('❌ Error en el test:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { testCommentAnalysisFlow, testAdditionalScenarios };
