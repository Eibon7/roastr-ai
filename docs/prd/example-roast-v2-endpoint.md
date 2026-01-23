# PRD: Roast V2 Endpoint

**Estado:** En desarrollo  
**Fecha:** 2026-01-22  
**Owner:** Engineering Team

---

## Objetivos

- Crear endpoint RESTful para generación de roasts en V2
- Integrar con roasting-engine V2
- Asegurar compatibilidad con Polar billing
- Cumplir con blindaje V2-only (NO usar artefactos legacy)

---

## Acceptance Criteria

### AC1: Crear endpoint POST /api/v2/roast

- [ ] Endpoint POST /api/v2/roast implementado
- [ ] Validación de input (comment, userId, toneId)
- [ ] Manejo de errores HTTP apropiado
- [ ] Tests unitarios del endpoint

### AC2: Integrar con roasting-engine

- [ ] Llamar a roasting-engine V2 para generar roast
- [ ] Pasar parámetros: comment, tone, persona
- [ ] Manejar errores del engine
- [ ] Tests de integración con engine

### AC3: Integrar con Polar billing

- [ ] Verificar plan del usuario (Polar)
- [ ] Aplicar límites según plan (requests/month)
- [ ] Registrar uso en analytics
- [ ] Tests de límites de plan

### AC4: Documentación

- [ ] OpenAPI spec para /api/v2/roast
- [ ] Ejemplos de request/response
- [ ] Guía de uso en docs/
- [ ] Tests de ejemplos de documentación

---

## Out of Scope

- UI para el endpoint (será otra issue)
- Deployment automático a producción (solo staging)
- Migración de endpoints V1 a V2 (issue separada)
- Integración con frontend legacy

---

## Technical Notes

- Usar `apps/backend-v2/src/routes/roast.ts`
- Seguir convenciones V2 (TypeScript, async/await)
- Integrar con Polar billing (NO Stripe)
- Usar artefactos V2 ÚNICAMENTE
- Tests deben pasar al 100% antes de merge

---

## Dependencies

- **ROA-538:** Blindaje V2-only (prerequisito) ✅ Completado
- **ROA-539:** Loop Autónomo Supervisado (para ejecución) 🚧 En desarrollo
- Polar billing integration (debe existir en V2)

---

## Testing Strategy

### Unit Tests

- `apps/backend-v2/src/routes/__tests__/roast.test.ts`
- Validación de input
- Manejo de errores
- Mocks de roasting-engine

### Integration Tests

- `apps/backend-v2/tests/integration/roast-endpoint.test.ts`
- Flujo completo: request → engine → response
- Integración con Polar billing
- Límites de plan

### E2E Tests

- `tests/e2e/roast-v2.test.js`
- Flujo de usuario completo
- Request real a endpoint
- Verificación de response

---

## Definition of Done

- [ ] Todos los ACs completados
- [ ] Tests al 100% passing (unit + integration + E2E)
- [ ] Coverage ≥90%
- [ ] CodeRabbit = 0 comentarios
- [ ] Documentación completa
- [ ] PR aprobado por al menos 1 reviewer
- [ ] No violaciones V2-only
- [ ] Deploy a staging exitoso

---

**Issue:** ROA-xxx (TBD)  
**Versión:** 1.0  
**Última actualización:** 2026-01-22
