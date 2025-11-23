# 🚀 Guía de Despliegue en Staging - Sistema de Límites de Planes

Esta guía te ayudará a desplegar y probar el sistema de límites de planes configurables en staging (Issue #99).

## 📋 Pre-requisitos

1. Acceso a la base de datos de staging
2. Variables de entorno configuradas
3. Token de administrador para testing

## 🗄️ 1. Aplicar Migración de Base de Datos

```bash
# Conectar a base de datos de staging y aplicar migración
psql $STAGING_DATABASE_URL -f database/migrations/013_plan_limits_configuration.sql
```

La migración creará:

- ✅ Tabla `plan_limits` con configuración de límites
- ✅ Tabla `plan_limits_audit` para auditoría
- ✅ Funciones para obtener y validar límites
- ✅ Políticas de seguridad (RLS)
- ✅ Datos iniciales para todos los planes

## ⚙️ 2. Configurar Variables de Entorno

```bash
# Variables necesarias para staging
export SUPABASE_URL="your-staging-supabase-url"
export SUPABASE_SERVICE_KEY="your-staging-service-key"
export NODE_ENV="staging"
export STAGING_API_URL="https://your-staging-api.com"
export STAGING_ADMIN_TOKEN="your-admin-jwt-token"
```

## 🧪 3. Ejecutar Pruebas de Staging

```bash
# Ejecutar script de verificación completo
npm run test:staging:plan-limits

# O ejecutar manualmente:
node scripts/test-staging-plan-limits.js
```

El script verificará:

### ✅ Migración de Base de Datos

- Tabla `plan_limits` existe
- Datos iniciales cargados
- Funciones creadas correctamente

### ✅ Servicio de Límites de Planes

- Obtener límites de diferentes planes
- Funcionamiento del caché
- Manejo de errores

### ✅ Endpoints de Administración

- `GET /api/admin/plan-limits` - Obtener todos los límites
- `GET /api/admin/plan-limits/:planId` - Obtener límites específicos
- `PUT /api/admin/plan-limits/:planId` - Actualizar límites
- `POST /api/admin/plan-limits/refresh-cache` - Limpiar caché

### ✅ Validación de Límites

- Verificar límites dentro del rango
- Verificar límites excedidos
- Manejar planes ilimitados (-1)

### ✅ Manejo de Errores

- Fallback para planes inexistentes
- Recuperación ante fallos de DB

## 🔍 4. Pruebas Manuales Adicionales

### Probar Admin Panel

```bash
# Acceder al panel de administración
curl -H "Authorization: Bearer $STAGING_ADMIN_TOKEN" \
     $STAGING_API_URL/api/admin/plan-limits
```

### Probar Actualización de Límites

```bash
# Actualizar límites del plan pro
curl -X PUT \
     -H "Authorization: Bearer $STAGING_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"maxRoasts": 1500, "monthlyResponsesLimit": 1500}' \
     $STAGING_API_URL/api/admin/plan-limits/pro
```

### Verificar Caché

```bash
# Limpiar caché
curl -X POST \
     -H "Authorization: Bearer $STAGING_ADMIN_TOKEN" \
     $STAGING_API_URL/api/admin/plan-limits/refresh-cache
```

## 📊 5. Verificaciones de Base de Datos

```sql
-- Verificar datos en plan_limits
SELECT plan_id, max_roasts, monthly_responses_limit, shield_enabled
FROM plan_limits;

-- Verificar audit log
SELECT plan_id, action, changed_at, changed_by
FROM plan_limits_audit
ORDER BY changed_at DESC
LIMIT 10;

-- Probar función de límites
SELECT get_plan_limits('pro');

-- Probar validación de límites
SELECT check_plan_limit('free', 'roasts', 150); -- true (excedido)
SELECT check_plan_limit('pro', 'roasts', 500);  -- false (dentro)
```

## 🚨 6. Verificaciones de Seguridad

### Row Level Security (RLS)

- ✅ Solo administradores pueden modificar límites
- ✅ Todos pueden leer límites (necesario para la aplicación)
- ✅ Solo administradores pueden ver audit logs

### Audit Trail

- ✅ Todos los cambios se registran automáticamente
- ✅ Se almacena quién hizo el cambio y cuándo
- ✅ Se guardan valores antes y después

## 📈 7. Pruebas de Performance

```bash
# Probar caché (debería ser < 10ms)
time curl -H "Authorization: Bearer $TOKEN" \
          $STAGING_API_URL/api/admin/plan-limits/pro

# Probar múltiples requests simultáneos
for i in {1..10}; do
  curl -s $STAGING_API_URL/api/admin/plan-limits/free &
done
wait
```

## 🎯 8. Criterios de Éxito

El sistema está listo para producción cuando:

- ✅ Todas las pruebas automatizadas pasan
- ✅ Los endpoints admin responden correctamente
- ✅ El caché funciona (respuestas < 50ms)
- ✅ Los límites se actualizan sin reiniciar la aplicación
- ✅ El audit log registra todos los cambios
- ✅ Las políticas de seguridad funcionan
- ✅ Los servicios existentes funcionan con los nuevos límites

## 🚀 9. Siguiente Paso: Producción

Una vez que staging esté funcionando:

1. **Backup de base de datos de producción**
2. **Aplicar migración en horario de mantenimiento**
3. **Ejecutar pruebas de smoke en producción**
4. **Monitorear logs durante las primeras 24h**

## 🆘 Rollback Plan

Si algo falla:

```sql
-- Revertir migración (USAR CON CUIDADO)
DROP TRIGGER IF EXISTS plan_limits_audit_trigger ON plan_limits;
DROP TRIGGER IF EXISTS plan_limits_updated_at_trigger ON plan_limits;
DROP FUNCTION IF EXISTS log_plan_limits_change();
DROP FUNCTION IF EXISTS update_plan_limits_updated_at();
DROP FUNCTION IF EXISTS check_plan_limit(VARCHAR, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS get_plan_limits(VARCHAR);
DROP TABLE IF EXISTS plan_limits_audit;
DROP TABLE IF EXISTS plan_limits;
```

---

📞 **Contacto**: Si encuentras problemas durante el despliegue, revisa los logs y el script de pruebas para identificar el problema específico.
