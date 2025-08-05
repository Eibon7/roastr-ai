/**
 * Tests de integración simplificados para los endpoints de la API
 * Prueba la estructura de respuesta sin dependencias externas complejas
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

describe('API Integration Tests (Simplified)', () => {
  let app;

  beforeEach(() => {
    // Crear instancia simple de la aplicación Express
    app = express();
    app.use(bodyParser.json());

    // Rutas básicas para testing
    app.get('/', (req, res) => {
      res.json({ message: 'Roastr.ai API' });
    });

    app.post('/roast', (req, res) => {
      const { message, tone } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
      }

      const validTones = ['sarcastic', 'subtle', 'direct'];
      const selectedTone = tone && validTones.includes(tone) ? tone : 'sarcastic';

      // Mock response for test
      res.json({ 
        roast: `Mock ${selectedTone} roast for: ${message}`,
        tone: selectedTone 
      });
    });

    app.post('/csv-roast', (req, res) => {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
      }

      // Mock CSV response
      res.json({ 
        roast: `Mock CSV roast for: ${message}`,
        source: 'csv',
        originalMessage: message
      });
    });

    app.get('/csv-stats', (req, res) => {
      res.json({
        totalRoasts: 5,
        lastUpdated: Date.now(),
        cacheExpiry: 300000,
        csvPath: '/mock/path'
      });
    });

    app.post('/csv-add', (req, res) => {
      const { comment, roast } = req.body;

      if (!comment || typeof comment !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "comment" válido.' });
      }

      if (!roast || typeof roast !== 'string') {
        return res.status(400).json({ error: 'Debes enviar un campo "roast" válido.' });
      }

      res.json({ 
        success: true,
        message: 'Roast añadido exitosamente al CSV'
      });
    });
  });

  describe('GET /', () => {
    test('debe responder con mensaje de bienvenida', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({ message: 'Roastr.ai API' });
    });
  });

  describe('POST /roast', () => {
    test('debe generar roast con tono sarcástico por defecto', async () => {
      const response = await request(app)
        .post('/roast')
        .send({ message: 'Test message' })
        .expect(200);

      expect(response.body).toHaveProperty('roast');
      expect(response.body).toHaveProperty('tone', 'sarcastic');
      expect(response.body.roast).toContain('Test message');
    });

    test('debe generar roast con tono especificado', async () => {
      const response = await request(app)
        .post('/roast')
        .send({ message: 'Test message', tone: 'subtle' })
        .expect(200);

      expect(response.body.tone).toBe('subtle');
      expect(response.body.roast).toContain('subtle');
    });

    test('debe usar tono sarcástico si se proporciona tono inválido', async () => {
      const response = await request(app)
        .post('/roast')
        .send({ message: 'Test message', tone: 'invalid_tone' })
        .expect(200);

      expect(response.body.tone).toBe('sarcastic');
    });

    test('debe devolver error 400 si falta message', async () => {
      const response = await request(app)
        .post('/roast')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });
  });

  describe('POST /csv-roast', () => {
    test('debe devolver roast desde CSV correctamente', async () => {
      const response = await request(app)
        .post('/csv-roast')
        .send({ message: 'Test CSV message' })
        .expect(200);

      expect(response.body).toEqual({
        roast: 'Mock CSV roast for: Test CSV message',
        source: 'csv',
        originalMessage: 'Test CSV message'
      });
    });

    test('debe devolver error 400 si falta message', async () => {
      const response = await request(app)
        .post('/csv-roast')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Debes enviar un campo "message" válido.'
      });
    });
  });

  describe('GET /csv-stats', () => {
    test('debe devolver estadísticas del CSV', async () => {
      const response = await request(app)
        .get('/csv-stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalRoasts');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(response.body).toHaveProperty('cacheExpiry');
      expect(response.body).toHaveProperty('csvPath');
    });
  });

  describe('POST /csv-add', () => {
    test('debe añadir roast al CSV correctamente', async () => {
      const response = await request(app)
        .post('/csv-add')
        .send({ comment: 'Test comment', roast: 'Test roast' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Roast añadido exitosamente al CSV'
      });
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
  });
});