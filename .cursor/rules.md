# Cursor Rules - Roastr AI

Este archivo sincroniza las reglas del entorno Claude con el workspace de Cursor.

## 1. Persistencia y contexto

- Este proyecto usa el sistema de orquestación Claude Orchestrator + Subagentes por tarea.
- Carga de contexto preferente: CLAUDE.md, .claude/AGENTS.md, spec.md.
- No replicar el contenido entero de spec.md, solo los nodos relevantes.
- Mantén sincronizada la memoria con CLAUDE.md → sección 🧠 Memory Hints (Roastr).
- Si se actualiza CLAUDE.md con nuevas políticas, replicarlas aquí automáticamente.

### Archivos de referencia obligatoria:

- `CLAUDE.md` - Configuración principal y políticas
- `.claude/AGENTS.md` - Configuración de subagentes y Task Routing Map
- `spec.md` - Especificaciones del proyecto
- `.issue_lock` - Rama esperada para la issue actual

## 2. Política de ramas

### Reglas estrictas:

- Cada issue se trabaja en una rama aislada (`feature/issue-<id>` o `fix/issue-<id>`).
- No cambiar de rama salvo si existe `.issue_lock`.
- Si detectas commits en una rama diferente sin autorización, cancela la operación y notifica.
- Siempre crear PR con `/new-pr` tras el primer commit.
- Verificar rama actual antes de cada operación: `git rev-parse --abbrev-ref HEAD`

### Flujo por issue:

1. Crear rama: `git checkout -b feature/issue-<id>`
2. Fijar candado: `echo "feature/issue-<id>" > .issue_lock`
3. Trabajar normalmente. Los hooks impiden desvíos.
4. Al cerrar la issue: borrar o actualizar `.issue_lock`.

### Hooks activos:

- `.git/hooks/pre-commit` - Valida rama correcta antes de commit
- `.git/hooks/commit-msg` - Exige formato `Issue #<id>` en commits
- `.git/hooks/pre-push` - Bloquea push a main/master y valida candado

## 3. Reglas de calidad

### Prohibiciones absolutas:

- ❌ Commit sin tests → prohibido.
- ❌ Tests sin significancia (placeholders vacíos).
- ❌ Manual modification de Coverage Source (debe ser `auto`).
- ❌ Merge con Health < 95.
- ❌ Merge con Drift Risk ≥ 60.
- ❌ Cierre de PR con comentarios de CodeRabbit pendientes.
- ❌ Commit con errores de formateo (Prettier/ESLint) → prohibido.

### Requisitos antes de merge:

- ✅ Todos los tests pasando
- ✅ Coverage Source: `auto` (desde coverage-summary.json)
- ✅ Health ≥ 95
- ✅ Drift Risk < 60
- ✅ 0 comentarios de CodeRabbit
- ✅ Pre-Flight Checklist completado (`docs/QUALITY-STANDARDS.md`)
- ✅ Formateo consistente: `npm run format:check` sin errores
- ✅ Linting limpio: `npm run lint` sin warnings críticos

### Code Style y Formateo (Prettier + ESLint)

**⚠️ IMPORTANTE: El formateo debe ser automático al guardar en Cursor.**

**Configuración activa:**

- Prettier: `printWidth: 100`, `singleQuote: true`, `semi: true`, `trailingComma: none`
- ESLint: Integrado con Prettier via `eslint-plugin-prettier`
- Format on Save: Habilitado para todos los archivos

**Reglas obligatorias:**

1. ✅ **Antes de commit:**

   ```bash
   npm run format:check  # Verificar formateo
   npm run lint          # Verificar linting
   ```

2. ✅ **Auto-formateo al guardar:**
   - JS/TS: ESLint aplica fixes (incluye Prettier)
   - JSON/Markdown/CSS/YAML: Prettier formatea directamente
   - Si no formatea: Recargar Cursor (`Cmd+Shift+P` → "Reload Window")

3. ✅ **Manual cuando sea necesario:**

   ```bash
   npm run format        # Formatear todo el proyecto
   npm run lint:fix      # Arreglar issues de ESLint automáticamente
   ```

4. ❌ **Prohibido:**
   - Commitear código sin formatear
   - Ignorar warnings de ESLint sin justificación
   - Deshabilitar Prettier/ESLint en archivos sin aprobación
   - Usar `// eslint-disable` sin comentario explicativo

**Troubleshooting:**

- **Formateo no funciona al guardar:**
  1. Verificar extensiones instaladas: ESLint + Prettier
  2. Recargar Cursor: `Cmd+Shift+P` → "Reload Window"
  3. Verificar que el archivo no está en `.prettierignore`

- **Conflictos ESLint/Prettier:**
  - La configuración ya está optimizada para evitar conflictos
  - Si detectas uno: reportar en issue, NO deshabilitar reglas

**Documentación completa:** `docs/tooling/prettier-eslint-setup.md`

## 4. Subagentes y tareas

### Task Routing Map

| Tipo de tarea              | Agente           | Descripción                                       |
| -------------------------- | ---------------- | ------------------------------------------------- |
| UX Research                | @ux-researcher   | Análisis de comportamiento y contexto del usuario |
| UI Design                  | @ui-designer     | Generación de layouts y estructura visual         |
| Whimsy & Microinteractions | @whimsy-injector | Animaciones y feedback visual                     |
| Frontend Implementation    | @frontend-dev    | Implementación de componentes y lógica            |
| Backend Implementation     | @back-end-dev    | Implementación de servicios y APIs                |
| Testing & Validation       | @test-engineer   | Generación y ejecución de tests + evidencias      |
| GitHub Compliance          | @github-monitor  | Validación de PRs y CI/CD                         |
| Task Assessment            | @task-assessor   | Evaluación CREATE/FIX/ENHANCE/CLOSE               |

### Asignaciones rápidas:

- UX analysis → @ux-researcher
- UI generation → @ui-designer
- Animations → @whimsy-injector
- Implementation (frontend) → @frontend-dev
- Implementation (backend) → @back-end-dev
- Testing → @test-engineer
- PR & compliance → @github-monitor
- Task assessment → @task-assessor

### Cuándo invocar cada agente:

- **@ux-researcher**: Nueva feature sin análisis UX previo
- **@ui-designer**: Cuando exista `docs/ux.md` con research completo y necesites generar los specs de UI
- **@whimsy-injector**: UI especificada y validada, antes de implementación frontend
- **@frontend-dev**: Componentes de UI ya especificados en `docs/ui.md` y `docs/ui-whimsy.md`
- **@back-end-dev**: Nueva API, servicio o integración backend definida en especificaciones
- **@test-engineer**: Tras cualquier cambio en `src/` o `components/`, obligatorio antes de cerrar issue
- **@github-monitor**: Para verificar estado de PRs, conflictos, jobs fallidos o antes de merge
- **@task-assessor**: Al inicio de cada issue para evaluar CREATE/FIX/ENHANCE/CLOSE

## 5. Persistencia

### Guardado obligatorio de artefactos:

- **Planificación**: `docs/plan/issue-<id>.md`
- **Evidencias visuales**: `docs/test-evidence/issue-<id>/`
- **Receipts de agentes**: `docs/agents/receipts/<pr>-<Agent>.md`
- **Assessments**: `docs/assessment/<issue-number>.md`
- **Actualizaciones de spec**: `spec.md` y `docs/nodes/<node>.md`

### Flujo de actualización:

1. Al finalizar feature: Actualizar `spec.md` con cambios implementados
2. Si afecta nodos GDD: Actualizar `docs/nodes/<node>.md`
3. Generar evidencias visuales en `docs/test-evidence/issue-<id>/`
4. Crear receipt en `docs/agents/receipts/` si se invocó agente
5. Si Cursor compacta la conversación, preservar identificador de rama y `.issue_lock`

### Mapa de cobertura:

- Mantener actualizado mapa de cobertura en `spec.md`
- Link a evidencias visuales en `docs/test-evidence/`
- Nunca ajustar coverage manualmente si es `auto`

## 6. Integración con Claude

### Sincronización:

- Si Claude está activo en paralelo, prioriza su `CLAUDE.md` para resolver conflictos de contexto.
- Cursor puede leer `CLAUDE.md`, pero no sobrescribirlo.
- Si cambian reglas en `CLAUDE.md`, replicarlas automáticamente en `.cursor/rules.md`.
- Mantener coherencia entre ambos entornos.

### Resolución de conflictos:

- Si hay conflicto entre contextos, `CLAUDE.md` tiene prioridad.
- `CLAUDE.md` es la fuente de verdad para políticas del proyecto.
- `.cursor/rules.md` es una réplica sincronizada específica para Cursor.

## 7. Workflow estándar por issue

### FASE 0: Assessment

1. Leer `.issue_lock` para identificar rama esperada
2. Verificar que estás en la rama correcta
3. Resolver nodos GDD: `node scripts/resolve-graph.js <nodes>`
4. Leer nodos resueltos (NO spec.md completo)
5. Crear assessment: `docs/assessment/<issue-number>.md`
6. Recomendación: CREATE | FIX | ENHANCE | CLOSE

### FASE 1: Planning

1. Si AC ≥ 3: Invocar `@task-assessor`
2. Crear mini-plan: `docs/plan/<issue>.md`
3. Identificar agentes necesarios según Task Routing Map
4. Verificar dependencias y orden de ejecución

### FASE 2: Implementation

1. Invocar agentes según tipo de tarea
2. Coordinar entre agentes cuando sea necesario
3. Generar receipts: `docs/agents/receipts/<pr>-<Agent>.md`
4. Mantener actualizado `spec.md` durante desarrollo

### FASE 3: Validation

1. Ejecutar tests: `npm test`
2. Generar evidencias visuales (si aplica)
3. Validar coverage: debe ser `auto`
4. Verificar Health ≥ 95 y Drift Risk < 60
5. Validar 0 comentarios CodeRabbit
6. Pre-Flight Checklist completado

### FASE 4: Commit & PR

1. Verificar rama correcta con `.issue_lock`
2. Commit con formato: `feat(feature): descripción — Issue #<id>`
3. Push (validado por hooks)
4. Crear PR con `/new-pr`
5. CI validará automáticamente

## 8. GDD (Graph-Driven Development)

### Comandos esenciales:

- Validación: `node scripts/validate-gdd-runtime.js --full` (debe ser HEALTHY)
- Health: `node scripts/score-gdd-health.js --ci` (≥95)
- Drift: `node scripts/predict-gdd-drift.js --full` (<60)
- Repair: `node scripts/auto-repair-gdd.js --auto-fix`
- Resolver nodos: `node scripts/resolve-graph.js <nodes>`

### Gestión de nodos:

- Mantener "Agentes Relevantes" actualizado en cada nodo `docs/nodes/*.md`
- Agente invocado no listado → añadirlo
- Agente listado ya no aplica → eliminarlo
- Validar antes de PR: `node scripts/resolve-graph.js --validate`

## 9. Quality Standards

### Pre-Flight Checklist (OBLIGATORIO antes de PR):

- [ ] Tests pasando al 100%
- [ ] Docs actualizada (CLAUDE.md, spec.md, nodos GDD)
- [ ] Code quality verificado (sin console.logs, TODOs)
- [ ] Self-review completado
- [ ] 0 conflictos con main
- [ ] Health ≥ 95, Drift < 60
- [ ] 0 comentarios CodeRabbit
- [ ] Receipts generados para todos los agentes invocados

### Ciclo Review (OBLIGATORIO):

1. Arreglar TODAS las issues de CodeRabbit
2. Inspeccionar PR con general-purpose agent
3. Si issues/jobs failing → volver a paso 1
4. Solo cuando todo verde → informar "PR lista"

## 10. Prohibiciones y guardrails

### NUNCA:

- ❌ Cargar spec.md completo (usar nodos resueltos)
- ❌ Exponer secrets, API keys, nombres de .env
- ❌ Omitir FASE 0
- ❌ Proceder sin receipts
- ❌ Commit sin tests
- ❌ Merge sin Health ≥ 95
- ❌ Cambiar rama sin `.issue_lock`
- ❌ Ajustar coverage manualmente (siempre `auto`)
- ❌ Modificar thresholds sin investigación previa

### SIEMPRE:

- ✅ Generar receipts (normal/SKIPPED) para agentes invocados
- ✅ Actualizar "Agentes Relevantes" en nodos GDD
- ✅ Validar: `node scripts/resolve-graph.js --validate`
- ✅ Ejecutar tests antes de commit
- ✅ Actualizar `spec.md` y nodos GDD al finalizar
- ✅ Verificar rama correcta antes de operaciones
- ✅ Leer `docs/patterns/coderabbit-lessons.md` antes de implementar

## 11. Integración MCP Playwright

### Para frontend:

- Ejecutar Playwright MCP para validación visual
- Capturar screenshots (múltiples viewports)
- Revisar consola + logs de red
- Guardar: `docs/ui-review.md` y `docs/test-evidence/`

### Comandos:

- `/mcp list` - Listar MCPs disponibles
- `/mcp exec playwright` - Ejecutar comandos Playwright

## 12. Receipts y documentación

### Template de receipt:

```markdown
# Agent Receipt - Issue #<ID> | Agent: <Nombre>

**Agent Invoked**: <Nombre del agente>
**Issue**: #<ID>
**Branch**: <feature|fix>/issue-<ID>

## Decisiones tomadas

[Lista de decisiones y artefactos generados]

## Guardrails aplicados

[Lista de guardrails y validaciones]

## Outputs

- [Archivos creados]
- [Tests generados]
- [Docs actualizadas]
```

### Guardado:

- Receipts en `docs/agents/receipts/<pr>-<Agent>.md`
- SKIPPED receipts: `docs/agents/receipts/<pr>-<Agent>-SKIPPED.md`

## 13. Especificaciones del proyecto

### Stack:

- **Frontend**: React/Next.js + Tailwind + shadcn/ui + Framer Motion
- **Backend**: Node.js + Express + PostgreSQL (RLS) + Redis/Upstash
- **Testing**: Jest, Playwright, Vitest
- **Deployment**: Vercel, Supabase

### Modelo de negocio:

- Subscription tiers: Free, Starter €5/mo, Pro €15/mo, Plus €50/mo
- Multi-tenant con aislamiento por organización
- Cost Control y Shield moderation obligatorios

### Integraciones:

- Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky

---

## Sincronización con CLAUDE.md

Este archivo está sincronizado con `CLAUDE.md`. Si hay discrepancias, `CLAUDE.md` tiene prioridad.

Para actualizar esta sincronización:

1. Revisar cambios en `CLAUDE.md`
2. Aplicar cambios relevantes a `.cursor/rules.md`
3. Verificar coherencia entre ambos archivos

**Última sincronización**: 2025-10-27
