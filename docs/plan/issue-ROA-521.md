# Plan de Implementación: ROA-521

**Título:** Fix Supabase Auth Test Mock Infrastructure Constructor Timing and CI

## Estado Actual

### Problema Identificado

El sistema tiene un **race condition** entre la configuración de mocks en `setupIntegration.js` y la inicialización de clientes de Supabase en `src/config/supabase.js`:

**Flujo problemático:**
1. Tests ejecutan `setupIntegration.js` (configuración de mocks)
2. `src/config/supabase.js` se require en algún test
3. **Constructor timing issue:** Los clientes se crean ANTES de que `setupIntegration.js` configure `process.env.MOCK_MODE`
4. Resultado: Clientes reales se crean con credenciales faltantes → tests fallan en CI

**Evidencia:**
```
console.error
  > 30 |     console.error('❌ Missing Supabase credentials in .env file');
    31 |     console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY');
```

**Archivos afectados:**
- `tests/setupIntegration.js` - Configura mocks pero es tarde
- `src/config/supabase.js` - Inicializa clientes en require-time
- Tests que usan Supabase - Fallan intermitentemente en CI

## Solución Propuesta

### Opción A: Lazy Initialization (RECOMENDADA)

Convertir la inicialización de clientes Supabase de **constructor-time** a **lazy-initialization** (primera llamada).

**Ventajas:**
- ✅ Respeta el timing de setup de tests
- ✅ No rompe código existente
- ✅ Compatible con mock mode
- ✅ Más eficiente (no crea clientes innecesarios)

**Desventajas:**
- ⚠️ Requiere pequeños cambios en imports existentes

### Implementación

#### Paso 1: Modificar `src/config/supabase.js`

**Antes (ejecuta en require-time):**
```javascript
const supabaseServiceClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {...})
  : createMockClient();
```

**Después (lazy init):**
```javascript
let _supabaseServiceClient = null;
const getSupabaseServiceClient = () => {
  if (!_supabaseServiceClient) {
    const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
    _supabaseServiceClient = isSupabaseConfigured
      ? createClient(supabaseUrl, supabaseServiceKey, {...})
      : createMockClient();
  }
  return _supabaseServiceClient;
};
```

#### Paso 2: Actualizar exports

```javascript
module.exports = {
  get supabaseServiceClient() {
    return getSupabaseServiceClient();
  },
  get supabaseAnonClient() {
    return getSupabaseAnonClient();
  },
  createUserClient,
  getUserFromToken,
  checkConnection
};
```

#### Paso 3: Tests no requieren cambios

Gracias al getter, el código existente sigue funcionando:
```javascript
const { supabaseServiceClient } = require('../../../src/config/supabase');
// Funciona igual, pero ahora es lazy
```

#### Paso 4: Garantizar orden correcto

Añadir verificación en `setupIntegration.js`:

```javascript
// Al final del archivo, después de configurar env vars
if (process.env.CI || process.env.IS_TEST) {
  // Force mock mode BEFORE any supabase client is created
  process.env.SUPABASE_MOCK_INITIALIZED = 'true';
}
```

## Pasos de Implementación

### Fase 1: Refactoring del Config (30 min)

- [ ] Convertir `supabaseServiceClient` a lazy init con getter
- [ ] Convertir `supabaseAnonClient` a lazy init con getter
- [ ] Mantener `createUserClient` como está (ya es función)
- [ ] Mantener exports actuales (backward compatible)

### Fase 2: Testing Local (15 min)

- [ ] Ejecutar `npm test` completo
- [ ] Verificar que no hay regresiones
- [ ] Verificar logs de "Mock mode" aparecen correctamente

### Fase 3: CI Validation (20 min)

- [ ] Push a branch temporal
- [ ] Esperar CI
- [ ] Verificar que tests pasan sin error de credentials
- [ ] Verificar logs de CI

### Fase 4: Documentation (10 min)

- [ ] Actualizar CLAUDE.md con patrón lazy-init
- [ ] Añadir comentarios en `supabase.js`
- [ ] Documentar en PR

## Acceptance Criteria

- [ ] Tests locales pasan sin mock credentials
- [ ] Tests en CI pasan sin error de credentials
- [ ] No hay cambios necesarios en tests existentes
- [ ] Patrón lazy-init documentado
- [ ] Coverage ≥ 90%

## Validación

```bash
# Local
npm test

# CI (simular)
MOCK_MODE=true npm test

# Verificar que no se crean clientes reales en mock mode
grep -r "createClient" tests/ --include="*.test.js" | grep -v "mock"
```

## Riesgos

- ⚠️ **Bajo:** Cambios en getter pattern pueden romper code que asigna referencias
- ⚠️ **Bajo:** Tests que dependen de timing específico pueden requerir ajustes

## Alternativas Descartadas

### Opción B: Environment Check Earlier

**Problema:** Requiere que todos los tests importen setup ANTES de cualquier otro módulo. Frágil y propenso a errores.

### Opción C: Mock en Jest Config

**Problema:** No resuelve el problema de CI donde las credenciales reales faltan.

## Referencias

- Sistema SSOT: `docs/SSOT-V2.md`
- Nodo testing: `docs/nodes-v2/15-testing.md` (si existe)
- Nodo auth: `docs/nodes-v2/12-auth.md`
- Nodo infraestructura: `docs/nodes-v2/14-infraestructura.md`

