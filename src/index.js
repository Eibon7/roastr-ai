const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// === DEBUG: Diagnóstico de API Keys ===
const isKeyPresent = !!process.env.OPENAI_API_KEY;
console.log("🔍 Diagnóstico API Keys:");
console.log("   - OPENAI_API_KEY presente?", isKeyPresent);

if (isKeyPresent) {
  console.log("   - OPENAI_API_KEY empieza por:", process.env.OPENAI_API_KEY.slice(0, 10) + "...");
} else {
  console.warn("⚠️  No se encontró OPENAI_API_KEY en el entorno. Revisa tu .env o variables en Vercel.");
}
console.log("======================================");

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
      return res.status(400).json({ error: 'Debes enviar un campo "message" en el body' });
    }

    const roast = await roastGenerator.generateRoast(message, null);
    res.json({ roast });
  } catch (error) {
    console.error('Error generando roast:', error.message);
    res.status(500).json({ error: 'Error interno generando el roast.' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
