# ROA-268: Aplicar migración admin-settings en Supabase (issue #1090)

## 🎯 Objetivo

Aplicar la migración `031_create_admin_settings.sql` en Supabase para crear la tabla `admin_settings` que forma parte de la infraestructura SSOT v2.

**Nota:** Este PR se enfoca únicamente en el trabajo original de ROA-268. El validador genérico de infraestructura está en PR #1163.

## ✅ Cambios Realizados

### 1. Script Helper de Migración
- **Archivo:** `scripts/apply-admin-settings-migration.js`
- Proporciona instrucciones paso a paso para aplicar la migración manualmente
- Incluye preview del SQL, enlaces al SQL Editor y comandos de verificación

### 2. Documentación de Migración
- **Archivo:** `docs/deployment/admin-settings-migration-ROA-268.md`
- Guía completa con instrucciones de aplicación
- Verificaciones post-migración (tabla, estructura, RLS, triggers)
- Referencias a documentación relacionada

### 3. Script de Verificación Automática
- **Archivo:** `scripts/verify-admin-settings-table.js`
- Verifica automáticamente que la tabla existe y está correctamente configurada
- Read-only: no modifica la base de datos
- Usable en CI para garantizar que la migración está aplicada

### 4. Guía de Pasos
- **Archivo:** `MIGRATION-STEPS.md`
- Instrucciones detalladas paso a paso para aplicar la migración
- Checklist de verificación completo

## ✅ Verificación Automática de Migración

La migración `031_create_admin_settings.sql` puede ser aplicada manualmente, y su existencia es verificada automáticamente mediante el script `verify-admin-settings-table.js`.

**El script verifica:**
- ✅ Existencia de la tabla `admin_settings`
- ✅ Estructura de columnas correcta (key, value, created_at, updated_at)
- ✅ RLS habilitado
- ✅ Políticas RLS existentes para service_role (SELECT, INSERT, UPDATE, DELETE)

**Comportamiento:**
- `exit 0`: Todas las verificaciones pasaron
- `exit 1`: Una o más verificaciones fallaron (migración puede no estar aplicada)

**El script es read-only** y no modifica la base de datos. El sistema confía en la verificación automática, no en suposiciones humanas.

## 📋 Validaciones Ejecutadas

- ✅ `validate-v2-doc-paths.js --ci` - Todos los paths declarados existen
- ✅ `validate-ssot-health.js --ci` - Health Score: 100/100
- ✅ `check-system-map-drift.js --ci` - System-map drift check passed
- ✅ `validate-strong-concepts.js --ci` - All Strong Concepts properly owned

## 🔗 Relacionado

- **Issue original:** #1090
- **Plan de implementación:** `docs/plan/issue-1090.md`
- **Completion report:** `docs/plan/issue-1090-COMPLETION.md`
- **SSOT Architecture:** `docs/architecture/sources-of-truth.md`
- **Validador genérico de infraestructura:** PR #1163

## 📝 Notas

- La migración es idempotente (usa `IF NOT EXISTS`)
- Solo `service_role` puede acceder por seguridad (RLS)
- La tabla está inicialmente vacía, los valores se añadirán dinámicamente
- Esta migración completa la infraestructura SSOT v2

## ✅ Checklist Pre-Merge

- [x] Script de verificación automática creado
- [x] Verificación read-only (no modifica DB)
- [x] Documentación actualizada para reflejar verificación automática
- [x] Validaciones v2 pasando
- [x] Script helper funcional
- [ ] CodeRabbit review (pendiente)
- [ ] Tests pasando (si aplica)
