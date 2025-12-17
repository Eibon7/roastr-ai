# Verificación Automática de admin_settings (ROA-268)

## 🎯 Propósito

Este documento describe cómo usar el script de verificación automática para garantizar que la tabla `admin_settings` existe y está correctamente configurada en Supabase.

## 📋 Script de Verificación

**Archivo:** `scripts/verify-admin-settings-table.js`

### Características

- ✅ **Read-only:** No modifica la base de datos
- ✅ **Verificación completa:** Valida tabla, columnas, RLS y políticas
- ✅ **Determinista:** Exit code claro (0 = OK, 1 = fallo)
- ✅ **CI-friendly:** Usable en pipelines de CI/CD

### Requisitos

- Variables de entorno:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`)

### Uso

```bash
# Verificación local
node scripts/verify-admin-settings-table.js

# En CI (con variables de entorno configuradas)
SUPABASE_URL=${{ secrets.SUPABASE_URL }} \
SUPABASE_SERVICE_KEY=${{ secrets.SUPABASE_SERVICE_KEY }} \
node scripts/verify-admin-settings-table.js
```

### Comportamiento

**Exit 0 (éxito):**
- Tabla `admin_settings` existe
- Columnas correctas (key, value, created_at, updated_at)
- RLS habilitado
- Políticas RLS existentes para service_role

**Exit 1 (fallo):**
- Tabla no existe (migración no aplicada)
- Columnas incorrectas
- RLS no habilitado
- Políticas faltantes

## 🔄 Integración en CI

### Opción 1: Workflow Dedicado (Recomendado)

Crear un workflow separado que se ejecute en staging/production:

```yaml
# .github/workflows/verify-admin-settings.yml
name: Verify admin_settings Table

on:
  schedule:
    - cron: '0 0 * * *' # Diario
  workflow_dispatch: # Manual

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - name: Verify admin_settings table
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: node scripts/verify-admin-settings-table.js
```

### Opción 2: Pre-deployment Check

Ejecutar antes de deployments:

```yaml
- name: Verify admin_settings before deployment
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: node scripts/verify-admin-settings-table.js
```

### Opción 3: Manual (Desarrollo)

Ejecutar manualmente cuando sea necesario:

```bash
node scripts/verify-admin-settings-table.js
```

## 📊 Qué Verifica

1. **Existencia de tabla**
   - Intenta leer desde `admin_settings`
   - Detecta si la tabla no existe

2. **Estructura de columnas**
   - `key` (TEXT, PRIMARY KEY)
   - `value` (JSONB)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

3. **RLS habilitado**
   - Verifica que RLS está activo en la tabla

4. **Políticas RLS**
   - Verifica que existen 4 políticas para service_role:
     - SELECT
     - INSERT
     - UPDATE
     - DELETE

## 🚨 Resolución de Fallos

### Tabla no existe

```bash
# Aplicar migración manualmente
# Ver: docs/deployment/admin-settings-migration-ROA-268.md
```

### Columnas incorrectas

```bash
# Verificar migración aplicada correctamente
# Re-aplicar si es necesario: database/migrations/031_create_admin_settings.sql
```

### RLS no habilitado

```sql
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
```

### Políticas faltantes

```sql
-- Ver: database/migrations/031_create_admin_settings.sql
-- Re-aplicar las políticas necesarias
```

## 📝 Notas

- El script es **read-only** y seguro de ejecutar
- No requiere permisos especiales más allá de service_role
- Puede ejecutarse múltiples veces sin efectos secundarios
- Útil para detectar drift entre código y base de datos

---

**Última actualización:** 2025-12-17  
**Relacionado:** ROA-268, Issue #1090

