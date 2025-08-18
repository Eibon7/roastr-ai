# Naming Conventions - Case Sensitivity Guide

Este documento establece las convenciones de nombres para mantener compatibilidad cross-platform entre macOS, Linux y Windows.

## 🚨 Importancia de Case Sensitivity

**Problema**: macOS es case-insensitive por defecto, pero Linux (CI) es case-sensitive. Esto causa que imports que funcionan en desarrollo (Mac) fallen en producción (Linux CI).

**Solución**: Usar convenciones estrictas y herramientas automatizadas para detectar problemas.

## 📁 Convenciones de Directorios

```
✅ BIEN - minúsculas
frontend/src/pages/
frontend/src/components/
frontend/src/hooks/
frontend/src/utils/

❌ MAL - mayúsculas o mixto
frontend/src/Pages/
frontend/src/Components/
frontend/src/HOOKS/
```

## 📄 Convenciones de Archivos

### Componentes React
```
✅ BIEN - PascalCase
UserCard.jsx
AdminDashboard.jsx
StyleProfile.jsx

❌ MAL - otros formatos
userCard.jsx
admin-dashboard.jsx
style_profile.jsx
```

### Páginas
```
✅ BIEN - PascalCase (excepción para legacy)
dashboard.jsx (legacy - mantener)
Connect.jsx
Billing.jsx
Settings.jsx

❌ MAL - inconsistente
Dashboard.jsx (cuando el archivo es dashboard.jsx)
BILLING.jsx
```

### Utilidades y Servicios
```
✅ BIEN - camelCase
authService.js
socialAPI.js
testUtils.js

❌ MAL - otros formatos
AuthService.js
social_api.js
test-utils.js
```

## 📝 Convenciones de Imports

### ✅ REGLA DORADA: Import Exacto
**El import DEBE coincidir EXACTAMENTE con el nombre del archivo en disco.**

```javascript
// ✅ BIEN - coincide exactamente
import Dashboard from './pages/dashboard';     // para dashboard.jsx
import Connect from './pages/Connect';         // para Connect.jsx
import { authService } from './utils/authService'; // para authService.js

// ❌ MAL - casing diferente
import Dashboard from './pages/Dashboard';     // archivo es dashboard.jsx
import connect from './pages/connect';         // archivo es Connect.jsx
import { AuthService } from './utils/authService'; // exporta authService
```

## 🛠️ Herramientas de Validación

### 1. Pre-commit Hook
```bash
# .husky/pre-commit
npm run build:ci    # Build verificación
```

### 2. CI Validation 
```yaml
# GitHub Actions
- name: Check file listing (Linux perspective)
  run: ls -R frontend/src/pages || true

- name: Frontend build check
  run: cd frontend && npm run build:ci
```

## 🚨 Casos Problemáticos Comunes

### Dashboard vs dashboard
```javascript
// ❌ PROBLEMA COMÚN
import Dashboard from './pages/Dashboard'; // Mac: ✅ Linux: ❌

// ✅ SOLUCIÓN
import Dashboard from './pages/dashboard'; // archivo: dashboard.jsx
```

## 🔧 Debugging Case Issues

### 1. Verificar nombres reales en disco
```bash
# Ver nombres exactos (case-sensitive)
ls -la frontend/src/pages/
git ls-files frontend/src/pages/
```

### 2. Test en Linux-like environment
```bash
# Build check
npm run build:ci
```

## 🎯 Checklist Pre-Merge

- [ ] ✅ `npm run build:ci` compila sin errores  
- [ ] ✅ Nombres de archivo coinciden con imports exactamente
- [ ] ✅ Directorios en minúsculas
- [ ] ✅ Componentes en PascalCase
- [ ] ✅ Pre-commit hook configurado

## 🆘 Fix Rápido para CI Failure

Si CI falla por case sensitivity:

```bash
# 1. Encontrar el import problemático
grep -r "import.*Dashboard" frontend/src/

# 2. Verificar nombre real del archivo
ls frontend/src/pages/dashboard*

# 3. Corregir import
# Cambiar: import Dashboard from './pages/Dashboard';
# A:       import Dashboard from './pages/dashboard';

# 4. Test local
npm run build:ci

# 5. Commit y push
git add . && git commit -m "fix: correct case-sensitive import"
```

---

**⚠️ RECUERDA**: En caso de duda, siempre usar el nombre exacto del archivo tal como aparece en `git ls-files` o `ls -la`.