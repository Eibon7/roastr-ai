# Issue: Implementar Global State Synchronization (Frontend ↔ Backend ↔ Polar)

**Prioridad:** P4 (Baja - Nice-to-have, no bloqueante)
**Estimación:** 14-16 horas
**Estado Actual:** 0% completado (diseño completo, implementación faltante)
**Documentación:** [docs/flows/global-state.md](../flows/global-state.md)

---

## 🎯 ¿Qué es este flujo?

**Global State Synchronization** es la "columna vertebral" del frontend de Roastr. Este flujo mantiene sincronizado el estado del usuario entre:

- **Frontend** (React en memoria)
- **Backend** (PostgreSQL source of truth)
- **Polar** (estado de suscripción external)
- **Múltiples dispositivos** (WebSocket para sync en tiempo real)

**¿Qué estado gestiona?**
```typescript
{
  auth: { userId, token, isAuthenticated },
  subscription: { plan, status, trial_days_remaining },
  persona: { identity, intolerance, tolerance },
  roasting: { enabled, roast_level, shield_level },
  usage: { monthly_roasts_used, remaining_roasts }
}
```

**¿Por qué es complejo?**
- **Múltiples fuentes:** DB, Polar API, WebSocket events
- **Sincronización multi-dispositivo:** Cambio en móvil → desktop actualiza
- **Conflictos:** Dos dispositivos cambian mismo dato simultáneamente
- **Performance:** No refetch en cada render (cachear inteligentemente)

**Estrategias de sincronización:**
1. **Fetch inicial** al login (GET /api/state)
2. **WebSocket** para updates en tiempo real (server push)
3. **Polling** como fallback cada 30s (si WebSocket cae)
4. **Optimistic updates** en frontend (UX instantánea)
5. **Conflict resolution** con Last Write Wins + version tracking

**Importancia:**
- **UX crítica:** Usuario espera ver cambios INMEDIATAMENTE
- **Consistencia:** Evitar states desincronizados (ej: plan Free pero usando features Pro)
- **Confiabilidad:** Sistema debe funcionar incluso si WebSocket falla

**Tecnologías:**
- React Context API o Zustand (state management)
- WebSocket con auth JWT
- Redis pub/sub para multi-instance deployments
- Version tracking para conflict resolution

**Complejidad:** Esta es la issue más compleja (16h estimadas) porque integra TODOS los flujos anteriores.

---

## 📋 Descripción Técnica

Implementar sistema de sincronización de estado global entre:
- **Frontend**: Estado en memoria (React Context / Zustand)
- **Backend**: Source of truth (PostgreSQL + Supabase)
- **Polar**: Estado de suscripción (external service)

**State Schema:**
```typescript
interface GlobalUserState {
  auth: {
    userId: string;
    token: string;
    refreshToken: string;
    expiresAt: string;
    isAuthenticated: boolean;
  };
  subscription: {
    plan: 'free' | 'starter' | 'pro' | 'plus';
    status: 'active' | 'trialing' | 'past_due' | 'canceled';
    trial_days_remaining: number;
    current_period_end: string;
  };
  persona: {
    identity: string;
    intolerance: string;
    tolerance: string;
  };
  roasting: {
    enabled: boolean;
    roast_level: number;
    shield_level: 'tolerante' | 'balanceado' | 'estricto';
  };
  usage: {
    monthly_roasts_used: number;
    monthly_roasts_limit: number;
    remaining_roasts: number;
  };
}
```

**Sincronización:**
- **WebSocket** para updates en tiempo real (cambios en subscription, roasting status)
- **Polling** como fallback (cada 30 segundos)
- **Optimistic updates** en frontend para mejor UX
- **Conflict resolution** con Last Write Wins + version tracking

**Estado actual:**
- ✅ Schema TypeScript completo definido
- ✅ Arquitectura de sincronización diseñada
- ❌ `StateService.js` no existe
- ❌ WebSocket server no implementado (solo básico en Issue Roasting Control)
- ❌ Frontend state management no decidido (React Context vs Zustand)
- ❌ Conflict resolution no implementado

---

## ⚠️ IMPORTANTE: Decisión de Arquitectura

Antes de implementar, el usuario debe decidir:

**1. Frontend State Management:**
- [ ] **React Context API** (built-in, más simple)
- [ ] **Zustand** (más poderoso, mejor DevTools)

**2. WebSocket Priority:**
- [ ] **Implementar WebSocket completo** (tiempo real, ~6h adicionales)
- [ ] **Solo polling por ahora** (más simple, menos features)

**Esta issue se pausará hasta que el usuario responda estas preguntas.**

---

## ✅ Checklist Técnico

### 1. Backend: StateService Implementation

- [ ] **Crear `src/services/StateService.js`**

  **Métodos requeridos:**
  - [ ] `getGlobalState(userId)` → retorna estado completo
  - [ ] `updateAuthState(userId, authData)` → actualiza auth
  - [ ] `updateSubscriptionState(userId, subData)` → actualiza subscription
  - [ ] `updatePersonaState(userId, personaData)` → actualiza persona
  - [ ] `updateRoastingState(userId, roastingData)` → actualiza roasting
  - [ ] `syncFromPolar(userId)` → sincroniza subscription desde Polar
  - [ ] `broadcastStateChange(userId, section, data)` → notifica cambios vía WebSocket

  **Implementación:**
  ```javascript
  class StateService {
    async getGlobalState(userId) {
      // Fetch de múltiples tablas en paralelo
      const [user, subscription, persona, config, usage] = await Promise.all([
        this.getAuthState(userId),
        this.getSubscriptionState(userId),
        this.getPersonaState(userId),
        this.getRoastingConfig(userId),
        this.getUsageStats(userId)
      ]);

      return {
        auth: user,
        subscription,
        persona,
        roasting: config,
        usage
      };
    }

    async getAuthState(userId) {
      const { data } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('id', userId)
        .single();

      return {
        userId: data.id,
        isAuthenticated: true,
        // token/refreshToken NO se incluyen en state sync (security)
      };
    }

    async getSubscriptionState(userId) {
      const { data } = await supabase
        .from('polar_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) {
        return {
          plan: 'free',
          status: 'active',
          trial_days_remaining: 0,
          current_period_end: null
        };
      }

      const trialDaysRemaining = data.trial_end
        ? Math.max(0, Math.ceil((new Date(data.trial_end) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        plan: data.plan,
        status: data.status,
        trial_days_remaining: trialDaysRemaining,
        current_period_end: data.current_period_end
      };
    }

    async getPersonaState(userId) {
      const persona = await PersonaService.getPersona(userId);
      return persona || { identity: null, intolerance: null, tolerance: null };
    }

    async getRoastingConfig(userId) {
      const [userSettings, levelConfig] = await Promise.all([
        supabase.from('users').select('roasting_enabled').eq('id', userId).single(),
        supabase.from('user_roast_config').select('*').eq('user_id', userId).single()
      ]);

      return {
        enabled: userSettings.data?.roasting_enabled ?? true,
        roast_level: levelConfig.data?.roast_level ?? 2,
        shield_level: levelConfig.data?.shield_level ?? 'balanceado'
      };
    }

    async getUsageStats(userId) {
      // Calcular desde costControl service
      const costData = await costControlService.getUsageForPeriod(userId, 'month');

      return {
        monthly_roasts_used: costData.roastsGenerated,
        monthly_roasts_limit: costData.limit,
        remaining_roasts: Math.max(0, costData.limit - costData.roastsGenerated)
      };
    }

    async syncFromPolar(userId) {
      // Llamar a Polar API para obtener subscription más reciente
      const polarData = await PolarService.getSubscriptionStatus(userId);

      // Actualizar DB
      await supabase
        .from('polar_subscriptions')
        .upsert({
          user_id: userId,
          ...polarData,
          updated_at: new Date().toISOString()
        });

      // Broadcast cambio
      await this.broadcastStateChange(userId, 'subscription', polarData);
    }

    async broadcastStateChange(userId, section, data) {
      const message = {
        type: 'state_update',
        section,
        data,
        timestamp: new Date().toISOString()
      };

      // Publicar a WebSocket
      if (global.wss) {
        broadcastToUser(userId, message);
      }

      // Publicar a Redis pub/sub (para multi-instance sync)
      await publisher.publish(`state:${userId}`, JSON.stringify(message));
    }
  }

  module.exports = new StateService();
  ```

### 2. Backend: API Endpoints

- [ ] **Crear `GET /api/state`**
  - [ ] Validar usuario autenticado
  - [ ] Llamar `StateService.getGlobalState(userId)`
  - [ ] Retornar estado completo (JSON ~2KB)
  - [ ] Cache 30 segundos (reduce DB queries)

- [ ] **Crear `POST /api/state/sync`**
  - [ ] Validar usuario autenticado
  - [ ] Forzar sync desde Polar (útil tras pago)
  - [ ] Llamar `StateService.syncFromPolar(userId)`
  - [ ] Retornar estado actualizado
  - [ ] Rate limit: 10 requests/hora

- [ ] **Crear `GET /api/state/:section`** (granular fetch)
  - [ ] Permitir fetch de solo una sección (ej: `/api/state/subscription`)
  - [ ] Reduce bandwidth para updates parciales

### 3. Backend: WebSocket Implementation (Advanced)

- [ ] **Extender `WebSocketService.js`** (de Issue Roasting Control)

  - [ ] Añadir handler para mensajes `subscribe_state`
  - [ ] Mantener map de subscripciones activas
  - [ ] Broadcast solo a clientes suscritos

  ```javascript
  wss.on('connection', (ws, req) => {
    const userId = authenticateWebSocket(req);
    ws.userId = userId;
    ws.subscriptions = new Set(); // Secciones suscritas

    ws.on('message', (message) => {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        ws.subscriptions.add(data.section); // 'subscription', 'roasting', etc.
        logger.info(`User ${userId} subscribed to ${data.section}`);
      }

      if (data.type === 'unsubscribe') {
        ws.subscriptions.delete(data.section);
      }
    });
  });

  function broadcastToUser(userId, message) {
    wss.clients.forEach(client => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        // Solo enviar si cliente está suscrito a esa sección
        if (!message.section || client.subscriptions.has(message.section)) {
          client.send(JSON.stringify(message));
        }
      }
    });
  }
  ```

### 4. Backend: Conflict Resolution

- [ ] **Añadir columna `version` a tablas críticas:**
  ```sql
  ALTER TABLE user_roast_config ADD COLUMN version INT DEFAULT 1;
  ALTER TABLE user_personas ADD COLUMN version INT DEFAULT 1;
  ```

- [ ] **Implementar Last Write Wins con version check:**
  ```javascript
  async function updateWithVersionCheck(table, userId, data, clientVersion) {
    const { data: current } = await supabase
      .from(table)
      .select('version')
      .eq('user_id', userId)
      .single();

    if (current.version > clientVersion) {
      // Conflicto: servidor más reciente
      throw new Error('CONFLICT: State has been updated by another client');
    }

    // Incrementar version
    await supabase
      .from(table)
      .update({
        ...data,
        version: current.version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  }
  ```

### 5. Frontend: State Management Setup

**Opción A: React Context API**

- [ ] **Crear `src/context/GlobalStateContext.jsx`**
  ```jsx
  import { createContext, useContext, useState, useEffect } from 'react';

  const GlobalStateContext = createContext();

  export function GlobalStateProvider({ children }) {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      // Fetch inicial
      fetchGlobalState();

      // Setup WebSocket
      connectWebSocket();

      // Setup polling fallback
      const interval = setInterval(fetchGlobalState, 30000); // 30s

      return () => clearInterval(interval);
    }, []);

    async function fetchGlobalState() {
      const response = await fetch('/api/state', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setState(data);
      setLoading(false);
    }

    function connectWebSocket() {
      const ws = new WebSocket(`wss://yourapp.com/ws?token=${localStorage.getItem('token')}`);

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'state_update') {
          // Update solo la sección cambiada
          setState(prev => ({
            ...prev,
            [message.section]: message.data
          }));
        }
      };

      // Suscribirse a todas las secciones
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', section: 'subscription' }));
        ws.send(JSON.stringify({ type: 'subscribe', section: 'roasting' }));
      };
    }

    return (
      <GlobalStateContext.Provider value={{ state, loading }}>
        {children}
      </GlobalStateContext.Provider>
    );
  }

  export const useGlobalState = () => useContext(GlobalStateContext);
  ```

**Opción B: Zustand**

- [ ] **Instalar Zustand:**
  ```bash
  npm install zustand
  ```

- [ ] **Crear `src/stores/globalStateStore.js`:**
  ```javascript
  import create from 'zustand';

  export const useGlobalState = create((set) => ({
    state: null,
    loading: true,

    fetchState: async () => {
      const response = await fetch('/api/state', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      set({ state: data, loading: false });
    },

    updateSection: (section, data) => {
      set((state) => ({
        state: {
          ...state.state,
          [section]: data
        }
      }));
    }
  }));
  ```

### 6. Frontend: Optimistic Updates

- [ ] **Implementar en acciones de usuario:**
  ```jsx
  async function toggleRoasting(enabled) {
    // 1. Optimistic update
    updateGlobalState('roasting', { ...state.roasting, enabled });

    try {
      // 2. Server request
      await fetch('/api/roasting/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });

      // 3. Server confirms → ya sincronizado vía WebSocket
    } catch (error) {
      // 4. Rollback en caso de error
      updateGlobalState('roasting', { ...state.roasting, enabled: !enabled });
      showNotification('Error al cambiar estado');
    }
  }
  ```

### 7. Testing

- [ ] **Tests unitarios para `StateService`**
  - [ ] Test: `getGlobalState()` retorna schema completo
  - [ ] Test: `syncFromPolar()` actualiza subscription correctamente
  - [ ] Test: `broadcastStateChange()` publica a WebSocket

- [ ] **Tests de integración para endpoints**
  - [ ] Test: `GET /api/state` retorna estado completo
  - [ ] Test: `POST /api/state/sync` fuerza sync desde Polar
  - [ ] Test: `GET /api/state/subscription` retorna solo subscription

- [ ] **Tests de WebSocket**
  - [ ] Test: Cliente se conecta → recibe estado inicial
  - [ ] Test: Update en servidor → cliente recibe broadcast
  - [ ] Test: Subscription selectiva → solo recibe secciones suscritas

- [ ] **Tests de conflict resolution**
  - [ ] Test: Cliente con version antigua intenta update → CONFLICT
  - [ ] Test: Last Write Wins funciona correctamente

- [ ] **Tests E2E**
  - [ ] Usuario cambia subscription en dispositivo A → Dispositivo B sincroniza
  - [ ] Usuario cambia roast level → Estado persiste tras refresh
  - [ ] Optimistic update + error → Rollback correcto

### 8. Documentación

- [ ] Actualizar `docs/flows/global-state.md` con:
  - [ ] Código completo de StateService
  - [ ] Ejemplos de React Context y Zustand
  - [ ] Diagrama de flujo de sincronización

- [ ] Crear `docs/STATE-MANAGEMENT.md`:
  - [ ] Guía de uso de global state
  - [ ] Best practices
  - [ ] Troubleshooting

- [ ] Actualizar `CLAUDE.md`:
  - [ ] Documentar arquitectura de state
  - [ ] Decisión de React Context vs Zustand

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**
- ✅ Issue Login & Registration
- ✅ Issue Payment (Polar)
- ✅ Issue Persona Setup
- ✅ Issue Roasting Control
- ✅ Issue Level Configuration

**Esta es la última issue - integra todo el sistema.**

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ `StateService` implementado con sync desde múltiples fuentes
2. ✅ Endpoints `/api/state` y `/state/sync` funcionales
3. ✅ WebSocket server implementado (o polling como fallback)
4. ✅ Frontend state management implementado (Context o Zustand)
5. ✅ Optimistic updates funcionando
6. ✅ Conflict resolution con version tracking
7. ✅ Sync multi-dispositivo verificado
8. ✅ **TODOS los tests pasando al 100%**
9. ✅ Documentación completa
10. ✅ CI/CD passing

---

## 📊 Métricas de Éxito

| Métrica | Valor Actual | Objetivo | Estado |
|---------|--------------|----------|--------|
| Tests pasando | N/A | 100% | ⏳ Pendiente |
| Latencia sync | N/A | <500ms | ⏳ Pendiente |
| Tiempo de implementación | 0h | ≤16h | ⏳ Pendiente |
| WebSocket uptime | N/A | >99% | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**Complejidad:**
- Esta es la issue más compleja (16h estimadas)
- Requiere coordinación entre múltiples servicios
- WebSocket añade complejidad operacional

**Alternativa Simplificada:**
- Si 16h es demasiado, considerar solo polling (sin WebSocket)
- Reduce estimación a ~8h
- Pierde sync en tiempo real pero funcional

**Performance:**
- Cachear estado en frontend (no fetch en cada render)
- Invalidar cache solo cuando WebSocket notifica
- Polling como fallback si WebSocket cae

**DevOps:**
- WebSocket requiere sticky sessions en load balancer
- Redis pub/sub para multi-instance deployments
- Monitoring de conexiones WebSocket activas

---

## ⏸️ Estado de Esta Issue

**Esta issue está PAUSADA hasta que el usuario decida:**

1. **Frontend State:** React Context o Zustand
2. **WebSocket:** Implementar completo o solo polling

**Pregunta para usuario:**
¿Prefieres implementación completa con WebSocket (16h) o versión simplificada con solo polling (8h)?
