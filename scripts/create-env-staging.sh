#!/bin/bash

# ============================================================
# Script para crear .env.staging desde template
# ============================================================
# Este script copia el template a .env.staging
# Uso: ./scripts/create-env-staging.sh
# ============================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

TEMPLATE_FILE="$PROJECT_ROOT/env.staging.template"
TARGET_FILE="$PROJECT_ROOT/.env.staging"

echo "📋 Creando archivo .env.staging para entorno de staging..."

# Verificar que el template existe
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "❌ Error: Template no encontrado en $TEMPLATE_FILE"
  exit 1
fi

# Advertencia si .env.staging ya existe
if [ -f "$TARGET_FILE" ]; then
  echo "⚠️  Advertencia: .env.staging ya existe"
  read -p "¿Deseas sobrescribirlo? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
  fi
  echo "🔄 Creando backup del archivo existente..."
  cp "$TARGET_FILE" "$TARGET_FILE.backup.$(date +%Y%m%d_%H%M%S)"
  
  # Mantener solo los últimos 5 backups para evitar acumulación
  echo "🧹 Limpiando backups antiguos (manteniendo últimos 5)..."
  ls -t "$TARGET_FILE.backup."* 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

# Copiar template a .env.staging
cp "$TEMPLATE_FILE" "$TARGET_FILE"

echo "✅ Archivo .env.staging creado exitosamente"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Edita .env.staging y añade los valores necesarios"
echo "   2. Verifica que .env.staging NO está en git: git status"
echo "   3. Nunca commitees .env.staging (está protegido por .gitignore)"
echo ""
echo "🔒 Recuerda: .env.staging debe contener SOLO valores de staging"
echo "            NO uses valores de producción en este archivo"

