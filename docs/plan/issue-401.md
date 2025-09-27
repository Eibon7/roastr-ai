# Plan de Implementación - Issue #401: SPEC 11 UI MVP Final Polish

## 🎯 Objetivo
Completar los 3 elementos finales del QA checklist de SPEC 11 (Issue #366) para alcanzar el 100% de completitud del UI MVP.

## 📋 Elementos a Implementar

### 1. Límites de conexión globales por plan
**Ubicación**: `frontend/src/pages/dashboard.jsx`  
**Cambios requeridos**:
- Reemplazar `isPlatformAtLimit(platform)` con lógica global
- Free plan: máximo 1 conexión total
- Pro+ plans: máximo 2 conexiones totales
- Actualizar mensajes de UI y tooltips

**Código específico**:
```javascript
// Cambiar función existente
const isPlatformAtLimit = (platform) => {
  return getConnectedAccountsForPlatform(platform).length >= 2;
};

// Por nueva función global
const isAtGlobalLimit = () => {
  const planTier = (adminModeUser?.plan || usage?.plan || 'free').toLowerCase();
  const totalConnected = accounts?.length || 0;
  const maxConnections = planTier === 'free' ? 1 : 2;
  return totalConnected >= maxConnections;
};
```

### 2. Shield tab gated por ENABLE_SHIELD_UI
**Ubicación**: `frontend/src/components/AccountModal.js`  
**Cambios requeridos**:
- Usar `useFeatureFlags()` con `isEnabled('ENABLE_SHIELD_UI')`
- Aplicar conditional rendering al tab Shield

**Código específico**:
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';
const { isEnabled } = useFeatureFlags();
const enableShield = isEnabled('ENABLE_SHIELD_UI');

const tabs = [
  { id: 'roasts', name: 'Últimos roasts', icon: '💬' },
  ...(enableShield ? [{ id: 'shield', name: 'Shield', icon: '🛡️' }] : []),
  { id: 'settings', name: 'Settings', icon: '⚙️' },
];
```

### 3. GDPR copy específico
**Ubicación**: `frontend/src/components/AjustesSettings.jsx`  
**Cambios requeridos**:
- Añadir texto específico: "Los roasts autopublicados llevan firma de IA"
- Ubicación: Sección de transparencia, después de la info box

## 👥 Agentes Requeridos

### 🎨 UI Designer
- Validar que los cambios de límites de conexión no rompan el diseño
- Asegurar consistencia visual en mensajes de error/límites
- Validar la ubicación del texto GDPR

### 💻 Front-end Dev  
- Implementar los 3 cambios de código
- Asegurar que la lógica de feature flags funciona correctamente
- Validar la integración con los hooks existentes

### 🧪 Test Engineer
- Crear tests unitarios para la nueva lógica de límites globales
- Crear tests para el conditional rendering del Shield tab
- Crear tests para la visualización del texto GDPR
- Validar que los tests existentes siguen pasando

## 🔧 Archivos a Modificar
1. `frontend/src/pages/dashboard.jsx` - Lógica de límites globales
2. `frontend/src/components/AccountModal.js` - Shield tab conditional
3. `frontend/src/components/AjustesSettings.jsx` - GDPR copy
4. `tests/unit/components/Dashboard.test.js` - Tests para límites
5. `tests/unit/components/AccountModal.test.js` - Tests para Shield tab
6. `tests/unit/components/AjustesSettings.test.js` - Tests para GDPR text

## 📸 Evidencias Visuales Requeridas
- Screenshot del dashboard con límites aplicados (free vs pro)
- Screenshot del AccountModal con Shield tab hidden/visible
- Screenshot de AjustesSettings con nuevo texto GDPR

## ✅ Criterios de Aceptación
- [ ] Dashboard usa límites globales por plan (no por plataforma)
- [ ] Shield tab solo visible si ENABLE_SHIELD_UI=true
- [ ] Texto GDPR específico presente en Settings
- [ ] Tests unitarios con 100% cobertura para cambios
- [ ] Evidencias visuales guardadas en docs/test-evidence/
- [ ] spec.md actualizado con los cambios

## 🔄 Flujo de Trabajo
1. **Análisis** - Revisar código actual y identificar problemas
2. **UI Designer** - Validar diseño y UX de los cambios
3. **Front-end Dev** - Implementar las correcciones
4. **Test Engineer** - Generar suite de tests completa
5. **Playwright** - Capturar evidencias visuales
6. **Documentación** - Actualizar spec.md y crear changelog

## ⚠️ Problemas Detectados en Implementación Actual
1. Dashboard.jsx: `isAtGlobalLimit()` creada pero `isPlatformAtLimit()` sigue siendo usada
2. AccountModal.js: Usa `flags?.ENABLE_SHIELD_UI` en lugar de `isEnabled()`
3. AjustesSettings.jsx: Texto duplicado en lugar de implementación correcta

## 🎯 Estimación
- **Tiempo total**: 2-3 horas
- **Complejidad**: Baja (cambios menores pero críticos para QA)
- **Prioridad**: Alta (completar SPEC 11 al 100%)