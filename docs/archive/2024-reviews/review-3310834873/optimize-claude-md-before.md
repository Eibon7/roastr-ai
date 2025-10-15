# Plan de Optimización: CLAUDE.md

**Fecha**: 2025-10-07
**Objetivo**: Reducir CLAUDE.md de ~43.6k a <40k caracteres (8% reducción)
**Estado Actual**: 1241 líneas, 44KB, advertencia de performance

## Análisis del Contenido Actual

### Contenido Duplicado Detectado

1. **"Multi-Tenant Architecture"** - Aparece 2 veces:
   - Líneas 9-19: Resumen breve (10 líneas)
   - Líneas 211-253: Desglose detallado (43 líneas)
   - **Ahorro**: ~800 caracteres eliminando duplicado

### Secciones Excesivamente Detalladas

2. **GDD Runtime Validation Workflow** (líneas 648-783):
   - ~5.5k caracteres de comandos, ejemplos y detalles técnicos
   - Ya existe `docs/GDD-ACTIVATION-GUIDE.md` con esta información
   - **Ahorro**: ~4k caracteres (resumir y referenciar)

3. **Node Health Scoring System** (líneas 787-859):
   - ~3.5k caracteres con tablas detalladas y ejemplos
   - **Ahorro**: ~2k caracteres (resumir tabla y eliminar ejemplos)

4. **Predictive Drift Detection** (líneas 861-972):
   - ~4.5k caracteres con comandos repetitivos y JSON largo
   - **Ahorro**: ~3k caracteres (resumir comandos, eliminar JSON)

5. **CI/CD GDD Automation** (líneas 975-1208):
   - ~9.5k caracteres - sección más larga del documento
   - Incluye config JSON completa, workflows detallados, ejemplos de PR comments
   - **Ahorro**: ~6k caracteres (resumir workflows, eliminar ejemplos largos)

### Comandos Repetitivos

6. **Comandos GDD** (líneas 73-96):
   - 24 líneas de comandos similares
   - **Ahorro**: ~500 caracteres (agrupar comandos relacionados)

### Ejemplos Innecesariamente Largos

7. **Ejemplos JSON/Markdown**:
   - Ejemplo de drift-report.json (líneas 912-943): ~1.5k caracteres
   - Ejemplo de PR comment (líneas 1035-1054): ~800 caracteres
   - Ejemplo de commit message (líneas 1078-1090): ~500 caracteres
   - **Ahorro**: ~2k caracteres (abreviar o eliminar)

## Estrategia de Optimización

### 1. Eliminar Duplicados (Prioridad Alta)
- [x] Identificar sección "Multi-Tenant Architecture" duplicada
- [ ] Consolidar en una sola sección (mantener la detallada)
- **Target**: -800 caracteres

### 2. Resumir Secciones GDD (Prioridad Alta)
- [ ] **Runtime Validation**: Reducir de ~5.5k a ~1.5k
  - Mantener solo comandos principales
  - Referenciar `docs/GDD-ACTIVATION-GUIDE.md` para detalles
- [ ] **Health Scoring**: Reducir de ~3.5k a ~1.5k
  - Tabla de factores: mantener solo nombres y pesos
  - Eliminar ejemplo de output dashboard
- [ ] **Drift Detection**: Reducir de ~4.5k a ~1.5k
  - Lista de comandos: mantener solo 3 principales
  - Eliminar ejemplo JSON completo
- [ ] **CI/CD Automation**: Reducir de ~9.5k a ~3.5k
  - Config JSON: mantener solo campos críticos
  - Workflows: descripción resumida
  - Eliminar ejemplos de PR comments/commits
- **Target**: -15k caracteres

### 3. Optimizar Comandos (Prioridad Media)
- [ ] Agrupar comandos GDD relacionados
- [ ] Usar tabla compacta en lugar de lista
- **Target**: -500 caracteres

### 4. Abreviar Ejemplos (Prioridad Media)
- [ ] Acortar ejemplos JSON (máximo 10 líneas)
- [ ] Eliminar ejemplos redundantes
- **Target**: -2k caracteres

### 5. Referencias Externas (Prioridad Media)
- [ ] Añadir sección "📚 Documentación Completa" al inicio
- [ ] Referenciar docs externos en lugar de duplicar contenido
  - `docs/GDD-ACTIVATION-GUIDE.md` - Detalles completos de GDD
  - `docs/QUALITY-STANDARDS.md` - Standards de calidad
  - `.gddrc.json` - Configuración GDD completa
- **Target**: Mejor navegación, sin carga adicional

## Métricas de Éxito

| Métrica | Actual | Target | Prioridad |
|---------|--------|--------|-----------|
| Tamaño total | 43.6k | <40k | P0 |
| Reducción mínima | - | 3.6k (8%) | P0 |
| Reducción objetivo | - | 5-6k (12-14%) | P1 |
| Tamaño final ideal | - | 37-38k | P1 |
| Líneas | 1241 | ~1100 | P2 |

## Checklist Pre-Implementación

- [x] Análisis de contenido completo
- [x] Identificación de áreas de optimización
- [x] Cálculo de ahorros estimados
- [ ] Verificar que docs externos existen
- [ ] Backup de CLAUDE.md original (git)
- [ ] Plan aprobado

## Checklist Post-Implementación

- [ ] CLAUDE.md optimizado < 40k caracteres
- [ ] Sin pérdida de información crítica
- [ ] Referencias externas válidas
- [ ] Formato markdown correcto
- [ ] Commit con mensaje descriptivo
- [ ] Validación: Claude Code puede leer y entender el documento

## Notas Importantes

**NO ELIMINAR:**
- Comandos de desarrollo esenciales
- Estructura del proyecto
- Variables de entorno
- Reglas de orquestación críticas
- Quality Standards (puede resumirse)
- Task Assessment workflow (crítico)
- Planning Mode rules (crítico)
- Tareas al Cerrar (crítico)

**MANTENER ESENCIA:**
- GDD es parte fundamental del workflow
- Debe ser suficientemente claro para Claude Code
- Balance entre brevedad y claridad

## Estimación de Tiempo

- Análisis: 10 min ✅
- Planificación: 15 min ⏳
- Implementación: 30 min
- Verificación: 10 min
- **Total**: ~65 minutos

---

**Próximo paso**: Verificar existencia de docs externos y proceder con implementación.
