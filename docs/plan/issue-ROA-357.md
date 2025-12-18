# Plan de Implementación - ROA-357: A2 Auth Events Taxonomy v2

**Issue:** ROA-357  
**Título:** a2-auth-events-taxonomy-v2  
**Fecha:** 2025-12-07  
**Estado:** En Planificación

---

## Estado Actual

### Eventos de Autenticación Existentes (v1)

Actualmente, los eventos de autenticación están definidos de manera plana en `src/services/auditLogService.js`:

```javascript
'auth.login': { severity: 'info', description: 'User login' },
'auth.logout': { severity: 'info', description: 'User logout' },
'auth.reset_request': { severity: 'warning', description: 'Password reset requested' },
'auth.reset_complete': { severity: 'info', description: 'Password reset completed' },
'auth.failed_login': { severity: 'warning', description: 'Failed login attempt' },
```

### Problemas Identificados

1. **Estructura plana**: No hay categorización jerárquica
2. **Eventos faltantes**: Faltan eventos importantes como:
   - Signup/registro
   - Magic link (login y signup)
   - Verificación de email
   - Cambio de contraseña
   - Sesión expirada
   - Token refresh
   - OAuth flows
3. **Falta documentación**: No hay documentación clara de la taxonomía
4. **No alineado con v2**: No sigue la estructura del sistema v2

---

## Objetivos

1. Crear una taxonomía v2 estructurada y jerárquica para eventos de autenticación
2. Añadir eventos faltantes según el sistema de autenticación actual
3. Documentar la taxonomía en el nodo GDD de autenticación
4. Mantener compatibilidad hacia atrás con eventos v1 existentes
5. Alinear con SSOT v2 y system-map-v2

---

## Pasos de Implementación

### Paso 1: Definir Taxonomía v2

Crear estructura jerárquica de eventos:

```
auth/
├── session/
│   ├── login/
│   │   ├── success
│   │   ├── failed
│   │   └── blocked
│   ├── logout/
│   │   ├── manual
│   │   └── automatic
│   └── refresh/
│       ├── success
│       └── failed
├── registration/
│   ├── signup/
│   │   ├── success
│   │   └── failed
│   └── email_verification/
│       ├── sent
│       ├── verified
│       └── expired
├── password/
│   ├── reset/
│   │   ├── requested
│   │   ├── completed
│   │   └── failed
│   └── change/
│       ├── success
│       └── failed
├── magic_link/
│   ├── login/
│   │   ├── sent
│   │   ├── used
│   │   └── expired
│   └── signup/
│       ├── sent
│       ├── used
│       └── expired
└── oauth/
    ├── initiated
    ├── callback/
    │   ├── success
    │   └── failed
    └── token_refresh/
        ├── success
        └── failed
```

### Paso 2: Crear Módulo de Taxonomía

Crear `src/config/authEventsTaxonomy.js` con:
- Definición completa de la taxonomía v2
- Mapeo de eventos v1 → v2 (para compatibilidad)
- Helpers para construir IDs de eventos jerárquicos
- Validación de eventos

### Paso 3: Actualizar AuditLogService

- Añadir soporte para eventos v2
- Mantener compatibilidad con eventos v1
- Añadir eventos faltantes
- Actualizar métodos helper

### Paso 4: Actualizar Nodo GDD

Actualizar `docs/nodes-v2/02-autenticacion-usuarios.md` con:
- Sección de taxonomía de eventos v2
- Documentación de cada categoría
- Ejemplos de uso
- Mapeo v1 → v2

### Paso 5: Tests

- Tests unitarios para la taxonomía
- Tests de compatibilidad v1 → v2
- Tests de integración para nuevos eventos

---

## Archivos Afectados

1. `src/config/authEventsTaxonomy.js` (nuevo)
2. `src/services/auditLogService.js` (modificar)
3. `docs/nodes-v2/02-autenticacion-usuarios.md` (actualizar)
4. `tests/unit/config/authEventsTaxonomy.test.js` (nuevo)
5. `tests/unit/services/auditLogService.test.js` (actualizar)

---

## Validación Requerida

1. ✅ Todos los eventos v1 siguen funcionando
2. ✅ Nuevos eventos v2 funcionan correctamente
3. ✅ Documentación actualizada en nodo GDD
4. ✅ Tests pasando (cobertura >= 85%)
5. ✅ Validación de paths v2 pasa
6. ✅ Validación SSOT pasa

---

## Agentes Relevantes

- **Back-end Dev**: Implementación de la taxonomía y actualización de servicios
- **Test Engineer**: Tests unitarios e integración
- **Documentation Agent**: Actualización de nodo GDD

---

## Notas

- Mantener compatibilidad hacia atrás es crítico
- La taxonomía v2 debe ser extensible para futuros eventos
- Alinear con SSOT v2 y system-map-v2
- No romper código existente que usa eventos v1

