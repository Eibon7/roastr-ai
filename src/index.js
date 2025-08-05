const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const RoastGeneratorReal = require('./services/roastGeneratorReal');
const CsvRoastService = require('./services/csvRoastService');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Instancia del generador de roasts
let roastGenerator;
try {
  roastGenerator = new RoastGeneratorReal();
} catch (error) {
  console.error("❌ Error inicializando RoastGenerator:", error.message);
  process.exit(1);
}

// Instancia del servicio de CSV roasts
const csvRoastService = new CsvRoastService();

// Ruta principal: mostrar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta para generar un roast normal
app.post('/roast', async (req, res) => {
  const { message, tone } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
  }

  // Validar el tono si se proporciona
  const validTones = ['sarcastic', 'subtle', 'direct'];
  const selectedTone = tone && validTones.includes(tone) ? tone : 'sarcastic';

  try {
    const roast = await roastGenerator.generateRoast(message, null, selectedTone);
    res.json({ roast, tone: selectedTone });
  } catch (error) {
    console.error('❌ Error generando roast:', error.message);

    if (error.response?.data) {
      console.error('📡 Respuesta de la API:', error.response.data);
    }

    res.status(500).json({ error: 'No se pudo generar el roast en este momento.' });
  }
});

// 📌 RUTA: Roast desde CSV con datos reales
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
    console.error('❌ Error generando roast desde CSV:', error.message);
    
    // Log additional details if debug mode is enabled
    if (process.env.DEBUG === 'true') {
      console.error('📡 CSV Error details:', error.stack);
    }
    
    res.status(500).json({ 
      error: 'No se pudo generar el roast desde CSV.',
      details: process.env.DEBUG === 'true' ? error.message : undefined
    });
  }
});

// 📌 RUTA: Obtener estadísticas del CSV
app.get('/csv-stats', async (req, res) => {
  try {
    const stats = await csvRoastService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas CSV:', error.message);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas del CSV.' });
  }
});

// 📌 RUTA: Añadir nuevo roast al CSV
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
    console.error('❌ Error añadiendo roast al CSV:', error.message);
    res.status(500).json({ error: 'No se pudo añadir el roast al CSV.' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
