# V2-Only Validators

Validadores para garantizar que TODO desarrollo nuevo use EXCLUSIVAMENTE artefactos Roastr V2.

**Issue:** ROA-538  
**Versión:** 1.0.0  
**Fecha:** 2025-01-22

---

## 🎯 Propósito

Bloquear cualquier acceso (modificación/import) a artefactos legacy V1 en código nuevo, mientras permite lectura pasiva para contexto.

---

## 📦 Componentes

### 1. Validador del Loop

**Script:** `scripts/loop/validators/v2-only.js`

**Uso:**

```bash
# Pre-task (antes de comenzar tarea del Loop)
node scripts/loop/validators/v2-only.js --pre-task

# Post-task (después de completar tarea del Loop)
node scripts/loop/validators/v2-only.js --post-task

# Manual (análisis ad-hoc)
node scripts/loop/validators/v2-only.js

# Ayuda
node scripts/loop/validators/v2-only.js --help
```

**Exit Codes:**
- `0` - PASS (no violaciones detectadas)
- `1` - BLOCK (violaciones detectadas, detener inmediatamente)

**Características:**
- ✅ Analiza archivos modificados (git diff)
- ✅ Detecta imports desde módulos legacy
- ✅ Detecta referencias a IDs legacy
- ✅ Detecta uso de workers/servicios legacy
- ✅ NO bloquea lectura pasiva (inspección sin modificar)
- ✅ Mensajes de error detallados con sugerencias

---

### 2. Detector de CI

**Script:** `scripts/ci/detect-legacy-v1.js` (reforzado)

**Uso:**

```bash
# Scan completo del repo
node scripts/ci/detect-legacy-v1.js --full

# Scan de archivos modificados (default)
node scripts/ci/detect-legacy-v1.js

# Scan de directorio específico
node scripts/ci/detect-legacy-v1.js --path=apps/backend-v2/

# Modo CI (minimal output)
node scripts/ci/detect-legacy-v1.js --ci
```

**Diferencias con v2-only.js:**

| Aspecto | v2-only.js | detect-legacy-v1.js |
|---------|------------|---------------------|
| Propósito | Gate del Loop | CI/Observabilidad |
| Ejecución | Pre/Post-task | CI workflow |
| Scope | Archivos modificados | Repo completo o modificados |
| Acción | BLOCK inmediato | Reportar violaciones |
| Carga dinámica | No (hardcoded) | Sí (system-map-v2.yaml) |

---

## 🛡️ Fuentes Permitidas vs Prohibidas

### ✅ Permitidas (V2 Only)

**Documentación:**
- `docs/SSOT-V2.md`
- `docs/nodes-v2/**/*.md`
- `docs/system-map-v2.yaml`
- `docs/SSOT/` (archivos auxiliares)

**Código:**
- `apps/backend-v2/**/*`
- `apps/frontend-v2/**/*`
- `apps/shared/**/*`

**Scripts:**
- `scripts/loop/**/*`
- `scripts/ci/**/*`
- `scripts/shared/**/*`

### ❌ Prohibidas (Legacy V1)

**Documentación:**
- `docs/legacy/**/*`
- `docs/nodes/**/*.md` (sin `-v2`)
- `docs/system-map.yaml` (sin `-v2`)
- `spec.md`

**Código:**
- `src/**/*` (Backend V1)
- `frontend/**/*` (Frontend V1)

**Workers/Servicios:**
- `GenerateReplyWorker` → Usar `GenerateRoast`
- `PublisherWorker` → Usar `SocialPosting`
- `BillingWorker` → Usar `BillingUpdate`
- `stripeService` → Usar Polar billing

**IDs:**
- `roast` → Usar `roasting-engine`
- `shield` → Usar `shield-engine`
- `persona` → Usar `analysis-engine`
- Plan IDs: `free`, `basic`, `creator_plus` → Usar IDs Polar

---

## 🔍 Detecciones

### 1. Modificación de Archivos Legacy

```bash
# ❌ VIOLACIÓN
git diff --name-only | grep "docs/legacy/"
git diff --name-only | grep "docs/nodes/[^-v2]"
git diff --name-only | grep "spec.md"
```

### 2. Imports Legacy

```javascript
// ❌ VIOLACIÓN - Import desde V1
import { RoastService } from '../../../src/services/roastService';

// ✅ CORRECTO - Import desde V2
import { RoastService } from '../../../apps/backend-v2/src/services/roastService';
```

### 3. Referencias a IDs Legacy

```javascript
// ❌ VIOLACIÓN - ID legacy
const node = 'roast';
const plan = 'free';

// ✅ CORRECTO - ID V2
const node = 'roasting-engine';
const plan = 'starter_trial';
```

### 4. Uso de Workers Legacy

```javascript
// ❌ VIOLACIÓN - Worker legacy
const worker = new GenerateReplyWorker();

// ✅ CORRECTO - Worker V2
const worker = new GenerateRoast();
```

---

## ✅ Lectura Pasiva (Permitido)

**Estas acciones NO son violaciones:**

- ✅ Leer archivo legacy para entender contexto
- ✅ Navegar repo sin modificar archivos
- ✅ Inspeccionar código legacy en IDE
- ✅ Copiar snippet como referencia (sin ejecutar)
- ✅ Analizar comportamiento legacy

**Ejemplo:**

```javascript
// ✅ PERMITIDO - Comentario de referencia
// Legacy V1 behavior (src/services/roastService.js):
// - Used OpenAI directly without cost control
// - No multi-tenant support
//
// V2 implementation (apps/backend-v2/src/services/roastService.ts):
// - Uses costControl + Polar billing
// - Full multi-tenant support
```

---

## ❌ Acceso Activo (Bloqueado)

**Estas acciones SÍ son violaciones:**

- ❌ Modificar archivo legacy
- ❌ Importar módulo legacy en código nuevo
- ❌ Referenciar ruta legacy en código ejecutable
- ❌ Usar worker/servicio legacy
- ❌ Añadir dependencia a módulo legacy

---

## 🧪 Tests

**Suite:** `tests/validators/v2-only.test.js`

**Ejecutar:**

```bash
# Todos los tests
npm test tests/validators/v2-only.test.js

# Con coverage
npm run test:coverage tests/validators/v2-only.test.js
```

**Cobertura:**
- 28 tests unitarios
- 100% cobertura de funciones principales
- Todos los casos edge cubiertos

---

## 🚨 Mensajes de Error

### Ejemplo: Modificación de Archivo Legacy

```text
🚨 BLOCK - Modificación de Archivo Legacy Detectada

Archivo: docs/legacy/v1/roast-flow.md
Acción: Modificación
Razón: Archivos legacy están protegidos y no deben modificarse

Acción requerida:
1. Revertir cambios en archivo legacy
2. Si necesitas información, léelo pasivamente (sin modificar)
3. Implementa cambios en artefactos V2 equivalentes

Equivalente V2: docs/nodes-v2/06-motor-roasting.md
```

### Ejemplo: Import Legacy

```text
🚨 BLOCK - Import desde Módulo Legacy Detectado

Archivo: scripts/loop/task-processor.js
Línea: 15
Import: import { RoastService } from '../../../src/services/roastService';
Razón: Imports desde src/ (V1) están prohibidos en código nuevo

Acción requerida:
1. Remover import legacy
2. Usar módulo V2 equivalente
3. Si no existe equivalente V2, crear issue

Equivalente V2: apps/backend-v2/src/services/roastService.ts
```

---

## 🔗 Referencias

- **Cursor Rule:** `.cursor/rules/v2-only-strict.mdc`
- **Plan de Issue:** `docs/plan/issue-ROA-538.md`
- **Resumen Implementación:** `docs/plan/issue-ROA-538-IMPLEMENTATION-SUMMARY.md`
- **SSOT V2:** `docs/SSOT-V2.md`
- **System Map V2:** `docs/system-map-v2.yaml`

---

## 💡 Tips

### 1. Antes de Comenzar Tarea

```bash
# Ejecutar pre-task validation
node scripts/loop/validators/v2-only.js --pre-task

# Si PASS → continuar
# Si BLOCK → resolver violaciones primero
```

### 2. Después de Completar Tarea

```bash
# Ejecutar post-task validation
node scripts/loop/validators/v2-only.js --post-task

# Si PASS → continuar con commit
# Si BLOCK → revertir cambios problemáticos
```

### 3. En CI/CD

```bash
# Scan completo antes de merge
node scripts/ci/detect-legacy-v1.js --full

# Si violaciones → bloquear merge
```

### 4. Si Necesitas Contexto Legacy

**HACER:**
- Leer archivo legacy pasivamente
- Tomar notas sobre comportamiento
- Implementar equivalente en V2

**NO HACER:**
- Modificar archivo legacy
- Importar módulo legacy
- Copiar/pegar código legacy directamente

---

## 📞 Soporte

**Si encuentras:**
- Falsos positivos → Reportar en issue ROA-538
- Detecciones faltantes → Añadir patrón al validador
- Dudas sobre qué es legacy → Consultar `system-map-v2.yaml`

---

**Última actualización:** 2025-01-22  
**Versión:** 1.0.0  
**Issue:** ROA-538
