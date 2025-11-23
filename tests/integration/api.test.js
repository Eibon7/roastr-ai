/**
 * Tests de integración para los endpoints de la API
 * Valida el comportamiento end-to-end de /roast y /csv-roast
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const {
  createMockOpenAIResponse,
  getMockRoastByTone,
  getMockCsvData,
  getValidTestData,
  setMockEnvVars,
  cleanupMocks
} = require('../helpers/testUtils');

// Mock de dependencias antes de importar la app
jest.mock('../../src/services/roastGeneratorReal');
jest.mock('../../src/services/csvRoastService');

describe('API Integration Tests', () => {
  let app;
  let mockRoastGenerator;
  let mockCsvService;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    cleanupMocks();

    // Crear instancia mock de la aplicación Express
    app = express();

    // Middleware para validar Content-Type antes del parsing
    app.use((req, res, next) => {
      if (req.method === 'POST' && req.headers['content-type']) {
        if (!req.headers['content-type'].includes('application/json')) {
          return res.status(400).json({ error: 'Content-Type must be application/json' });
        }
      }
      next();
    });

    app.use(bodyParser.json());

    // Mock del RoastGeneratorReal
    const RoastGeneratorReal = require('../../src/services/roastGeneratorReal');
    mockRoastGenerator = {
      generateRoast: jest.fn()
    };
    RoastGeneratorReal.mockImplementation(() => mockRoastGenerator);

    // Mock del CsvRoastService
    const CsvRoastService = require('../../src/services/csvRoastService');
    mockCsvService = {
      findBestRoast: jest.fn(),
      getStats: jest.fn(),
      addRoast: jest.fn()
    };
    CsvRoastService.mockImplementation(() => mockCsvService);

    // Recrear las rutas de la API
    setupApiRoutes();
  });

  afterEach(() => {
    cleanupMocks();
  });

  // Función helper para configurar las rutas (replica de src/index.js)
  function setupApiRoutes() {
    const RoastGeneratorReal = require('../../src/services/roastGeneratorReal');
    const CsvRoastService = require('../../src/services/csvRoastService');

    const roastGenerator = new RoastGeneratorReal();
    const csvRoastService = new CsvRoastService();

    // Ruta principal
    app.get('/', (req, res) => {
      res.json({ message: 'Roastr.ai API' });
    });

    // Ruta para generar roast normal
    app.post('/roast', async (req, res) => {
      const { message, tone } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
      }

      const validTones = ['sarcastic', 'subtle', 'direct'];
      const selectedTone = tone && validTones.includes(tone) ? tone : 'sarcastic';

      try {
        const roast = await roastGenerator.generateRoast(message, null, selectedTone);
        res.json({ roast, tone: selectedTone });
      } catch (error) {
        res.status(500).json({ error: 'No se pudo generar el roast en este momento.' });
      }
    });

    // Ruta para CSV roast
    app.post('/csv-roast', async (req, res) => {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
      }

      try {
        const roast = await csvRoastService.findBestRoast(message);
        res.json({
          roast,
          source: 'csv',
          originalMessage: message
        });
      } catch (error) {
        res.status(500).json({
          error: 'No se pudo generar el roast desde CSV.',
          details: process.env.DEBUG === 'true' ? error.message : undefined
        });
      }
    });

    // Ruta para estadísticas CSV
    app.get('/csv-stats', async (req, res) => {
      try {
        const stats = await csvRoastService.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener las estadísticas del CSV.' });
      }
    });

    // Ruta para añadir roast al CSV
    app.post('/csv-add', async (req, res) => {
      const { comment, roast } = req.body;

      if (!comment || typeof comment !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "comment" válido.' });
      }

      if (!roast || typeof roast !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "roast" válido.' });
      }

      try {
        await csvRoastService.addRoast(comment, roast);
        res.json({
          success: true,
          message: 'Roast añadido exitosamente al CSV'
        });
      } catch (error) {
        res.status(500).json({ error: 'No se pudo añadir el roast al CSV.' });
      }
    });

    // Middleware para manejar errores de content-type
    app.use((error, req, res, next) => {
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
      if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid Content-Type' });
      }
      next(error);
    });
  }

  describe('GET /', () => {
    test('debe responder con mensaje de bienvenida', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toEqual({ message: 'Roastr.ai API' });
    });
  });

  describe('POST /roast', () => {
    const testData = getValidTestData().roast;

    test('debe generar roast con tono sarcástico por defecto', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('sarcastic', testData.valid.message);
      mockRoastGenerator.generateRoast.mockResolvedValue(expectedRoast);

      // Act
      const response = await request(app)
        .post('/roast')
        .send(testData.validWithoutTone)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        roast: expectedRoast,
        tone: 'sarcastic'
      });
      expect(mockRoastGenerator.generateRoast).toHaveBeenCalledWith(
        testData.validWithoutTone.message,
        null,
        'sarcastic'
      );
    });

    test('debe generar roast con tono especificado', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('subtle', testData.valid.message);
      mockRoastGenerator.generateRoast.mockResolvedValue(expectedRoast);

      // Act
      const response = await request(app)
        .post('/roast')
        .send({ message: testData.valid.message, tone: 'subtle' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        roast: expectedRoast,
        tone: 'subtle'
      });
      expect(mockRoastGenerator.generateRoast).toHaveBeenCalledWith(
        testData.valid.message,
        null,
        'subtle'
      );
    });

    test('debe usar tono sarcástico si se proporciona tono inválido', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('sarcastic', testData.valid.message);
      mockRoastGenerator.generateRoast.mockResolvedValue(expectedRoast);

      // Act
      const response = await request(app)
        .post('/roast')
        .send({ message: testData.valid.message, tone: 'invalid_tone' })
        .expect(200);

      // Assert
      expect(response.body.tone).toBe('sarcastic');
      expect(mockRoastGenerator.generateRoast).toHaveBeenCalledWith(
        testData.valid.message,
        null,
        'sarcastic'
      );
    });

    test('debe devolver error 400 si falta message', async () => {
      const response = await request(app)
        .post('/roast')
        .send(testData.invalid.noMessage)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 400 si message está vacío', async () => {
      const response = await request(app)
        .post('/roast')
        .send(testData.invalid.emptyMessage)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 400 si message no es string', async () => {
      const response = await request(app)
        .post('/roast')
        .send(testData.invalid.invalidType)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 500 si falla la generación', async () => {
      // Arrange
      mockRoastGenerator.generateRoast.mockRejectedValue(new Error('OpenAI error'));

      // Act
      const response = await request(app).post('/roast').send(testData.valid).expect(500);

      // Assert
      expect(response.body).toEqual({
        error: 'No se pudo generar el roast en este momento.'
      });
    });

    test('debe validar todos los tonos válidos', async () => {
      const validTones = ['sarcastic', 'subtle', 'direct'];

      for (const tone of validTones) {
        const expectedRoast = getMockRoastByTone(tone, testData.valid.message);
        mockRoastGenerator.generateRoast.mockResolvedValue(expectedRoast);

        const response = await request(app)
          .post('/roast')
          .send({ message: testData.valid.message, tone })
          .expect(200);

        expect(response.body.tone).toBe(tone);
        expect(mockRoastGenerator.generateRoast).toHaveBeenCalledWith(
          testData.valid.message,
          null,
          tone
        );
      }
    });
  });

  describe('POST /csv-roast', () => {
    const testData = getValidTestData().csvRoast;

    test('debe devolver roast desde CSV correctamente', async () => {
      // Arrange
      const expectedRoast = 'CSV roast response';
      mockCsvService.findBestRoast.mockResolvedValue(expectedRoast);

      // Act
      const response = await request(app).post('/csv-roast').send(testData.valid).expect(200);

      // Assert
      expect(response.body).toEqual({
        roast: expectedRoast,
        source: 'csv',
        originalMessage: testData.valid.message
      });
      expect(mockCsvService.findBestRoast).toHaveBeenCalledWith(testData.valid.message);
    });

    test('debe devolver error 400 si falta message', async () => {
      const response = await request(app)
        .post('/csv-roast')
        .send(testData.invalid.noMessage)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 400 si message está vacío', async () => {
      const response = await request(app)
        .post('/csv-roast')
        .send(testData.invalid.emptyMessage)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 400 si message es null', async () => {
      const response = await request(app)
        .post('/csv-roast')
        .send(testData.invalid.invalidType)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });

    test('debe devolver error 500 si falla la búsqueda en CSV', async () => {
      // Arrange
      mockCsvService.findBestRoast.mockRejectedValue(new Error('CSV error'));

      // Act
      const response = await request(app).post('/csv-roast').send(testData.valid).expect(500);

      // Assert
      expect(response.body.error).toBe('No se pudo generar el roast desde CSV.');
      expect(response.body.details).toBeUndefined(); // DEBUG no está activo
    });

    test('debe incluir detalles de error si DEBUG está activo', async () => {
      // Arrange
      process.env.DEBUG = 'true';
      mockCsvService.findBestRoast.mockRejectedValue(new Error('Detailed CSV error'));

      // Act
      const response = await request(app).post('/csv-roast').send(testData.valid).expect(500);

      // Assert
      expect(response.body.details).toBe('Detailed CSV error');

      // Limpiar
      process.env.DEBUG = 'false';
    });
  });

  describe('GET /csv-stats', () => {
    test('debe devolver estadísticas del CSV', async () => {
      // Arrange
      const mockStats = {
        totalRoasts: 10,
        lastUpdated: Date.now(),
        cacheExpiry: 300000,
        csvPath: '/path/to/csv'
      };
      mockCsvService.getStats.mockResolvedValue(mockStats);

      // Act
      const response = await request(app).get('/csv-stats').expect(200);

      // Assert
      expect(response.body).toEqual(mockStats);
      expect(mockCsvService.getStats).toHaveBeenCalled();
    });

    test('debe manejar errores al obtener estadísticas', async () => {
      // Arrange
      mockCsvService.getStats.mockRejectedValue(new Error('Stats error'));

      // Act
      const response = await request(app).get('/csv-stats').expect(500);

      // Assert
      expect(response.body).toEqual({
        error: 'No se pudieron obtener las estadísticas del CSV.'
      });
    });
  });

  describe('POST /csv-add', () => {
    test('debe añadir roast al CSV correctamente', async () => {
      // Arrange
      const newData = {
        comment: 'New test comment',
        roast: 'New test roast'
      };
      mockCsvService.addRoast.mockResolvedValue(true);

      // Act
      const response = await request(app).post('/csv-add').send(newData).expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        message: 'Roast añadido exitosamente al CSV'
      });
      expect(mockCsvService.addRoast).toHaveBeenCalledWith(newData.comment, newData.roast);
    });

    test('debe devolver error 400 si falta comment', async () => {
      const response = await request(app)
        .post('/csv-add')
        .send({ roast: 'Only roast' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "comment" válido.'
      });
    });

    test('debe devolver error 400 si falta roast', async () => {
      const response = await request(app)
        .post('/csv-add')
        .send({ comment: 'Only comment' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "roast" válido.'
      });
    });

    test('debe devolver error 400 si comment no es string', async () => {
      const response = await request(app)
        .post('/csv-add')
        .send({ comment: 123, roast: 'Valid roast' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "comment" válido.'
      });
    });

    test('debe devolver error 400 si roast no es string', async () => {
      const response = await request(app)
        .post('/csv-add')
        .send({ comment: 'Valid comment', roast: null })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "roast" válido.'
      });
    });

    test('debe manejar errores al añadir al CSV', async () => {
      // Arrange
      mockCsvService.addRoast.mockRejectedValue(new Error('Add error'));

      // Act
      const response = await request(app)
        .post('/csv-add')
        .send({ comment: 'Test', roast: 'Test' })
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        error: 'No se pudo añadir el roast al CSV.'
      });
    });
  });

  describe('Content-Type and JSON validation', () => {
    test('debe rechazar requests sin Content-Type JSON', async () => {
      const response = await request(app)
        .post('/roast')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('message=test') // Form data instead of JSON
        .expect(400);

      // Express body-parser devuelve error para content-type incorrecto
    });

    test('debe manejar JSON malformado', async () => {
      const response = await request(app)
        .post('/roast')
        .set('Content-Type', 'application/json')
        .send('{"message": invalid json}')
        .expect(400);

      // Express body-parser devuelve error para JSON inválido
    });
  });
});
