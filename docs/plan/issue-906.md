# Plan: Validar mocks de costControl en los workers (Issue #906)

**Issue:** #906  
**Título:** Fix costControl mocks in worker tests  
**Priority:** P1 (Media)  
**Estimación:** 1-2 horas  
**AC Count:** 3 (tests + helper)

---

Este plan se solapa completamente con **Issue #905** (ambos abordan el mismo patrón de mock). Para los pasos detallados, ver `docs/plan/issue-905.md`, que describe la creación del helper, las actualizaciones a los tests de `FetchCommentsWorker` y `AnalyzeToxicityWorker`, y la validación con el comando:

```bash
npm test -- tests/unit/workers/FetchCommentsWorker.test.js tests/unit/workers/AnalyzeToxicityWorker.test.js
```

## Estado Actual

- Ambos suites fallan porque `costControl.canPerformOperation()` devuelve `undefined`.
- El mock actual no permite reconfigurar la respuesta y no garantiza `{ allowed }`.
- La UX de los tests depende de que `allowed` sea `true` en la mayor parte del flujo.

## Acceptance Criteria

1. Ambos suites pasan (comando anterior) sin lanzar `allowed` undefined.
2. `canPerformOperation()` siempre resuelve un objeto con `allowed` y `reason`.
3. El helper permite cambiar entre respuestas permitidas y bloqueadas sin reescribir mocks en cada prueba.

## Pasos

Ver `docs/plan/issue-905.md` para el plan completo.

## Agentes Relevantes

- **TestEngineer**


