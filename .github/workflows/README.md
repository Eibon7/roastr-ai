# Workflows

## supabase-keepalive.yml

Evita que Supabase pause los proyectos del plan gratuito por inactividad,
haciendo una petición HTTP real a `/rest/v1/` de cada proyecto cada 2 días.

**Proyectos:**
- Roastr prod (`rpkhiemljhncddmhrilk`)
- Roastr Staging (`bhtkzhgrcjxfweblbfjv`)

**Secrets necesarios** (Settings → Secrets and variables → Actions):
- `SUPABASE_PROD_ANON_KEY`
- `SUPABASE_STAGING_ANON_KEY`

Son las claves anon/publishable de cada proyecto (públicas por diseño, pero
guardadas como secret para poder rotarlas sin tocar el workflow).

**Comportamiento:**
- Un `200` o `404` en `/rest/v1/` cuenta como éxito (el proyecto respondió).
- Cualquier otro código o timeout hace un reintento único esperando 90s
  (por si el proyecto estaba pausado y está despertando).
- Si tras el reintento sigue fallando, el job termina en rojo y llega el
  email de notificación de GitHub Actions.
- Los dos proyectos se comprueban de forma independiente: un fallo en uno no
  impide comprobar el otro.

**Lanzarlo a mano:** pestaña Actions → "Supabase Keepalive" → Run workflow.
