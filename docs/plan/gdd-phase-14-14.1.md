# GDD 2.0 Phase 14 + 14.1 Implementation Plan

## Agent-Aware Integration + Secure Write Protocol + Real-Time Telemetry

## Estado Actual

- ✅ GDD 2.0 Phases 1-13 implemented (validation, health scoring,
  drift prediction, auto-repair, CI/CD)
- ✅ Snake Eater UI components available
- ✅ watch-gdd.js exists for monitoring
- ❌ No agent interface layer for autonomous operations
- ❌ No permission system for agent actions
- ❌ No secure write protocol with rollback
- ❌ No real-time telemetry system
- ❌ No UI for agent activity monitoring

## Objetivo

Crear un sistema completo donde los agentes GDD puedan operar
autónomamente de forma segura, auditable y reversible, con telemetría
en tiempo real visible desde el dashboard administrativo.

## Componentes a Desarrollar

### 1. Agent Interface Layer (AIL)

**File:** `scripts/agents/agent-interface.js`

**Funciones principales:**

- `readNode(nodeName)` - Lee un nodo GDD
- `writeNodeField(nodeName, field, value, agent)` - Escribe campo con validación
- `createIssue(agent, title, body)` - Crea issue en GitHub
- `triggerRepair(agent)` - Lanza auto-repair
- `getSystemHealth()` - Obtiene health score actual
- `logAgentAction(agent, action, target, result)` - Log auditable

**Requisitos:**

- Validación de permisos contra `agent-permissions.json`
- Hash SHA-256 antes/después de cada write
- Firma digital (agent + timestamp + acción + target)
- Rollback automático si health_score disminuye
- Notificación al Telemetry Bus en cada acción

### 2. Permission Matrix

**File:** `config/agent-permissions.json`

**Agentes del ecosistema:**

- `DocumentationAgent` - Actualiza metadata, crea issues, actualiza deps
- `Orchestrator` - Sincroniza nodos, actualiza health, marca stale
- `DriftWatcher` - Trigger auto-repair, actualiza timestamps
- `RuntimeValidator` - Solo lectura

**Comportamiento:**

- Acción fuera de scope → error 403 (logged)
- Evento válido → envío a Telemetry Bus + log en `gdd-agent-log.json`

### 3. Secure Write Protocol (SWP)

**File:** `scripts/agents/secure-write.js`

**Características:**

- Hash de integridad (SHA-256) pre/post escritura
- Firma: `{ agent, timestamp, action, target, hash_before, hash_after }`
- Rollback si `health_after < health_before`
- Broadcast evento al Telemetry Socket

### 4. Telemetry Bus

**File:** `scripts/agents/telemetry-bus.js`

**Implementación:**

- Micro-servicio basado en WebSocket (Server-Sent Events fallback)
- Escucha todos los logs de agent-interface
- Emite eventos JSON en vivo
- Buffer de últimos 100 eventos
- Soporta suscripción desde UI y CLI

**Formato evento:**

```json
{
  "agent": "DriftWatcher",
  "action": "auto_repair",
  "node": "billing",
  "deltaHealth": 1.7,
  "timestamp": "2025-10-06T18:32Z"
}
```

### 5. Watcher Integration

**Modificar:** `scripts/watch-gdd.js`

**Nuevo modo:**

```bash
node scripts/watch-gdd.js --agents-active --telemetry
```

**Acciones automáticas:**

| Agente | Acción | Condición |
|--------|--------|-----------|
| DriftWatcher | Lanza auto-repair | Drift > 60 |
| DocumentationAgent | Crea issue huérfano | Detectado |
| Orchestrator | Marca stale | > 7 días sin update |
| RuntimeValidator | Actualiza health | Siempre |

### 6. Audit Trail & Logs

**Files:**

- `docs/gdd-agent-history.md` - Formato Markdown humanizable
- `gdd-agent-log.json` - Formato JSON estructurado

**Contenido:**

- Timestamp
- Agent
- Action
- Target (node/field)
- Result (success/fail/rollback)
- Delta health
- Hash antes/después

### 7. UI Integration - Agent Activity Monitor

**File:** `src/admin/components/AgentActivityMonitor.tsx`

**Vista 1 - Resumen de Agentes:**

- Tabla de acciones recientes (últimas 20)
- Estado del sistema (🟢🟡🔴)
- Botón "Revert" para rollback manual

**Vista 2 - Live Telemetry Feed:**

- WebSocket client conectado a telemetry-bus.js
- Eventos en tiempo real (1-2 seg delay máx)
- Color coding por tipo de evento (success/warn/fail)
- DonutGraph de actividad por agente (últimos 10 min)
- Panel de estadísticas:
  - Total events (24h)
  - Avg ΔHealth
  - Auto-repairs
  - Rollbacks

**Diseño:**

- Basado en Snake Eater UI (Card, Table, Tabs, DonutGraph, Alert,
  Progress)
- Fondo oscuro (#0b0b0d), bordes finos, acento verde eléctrico
- Sin dependencias adicionales

### 8. Testing Scenarios

**Test 1 - Dry Run:**

```bash
node scripts/agents/agent-interface.js --simulate
```

**Test 2 - Live Telemetry:**

```bash
node scripts/agents/telemetry-bus.js --listen
```

Abrir dashboard → verificar stream de eventos

**Test 3 - Rollback:**

- Forzar acción que degrade health
- Verificar rollback automático
- Confirmar log: `health_before > health_after + rollback triggered`

**Test 4 - Permission Denial:**

- Intentar acción fuera de scope
- Verificar error 403 logged

**Test 5 - 100 Operations:**

- Ejecutar 100 acciones de agente
- Verificar health ≥ 95 mantenido
- Confirmar audit trail completo

## Pasos de Implementación

1. ✅ **Crear estructura de directorios**
   - `scripts/agents/`
   - `config/` (ya existe)

2. ✅ **Implementar Permission Matrix**
   - Crear `config/agent-permissions.json`
   - Definir permisos por agente

3. ✅ **Desarrollar Secure Write Protocol**
   - Implementar hashing SHA-256
   - Crear firma digital
   - Sistema de rollback

4. ✅ **Construir Agent Interface Layer**
   - API completa con todas las funciones
   - Integración con SWP
   - Validación de permisos

5. ✅ **Implementar Telemetry Bus**
   - WebSocket server
   - Event broadcasting
   - Buffer management
   - CLI listener

6. ✅ **Integrar con Watcher**
   - Modificar watch-gdd.js
   - Añadir modo --agents-active --telemetry
   - Conectar con AIL

7. ✅ **Setup Audit Trail**
   - Crear gdd-agent-history.md
   - Inicializar gdd-agent-log.json
   - Logging automático

8. ✅ **Desarrollar UI Component**
   - AgentActivityMonitor.tsx
   - WebSocket client
   - Live feed + estadísticas
   - Integrar con Snake Eater UI

9. ✅ **Testing Completo**
   - Ejecutar todos los escenarios
   - Verificar health ≥ 95
   - Validar audit trail

10. ✅ **Documentación**
    - Actualizar GDD-ACTIVATION-GUIDE.md
    - Añadir sección Phase 14 + 14.1
    - Ejemplos de uso

## Acceptance Criteria

- [ ] AIL creado con API completa funcional
- [ ] agent-permissions.json implementado y validado
- [ ] SWP activo con firmas + hashes + rollback
- [ ] Telemetry Bus emitiendo eventos en vivo
- [ ] Watcher conectado con --agents-active --telemetry
- [ ] Audit Trail (JSON + MD) actualizándose automáticamente
- [ ] UI Monitor + Telemetry Feed integrado en Snake Eater UI
- [ ] Health ≥ 95 mantenido tras 100 acciones de agente
- [ ] Tests pasando al 100%
- [ ] Documentación completa

## Expected Output

```text
✅ All agents connected (4 total)
✅ Secure Write Protocol + Telemetry Bus operational
✅ Auto-rollback verificado
✅ Logs y feed en vivo sincronizados
✅ UI dashboard Snake Eater mostrando actividad live
✅ System Health ≥ 95 mantenido tras 100 operaciones
```

## Commit Message

```text
feat: GDD 2.0 Phase 14 + 14.1 – Agent-Aware Integration +
Secure Write Protocol + Real-Time Telemetry

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Files to Create/Modify

**New Files:**

- scripts/agents/agent-interface.js
- scripts/agents/secure-write.js
- scripts/agents/telemetry-bus.js
- config/agent-permissions.json
- docs/gdd-agent-history.md
- gdd-agent-log.json
- src/admin/components/AgentActivityMonitor.tsx

**Modified Files:**

- scripts/watch-gdd.js
- docs/GDD-ACTIVATION-GUIDE.md

## Agentes Involucrados

- Orchestrator (planning + coordination)
- Front-end Dev (UI component)
- Test Engineer (testing scenarios)

## Notas de Implementación

- Usar crypto nativo de Node.js para hashing (SHA-256)
- WebSocket: usar librería `ws` (ya instalada en proyecto)
- UI: reutilizar componentes existentes de Snake Eater UI
- No añadir nuevas dependencias NPM si no es necesario
- Mantener backward compatibility con fases anteriores
- Telemetry Bus debe ser lightweight (< 100MB RAM)
- Rollback debe ser instantáneo (< 1 segundo)

## Riesgos y Mitigaciones

**Riesgo 1:** Performance degradation con muchos eventos

- Mitigación: Buffer limitado a 100 eventos, cleanup automático

**Riesgo 2:** Rollback puede causar inconsistencias

- Mitigación: Validación completa post-rollback, health check

**Riesgo 3:** WebSocket connection drops

- Mitigación: Auto-reconnect + fallback a Server-Sent Events

**Riesgo 4:** Permisos muy restrictivos bloquean operaciones

- Mitigación: Logging detallado de denials, modo dry-run para testing
