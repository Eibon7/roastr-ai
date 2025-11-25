# Issue #920: Migración de Base de Datos

## Descripción

Esta migración añade campos para almacenar metadata de Portkey AI Gateway en la tabla `roasts_metadata`.

## Campos Añadidos

- `mode` (VARCHAR(50)): Modo AI usado para la generación (default, flanders, balanceado, canalla, nsfw)
- `provider` (VARCHAR(50)): Proveedor LLM usado (openai, grok, claude, etc.)
- `fallback_used` (BOOLEAN): Indica si se usó un proveedor de fallback
- `portkey_metadata` (JSONB): Metadata adicional de Portkey

## Índices Creados

- `idx_roasts_metadata_mode`: Índice en columna `mode`
- `idx_roasts_metadata_provider`: Índice en columna `provider`
- `idx_roasts_metadata_fallback_used`: Índice en columna `fallback_used`

## Ejecución

### Opción 1: Script Automático

```bash
./scripts/run-migration-920.sh
```

### Opción 2: Manual con psql

```bash
psql $DATABASE_URL -f database/migrations/056_add_portkey_metadata_to_roasts.sql
```

### Opción 3: Desde Node.js (si tienes un script de migraciones)

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationFile = path.join(
  __dirname,
  '../database/migrations/056_add_portkey_metadata_to_roasts.sql'
);
const sql = fs.readFileSync(migrationFile, 'utf8');

// Ejecutar con tu cliente de base de datos preferido
```

## Verificación

Después de ejecutar la migración, verifica que las columnas fueron añadidas:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'roasts_metadata'
AND column_name IN ('mode', 'provider', 'fallback_used', 'portkey_metadata');
```

## Rollback (si es necesario)

```sql
ALTER TABLE roasts_metadata
DROP COLUMN IF EXISTS mode,
DROP COLUMN IF EXISTS provider,
DROP COLUMN IF EXISTS fallback_used,
DROP COLUMN IF EXISTS portkey_metadata;

DROP INDEX IF EXISTS idx_roasts_metadata_mode;
DROP INDEX IF EXISTS idx_roasts_metadata_provider;
DROP INDEX IF EXISTS idx_roasts_metadata_fallback_used;
```

## Notas

- La migración es idempotente (usa `IF NOT EXISTS`)
- Los valores por defecto son seguros (mode='default', provider='openai', fallback_used=false)
- Los índices mejoran el rendimiento de consultas por modo y proveedor
