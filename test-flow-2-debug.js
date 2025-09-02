#!/usr/bin/env node

/**
 * 🧪 Test de flujo 2 – Debug del análisis de ataque personal
 */

function analyzePersonalAttack(text, roastrPersona) {
  console.log('🔍 DEBUG: Iniciando analyzePersonalAttack');
  console.log(`   - Text: "${text}"`);
  console.log(`   - Persona: "${roastrPersona}"`);
  
  if (!roastrPersona || typeof roastrPersona !== 'string') {
    console.log('   - Persona inválida, retornando false');
    return { isPersonalAttack: false, matchedTerms: [], boostAmount: 0 };
  }
  
  // Clean and normalize the persona text
  const personaTerms = roastrPersona
    .toLowerCase()
    .split(/[,;\.]+/) // Split by common separators
    .map(term => term.trim())
    .filter(term => term.length > 2); // Filter out very short terms
  
  console.log(`   - Términos del persona: [${personaTerms.join(', ')}]`);
  
  // Clean and normalize the comment text
  const commentText = text.toLowerCase();
  console.log(`   - Comentario normalizado: "${commentText}"`);
  
  const matchedTerms = [];
  let totalBoost = 0;
  
  // Check for direct mentions of persona terms
  for (const term of personaTerms) {
    console.log(`   - Buscando término: "${term}"`);
    if (commentText.includes(term)) {
      console.log(`     ✅ Encontrado: "${term}"`);
      matchedTerms.push(term);
      
      // Calculate boost based on context and term significance
      let termBoost = 0.2; // Base boost for any match
      console.log(`     - Boost base: ${termBoost}`);
      
      // Higher boost for longer, more specific terms
      if (term.length > 8) {
        termBoost += 0.1;
        console.log(`     - Boost por longitud: +0.1 (total: ${termBoost})`);
      }
      if (term.includes(' ')) {
        termBoost += 0.1; // Multi-word terms are more specific
        console.log(`     - Boost por múltiples palabras: +0.1 (total: ${termBoost})`);
      }
      
      // Check for negative context around the term
      const termIndex = commentText.indexOf(term);
      const contextStart = Math.max(0, termIndex - 20);
      const contextEnd = Math.min(commentText.length, termIndex + term.length + 20);
      const context = commentText.substring(contextStart, contextEnd);
      
      console.log(`     - Contexto: "${context}"`);
      
      // Common negative words that indicate attacks
      const negativeWords = [
        'estúpid', 'tont', 'idiota', 'imbécil', 'loc', 'rar', 'asqueroso', 'asco',
        'odio', 'horrible', 'terrible', 'malo', 'feo', 'disgusting', 'stupid', 
        'crazy', 'weird', 'hate', 'awful', 'terrible', 'bad', 'ugly'
      ];
      
      const hasNegativeContext = negativeWords.some(word => context.includes(word));
      if (hasNegativeContext) {
        termBoost += 0.3; // Significant boost for negative context
        console.log(`     - Boost por contexto negativo: +0.3 (total: ${termBoost})`);
      }
      
      totalBoost += termBoost;
      console.log(`     - Boost total acumulado: ${totalBoost}`);
    } else {
      console.log(`     ❌ No encontrado: "${term}"`);
    }
  }
  
  // Cap the total boost to prevent over-amplification
  totalBoost = Math.min(totalBoost, 0.6);
  console.log(`   - Boost final (con cap): ${totalBoost}`);
  
  const isPersonalAttack = matchedTerms.length > 0 && totalBoost > 0.1;
  console.log(`   - Es ataque personal: ${isPersonalAttack} (términos: ${matchedTerms.length}, boost: ${totalBoost})`);
  
  return {
    isPersonalAttack,
    matchedTerms,
    boostAmount: Math.round(totalBoost * 1000) / 1000 // Round to 3 decimals
  };
}

function testDebug() {
  console.log('🧪 Test de debug del análisis de ataque personal\n');
  
  // Caso 1: Comentario que debería coincidir
  console.log('📝 CASO 1: Comentario con término directo');
  console.log('=' .repeat(50));
  const comment1 = "Los inmigrantes son estúpidos";
  const persona1 = "soy inmigrante, defiendo los derechos humanos";
  const result1 = analyzePersonalAttack(comment1, persona1);
  console.log(`Resultado: ${JSON.stringify(result1, null, 2)}\n`);
  
  // Caso 2: Comentario con múltiples términos
  console.log('📝 CASO 2: Comentario con múltiples términos');
  console.log('=' .repeat(50));
  const comment2 = "Las veganas feministas son locas";
  const persona2 = "soy vegana, feminista, activista";
  const result2 = analyzePersonalAttack(comment2, persona2);
  console.log(`Resultado: ${JSON.stringify(result2, null, 2)}\n`);
  
  // Caso 3: Comentario sin coincidencias
  console.log('📝 CASO 3: Comentario sin coincidencias');
  console.log('=' .repeat(50));
  const comment3 = "Tu aplicación es terrible";
  const persona3 = "soy desarrollador, me gusta programar";
  const result3 = analyzePersonalAttack(comment3, persona3);
  console.log(`Resultado: ${JSON.stringify(result3, null, 2)}\n`);
  
  // Caso 4: El caso original que no funcionaba
  console.log('📝 CASO 4: Caso original problemático');
  console.log('=' .repeat(50));
  const comment4 = "Qué asco das, vuelve a tu país";
  const persona4 = "odio el racismo, odio los comentarios xenófobos, soy inmigrante";
  const result4 = analyzePersonalAttack(comment4, persona4);
  console.log(`Resultado: ${JSON.stringify(result4, null, 2)}\n`);
  
  console.log('🎉 Debug completado!');
}

// Ejecutar el test
testDebug();
