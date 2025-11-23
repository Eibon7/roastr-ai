# Supabase JWT Secret Setup

## Problema Actual

Los tests multi-tenant RLS están fallando con error `bad_jwt` porque el `JWT_SECRET` en `.env` no es el correcto para firmar tokens de Supabase.

## Cómo Obtener el JWT Secret Correcto

### Opción 1: Dashboard de Supabase (Recomendado)

1. Ir a: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/settings/api
2. En la sección **"JWT Settings"**, encontrarás:
   - **JWT Secret**: Es una cadena larga (generalmente 64+ caracteres)
   - Copiar el valor completo
3. Actualizar `.env`:
   ```bash
   JWT_SECRET=<el-jwt-secret-que-copiaste>
   ```

### Opción 2: Vía CLI

```bash
export SUPABASE_ACCESS_TOKEN="sbp_bfb43b4eca4d129c6567c7efb43ceaecea2e6cc5"
supabase projects api-keys --project-ref rpkhiemljhncddmhrilk
```

## Verificación

Una vez actualizado el `.env`, ejecutar:

```bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ sub: 'test', role: 'authenticated' }, process.env.JWT_SECRET);
console.log('JWT Token:', token);
"
```

Si genera un token sin errores, el secret es correcto.

## Testing Multi-Tenant RLS

Después de configurar el JWT secret correcto:

```bash
npm test -- tests/integration/multi-tenant-rls-issue-412.test.js
```

Deberías ver:

- ✅ Session set correctamente
- ✅ RLS policies funcionando
- ✅ Todos los tests pasando
