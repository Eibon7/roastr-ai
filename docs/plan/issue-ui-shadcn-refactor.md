## Issue: UI Refactor con shadcn/ui

### Estado actual

- El frontend usa React con `react-scripts`, estilos centralizados en `src/App.css` y utilidades ad-hoc que replican parcialmente Tailwind.
- No existe configuración oficial de Tailwind ni carpeta `components/ui` alineada con shadcn/ui; la UI actual mezcla CSS global + componentes propios inconsistentes.
- No contamos con componentes compartidos para comentarios, respuestas o layout; cada página define su propio markup y estilos.
- No hay documentación de reglas visuales ni inventario actualizado de componentes UI personalizados.

### Pasos propuestos

1. **Setup base (Tailwind + shadcn/ui)**
   - Instalar Tailwind en `frontend`, generar `tailwind.config.js`, `postcss.config.js`, `components.json` de shadcn y carpeta `src/components/ui`.
   - Configurar `content` en Tailwind para todo `src/**/*.{js,jsx,ts,tsx}` y activar plugins necesarios (forms, animate).
   - Añadir estilos globales en `src/index.css` con directivas `@tailwind` y definir variables/css base requeridas por shadcn.
2. **Definir reglas y documentación**
   - Crear `/docs/ai-ui-rules.md` con las “Roastr UI Rules” (tipografía, colores, espaciado, estados).
   - Documentar en `docs/ui-components.md` cada componente nuevo + uso recomendado conforme vayamos avanzado.
3. **Componentes shadcn base**
   - Ejecutar `npx shadcn-ui add ...` para `button`, `card`, `input`, `textarea`, `dialog`, `tabs`, `form`, `label`, `switch`, `separator`, `badge`, `progress`, `alert`.
   - Verificar compatibilidad con CRA (ajustar imports de React 19 y SSR-safe patterns).
4. **Componentes Roastr**
   - Crear `src/components/roastr/` y desarrollar `RoastrComment`, `RoastrReply`, `ShieldStatus`, `UsageMeter`, `SettingsSection`, `PageLayout` reutilizando componentes de `components/ui`.
   - Diseñar props mínimos (avatar, metadatos, estados de shield, porcentajes de uso, slots para formularios, etc.).
5. **Refactor pantallas**
   - Revisar `src/pages` (dashboard, analytics, compose, integrations, billing, settings, logs, approval, accounts, etc.) y `components` clave (Sidebar, AppShell, cards).
   - Sustituir botones/cards/layout legacy por equivalentes de shadcn y `PageLayout`.
   - Limpiar CSS redundante (`App.css`) moviendo estilos a clases Tailwind/shadcn; eliminar componentes duplicados reemplazados.
6. **Tests**
   - Añadir tests básicos en `src/__tests__/components/roastr/*.test.tsx` (render + props) usando React Testing Library.
7. **Automatizaciones y documentación adicional**
   - Generar issue automático con título indicado y el contenido solicitado.
   - Actualizar receipts necesarios (FrontendDev, TestEngineer, VisualValidation, Guardian si tocan docs/nodes).
8. **Validación**
   - Ejecutar `npm run lint`, `npm test -- --runTestsByPath <nuevos tests>`, `npm run build`.
   - Validar UI con Playwright MCP (desktop/tablet/mobile) y adjuntar evidencia en `docs/test-evidence/`.

### Agentes / Skills requeridos

- FrontendDev (cambios en _.jsx, _.tsx, estilos y experiencia visual)
- TestEngineer (nuevos componentes y tests)
- VisualValidation skill (Playwright)
- TaskAssessor (alcance con múltiples AC, ya cubierto con este plan)

### Archivos/Directorios impactados

- `frontend/package.json`, `package-lock.json`
- `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/components.json`
- `frontend/src/index.css`, `frontend/src/App.css`, `frontend/src/index.js`, `frontend/src/App.js`
- `frontend/src/components/ui/*`, `frontend/src/components/roastr/*`
- `frontend/src/pages/**/*` y componentes compartidos (AppShell, Sidebar, etc.)
- `frontend/src/__tests__/components/roastr/*`
- `docs/ai-ui-rules.md`, `docs/ui-components.md`
- `docs/agents/receipts/*` (nuevos)

### Validación y verificación

- `npm install && npm run lint && npm run test && npm run build`
- `node scripts/validate-gdd-runtime.js --full`
- `node scripts/score-gdd-health.js --ci`
- Ejecución Playwright MCP (capturas multi-viewport) documentada en `docs/test-evidence/issue-<id>/`
- Confirmar adopción total de componentes shadcn (grep para elementos legacy críticos)
