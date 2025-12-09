# GDD Node — Arquitectura General del Sistema v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Define la arquitectura base de Roastr v2: estructura de monorepo, arquitectura hexagonal del backend, arquitectura modular del frontend, sistema de workers, integraciones con servicios externos, y el rol del SSOT como fuente única de configuración.

---

## 2. Responsibilities

### Funcionales:

- Definir la estructura de directorios del monorepo (`/apps/backend-v2`, `/apps/frontend-v2`, `/apps/shared`)
- Establecer la separación de capas en arquitectura hexagonal (dominio, adaptadores, servicios)
- Definir la arquitectura modular del frontend (UI, Application, Infrastructure, Domain)
- Coordinar workers asíncronos desacoplados
- Gestionar integraciones con servicios externos (Supabase, Polar, Resend, OpenAI, X, YouTube)

### No Funcionales:

- Garantizar modularidad y escalabilidad
- Asegurar separación de responsabilidades (dominio puro sin I/O)
- Facilitar testing realista (sin mock hell)
- Permitir evolución independiente de módulos

---

## 3. Inputs

- Especificación funcional de cada módulo (Motor de Análisis, Shield, Roasting, etc.)
- SSOT (admin_settings, plan_limits, shield_settings, tone_settings, workers_settings, integrations_settings, ai_settings, flags_settings)
- Requisitos de negocio (planes, límites, capacidades)
- Decisiones de infraestructura (Supabase, Polar, Resend)

---

## 4. Outputs

- Estructura de monorepo con dos aplicaciones (backend-v2, frontend-v2) y un paquete compartido (shared) para tipos/utilidades comunes
- Backend hexagonal con dominio puro
- Frontend modular con capas separadas
- Sistema de workers idempotentes
- Configuración centralizada vía SSOT

---

## 5. Rules

### Arquitectura Hexagonal (Backend):

1. **Dominio (`/services/`)**:
   - Lógica de negocio pura
   - ❌ PROHIBIDO: Llamadas HTTP, acceso directo a DB, lógica de Express, workers, serialización
   - ✅ SOLO: Reducers, calculators, decision trees, fórmulas

2. **Adaptadores de Entrada (`/routes/`)**:
   - Validación de requests
   - Coordinación de casos de uso
   - Serialización de respuestas
   - ❌ PROHIBIDO: Lógica de negocio

3. **Adaptadores de Salida (`/integrations/`, `/lib/db/`)**:
   - Encapsulan proveedores externos
   - Implementan interfaces definidas por el dominio

4. **Workers (`/workers/`)**:
   - Un caso de uso por worker
   - Idempotentes
   - Sin decisiones de dominio (solo ejecutan acciones)

### Arquitectura Frontend:

1. **UI Layer**: Componentes React puros (shadcn/ui)
2. **Application Layer**: Hooks, state, React Query
3. **Infrastructure Layer**: Clientes API, Supabase, gateways
4. **Domain Layer**: Tipos, validaciones puras, contratos

### SSOT:

- Todos los valores configurables viven en el SSOT (admin_settings + plan_limits + shield_settings + tone_settings + workers_settings + integrations_settings + ai_settings + flags_settings)
- ❌ PROHIBIDO: Valores mágicos hardcoded en código
- ✅ OBLIGATORIO: Cargar siempre desde SSOT a través del config loader
- El SSOT es la autoridad máxima para:
  - Thresholds de Shield
  - Límites por plan
  - Cadencias de workers
  - Modelos LLM por tono
  - Feature flags
  - Disclaimers IA
  - Configuración de plataformas

### Workers:

- Idempotentes
- Retries con backoff
- Métricas en cada ejecución
- Tenant-aware (siempre incluyen `userId` + `accountId`)
- Logs estructurados por worker
- DLQ tras fallos persistentes

---

## 6. Dependencies

### Servicios Externos:

- **Supabase**: DB + Auth + Storage
- **Polar**: Billing exclusivo v2
- **Resend**: Email transaccional v2
- **OpenAI**: Generación de roasts, fallback de toxicidad
- **Google Perspective API**: Análisis de toxicidad principal
- **X API**: Integración Twitter/X (OAuth2 PKCE)
- **YouTube API**: Integración YouTube (OAuth2)
- **Queue / Rate limiting**: Redis / Upstash (cola de jobs de workers y rate limit centralizado)

### Stack Tecnológico:

- **Backend**: Node.js + TypeScript + Express 5
- **Frontend**: React + Next.js (App Router) + shadcn/ui + Tailwind
- **Shared**: Tipos TypeScript compartidos
- **Testing**: Vitest + Supabase Test + Playwright

### Nodos GDD Relacionados:

- `02-autenticacion-usuarios.md` (Auth)
- `03-billing-polar.md` (Billing)
- `04-integraciones.md` (X, YouTube)
- `05-motor-analisis.md` (Motor de Análisis)
- `06-motor-roasting.md` (Motor de Roasting)
- `07-shield.md` (Shield)
- `08-workers.md` (Workers)
- `15-ssot-integration.md` (SSOT)

---

## 7. Edge Cases

1. **Dominio llama a I/O por error**:
   - Validación en CI detecta imports prohibidos
   - Code review rechaza PR

2. **Worker mezcla tenants**:
   - Validación pre-ejecución verifica `userId` + `accountId`
   - RLS en Supabase bloquea acceso cruzado

3. **Frontend accede directamente a SSOT**:
   - SSOT solo accesible vía backend API
   - Frontend usa hooks que consultan endpoints autorizados

4. **Código hardcodea valores de SSOT**:
   - Linter detecta constantes mágicas
   - CI valida que valores vienen de SSOT

5. **Integración falla temporalmente**:
   - Workers implementan retries con backoff
   - Fallback a DLQ tras 5 intentos
   - Logs estructurados sin datos sensibles

---

## 8. Acceptance Criteria

### Backend:

- [ ] Backend implementa arquitectura hexagonal estricta
- [ ] Dominio (`/services/`) no contiene I/O
- [ ] Rutas (`/routes/`) no contienen lógica de negocio
- [ ] Workers son idempotentes
- [ ] Todos los valores configurables vienen de SSOT

### Frontend:

- [ ] Frontend implementa arquitectura modular (UI/App/Infra/Domain)
- [ ] shadcn/ui + Tailwind implementados
- [ ] Tema claro/oscuro/sistema funcional
- [ ] Responsive (móvil, tablet, desktop)

### Integración:

- [ ] Supabase conectado (Auth + DB + Storage)
- [ ] Polar integrado (webhooks + SDK)
- [ ] Resend configurado (email transaccional)
- [ ] OpenAI configurado (roasts + fallback)
- [ ] Perspective API configurada (toxicidad)

### Workers:

- [ ] Workers idempotentes
- [ ] Retries con backoff implementados
- [ ] DLQ configurada
- [ ] Tenant-aware (userId + accountId en payloads)
- [ ] Logs estructurados sin texto crudo

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Dominio puro (reducers, calculators)
- ✅ Prompt builders A/B/C
- ✅ Style Validator
- ✅ Normalizadores (X, YouTube)
- ❌ NO testear: Llamadas a Supabase, APIs externas, I/O

### Integration Tests (Supabase Test):

- ✅ Flujos completos con DB real
- ✅ Workers ejecutando casos de uso
- ✅ Persistencia de datos
- ✅ RLS y multi-tenancy
- ❌ NO mockear: Supabase

### E2E Tests (Playwright):

- ✅ Login + conectar red
- ✅ Dashboard + widgets
- ✅ Detalle de cuenta
- ✅ Settings + billing
- ✅ Flujo completo: ingestión → análisis → roast → shield

---

## 10. Implementation Notes

### Backend Setup:

```bash
cd apps/backend-v2
npm install
npm run dev  # Express server en puerto 3001
```

### Frontend Setup:

```bash
cd apps/frontend-v2
npm install
npm run dev  # Next.js en puerto 3000
```

### Estructura de Directorios:

```
apps/
├── backend-v2/
│   ├── src/
│   │   ├── routes/         # Adaptadores de entrada
│   │   ├── services/       # Dominio puro
│   │   ├── workers/        # Casos de uso asíncronos
│   │   ├── integrations/   # Adaptadores de salida
│   │   └── lib/            # Utilidades
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── frontend-v2/
│   ├── src/
│   │   ├── components/     # UI Layer
│   │   ├── hooks/          # Application Layer
│   │   ├── lib/            # Infrastructure Layer
│   │   └── types/          # Domain Layer
│   └── tests/
│       ├── unit/
│       └── e2e/
└── shared/
    └── types/              # Tipos compartidos
```

### Principios de Implementación:

1. **Dominio primero**: Implementar lógica de negocio sin I/O
2. **Tests realistas**: Usar Supabase Test, no mocks profundos
3. **SSOT obligatorio**: Cargar configuración, nunca hardcodear
4. **Workers idempotentes**: Reintentables sin side effects duplicados
5. **Arquitectura limpia**: Dependencias apuntan hacia el dominio

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 1)
- SSOT: `docs/SSOT/roastr-ssot-v2.md`
- Reglas V2: `docs/REGLAS-V2-MEJORADAS.md`
