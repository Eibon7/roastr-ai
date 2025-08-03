const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require("path");

const RoastGeneratorReal = require('./services/roastGeneratorReal');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, "../public")));

// Instancia del generador de roasts
const roastGenerator = new RoastGeneratorReal();

// Ruta para servir el frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Ruta principal para generar un roast
app.post('/roast', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Debes enviar un campo "message" con texto válido.' });
    }

    // Por ahora ignoramos el toxicityScore porque no tenemos Perspective API aún
    const roast = await roastGenerator.generateRoast(message, null);

    res.json({ roast });
  } catch (error) {
    console.error('Error generando roast:', error.message);
    res.status(500).json({ error: 'Error interno generando el roast.' });
  }
});

// Arrancar servidor
app.listen(port, () => {
  console.log(`🔥 Roastr.ai API escuchando en http://localhost:${port}`);
});
