# Plan de Implementación - ROA-259: Frontmatters v2 y Legacy para cada nodo

**Issue:** ROA-259  
**Fecha:** 2025-12-05  
**Estado:** En progreso  
**Rama:** `feature/ROA-259-auto`

---

## Estado Actual

### Nodos v2 (docs/nodes-v2/)

- **Formato actual:** Metadata en markdown (`**Version:**`, `**Status:**`, `**Last Updated:**`)
- **Frontmatter YAML:** ❌ No existe
- **Scripts de validación:** Buscan frontmatter YAML primero, luego fallback a markdown

### Nodos Legacy (docs/nodes/)

- **Formato actual:** Metadata en markdown (`**Node ID:**`, `**Status:**`, `**Coverage:**`)
- **Frontmatter YAML:** ❌ No existe
- **Compatibilidad:** Debe mantenerse para no romper scripts existentes

### Scripts de Validación

- `validate-gdd-runtime.js`: Busca frontmatter YAML (`^---\n...\n---`), luego fallback a markdown
- `score-gdd-health.js`: Mismo comportamiento
- Ambos soportan ambos formatos (YAML + markdown fallback)

---

## Objetivo

Añadir frontmatter YAML v2 a todos los nodos v2 manteniendo compatibilidad con formato legacy para nodos legacy.

---

## Pasos de Implementación

### Paso 1: Definir Estructura de Frontmatter v2

**Basado en system-map-v2.yaml, el frontmatter debe incluir:**

```yaml
---
version: 2.0
status: production|development|deprecated
priority: critical|high|medium|low
owner: Back-end Dev|Front-end Dev|...
last_updated: 2025-12-05
coverage: 85
coverage_source: auto|manual
node_id: roasting-engine|shield-engine|...
depends_on:
  - analysis-engine
  - shield-engine
required_by:
  - frontend-user-app
ssot_references:
  - credit_consumption_rules
  - plan_limits
workers:
  - GenerateRoast
  - GenerateCorrectiveReply
---
```

### Paso 2: Crear Script de Migración

**Script:** `scripts/migrate-nodes-v2-frontmatter.js`

**Funcionalidad:**

1. Leer cada nodo v2 en `docs/nodes-v2/`
2. Extraer metadata actual (markdown)
3. Mapear a system-map-v2.yaml para obtener datos completos
4. Generar frontmatter YAML
5. Insertar al inicio del archivo (después del título `#`)
6. Mantener metadata markdown como comentario o eliminarla (según preferencia)

### Paso 3: Aplicar Frontmatter a Nodos v2

**Nodos a migrar (15 total):**

- `02-autenticacion-usuarios.md`
- `04-integraciones.md`
- `05-motor-analisis.md`
- `06-motor-roasting.md`
- `07-shield.md`
- `08-workers.md`
- `09-panel-usuario.md`
- `10-panel-administracion.md`
- `11-feature-flags.md`
- `12-gdpr-legal.md`
- `13-testing.md`
- `14-infraestructura.md`
- `15-ssot-integration.md`
- `billing.md`
- `observabilidad.md`

### Paso 4: Validar Compatibilidad

**Validaciones:**

1. `node scripts/validate-gdd-runtime.js --full` → Debe pasar
2. `node scripts/score-gdd-health.js --ci` → Debe pasar
3. Verificar que los scripts leen frontmatter YAML correctamente
4. Verificar que el fallback a markdown sigue funcionando para nodos legacy

### Paso 5: Documentar Cambios

**Actualizar:**

- `docs/GDD-ACTIVATION-GUIDE.md` (si aplica)
- README de scripts si hay cambios en formato esperado

---

## Agentes a Usar

- **type:backend** → Para scripts de migración
- **type:docs** → Para actualización de documentación
- **type:analysis** → Para validación de estructura

---

## Archivos Afectados

### Archivos a Modificar

- `docs/nodes-v2/*.md` (15 archivos) → Añadir frontmatter YAML

### Archivos a Crear

- `scripts/migrate-nodes-v2-frontmatter.js` → Script de migración

### Archivos a Validar (No modificar)

- `scripts/validate-gdd-runtime.js` → Verificar compatibilidad
- `scripts/score-gdd-health.js` → Verificar compatibilidad
- `docs/nodes/*.md` → Mantener formato legacy (no tocar)

---

## Validación Requerida

### Pre-commit

```bash
# 1. Validar estructura de frontmatter
node scripts/validate-v2-doc-paths.js --ci

# 2. Validar SSOT health
node scripts/validate-ssot-health.js --ci

# 3. Validar system-map drift
node scripts/check-system-map-drift.js --ci

# 4. Validar strong concepts
node scripts/validate-strong-concepts.js --ci

# 5. Validar GDD runtime
node scripts/validate-gdd-runtime.js --full

# 6. Validar health score
node scripts/score-gdd-health.js --ci
```

### Criterios de Éxito

- ✅ Todos los nodos v2 tienen frontmatter YAML válido
- ✅ Scripts de validación funcionan correctamente
- ✅ Nodos legacy mantienen formato markdown (sin cambios)
- ✅ Health score >= 87
- ✅ 0 errores en validaciones

---

## Notas

- **Compatibilidad:** Los scripts ya soportan ambos formatos (YAML + markdown fallback)
- **Nodos Legacy:** NO modificar, mantener formato markdown actual
- **Nodos v2:** Añadir frontmatter YAML, mantener o eliminar metadata markdown según preferencia
- **System-map-v2.yaml:** Usar como fuente de verdad para mapear datos a frontmatter

---

## Referencias

- `docs/system-map-v2.yaml` → Estructura de nodos y metadata
- `scripts/validate-gdd-runtime.js` → Lógica de parsing de frontmatter
- `scripts/score-gdd-health.js` → Lógica de parsing de frontmatter
- `docs/nodes-v2/` → Nodos a migrar
- `docs/nodes/` → Nodos legacy (no tocar)
