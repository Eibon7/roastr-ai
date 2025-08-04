const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// === DEBUG: Diagnóstico de API Keys ===
console.log("🔍 Diagnóstico API Keys:");
if (process.env.OPENAI_API_KEY) {
  console.log("   - OPENAI_API_KEY presente: ✅");
  console.log("   - OPENAI_API_KEY empieza por:", process.env.OPENAI_API_KEY.slice(0, 8));
} else {
  console.warn("⚠️  No se encontró OPENAI_API_KEY en el entorno. Revisa tu .env local o Variables de Entorno en Vercel.");
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
      return res.status(400).json({ error: 'Debes enviar un campo "message" válido.' });
    }

    const roast = await roastGenerator.generateRoast(message, null);
    res.json({ roast });
  } catch (error) {
    console.error('❌ Error generando roast:', error);
    res.status(500).json({ error: 'Error interno generando el roast.' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
