## Estado Actual

- Existe `apps/backend-v2` con rutas `auth` (login/magic-link/etc.) y servicios base con Supabase.
- Faltaba un endpoint de registro v2 con **contrato estable**, **anti-enumeration** y **feature flag** dedicado.

## Objetivo (ROA-374)

Implementar `POST /api/v2/auth/register` usando **Supabase Auth** (email + password) como fuente única de identidad, creando un **perfil mínimo** y devolviendo una respuesta homogénea.

## Implementación (resumen)

- **Endpoint**: `apps/backend-v2/src/routes/auth.ts`
  - `POST /api/v2/auth/register`
  - Validación: email requerido + normalizado (case-insensitive), password \(8-128\)
  - Feature flag: `feature_flags.enable_user_registration` (fail-closed → 404)
  - Anti-enumeration: siempre `{ "success": true }` en casos “email ya existe” o “signup OK”
  - Rate limit: misma política que login (`rateLimitByType('login')`)
- **Servicio**: `apps/backend-v2/src/services/authService.ts`
  - `register({ email, password })`: usa `supabase.auth.signUp()`
  - Crea perfil mínimo best-effort en `profiles` (sin onboarding/billing)
- **SSOT/Flags**:
  - Añadido `enable_user_registration` a SSOT y validadores.
  - Default OFF en `apps/backend-v2/src/config/admin-controlled.yaml`.

## Agentes

- **TestEngineer**: requerido (cambios en `apps/backend-v2/src` + nuevos tests).
- **Guardian**: requerido (cambios en auth/feature flags/SSOT + contrato anti-enumeration).

## Archivos tocados (high-level)

- `apps/backend-v2/src/routes/auth.ts`
- `apps/backend-v2/src/services/authService.ts`
- `apps/backend-v2/tests/**`
- `docs/SSOT-V2.md`, `docs/SSOT/roastr-ssot-v2.md`
- `scripts/ci/validate-feature-flags.js`

## Validación

- `npm test --prefix apps/backend-v2`
- `npm run test:coverage --prefix apps/backend-v2`
- `npm run build --prefix apps/backend-v2`
- `node scripts/ci/validate-feature-flags.js --path=apps/backend-v2 --ci`

