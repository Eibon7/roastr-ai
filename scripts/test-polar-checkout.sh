#!/bin/bash

#
# Script de test rápido para verificar checkout de Polar
#
# Uso:
#   chmod +x scripts/test-polar-checkout.sh
#   ./scripts/test-polar-checkout.sh [starter|pro|plus]
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Price IDs de Roastr
PRICE_ID_STARTER="e242580e-41df-4997-aebe-604492249f39"
PRICE_ID_PRO="c1787586-00b7-4790-ba43-1f1e6a60b095"
PRICE_ID_PLUS="176df9af-337f-4607-9524-48978eae8bea"

# Plan seleccionado (default: pro)
PLAN=${1:-pro}

# Determinar Price ID según el plan
case $PLAN in
  starter)
    PRICE_ID=$PRICE_ID_STARTER
    PLAN_NAME="Starter (€5/mes)"
    ;;
  pro)
    PRICE_ID=$PRICE_ID_PRO
    PLAN_NAME="Pro (€12/mes)"
    ;;
  plus)
    PRICE_ID=$PRICE_ID_PLUS
    PLAN_NAME="Plus (€24/mes)"
    ;;
  *)
    echo -e "${RED}❌ Plan inválido: $PLAN${NC}"
    echo ""
    echo "Uso: ./scripts/test-polar-checkout.sh [starter|pro|plus]"
    echo ""
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 Test de Polar Checkout - Plan: $PLAN_NAME${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar que el servidor esté corriendo
echo -e "${YELLOW}⏳ Verificando que el servidor esté corriendo...${NC}"
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${RED}❌ El servidor no está corriendo en http://localhost:3000${NC}"
    echo ""
    echo "Por favor, inicia el servidor:"
    echo "  npm start"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ Servidor corriendo${NC}"
echo ""

# Mostrar información del test
echo -e "${BLUE}📋 Datos del checkout:${NC}"
echo "  Plan: $PLAN"
echo "  Price ID: $PRICE_ID"
echo "  Email: test@roastr.ai"
echo ""

# Crear payload JSON
PAYLOAD=$(cat <<EOF
{
  "customer_email": "test@roastr.ai",
  "price_id": "$PRICE_ID",
  "metadata": {
    "plan": "$PLAN",
    "source": "test-script",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
)

echo -e "${YELLOW}⏳ Creando checkout session...${NC}"
echo ""

# Hacer request al endpoint
RESPONSE=$(curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Verificar si la respuesta es válida
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Checkout creado exitosamente!${NC}"
    echo ""

    # Extraer checkout URL usando jq si está disponible, sino usar grep
    if command -v jq &> /dev/null; then
        CHECKOUT_URL=$(echo "$RESPONSE" | jq -r '.checkout.url')
        CHECKOUT_ID=$(echo "$RESPONSE" | jq -r '.checkout.id')
    else
        CHECKOUT_URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
        CHECKOUT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi

    echo -e "${BLUE}📦 Respuesta del servidor:${NC}"
    echo "$RESPONSE" | (command -v jq &> /dev/null && jq '.' || cat)
    echo ""

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Test completado con éxito${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}🔗 Checkout URL:${NC}"
    echo "  $CHECKOUT_URL"
    echo ""
    echo -e "${YELLOW}🆔 Checkout ID:${NC}"
    echo "  $CHECKOUT_ID"
    echo ""
    echo -e "${YELLOW}📝 Próximos pasos:${NC}"
    echo "  1. Abre la URL en tu navegador"
    echo "  2. Completa el pago con tarjeta de test: 4242 4242 4242 4242"
    echo "  3. Verifica el redirect a /success?checkout_id=..."
    echo ""

    # Preguntar si abrir en navegador
    read -p "¿Quieres abrir la URL en el navegador? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$CHECKOUT_URL"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "$CHECKOUT_URL"
        else
            echo "Abre manualmente: $CHECKOUT_URL"
        fi
    fi

else
    echo -e "${RED}❌ Error al crear checkout${NC}"
    echo ""
    echo -e "${RED}Respuesta del servidor:${NC}"
    echo "$RESPONSE" | (command -v jq &> /dev/null && jq '.' || cat)
    echo ""

    # Verificar si es error de configuración
    if echo "$RESPONSE" | grep -q "Configuration error"; then
        echo -e "${YELLOW}💡 Sugerencia:${NC}"
        echo "  Verifica que POLAR_ACCESS_TOKEN esté configurado en .env"
        echo ""
        echo "  cat .env | grep POLAR_ACCESS_TOKEN"
        echo ""
    fi

    exit 1
fi
