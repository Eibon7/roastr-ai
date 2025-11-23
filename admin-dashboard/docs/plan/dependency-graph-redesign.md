# Dependency Graph Redesign - Workflow Style

## 🎯 Objetivo

Rediseñar completamente el Dependency Graph para que tenga el estilo visual de un **workflow/pipeline diagram** profesional, inspirado en la imagen de referencia del usuario.

## 📋 Estado Actual (Assessment)

**Existente:**

- ✅ Componente DependencyGraph funcional con D3.js
- ✅ 13 nodos GDD con dependencias
- ✅ 3 layouts (force, circular, hierarchical)
- ✅ Datos en `gdd-graph.json`

**Problemas:**

- ❌ Estilo básico de grafo de red (nodos circulares + edges)
- ❌ No se parece al estilo workflow/pipeline de la referencia
- ❌ Falta el aspecto de "boxes conectados con flechas"
- ❌ No tiene la elegancia visual del diseño de referencia

## 🎨 Análisis de la Imagen de Referencia

### Características Visuales Clave:

1. **Nodos como Cajas Rectangulares**:
   - Fondo oscuro semi-transparente
   - Bordes sutiles con glow
   - Iconos prominentes (no emojis, símbolos técnicos)
   - Texto claro y legible
   - Tamaño uniforme entre nodos

2. **Conexiones (Edges)**:
   - Flechas direccionales claras
   - Líneas punteadas para flujos condicionales
   - Líneas sólidas para flujos principales
   - Curvas suaves (no rectas)
   - Labels en las conexiones ("FINAL", "ITEM", etc.)

3. **Layout**:
   - Flow horizontal (izquierda → derecha)
   - Agrupación lógica por fases/capas
   - Espaciado generoso entre nodos
   - Sin solapamientos

4. **Color Palette**:
   - Fondo muy oscuro (#0A0E14 o similar)
   - Nodos: gris oscuro con bordes sutiles
   - Texto: blanco/gris claro
   - Highlights: verde neón (#00FF41) para selección
   - Estados: rojo/amarillo para warnings

5. **Tipografía**:
   - Monospace (JetBrains Mono)
   - Uppercase para labels principales
   - Tamaños consistentes

6. **Interactividad**:
   - Hover: border glow + background lighter
   - Click: highlight del path completo
   - Zoom & pan suaves

## 📐 Plan de Implementación

### Fase 1: UI/UX Design (UI Designer Agent)

**Objetivo**: Crear especificaciones detalladas del nuevo diseño

**Tareas**:

1. Analizar imagen de referencia en detalle
2. Definir dimensiones exactas de nodos (width, height, padding)
3. Especificar colores exactos (backgrounds, borders, text, hover states)
4. Diseñar sistema de iconos técnicos (no emojis)
5. Definir estilos de conexiones (solid, dashed, arrow styles)
6. Crear mockup visual en formato texto/ASCII

**Output**: `docs/ui/dependency-graph-workflow-spec.md`

### Fase 2: Whimsy Injection (Whimsy Injector Agent)

**Objetivo**: Añadir microinteracciones y detalles sutiles que eleven la UX

**Tareas**:

1. Diseñar animaciones de hover (border pulse, glow expansion)
2. Crear transiciones suaves entre estados
3. Añadir feedback visual al drag & drop
4. Diseñar animación de "path highlight" al hacer click
5. Crear efecto de "flow animation" en las flechas (opcional)

**Output**: `docs/ui/dependency-graph-whimsy.md`

### Fase 3: Frontend Implementation (Front-end Dev Agent)

**Objetivo**: Reescribir completamente el componente DependencyGraph

**Tareas**:

1. **Reemplazar D3 force layout** → Custom hierarchical layout
2. **Rediseñar nodos**:
   - SVG `<rect>` en lugar de `<circle>`
   - Iconos SVG técnicos (gear, shield, cpu, etc.)
   - Text wrapping para nombres largos
3. **Rediseñar edges**:
   - Bezier curves con control points
   - Flechas con markers SVG personalizados
   - Labels opcionales en las conexiones
4. **Implementar layout horizontal**:
   - Agrupar por "layers" (entrada → procesamiento → salida)
   - Auto-spacing vertical para evitar overlaps
5. **Añadir interactividad avanzada**:
   - Hover states con CSS transitions
   - Click para highlight path
   - Drag & drop opcional

**Output**: Nuevo `src/components/dashboard/DependencyGraph.tsx` (completo rewrite)

### Fase 4: Testing & Polish (Test Engineer Agent)

**Objetivo**: Validar visualmente el nuevo diseño

**Tareas**:

1. Playwright visual tests en múltiples viewports
2. Screenshots de comparación (antes/después)
3. Test de interactividad (hover, click, drag)
4. Validación de accesibilidad (WCAG AA)

**Output**: `docs/test-evidence/dependency-graph-redesign/`

## 🎯 Criterios de Aceptación

- [ ] Nodos tienen forma de **cajas rectangulares** (no círculos)
- [ ] Iconos son **símbolos SVG técnicos** (no emojis)
- [ ] Layout es **horizontal** (left → right flow)
- [ ] Conexiones tienen **flechas claras** con curvas suaves
- [ ] Estilo visual coincide **90%+** con la imagen de referencia
- [ ] Hover states son **suaves y profesionales**
- [ ] Click en un nodo **resalta todo su path** (dependencies + dependents)
- [ ] El grafo es **responsive** (adapta a mobile)
- [ ] Performance es **óptima** (no lag con 13 nodos)

## 🔄 Workflow de Ejecución

```
1. UI Designer Agent → Crea spec detallada
   ↓
2. Whimsy Injector Agent → Añade microinteracciones
   ↓
3. Front-end Dev Agent → Implementa nuevo componente
   ↓
4. Test Engineer Agent → Valida visualmente
   ↓
5. Orchestrator → Review final y commit
```

## 📊 Estimación

- **Complejidad**: Alta (complete rewrite)
- **Tiempo estimado**: 3-4 agentes en secuencia
- **Prioridad**: P1 (user request con alta ilusión)
- **Riesgo**: Bajo (componente aislado, no afecta otros)

## 🚀 Next Actions

1. Invocar **UI Designer Agent** con la imagen de referencia
2. Esperar specs completas
3. Invocar **Whimsy Injector Agent** con las specs
4. Invocar **Front-end Dev Agent** para implementar
5. Invocar **Test Engineer Agent** para validar
6. Commit final con evidencia visual

---

**Nota para Orchestrator**: Este es un proyecto de alta prioridad emocional para el usuario ("me haría mucha ilusión"). Asegurar calidad máxima en cada fase.
