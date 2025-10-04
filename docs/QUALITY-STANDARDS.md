# Quality Standards - Roastr AI

> **"Producto monetizable, no proyecto de instituto"**

Este documento establece los estándares de calidad NO NEGOCIABLES para todo código, documentación y proceso en Roastr AI.

## 🎯 Principio Fundamental

**Calidad > Velocidad**

Todo código debe cumplir estándares de producción comercial. No existe "suficientemente bueno para ahora". Solo existe "listo para producción" o "no listo".

## ✅ Criterios de Aceptación para Pull Requests

### Requisito Mínimo: 0 Comentarios de CodeRabbit

Una PR solo está lista para merge cuando cumple **LOS 3 REQUISITOS**:

1. ✅ **Sin conflictos** - Mergeable limpiamente con main
2. ✅ **CI/CD passing** - Todos los jobs verdes, 0 tests fallando
3. ✅ **0 comentarios de CodeRabbit** - Cero sugerencias, cero warnings, cero improvements

**No hay excepciones.** Si CodeRabbit comenta, se arregla ANTES de merge.

### Pre-Flight Checklist (OBLIGATORIO antes de crear PR)

Antes de ejecutar `gh pr create`, verificar:

- [ ] **Tests completos**
  - Unit tests para toda lógica nueva
  - Integration tests para flujos E2E
  - Edge cases cubiertos
  - Tests pasando localmente:
    ```bash
    npm test
    ```

- [ ] **Documentación actualizada**
  - CLAUDE.md si afecta workflow/orquestación
  - spec.md si cambia funcionalidad core
  - Nodos GDD relevantes actualizados
  - README si cambia setup/instalación

- [ ] **Code Quality**
  - Sin console.logs debug
  - Sin TODOs o FIXMEs sin issue asociada
  - Nombres descriptivos (variables, funciones, tests)
  - Comentarios solo donde necesario (código autoexplicativo)
  - Sin código muerto o comentado

- [ ] **Consistency**
  - Sigue convenciones del codebase existente
  - Estilo consistente con archivos similares
  - Estructura de carpetas respetada
  - Naming conventions seguidas

- [ ] **Security & Performance**
  - Sin credenciales hardcodeadas
  - Input validation presente
  - Error handling robusto
  - Sin queries N+1 o memory leaks evidentes

- [ ] **GDD Compliance** (si aplica)
  - Nodos actualizados con cambios
  - system-map.yaml refleja dependencias
  - Agentes Relevantes actualizados alfabéticamente
  - Evidencias de tests en docs/test-evidence/

## 🤖 Responsabilidades de Agentes

### Back-end Dev Agent

**Antes de completar tarea:**
1. Ejecutar pre-flight checklist completo
2. Correr tests localmente
3. Verificar que CodeRabbit no comentaría (self-review)
4. Solo entonces crear PR

**Si CodeRabbit comenta:**
1. NO pedir merge
2. Implementar TODAS las sugerencias
3. Re-verificar checklist
4. Push de correcciones
5. Esperar nueva review de CodeRabbit
6. Repetir hasta 0 comentarios

### Test Engineer Agent

**Estándar de calidad para tests:**
- Coverage mínimo: 80% para código nuevo
- Tests deben ser deterministas (0% flaky)
- Nombres descriptivos: `should [expected behavior] when [condition]`
- Arrange/Act/Assert claramente separados
- Mocks y fixtures en helpers, no inline
- Evidencias visuales para UI (screenshots en docs/test-evidence/)

**Antes de marcar tests como completos:**
1. Todos los tests passing
2. Coverage report generado
3. Evidencias guardadas si aplica
4. Nodos GDD actualizados con test status

### Front-end Dev Agent

**Estándar adicional UI:**
- Playwright validation con screenshots
- Responsive en mobile/tablet/desktop
- Accesibilidad básica (ARIA labels, keyboard nav)
- Sin errores en consola del browser
- Sin warnings de React/framework

### Task Assessor Agent

**Antes de recomendar CREATE:**
1. Cross-check con docs/nodes/ OBLIGATORIO
2. Verificar system-map.yaml
3. Buscar implementaciones parciales
4. Usar INCONCLUSIVE si hay duda
5. Nunca adivinar - pedir clarificación

### UX Researcher Agent

**Estándar de investigación:**
- Conclusiones basadas en datos, no opiniones
- Referencias a spec.md o investigación externa
- Propuestas con trade-offs claros
- Mockups o wireframes cuando sea necesario

## 📋 Workflow de Quality Assurance

### 1. Durante Desarrollo

```text
[Código] → Self-Review → Tests → Pre-flight Checklist → [PR Draft]
```

### 2. PR Review Process

```text
[PR Created] → CI/CD → CodeRabbit Review
                         ↓
                    ¿0 comentarios?
                    ↙           ↘
                  YES           NO
                   ↓             ↓
            [Ready to Merge]  [Fix Issues]
                               ↓
                          [Push Fixes]
                               ↓
                         [Wait Review]
                               ↓
                        [Repeat hasta 0]
```

### 3. Post-Merge

```text
[Merged] → Update Epic Tracking → Close Related Issues → Document Learnings
```

## 🚫 Anti-Patterns (NUNCA hacer)

1. ❌ **"Lo arreglo en otra PR"**
   - Si CodeRabbit comenta, se arregla AHORA
   - No crear deuda técnica intencionalmente

2. ❌ **"Es solo un warning"**
   - Warnings son errores en espera
   - 0 warnings = estándar

3. ❌ **"Funciona en mi máquina"**
   - Tests en CI deben pasar
   - Reproducible en cualquier entorno

4. ❌ **"Nadie va a usar ese edge case"**
   - Si puede pasar, pasará
   - Edge cases = tests obligatorios

5. ❌ **"Documentación después"**
   - Documentación es parte del feature
   - No está completo sin docs

6. ❌ **"Solo testing manual"**
   - Tests automatizados obligatorios
   - Manual testing es complementario

## 💡 Mentalidad de Calidad

### Para Claude Code (Orquestador)

**Antes de crear PR:**
- "¿Estaría orgulloso de mostrar este código en una entrevista?"
- "¿Pagaría por software con esta calidad?"
- "¿CodeRabbit encontrará algo que mejorar?"

**Si la respuesta a alguna es NO → no crear PR todavía.**

### Para Desarrolladores Humanos

**Este estándar aplica igual:**
- Mismo pre-flight checklist
- Mismo requisito de 0 comentarios
- Mismo nivel de profesionalismo

**Beneficio:** Código base consistentemente excelente, product-ready desde día 1.

## 📊 Métricas de Calidad

### Objetivos Trimestrales

- **PRs merged con 0 comentarios**: >90%
- **Test coverage**: >80%
- **CI/CD pass rate first try**: >95%
- **Production bugs**: <5 por trimestre
- **Technical debt issues**: Tendencia decreciente

### Review Mensual

Último día de cada mes:
1. Revisar métricas vs objetivos
2. Identificar patrones de comentarios CodeRabbit
3. Actualizar checklist si es necesario
4. Compartir learnings en docs/learnings/

## 🔄 Continuous Improvement

Este documento es un **living document**:

- Se actualiza cuando identificamos nuevos patrones
- Se refina basado en feedback de CodeRabbit
- Se expande con nuevos estándares según el producto crece

**Última actualización:** 2025-10-03
**Próxima revisión:** 2025-11-01

---

## 📚 Referencias

- [CLAUDE.md](../CLAUDE.md) - Workflow y orquestación
- [spec.md](../spec.md) - Especificación funcional
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Guía de contribución
- [docs/nodes/](./nodes/) - GDD documentation

---

**Recuerda:** Cada línea de código refleja nuestro profesionalismo. Producto monetizable, siempre.
