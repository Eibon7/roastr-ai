# RLS Tests con supabase-test

Tests de validación de Row Level Security (RLS) usando `supabase-test` para asegurar que todas las reglas RLS, policies multi-tenant, permisos de Shield, Persona y Roasts funcionen correctamente.

## Requisitos Previos

### 1. PostgreSQL instalado y ejecutándose

`supabase-test` requiere PostgreSQL accesible. Verifica que esté instalado:

```bash
# Verificar instalación
psql --version

# Si no está instalado (macOS)
brew install postgresql@17

# Iniciar PostgreSQL
brew services start postgresql@17
```

### 2. Variables de Entorno

Configura las variables de entorno para la conexión a PostgreSQL:

```bash
# Supabase local defaults
export PGHOST=localhost
export PGPORT=54322  # Puerto de Supabase local
export PGUSER=postgres
export PGPASSWORD=postgres
export PGDATABASE=postgres
```

O crea un archivo `.env.test` en la raíz del proyecto:

```env
PGHOST=localhost
PGPORT=54322
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=postgres
```

### 3. Supabase Local (Opcional pero Recomendado)

Para usar las migraciones de Supabase:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start
```

Esto iniciará PostgreSQL en el puerto 54322 con todas las extensiones necesarias.

## Ejecutar Tests

```bash
# 1. Verificar entorno (recomendado primero)
npm run test:rls:setup

# 2. Ejecutar todos los tests RLS
npm run test:rls

# 3. Ejecutar un test específico
npx jest tests/rls/tenants.test.js --verbose
```

## Estructura de Tests

- `tenants.test.js` - Multi-tenant isolation
- `persona.test.js` - Persona data isolation
- `shield.test.js` - Shield moderation actions
- `roast.test.js` - Roast generation limits
- `subscriptions.test.js` - Polar subscriptions

## Configuración

La configuración está centralizada en `tests/setup/supabase-test.config.js`:

- **Schema path**: `./supabase/migrations`
- **Extensions**: `uuid-ossp`, `pgvector`
- **Default role**: `authenticated` (para RLS testing)

### Carga Automática de Migraciones

Los tests cargan automáticamente todas las migraciones desde `supabase/migrations/` usando el helper `tests/rls/helpers/load-migrations.js`:

- Carga todas las migraciones `.sql` en orden alfabético (timestamps)
- Omite archivos vacíos automáticamente
- Muestra advertencias si no se encuentran migraciones

## Troubleshooting

### Error: `spawn psql ENOENT`

PostgreSQL no está instalado o no está en el PATH. Instala PostgreSQL y asegúrate de que `psql` esté disponible.

### Error: `Cannot connect to database`

Verifica que PostgreSQL esté ejecutándose y que las variables de entorno sean correctas:

```bash
# Verificar conexión
psql -h localhost -p 54322 -U postgres -d postgres
```

### Error: `db is undefined`

`getConnections()` falló. Verifica:
1. PostgreSQL está ejecutándose
2. Las credenciales son correctas
3. Las migraciones existen en `supabase/migrations/`

## Próximos Pasos

1. ✅ Instalación de `supabase-test`
2. ✅ Estructura de tests creada
3. ✅ Configuración centralizada
4. ⏳ Cargar migraciones reales en los tests
5. ⏳ Ejecutar tests con base de datos real
6. ⏳ Añadir más casos de prueba según resultados

## Notas

- Los tests usan bases de datos aisladas por test
- Rollback automático después de cada test
- Cada test ejecuta en <1s (objetivo)
- Compatible con CI/CD (GitHub Actions)

