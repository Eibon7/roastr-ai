# Roastr UI Rules

1. **Basado en shadcn/ui**
   - Todos los botones, inputs, tarjetas y formularios deben utilizar los componentes que exporta `components/ui`.
   - Evita mezclar librerías de UI externas sin aprobación; las extensiones deben componerse encima de los bloques de shadcn.

2. **Tailwind como única capa de estilos**
   - Nada de CSS global para layout; usa utilidades Tailwind o variantes `cva`.
   - Las clases personalizadas solo se permiten en componentes reutilizables dentro de `components/roastr`.

3. **Consistencia de layout**
   - Usa `PageLayout` para todas las pantallas protegidas y `SettingsSection` para bloques configurables.
   - Respeta los mismos radios (`--radius`) y sombras (`shadow-sm`, `shadow-md`) en todo el dashboard.

4. **Estados y accesibilidad**
   - Siempre incluye estados `loading`, `empty` y `error` visibles.
   - Usa iconografía de `lucide-react` con `aria-label` cuando renderices botones icon-only.

5. **Tokenización y datos sensibles**
   - Nunca mostrar IDs completos ni hashes completos; utiliza helpers para truncar.
   - Los porcentajes (uso, riesgo Shield) se presentan siempre con `UsageMeter` o `ShieldStatus`.

6. **Modo oscuro**
   - Las combinaciones deben apoyarse en los tokens `background`, `foreground`, `card`, `muted`.
   - Probar cualquier degradado en ambos temas antes de subirlo.
