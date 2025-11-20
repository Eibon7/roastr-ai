# 🔍 Análisis: Agotamiento del Disk IO Budget en Supabase

**Fecha:** 2025-11-19  
**Proyecto:** Eibon7's Project (rpkhiemljhncddmhrilk)  
**Estado:** ⚠️ Disk IO Budget en riesgo de agotamiento

---

## 📋 ¿Qué es Disk IO?

**Disk IO (Input/Output)** es la cantidad de operaciones de lectura y escritura que tu base de datos realiza en el disco. En Supabase, cada plan tiene un límite diario de Disk IO basado en el compute add-on que uses.

### ¿Por qué importa?

Cuando se agota el Disk IO Budget:
- ⚠️ **Response times aumentan** (las queries tardan más)
- ⚠️ **CPU usage sube** debido a IO wait
- ⚠️ **La instancia puede volverse no responsiva**

---

## 🤔 ¿Por qué está pasando esto sin estar en producción?

Aunque no hayas salido a producción, hay varias razones por las que puedes estar consumiendo mucho Disk IO:

### 1. **Workers con Polling Muy Frecuente** 🔄

**Problema principal identificado:**

Tu sistema tiene múltiples workers ejecutándose simultáneamente con intervalos de polling muy agresivos:

```32:32:src/workers/BaseWorker.js
      pollInterval: options.pollInterval || 1000,
```

**Workers activos y sus frecuencias:**

| Worker | Poll Interval | Frecuencia | Impacto |
|--------|---------------|------------|---------|
| `fetch_comments` | 2000ms (2s) | 30 queries/min | 🔴 Alto |
| `analyze_toxicity` | 1500ms (1.5s) | 40 queries/min | 🔴 Alto |
| `generate_reply` | 2000ms (2s) | 30 queries/min | 🔴 Alto |
| `post_response` | 2000ms (2s) | 30 queries/min | 🔴 Alto |
| `alert_notification` | 2000ms (2s) | 30 queries/min | 🔴 Alto |
| `style_profile` | 5000ms (5s) | 12 queries/min | 🟡 Medio |

**Cálculo aproximado:**
- Si tienes 5 workers ejecutándose simultáneamente
- Cada uno hace 1-2 queries por ciclo de polling
- **Total: ~150-200 queries/minuto = ~216,000 queries/día**

Cada query genera Disk IO, especialmente si:
- No hay índices adecuados
- Las queries hacen full table scans
- Hay muchas conexiones simultáneas

### 2. **Queries a `job_queue` Sin Índices Optimizados** 📊

El worker más problemático es el que consulta `job_queue`:

```452:463:src/services/queueService.js
  async getJobFromDatabase(jobType, options = {}) {
    try {
      const { data: job, error } = await this.supabase
        .from('job_queue')
        .select('*')
        .eq('job_type', jobType)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
```

**Problemas potenciales:**
- Esta query se ejecuta **cada 1-2 segundos** por cada worker
- Si no hay índices compuestos en `(job_type, status, scheduled_at, priority, created_at)`, PostgreSQL puede hacer un **full table scan**
- Un full table scan lee toda la tabla desde disco = **máximo Disk IO**

### 3. **Tests de Integración Ejecutándose** 🧪

Tienes **383 archivos de test**, muchos de ellos tests de integración que:

- Se conectan a la base de datos real (no mocks)
- Crean y eliminan datos repetidamente
- Ejecutan queries complejas con RLS (Row Level Security)
- Pueden ejecutarse en CI/CD o localmente

**Ejemplo problemático:**

```1:100:tests/integration/sponsors-rls.test.js
/**
 * Sponsors RLS Integration Tests - CodeRabbit Review #3483663040
 *
 * Tests Row Level Security policy for sponsors table:
 * - user_sponsors_isolation policy enforcement
 * - User A cannot see/update/delete User B's sponsors
 * - Direct database RLS validation (not service layer)
 *
 * Related Issue: #866 (Brand Safety Integration Tests)
 * Related Migration: supabase/migrations/20251119000001_sponsors_brand_safety.sql
 * Related Pattern: admin-rls.test.js, shield-rls.test.js, usage-rls.test.js
 *
 * CRITICAL: Uses testClient (RLS-enabled) to directly test database policy,
 * NOT SponsorService (which uses service_role and bypasses RLS).
 */

const {
  createTestTenants,
  setTenantContext,
  cleanupTestData,
  testClient,
  serviceClient
} = require('../helpers/tenantTestUtils');
```

**Impacto:**
- Cada test crea tenants, usuarios, datos de prueba
- Ejecuta múltiples queries con RLS (más costosas)
- Si ejecutas `npm test` frecuentemente = mucho Disk IO

### 4. **Scripts de Desarrollo Ejecutándose** 🛠️

Scripts que pueden estar corriendo en background:

- `npm run workers:start` - Inicia todos los workers
- `npm run dev` - Auto-reload que puede reiniciar workers
- Scripts de migración ejecutándose repetidamente
- Scripts de seed/demo que insertan datos

### 5. **Falta de Connection Pooling Eficiente** 🔌

Si cada worker crea su propia conexión a Supabase sin pooling adecuado:

- Múltiples conexiones simultáneas
- Cada conexión genera overhead de Disk IO
- Sin reutilización de conexiones = más operaciones de disco

### 6. **Queries Sin Índices en Tablas Frecuentes** 📈

Aunque tienes muchos índices, puede haber queries que:

- No usan los índices existentes (mal plan de query)
- Filtran por columnas sin índice
- Hacen JOINs sin índices en foreign keys

---

## 🎯 Soluciones Inmediatas

### 1. **Aumentar Poll Intervals de Workers** (Prioridad: P0)

**Antes (desarrollo):**
```javascript
pollInterval: 1000,  // 1 segundo
```

**Después (desarrollo):**
```javascript
pollInterval: 10000,  // 10 segundos (10x menos queries)
```

**Recomendación:**
- Desarrollo: 10-30 segundos
- Staging: 5-10 segundos  
- Producción: 1-5 segundos (según necesidad real)

**Archivos a modificar:**
- `src/workers/BaseWorker.js` (default)
- `src/workers/cli/start-workers.js` (configuración por worker)

### 2. **Verificar Índices en `job_queue`** (Prioridad: P0)

Ejecuta en Supabase SQL Editor:

```sql
-- Ver índices existentes en job_queue
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'job_queue';

-- Si no existe índice compuesto, crear:
CREATE INDEX IF NOT EXISTS idx_job_queue_lookup 
ON job_queue(job_type, status, scheduled_at, priority, created_at)
WHERE status = 'pending';
```

### 3. **Detener Workers No Necesarios en Desarrollo** (Prioridad: P0)

Si no estás desarrollando funcionalidad de workers:

```bash
# Detener todos los workers
pkill -f "start-workers"

# O comentar en package.json scripts que los inician automáticamente
```

### 4. **Usar Mocks en Tests de Desarrollo** (Prioridad: P1)

Configurar tests para usar mocks en lugar de base de datos real:

```javascript
// En jest.config.js o setupFilesAfterEnv
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_DB = 'true';
```

### 5. **Monitorear Queries Activas** (Prioridad: P1)

En Supabase Dashboard → Database → Query Performance:

- Identifica queries más lentas
- Busca queries sin índices
- Revisa queries que se ejecutan frecuentemente

---

## 📊 Monitoreo y Prevención

### Verificar Consumo Actual

1. **Supabase Dashboard:**
   - Ve a: Project Settings → Usage
   - Revisa "Disk IO" (diario y por hora)
   - Identifica picos de consumo

2. **Query Performance:**
   - Database → Query Performance
   - Filtra por "Slow queries" (>100ms)
   - Revisa "Most frequent queries"

### Alertas Proactivas

Configura alertas cuando el consumo supere:
- 50% del budget diario
- 80% del budget diario (crítico)

---

## 🚀 Soluciones a Largo Plazo

### 1. **Implementar Redis/Upstash para Queue** (Ya tienes QueueService)

Tu `QueueService` ya soporta Redis, pero parece que los workers están usando la base de datos como fallback:

```409:447:src/services/queueService.js
  async getJobFromRedis(jobType, options = {}) {
    // ... código Redis ...
  }
```

**Asegúrate de:**
- Redis/Upstash está configurado y funcionando
- Workers usan Redis como primera opción
- Solo fallback a DB si Redis no está disponible

### 2. **Connection Pooling**

Verifica que Supabase client esté usando pooling adecuado:

```javascript
// En lugar de crear múltiples clientes
const supabase = createClient(url, key);

// Usar singleton o pool compartido
```

### 3. **Optimizar Queries Frecuentes**

- Revisar EXPLAIN ANALYZE de queries más frecuentes
- Añadir índices donde falten
- Usar materialized views para queries complejas repetitivas

### 4. **Separar Entornos**

- **Desarrollo:** Workers con polling lento (10-30s)
- **Staging:** Polling moderado (5-10s)
- **Producción:** Polling rápido solo si es necesario (1-5s)

---

## ⚡ Acción Inmediata Recomendada

**HOY (5 minutos):**

1. **Detener workers activos:**
   ```bash
   pkill -f "start-workers"
   pkill -f "workers:start"
   ```

2. **Verificar consumo en Supabase Dashboard:**
   - Ve a Usage → Disk IO
   - Confirma que el consumo baja después de detener workers

3. **Aumentar poll intervals:**
   - Edita `src/workers/cli/start-workers.js`
   - Cambia todos los `pollInterval` a 10000 (10 segundos)

**MAÑANA (30 minutos):**

1. Verificar índices en `job_queue`
2. Configurar Redis/Upstash si no está activo
3. Revisar Query Performance en Supabase

---

## 📚 Referencias

- [Supabase Disk IO Guide](https://supabase.com/docs/guides/platform/disk-io)
- [Supabase Compute Add-ons](https://supabase.com/docs/guides/platform/compute-add-ons)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)

---

## ✅ Checklist de Verificación

- [ ] Workers detenidos o con poll intervals aumentados
- [ ] Índices verificados en `job_queue`
- [ ] Redis/Upstash configurado y activo
- [ ] Tests usando mocks en desarrollo
- [ ] Monitoreo de Disk IO configurado
- [ ] Query Performance revisado
- [ ] Connection pooling verificado

---

**Última actualización:** 2025-11-19  
**Estado:** 🔴 Requiere acción inmediata

