const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const RoastGeneratorReal = require('./services/roastGeneratorReal');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Instancia del generador de roasts
const roastGenerator = new RoastGeneratorReal();

// Ruta principal: mostrar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta para generar un roast
app.post('/roast', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
    }

    const roast = await roastGenerator.generateRoast(message, null);
    res.json({ roast });
  } catch (error) {
    console.error('Error generando roast:', error.message);
    res.status(500).json({ error: 'Error interno generando el roast.' });
  }
});

// 🔍 DEBUG: Comprobar si la API key existe en el entorno
console.log("🔍 OPENAI_API_KEY exists?", !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  console.log("🔍 OPENAI_API_KEY starts with:", process.env.OPENAI_API_KEY.slice(0, 10) + "...");
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
