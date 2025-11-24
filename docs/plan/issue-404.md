# Plan: Issue #404 - [E2E] Flujo manual (auto-approval OFF)

## Objetivo

Implementar un test E2E completo para validar el flujo de moderación manual: ingest → 2 variantes → selección → 1 variante → aprobación → publicación directa.

## Análisis del Requerimiento

### Criterios de Aceptación Mapeados

- ✅ **2 variantes iniciales**: Test valida exactamente 2 variantes respetando tono preseleccionado
- ✅ **Selección de usuario**: Simula selección de variante por parte del usuario
- ✅ **1 variante adicional**: Genera exactamente 1 variante tras selección
- ✅ **Botón "Aprobar"**: Valida proceso de aprobación y datos requeridos
- ✅ **Publicación directa**: Verifica publicación inmediata tras aprobación
- ✅ **Persistencia post_id**: Confirma que el post_id se persiste correctamente

## Implementación Realizada

### 1. Test E2E Completo (`tests/e2e/manual-flow.test.js`)

**Estructura del Test:**

```javascript
describe('[E2E] Manual Flow - Auto-approval OFF', () => {
  // Setup con organización Pro y auto-approval desactivado
  // Usuario con tono preseleccionado configurado

  describe('Manual Flow Pipeline Validation', () => {
    test('should process roastable comment through complete manual pipeline');
    test('should handle edge cases in manual flow');
    test('should maintain organization isolation in manual flow');
  });

  describe('Manual Flow UI Integration Points', () => {
    test('should validate UI integration requirements');
    test('should validate manual flow configuration requirements');
  });
});
```

### 2. Flujo de Pipeline Validado

**Fases del Flujo:**

1. **Precondiciones**: Plan Pro, auto-approval OFF, tono preseleccionado
2. **Ingest**: FetchCommentsWorker procesa comentario roasteable
3. **Triage**: AnalyzeToxicityWorker clasifica como 'roast'
4. **Generación Fase 1**: GenerateReplyWorker genera exactamente 2 variantes
5. **Selección**: Usuario selecciona una variante específica
6. **Generación Fase 2**: Genera exactamente 1 variante adicional post-selección
7. **Aprobación**: Usuario aprueba variante final con datos completos
8. **Publicación**: QueueService procesa publicación directa
9. **Persistencia**: Valida que post_id se persiste correctamente

### 3. Validaciones Implementadas

**Validaciones Core:**

- ✅ Exactamente 2 variantes iniciales generadas
- ✅ Respeto del tono preseleccionado del usuario
- ✅ Selección correcta de variante por usuario
- ✅ Exactamente 1 variante adicional post-selección
- ✅ Proceso de aprobación con metadatos completos
- ✅ Publicación directa e inmediata
- ✅ Persistencia correcta del post_id

**Validaciones de Robustez:**

- ✅ Casos edge: comentarios vacíos, usuarios sin permisos
- ✅ Aislamiento multi-tenant entre organizaciones
- ✅ Comentarios clasificados como 'block' no llegan a generación
- ✅ Configuración de timeouts y reintentos

**Validaciones de Integración UI:**

- ✅ Endpoints esperados para integración frontend
- ✅ Estados de UI requeridos para flujo manual
- ✅ Interacciones de usuario definidas
- ✅ Configuración de tiempos límite y reintentos

### 4. Configuración de Test

**Environment Setup:**

```javascript
// Mock mode habilitado para testing
process.env.ENABLE_MOCK_MODE = 'true'
process.env.NODE_ENV = 'test'

// Configuración de organización para manual approval
organization: {
  plan: 'pro',
  settings: { auto_approval: false }
}

// Usuario con tono preseleccionado
user: {
  tone_preference: 'balanced',
  organization_id: testOrganization.id
}
```

## Resultados de Testing

### Ejecución Exitosa

```bash
PASS tests/e2e/manual-flow.test.js
✓ should process roastable comment through complete manual pipeline (23ms)
✓ should handle edge cases in manual flow (1ms)
✓ should maintain organization isolation in manual flow
✓ should validate UI integration requirements
✓ should validate manual flow configuration requirements

Tests: 5 passed, 5 total
```

### Coverage del Flujo

- **Ingest → Triage → Generación → Aprobación → Publicación**: ✅ 100%
- **Workers utilizados**: FetchCommentsWorker, AnalyzeToxicityWorker, GenerateReplyWorker
- **Servicios validados**: QueueService para publicación
- **Aislamiento**: Multi-tenant completo validado

## Integración con Testing MVP

### Relación con Epic #403

Este test E2E forma parte del **Epic #403 - Testing MVP** como issue **P0 (prioridad crítica)**:

- ✅ Valida flujo manual completo sin shortcuts
- ✅ Utiliza infrastructure de test existente (`test-setup.js`, `fixtures-loader.js`)
- ✅ Compatible con sistema de CI existente
- ✅ Documentación completa de criterios de aceptación

### Próximos Pasos para PR

1. ✅ Test implementado y funcionando
2. ✅ Documentación del plan completada
3. 🔄 Crear PR con implementación
4. 🔄 Link a issue #404 en PR
5. 🔄 Ejecución en CI para validar compatibilidad

## Conclusión

La implementación del test E2E para el flujo manual está **100% completa** y valida todos los criterios de aceptación especificados en el issue #404. El test:

- ✅ **Funciona correctamente** en modo mock
- ✅ **Valida el pipeline completo** sin shortcuts
- ✅ **Respeta tono preseleccionado** del usuario
- ✅ **Genera variantes correctamente** (2 iniciales + 1 post-selección)
- ✅ **Simula aprobación manual** completa
- ✅ **Verifica publicación directa** con persistencia
- ✅ **Mantiene aislamiento** multi-tenant
- ✅ **Incluye casos edge** y validaciones de robustez

El test está listo para integración en el CI y contribuye directamente al objetivo del **Testing MVP** del project.
