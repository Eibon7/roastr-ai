# GDD Node — Shield (Sistema Antitrolls) v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`billing`](./billing.md)
- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)

- [`billing`](./billing.md)
- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)

Este nodo depende de los siguientes nodos:

- [`billing`](./billing.md)
- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)

---

Este nodo depende de los siguientes nodos:

- [`billing`](./billing.md) - Límites y créditos
- [`infraestructura`](./14-infraestructura.md) - Colas y base de datos
- [`observabilidad`](./observabilidad.md) - Logging estructurado
- [`ssot-integration`](./15-ssot-integration.md) - Thresholds, weights, reglas de decisión
- [`analysis-engine`](./05-motor-analisis.md) - Decisiones de moderación

### Servicios Externos:

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

## 11. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `shield_decision_rules` - Reglas de decisión de Shield
- `shield_decision_tree` - Árbol de decisiones de Shield
- `shield_thresholds` - Umbrales de activación de Shield
- `shield_weights` - Pesos de factores de Shield
- `strike_level_types` - Tipos de niveles de strike (0, 1, 2, critical)
- `strike_system` - Sistema de strikes y ventana de 90 días

---

## 12. Related Nodes
