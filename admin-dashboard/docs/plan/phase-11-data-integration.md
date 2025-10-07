# Phase 11.2 - Real GDD Data Integration

**Date**: October 6, 2025
**Status**: Planning
**Priority**: P0 (complete Command Center with real data)

---

## 🎯 Objetivo

Integrar datos reales del sistema GDD en el Command Center, reemplazando todos los valores mock por datos provenientes de:
- `gdd-health.json` (health scores, coverage)
- `gdd-status.json` (validation status, node count)
- `gdd-drift.json` (drift risk)

---

## 📊 Estado Actual

### Componentes con Datos Mock:
1. **CommandCenterLayout.tsx**:
   - `stats` hardcoded: `{ health: 95.5, drift: 12, nodes: 13, coverage: 78 }`
   - `activities` array hardcoded
   - No usa hooks para fetch

2. **HealthPanel.tsx**:
   - Recibe `stats` como props (mock)
   - Recibe `activities` como props (mock)

3. **LeftSidebar.tsx**:
   - Recibe `stats` como props (mock)

4. **SystemStatusBar.tsx** (eliminado):
   - Ya no existe en el layout

### APIs Existentes:
- ✅ `src/services/gddApi.ts` ya implementado
- ✅ `src/types/gdd.types.ts` ya definido
- ✅ Archivos JSON disponibles en root: `gdd-health.json`, `gdd-status.json`, `gdd-drift.json`

---

## 🔄 Mapeo de Datos

### Health Score (95.5)
**Fuente**: `gdd-health.json`
```json
{
  "average_score": 95.5
}
```

### Drift Risk (12%)
**Fuente**: `gdd-drift.json`
```json
{
  "average_drift_risk": 30  // Pero actualmente es 30, no 12
}
```

### Total Nodes (13)
**Fuente**: `gdd-status.json` o `gdd-health.json`
```json
{
  "nodes_validated": 13  // gdd-status.json
  "node_count": 13       // gdd-health.json
}
```

### Coverage (78% → 83.8%)
**Fuente**: `gdd-health.json` → calcular promedio de `coverageEvidence`
```javascript
// Calcular promedio de todos los nodos
const coverage = Object.values(healthData.nodes)
  .reduce((sum, node) => sum + node.breakdown.coverageEvidence, 0) / nodeCount;
// Resultado real: 83.8%
```

### Recent Activity
**Fuente**: Parsear eventos del sistema (por ahora mock)
- Opción 1: Leer `docs/system-validation.md` (último reporte)
- Opción 2: Timestamp de `gdd-health.json` + `gdd-drift.json`
- Opción 3: Mantener mock hasta tener log real

---

## 🏗️ Arquitectura de Integración

### 1. Custom Hook: `useGDDData()`
**Ubicación**: `src/hooks/useGDDData.ts`

**Responsabilidad**:
- Fetch de `gdd-health.json`, `gdd-status.json`, `gdd-drift.json`
- Cálculo de métricas derivadas (coverage promedio)
- Auto-refresh cada 30 segundos
- Error handling
- Loading states

**Output**:
```typescript
interface GDDStats {
  health: number;        // average_score
  drift: number;         // average_drift_risk
  nodes: number;         // node_count
  coverage: number;      // promedio coverageEvidence
  loading: boolean;
  error: string | null;
  lastUpdated: string;
  refresh: () => void;
}
```

### 2. Actualizar `CommandCenterLayout.tsx`
- Reemplazar `useState` mock por `useGDDData()`
- Mantener `activities` mock (hasta tener fuente real)

### 3. Copiar JSON files a `public/`
- Para que Vite pueda servirlos en desarrollo
- `cp gdd-*.json admin-dashboard/public/`

---

## 🎨 Workflow de Agentes

### Fase 1: Orchestrator (inline)
**Tarea**: Crear plan y coordinar implementación

### Fase 2: Front-end Dev Agent
**Tarea**: Implementar hook `useGDDData` + integrar en CommandCenterLayout

**Archivos a crear**:
- `src/hooks/useGDDData.ts`

**Archivos a modificar**:
- `src/pages/GDDDashboard/CommandCenterLayout.tsx`

**Archivos a copiar**:
- `gdd-health.json` → `public/gdd-health.json`
- `gdd-status.json` → `public/gdd-status.json`
- `gdd-drift.json` → `public/gdd-drift.json`

### Fase 3: Test Engineer Agent
**Tarea**: Validar que datos se cargan correctamente

**Verificaciones**:
- Network requests a `/gdd-*.json` exitosas
- Valores en UI coinciden con JSON
- Auto-refresh funciona (30s)
- Error states funcionan (archivo no encontrado)
- Loading states funcionan

---

## ✅ Criterios de Aceptación

**Datos Reales**:
- [ ] Health Score muestra `95.5` (de gdd-health.json)
- [ ] Drift Risk muestra `30%` (de gdd-drift.json)
- [ ] Total Nodes muestra `13` (de gdd-status.json)
- [ ] Coverage muestra `~84%` (calculado de coverageEvidence)
- [ ] Last Updated muestra timestamp real

**Funcionalidad**:
- [ ] Auto-refresh cada 30 segundos
- [ ] Botón refresh manual funciona
- [ ] Loading state visible al cargar
- [ ] Error handling si JSON no disponible
- [ ] No errores de consola

**Performance**:
- [ ] Fetch paralelo de 3 JSONs (<500ms total)
- [ ] No re-fetch innecesarios
- [ ] Cache local opcional (localStorage)

---

## 🚀 Orden de Ejecución

```
1. Copiar JSON files a public/
   ↓
2. Crear hook useGDDData.ts
   ↓
3. Integrar hook en CommandCenterLayout
   ↓
4. Test en navegador (verificar network + UI)
   ↓
5. Verificar auto-refresh
   ↓
6. Commit: "feat(phase-11): Integrate real GDD data"
```

---

## 📝 Commit Message (después de implementación)

```
feat(phase-11): Integrate real GDD data in Command Center

Replace mock data with real GDD system metrics:

New Hook:
- useGDDData(): Fetches gdd-health.json, gdd-status.json, gdd-drift.json
- Auto-refresh every 30 seconds
- Calculates coverage from coverageEvidence average

Data Integration:
- Health Score: 95.5 (from gdd-health.json)
- Drift Risk: 30% (from gdd-drift.json)
- Total Nodes: 13 (from gdd-status.json)
- Coverage: 84% (calculated from node coverage)

Files:
- src/hooks/useGDDData.ts (new)
- src/pages/GDDDashboard/CommandCenterLayout.tsx (updated)
- public/gdd-*.json (copied from root)

Part of Phase 11 Command Center implementation.
```

---

**Next Action**: Implementar hook `useGDDData.ts` y actualizar `CommandCenterLayout.tsx`.
