# Issue: Implementar Level Configuration (Roast Levels 1-5 + Shield Levels)

**Prioridad:** P3 (Baja - Enhancement, no crítico para MVP)
**Estimación:** 5-6 horas
**Estado Actual:** 20% completado (conceptualmente definido)
**Documentación:** [docs/flows/level-configuration.md](../flows/level-configuration.md)

---

## 🎯 ¿Qué es este flujo?

**Level Configuration** es el sistema de ajuste fino de la intensidad de roasting. Permite al usuario configurar:

**1. Roast Level (1-5):** Controla la intensidad del roast generado
- **Nivel 1 (Suave):** Sarcasmo ligero, sin profanity, temperatura 0.6
- **Nivel 2 (Neutral):** Balance, sin profanity, temperatura 0.7
- **Nivel 3 (Moderado):** Intenso, profanity permitida, temperatura 0.8
- **Nivel 4 (Agresivo):** Muy intenso, profanity fuerte, temperatura 0.9
- **Nivel 5 (Caústico):** Máxima intensidad, sin límites, temperatura 1.0

**2. Shield Level:** Controla el threshold de toxicidad para moderation
- **Tolerante (τ=0.85):** Solo bloquea contenido muy tóxico
- **Balanceado (τ=0.70):** Moderación estándar
- **Estricto (τ=0.50):** Bloquea casi todo (máxima protección)

**¿Por qué es importante?**
- **Personalización:** Cada usuario tiene tolerancia diferente
- **Compliance:** Shield permite cumplir políticas de plataformas
- **Monetización:** Features bloqueadas por plan (upsell a Pro)
- **Calidad:** Niveles mapean a parámetros OpenAI (temperature, max_tokens, system prompt)

**Plan-based Restrictions:**
- Free: Fijo en nivel 2 + Shield Balanceado (sin configuración)
- Starter: Niveles 1-3 + Shield Tolerante/Balanceado
- Pro/Plus: Todos los niveles (1-5) + todos los Shield modes

**Tecnologías:**
- Mapping nivel → parámetros OpenAI (temperature, system prompt)
- Plan validation server-side (NO confiar en frontend)
- Integration con `RoastGeneratorEnhanced` y `ShieldService`

**Business Logic:**
- Niveles altos = mayor temperatura = roasts más impredecibles/intensos
- Shield strict = menor threshold = más comentarios bloqueados
- Upsell prompt si usuario intenta usar nivel bloqueado

---

## 📋 Descripción Técnica

Implementar sistema de configuración de niveles de intensidad para:

**Roast Levels (1-5):**
1. **Suave** - Sarcasmo ligero, sin profanity
2. **Neutral** - Balance, sin profanity
3. **Moderado** - Intenso, profanity permitida
4. **Agresivo** - Muy intenso, profanity fuerte
5. **Caústico** - Máxima intensidad, sin límites

**Shield Levels (Toxicity Thresholds):**
- **Tolerante** - τ = 0.85 (solo bloquea muy tóxico)
- **Balanceado** - τ = 0.70 (moderación estándar)
- **Estricto** - τ = 0.50 (bloquea casi todo)

**Plan-based Restrictions:**
- Free: Fijo en nivel 2 (Neutral) + Shield Balanceado
- Starter: Acceso a niveles 1-3 + Shield Tolerante/Balanceado
- Pro/Plus: Acceso completo (1-5) + todos los Shield modes

**Estado actual:**
- ✅ Conceptualmente definido en assessment
- ❌ Tabla `user_roast_config` no existe
- ❌ `LevelConfigService.js` no existe
- ❌ Endpoints `/api/config/roast-level` y `/shield-level` no implementados
- ❌ Mapping de niveles → parámetros OpenAI hardcoded

---

## ✅ Checklist Técnico

### 1. Backend: Database Schema

- [ ] **Crear tabla `user_roast_config`**
  ```sql
  CREATE TABLE user_roast_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roast_level INT NOT NULL DEFAULT 2 CHECK (roast_level BETWEEN 1 AND 5),
    shield_level TEXT NOT NULL DEFAULT 'balanceado'
      CHECK (shield_level IN ('tolerante', 'balanceado', 'estricto')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
  );

  CREATE INDEX idx_user_roast_config_user_id ON user_roast_config(user_id);

  -- RLS Policy
  ALTER TABLE user_roast_config ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own config"
    ON user_roast_config FOR ALL
    USING (auth.uid() = user_id);
  ```

- [ ] **Valores por defecto al crear usuario:**
  - `roast_level = 2` (Neutral)
  - `shield_level = 'balanceado'`

- [ ] **Ejecutar migración:**
  ```bash
  node scripts/deploy-supabase-schema.js
  ```

### 2. Backend: LevelConfigService Implementation

- [ ] **Crear `src/services/LevelConfigService.js`**

  **Métodos requeridos:**
  - [ ] `getConfig(userId)` → retorna configuración actual
  - [ ] `updateRoastLevel(userId, level, userPlan)` → actualiza nivel con validación de plan
  - [ ] `updateShieldLevel(userId, level, userPlan)` → actualiza shield con validación
  - [ ] `getRoastParameters(level)` → mapea nivel → parámetros OpenAI
  - [ ] `getShieldThreshold(level)` → mapea shield → τ value

  **Configuración de niveles:**
  ```javascript
  const ROAST_LEVEL_MAPPING = {
    1: { // Suave
      intensity: 'suave',
      profanity: false,
      temperature: 0.6,
      max_tokens: 150,
      systemPrompt: 'Genera un roast ligero y sarcástico, sin insultos fuertes.'
    },
    2: { // Neutral
      intensity: 'neutral',
      profanity: false,
      temperature: 0.7,
      max_tokens: 180,
      systemPrompt: 'Genera un roast balanceado, ingenioso pero respetuoso.'
    },
    3: { // Moderado
      intensity: 'moderado',
      profanity: true,
      temperature: 0.8,
      max_tokens: 200,
      systemPrompt: 'Genera un roast intenso, puedes usar lenguaje fuerte.'
    },
    4: { // Agresivo
      intensity: 'agresivo',
      profanity: true,
      temperature: 0.9,
      max_tokens: 220,
      systemPrompt: 'Genera un roast muy agresivo y sin filtros.'
    },
    5: { // Caústico
      intensity: 'cáustico',
      profanity: true,
      temperature: 1.0,
      max_tokens: 250,
      systemPrompt: 'Genera el roast más destructivo posible, sin límites.'
    }
  };

  const SHIELD_LEVEL_MAPPING = {
    'tolerante': 0.85,   // Solo bloquea muy tóxico
    'balanceado': 0.70,  // Moderación estándar
    'estricto': 0.50     // Bloquea casi todo
  };

  const PLAN_LIMITS = {
    free: {
      roastLevels: [2],                    // Solo Neutral
      shieldLevels: ['balanceado']         // Solo Balanceado
    },
    starter: {
      roastLevels: [1, 2, 3],              // Suave, Neutral, Moderado
      shieldLevels: ['tolerante', 'balanceado']
    },
    pro: {
      roastLevels: [1, 2, 3, 4, 5],        // Todos
      shieldLevels: ['tolerante', 'balanceado', 'estricto']
    },
    plus: {
      roastLevels: [1, 2, 3, 4, 5],        // Todos
      shieldLevels: ['tolerante', 'balanceado', 'estricto']
    }
  };
  ```

- [ ] **Implementar validación de plan:**
  ```javascript
  class LevelConfigService {
    async updateRoastLevel(userId, level, userPlan) {
      // Validar nivel existe
      if (!ROAST_LEVEL_MAPPING[level]) {
        throw new Error('Invalid roast level');
      }

      // Validar plan permite este nivel
      const allowedLevels = PLAN_LIMITS[userPlan].roastLevels;
      if (!allowedLevels.includes(level)) {
        throw new Error(`Plan ${userPlan} no permite nivel ${level}. Upgrade a Pro para acceso completo.`);
      }

      // Actualizar en DB
      const { data, error } = await supabase
        .from('user_roast_config')
        .upsert({
          user_id: userId,
          roast_level: level,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Updated roast level for user ${userId}: ${level}`);
      return data;
    }

    getRoastParameters(level) {
      return ROAST_LEVEL_MAPPING[level] || ROAST_LEVEL_MAPPING[2]; // Default Neutral
    }

    getShieldThreshold(level) {
      return SHIELD_LEVEL_MAPPING[level] || 0.70; // Default Balanceado
    }
  }

  module.exports = new LevelConfigService();
  ```

### 3. Backend: API Endpoints

- [ ] **Crear `GET /api/config/levels`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener configuración de DB
  - [ ] Retornar:
    ```json
    {
      "roastLevel": 2,
      "shieldLevel": "balanceado",
      "plan": "starter",
      "availableRoastLevels": [1, 2, 3],
      "availableShieldLevels": ["tolerante", "balanceado"]
    }
    ```

- [ ] **Crear `POST /api/config/roast-level`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener plan de usuario (desde `polar_subscriptions`)
  - [ ] Validar acceso con `LevelConfigService.updateRoastLevel()`
  - [ ] Retornar 200 + config actualizada
  - [ ] Retornar 403 si plan insuficiente

- [ ] **Crear `POST /api/config/shield-level`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener plan de usuario
  - [ ] Validar acceso con `LevelConfigService.updateShieldLevel()`
  - [ ] Retornar 200 + config actualizada
  - [ ] Retornar 403 si plan insuficiente

- [ ] **Rate limit:** 20 updates/hora (prevent spam)

### 4. Backend: Integration con Roast Generation

- [ ] **Actualizar `RoastGeneratorEnhanced.js`** (o servicio equivalente)

  ```javascript
  async function generateRoast(userId, comment) {
    // Cargar configuración de nivel
    const config = await LevelConfigService.getConfig(userId);
    const roastParams = LevelConfigService.getRoastParameters(config.roast_level);

    // Aplicar parámetros al prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: roastParams.systemPrompt },
        { role: 'user', content: `Roastea este comentario: ${comment}` }
      ],
      temperature: roastParams.temperature,
      max_tokens: roastParams.max_tokens
    });

    return completion.choices[0].message.content;
  }
  ```

- [ ] **Actualizar `ShieldService.js`** (toxicity moderation)

  ```javascript
  async function shouldBlockComment(userId, comment, toxicityScore) {
    const config = await LevelConfigService.getConfig(userId);
    const threshold = LevelConfigService.getShieldThreshold(config.shield_level);

    if (toxicityScore >= threshold) {
      logger.info(`Blocked comment for user ${userId}: toxicity=${toxicityScore}, threshold=${threshold}`);
      return true;
    }

    return false;
  }
  ```

### 5. Frontend: Level Configuration UI

- [ ] **Crear componente `LevelConfigPanel`**

  ```jsx
  function LevelConfigPanel() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchConfig();
    }, []);

    async function fetchConfig() {
      const response = await fetch('/api/config/levels', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setConfig(data);
      setLoading(false);
    }

    async function updateRoastLevel(newLevel) {
      try {
        const response = await fetch('/api/config/roast-level', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ level: newLevel })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }

        setConfig({ ...config, roastLevel: newLevel });
        showNotification('✅ Nivel de roast actualizado');
      } catch (error) {
        showNotification('❌ ' + error.message);
      }
    }

    return (
      <div>
        <h3>Nivel de Roast</h3>
        <div className="level-selector">
          {[1, 2, 3, 4, 5].map(level => (
            <button
              key={level}
              onClick={() => updateRoastLevel(level)}
              disabled={!config?.availableRoastLevels.includes(level)}
              className={config?.roastLevel === level ? 'active' : ''}
            >
              Nivel {level}
              {!config?.availableRoastLevels.includes(level) && ' 🔒'}
            </button>
          ))}
        </div>

        <h3>Nivel de Shield</h3>
        {/* Similar para shield levels */}
      </div>
    );
  }
  ```

- [ ] **Mostrar upgrade prompt si usuario intenta usar nivel bloqueado:**
  ```jsx
  if (!config.availableRoastLevels.includes(5)) {
    return (
      <div className="upgrade-prompt">
        🔒 Nivel Caústico requiere plan Pro
        <button onClick={() => navigate('/upgrade')}>Upgrade Now</button>
      </div>
    );
  }
  ```

### 6. Testing

- [ ] **Tests unitarios para `LevelConfigService`**
  - [ ] Test: `getRoastParameters(3)` retorna params correctos
  - [ ] Test: `getShieldThreshold('estricto')` retorna 0.50
  - [ ] Test: `updateRoastLevel()` con plan Free intentando nivel 5 → Error
  - [ ] Test: `updateRoastLevel()` con plan Pro nivel 5 → Success

- [ ] **Tests de integración para endpoints**
  - [ ] Test: `POST /api/config/roast-level` con nivel permitido → 200
  - [ ] Test: `POST /api/config/roast-level` con nivel no permitido → 403
  - [ ] Test: `GET /api/config/levels` retorna config + available levels

- [ ] **Tests de integración con roast generation**
  - [ ] Test: Usuario nivel 1 → roast suave, temperatura 0.6
  - [ ] Test: Usuario nivel 5 → roast caústico, temperatura 1.0
  - [ ] Test: Shield estricto bloquea comentario con toxicity 0.60

- [ ] **Tests E2E del flujo completo**
  - [ ] Usuario cambia nivel → Roast generado refleja nuevo nivel
  - [ ] Usuario con plan Free intenta nivel 4 → Mensaje de upgrade
  - [ ] Usuario upgradea a Pro → Todos los niveles desbloqueados

### 7. Documentación

- [ ] Actualizar `docs/flows/level-configuration.md` con:
  - [ ] Tabla completa de mapping niveles → parámetros
  - [ ] Ejemplos de roasts por nivel
  - [ ] Código de integración con OpenAI

- [ ] Actualizar `docs/nodes/roast.md`:
  - [ ] Documentar sistema de niveles
  - [ ] Añadir LevelConfigService a "Agentes Relevantes"

- [ ] Actualizar `CLAUDE.md`:
  - [ ] Documentar tabla `user_roast_config`
  - [ ] Documentar restricciones por plan

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**
- ✅ Issue Login & Registration
- ✅ Issue Payment (Polar) - Para validación de planes

**Opcionales:**
- Issue Persona Setup - Mejora personalización pero no bloqueante

**Desbloqueadas por esta issue:**
- Issue Global State (incluye `roasting.roast_level` y `roasting.shield_level`)

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ Tabla `user_roast_config` creada
2. ✅ `LevelConfigService` implementado con validaciones de plan
3. ✅ Endpoints `/api/config/levels`, `/roast-level`, `/shield-level` funcionales
4. ✅ Integration con `RoastGeneratorEnhanced` y `ShieldService`
5. ✅ Frontend con selección de niveles + upgrade prompts
6. ✅ Plan-based restrictions funcionando correctamente
7. ✅ **TODOS los tests pasando al 100%**
8. ✅ Documentación actualizada
9. ✅ Pre-Flight Checklist ejecutado
10. ✅ CI/CD passing

---

## 📊 Métricas de Éxito

| Métrica | Valor Actual | Objetivo | Estado |
|---------|--------------|----------|--------|
| Tests pasando | N/A | 100% | ⏳ Pendiente |
| Cobertura level config | N/A | ≥85% | ⏳ Pendiente |
| Tiempo de implementación | 0h | ≤6h | ⏳ Pendiente |
| Plan restrictions working | ❌ | ✅ | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**UX:**
- Mostrar descripciones claras de cada nivel ("Suave: Sarcasmo ligero...")
- Indicador visual del nivel actual (slider, botones, etc.)
- Ejemplos de roasts por nivel en tooltip
- Lock icon 🔒 para niveles bloqueados

**Performance:**
- Cachear configuración en frontend (no fetch en cada request)
- Invalidar cache al cambiar nivel

**Business Logic:**
- Plan restrictions deben ser servidor-side (NO confiar en frontend)
- Logging de cambios de nivel (analytics)
- Email notification si usuario intenta usar nivel bloqueado (sugiriendo upgrade)

---

**Siguiente paso tras completar:** Implementar Issue Global State - P4
