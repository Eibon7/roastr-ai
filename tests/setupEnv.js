/**
 * Configuración de variables de entorno para tests
 * Se ejecuta antes de todos los tests para cargar .env.test
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.test') });

// Asegurar que NODE_ENV esté configurado para tests
process.env.NODE_ENV = 'test';
