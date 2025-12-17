# ROA-268: Aplicar migración admin-settings en Supabase (issue #1090)

## 🎯 Objetivo

Aplicar la migración `031_create_admin_settings.sql` en Supabase para crear la tabla `admin_settings` que forma parte de la infraestructura SSOT v2.

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

### 3. Guía de Pasos
- **Archivo:** `MIGRATION-STEPS.md`
- Instrucciones detalladas paso a paso para aplicar la migración
- Checklist de verificación completo

## ✅ Migración Aplicada

La migración `031_create_admin_settings.sql` ha sido aplicada exitosamente en Supabase:

- ✅ Tabla `admin_settings` creada
- ✅ RLS habilitado con 4 políticas (SELECT, INSERT, UPDATE, DELETE)
- ✅ Trigger para auto-actualizar `updated_at`
- ✅ Índice en `updated_at` creado
- ✅ Comentarios de documentación añadidos

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

## 📝 Notas

- La migración es idempotente (usa `IF NOT EXISTS`)
- Solo `service_role` puede acceder por seguridad (RLS)
- La tabla está inicialmente vacía, los valores se añadirán dinámicamente
- Esta migración completa la infraestructura SSOT v2

## ✅ Checklist Pre-Merge

- [x] Migración aplicada en Supabase
- [x] Validaciones v2 pasando
- [x] Documentación completa
- [x] Script helper funcional
- [ ] CodeRabbit review (pendiente)
- [ ] Tests pasando (si aplica)
