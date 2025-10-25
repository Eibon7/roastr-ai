#!/usr/bin/env python3
"""
Script to create all 12 production-ready issues in GitHub
Run from repository root: python3 scripts/create-production-issues.py
Requires: gh CLI installed and authenticated
"""

import subprocess
import re

# Define all 12 issues with their metadata
issues = [
    {
        "title": "P0: Implementar campo post_mode (manual/auto) en integration_configs",
        "labels": ["priority:P0", "area:backend"],
        "body": """## Prioridad
P0 - Bloqueador MVP

## Área
Backend - Integration Config

## Estimación
3 horas

## Contexto
Actualmente el sistema usa un JSONB genérico `config.auto_post` que es difícil de queryar y no tiene default claro. Esto causa comportamiento inconsistente en el flujo de aprobación manual vs automático.

## Archivos afectados
- `database/schema.sql` - Línea 179-194
- `src/workers/GenerateReplyWorker.js` - Línea 501-504
- `src/routes/integrations.js`

## Acceptance Criteria
- [ ] Añadir columna `post_mode VARCHAR(20) DEFAULT 'manual' CHECK (post_mode IN ('manual', 'auto'))` a `integration_configs`
- [ ] Migración de datos existentes: mover `config.auto_post` a nueva columna
- [ ] Actualizar `GenerateReplyWorker.processJob()` para usar `integrationConfig.post_mode` en lugar de `config.auto_post`
- [ ] Endpoint `PUT /api/integrations/:platform/posting-mode` para cambiar entre manual/auto
- [ ] Tests de integración verificando flujo manual vs auto
- [ ] Documentar en API docs

## Flujo esperado
```javascript
// Manual mode
if (integrationConfig.post_mode === 'manual') {
  // Keep response as 'pending', wait for user approval
  status = 'pending'
} else {
  // Auto mode: queue posting immediately
  await queuePostingJob(...)
}
```

## Rollback plan
Si hay problemas, mantener lectura de `config.auto_post` como fallback por 1 release."""
    },
    {
        "title": "P0: Implementar niveles de Shield configurables (shield_sensitivity)",
        "labels": ["priority:P0", "area:backend"],
        "body": """## Prioridad
P0 - Feature crítica

## Área
Backend - Shield Configuration

## Estimación
5 horas

## Contexto
Shield actualmente usa thresholds hardcoded (0.8 para high, 0.95 para critical). Los usuarios Pro/Plus necesitan ajustar sensibilidad según su tolerancia personal.

## Archivos afectados
- `database/schema.sql` - Línea 192
- `src/workers/AnalyzeToxicityWorker.js` - Línea 42-48
- `src/routes/shield.js`

## Acceptance Criteria
- [ ] Añadir columna `shield_sensitivity INTEGER DEFAULT 3 CHECK (shield_sensitivity BETWEEN 1 AND 5)` a `integration_configs`
- [ ] Añadir columna `shield_auto_execute BOOLEAN DEFAULT false` para control de ejecución automática
- [ ] Crear función `calculateDynamicThresholds(baseSensitivity, userSensitivity)` en `AnalyzeToxicityWorker`
- [ ] Endpoint `PUT /api/integrations/:platform/shield-settings`
- [ ] Actualizar UI de configuración de Shield
- [ ] Tests con diferentes niveles de sensibilidad (1=tolerante, 5=estricto)

## Implementación sugerida
```javascript
// AnalyzeToxicityWorker.js
calculateDynamicThresholds(userSensitivity) {
  const baseThresholds = { low: 0.3, medium: 0.6, high: 0.8, critical: 0.95 };
  const factor = userSensitivity / 3; // 3 = default

  return {
    low: baseThresholds.low * factor,
    medium: baseThresholds.medium * factor,
    high: baseThresholds.high * factor,
    critical: baseThresholds.critical
  };
}
```

## Validación
- Sensitivity 1 (bajo): high = 0.27, critical = 0.95
- Sensitivity 3 (default): high = 0.8, critical = 0.95
- Sensitivity 5 (alto): high = 1.33 → clamp to 1.0"""
    },
    {
        "title": "P0: Separar enabled de shield_enabled para granularidad",
        "labels": ["priority:P0", "area:backend", "ux"],
        "body": """## Prioridad
P0 - UX crítico

## Área
Backend - Integration Config

## Estimación
2 horas

## Contexto
Actualmente si un usuario desactiva `enabled: false`, se apaga TODO (fetch comments, shield, roasting). No hay forma de desactivar solo roasting manteniendo Shield activo.

## Archivos afectados
- `src/workers/FetchCommentsWorker.js`
- `src/workers/AnalyzeToxicityWorker.js`
- `src/workers/GenerateReplyWorker.js`

## Acceptance Criteria
- [ ] Documentar comportamiento de cada flag:
  - `enabled: false` → NO fetch comments (integración completamente OFF)
  - `shield_enabled: true, response_frequency: 0` → Shield ON, Roasting OFF
  - `enabled: true, shield_enabled: false` → Roasting ON, Shield OFF
- [ ] Actualizar workers para respetar flags correctamente
- [ ] Endpoint `PUT /api/integrations/:platform/features` para configurar granularmente
- [ ] Tests verificando 4 combinaciones de flags
- [ ] Documentación de usuario explicando opciones

## Matriz de comportamiento
| enabled | shield_enabled | response_frequency | Resultado |
|---------|----------------|-------------------|-----------|
| false | - | - | Todo OFF |
| true | true | 0.0 | Solo Shield |
| true | false | >0 | Solo Roasting |
| true | true | >0 | Shield + Roasting |"""
    },
    {
        "title": "P0: Soportar múltiples cuentas del mismo tipo (multi-account)",
        "labels": ["priority:P0", "area:backend", "database"],
        "body": """## Prioridad
P0 - Bloqueador planes Pro/Plus

## Área
Database Schema + Backend

## Estimación
8 horas

## Contexto
El constraint `UNIQUE(organization_id, platform)` impide tener 2+ cuentas de Twitter. Planes Pro/Plus necesitan hasta 2 cuentas por red.

## Archivos afectados
- `database/schema.sql` - Línea 196
- `src/routes/integrations.js`
- `src/services/userIntegrationsService.js`

## Acceptance Criteria
- [ ] **Database migration:**
  - Drop `UNIQUE(organization_id, platform)` constraint
  - Add `account_identifier VARCHAR(255)` column
  - Add `display_name VARCHAR(255)` column
  - Add `is_primary BOOLEAN DEFAULT false` column
  - Create new `UNIQUE(organization_id, platform, account_identifier)` constraint
- [ ] **Plan limits enforcement:**
  - Starter: 1 cuenta por platform
  - Pro/Plus: 2 cuentas por platform
  - Custom: ilimitado
- [ ] **API changes:**
  - `POST /api/integrations/:platform` → body incluye `{ account_identifier, display_name }`
  - `GET /api/integrations/:platform` → devuelve array de cuentas
  - `DELETE /api/integrations/:platform/:account_identifier` → eliminar cuenta específica
- [ ] **Validación de límites:**
  - Función `canAddAccount(organizationId, platform, userPlan)` en `planLimitsService`
  - Error 403 si excede límite del plan
- [ ] **UI changes:**
  - Selector de cuenta en dashboard
  - Botón "Añadir cuenta" si no excede límite
- [ ] Tests de límites por plan
- [ ] Migración de datos existentes (marcar como `is_primary: true`, generar `account_identifier` desde config)

## Migration script ejemplo
```sql
-- Step 1: Add columns
ALTER TABLE integration_configs
ADD COLUMN account_identifier VARCHAR(255),
ADD COLUMN display_name VARCHAR(255),
ADD COLUMN is_primary BOOLEAN DEFAULT false;

-- Step 2: Populate existing data
UPDATE integration_configs
SET account_identifier = COALESCE(config->>'username', config->>'account_id', id::text),
    display_name = COALESCE(config->>'username', platform || ' Account'),
    is_primary = true
WHERE account_identifier IS NULL;

-- Step 3: Drop old constraint
ALTER TABLE integration_configs
DROP CONSTRAINT integration_configs_organization_id_platform_key;

-- Step 4: Add new constraint
CREATE UNIQUE INDEX integration_configs_org_platform_account_idx
ON integration_configs(organization_id, platform, account_identifier);
```"""
    },
    {
        "title": "P1: Eliminar 868 console.log y migrar a logger estructurado",
        "labels": ["priority:P1", "area:logging", "code-quality"],
        "body": """## Prioridad
P1 - Calidad de código

## Área
Logging + Debugging

## Estimación
6 horas

## Contexto
Hay 868 llamadas a `console.log/console.error` en 49 archivos. Esto impide logging estructurado, filtrado por componente, y análisis en producción.

## Archivos más afectados
- `src/integrations/twitter/twitterService.js` - 44 console.logs
- `src/services/*.js` - ~200 console.logs
- `src/workers/*.js` - ~150 console.logs

## Acceptance Criteria
- [ ] Eliminar TODOS los `console.log`, `console.error`, `console.warn`, `console.info`
- [ ] Reemplazar con `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`
- [ ] Formato estructurado (ver ejemplo en issue)
- [ ] Script de validación en CI: `scripts/validate-no-console.sh`
- [ ] Pre-commit hook rechazando console.logs en archivos de producción
- [ ] Documentación en CONTRIBUTING.md sobre logging guidelines"""
    },
    {
        "title": "P1: Implementar revocación de OAuth tokens al eliminar integración",
        "labels": ["priority:P1", "area:security", "integrations"],
        "body": """## Prioridad
P1 - Seguridad

## Área
Integrations + OAuth

## Estimación
4 horas

## Contexto
Al hacer `DELETE /api/integrations/:platform`, se elimina el registro de DB pero NO se revocan los OAuth tokens en la plataforma externa. Esto deja tokens activos que podrían ser explotados.

## Archivos afectados
- `src/services/userIntegrationsService.js` - método `deleteIntegration()`
- `src/integrations/*/index.js` - cada platform service

## Acceptance Criteria
- [ ] Añadir método `revokeToken(accessToken)` a cada platform service
- [ ] Actualizar `deleteIntegration()` para llamar `platformService.revokeToken()` ANTES de DELETE
- [ ] Manejo de errores: log warning si revocación falla pero continuar con DELETE
- [ ] Tests verificando revocación llamada
- [ ] Documentación de seguridad

Ver PRODUCTION-READY-ISSUES.md para implementación completa."""
    },
    {
        "title": "P1: Implementar endpoints de cancelación de suscripción",
        "labels": ["priority:P1", "area:billing"],
        "body": """## Prioridad
P1 - Billing crítico

## Área
Billing + Stripe

## Estimación
5 horas

## Contexto
Actualmente solo se puede cancelar suscripción desde Stripe Customer Portal (UI externa). No hay endpoint nativo para cancelar ni captura de feedback de cancelación.

## Archivos afectados
- `src/routes/billing.js`
- `database/schema.sql` - nueva tabla `subscription_cancellations`

## Acceptance Criteria
- [ ] Tabla de feedback de cancelación (ver schema en issue detallado)
- [ ] Endpoint de cancelación: `POST /api/billing/cancel-subscription`
- [ ] Endpoint de reactivación: `POST /api/billing/reactivate-subscription`
- [ ] Tests de flujo completo
- [ ] Analytics dashboard para razones de cancelación

Ver PRODUCTION-READY-ISSUES.md para schema SQL e implementación completa."""
    },
    {
        "title": "P2: Consolidar servicios duplicados (Shield, Plan, Notifications)",
        "labels": ["priority:P2", "area:refactoring", "technical-debt"],
        "body": """## Prioridad
P2 - Deuda técnica

## Área
Refactoring + Architecture

## Estimación
20 horas (hacer después de MVP)

## Contexto
Hay 81 archivos de servicios con ~37K LOC, muchos duplicados:
- Shield: 5 archivos (4,725 LOC) → debería ser 1 (800 LOC)
- Plan/Tier: 4 archivos (3,040 LOC) → debería ser 1 (300 LOC)
- Notifications: 3 archivos (718 LOC) → debería ser 1 (300 LOC)

## Archivos afectados
- `src/services/shield*.js` (5 archivos)
- `src/services/tier*.js`, `src/services/plan*.js` (4 archivos)
- `src/services/alert*.js`, `src/services/notification*.js` (3 archivos)

## Acceptance Criteria
- [ ] Shield consolidation: crear `ShieldService.js` unificado
- [ ] Plan consolidation: crear `PlanService.js` unificado
- [ ] Notification consolidation: crear `NotificationService.js` unificado
- [ ] Tests de regresión verificando funcionalidad idéntica
- [ ] Documentación de arquitectura actualizada

**NO hacer antes de MVP** - Es refactor grande que puede introducir bugs."""
    },
    {
        "title": "P2: Implementar Style Profile Extraction con Feature Flag",
        "labels": ["priority:P2", "area:features", "pro-plus"],
        "body": """## Prioridad
P2 - Feature Pro/Plus

## Área
Style Analysis + Feature Flags

## Estimación
12 horas

## Contexto
Style profile extraction está implementado a medias (solo skeleton). Necesita completarse bajo feature flag para Pro/Plus users.

## Archivos afectados
- `src/services/styleProfileService.js` - Líneas 129-133, 169-177
- `src/workers/GenerateReplyWorker.js` - integración con prompt
- `database/schema.sql` - nueva tabla

## Feature Flag
```javascript
// .env
ENABLE_STYLE_PROFILE_EXTRACTION=false
```

## Acceptance Criteria
- [ ] Database table `style_profiles` (ver schema en issue detallado)
- [ ] Implementar `fetchRecentComments()` con platform APIs
- [ ] Implementar `analyzeTone()` con OpenAI
- [ ] Integrar con `GenerateReplyWorker`
- [ ] Endpoint de trigger manual (solo Pro/Plus)
- [ ] Auto-refresh logic (cada 90 días o 500+ nuevos comentarios)
- [ ] Tests con feature flag ON/OFF

## Rollout plan
1. Semana 1-2: Implementar con flag OFF
2. Semana 3: Testing interno con 5-10 usuarios Pro
3. Semana 4: A/B test con 50% Pro/Plus users
4. Semana 5+: 100% rollout si métricas positivas

Ver PRODUCTION-READY-ISSUES.md para implementación completa."""
    },
    {
        "title": "P2: Migrar de poll-based a event-driven queue system",
        "labels": ["priority:P2", "area:performance", "workers"],
        "body": """## Prioridad
P2 - Performance optimization

## Área
Workers + Queue System

## Estimación
16 horas (hacer después de MVP)

## Contexto
Workers actuales usan polling cada 1-2 segundos, generando ~10K queries/10s en idle. Event-driven system reduciría a 0 queries en idle.

## Archivos afectados
- `src/workers/BaseWorker.js` - Línea 150-180 (método `processJobs()`)
- `src/services/queueService.js`

## Acceptance Criteria
- [ ] Implementar event-driven queue usando Redis BLPOP (ver código en issue)
- [ ] Actualizar `QueueService` para soportar `blockingPop()`
- [ ] Mantener compatibilidad con poll-based como fallback
- [ ] Benchmarks mostrando reducción de queries
- [ ] Tests de latencia (event-driven debe ser <100ms vs poll ~500ms)

## Performance esperada
- Queries en idle: 10K/10s → 0/10s (100% reducción)
- Latencia promedio: 500ms → 50ms (10x mejora)
- CPU usage: -30%

**NO hacer antes de MVP** - Optimización que puede esperar."""
    },
    {
        "title": "P3: Añadir filtros avanzados a listado de roasts y Shield events",
        "labels": ["priority:P3", "area:frontend", "ux"],
        "body": """## Prioridad
P3 - UX enhancement

## Área
API + Frontend

## Estimación
6 horas

## Contexto
Usuarios con cientos de roasts necesitan búsqueda/filtrado avanzado. Actualmente solo hay paginación básica.

## Endpoints afectados
- `GET /api/approval/pending`
- `GET /api/shield/events`
- `GET /api/user/accounts/:id/roasts`

## Acceptance Criteria
- [ ] Búsqueda por texto (full-text search con PostgreSQL)
- [ ] Filtro por fecha (ISO 8601, max 365 días)
- [ ] Ordenamiento por campos configurables
- [ ] Filtros compuestos
- [ ] Performance: índices en columnas ordenables
- [ ] Tests de queries complejas
- [ ] Documentación de API

## Ejemplo
```
GET /api/approval/pending?platform=twitter&search=idiot&from=2025-10-01&sort=toxicity_score&order=desc&limit=20
```

**NO prioritario para MVP** - Users pueden usar paginación básica inicialmente."""
    },
    {
        "title": "P3: Implementar GDPR cleanup al eliminar integración",
        "labels": ["priority:P3", "area:privacy", "gdpr"],
        "body": """## Prioridad
P3 - GDPR compliance

## Área
Data Privacy + GDPR

## Estimación
4 horas

## Contexto
Al eliminar integración, datos históricos (comments, responses, shield_actions) se mantienen. GDPR requiere opción de borrado completo.

## Archivos afectados
- `src/services/userIntegrationsService.js` - método `deleteIntegration()`

## Acceptance Criteria
- [ ] Query param `?deleteHistory=true` en endpoint de eliminación
- [ ] Si `deleteHistory=true`: eliminar comments, responses, shield_actions, analytics
- [ ] Confirmación en UI con checkbox
- [ ] Audit log de eliminación completa
- [ ] Tests verificando cascade delete
- [ ] Documentación GDPR

Ver PRODUCTION-READY-ISSUES.md para implementación completa.

**NO crítico para MVP** - GDPR permite mantener datos por tiempo razonable."""
    }
]

def create_issue(issue):
    """Create a single GitHub issue using gh CLI"""
    labels_str = ",".join(issue["labels"])

    cmd = [
        "gh", "issue", "create",
        "--title", issue["title"],
        "--label", labels_str,
        "--body", issue["body"]
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"✅ Created: {issue['title']}")
        print(f"   URL: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create: {issue['title']}")
        print(f"   Error: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ Error: gh CLI not found. Please install GitHub CLI first:")
        print("   https://cli.github.com/manual/installation")
        return False

def main():
    print("Creating 12 production-ready issues for Roastr.ai MVP...\n")

    success_count = 0
    failed_count = 0

    for issue in issues:
        if create_issue(issue):
            success_count += 1
        else:
            failed_count += 1
        print()  # Empty line between issues

    print("=" * 60)
    print(f"✅ Successfully created: {success_count} issues")
    if failed_count > 0:
        print(f"❌ Failed to create: {failed_count} issues")
    print("=" * 60)

if __name__ == "__main__":
    main()
