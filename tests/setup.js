/**
 * Configuración global para tests de Roastr.ai
 * Se ejecuta antes de todos los tests
 */

const { setMockEnvVars } = require('./helpers/testUtils');
const path = require('path');

// Configurar variables de entorno para tests
beforeAll(() => {
  // Configurar env vars mock
  setMockEnvVars();
  
  // Configurar sistema de archivos mock si están disponibles
  try {
    const fs = require('fs');
    const fsExtra = require('fs-extra');
    
    if (fs.__setMockFile && fsExtra.__setMockFile) {
      // Inicializar archivos de prueba en el sistema mock
      const testCsvPath = path.join(__dirname, 'data/roasts_test.csv');
      const testCsvContent = `roast_text,language,source,original_english,tone,category
"Innovador: has reinventado el PowerPoint de 1998.","es","test","Innovative: you've reinvented PowerPoint 1998.","sarcastic","design"
"Tu código es tan eficiente como una calculadora de arena.","es","test","Your code is as efficient as a sand calculator.","direct","programming"
"Qué elegante forma de decir que no tienes ni idea.","es","test","What an elegant way to say you have no clue.","subtle","general"
"Este comentario necesita más originalidad que una película de Marvel.","es","test","This comment needs more originality than a Marvel movie.","sarcastic","entertainment"
"Tu creatividad brilla tanto como un agujero negro.","es","test","Your creativity shines as much as a black hole.","direct","creativity"`;
      
      // Configurar archivos mock
      fs.__setMockFile(testCsvPath, testCsvContent);
      fsExtra.__setMockFile(testCsvPath, testCsvContent);
      
      // Mock de processed tweets
      const tweetDataPath = path.join(__dirname, '../data/processed_tweets.json');
      const tweetData = JSON.stringify({ processedTweetIds: [] });
      fs.__setMockFile(tweetDataPath, tweetData);
      fsExtra.__setMockFile(tweetDataPath, tweetData);
    }
  } catch (error) {
    // Los mocks no están disponibles, continuamos sin configurarlos
  }
  
  // Suprimir logs de console durante tests (excepto errores críticos)
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    log: jest.fn(), // Mock console.log
    warn: jest.fn(), // Mock console.warn
    error: originalConsole.error, // Mantener console.error para debugging
    info: jest.fn(), // Mock console.info
    debug: jest.fn() // Mock console.debug
  };
});

// Limpiar después de todos los tests
afterAll(() => {
  // Restaurar console original
  global.console = require('console');
  
  // Limpiar sistema de archivos mock
  const fs = require('fs');
  const fsExtra = require('fs-extra');
  if (fs.__clearMockFileSystem) fs.__clearMockFileSystem();
  if (fsExtra.__clearMockFileSystem) fsExtra.__clearMockFileSystem();
  
  // Limpiar mocks globales
  jest.clearAllMocks();
});

// Configurar timeout global para tests asíncronos
jest.setTimeout(10000); // 10 segundos

// Configurar manejo de promesas no capturadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock global de fetch si se necesita en el futuro
global.fetch = jest.fn();

// Configurar zona horaria para tests consistentes
process.env.TZ = 'UTC';