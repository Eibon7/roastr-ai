# GDD Nodes v2 — Roastr

**Version:** 2.0  
**Status:** ✅ Active  
**Generated:** 2025-12-04  
**Total Nodes:** 15

---

## 📖 Descripción

Los **GDD Nodes v2** son la especificación técnica detallada de cada módulo de Roastr v2, generados exclusivamente desde:

- **Spec v2**: `docs/spec/roastr-spec-v2.md`
- **SSOT**: `docs/SSOT/roastr-ssot-v2.md`

Cada nodo sigue estructura de 10 secciones obligatorias:

1. Summary
2. Responsibilities
3. Inputs
4. Outputs
5. Rules
6. Dependencies
7. Edge Cases
8. Acceptance Criteria
9. Test Matrix
10. Implementation Notes

---

## 📁 Índice de Nodos

### Core Sistema (1-4):

**01. Arquitectura General** (`01-arquitectura-general.md`)

- Monorepo, arquitectura hexagonal, frontend modular, workers, SSOT

**02. Autenticación y Usuarios** (`02-autenticacion-usuarios.md`)

- Signup, login, roles, Roastr Persona cifrado, onboarding wizard

**03. Billing (Polar)** (`03-billing-polar.md`)

- Planes, trials, estados suscripción, webhooks, límites mensuales

**04. Integraciones** (`04-integraciones.md`)

- X, YouTube, OAuth, ingestión, publicación, Shield actions

---

### Motores de Decisión (5-7):

**05. Motor de Análisis** (`05-motor-analisis.md`)

- Perspective API, Roastr Persona, reincidencia, severity_score, decisiones

**06. Motor de Roasting** (`06-motor-roasting.md`)

- Tonos, prompts A/B/C, Style Validator, disclaimers IA, generación roasts

**07. Shield** (`07-shield.md`)

- Shield moderado/crítico, acciones (hide/report/block), strikes, correctivas

---

### Ejecución y Workers (8):

**08. Workers** (`08-workers.md`)

- 9 workers: Fetch, Analyze, Roast, Correctiva, Shield, Posting, Billing, Cursor, Cleanup

---

### Frontend (9-10):

**09. Panel de Usuario** (`09-panel-usuario.md`)

- Dashboard, cuentas, detalle, roasts, Shield logs, settings, billing

**10. Panel de Administración** (`10-panel-administracion.md`)

- Usuarios, impersonación, SSOT editor, métricas, DLQ, logs

---

### Sistema (11-15):

**11. Feature Flags** (`11-feature-flags.md`)

- 15 flags oficiales, SSOT, Admin Panel, enforcement

**12. GDPR y Legal** (`12-gdpr-legal.md`)

- Minimización, retención 90 días, cifrado, disclaimers, derecho olvido

**13. Testing** (`13-testing.md`)

- Vitest, Supabase Test, Playwright, cobertura mínima, CI

**14. Infraestructura** (`14-infraestructura.md`)

- CI/CD, staging/prod, aislamiento, observabilidad, backups, error budget

**15. SSOT Integration** (`15-ssot-integration.md`)

- Single Source of Truth, settings loader, enforcement, validación

---

## 🎯 Uso de Nodos

### Para Desarrollo:

1. Identificar módulo a trabajar
2. Leer nodo correspondiente
3. Verificar Rules y Dependencies
4. Implementar según Implementation Notes
5. Validar con Acceptance Criteria
6. Ejecutar tests según Test Matrix

### Para Code Review:

1. Verificar alineación con nodo
2. Validar que no hay hardcoded values (deben venir de SSOT)
3. Verificar tests según Test Matrix
4. Confirmar edge cases cubiertos

### Para Testing:

1. Consultar Test Matrix del nodo
2. Implementar tests según categoría (unit/integration/E2E)
3. Validar coverage mínima

---

## 🔗 Relación con SSOT

**REGLA DE ORO**: Si nodo GDD y SSOT discrepan → **SSOT gana**

Workflow:

1. SSOT define valores (`docs/SSOT/roastr-ssot-v2.md`)
2. Nodos GDD referencian esos valores
3. Código implementa usando valores de SSOT
4. Tests validan comportamiento usando SSOT

**NUNCA**:

- ❌ Hardcodear valores que viven en SSOT
- ❌ Inventar planes, flags, estados no en SSOT
- ❌ Usar legacy v1 (free, Stripe, SendGrid)

---

## 📊 Estadísticas

**Total Nodos**: 15  
**Total Secciones**: 150 (15 nodos × 10 secciones)  
**Fuente**: 100% desde Spec v2 + SSOT  
**Inventado**: 0%  
**Alineación SSOT**: 100%

---

## ✅ Validación

Todos los nodos han sido validados contra:

- ✅ Spec v2 completo
- ✅ SSOT completo
- ✅ Sin contradicciones
- ✅ Sin elementos inventados
- ✅ Sin referencias legacy v1

---

## 🔗 Referencias

- **SSOT**: `docs/SSOT/roastr-ssot-v2.md`
- **Spec v2**: `docs/spec/roastr-spec-v2.md`
- **Cursor Rule**: `.cursor/rules/ssot-enforcement.mdc`
- **CLAUDE.md**: Sección "SSOT — MÁXIMA PRIORIDAD"
- **Reglas V2**: `docs/REGLAS-V2-MEJORADAS.md`

---

## 📅 Próximos Pasos

1. **Implementación**: Usar nodos como guía para desarrollo
2. **Testing**: Seguir Test Matrix de cada nodo
3. **Code Review**: Validar alineación con nodos
4. **Actualización**: Mantener nodos sincronizados con SSOT
5. **Expansión**: Añadir nodos para features futuras

---

**GDD NODES v2 — COMPLETAMENTE OPERATIVOS** 🚀
