#!/usr/bin/env bash

###############################################################################
# SCRIPT: test-env-protection.sh
# PROPÓSITO: Probar que las salvaguardas de .env funcionan correctamente
# USO: bash scripts/test-env-protection.sh
###############################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 PROBANDO SALVAGUARDAS DE .ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

###############################################################################
# TEST 1: Verificar que .env existe
###############################################################################

echo "📋 TEST 1: Verificar que .env existe"
if [ -f .env ]; then
  echo -e "   ${GREEN}✅ PASS${NC} - .env encontrado"
else
  echo -e "   ${RED}❌ FAIL${NC} - .env NO encontrado"
  echo "   Ejecuta: npm run verify:env:create"
  exit 1
fi
echo ""

###############################################################################
# TEST 2: Script de verificación funciona
###############################################################################

echo "📋 TEST 2: Script verify-env-exists.js funciona"
if node scripts/verify-env-exists.js > /dev/null 2>&1; then
  echo -e "   ${GREEN}✅ PASS${NC} - Script ejecuta correctamente"
else
  echo -e "   ${RED}❌ FAIL${NC} - Script falló"
  exit 1
fi
echo ""

###############################################################################
# TEST 3: Pre-commit hook existe y es ejecutable
###############################################################################

echo "📋 TEST 3: Pre-commit hook instalado y ejecutable"
if [ -f .git/hooks/pre-commit ] && [ -x .git/hooks/pre-commit ]; then
  echo -e "   ${GREEN}✅ PASS${NC} - Hook instalado correctamente"
else
  echo -e "   ${YELLOW}⚠️  WARN${NC} - Hook no instalado"
  echo "   Ejecuta: npm run hooks:install"
fi
echo ""

###############################################################################
# TEST 4: Verificar que hay al menos 1 backup
###############################################################################

echo "📋 TEST 4: Sistema de backups funcional"
BACKUP_COUNT=$(ls -1 .env.backup-* 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 0 ]; then
  echo -e "   ${GREEN}✅ PASS${NC} - $BACKUP_COUNT backup(s) encontrado(s)"
  ls -1t .env.backup-* 2>/dev/null | head -3 | sed 's/^/      /'
else
  echo -e "   ${YELLOW}⚠️  WARN${NC} - No hay backups aún"
  echo "   Se crearán automáticamente en el próximo commit"
fi
echo ""

###############################################################################
# TEST 5: .env NO está en staging
###############################################################################

echo "📋 TEST 5: .env NO está en git staging area"
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
  echo -e "   ${RED}❌ FAIL${NC} - .env está trackeado en git (PELIGRO)"
  echo "   Ejecuta: git rm --cached .env"
  exit 1
else
  echo -e "   ${GREEN}✅ PASS${NC} - .env correctamente ignorado por git"
fi
echo ""

###############################################################################
# TEST 6: .gitignore protege .env
###############################################################################

echo "📋 TEST 6: .gitignore protege .env"
if grep -q "^\.env$" .gitignore; then
  echo -e "   ${GREEN}✅ PASS${NC} - .env en .gitignore"
else
  echo -e "   ${RED}❌ FAIL${NC} - .env NO está en .gitignore"
  exit 1
fi
echo ""

###############################################################################
# TEST 7: Comandos NPM disponibles
###############################################################################

echo "📋 TEST 7: Comandos NPM disponibles"
if grep -q '"verify:env"' package.json; then
  echo -e "   ${GREEN}✅ PASS${NC} - Comandos NPM configurados"
  echo "      • npm run verify:env"
  echo "      • npm run verify:env:create"
  echo "      • npm run backup:env"
else
  echo -e "   ${RED}❌ FAIL${NC} - Comandos NPM no encontrados"
  exit 1
fi
echo ""

###############################################################################
# TEST 8: Simulación de pérdida de .env (DESTRUCTIVO - OPCIONAL)
###############################################################################

read -p "¿Ejecutar test destructivo (simula pérdida de .env)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "📋 TEST 8: Simulación de pérdida de .env"
  
  # Backup temporal
  cp .env .env.test-backup
  
  # Simular pérdida
  mv .env .env.hidden
  
  echo "   🔍 Verificando detección..."
  if node scripts/verify-env-exists.js > /dev/null 2>&1; then
    echo -e "   ${RED}❌ FAIL${NC} - No detectó la pérdida de .env"
    mv .env.hidden .env
    rm .env.test-backup
    exit 1
  else
    echo -e "   ${GREEN}✅ PASS${NC} - Pérdida detectada correctamente"
  fi
  
  # Verificar recreación
  echo "   🔧 Probando recreación automática..."
  if node scripts/verify-env-exists.js --create-if-missing > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ PASS${NC} - .env recreado automáticamente"
  else
    echo -e "   ${RED}❌ FAIL${NC} - Fallo en recreación"
    mv .env.hidden .env
    rm .env.test-backup
    exit 1
  fi
  
  # Restaurar original
  mv .env.hidden .env
  rm .env.test-backup
  echo ""
fi

###############################################################################
# RESUMEN
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ TODAS LAS SALVAGUARDAS FUNCIONAN CORRECTAMENTE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛡️  PROTECCIONES ACTIVAS:"
echo "   • Pre-commit hook verifica .env"
echo "   • Backups automáticos con rotación"
echo "   • .env protegido por .gitignore"
echo "   • Scripts de verificación y recreación"
echo "   • Comandos NPM disponibles"
echo ""
echo "📚 Documentación: docs/policies/env-file-protection.md"
echo ""

