# ROA-318 — Plan de Reparación de PR #1120

**Fecha:** 2025-12-09  
**PR:** #1120 - https://github.com/Eibon7/roastr-ai/pull/1120  
**Issue:** ROA-318 — Limpieza estructural v2  
**Modo:** PLAN MODE (READ-ONLY, sin ejecución)

---

## 1. ESTADO ACTUAL DEL REPOSITORIO

### 1.1 Rama y Working Tree

- **Rama actual:** `feature/roa-318-cleanup-legacy-v2`
- **Estado working tree:** Pendiente de análisis de conflictos
- **Commits en rama:** 56 commits ahead de main
- **PR estado:** OPEN con conflictos en 9 archivos

### 1.2 Archivos con Conflictos Identificados

1. `.github/workflows/ci-pr-validation.yml`
2. `.github/workflows/system-map-v2-consistency.yml`
3. `docs/CI-V2/CI-AUDIT-REPORT.md`
4. `docs/GDD-V2-HEALTH-REPORT.md`
5. `docs/SSOT-V2.md`
6. `gdd-health-v2.json`
7. `scripts/check-system-map-drift.js`
8. `scripts/compute-health-v2-official.js`
9. `scripts/outputs/gdd-health-v2-official.json`

### 1.3 Separación ROA-310 vs ROA-318

**Commits ROA-310 (historial base):**
- `bfac927c` - fix(roa-310): apply CodeRabbit review improvements
- `7abc72bd` - feat(roa-310): finalize Cursor Rules v2
- Y otros commits previos

**Commits ROA-318 (específicos):**
- `17c8d6a1` - docs(roa-318): add PR description
- `c9d7a5bf` - chore(roa-318): sync working state before CI validation

**Cambios ROA-318 específicos:**
- Migración `billing` → `billing-integration` en system-map
- Eliminación de ciclos (DAG fix)
- Movimiento de archivos huérfanos a architecture/legacy/
- Eliminación de workflows CI v1 obsoletos
- Actualización de validadores v2
- Health Score 100/100 desde SSOT

---

## 2. ACCIONES NECESARIAS (Lista Numerada)

### FASE 1: Análisis y Preparación

1. **Verificar estado de la rama**
   - Confirmar que estamos en `feature/roa-318-cleanup-legacy-v2`
   - Verificar que el working tree está limpio
   - Hacer backup del estado actual

2. **Analizar conflictos específicos**
   - Ejecutar `git merge --no-commit --no-ff origin/main` para detectar conflictos
   - Identificar qué cambios vienen de main vs de nuestra rama
   - Documentar cada conflicto

3. **Revisar comentarios de CodeRabbit**
   - Extraer todos los comentarios de la PR
   - Categorizar por tipo (logger, error handling, CLI, etc.)
   - Priorizar por criticidad

### FASE 2: Resolución de Conflictos

4. **Resolver conflicto en `.github/workflows/ci-pr-validation.yml`**
   - Mantener versión v2 si existe
   - Eliminar lógica v1 legacy
   - Asegurar que usa solo scripts v2

5. **Resolver conflicto en `.github/workflows/system-map-v2-consistency.yml`**
   - Mantener workflow v2 completo
   - Asegurar que ejecuta todos los validadores v2
   - Verificar health threshold ≥95

6. **Resolver conflicto en `docs/CI-V2/CI-AUDIT-REPORT.md`**
   - Mantener reporte completo de ROA-318
   - Actualizar con estado final

7. **Resolver conflicto en `docs/GDD-V2-HEALTH-REPORT.md`**
   - Regenerar desde SSOT sección 15
   - Asegurar que refleja Health Score 100/100

8. **Resolver conflicto en `docs/SSOT-V2.md`**
   - **CRÍTICO:** Solo modificar sección 15
   - Mantener resto del SSOT intacto
   - Actualizar sección 15 con `compute-health-v2-official.js --update-ssot`

9. **Resolver conflicto en `gdd-health-v2.json`**
   - Regenerar desde SSOT
   - Asegurar que es dinámico, no hardcoded

10. **Resolver conflicto en `scripts/check-system-map-drift.js`**
    - Aplicar correcciones de CodeRabbit
    - Mantener lógica v2
    - Asegurar logger consistency

11. **Resolver conflicto en `scripts/compute-health-v2-official.js`**
    - Aplicar correcciones de CodeRabbit
    - Mantener cálculo dinámico (sin hardcodes)
    - Asegurar que actualiza SSOT correctamente

12. **Resolver conflicto en `scripts/outputs/gdd-health-v2-official.json`**
    - Regenerar desde script
    - Verificar que está en .gitignore (no debe commitearse)

### FASE 3: Aplicación de CodeRabbit Review

13. **Logger Consistency**
    - Reemplazar todos los `console.log` por `logger.info/warn/error`
    - Asegurar formato consistente
    - Verificar que todos los scripts usan `require('../src/utils/logger')`

14. **Error Handling**
    - Añadir try/catch donde sea necesario
    - Asegurar que los errores se propagan correctamente
    - Exit codes correctos en modo CI

15. **CLI Flexibility**
    - Asegurar que todos los scripts aceptan `--ci` flag
    - Verificar que funcionan sin flags (modo local)
    - Documentar opciones disponibles

16. **Line Number Accuracy**
    - Corregir referencias a números de línea
    - Asegurar que los mensajes de error son precisos

17. **Removing Duplicated Logic**
    - Identificar lógica duplicada entre scripts
    - Extraer a módulos compartidos si es necesario
    - Eliminar duplicación

18. **Normalizing Script Behavior**
    - Asegurar que todos los scripts tienen estructura similar
    - Mismo formato de output
    - Mismo manejo de errores

19. **Ensuring Scripts Fail Deterministically in CI**
    - Verificar que `--ci` flag hace exit code 1 en errores
    - Asegurar que no hay fallbacks silenciosos
    - Validar que los warnings no bloquean en CI

20. **Removing Leftover Old CI v1 Logic**
    - Buscar referencias a scripts v1
    - Eliminar lógica legacy
    - Asegurar que solo se ejecutan scripts v2

### FASE 4: Alineación de Workflows CI

21. **Reparar workflows CI**
    - Eliminar referencias a scripts v1
    - Asegurar que solo ejecutan scripts v2
    - Verificar que health-score v1 NO se ejecuta

22. **Asegurar jobs correctos según archivos**
    - Verificar que los jobs se ejecutan solo cuando corresponde
    - Optimizar triggers de workflows

23. **Eliminar restos legacy**
    - Buscar referencias a `score-gdd-health.js` (v1)
    - Reemplazar por `compute-health-v2-official.js` (v2)
    - Eliminar workflows obsoletos si quedan

### FASE 5: Regeneración de Documentos

24. **Regenerar SSOT sección 15**
    - Ejecutar: `node scripts/compute-health-v2-official.js --update-ssot`
    - Verificar que Health Score = 100/100
    - Confirmar que no hay hardcodes

25. **Regenerar gdd-health-v2.json**
    - Ejecutar: `node scripts/calculate-gdd-health-v2.js`
    - Verificar que lee desde SSOT
    - Confirmar valores correctos

26. **Regenerar docs/GDD-V2-HEALTH-REPORT.md**
    - Generar desde SSOT sección 15
    - Asegurar formato consistente

### FASE 6: Validación Local

27. **Ejecutar validadores en orden**
    - `validate-v2-doc-paths.js --ci` → debe pasar
    - `validate-ssot-health.js --ci` → debe pasar
    - `validate-strong-concepts.js --ci` → debe pasar
    - `detect-legacy-ids.js --ci` → puede WARN (legacy en src/)
    - `detect-guardian-references.js --ci` → puede WARN
    - `check-system-map-drift.js --ci` → debe pasar
    - `compute-health-v2-official.js` → debe mostrar 100/100

28. **Verificar system-map**
    - Ejecutar `validate-symmetry.js --ci` → debe pasar (0 ciclos)
    - Verificar que es DAG acíclico

29. **Verificar SSOT**
    - Confirmar que sección 15 tiene Health Score 100/100
    - Verificar que no hay valores hardcoded
    - Confirmar que todos los campos están presentes

### FASE 7: Commit y Push

30. **Commit seguro**
    - Mensaje: `fix(roa-318): resolve conflicts, apply CodeRabbit review, unify CI v2, preserve SSOT health-score integrity`
    - Verificar que todos los cambios están incluidos
    - No incluir archivos en .gitignore

31. **Push a origin**
    - `git push origin feature/roa-318-cleanup-legacy-v2`
    - Verificar que se actualiza la PR

32. **Actualizar descripción de PR**
    - Añadir sección "Reparaciones aplicadas"
    - Listar conflictos resueltos
    - Listar correcciones de CodeRabbit
    - Confirmar validadores pasando
    - Confirmar Health Score 100/100

---

## 3. RIESGOS POTENCIALES

### 3.1 Riesgos Críticos

1. **Pérdida de cambios de ROA-318**
   - **Riesgo:** Al resolver conflictos, podríamos perder cambios específicos de ROA-318
   - **Mitigación:** Hacer backup antes de merge, verificar cada conflicto manualmente

2. **Romper health-score dinámico**
   - **Riesgo:** Introducir hardcodes o valores estáticos
   - **Mitigación:** Solo usar `compute-health-v2-official.js --update-ssot`, nunca editar manualmente

3. **Reintroducir GDD v1**
   - **Riesgo:** Scripts v1 podrían ejecutarse en workflows
   - **Mitigación:** Verificar que solo scripts v2 están en workflows

4. **Romper system-map DAG**
   - **Riesgo:** Reintroducir ciclos al resolver conflictos
   - **Mitigación:** Ejecutar `validate-symmetry.js` después de cada cambio

5. **Modificar SSOT fuera de sección 15**
   - **Riesgo:** Cambiar otras secciones del SSOT accidentalmente
   - **Mitigación:** Solo tocar sección 15, verificar diff antes de commit

### 3.2 Riesgos Moderados

6. **Inconsistencia en logger**
   - **Riesgo:** Algunos scripts usan console.log, otros logger
   - **Mitigación:** Buscar y reemplazar todos los console.log

7. **Error handling incompleto**
   - **Riesgo:** Scripts fallan de forma no determinista
   - **Mitigación:** Añadir try/catch y exit codes correctos

8. **Workflows CI ejecutando scripts incorrectos**
   - **Riesgo:** Scripts v1 ejecutándose en lugar de v2
   - **Mitigación:** Verificar cada workflow manualmente

### 3.3 Riesgos Menores

9. **Documentación desactualizada**
   - **Riesgo:** Reportes no reflejan estado actual
   - **Mitigación:** Regenerar después de cambios

10. **Commits mezclados**
    - **Riesgo:** Commits de ROA-310 mezclados con ROA-318
    - **Mitigación:** Verificar que solo cambios de ROA-318 están en el commit final

---

## 4. PRESERVACIÓN DE INTEGRIDAD

### 4.1 system-map-v2.yaml

**Reglas de preservación:**
- ✅ Mantener estructura DAG (0 ciclos)
- ✅ Mantener simetría `depends_on` / `required_by`
- ✅ No reintroducir IDs legacy
- ✅ Mantener todos los nodos v2
- ✅ Verificar con `validate-symmetry.js` después de cambios

**Validación post-cambio:**
```bash
node scripts/validate-symmetry.js --ci  # Debe pasar
node scripts/check-system-map-drift.js --ci  # Debe pasar
```

### 4.2 SSOT-V2.md

**Reglas de preservación:**
- ✅ Solo modificar sección 15
- ✅ Usar `compute-health-v2-official.js --update-ssot` (nunca editar manualmente)
- ✅ Mantener resto del SSOT intacto
- ✅ Verificar que Health Score = 100/100 después de actualización

**Validación post-cambio:**
```bash
node scripts/validate-ssot-health.js --ci  # Debe pasar
node scripts/calculate-gdd-health-v2.js  # Debe mostrar 100/100
```

### 4.3 Health v2 (100/100)

**Reglas de preservación:**
- ✅ Health Score debe venir exclusivamente de SSOT sección 15
- ✅ No hardcodes en scripts
- ✅ Cálculo dinámico desde system-map y nodes-v2
- ✅ Todos los campos numéricos presentes (sin NaN, undefined, TBD)

**Validación post-cambio:**
```bash
node scripts/compute-health-v2-official.js  # Debe mostrar 100/100
node scripts/validate-ssot-health.js --ci  # Debe pasar
```

### 4.4 CI v2

**Reglas de preservación:**
- ✅ Solo ejecutar scripts v2
- ✅ No ejecutar `score-gdd-health.js` (v1)
- ✅ Health threshold ≥95 (preferiblemente 100)
- ✅ Todos los validadores v2 integrados

**Validación post-cambio:**
- Verificar que workflows no referencian scripts v1
- Verificar que health threshold es correcto

### 4.5 Validadores Estrictos

**Reglas de preservación:**
- ✅ Todos los validadores deben funcionar en modo `--ci`
- ✅ Exit code 1 en errores, 0 en éxito
- ✅ Logger consistency (no console.log)
- ✅ Error handling completo

**Validación post-cambio:**
```bash
# Todos deben pasar (excepto detect-legacy-ids y detect-guardian si hay en código)
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/validate-strong-concepts.js --ci
node scripts/validate-symmetry.js --ci
node scripts/check-system-map-drift.js --ci
```

### 4.6 Nodos v2

**Reglas de preservación:**
- ✅ Todos los nodos en system-map tienen docs válidos
- ✅ 0 archivos huérfanos en nodes-v2/
- ✅ Todos los paths existen

**Validación post-cambio:**
```bash
node scripts/validate-v2-doc-paths.js --ci  # Debe pasar
node scripts/check-system-map-drift.js --ci  # Debe pasar
```

---

## 5. SEPARACIÓN ROA-310 vs ROA-318

### 5.1 Cambios ROA-310 (Historial Base)

**Commits:**
- `bfac927c` - fix(roa-310): apply CodeRabbit review improvements
- `7abc72bd` - feat(roa-310): finalize Cursor Rules v2
- Y otros commits previos

**Archivos afectados (potencialmente):**
- `.cursor/rules/` - Reglas de Cursor
- `docs/spec-v2.md` - Spec v2
- Scripts de validación base

**Estrategia:** Mantener estos commits como base, no modificarlos.

### 5.2 Cambios ROA-318 (Específicos)

**Commits:**
- `17c8d6a1` - docs(roa-318): add PR description
- `c9d7a5bf` - chore(roa-318): sync working state before CI validation

**Archivos afectados (específicos de ROA-318):**
- `docs/system-map-v2.yaml` - Migración billing → billing-integration, eliminación de ciclos
- `docs/SSOT-V2.md` - Sección 15 actualizada
- `.github/workflows/system-map-v2-consistency.yml` - Workflow v2 nuevo
- `scripts/check-system-map-drift.js` - Lógica corregida
- `docs/CI-V2/*.md` - Reportes generados
- `docs/architecture/` y `docs/legacy/` - Archivos movidos

**Estrategia:** Preservar TODOS estos cambios, son el core de ROA-318.

### 5.3 Conflictos Esperados

**Tipos de conflictos:**
1. **Conflictos de contenido:** Main tiene cambios que chocan con ROA-318
2. **Conflictos de estructura:** Main tiene cambios en estructura que afectan ROA-318
3. **Conflictos de scripts:** Main tiene mejoras en scripts que debemos integrar

**Estrategia de resolución:**
- Siempre preferir versión más reciente y estricta
- Mantener cambios de ROA-318 cuando sean específicos
- Integrar mejoras de main cuando sean compatibles

---

## 6. CHECKLIST DE VALIDACIÓN FINAL

Antes de commit, verificar:

- [ ] Todos los conflictos resueltos
- [ ] CodeRabbit comments aplicados
- [ ] Logger consistency (0 console.log)
- [ ] Error handling completo
- [ ] Scripts v2 funcionando
- [ ] Health Score = 100/100 desde SSOT
- [ ] System-map acyclic (0 ciclos)
- [ ] SSOT sección 15 actualizada
- [ ] Validadores pasando (5/5 críticos)
- [ ] Workflows CI usando solo scripts v2
- [ ] No hay referencias a scripts v1
- [ ] Working tree limpio
- [ ] Commit message correcto
- [ ] PR descripción actualizada

---

## 7. ORDEN DE EJECUCIÓN RECOMENDADO

1. **Análisis** (READ-ONLY)
   - Verificar estado actual
   - Identificar conflictos
   - Revisar CodeRabbit comments

2. **Backup**
   - Crear branch de backup
   - Documentar estado actual

3. **Resolución de conflictos** (uno por uno)
   - Empezar por workflows CI
   - Continuar con scripts
   - Finalizar con documentación

4. **Aplicación CodeRabbit**
   - Logger consistency
   - Error handling
   - CLI flexibility
   - Etc.

5. **Regeneración**
   - SSOT sección 15
   - Health reports
   - JSON files

6. **Validación**
   - Ejecutar todos los validadores
   - Verificar health score
   - Verificar system-map

7. **Commit y Push**
   - Commit con mensaje correcto
   - Push a origin
   - Actualizar PR

---

## 8. NOTAS IMPORTANTES

- **NO modificar** archivos fuera de los 9 con conflictos sin necesidad
- **NO inventar** contenido, solo resolver conflictos y aplicar CodeRabbit
- **NO perder** cambios de ROA-318
- **Siempre validar** después de cada cambio importante
- **Mantener** integridad de system-map, SSOT, y health score

---

**Plan generado:** 2025-12-09  
**Estado:** READY FOR EXECUTION (pendiente confirmación)

