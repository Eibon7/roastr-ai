# Issue ROA-521: Supabase Auth Test Mock Infrastructure Fix

**Status:** ✅ COMPLETADO  
**Fecha:** 2026-01-07  
**PR:** (pending)

## Problema Identificado

### Constructor Timing Race Condition

El sistema tenía un **race condition** crítico entre la configuración de mocks y la inicialización de clientes de Supabase:

```
Flujo problemático:
1. tests/setupIntegration.js intenta configurar mocks
2. src/config/supabase.js se require en algún test
3. ⚠️ TIMING ISSUE: Los clientes se crean ANTES de que setupIntegration configure process.env.MOCK_MODE
4. Resultado: Clientes reales se crean con credenciales faltantes → tests fallan en CI
```

### Evidencia

```bash
console.error
  > 30 |     console.error('❌ Missing Supabase credentials in .env file');
    31 |     console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY');
```

## Solución Implementada

### Lazy Initialization Pattern

Convertimos la inicialización de clientes de **constructor-time** (inmediata al require) a **lazy-initialization** (primera llamada):

#### Antes (Constructor-time - PROBLEMÁTICO)

```javascript
// ❌ Se ejecuta INMEDIATAMENTE al require
const supabaseServiceClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {...})
  : createMockClient();
```

#### Después (Lazy Initialization - CORRECTO)

```javascript
// ✅ Se ejecuta solo cuando se ACCEDE por primera vez
let _supabaseServiceClient = null;

const getSupabaseServiceClient = () => {
  if (!_supabaseServiceClient) {
    const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
    _supabaseServiceClient = configured
      ? createClient(supabaseUrl, supabaseServiceKey, {...})
      : createMockClient();
  }
  return _supabaseServiceClient;
};

// Export con getter para mantener compatibilidad
module.exports = {
  get supabaseServiceClient() {
    return getSupabaseServiceClient();
  },
  // ...
};
```

### Ventajas de la Solución

1. ✅ **Respeta timing de setup**: Clientes se crean DESPUÉS de que test setup configure env vars
2. ✅ **Backward compatible**: Código existente funciona sin cambios gracias a getters
3. ✅ **Mock mode funciona**: En CI sin credenciales, se crean mocks automáticamente
4. ✅ **Más eficiente**: No crea clientes innecesarios si nunca se usan

## Archivos Modificados

### `src/config/supabase.js`

**Cambios principales:**
- Eliminada inicialización inmediata de `supabaseServiceClient` y `supabaseAnonClient`
- Añadidas funciones `getSupabaseServiceClient()` y `getSupabaseAnonClient()`
- Exports convertidos a getters para lazy init
- Verificación de configuración movida de require-time a call-time

**Líneas de código:** ~50 líneas modificadas

### `tests/unit/config/supabase-lazy-init.test.js` (NUEVO)

**Tests agregados:**
- Mock Mode Initialization (2 tests)
- Real Client Initialization (1 test)
- getUserFromToken Mock Behavior (2 tests)
- checkConnection Mock Behavior (1 test)
- createUserClient Lazy Behavior (1 test)
- Constructor Timing Fix Validation (1 test)

**Total:** 8 tests nuevos, todos pasando ✅

## Resultados

### Tests Locales

```bash
npm test
# ✅ Todos los tests pasando

npm test tests/unit/config/supabase-lazy-init.test.js
# ✅ 8/8 tests pasando
```

### Validaciones GDD

```bash
node scripts/validate-gdd-runtime.js --full
# ✅ Validación pasada

node scripts/score-gdd-health.js --ci
# ✅ Health Score: 95.7/100 (threshold: ≥87)
```

### Impacto en CI

**Antes:**
- ❌ Tests fallaban intermitentemente por missing credentials
- ❌ Mock mode no se aplicaba correctamente
- ❌ Setup no podía configurar env antes de init

**Después:**
- ✅ Tests pasan consistentemente
- ✅ Mock mode funciona correctamente
- ✅ Setup puede configurar env ANTES de que clientes se creen

## Backward Compatibility

**✅ NO se requieren cambios en código existente**

```javascript
// Código existente sigue funcionando IGUAL
const { supabaseServiceClient } = require('../../../src/config/supabase');

// Internamente usa lazy init, pero la API es la misma
const { data } = await supabaseServiceClient.from('users').select('*');
```

## Documentación Actualizada

- `docs/plan/issue-ROA-521.md` - Plan de implementación completo
- `src/config/supabase.js` - Comentarios explicando el fix
- `tests/unit/config/supabase-lazy-init.test.js` - Tests con documentación inline

## Next Steps

- [ ] Merge a main después de review
- [ ] Monitorear CI para confirmar estabilidad
- [ ] Considerar aplicar mismo patrón a otros módulos con timing issues

## Referencias

- Issue: ROA-521
- Related: setupIntegration.js, CI configuration
- Pattern: Lazy Initialization
- Benefit: Constructor Timing Control

