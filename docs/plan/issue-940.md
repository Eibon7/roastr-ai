# Issue #940: Fix remaining AnalyzeToxicityWorker tests

## Estado Actual

- **Tests fallando**: 11 (originalmente 10 reportados en la issue)
- **Cobertura actual**: 71.21% (objetivo 70%+ alcanzado)
- **Root cause**: Mocking patterns incorrectos que interfieren entre tests

## Problemas Identificados

### 1. Mock Global en `beforeEach` (Principal)
```javascript
beforeEach(() => {
  // Este mock global rompe tests que quieren usar el método real
  worker.getComment = jest.fn().mockResolvedValue({...});
  worker.estimateTokens = jest.fn().mockReturnValue(10);
});
```

**Impacto**: Tests específicos no pueden usar el comportamiento real porque ya está mockeado.

### 2. encryptionService Module Caching
- Se importa como singleton: `const encryptionService = require('../services/encryptionService')`
- El mock no se aplica porque el módulo se cachea antes de que el test configure el mock

### 3. shieldService Constructor Mocking
- Se crea con `new ShieldService()` en el constructor
- El mock de clase no se aplica correctamente en algunos tests

### 4. Test-Specific Issues
| Test | Problema | Solución |
|------|----------|----------|
| `estimateTokens empty text` | Mock global retorna 10 | Restaurar método real antes del test |
| `getComment retrieve` | Mock global retorna objeto fijo | No mockear globalmente |
| `getComment not found` | Mock global nunca retorna null | Configurar mock específico |
| `getUserRoastrPersona` | encryptionService no mockeado | Usar jest.mock antes de imports |
| `handleAutoBlockShieldAction` | shieldService.analyzeForShield no mockeado | Configurar mock específico |
| `checkWordVariations l33t` | Lógica del método incorrecta | Fix implementation |
| `recordAnalysisUsage` | costControl mock no configurado | Configurar mock correctamente |
| `updateCommentWithAnalysisDecision` | updateCommentAnalysis no mockeado | Configurar mock específico |
| `analyzePatterns` | toxicPatterns no disponible | Mock toxicityPatternsService |

## Solución Propuesta

### Opción A: Fix Mocking Pattern (Recomendado - Menor cambio)
1. NO mockear métodos del worker en `beforeEach` global
2. Solo mockear servicios externos (supabase, shieldService, etc.)
3. Cada test configura sus propios mocks según necesite

### Opción B: Dependency Injection (Para futuro - Mayor cambio)
- Modificar constructor para aceptar servicios como parámetros
- Facilita testing pero requiere cambios en producción

## Implementación (Opción A)

### Paso 1: Limpiar `beforeEach`
Remover mocks globales de métodos del worker que se quieren testear realmente.

### Paso 2: Configurar mocks específicos
Cada `describe` block configura solo los mocks que necesita.

### Paso 3: Fix tests específicos
- `estimateTokens`: No mockear, usar implementación real
- `getComment`: Configurar mock de supabase específico por test
- `getUserRoastrPersona`: Configurar mock de encryptionService antes de test
- etc.

## Archivos Afectados
- `tests/unit/workers/AnalyzeToxicityWorker.test.js`

## Agentes Relevantes
- TestEngineer (principal)

## Validación
```bash
npm test -- --testPathPatterns="analyzeToxicityWorker"
# Esperado: 0 tests fallando
```

## Timeline
- **Estimado**: 2-3 horas
- **Prioridad**: P1 - Media

---

## RESULTADOS FINALES ✅

### Tests Arreglados (11 total)
1. ✅ `estimateTokens › should handle empty text`
2. ✅ `getComment › should retrieve comment from database`
3. ✅ `getComment › should return null when comment not found`
4. ✅ `getUserRoastrPersona › should retrieve and decrypt Roastr Persona`
5. ✅ `getUserRoastrPersona › should return null when user has no persona`
6. ✅ `getUserRoastrPersona › should return null when organization not found`
7. ✅ `handleAutoBlockShieldAction › should handle auto-block Shield action`
8. ✅ `handleAutoBlockShieldAction › should handle Shield service errors gracefully`
9. ✅ `checkWordVariations › should detect l33t speak variations`
10. ✅ `recordAnalysisUsage › should record usage for unified analysis`
11. ✅ `updateCommentWithAnalysisDecision › should update comment with unified analysis decision`

### Métricas Finales
- **Tests passing**: 83
- **Tests skipped**: 8 (intencionales)
- **Tests failing**: 0

### Receipt Generado
- `docs/agents/receipts/940-TestEngineer.md`

