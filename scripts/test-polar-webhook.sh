#!/bin/bash

#
# Script para exponer el webhook de Polar localmente con ngrok
#
# Uso:
#   chmod +x scripts/test-polar-webhook.sh
#   ./scripts/test-polar-webhook.sh
#

echo "🚀 Iniciando exposición del webhook de Polar..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok no está instalado."
    echo ""
    echo "Para instalar ngrok:"
    echo "  macOS: brew install ngrok"
    echo "  Linux: snap install ngrok"
    echo "  Windows: descarga desde https://ngrok.com/download"
    echo ""
    echo "Alternativamente, puedes usar localtunnel:"
    echo "  npm install -g localtunnel"
    echo "  lt --port 3000 --subdomain roastr-polar-webhook"
    exit 1
fi

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "⚠️  El servidor no está corriendo en el puerto 3000"
    echo ""
    echo "Por favor, inicia el servidor primero:"
    echo "  Terminal 1: npm start"
    echo "  Terminal 2: ./scripts/test-polar-webhook.sh"
    echo ""
    exit 1
fi

echo "✅ Servidor detectado en http://localhost:3000"
echo ""
echo "📡 Exponiendo webhook con ngrok..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "INSTRUCCIONES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Copia la URL pública que aparecerá abajo (https://xxxxx.ngrok.io)"
echo ""
echo "2. Ve al dashboard de Polar:"
echo "   https://polar.sh/dashboard/webhooks"
echo ""
echo "3. Crea un nuevo webhook con:"
echo "   URL: https://xxxxx.ngrok.io/api/polar/webhook"
echo "   Eventos: Selecciona todos (o los que necesites)"
echo ""
echo "4. Copia el 'Webhook Secret' y añádelo a tu .env:"
echo "   POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx"
echo ""
echo "5. Reinicia el servidor para aplicar los cambios"
echo ""
echo "6. Prueba creando un checkout desde Polar o usando:"
echo "   curl -X POST http://localhost:3000/api/checkout \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"customer_email\":\"test@example.com\",\"price_id\":\"your_price_id\"}'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 URL pública (presiona Ctrl+C para detener):"
echo ""

# Start ngrok
ngrok http 3000
