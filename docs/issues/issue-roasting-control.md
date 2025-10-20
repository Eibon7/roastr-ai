# Issue: Implementar Roasting Control (Enable/Disable con Worker Sync)

**Prioridad:** P2 (Media - Feature de control de usuario)
**Estimación:** 6-8 horas
**Estado Actual:** 60% completado (arquitectura definida, endpoint faltante)
**Documentación:** [docs/flows/roasting-control.md](../flows/roasting-control.md)

---

## 🎯 ¿Qué es este flujo?

**Roasting Control** es el sistema de control centralizado que permite al usuario activar/desactivar el roasting con un simple toggle. Este flujo:

- **Toggle instantáneo** (on/off) que afecta a TODO el sistema
- **Sincronización en tiempo real** con workers mediante Redis pub/sub
- **Cancelación automática** de jobs pendientes al desactivar
- **Sync multi-dispositivo** vía WebSocket (cambio en móvil → desktop sincroniza)

**¿Por qué es importante?**
- **Control de usuario:** El usuario decide cuándo quiere roasts activos
- **Pausar temporalmente:** Desactivar durante reuniones, eventos, etc.
- **Ahorro de costos:** No genera roasts innecesarios si no se quieren
- **UX crítica:** Toggle debe funcionar INMEDIATAMENTE (no esperar minutos)

**Arquitectura clave:**
- **Redis pub/sub** para notificar a workers distribuidos
- **WebSocket** para sync en tiempo real entre dispositivos
- **Queue cancellation** para detener jobs pendientes
- **Optimistic updates** en frontend para UX instantánea

**Tecnologías:**
- Redis pub/sub channel `roasting:status`
- WebSocket server con auth JWT
- Workers suscritos a cambios de estado
- Cache en memoria en workers (evita DB queries constantes)

**Flujo:**
1. Usuario hace toggle en UI → Optimistic update
2. POST /api/roasting/toggle → Actualiza DB
3. Publica evento Redis → Workers reciben notificación
4. Workers actualizan cache + cancelan jobs
5. WebSocket broadcast → Otros dispositivos sincroniza

---

## 📋 Descripción Técnica

Implementar sistema de control on/off para roasting que:

1. Permite al usuario activar/desactivar roasting desde UI
2. Sincroniza estado en tiempo real con workers mediante Redis pub/sub
3. Cancela jobs pendientes en queue cuando se desactiva
4. Sincroniza estado entre múltiples dispositivos vía WebSocket

**Features clave:**
- Toggle instantáneo (optimistic update en frontend)
- Notificación a workers vía Redis pub/sub channel `roasting:status`
- Cancelación de jobs pendientes en `generate_reply` queue
- WebSocket broadcast para sync multi-dispositivo

**Estado actual:**
- ✅ Arquitectura de workers con Redis existe
- ✅ Conceptualmente definido en assessment
- ❌ Endpoint `/api/roasting/toggle` no implementado
- ❌ WorkerNotificationService no existe
- ❌ WebSocket server no implementado

---

## ✅ Checklist Técnico

### 1. Backend: Database Schema

- [ ] **Agregar columna `roasting_enabled` a tabla `users`**
  ```sql
  ALTER TABLE users
  ADD COLUMN roasting_enabled BOOLEAN DEFAULT TRUE;

  CREATE INDEX idx_users_roasting_enabled ON users(roasting_enabled);
  ```

- [ ] **Ejecutar migración:**
  ```bash
  node scripts/deploy-supabase-schema.js
  ```

- [ ] **Verificar valores por defecto:**
  - Usuarios nuevos: `roasting_enabled = TRUE`
  - Usuarios existentes: `roasting_enabled = TRUE` (migración)

### 2. Backend: WorkerNotificationService Implementation

- [ ] **Crear `src/services/WorkerNotificationService.js`**

  **Métodos requeridos:**
  - [ ] `notifyRoastingStatusChange(userId, enabled)` → publica evento en Redis
  - [ ] `subscribeToRoastingStatus(callback)` → escucha eventos (para workers)
  - [ ] `cancelPendingJobs(userId)` → cancela jobs en queue

  **Implementación con Redis pub/sub:**
  ```javascript
  const Redis = require('ioredis');
  const publisher = new Redis(process.env.REDIS_URL);
  const subscriber = new Redis(process.env.REDIS_URL);

  class WorkerNotificationService {
    constructor() {
      this.CHANNEL = 'roasting:status';
    }

    async notifyRoastingStatusChange(userId, enabled) {
      const message = JSON.stringify({
        userId,
        enabled,
        timestamp: new Date().toISOString()
      });

      await publisher.publish(this.CHANNEL, message);

      logger.info(`Published roasting status change: userId=${userId}, enabled=${enabled}`);
    }

    subscribeToRoastingStatus(callback) {
      subscriber.subscribe(this.CHANNEL, (err) => {
        if (err) {
          logger.error('Failed to subscribe to roasting status channel:', err);
          return;
        }
        logger.info('Subscribed to roasting:status channel');
      });

      subscriber.on('message', (channel, message) => {
        if (channel === this.CHANNEL) {
          const data = JSON.parse(message);
          callback(data.userId, data.enabled, data.timestamp);
        }
      });
    }

    async cancelPendingJobs(userId) {
      // Implementar usando queueService
      const queueService = require('./queueService');

      // Obtener jobs pendientes del usuario
      const pendingJobs = await queueService.getJobsByUser(userId, 'generate_reply');

      let canceledCount = 0;
      for (const job of pendingJobs) {
        if (job.status === 'pending' || job.status === 'queued') {
          await queueService.cancelJob(job.id);
          canceledCount++;
        }
      }

      logger.info(`Canceled ${canceledCount} pending jobs for user ${userId}`);
      return canceledCount;
    }
  }

  module.exports = new WorkerNotificationService();
  ```

### 3. Backend: API Endpoint

- [ ] **Crear `POST /api/roasting/toggle`**

  **Request:**
  ```json
  {
    "enabled": true
  }
  ```

  **Response:**
  ```json
  {
    "userId": "uuid",
    "enabled": true,
    "pendingJobsCanceled": 3
  }
  ```

  **Implementación:**
  ```javascript
  router.post('/roasting/toggle', authenticateJWT, async (req, res) => {
    try {
      const { enabled } = req.body;
      const userId = req.user.id;

      // Validar boolean
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be boolean' });
      }

      // Actualizar en DB
      const { data, error } = await supabase
        .from('users')
        .update({ roasting_enabled: enabled })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Notificar a workers vía Redis pub/sub
      await WorkerNotificationService.notifyRoastingStatusChange(userId, enabled);

      // Si se desactiva, cancelar jobs pendientes
      let canceledJobs = 0;
      if (!enabled) {
        canceledJobs = await WorkerNotificationService.cancelPendingJobs(userId);
      }

      // Broadcast a WebSocket (si está implementado)
      if (global.wss) {
        broadcastToUser(userId, {
          type: 'roasting_status_changed',
          enabled,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        userId,
        enabled,
        pendingJobsCanceled: canceledJobs
      });

    } catch (error) {
      logger.error('Error toggling roasting status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  ```

- [ ] **Rate limit:** 30 requests/hora (prevent abuse)

### 4. Backend: Worker Integration

- [ ] **Actualizar `GenerateReplyWorker.js`**

  - [ ] Suscribirse a `roasting:status` channel al iniciar
  - [ ] Mantener cache en memoria de usuarios con roasting disabled
  - [ ] Verificar estado antes de procesar job

  **Implementación:**
  ```javascript
  class GenerateReplyWorker extends BaseWorker {
    constructor() {
      super('generate_reply');
      this.disabledUsers = new Set(); // Cache de usuarios con roasting off

      // Suscribirse a cambios de estado
      WorkerNotificationService.subscribeToRoastingStatus(
        (userId, enabled) => {
          if (enabled) {
            this.disabledUsers.delete(userId);
            logger.info(`User ${userId} enabled roasting`);
          } else {
            this.disabledUsers.add(userId);
            logger.info(`User ${userId} disabled roasting`);
          }
        }
      );
    }

    async processJob(job) {
      const { userId } = job.data;

      // Verificar si usuario tiene roasting deshabilitado
      if (this.disabledUsers.has(userId)) {
        logger.info(`Skipping job for user ${userId} - roasting disabled`);
        await this.cancelJob(job.id);
        return;
      }

      // Doble verificación en DB (por si worker recién iniciado)
      const user = await this.getUserStatus(userId);
      if (!user.roasting_enabled) {
        this.disabledUsers.add(userId); // Actualizar cache
        logger.info(`Skipping job for user ${userId} - roasting disabled (DB check)`);
        await this.cancelJob(job.id);
        return;
      }

      // Procesar normalmente
      return super.processJob(job);
    }

    async getUserStatus(userId) {
      const { data } = await supabase
        .from('users')
        .select('roasting_enabled')
        .eq('id', userId)
        .single();
      return data;
    }
  }
  ```

### 5. Backend: WebSocket Server (Basic)

- [ ] **Crear `src/services/WebSocketService.js`** (implementación básica)

  ```javascript
  const WebSocket = require('ws');

  let wss;

  function initWebSocketServer(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
      // Autenticar conexión (extraer userId de query o token)
      const userId = authenticateWebSocket(req);
      if (!userId) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      ws.userId = userId;
      logger.info(`WebSocket connected: userId=${userId}`);

      ws.on('close', () => {
        logger.info(`WebSocket disconnected: userId=${userId}`);
      });
    });

    global.wss = wss; // Hacer disponible globalmente
  }

  function broadcastToUser(userId, message) {
    if (!wss) return;

    wss.clients.forEach(client => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function authenticateWebSocket(req) {
    // Extraer token de query string o header
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) return null;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.userId;
    } catch {
      return null;
    }
  }

  module.exports = { initWebSocketServer, broadcastToUser };
  ```

- [ ] **Integrar en `src/index.js`:**
  ```javascript
  const { initWebSocketServer } = require('./services/WebSocketService');
  const server = app.listen(PORT);
  initWebSocketServer(server);
  ```

### 6. Frontend: Roasting Control UI

- [ ] **Crear componente `RoastingToggle`**

  ```jsx
  import { useState, useEffect } from 'react';

  function RoastingToggle() {
    const [enabled, setEnabled] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      // Cargar estado inicial
      fetchRoastingStatus();

      // Conectar a WebSocket para sync multi-dispositivo
      connectWebSocket();
    }, []);

    async function fetchRoastingStatus() {
      // Implementar GET /api/user/settings (o leer de global state)
    }

    async function toggleRoasting() {
      // Optimistic update
      const newState = !enabled;
      setEnabled(newState);
      setLoading(true);

      try {
        const response = await fetch('/api/roasting/toggle', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ enabled: newState })
        });

        if (!response.ok) {
          throw new Error('Failed to toggle roasting');
        }

        const data = await response.json();

        if (data.pendingJobsCanceled > 0) {
          showNotification(`✅ Roasting desactivado. ${data.pendingJobsCanceled} roasts pendientes cancelados.`);
        } else {
          showNotification(`✅ Roasting ${newState ? 'activado' : 'desactivado'}`);
        }
      } catch (error) {
        // Revertir optimistic update
        setEnabled(!newState);
        showNotification('❌ Error al cambiar estado');
      } finally {
        setLoading(false);
      }
    }

    function connectWebSocket() {
      const token = localStorage.getItem('token');
      const ws = new WebSocket(`wss://yourapp.com/ws?token=${token}`);

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'roasting_status_changed') {
          setEnabled(message.enabled);
          showNotification(`Roasting ${message.enabled ? 'activado' : 'desactivado'} desde otro dispositivo`);
        }
      };
    }

    return (
      <div className="roasting-toggle">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleRoasting}
            disabled={loading}
          />
          {enabled ? 'Roasting Activado' : 'Roasting Desactivado'}
        </label>
        {loading && <span>Actualizando...</span>}
      </div>
    );
  }
  ```

### 7. Testing

- [ ] **Tests unitarios para `WorkerNotificationService`**
  - [ ] Test: `notifyRoastingStatusChange()` publica mensaje en Redis
  - [ ] Test: `subscribeToRoastingStatus()` recibe mensajes correctamente
  - [ ] Test: `cancelPendingJobs()` cancela solo jobs pendientes del usuario

- [ ] **Tests de integración para endpoint**
  - [ ] Test: `POST /api/roasting/toggle` con `enabled=false` → actualiza DB
  - [ ] Test: `POST /api/roasting/toggle` cancela jobs pendientes
  - [ ] Test: `POST /api/roasting/toggle` publica evento Redis
  - [ ] Test: `POST /api/roasting/toggle` sin auth → 401

- [ ] **Tests de integración para worker**
  - [ ] Test: Worker recibe notificación → actualiza cache
  - [ ] Test: Worker skips job si usuario disabled
  - [ ] Test: Worker procesa job normalmente si usuario enabled

- [ ] **Tests E2E del flujo completo**
  - [ ] Usuario activa roasting → Estado persiste → Worker procesa jobs
  - [ ] Usuario desactiva roasting → Jobs cancelados → Worker NO procesa nuevos jobs
  - [ ] Usuario cambia estado en dispositivo A → Dispositivo B sincroniza vía WebSocket

### 8. Documentación

- [ ] Actualizar `docs/flows/roasting-control.md` con:
  - [ ] Código completo de WorkerNotificationService
  - [ ] Diagrama de secuencia actualizado con WebSocket
  - [ ] Ejemplos de mensajes Redis pub/sub

- [ ] Actualizar `docs/nodes/roast.md`:
  - [ ] Documentar integración con workers
  - [ ] Añadir WorkerNotificationService a "Agentes Relevantes"

- [ ] Actualizar `CLAUDE.md`:
  - [ ] Documentar nueva columna `roasting_enabled`
  - [ ] Documentar WebSocket endpoint (si se implementa)

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**
- ✅ Issue Login & Registration (requiere auth)

**Opcionales (mejora la feature pero no bloqueante):**
- Issue Global State (sincronización avanzada)

**Desbloqueadas por esta issue:**
- Ninguna (feature independiente)

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ Columna `roasting_enabled` añadida a tabla `users`
2. ✅ `WorkerNotificationService` implementado con Redis pub/sub
3. ✅ Endpoint `/api/roasting/toggle` funcional
4. ✅ Workers integrados y responden a cambios de estado
5. ✅ Jobs pendientes cancelados al desactivar
6. ✅ Frontend con toggle funcional (optimistic updates)
7. ✅ WebSocket básico para sync multi-dispositivo (opcional pero recomendado)
8. ✅ **TODOS los tests pasando al 100%**
9. ✅ Documentación actualizada
10. ✅ CI/CD passing

---

## 📊 Métricas de Éxito

| Métrica | Valor Actual | Objetivo | Estado |
|---------|--------------|----------|--------|
| Tests pasando | N/A | 100% | ⏳ Pendiente |
| Cobertura roast control | N/A | ≥85% | ⏳ Pendiente |
| Latencia toggle | N/A | <200ms | ⏳ Pendiente |
| Sync multi-dispositivo | ❌ | ✅ | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**Performance:**
- Redis pub/sub es instantáneo (<10ms latency)
- Cache en memoria de workers evita DB queries constantes
- Optimistic updates mejoran perceived performance

**Reliability:**
- Workers deben verificar estado en DB si cache miss
- Jobs cancelados deben marcarse como `canceled` en queue
- WebSocket reconnect automático si conexión cae

**UX:**
- Mostrar contador de jobs cancelados tras desactivar
- Confirmación clara del estado actual
- Indicador visual mientras sincroniza

---

**Siguiente paso tras completar:** Implementar Issue Level Configuration - P3
