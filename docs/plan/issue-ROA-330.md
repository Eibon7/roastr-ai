# Plan: ROA-330 - GDD v2 Node Post-Modification Consistency and System Map

**Issue:** ROA-330  
**Título:** GDD v2 Node Post-Modification Consistency and System Map  
**Fecha:** 2025-12-14  
**Estado:** Implementado (PR #1129)

---

## Estado Actual

Actualmente, cuando se modifican nodos v2 (`docs/nodes-v2/`) o el `system-map-v2.yaml`, no existe un workflow automatizado que valide la consistencia después de las modificaciones. 

Las validaciones existen pero están dispersas:
- `scripts/validate-v2-doc-paths.js` - Valida paths de documentación
- `scripts/validate-ssot-health.js` - Valida sección 15 del SSOT
- `scripts/check-system-map-drift.js` - Valida drift del system-map
- `scripts/validate-strong-concepts.js` - Valida Strong Concepts

**Problema:** No hay un script único que ejecute todas estas validaciones en secuencia y falle si alguna falla, lo cual es necesario para mantener la consistencia después de modificaciones.

---

## Objetivo

Crear un script `validate-post-modification-v2.js` que:

1. Ejecute todas las validaciones necesarias después de modificar nodos v2 o system-map-v2.yaml
2. Falle con exit code 1 si alguna validación falla (modo CI)
3. Proporcione un resumen claro de qué validaciones pasaron/fallaron
4. Sea ejecutable desde CI y localmente

---

## Pasos de Implementación

### 1. Crear script `scripts/validate-post-modification-v2.js`

**Funcionalidad:**
- Ejecutar en secuencia:
  1. `validate-v2-doc-paths.js --ci`
  2. `validate-ssot-health.js --ci`
  3. `check-system-map-drift.js --ci`
  4. `validate-strong-concepts.js --ci`
- Capturar resultados de cada validación
- Generar resumen consolidado
- Exit code 1 si alguna falla (modo CI)
- Exit code 0 solo si todas pasan

**Estructura:**
```javascript
class PostModificationValidator {
  async validate() {
    const results = [];
    
    // Ejecutar cada validación
    results.push(await this.runValidation('validate-v2-doc-paths.js'));
    results.push(await this.runValidation('validate-ssot-health.js'));
    results.push(await this.runValidation('check-system-map-drift.js'));
    results.push(await this.runValidation('validate-strong-concepts.js'));
    
    // Generar resumen
    this.printSummary(results);
    
    // Exit code según resultados
    return results.every(r => r.success);
  }
}
```

### 2. Integrar con workflow existente

- El script debe ser ejecutable desde:
  - CI (`.github/workflows/`)
  - Pre-commit hooks (opcional)
  - Manualmente después de modificar nodos/system-map

### 3. Documentación

- Actualizar `.cursorrules` o documentación relevante para mencionar este script
- Añadir a FASE 4 de validación si aplica

---

## Agentes a Usar

- **Backend Developer**: Implementación del script
- **Test Engineer**: Validar que el script funciona correctamente

---

## Archivos Afectados

**Nuevos:**
- `scripts/validate-post-modification-v2.js`

**Modificados:**
- `scripts/validate-post-modification-v2.js` - Script principal de validación
- `.github/workflows/gdd-validate.yml` - Integración en CI

---

## Validación Requerida

1. ✅ Script ejecuta todas las validaciones en secuencia
2. ✅ Exit code 1 si alguna validación falla
3. ✅ Exit code 0 si todas pasan
4. ✅ Resumen claro de resultados
5. ✅ Funciona en modo CI y local

---

## Criterios de Éxito

- Script creado y funcional
- Todas las validaciones se ejecutan correctamente
- Exit codes correctos para CI
- Documentación actualizada si es necesario

---

## Notas

- Este script complementa los scripts de validación existentes, no los reemplaza
- Puede ser usado como parte de un workflow más amplio de validación post-modificación
- Debe seguir el mismo patrón de logging que otros scripts de validación
