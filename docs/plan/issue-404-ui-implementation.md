# PLAN: Issue #404 - UI Implementation for Manual Flow

## Situación Actual

- ✅ **Backend E2E Test**: Ya implementado en PR #427 con cobertura completa
- ✅ **Página Approval existente**: Frontend básico ya disponible
- ❌ **Flujo Manual Específico**: No implementa el flujo 2→1 variante específico de la issue

## Análisis de Requerimientos UI

### Criterios de Aceptación Pendientes (UI)

La issue #404 requiere específicamente:

1. **2 Variantes Iniciales**: Mostrar exactamente 2 opciones al usuario
2. **Selección de Variante**: UI para que usuario elija una de las 2
3. **1 Variante Adicional**: Tras selección, generar y mostrar 1 variante más
4. **Botón "Aprobar"**: Funcional para publicación directa
5. **Respeto al Tono**: UI debe reflejar tono preseleccionado del usuario
6. **Auto-approval OFF**: Configuración clara que esto es manual

### Componentes Actuales vs Requeridos

**Estado Actual:**

- `ApprovalCard`: Maneja aprobación individual de respuestas ya generadas
- `Approval.jsx`: Lista de respuestas pendientes con filtros
- **Gap**: No implementa flujo generación→selección→generación adicional

**Componentes Requeridos:**

- `ManualFlowCard`: Nuevo componente para flujo 2→1 variante
- `VariantSelector`: Selector entre las 2 variantes iniciales
- `VariantGenerator`: Botón para generar variante adicional
- `ToneIndicator`: Mostrar tono activo del usuario

## Plan de Implementación

### Fase 1: UX Research & Design

**Agente**: UX Researcher + UI Designer

**Tareas:**

1. **Analizar flujo de usuario** para experiencia manual óptima
2. **Diseñar wireframes** del componente ManualFlowCard
3. **Definir estados UI** (loading, selection, generation, approval)
4. **Establecer patrones** de interacción para selección de variantes

**Deliverables:**

- `docs/design/manual-flow-ux.md`: Análisis UX
- `docs/design/manual-flow-wireframes.md`: Wireframes y estados

### Fase 2: UI Development

**Agente**: Front-end Dev + Whimsy Injector

**Tareas:**

1. **Crear ManualFlowCard** component con estados apropiados
2. **Implementar VariantSelector** con UX clara para elección
3. **Integrar generación adicional** post-selección
4. **Añadir ToneIndicator** para transparencia del tono activo
5. **Actualizar Approval.jsx** para detectar y usar flujo manual

**Deliverables:**

- `frontend/src/components/ManualFlowCard.jsx`
- `frontend/src/components/VariantSelector.jsx`
- `frontend/src/components/ToneIndicator.jsx`
- Actualización en `frontend/src/pages/Approval.jsx`

### Fase 3: Testing & Validation

**Agente**: Test Engineer

**Tareas:**

1. **Tests unitarios** para nuevos componentes
2. **Tests de integración** para flujo completo UI
3. **Playwright E2E** para validación visual del flujo
4. **Snapshot testing** para consistencia visual

**Deliverables:**

- Tests en `frontend/src/components/__tests__/`
- Tests E2E en `tests/e2e/`
- Screenshots en `docs/test-evidence/`

### Fase 4: Documentation & Evidence

**Tareas:**

1. **Capturar evidencias visuales** con MCP Playwright
2. **Actualizar spec.md** con nueva funcionalidad UI
3. **Documentar changelog** completo para PR

## Arquitectura de Componentes

### ManualFlowCard Component

```jsx
// Estado del componente
{
  phase: 'initial' | 'selecting' | 'generating_additional' | 'ready_approval',
  initialVariants: [variant1, variant2],
  selectedVariant: variant | null,
  additionalVariant: variant | null,
  userTone: 'balanced' | 'sarcastic' | 'witty',
  autoApproval: false
}

// Estados UI
- 'initial': Muestra "Generating 2 variants..."
- 'selecting': Muestra 2 variantes para selección
- 'generating_additional': "Generating additional variant..."
- 'ready_approval': Muestra variante final + botón Aprobar
```

### API Integration Points

```javascript
// Endpoints requeridos (ya validados en E2E test)
POST /api/comments/:id/variants/generate
POST /api/comments/:id/variants/select
POST /api/comments/:id/approve
GET  /api/user/tone-preference
```

## Validación de Criterios

### Functional Requirements

- ✅ **2 variants iniciales**: ManualFlowCard.state.initialVariants.length === 2
- ✅ **Selección usuario**: VariantSelector con onClick handlers
- ✅ **1 variant adicional**: Post-selección trigger nueva generación
- ✅ **Botón aprobar**: Disponible solo tras generación adicional
- ✅ **Tono respetado**: ToneIndicator + API integration
- ✅ **Auto-approval OFF**: Configuración visual clara

### UX Requirements

- **Visual clarity**: Estados claros del flujo manual
- **Loading states**: Indicadores durante generaciones
- **Error handling**: Fallbacks cuando generación falla
- **Accessibility**: ARIA labels y navegación por teclado
- **Responsive**: Funciona en móvil y desktop

## Subagentes Requeridos

1. **UX Researcher**: Análisis de flujo de usuario y patrones
2. **UI Designer**: Wireframes y diseño visual
3. **Whimsy Injector**: Mejoras de UX y micro-interacciones
4. **Front-end Dev**: Implementación de componentes React
5. **Test Engineer**: Tests completos + evidencias visuales

## Criterios de Finalización

### Definition of Done

- ✅ Componentes implementados y funcionando
- ✅ Tests unitarios + E2E passing
- ✅ Evidencias visuales capturadas
- ✅ spec.md actualizado
- ✅ Changelog completo en PR
- ✅ No commits sin tests
- ✅ CI pipeline green

### Integration Tests

- Manual flow funciona end-to-end en browser
- Estados UI transicionan correctamente
- API calls se ejecutan en secuencia apropiada
- Error states manejan fallos graciosamente
- Multi-tenant isolation funciona en UI

Este plan asegura implementación completa del flujo manual UI requerido en issue #404, complementando el E2E test ya implementado.
