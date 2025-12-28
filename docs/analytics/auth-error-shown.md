# Auth Error Shown (V2) — Analytics Event

**Issue:** ROA-405  
**Owner:** Frontend (wiring fuera de alcance)  
**Estado:** ✅ Definido (sin wiring)

---

## 📌 Evento

- **Event name:** `auth_error_shown`
- **Trigger:** cuando un error de Auth se presenta al usuario (UI)
- **Fuente:** frontend

---

## ✅ Properties (contrato)

| Propiedad | Tipo | Descripción |
|---|---|---|
| `error_slug` | string | Slug estable del error (ej. `AUTH_INVALID_CREDENTIALS`) |
| `category` | string | `auth` \| `authz` \| `session` \| `token` \| `account` \| `policy` |
| `retryable` | boolean | Si el error es retryable (explícito) |
| `flow` | string | `login` \| `register` \| `recovery` |
| `provider` | string | `supabase` |
| `feature_flag_state` | object | Snapshot de flags relevantes (sin PII) |

---

## 🧩 Notas de implementación

- El frontend **no debe inferir** `retryable` ni `category` por HTTP status.
- El backend **no debe** enviar mensajes técnicos ni errores crudos; solo `{ slug, retryable }` + `request_id`.

