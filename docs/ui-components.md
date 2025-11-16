# Catálogo de Componentes UI (Roastr + shadcn)

## Base (shadcn/ui)
- `Button`, `Badge`, `Card`, `Tabs`, `Dialog`, `Input`, `Textarea`, `Form`, `Label`, `Switch`, `Separator`, `Progress`, `Alert`.
- Todos ubicados en `frontend/src/components/ui/`.  
- Deben importarse siempre desde esta ruta (no usar variantes previas hechas a mano).

## Componentes `components/roastr/`

### `PageLayout`
- Contenedor estándar de dashboards, recibe `title`, `subtitle`, `metrics` y `actions`.
- Alimentado vía contexto (`PageLayoutProvider` + `usePageLayoutConfig`).
- Usa `Separator` y tokens Tailwind para mantener consistencia.

### `RoastrComment`
- Card semántica para comentarios/intercepciones. Props clave:
  - `author`, `handle`, `platform`, `timestamp`, `content`.
  - `sentiment` (`positive|neutral|negative`), `toxicityScore`, `tags`, `actions`.
- Reutilizado en Shield y futuros timelines.

### `RoastrReply`
- Presenta la respuesta generada + acciones (`onCopy`, `onSend`).
- Recibe `status` (`draft|scheduled|published`), `toneLabel`, `score`.
- Internamente se apoya en `Textarea` y `Button`.

### `ShieldStatus`
- Visualiza estado de moderación (`status`, `severity`, `score`).
- Incluye lista de acciones ejecutadas y `lastActionAt`.
- Usa `Alert`, `Badge`, `Progress`.

### `UsageMeter`
- KPI unificado para límites y consumo (roasts, análisis, Shield).
- Props: `used`, `limit`, `unit`, `badge`, `trend`, `tone`.
- Maneja límites ilimitados (`limit < 0`) y muestra remanente.

### `SettingsSection`
- Wrapper para formularios/configuraciones con `title`, `description`, `actions`, `footer`.
- Construido encima de `Card`.

## Reglas rápidas
- Todo nuevo elemento visual debe preferir estos componentes antes de crear uno custom.
- Cualquier ampliación debe documentarse aquí y en `docs/ai-ui-rules.md`.

