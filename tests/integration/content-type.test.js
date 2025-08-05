/**
 * Tests para validar el manejo de Content-Type
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

describe('Content-Type Validation', () => {
  let app;

  beforeEach(() => {
    // Crear app que replica la configuración de src/index.js
    app = express();

    // Middleware para validar Content-Type (antes de bodyParser)
    app.use((req, res, next) => {
      if (req.method === 'POST' && req.path !== '/' && !req.is('application/json')) {
        return res.status(400).json({ error: 'Content-Type debe ser application/json' });
      }
      next();
    });

    // Middleware para parsear JSON
    app.use(bodyParser.json());

    // Middleware para manejar errores de JSON inválido
    app.use((error, req, res, next) => {
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ error: 'JSON inválido en la petición' });
      }
      next();
    });

    // Ruta de prueba
    app.post('/test', (req, res) => {
      res.json({ message: 'Success', body: req.body });
    });
  });

  test('debe aceptar requests con Content-Type application/json', async () => {
    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send({ message: 'test' })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Success',
      body: { message: 'test' }
    });
  });

  test('debe rechazar requests sin Content-Type JSON', async () => {
    const response = await request(app)
      .post('/test')
      .send('message=test') // Form data
      .expect(400);

    expect(response.body).toEqual({
      error: 'Content-Type debe ser application/json'
    });
  });

  test('debe rechazar requests con Content-Type incorrecto', async () => {
    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'text/plain')
      .send('plain text')
      .expect(400);

    expect(response.body).toEqual({
      error: 'Content-Type debe ser application/json'
    });
  });

  test('debe manejar JSON inválido correctamente', async () => {
    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}') // JSON malformado
      .expect(400);

    expect(response.body).toEqual({
      error: 'JSON inválido en la petición'
    });
  });
});