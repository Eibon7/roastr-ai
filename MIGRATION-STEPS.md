# Pasos para Aplicar Migración Admin Settings (ROA-268)

## 📋 Instrucciones Paso a Paso

### Paso 1: Abrir Supabase SQL Editor

1. Ve a tu dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a la sección **SQL Editor** (menú lateral izquierdo)
4. Haz clic en **New Query** o **New SQL Query**

### Paso 2: Copiar el SQL de Migración

El SQL completo está en: `database/migrations/031_create_admin_settings.sql`

**SQL completo para copiar:**

```sql
-- Migration: Create admin_settings table for SSOT v2
-- Issue: #1090
-- Date: 2025-01-27
-- Description: Creates admin_settings table for dynamic runtime configuration
--              This is part of the Single Source of Truth (SSOT) infrastructure for v2

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on updated_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at ON admin_settings(updated_at);

-- Add comment to table
COMMENT ON TABLE admin_settings IS 'Dynamic runtime configuration for SSOT v2. Values here override admin-controlled.yaml.';

-- Add comment to columns
COMMENT ON COLUMN admin_settings.key IS 'Dot-separated key path (e.g., shield.default_aggressiveness)';
COMMENT ON COLUMN admin_settings.value IS 'JSONB value for the setting';
COMMENT ON COLUMN admin_settings.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN admin_settings.created_at IS 'Timestamp of creation';

-- Enable RLS (Row Level Security) - Only service role can access
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read
CREATE POLICY "Service role can read admin_settings"
  ON admin_settings
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Only service role can insert
CREATE POLICY "Service role can insert admin_settings"
  ON admin_settings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Only service role can update
CREATE POLICY "Service role can update admin_settings"
  ON admin_settings
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Only service role can delete
CREATE POLICY "Service role can delete admin_settings"
  ON admin_settings
  FOR DELETE
  TO service_role
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on UPDATE
CREATE TRIGGER update_admin_settings_timestamp
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_updated_at();
```

### Paso 3: Pegar y Ejecutar

1. Pega el SQL completo en el editor
2. Haz clic en el botón **Run** (o presiona `Cmd+Enter` / `Ctrl+Enter`)
3. Espera a que se complete la ejecución (debería tomar ~1 segundo)

### Paso 4: Verificar que la Migración se Aplicó Correctamente

Ejecuta estas queries de verificación en el SQL Editor:

#### 4.1 Verificar que la tabla existe

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'admin_settings';
```

**Resultado esperado:** Debe retornar una fila con `admin_settings`

#### 4.2 Verificar estructura de columnas

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_settings'
ORDER BY ordinal_position;
```

**Resultado esperado:** Debe mostrar 4 columnas:
- `key` (text, NOT NULL)
- `value` (jsonb, NOT NULL)
- `updated_at` (timestamp with time zone, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL)

#### 4.3 Verificar RLS policies

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'admin_settings';
```

**Resultado esperado:** Debe mostrar 4 policies (SELECT, INSERT, UPDATE, DELETE) todas para `service_role`

#### 4.4 Verificar trigger

```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'admin_settings';
```

**Resultado esperado:** Debe mostrar el trigger `update_admin_settings_timestamp`

#### 4.5 Verificar que la tabla está vacía (inicialmente)

```sql
SELECT COUNT(*) FROM admin_settings;
```

**Resultado esperado:** Debe retornar `0` (tabla vacía es correcto inicialmente)

---

## ✅ Checklist de Verificación

- [ ] SQL ejecutado sin errores
- [ ] Tabla `admin_settings` existe
- [ ] Estructura de columnas correcta (4 columnas)
- [ ] RLS policies creadas (4 policies)
- [ ] Trigger creado y funcionando
- [ ] Tabla inicialmente vacía (COUNT = 0)

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, la migración estará aplicada y podrás:

1. Usar `admin_settings` desde el backend v2
2. El sistema SSOT v2 estará completamente funcional
3. Podrás modificar settings en runtime desde el admin panel

---

## 📝 Notas

- Esta migración es **idempotente** (usa `IF NOT EXISTS`), así que puedes ejecutarla múltiples veces sin problemas
- La tabla estará vacía inicialmente, los valores se añadirán dinámicamente cuando se necesiten
- Solo `service_role` puede acceder por seguridad (RLS)

---

**¿Necesitas ayuda?** Revisa `docs/deployment/admin-settings-migration-ROA-268.md` para más detalles.

