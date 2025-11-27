# Progreso de Conexión de APIs

**Fecha:** 2025-11-26  
**Status:** En progreso

## ✅ Completado

### API Client Actualizado

- ✅ Manejo de CSRF tokens (cookies + headers)
- ✅ Credentials incluidos para cookies
- ✅ Métodos de admin API agregados
- ✅ Manejo de errores mejorado

## 🔄 En Progreso

### Páginas por Conectar

1. **Users Page** - En progreso
   - GET /api/admin/users ✅
   - POST /api/admin/users/:id/toggle-admin ⏸️
   - POST /api/admin/users/:id/toggle-active ⏸️
   - PATCH /api/admin/users/:id/plan ⏸️
   - DELETE user ⏸️

2. **Feature Flags Page** - Pendiente
   - GET /api/admin/feature-flags ⏸️
   - PUT /api/admin/feature-flags/:key ⏸️

3. **Plans Page** - Pendiente
   - GET /api/admin/plans ⏸️
   - PUT /api/admin/plans/:planId ⏸️

4. **Metrics Page** - Pendiente
   - GET /api/admin/dashboard ⏸️

5. **Tones Page** - Pendiente
   - GET /api/admin/tones ⏸️
   - PUT /api/admin/tones/:id ⏸️

## 📝 Notas

- Los endpoints del backend están bien documentados en `src/routes/admin.js`
- CSRF protection está activo, el token se obtiene de cookies
- Todas las páginas tienen mocks funcionales que deben reemplazarse
