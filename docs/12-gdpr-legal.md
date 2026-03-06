# 12. GDPR y Legal (v3)

*(Versión actualizada para Shield-first)*

---

## 12.1 Principios legales

Roastr opera bajo GDPR europeo y normativa DSA/AI Act:

1. **Minimización** — Solo datos necesarios para operar la plataforma.
2. **Limitación de retención** — Nada más allá del plazo estrictamente necesario.
3. **Cifrado** — Configuración personal sensible cifrada (AES-256-GCM).
4. **Transparencia** — Mensajes autopublicados llevan señalización IA cuando lo exige la normativa.
5. **Control por el usuario** — Puede descargar, modificar o eliminar sus datos.
6. **Prohibición de venta** — No compartimos datos con terceros para publicidad.
7. **Cookieless** — Sin cookies de tracking.
8. **Plataforma-dependiente** — Roastr se apoya en los controles de edad y compliance de cada red social.

---

## 12.2 Datos que almacenamos

### Identificación del usuario

| Dato | Justificación GDPR |
|---|---|
| Email | Art. 6.1.b — necesidad contractual |
| user_id (UUID) | Art. 6.1.b — identificación interna |
| Idioma preferido | Art. 6.1.b — prestación del servicio |
| Plan activo + billing state | Art. 6.1.b — gestión de suscripción |
| Timestamps (alta, última actividad) | Art. 6.1.b — operación del servicio |

### Cuentas conectadas

- Handle y platform_user_id
- Tokens OAuth (**cifrados** AES-256-GCM)
- Configuración: auto-approve, tono, shield aggressiveness
- Cursors de ingestión

### Roastr Persona (cifrado)

- Lo que me define / Líneas rojas / Lo que me da igual
- Cifrado AES-256-GCM con rotación de claves
- **El equipo no puede leer estos datos**
- Eliminación inmediata al borrar cuenta

### Logs (solo metadatos)

- severity_score
- decision (no_action / correctiva / eligible_for_response / shield_moderado / shield_critico)
- action_taken (hide / block / report / strike1 / strike1_silent)
- timestamp, plataforma, account_id
- **NUNCA texto del comentario**

### Reincidencia (ofensores)

- offender_id (ID externo de la plataforma)
- strike_level (0, 1, 2, critical)
- Timestamps
- Auto-purga a los **90 días**

---

## 12.3 Datos que NO almacenamos

- Textos crudos de comentarios ajenos
- Imágenes, vídeos o contenido multimedia
- Mensajes privados
- Perfiles psicológicos o embeddings del usuario
- Contenido completo de prompts enviados al LLM
- Respuestas completas del LLM (solo se envían a la plataforma y se descartan)
- Versiones descartadas de roasts

Si cualquier sistema intenta persistir contenido crudo → **bloqueo automático** + log `log_blocked_sensitive_content`.

---

## 12.4 Retención

| Dato | Retención | Acción tras expiración |
|---|---|---|
| Reincidencia (strikes) | 90 días | Auto-purga (StrikeCleanup worker) |
| Shield logs | 90 días | Purga |
| Historial de roasts (metadata) | 90 días | Purga |
| Cuenta desconectada | 90 días | Purga completa de datos vinculados |
| Cuenta eliminada | 90 días | Purga total irreversible |
| Roastr Persona | Eliminación inmediata al borrar cuenta | — |
| Billing data | Lo requerido por Polar / ley fiscal | Gestionado por Polar |

### Cuenta cancelada (no eliminada)

- Estado → `paused` (congelada)
- Retención máxima: 90 días
- Si reactiva dentro de 90 días → recupera datos
- Si no → purga completa automática

---

## 12.5 Analítica

Roastr usa analítica **cookieless**:

- Sin cookies de tracking
- Sin perfilado individual
- Sin telemetría identificable en el cliente
- Métricas agregadas server-side únicamente

**No se requiere banner de cookies.**

---

## 12.6 Derecho al olvido

El usuario puede solicitar eliminación desde `/settings/profile`:

**Se elimina:**

- Roastr Persona (borrado permanente inmediato)
- Configuración y preferencias
- Cuentas conectadas
- Tokens OAuth (borrado del cifrado)
- Historial de shield_logs
- Historial de roasts (metadata)
- Strikes asociados

**No reversible** una vez completado.

Polar mantiene lo mínimo requerido por ley fiscal (facturas), pero Roastr no accede a esos datos post-eliminación.

### Implementación

```sql
-- Soft delete: marca para purga
UPDATE profiles SET deleted_at = now() WHERE id = :user_id;

-- Immediate actions:
DELETE FROM accounts WHERE user_id = :user_id;  -- tokens included
UPDATE profiles SET roastr_persona_config = NULL WHERE id = :user_id;

-- Deferred purge (90 days via maintenance worker):
DELETE FROM shield_logs WHERE user_id = :user_id AND created_at < now() - interval '90 days';
DELETE FROM offenders WHERE user_id = :user_id;
DELETE FROM roast_candidates WHERE user_id = :user_id;
DELETE FROM profiles WHERE id = :user_id AND deleted_at < now() - interval '90 days';
```

---

## 12.7 Consentimiento y uso de IA

El onboarding informa que:

- Roastr analiza comentarios públicos de las cuentas conectadas
- Puede publicar en nombre del usuario si auto-approve está ON
- Utiliza modelos de IA externos (Perspective API, OpenAI)
- Los roasts autopublicados llevan señalización IA

Textos legales (consent, ToS, disclaimers) vienen del SSOT (`admin_settings`).

---

## 12.8 Señalización IA (DSA / AI Act)

### Obligatoria cuando

- `autoApprove = true` (publicación automática)
- Región del usuario bajo DSA / AI Act (UE)

### NO obligatoria cuando

- El usuario aprueba manualmente (`autoApprove = false`)

### Implementación

Pool de disclaimers configurables en SSOT:

- "Publicado automáticamente con ayuda de IA"
- "Generado automáticamente por IA"
- "Respuesta generada por Roastr.ai (IA)"

Se selecciona aleatoriamente. Pool ampliable sin deploy.

---

## 12.9 Shield-Only Mode por plataforma

Si una plataforma prohíbe publicaciones automatizadas por IA o no soporta replies:

El sistema activa **Shield-Only Mode**:

- Roasts desactivados para esa plataforma
- Shield sigue funcionando (hide/block/report)
- UI de roasts oculta para esa cuenta
- Banner:
  > "Esta plataforma no permite publicaciones asistidas por IA. Roastr funcionará en modo protección (Shield)."

Configurado via `PlatformCapabilities.canReply` (§4.1) y SSOT.

---

## 12.10 Menores de edad

Roastr **no verifica edad**:

- Depende del acceso a redes sociales ya reguladas
- No proporciona contenido adulto
- No realiza perfilado
- No maneja datos sensibles de menores

### Política

> Roastr no está diseñado para menores de 13 años. Los usuarios entre 13 y 16 años deben cumplir las condiciones de edad de las redes conectadas. Roastr no verifica edad y se apoya en los controles de las plataformas. Roastr puede ser usado para proteger a usuarios jóvenes frente al acoso online.

---

## 12.11 Requisitos técnicos de seguridad

1. Cifrado AES-256-GCM para Roastr Persona + rotación de claves
2. Ningún texto crudo en logs, DLQ ni backups
3. Validación anti-texto-crudo antes de persistir cualquier log
4. SSOT para todos los textos legales y disclaimers
5. Autopost siempre marcado como `is_ai_generated`
6. Retención estricta según reglas GDPR (90 días max)
7. Analítica cookieless
8. Revocación inmediata de claves y tokens al eliminar cuenta
9. Workers nunca almacenan texto de comentarios (solo en memoria temporal)

---

## 12.12 Dependencias

- **Supabase:** RLS para aislamiento de datos por usuario. Cifrado en reposo.
- **Polar:** Gestión de datos fiscales (facturas) — fuera del scope de Roastr post-eliminación.
- **Shield (§7):** shield_logs sin texto de comentario.
- **Workers (§8):** DLQ sin datos personales. Logs sin texto crudo.
- **SSOT:** Disclaimers, textos legales, retención policies.
