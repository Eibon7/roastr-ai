# Phase 11 - Visual Refinements Plan

**Date**: October 6, 2025
**Status**: Planning
**Priority**: P0 (pre-commit adjustments)

---

## 🎯 Objetivo

Refinar el Command Center para eliminar redundancias y mejorar consistencia visual Snake Eater antes de hacer commit.

---

## 📋 Issues Identificados por Usuario

### Issue 1: Sección "System Overview" redundante en HealthPanel
**Screenshot**: Usuario señala el elemento "SYSTEM OVERVIEW" con 4 StatusCards

**Problema**:
- La misma información está en el Top Status Bar (SystemStatusBar)
- Redundancia visual innecesaria
- Ocupa espacio valioso

**Solución**:
- Eliminar la sección "System Overview" completa de HealthPanel
- Mantener solo "Recent Activity" en HealthPanel
- El Top Status Bar ya muestra Health, Drift, Nodes, Coverage

**Archivo afectado**: `src/pages/GDDDashboard/HealthPanel.tsx`

---

### Issue 2: Emojis en Reports section
**Problema**:
- Emoji "📄" en el título "Reports Viewer"
- No pega con estética cyberpunk
- Inconsistente con resto del Command Center (sin emojis)

**Solución**:
- Remover emoji del título
- Cambiar a solo "REPORTS VIEWER" (uppercase, monospace)

**Archivo afectado**: `src/components/dashboard/ReportsViewer.tsx`

---

### Issue 3: Scroll en Reports container
**Problema**:
- max-height: 600px causa scroll interno
- Rompe el flow visual

**Solución**:
- Eliminar max-height
- Dejar que el contenido ocupe altura completa
- El scroll debe ser del MainContent, no del ContentContainer

**Archivo afectado**: `src/components/dashboard/ReportsViewer.tsx`

---

### Issue 4: Dropdown de Reports no tiene estilo Snake Eater
**Problema**:
- Dropdown usa estilos default del navegador (fondo blanco)
- No coincide con tema dark cyberpunk
- Falta estilo consistente con StatusCard, NodeChip, etc.

**Solución**:
- Rediseñar dropdown con estilos Snake Eater:
  - Background: #1f1d20
  - Border: 1px solid rgba(255, 255, 255, 0.12)
  - Text: #bdbdbd (JetBrains Mono)
  - Hover: border-color #50fa7b
  - Options: dark background, green highlight

**Archivo afectado**: `src/components/dashboard/ReportsViewer.tsx`

---

## 🎨 Workflow de Agentes

### Fase 1: UI Designer Agent
**Tarea**: Specs para el dropdown Snake Eater

**Deliverable**:
- Especificación del ReportSelector dropdown
- Estados: default, hover, focus, open
- Color palette exacto
- Typography
- Dimensions

**Output**: `docs/ui/design/command-center/reports-dropdown-spec.md`

---

### Fase 2: UX Agent (opcional, inline)
**Tarea**: Validar que eliminar System Overview no afecta UX

**Análisis**:
- ¿El usuario necesita ver métricas en HealthPanel?
  - NO, ya están en Top Status Bar (siempre visible)
- ¿Qué valor aporta HealthPanel sin System Overview?
  - Activity Log es único (no está en otro lugar)
  - Enfoque en eventos recientes (más útil)

**Conclusión**: Safe to remove, mejora focus

---

### Fase 3: Front-end Dev Agent
**Tarea**: Implementar ajustes en código

**Cambios**:

1. **HealthPanel.tsx**:
   ```tsx
   // ANTES: 2 secciones (System Overview + Recent Activity)
   // DESPUÉS: 1 sección (solo Recent Activity)

   // Eliminar:
   <Section>
     <SectionTitle>System Overview</SectionTitle>
     <MetricsGrid>...</MetricsGrid>
   </Section>

   // Mantener:
   <Section>
     <SectionTitle>Recent Activity</SectionTitle>
     <ActivityLog>...</ActivityLog>
   </Section>
   ```

2. **ReportsViewer.tsx**:
   ```tsx
   // Cambio 1: Título sin emoji
   <Title>REPORTS VIEWER</Title> // era "📄 Reports Viewer"

   // Cambio 2: Eliminar max-height
   const ContentContainer = styled.div`
     // max-height: 600px; // ELIMINAR
     overflow-y: auto; // MANTENER (por si acaso)
   `;

   // Cambio 3: Rediseñar dropdown
   const ReportSelect = styled.select`
     background: #1f1d20;
     border: 1px solid rgba(255, 255, 255, 0.12);
     border-radius: 4px;
     padding: 12px 16px;
     font-family: 'JetBrains Mono', monospace;
     font-size: 14px;
     color: #bdbdbd;
     cursor: pointer;
     transition: all 0.15s ease;

     &:hover {
       border-color: rgba(80, 250, 123, 0.4);
     }

     &:focus {
       outline: none;
       border-color: #50fa7b;
       box-shadow: 0 0 0 2px rgba(80, 250, 123, 0.2);
     }

     option {
       background: #1f1d20;
       color: #bdbdbd;
       padding: 12px;
     }
   `;
   ```

**Output**: Archivos modificados, listo para commit

---

### Fase 4: Whimsy Agent (opcional)
**Tarea**: Añadir microinteracciones al dropdown

**Ideas**:
- Hover: subtle border glow
- Focus: pulse animation en border
- Option select: brief highlight

**Output**: Specs de animaciones (si hay tiempo)

---

## ✅ Criterios de Aceptación

**Visual**:
- [ ] HealthPanel solo muestra "Recent Activity" (sin System Overview)
- [ ] Título Reports sin emoji
- [ ] Dropdown con fondo dark (#1f1d20)
- [ ] Dropdown options readable y styled
- [ ] No scroll interno en Reports (o ajustado correctamente)

**Funcional**:
- [ ] HealthPanel sigue mostrando activity log correctamente
- [ ] Dropdown sigue funcionando (select report)
- [ ] Download button sigue funcionando
- [ ] No errores de consola

**Consistencia**:
- [ ] Dropdown matches StatusCard, NodeChip styling
- [ ] Typography consistent (JetBrains Mono)
- [ ] Color palette Snake Eater (#50fa7b accent)

---

## 🚀 Orden de Ejecución

```
1. UI Designer Agent → Specs de dropdown
   ↓
2. Front-end Dev (inline) → Implementar cambios
   ↓
3. Visual check en navegador
   ↓
4. User approval
   ↓
5. Commit incremental (ajustes pre-commit)
```

---

## 📝 Commit Message (después de ajustes)

```
fix(phase-11): Visual refinements for Command Center

- Remove redundant System Overview from HealthPanel
- Remove emoji from Reports title
- Redesign Reports dropdown with Snake Eater styling
- Remove scroll constraint from Reports container

Maintains consistency with cyberpunk aesthetic.
```

---

**Next Action**: Invocar UI Designer Agent para specs de dropdown, luego implementar cambios inline.
