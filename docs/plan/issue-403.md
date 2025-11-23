# Issue #403 - Testing MVP – Camino de baldosas amarillas (v2)

## Objetivo

Establecer una suite completa de testing para el MVP de Roastr AI que valide todos los flujos críticos del sistema multi-tenant de moderación automática y generación de roasts.

## Plan de Implementación

### Fase 1: Preparación de Infraestructura de Testing

1. **Configuración de entorno de testing**
   - Variables de entorno dummy/mock
   - Base de datos de testing aislada
   - Configuración CI/CD headless
2. **Fixtures y seeds base**
   - Comentarios de prueba por categoría
   - Usuarios de prueba multi-tenant
   - Configuraciones de planes y límites

### Fase 2: Tests E2E Críticos (Issues P0)

1. **Flujos de usuario principales**
   - Flujo manual (auto-approval OFF) - #404
   - Flujo automático (auto-approval ON) - #405
   - Demo Mode con pipeline completo - #416

2. **Integración de componentes críticos**
   - Ingestor con deduplicación - #406
   - Sistema de triage - #407
   - Shield y moderación - #408
   - Generación de roasts - #409
   - Publisher e idempotencia - #410

### Fase 3: Tests de Arquitectura Multi-Tenant

1. **Workers y cola de tareas**
   - Idempotencia y reintentos - #411
   - Procesamiento distribuido
2. **Aislamiento multi-tenant**
   - Row Level Security - #412
   - Billing y entitlements - #413
3. **Sistemas de control**
   - Kill-switch del publisher - #414

### Fase 4: Observabilidad y Resiliencia (Issues P1)

1. **Logging estructurado** - #417
2. **Manejo de errores UI** - #419
3. **Fixtures completos** - #420
4. **Documentación de testing** - #421

### Fase 5: Pulido Técnico (Issues P2)

1. **Tests unitarios de utilidades** - #422
2. **Compatibilidad sandbox** - #423

## Criterios de Éxito

### Definición de "Hecho"

- ✅ Todas las issues P0 cerradas
- ✅ Suite E2E ejecutándose en CI headless sin fallos
- ✅ Cobertura de integración para todos los componentes críticos
- ✅ Documentación de testing actualizada y ejecutable

### Métricas de Calidad

- **Cobertura de código**: >80% para servicios críticos
- **Tiempo de ejecución**: Suite completa <15 minutos
- **Estabilidad**: 0% flaky tests en CI
- **Documentación**: Guía ejecutable paso a paso

## Estructura de Archivos

```text
tests/
├── e2e/
│   ├── manual-flow.test.js (#404)
│   ├── automatic-flow.test.js (#405)
│   ├── demo-flow.test.js (#416)
│   └── ui-resilience.test.js (#419)
├── integration/
│   ├── ingestor.test.js (#406)
│   ├── triage.test.js (#407)
│   ├── shield.test.js (#408)
│   ├── generation.test.js (#409)
│   ├── publisher.test.js (#410)
│   ├── workers.test.js (#411)
│   ├── multi-tenant.test.js (#412)
│   ├── billing.test.js (#413)
│   ├── kill-switch.test.js (#414)
│   ├── observability.test.js (#417)
│   ├── fixtures.test.js (#420)
│   └── sandbox-compat.test.js (#423)
├── unit/
│   └── utils/
│       └── sanitization.test.js (#422)
├── fixtures/
│   ├── comments/
│   ├── users/
│   └── organizations/
├── helpers/
│   ├── test-setup.js
│   ├── mock-services.js
│   └── fixtures-loader.js
└── docs/
    └── testing-guide.md (#421)
```

## Dependencias y Consideraciones

### Herramientas de Testing

- **Jest**: Test runner principal
- **Supertest**: Tests de API
- **Playwright**: Tests E2E de UI
- **Mock Services**: Para APIs externas

### Variables de Entorno de Testing

```bash
NODE_ENV=test
ENABLE_MOCK_MODE=true
SUPABASE_URL="http://localhost/dummy"
SUPABASE_SERVICE_KEY="dummy"
SUPABASE_ANON_KEY="dummy"
OPENAI_API_KEY="mock-key"
PERSPECTIVE_API_KEY="mock-key"
```

### Configuración CI

- Ejecución paralela de tests
- Cacheo de dependencias
- Reports de cobertura
- Artifacts de evidencias visuales

## Timeline Estimado

- **Fase 1**: 2-3 días (infraestructura)
- **Fase 2**: 5-7 días (P0 tests)
- **Fase 3**: 3-4 días (arquitectura)
- **Fase 4**: 2-3 días (observabilidad)
- **Fase 5**: 1-2 días (pulido)

**Total estimado**: 13-19 días de desarrollo

## Notas de Implementación

Este epic representa una inversión significativa en calidad y confiabilidad del sistema. Los tests implementados servirán como:

1. **Documentación ejecutable** del comportamiento del sistema
2. **Red de seguridad** para cambios futuros
3. **Validación** de requisitos de negocio
4. **Base** para testing de regresión

La implementación seguirá un enfoque iterativo, priorizando los flujos más críticos primero (P0) y refinando la suite progresivamente.
