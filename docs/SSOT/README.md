# SSOT (Single Source of Truth) — Roastr v2

**Estado:** 🟢 ACTIVO  
**Prioridad:** 🚨 MÁXIMA  
**Última actualización:** 2025-12-04

---

## 📖 ¿Qué es el SSOT?

El **SSOT (Single Source of Truth)** es el documento maestro que define TODOS los comportamientos, reglas, tipos, estados y límites de Roastr v2.

> **Regla de Oro:** Si el SSOT y el código discrepan, **el SSOT gana**.

---

## 📁 Ubicación

**Documento principal:**  
`docs/SSOT/roastr-ssot-v2.md`

**Cursor rule (enforcement):**  
`.cursor/rules/ssot-enforcement.mdc`

**Referencia en CLAUDE.md:**  
Sección "SSOT — MÁXIMA PRIORIDAD" (líneas ~11-68)

---

## 🎯 Propósito

El SSOT previene:

- ❌ Inventar planes, límites o features no autorizados
- ❌ Mezclar legacy v1 con v2
- ❌ Hardcodear valores que deben ser configurables
- ❌ Inconsistencias entre código, docs y specs
- ❌ AI-slop y código generado de baja calidad

---

## 🔍 ¿Qué Define el SSOT?

### 1. Planes v2

- ✅ `starter`, `pro`, `plus`
- ❌ `free`, `basic`, `creator_plus` (legacy)

### 2. Billing

- ✅ Polar (único proveedor v2)
- ❌ Stripe (legacy v1)

### 3. Estados de Suscripción

- `trialing`
- `active`
- `paused`
- `canceled_pending`
- `payment_retry`

### 4. Feature Flags

15 flags autorizados (lista completa, sin "etc."):

**Core Producto (6)**:

1. `autopost_enabled`
2. `manual_approval_enabled`
3. `custom_prompt_enabled`
4. `sponsor_feature_enabled`
5. `personal_tone_enabled`
6. `nsfw_tone_enabled`

**Shield / Seguridad (4)**:

7. `kill_switch_autopost`
8. `enable_shield`
9. `enable_roast`
10. `enable_perspective_fallback_classifier`

**UX / UI (2)**:

11. `show_two_roast_variants`
12. `show_transparency_disclaimer`

**Despliegue / Experimentales (3)**:

13. `enable_style_validator`
14. `enable_advanced_tones`
15. `enable_beta_sponsor_ui`

### 5. Shield & Análisis

- Thresholds: `roastLower`, `shield`, `critical`
- Weights: `lineaRoja`, `identidad`, `tolerancia`, strikes
- Decisiones: `publicar`, `correctiva`, `roast`, `shield_moderado`, `shield_critico`

### 6. Tonos

- ✅ `flanders`, `balanceado`, `canalla`, `personal`
- ❌ `nsfw` (futuro, no usar en v2)

### 7. Plataformas MVP

- ✅ X, YouTube
- ⏳ Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky (futuras)

### 8. Workers v2

9 workers oficiales:

- FetchComments
- AnalyzeToxicity
- GenerateRoast
- GenerateCorrectiveReply
- ShieldAction
- SocialPosting
- BillingUpdate
- CursorReconciliation
- StrikeCleanup

### 9. Testing

- Vitest (NO Jest)
- Supabase Test (BD real)
- Playwright (E2E)
- Umbrales mínimos por categoría

### 10. Límites por Plan

| Plan    | Análisis | Roasts | Cuentas/Red | Sponsors | Tono Personal |
| ------- | -------- | ------ | ----------- | -------- | ------------- |
| starter | 1,000    | 5      | 1           | ❌       | ❌            |
| pro     | 10,000   | 1,000  | 2           | ❌       | ✅            |
| plus    | 100,000  | 5,000  | 2           | ✅       | ✅            |

---

## 🚨 Workflow Obligatorio

**ANTES de implementar cualquier feature v2:**

```
1. Cargar docs/SSOT/roastr-ssot-v2.md
2. Identificar secciones relevantes
3. Validar alineación con SSOT
4. ¿Hay discrepancia?
   → SÍ: DETENER + comunicar inmediatamente
   → NO: proceder con referencia a SSOT
```

---

## 🛡️ Enforcement Automático

La cursor rule `.cursor/rules/ssot-enforcement.mdc` hace cumplir:

- ❌ Bloquea inventar planes, flags, estados
- ❌ Bloquea legacy v1 en código v2
- ✅ Requiere validación pre-implementación
- ✅ Fuerza SSOT-first code generation
- ✅ "SSOT gana" ante conflictos

---

## 📢 Comunicación de Discrepancias

Si detectas que el SSOT y el código/tarea no coinciden:

```
🚨 DETENCIÓN INMEDIATA
Esto requiere actualización del SSOT primero.

Discrepancia detectada:
- SSOT define: [valor del SSOT]
- Código/tarea propone: [valor propuesto]

¿Qué hacemos?
1. Actualizar SSOT (si la propuesta es correcta)
2. Corregir código/tarea (si el SSOT es correcto)
```

**NUNCA proceder sin aclarar la discrepancia.**

---

## 🔗 Referencias

- **SSOT completo:** `roastr-ssot-v2.md`
- **Cursor rule:** `.cursor/rules/ssot-enforcement.mdc`
- **CLAUDE.md:** Sección "SSOT — MÁXIMA PRIORIDAD"
- **Integración summary:** `../SSOT-INTEGRATION-SUMMARY.md`
- **Reglas V2:** `../REGLAS-V2-MEJORADAS.md`
- **Spec V2:** `../spec-v2.md`

---

## ✅ Estado de Integración

- ✅ SSOT creado y estructurado
- ✅ Cursor rule implementada
- ✅ CLAUDE.md actualizado
- ✅ Workflow de validación definido
- ✅ Template de comunicación incluido
- ✅ README creado (este archivo)

---

**SSOT OPERATIVO — LISTO PARA DESARROLLO V2**
