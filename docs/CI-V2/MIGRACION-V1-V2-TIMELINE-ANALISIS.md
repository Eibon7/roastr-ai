# Análisis de Timeline: Migración v1 → v2 (10-12 días)

**Fecha:** 2025-12-09  
**Issue:** ROA-318 (Cleanup Legacy v2)  
**Ritmo:** IA programando (no devs humanos)  
**Objetivo:** Evaluar viabilidad de completar migración en 10-12 días

---

## 📊 Resumen Ejecutivo

**Veredicto:** ✅ **VIABLE CON RESTRICCIONES**

La migración es **técnicamente viable en 10-12 días** con IA trabajando a tiempo completo, pero requiere:

1. **Priorización agresiva** - No todo se migra, solo lo crítico
2. **Feature flags** - Rollout gradual para reducir riesgo
3. **Automated testing** - Sin esto, el timeline se duplica
4. **Scope control ESTRICTO** - Zero scope creep

**Esfuerzo estimado:** ~80-96 horas de trabajo efectivo de IA  
**Ritmo sostenible:** 8 horas/día efectivas  
**Ventana realista:** 12 días con buffer

---

## 🔍 Estado Actual de la Migración

### ✅ Ya Completado (ROA-318)

**Documentación v2:**

- ✅ System-map-v2.yaml creado y validado (15 nodos)
- ✅ SSOT-V2.md como fuente única de verdad
- ✅ 16 nodos en docs/nodes-v2/ (14 funcionando + observabilidad + billing)
- ✅ GDD Health v2 al 98.67% (solo falta 1.33% - SSOT Alignment)
- ✅ Scripts de validación v2 funcionando (9 scripts sin hardcodes)
- ✅ Workflow system-map-v2-consistency.yml activo

**Infrastructure v2:**

- ✅ compute-health-v2-official.js - Cálculo dinámico desde system-map
- ✅ calculate-gdd-health-v2.js - Lectura desde SSOT (no calcula)
- ✅ validate-v2-doc-paths.js - Validación de paths
- ✅ validate-ssot-health.js - Validación de coherencia SSOT
- ✅ validate-strong-concepts.js - Gobernanza Strong/Soft concepts
- ✅ detect-legacy-ids.js - Detección de IDs legacy
- ✅ detect-guardian-references.js - Prevención de nodo deprecated

**Rules v2:**

- ✅ `.cursor/rules/v2-optimized-system.mdc` - Reglas de nodos/subnodos
- ✅ `.cursor/rules/system-map-consistency-drift-guard.mdc` - Consistencia
- ✅ `.cursor/rules/v2-development.mdc` - Desarrollo limpio v2

### ❌ Pendiente de Migración

**1. Workflows CI con scripts v1 legacy**

**CRÍTICO:** 4 workflows ejecutan `score-gdd-health.js` (v1 legacy):

| Workflow               | Script v1             | Impacto                         | Líneas Afectadas |
| ---------------------- | --------------------- | ------------------------------- | ---------------- |
| `gdd-validate.yml`     | `score-gdd-health.js` | Health v1 en PRs no-v2-only     | 272              |
| `gdd-telemetry.yml`    | `score-gdd-health.js` | Telemetría usa health v1        | 42               |
| `gdd-repair.yml`       | `score-gdd-health.js` | Reparación valida con health v1 | 115              |
| `gdd-auto-monitor.yml` | `score-gdd-health.js` | Monitoreo usa health v1         | 104              |

**Adicionalmente:**

- `validate-gdd-runtime.js` (v1) - Usado en 3 workflows
- `predict-gdd-drift.js` (v1) - Usado en 2 workflows
- `auto-repair-gdd.js` (v1) - Usado en 1 workflow

**2. Código src/ con IDs legacy**

Según `detect-legacy-ids.js`:

- **43 IDs legacy detectados** en código `src/`
- Incluye referencias a: `roast`, `shield`, `social-platforms`, `frontend-dashboard`, `plan-features`, `persona`
- Fuera de scope de ROA-318 pero debe migrarse para completar v2

**3. Sistema GDD v1 completo**

**Legacy docs pendientes:**

- `docs/nodes/*.md` (18 nodos v1) → Migrar a `docs/nodes-v2/`
- `docs/spec.md` (v1) → Deprecar o migrar a `docs/spec-v2.md`
- `docs/GDD-*.md` (v1) → Revisar si deben migrarse

**Legacy scripts pendientes:**

- `scripts/validate-gdd-runtime.js` → Equivalente v2 necesario
- `scripts/score-gdd-health.js` → **Usar compute-health-v2-official.js**
- `scripts/predict-gdd-drift.js` → Equivalente v2 necesario o deprecar
- `scripts/auto-repair-gdd.js` → Equivalente v2 necesario o deprecar
- `scripts/resolve-graph.js` → Validar si aplica a v2

**4. Features parcialmente implementadas**

- **Credits v2** - Implementado pero no activado (feature flag)
- **Polar billing** - Diseñado pero no implementado
- **Shield Phase 2** - 6/15 tests fallando (40% incompleto)
- **Kill switch** - Backend ready, DB migration pendiente

---

## ⏱️ Estimación de Esfuerzo por Componente

### Prioridad P0 - Bloqueadores Críticos (3-4 días)

**1. Migrar workflows a scripts v2** - **12 horas**

- Reemplazar `score-gdd-health.js` por `compute-health-v2-official.js` + `calculate-gdd-health-v2.js`
- 4 workflows afectados
- Testing en CI después de cada cambio
- **Riesgo:** Medio - Workflows son críticos para CI/CD

**2. Crear equivalentes v2 para scripts core** - **16 horas**

Scripts prioritarios:

- `validate-gdd-runtime-v2.js` - Validación de runtime v2 (8h)
- `predict-gdd-drift-v2.js` - O deprecar si no aplica (4h)
- `auto-repair-gdd-v2.js` - O deprecar si no aplica (4h)

**3. Migrar IDs legacy en src/ (43 instancias)** - **20 horas**

- Mapear IDs legacy a equivalentes v2
- Actualizar imports y referencias
- Tests por archivo modificado
- **Riesgo:** Alto - Puede romper funcionalidad existente

**4. Ajustar detect-legacy-ids.js para CI** - **2 horas**

- WARN en `src/` (fuera de scope v2)
- FAIL solo en `docs/` y `system-map-v2.yaml`
- O cambiar `continue-on-error: true` en workflow

**Total P0:** ~50 horas (~4 días a 12h/día efectivas)

### Prioridad P1 - Documentación y Validación (2-3 días)

**5. Migrar docs/nodes/\*.md a docs/nodes-v2/** - **12 horas**

- 18 nodos v1 → Revisar si aplican a v2
- Algunos pueden fusionarse o deprecarse
- Actualizar crosslinks y dependencias
- Añadir a system-map-v2.yaml si aplica

**6. Crear spec-v2.md o deprecar spec.md** - **8 horas**

- Decidir si spec.md tiene valor en v2
- Si sí: Migrar contenido relevante
- Si no: Marcar como deprecated y documentar

**7. Completar SSOT Alignment al 100%** - **4 horas**

Añadir secciones "SSOT References" a 10 nodos:

- roasting-engine, analysis-engine, shield-engine
- integraciones-redes-sociales, billing, infraestructura
- ssot-integration, auth, settings-loader-and-feature-flags
- gdpr-and-legal

**Total P1:** ~24 horas (~2 días)

### Prioridad P2 - Features Parciales (3-4 días)

**8. Completar Shield Phase 2 (6 tests failing)** - **16 horas**

- Implementar cooling-off period logic
- Time window escalation
- Pattern recognition (habitual offender)
- Recent activity vs historical behavior
- Aggregated violation tracking
- Platform-specific configuration

**9. Activar Credits v2 (feature flag)** - **8 horas**

- Validar implementación existente
- Testing exhaustivo en staging
- Documentar rollback plan
- Activar gradualmente

**10. Aplicar kill switch DB migration** - **2 horas**

- Aplicar migration manualmente
- Validar 20 feature flags iniciales
- Testing de endpoints

**Total P2:** ~26 horas (~2.5 días)

### Prioridad P3 - Cleanup y Optimización (1-2 días)

**11. Deprecar scripts v1 legacy** - **4 horas**

- Añadir warnings de deprecation
- Documentar equivalentes v2
- Actualizar README.md y documentación

**12. Limpiar archivos legacy** - **4 horas**

- Mover `docs/GDD-*.md` (v1) a `docs/legacy/`
- Archivar scripts no usados
- Cleanup de imports

**13. Validación E2E completa** - **8 horas**

- Tests de integración v2 completos
- CI passing al 100%
- Health score v2 al 100%

**Total P3:** ~16 horas (~1.5 días)

---

## 📅 Timeline Propuesto (12 días)

### Días 1-4: Bloqueadores Críticos (P0)

**Día 1:**

- [ ] Migrar workflows a scripts v2 (12h)
- [ ] Ajustar detect-legacy-ids.js (2h)

**Día 2:**

- [ ] Crear validate-gdd-runtime-v2.js (8h)
- [ ] Evaluar si predict/auto-repair aplican a v2 (4h)

**Día 3-4:**

- [ ] Migrar IDs legacy en src/ (20h)
- [ ] Testing exhaustivo post-migración (4h)

**Checkpoint Día 4:** ✅ CI/CD 100% v2, 0 referencias legacy en workflows

### Días 5-7: Documentación (P1)

**Día 5:**

- [ ] Migrar docs/nodes/ prioritarios a nodes-v2/ (8h)
- [ ] Decidir estrategia spec-v2.md (4h)

**Día 6:**

- [ ] Completar migración de nodos (4h)
- [ ] Completar SSOT Alignment al 100% (4h)
- [ ] Crear spec-v2.md o deprecar spec.md (4h)

**Día 7:**

- [ ] Validación de crosslinks y dependencias (4h)
- [ ] Health score v2 al 100% (verificación) (2h)
- [ ] Buffer para issues inesperados (6h)

**Checkpoint Día 7:** ✅ GDD v2 al 100%, docs completas

### Días 8-10: Features Parciales (P2)

**Día 8-9:**

- [ ] Completar Shield Phase 2 (16h)

**Día 10:**

- [ ] Activar Credits v2 en staging (8h)
- [ ] Aplicar kill switch migration (2h)
- [ ] Testing de features activadas (2h)

**Checkpoint Día 10:** ✅ Features completas, testing passing

### Días 11-12: Cleanup y Buffer (P3)

**Día 11:**

- [ ] Deprecar scripts v1 legacy (4h)
- [ ] Limpiar archivos legacy (4h)
- [ ] Validación E2E completa (4h)

**Día 12:**

- [ ] Buffer para issues inesperados (8h)
- [ ] Documentación final (2h)
- [ ] Merge a main (2h)

**Checkpoint Final:** ✅ v2 completa, v1 deprecated, CI/CD al 100%

---

## ⚠️ Riesgos y Mitigaciones

### Riesgos Críticos

**R1: Romper CI/CD al migrar workflows**

- **Probabilidad:** Alta
- **Impacto:** Crítico (bloquea desarrollo)
- **Mitigación:**
  - Testing exhaustivo en branch antes de merge
  - Rollback plan documentado
  - Monitoreo 24/7 post-merge

**R2: IDs legacy rompiendo funcionalidad**

- **Probabilidad:** Media
- **Impacto:** Alto (features dejan de funcionar)
- **Mitigación:**
  - Tests automatizados por archivo modificado
  - Mapeo exhaustivo legacy → v2 antes de implementar
  - Revisión manual de cambios críticos

**R3: Scope creep**

- **Probabilidad:** Alta
- **Impacto:** Medio (timeline se extiende)
- **Mitigación:**
  - **SCOPE FREEZE** después de día 1
  - No new features durante migración
  - Issues nuevos van a backlog post-v2

### Riesgos Secundarios

**R4: Health score v2 no llega al 100%**

- **Probabilidad:** Media
- **Impacto:** Bajo (no bloquea funcionalidad)
- **Mitigación:**
  - Threshold temporal del 95% aceptable
  - Documentar gaps pendientes para post-v2

**R5: Features parciales no se completan**

- **Probabilidad:** Media
- **Impacto:** Medio (features quedan a medias)
- **Mitigación:**
  - Priorizar P0/P1 sobre P2
  - Feature flags para rollout gradual
  - Documentar estado de cada feature

---

## 🎯 Criterios de Éxito

### Must-Have (Bloqueadores para merge)

1. ✅ **0 workflows ejecutando scripts v1** - CI/CD 100% v2
2. ✅ **0 IDs legacy en código crítico** - src/ migrado a v2
3. ✅ **GDD Health v2 ≥95%** - Sistema v2 funcional
4. ✅ **System-map-v2.yaml al 100%** - 15/15 nodos mapeados
5. ✅ **CI passing al 100%** - Todos los checks verdes

### Nice-to-Have (Post-v2 aceptable)

6. ⭐ **Shield Phase 2 completo** - 15/15 tests passing
7. ⭐ **Credits v2 activado** - En staging mínimo
8. ⭐ **Docs v1 migradas** - 18/18 nodos en nodes-v2/
9. ⭐ **Health score v2 al 100%** - SSOT Alignment perfecto
10. ⭐ **Kill switch activo** - DB migration aplicada

---

## 💡 Recomendaciones

### Para Maximizar Probabilidad de Éxito

**1. Scope Control ESTRICTO**

- ❌ PROHIBIDO añadir features nuevas durante migración
- ❌ PROHIBIDO refactorings no relacionados con v2
- ✅ SOLO migración v1 → v2 y fixes críticos

**2. Testing Automatizado Agresivo**

- Ejecutar `npm test` después de CADA cambio significativo
- CI/CD debe pasar antes de continuar
- No accumular deuda técnica

**3. Feature Flags para Todo**

- Credits v2 → `ENABLE_CREDITS_V2`
- Shield Phase 2 → `ENABLE_SHIELD_PHASE_2`
- Polar billing → `ENABLE_POLAR_BILLING`
- Rollback instantáneo si hay problemas

**4. Priorización Diaria**

- Cada mañana: Review de pendientes
- Ajustar prioridades según blockers
- Si algo toma >50% más tiempo → defer a P2/P3

**5. Buffer Days**

- Día 7: Buffer post-docs
- Día 12: Buffer final
- Si todo va bien → adelantar P2/P3

---

## 📊 Métricas de Progreso

### Métricas Diarias (Tracking)

- **Workflows v1 restantes:** 4 → 0
- **IDs legacy en src/:** 43 → 0
- **Nodos v1 sin migrar:** 18 → 0
- **Health score v2:** 98.67% → 100%
- **Tests passing:** X/Y → Y/Y
- **CI checks passing:** X/Z → Z/Z

### Métricas de Calidad (Gates)

- **GDD Health v2:** ≥95% (must-have), 100% (nice-to-have)
- **Test Coverage:** ≥85% (actual: ~90%)
- **CI Success Rate:** 100% (0 failures)
- **CodeRabbit Comments:** 0 (zero tolerance)

---

## 🚀 Alternativas de Timeline

### Opción A: Timeline Agresivo (10 días)

- **P0 only:** Días 1-6
- **P1 only:** Días 7-8
- **P2:** Defer a post-merge
- **P3:** Defer a post-merge
- **Riesgo:** Alto - Poco buffer, features incompletas

### Opción B: Timeline Recomendado (12 días)

- **P0:** Días 1-4
- **P1:** Días 5-7
- **P2:** Días 8-10
- **P3:** Días 11-12
- **Riesgo:** Medio - Buffer adecuado, scope controlado

### Opción C: Timeline Conservador (15 días)

- **P0:** Días 1-5 (buffer extra)
- **P1:** Días 6-9
- **P2:** Días 10-13
- **P3:** Días 14-15
- **Riesgo:** Bajo - Muy robusto, permite scope creep

---

## 🎬 Conclusión Final

**Veredicto:** ✅ **VIABLE en 12 días con Opción B**

**Timeline recomendado:**

- ✅ **10 días:** Posible pero arriesgado (solo P0+P1)
- ✅ **12 días:** Recomendado (P0+P1+P2 con buffer)
- ✅ **15 días:** Muy seguro (P0+P1+P2+P3 completo)

**Keys to Success:**

1. **Scope freeze absoluto** - Zero deviations
2. **Testing continuo** - No accumular deuda
3. **Feature flags everywhere** - Rollback instantáneo
4. **Priorización estricta** - P0 > P1 > P2 > P3
5. **Buffer days respetados** - No comprimir timeline

**Next Steps:**

1. Aprobar timeline y scope
2. Crear branch `feature/complete-v2-migration`
3. Ejecutar Día 1: Migrar workflows (12h)
4. Daily standup: Review de métricas y blockers

---

**Última actualización:** 2025-12-09  
**Timeline target:** 12 días (2025-12-09 → 2025-12-21)  
**Estado:** ✅ READY TO START
