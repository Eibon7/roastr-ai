# GDD Phase 14 + 14.1 Implementation Plan

**Date:** 2025-10-09
**Author:** Claude Code Orchestrator
**Phase:** GDD 2.0 - Agent-Aware Integration + Secure Write Protocol + Real-Time Telemetry

---

## 📊 Estado Actual (Assessment)

### Existente
- ✅ `scripts/collect-gdd-telemetry.js` (Phase 13) - Sistema de telemetría histórica
- ✅ `scripts/watch-gdd.js` - Monitor de cambios del sistema GDD
- ✅ 13 nodos GDD documentados en `docs/nodes/`
- ✅ Sistema de validación runtime completo

### Faltante (Recomendación: CREATE)
- ❌ Infraestructura de agentes (`scripts/agents/`)
- ❌ Sistema de permisos para agentes (`config/agent-permissions.json`)
- ❌ Protocolo de escritura segura (Secure Write Protocol)
- ❌ Telemetry Bus para eventos en tiempo real
- ❌ Integración de agentes con watcher
- ❌ Sistema de auditoría y logs de agentes
- ❌ UI component para monitor de actividad de agentes

---

## 🎯 Objetivos de Phase 14 + 14.1

### Phase 14: Agent-Aware Integration + Secure Write Protocol
Integrar agentes del ecosistema GDD con sistema de lectura/escritura seguro, auditable y reversible.

### Phase 14.1: Real-Time Telemetry
Añadir telemetría en tiempo real visible desde panel administrativo (estilo Snake Eater UI).

**Resultado Final:** Sistema GDD self-healing + live-aware donde agentes actúan autónomamente sin comprometer coherencia.

---

## 📋 Componentes a Implementar

### 1. Agent Interface Layer (AIL)
**Archivo:** `scripts/agents/agent-interface.js`

**Funciones principales:**
- `readNode(nodeName)` - Lectura de nodos GDD
- `writeNodeField(nodeName, field, value, agent)` - Escritura segura de campos
- `createIssue(agent, title, body)` - Creación de issues desde agentes
- `triggerRepair(agent)` - Activación de auto-repair
- `getSystemHealth()` - Consulta de health del sistema
- `logAgentAction(agent, action, target, result)` - Logging de acciones

**Características:**
- Validación de permisos según `agent-permissions.json`
- Hash y firma digital antes/después de writes
- Rollback automático si health_score disminuye
- Notificación a Telemetry Bus en cada acción

### 2. Permission Matrix
**Archivo:** `config/agent-permissions.json`

**Agentes definidos:**
```json
{
  "DocumentationAgent": ["update_metadata", "create_issue", "update_dependencies"],
  "Orchestrator": ["sync_nodes", "update_health", "mark_stale"],
  "DriftWatcher": ["trigger_auto_repair", "update_timestamp"],
  "RuntimeValidator": ["read_only"]
}
```

**Comportamiento:**
- Acciones fuera de scope → error 403 (logged)
- Eventos válidos → enviados a Telemetry Bus + guardados en `gdd-agent-log.json`

### 3. Secure Write Protocol (SWP)
**Archivo:** `scripts/agents/secure-write.js`

**Implementación:**
- Hash de integridad (SHA-256) antes/después
- Firma (agent, timestamp, acción, target)
- Rollback si health_score baja
- Broadcast del evento al Telemetry Socket

### 4. Telemetry Bus
**Archivo:** `scripts/agents/telemetry-bus.js`

**Características:**
- Micro-servicio interno basado en WebSocket (Server-Sent Events fallback)
- Escucha todos los logs de agent-interface
- Emite eventos JSON en vivo
- Buffer de 100 últimos eventos
- Suscripción desde UI y CLI

**Ejemplo evento:**
```json
{
  "agent": "DriftWatcher",
  "action": "auto_repair",
  "node": "billing",
  "deltaHealth": +1.7,
  "timestamp": "2025-10-09T18:32Z"
}
```

### 5. Watcher Integration
**Modificar:** `scripts/watch-gdd.js`

**Nuevo modo:**
```bash
node scripts/watch-gdd.js --agents-active --telemetry
```

**Comportamiento automático:**
| Agente | Acción | Condición |
|--------|--------|-----------|
| DriftWatcher | Lanza auto-repair | Drift > 60 |
| DocumentationAgent | Crea issue huérfano | Detectado |
| Orchestrator | Marca stale | > 7 días sin update |
| RuntimeValidator | Actualiza health | Siempre |

Todos los eventos → Telemetry Bus + logs

### 6. Audit Trail & Logs
**Archivos:**
- `docs/gdd-agent-history.md` - Historia en Markdown
- `gdd-agent-log.json` - Log estructurado JSON

**Formato:** Cada acción añade evento live en Telemetry Bus

### 7. UI Integration - Agent Activity Monitor
**Archivo:** `src/admin/components/AgentActivityMonitor.tsx`

**Vistas:**

**Vista 1 - Resumen de Agentes:**
- Tabla de acciones recientes
- Estado del sistema 🟢🟡🔴
- Botón "Revert" (rollback)

**Vista 2 - Live Telemetry Feed:**
- WebSocket client → `telemetry-bus.js`
- Eventos en tiempo real (1-2 seg delay máx.)
- Color por tipo de evento (success / warn / fail)
- DonutGraph de actividad por agente (últimos 10 min)
- Panel de estadísticas:
  - Total events (24h)
  - Avg ΔHealth
  - Auto-repairs
  - Rollbacks

**Diseño:**
- Basado en Snake Eater UI (Card, Table, Tabs, DonutGraph, Alert, Progress)
- Fondo oscuro (#0b0b0d), bordes finos, acento verde eléctrico
- Sin dependencias adicionales fuera de snake-eater-ui

---

## 🧪 Testing Scenarios

### 1. Dry Run
```bash
node scripts/agents/agent-interface.js --simulate
```

### 2. Live Telemetry Test
```bash
node scripts/agents/telemetry-bus.js --listen
```
Abrir dashboard → ver eventos en stream

### 3. Rollback Test
- Forzar acción que degrade health
- Verificar rollback automático
- Verificar log y telemetría

---

## ✅ Acceptance Criteria

| Checkpoint | Descripción | Estado |
|-----------|-------------|--------|
| AIL creado | API para agentes con lectura/escritura | ☐ |
| Permisos definidos | agent-permissions.json implementado | ☐ |
| SWP activo | Firmas + hashes funcionales | ☐ |
| Telemetry Bus | Emite y recibe eventos en vivo | ☐ |
| Watcher conectado | --agents-active --telemetry | ☐ |
| Audit Trail | Logs JSON + MD actualizándose | ☐ |
| UI Monitor + Telemetry Feed | Integrado en Snake Eater UI | ☐ |
| Health ≥ 95 | Mantiene tras 100 acciones de agente | ☐ |

---

## 📦 Expected Output After Phase 14 + 14.1

```
✅ All agents connected (4 total)
✅ Secure Write Protocol + Telemetry Bus operational
✅ Auto-rollback verificado
✅ Logs y feed en vivo sincronizados
✅ UI dashboard Snake Eater mostrando actividad live
✅ System Health ≥ 95 mantenido tras 100 operaciones
```

---

## 🔄 Implementation Order

1. **Create Agent Interface Layer** (`scripts/agents/agent-interface.js`)
2. **Create Permission Matrix** (`config/agent-permissions.json`)
3. **Create Secure Write Protocol** (`scripts/agents/secure-write.js`)
4. **Create Telemetry Bus** (`scripts/agents/telemetry-bus.js`)
5. **Integrate with Watcher** (modify `scripts/watch-gdd.js`)
6. **Create Audit Trail System** (`docs/gdd-agent-history.md` + `gdd-agent-log.json`)
7. **Create UI Component** (`src/admin/components/AgentActivityMonitor.tsx`)
8. **Run Tests & Validation**
9. **Update Documentation** (CLAUDE.md, GDD nodes, GDD Implementation Summary)

---

## 📝 Notas Importantes

- **Seguridad:** Todas las escrituras deben pasar por SWP con hash + firma
- **Rollback:** Automático si health_score disminuye
- **Permisos:** Estrictos según matriz, logged 403 para acciones no autorizadas
- **Telemetría:** Real-time con buffer de 100 eventos
- **UI:** Estilo Snake Eater coherente con dashboard GDD existente
- **Testing:** Dry run, live telemetry test, rollback test obligatorios

---

**Commit esperado:**
```
feat: GDD 2.0 Phase 14 + 14.1 – Agent-Aware Integration + Secure Write Protocol + Real-Time Telemetry

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
