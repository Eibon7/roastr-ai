/**
 * Utilidades compartidas para tests de Roastr.ai
 */

/**
 * Mock response para OpenAI API
 */
const createMockOpenAIResponse = (text) => ({
  choices: [{
    message: {
      content: text
    }
  }]
});

/**
 * Mock para diferentes tonos de roast
 */
const getMockRoastByTone = (tone, originalMessage) => {
  const mockRoasts = {
    sarcastic: `Vaya, "${originalMessage}" - qué original, nunca habíamos escuchado eso antes 🙄`,
    subtle: `Interesante perspectiva la tuya sobre "${originalMessage}", aunque quizás merezca una reflexión más profunda 🤔`,
    direct: `"${originalMessage}" - directo al grano: no tiene sentido 💀`
  };
  
  return mockRoasts[tone] || mockRoasts.sarcastic;
};

/**
 * Mock para Twitter API responses
 */
const createMockTwitterUser = (id = '123456789', username = 'testuser') => ({
  data: {
    id,
    username,
    name: 'Test User'
  }
});

const createMockTweet = (id = '987654321', text = 'Test tweet', authorId = '123456789') => ({
  id,
  text,
  author_id: authorId,
  created_at: new Date().toISOString()
});

const createMockMentionsResponse = (tweets = []) => ({
  data: tweets,
  includes: {
    users: [createMockTwitterUser().data]
  }
});

/**
 * Datos de muestra para CSV
 */
const getMockCsvData = () => [
  {
    comment: 'Este comentario es muy aburrido',
    roast: '¿Aburrido? Tu comentario tiene menos chispa que una bombilla fundida 💡'
  },
  {
    comment: 'No me gusta esta película',
    roast: 'Tu crítica cinematográfica tiene la profundidad de un charco después de la lluvia 🎬'
  },
  {
    comment: 'Esta comida está mala',
    roast: 'Tu paladar es más exigente que un crítico michelin con problemas digestivos 🍽️'
  }
];

/**
 * Crear datos de test válidos para diferentes endpoints
 */
const getValidTestData = () => ({
  roast: {
    valid: {
      message: 'Este es un comentario de prueba',
      tone: 'sarcastic'
    },
    validWithoutTone: {
      message: 'Comentario sin tono especificado'
    },
    invalid: {
      noMessage: {},
      emptyMessage: { message: '' },
      invalidType: { message: 123 }
    }
  },
  csvRoast: {
    valid: {
      message: 'Este comentario es muy aburrido'
    },
    invalid: {
      noMessage: {},
      emptyMessage: { message: '' },
      invalidType: { message: null }
    }
  }
});

/**
 * Crear instancia mock del servidor Express para tests
 */
const createMockApp = () => {
  const express = require('express');
  const bodyParser = require('body-parser');
  
  const app = express();
  app.use(bodyParser.json());
  
  return app;
};

/**
 * Delay utility para tests asíncronos
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generar ID único para tests
 */
const generateTestId = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Verificar estructura de respuesta de API
 */
const validateApiResponse = (response, expectedFields = []) => {
  const errors = [];
  
  expectedFields.forEach(field => {
    if (!(field in response)) {
      errors.push(`Missing field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Mock para variables de entorno
 */
const setMockEnvVars = () => {
  process.env.OPENAI_API_KEY = 'mock-openai-key-for-testing';
  process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-bearer-token';
  process.env.TWITTER_APP_KEY = 'mock-twitter-app-key';
  process.env.TWITTER_APP_SECRET = 'mock-twitter-app-secret';
  process.env.TWITTER_ACCESS_TOKEN = 'mock-twitter-access-token';
  process.env.TWITTER_ACCESS_SECRET = 'mock-twitter-access-secret';
  process.env.DEBUG = 'false'; // Disable debug logs in tests
  process.env.NODE_ENV = 'test';
};

/**
 * Limpiar mocks después de los tests
 */
const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.resetModules();
};

module.exports = {
  createMockOpenAIResponse,
  getMockRoastByTone,
  createMockTwitterUser,
  createMockTweet,
  createMockMentionsResponse,
  getMockCsvData,
  getValidTestData,
  createMockApp,
  delay,
  generateTestId,
  validateApiResponse,
  setMockEnvVars,
  cleanupMocks
};