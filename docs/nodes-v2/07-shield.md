# GDD Node — Shield (Sistema Antitrolls) v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Sistema de protección que elimina comentarios ofensivos, agresivos o peligrosos antes de que afecten al usuario. Opera en dos niveles (moderado y crítico) con acciones específicas (ocultar, reportar, bloquear) según la severidad y la plataforma. Shield NUNCA genera texto - solo ejecuta moderación.

---

## 2. Responsibilities

### Funcionales:

- Ejecutar acciones según decisión del Motor de Análisis
- Shield Moderado: ocultar + escalar strikes
- Shield Crítico: ocultar + reportar + bloquear (amenazas/identity attacks) + establecer strike="critical"
- Gestión de reincidencia (strikes ≤ 90 días)
- Configuración por cuenta (`shield_aggressiveness`)
- Aplicar reglas de Roastr Persona (líneas rojas, identidades)
- Fallbacks cuando plataforma no soporta acciones

### No Funcionales:

- Logs sin texto crudo (GDPR)
- Retries con backoff
- Auditoría completa de acciones
- Idempotencia

---

## 3. Inputs

- **Decisión del Motor de Análisis**: "shield_moderado" | "shield_critico"
- **Comentario**: comment_id, platform, offender_id
- **Severity score**: score_final del análisis
- **Shield config**: aggressiveness (0.90, 0.95, 0.98, 1.00)
- **Roastr Persona**: matched_red_line (si aplica)
- **Flags detectados**: hasIdentityAttack, hasThreat

---

## 4. Outputs

- Acción ejecutada: hide, report, block
- Strike establecido:
  - Shield Moderado → escala (1 → 2)
  - Shield Crítico → establece `strikeLevel = "critical"`
- Shield log (sin texto):
  ```typescript
  {
    (id,
      user_id,
      account_id,
      platform,
      comment_id,
      offender_id,
      action_taken, // 'hide' | 'report' | 'block'
      severity_score,
      strike_assigned, // null | 2 | "critical"
      matched_red_line,
      target_type, // "user" | "sponsor"
      using_aggressiveness,
      timestamp);
  }
  ```

---

## 5. Rules

### Niveles de Shield:

**1. Shield Moderado**:
Condición:

```typescript
τ_shield ≤ severity_score < τ_critical
```

Acciones:

- Ocultar comentario (si API permite)
- Escalar strike (Strike 1 → Strike 2)
- En reincidencia → considerar reporte
- ❌ NO hay roast

**2. Shield Crítico**:
Condiciones (cualquiera):

- `severity_score >= τ_critical`
- Identity attack detectado
- Amenaza detectada
- Línea roja severa
- Reincidencia agravada (Strike 2 + contenido ofensivo)

Acciones:

- Ocultar siempre (si API permite)
- Reportar (cuando corresponda)
- Bloquear (amenazas / identity attacks)
- Establece `strikeLevel = "critical"` (NO incrementa strikes existentes)
- ❌ NO genera roast

### Roastr Persona y Shield:

**Línea Roja → Escalada directa**:

- Toxicidad baja + línea roja → Shield Moderado
- Toxicidad media + línea roja → Shield Crítico
- Toxicidad alta + línea roja → Shield Crítico

**Identidades → Más sensibilidad**:

- Baja ligeramente los thresholds del Shield
- (Implementado en Motor de Análisis)

**Tolerancias → Menos sensibilidad**:

- Reduce severity score
- **Límites**:
  - ✅ Puede convertir roasteable → publicación normal
  - ✅ Puede convertir moderado → roasteable
  - ❌ **NUNCA** convierte crítico en nada más benigno

### Shield Aggressiveness (por cuenta):

```typescript
shield_aggressiveness: 0.90 | 0.95 | 0.98 | 1.00
default = 0.95
```

Aplicación:

```typescript
// Aggressiveness NO aplica en casos críticos absolutos
if (!hasIdentityAttack && !hasThreat) {
  severity_score = severity_score * aggressiveness;
}
// Identity attacks y amenazas permanecen críticos siempre
```

**Regla**: Aggressiveness ajusta sensibilidad general, pero **NO puede reducir** la severidad de:

- Identity attacks (siempre crítico)
- Amenazas (siempre crítico)

- 0.90 → más permisivo (para casos no críticos)
- 1.00 → más estricto

Editable desde SSOT vía Admin Panel.

### Acciones por Plataforma:

**Ocultar**:

- Acción primaria en Moderado y Crítico
- Si red NO permite → fallback a bloquear
- Si API falla → retry → fallback a bloquear

**Reportar**:

- Aplicable en: amenazas, identity attacks, reincidencia severa
- Payload: link + categoría + historial (si API permite)
- Si API rechaza → fallback ocultar + bloquear

**Bloquear**:

- Amenazas directas
- Ataques a identidad
- Shield Crítico en redes sin opción de ocultar
- Errores múltiples al ocultar/reportar

### Interacción con Respuesta Correctiva:

**⚠️ IMPORTANTE**: La Respuesta Correctiva (Strike 1) **NO es parte del Shield**.

- Es un flujo separado del Motor de Análisis
- Gestionada por worker `GenerateCorrectiveReply`
- Shield NUNCA genera texto
- Correctiva es decisión independiente antes de Shield
- Ver nodo `06-motor-roasting.md` para detalles completos

**Condición Correctiva**:

- `score_final < τ_shield` + insulto leve + argumento válido
- Requiere créditos de roast disponibles
- Si no hay créditos → se registra `corrective_skipped_no_credits`

### Auto-Approve y Shield:

⚠️ **Auto-approve NO afecta al Shield**

Auto-approve controla SOLO publicación de roasts.

Si Shield actúa → **no puede haber roast** aunque auto-approve esté ON.

### Sponsors (Plus):

**Sponsors funcionan como "perfiles protegidos" adicionales**:

- Shield aplica mismas reglas de severidad a ataques contra sponsors
- El ataque se clasifica según severity_score (Moderado/Crítico)
- **Acciones aplicables**:
  - ✅ Ocultar comentario
  - ✅ Reportar (si crítico)
  - ✅ Bloquear (si amenaza/identity attack a sponsor)
- **NO se generan strikes** para el ofensor (no afecta `offender_history`)
- El sponsor NO es un ofensor, es un protegido
- Logs registran `target_type: "sponsor"` en vez de `target_type: "user"`

---

## 6. Dependencies

### Servicios Externos:

- **X API**: hide, report, block
- **YouTube API**: hide, report (según disponibilidad)
- **Supabase**: Tablas `shield_logs`, `offenders`

### SSOT:

- Thresholds: `τ_shield`, `τ_critical`
- Shield aggressiveness por defecto
- Acciones permitidas por plataforma

### Workers:

- `ShieldAction`: Ejecuta acciones de Shield (hide, report, block)

### Nodos Relacionados:

- `05-motor-analisis.md` (Decisión shield_moderado/critico, árbol de prioridades)
- `06-motor-roasting.md` (Correctiva es flujo separado, NO parte de Shield)
- `08-workers.md` (Worker ShieldAction)
- `09-panel-usuario.md` (UI de Shield logs)

---

## 7. Edge Cases

1. **Red no permite ocultar**:
   - Fallback: bloquear + log

2. **Ofensor borra comentario antes de análisis**:
   - Strike parcial
   - Si repetido → "evasivo" → más sensibilidad futura

3. **APIs piden contexto extra**:
   - Enlace + categoría + historial permitido
   - Si falla → fallback ocultar/bloquear

4. **Sarcasmo que toca línea roja**:
   - Shield Moderado por defecto

5. **Diferencias por idioma**:
   - Thresholds dinámicos por idioma (SSOT)
   - Si no soportado → nivel base conservador

6. **Brigading (ataque coordinado)**:
   - Shield pasa a `aggressiveness` = 1.00
   - Alerta usuario
   - Registro global

7. **Límite análisis agotado**:
   - Shield OFF
   - Comentarios nuevos no llegan
   - Log del evento

8. **Comentario ambiguo**:
   - Shield Moderado por defecto

9. **Edición posterior del comentario (X)**:
   - Shield ya ejecutado NO se anula
   - Acción previa (ocultar/bloquear) se mantiene
   - No se genera reanálisis
   - Comentario puede permanecer oculto/bloqueado aunque se edite
   - Log adicional si API comunica cambio

10. **Plataformas sin API de reportar**:
    - Ocultar + bloquear
    - No reportar
    - Log

11. **Ataque a sponsor (Plus)**:
    - Shield actúa según severity
    - NO genera strikes en `offender_history`
    - Log con `target_type: "sponsor"`

12. **Identity attack con aggressiveness bajo (0.90)**:
    - Aggressiveness NO aplica
    - Caso permanece Shield Crítico
    - Identity/threat son overrides absolutos

---

## 8. Acceptance Criteria

### Shield Moderado:

- [ ] Activa cuando τ_shield ≤ score < τ_critical
- [ ] Oculta comentario (si API permite)
- [ ] Escala strike (1 → 2)
- [ ] En reincidencia → considera reporte
- [ ] NO genera roast

### Shield Crítico:

- [ ] Activa cuando score ≥ τ_critical OR identity_attack OR threat
- [ ] Oculta siempre
- [ ] Reporta cuando corresponde
- [ ] Bloquea si amenaza/identity attack
- [ ] Establece `strikeLevel = "critical"` (NO incrementa)
- [ ] NO genera roast

### Roastr Persona:

- [ ] Línea roja → escalada directa
- [ ] Identidades → más sensibilidad
- [ ] Tolerancias NO aplican en crítico

### Shield Aggressiveness:

- [ ] Valores: 0.90, 0.95 (default), 0.98, 1.00
- [ ] Ajusta severity_score (solo si NO identity_attack y NO threat)
- [ ] Identity/threat permanecen críticos independientemente de aggressiveness
- [ ] Editable desde SSOT

### Sponsors (Plus):

- [ ] Ataques a sponsors → Shield aplica según severity
- [ ] Puede ocultar, reportar, bloquear (según severity)
- [ ] NO afecta `offender_history` (sin strikes)
- [ ] Logs registran `target_type: "sponsor"`
- [ ] Sponsor es protegido, NO ofensor

### Logs:

- [ ] ❌ NO guardar texto comentario
- [ ] ✅ Guardar: acción, severity, strike_assigned, matched_red_line, target_type, aggressiveness, timestamp
- [ ] Incluir `target_type: "user"` o `"sponsor"`
- [ ] Incluir `strike_assigned: null | 2 | "critical"`

### Fallbacks:

- [ ] No puede ocultar → bloquear
- [ ] No puede reportar → ocultar + bloquear
- [ ] Errores API → retry → DLQ

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Shield aggressiveness calculation
- ✅ Decisión moderado vs crítico
- ✅ Línea roja → escalada
- ✅ Tolerancias NO aplican en crítico
- ❌ NO testear: APIs plataforma

### Integration Tests (Supabase Test):

- ✅ Shield Moderado oculta comentario
- ✅ Shield Moderado escala strike (1 → 2)
- ✅ Shield Crítico oculta + reporta
- ✅ Shield Crítico establece strikeLevel = "critical"
- ✅ Identity attack → crítico (override, aggressiveness NO aplica)
- ✅ Amenaza → crítico (override, aggressiveness NO aplica)
- ✅ Reincidencia → escala strikes
- ✅ Sponsors protegidos → NO genera strikes
- ✅ Sponsors → logs con `target_type: "sponsor"`

### E2E Tests (Playwright):

- ✅ Comentario ofensivo → Shield activa
- ✅ UI muestra badge Shield
- ✅ Log de Shield visible en detalle cuenta
- ✅ Shield aggressiveness configurable
- ✅ Límite análisis 0 → Shield OFF

---

## 10. Implementation Notes

### Shield Service:

```typescript
// apps/backend-v2/src/services/shieldService.ts

export async function executeShieldAction(
  decision: 'shield_moderado' | 'shield_critico',
  comment: NormalizedComment,
  severity: number,
  matchedRedLine: boolean,
  hasIdentityAttack: boolean,
  hasThreat: boolean,
  targetType: 'user' | 'sponsor' = 'user'
): Promise<void> {
  const adapter = getPlatformAdapter(comment.platform);
  let strikeAssigned: null | 2 | 'critical' = null;

  try {
    // Ocultar
    await adapter.hideComment(comment.id);

    // Reportar si crítico
    if (decision === 'shield_critico') {
      await adapter.reportComment(comment.id, {
        category: determineCategory(severity, matchedRedLine),
        reason: 'automated_moderation'
      });

      // Establecer strike crítico (solo si NO es sponsor)
      if (targetType === 'user') {
        strikeAssigned = 'critical';
        await updateOffenderStrike(comment.authorId, 'critical');
      }
    } else if (decision === 'shield_moderado' && targetType === 'user') {
      // Escalar strike (1 → 2)
      strikeAssigned = 2;
      await escalateOffenderStrike(comment.authorId);
    }

    // Bloquear si amenaza/identity
    if (hasIdentityAttack || hasThreat) {
      await adapter.blockUser(comment.authorId);
    }
  } catch (error) {
    // Fallback: bloquear
    await adapter.blockUser(comment.authorId);
  }

  // Log (sin texto)
  await logShieldAction({
    userId: comment.userId,
    accountId: comment.accountId,
    platform: comment.platform,
    action: 'hide',
    severity,
    strikeAssigned,
    matchedRedLine,
    targetType
  });
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 7)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 4)
