const path = require("path");
app.use(express.static(path.join(__dirname, "../public")));
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const RoastGeneratorReal = require('./services/roastGeneratorReal');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Instancia del generador de roasts
const roastGenerator = new RoastGeneratorReal();

// Ruta de prueba (GET)
app.get('/', (req, res) => {
  res.json({ message: 'Roastr.ai API is running 🚀' });
});

// Ruta principal para generar un roast
app.post('/roast', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Debes enviar un campo "message" con el texto a evaluar.' });
    }

    // Por ahora ignoramos el toxicityScore porque no tenemos Perspective API real
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
