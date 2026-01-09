# ROA-525: Global Tests and Validation - Plan de Acción

**Fecha:** 2026-01-08
**Estado:** En Progreso
**Prioridad:** P0

---

## 📊 Estado Actual

### Métricas Globales

- **Archivos de test:** 480
  - ✅ Pasando: 91 (18.96%)
  - ❌ Fallando: 388 (80.83%)
  - ⏭️ Skipped: 1

- **Tests individuales:** 3028
  - ✅ Pasando: 2429 (80.22%)
  - ❌ Fallando: 502 (16.58%)
  - ⏭️ Skipped: 97

### Fallos por Categoría



### Patrones de Error

- **Cannot read properties of undefined**: 33 ocurrencias
- **TypeError**: 4 ocurrencias
- **Timeout**: 3 ocurrencias
- **Connection timeout**: 2 ocurrencias

---

## 🎯 Plan de Acción

### 1. [P0] Infrastructure: Database/Supabase connection issues

**Acción:** Verificar configuración de DATABASE_URL y SUPABASE_* vars
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Verificar configuración de DATABASE_URL y SUPABASE_* vars`

---
### 2. [P0] Integration: 0 integration tests failing

**Acción:** Revisar setup de tests de integración y dependencias externas
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Revisar setup de tests de integración y dependencias externas`

---
### 3. [P1] E2E: 0 E2E tests failing

**Acción:** Verificar Playwright setup y browser context
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Verificar Playwright setup y browser context`

---
### 4. [P1] RLS: 0 RLS tests failing

**Acción:** Revisar políticas RLS en Supabase y setup de DB test
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Revisar políticas RLS en Supabase y setup de DB test`

---
### 5. [P2] Code Quality: Tests usando done() callback deprecated

**Acción:** Migrar a promises en tests afectados
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Migrar a promises en tests afectados`

---
### 6. [P2] Unit Tests: 0 unit tests failing

**Acción:** Revisar mocks y dependencias de unit tests
**Tests afectados:** 0

**Pasos:**
1. Identificar archivos afectados
2. Aplicar fix
3. Validar con `npm test -- <ruta>`
4. Commit con mensaje: `fix(ROA-525): Revisar mocks y dependencias de unit tests`

---

## 📝 Validación

Una vez completados los fixes:

```bash
# 1. Ejecutar todos los tests
npm test

# 2. Verificar cobertura
npm run test:coverage

# 3. Validar GDD
node scripts/validate-gdd-runtime.js --full

# 4. Score de health
node scripts/score-gdd-health.js --ci
```

**Criterios de éxito:**
- ✅ 0 tests fallando (100% passing)
- ✅ Coverage >= 90%
- ✅ GDD health >= 87
- ✅ 0 comentarios CodeRabbit

---

**Mantenido por:** Test Engineer
**Última actualización:** 2026-01-08
