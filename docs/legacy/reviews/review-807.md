# CodeRabbit Review #807 - Plan

## Análisis

- **Critical:** 1 - Syntax error (bloquea ejecución de tests)
- **Major:** 0
- **Minor:** 4 - Code quality (headers no usados, test de auth, duplicación de constantes)

### Por issue:

| Archivo:Línea                                         | Tipo         | Impacto                             | Root Cause                                                                            |
| ----------------------------------------------------- | ------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/integration/cli/logCommands.test.js:170`       | Syntax Error | ❌ Tests no ejecutan                | Falta cierre `});` del `describe('maintenance command')`                              |
| `tests/unit/routes/admin-plan-limits.test.js:89`      | Code Quality | ⚠️ Header no usado                  | Authorization header sin middleware que lo procese                                    |
| `tests/unit/routes/admin-plan-limits.test.js:102`     | Code Quality | ⚠️ Header no usado                  | Authorization header sin middleware que lo procese                                    |
| `tests/unit/routes/admin-plan-limits.test.js:275-300` | Code Quality | ⚠️ Test no verifica middleware real | Test usa mock middleware en lugar del real                                            |
| `scripts/check-all-rls-tables.js:21-56`               | Code Quality | ⚠️ Duplicación                      | Constantes `ALL_TABLES` y `TESTED_TABLES` duplicadas en `identify-untested-tables.js` |

## GDD

- **Nodos:** cost-control, multi-tenant, social-platforms (ya resueltos)
- **Actualizar:** No necesario (solo fixes de tests y scripts)

## Agentes

- **Invocar:** TestEngineer (para validar tests después de fixes)
- **Receipts:** `docs/agents/receipts/cursor-test-engineer-{timestamp}.md`
- **SKIP:** Guardian (no hay issues de seguridad), TaskAssessor (AC < 3)

## Archivos

- **Mencionados:**
  - `tests/integration/cli/logCommands.test.js`
  - `tests/unit/routes/admin-plan-limits.test.js`
  - `scripts/check-all-rls-tables.js`
  - `scripts/identify-untested-tables.js`

- **Dependientes:** Ninguno (fixes aislados)

- **Tests:**
  - Unit: `tests/unit/routes/admin-plan-limits.test.js` (verificar que pasan)
  - Integration: `tests/integration/cli/logCommands.test.js` (verificar que ejecuta)

## Estrategia

- **Orden:** Critical → Minor (syntax error primero, luego code quality)
- **Commits:** 1 commit con todos los fixes (todos son relacionados con CodeRabbit review)
- **Tests:** Ejecutar `npm test -- tests/integration/cli/logCommands.test.js tests/unit/routes/admin-plan-limits.test.js`

## Éxito

- [ ] Review #807: 1 Critical, 4 Minor resueltos (100%)
- [ ] Tests: 0 failures (verificado con `npm test`)
- [ ] Coverage: ≥90% (mantiene/sube)
- [ ] GDD health ≥87 (verificado)
- [ ] CodeRabbit: 0 comentarios (verificado con `npm run coderabbit:review`)
- [ ] Completion validation: exit 0 (verificado con `npm run validate:completion -- --pr=807`)
