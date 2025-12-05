# GDD Node — GDPR y Legal v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Marco legal que garantiza cumplimiento GDPR, minimización de datos, retención limitada (90 días), cifrado de datos sensibles, transparencia con disclaimers IA, derecho al olvido, analítica cookieless, y protección de menores apoyándose en controles de plataformas.

---

## 2. Responsibilities

### Funcionales:

- Minimización: solo datos necesarios
- Retención limitada: 90 días máx (usuarios eliminados, ofensores, logs)
- Cifrado: Roastr Persona (AES-256-GCM)
- Transparencia: disclaimers IA obligatorios (auto-approve ON + UE)
- Derecho al olvido: eliminación inmediata de cuenta
- Analítica cookieless (sin tracking individual)
- Protección menores: apoyarse en controles plataforma

### No Funcionales:

- Seguridad: cifrado con rotación de claves
- Auditoría: logs sin texto crudo
- Legal: base Art. 6.1.b (contrato), 6.1.f (interés legítimo), 6.1.c (cumplimiento)
- Privacidad: no venta de datos, no profiling

---

## 3. Inputs

- Comentarios públicos de redes sociales
- Roastr Persona del usuario
- Configuraciones de cuenta
- Decisiones de análisis (scores, no textos)
- Eventos de billing

---

## 4. Outputs

- Datos almacenados (mínimos, cifrados si sensibles)
- Logs estructurados (sin texto crudo)
- Disclaimers IA en roasts autopublicados
- Exportación de datos (derecho acceso)
- Purgas automáticas tras 90 días

---

## 5. Rules

### Principios GDPR:

1. **Minimización**: solo datos necesarios para operar
2. **Limitación retención**: no guardar más allá de lo necesario
3. **Cifrado**: datos sensibles cifrados (AES-256-GCM)
4. **Transparencia**: disclaimers IA cuando lo exige normativa
5. **Control usuario**: descargar, modificar, eliminar datos
6. **Prohibición venta**: no compartir con terceros para publicidad
7. **Cookieless**: sin cookies de tracking
8. **Ejecución basada en plataforma**: apoyarse en controles edad de redes

### Datos que SÍ Guardamos:

**1. Identificación básica**:

- email, user_id, idioma, plan, estado billing, timestamps

**Base legal para el procesamiento (GDPR)**:

- **Art. 6.1.b** — Ejecución de contrato (funcionamiento de Roastr)
- **Art. 6.1.f** — Interés legítimo (seguridad, anti-abuso, prevención acoso)
- **Art. 6.1.c** — Cumplimiento normativo (DSA/AI Act cuando aplica)

Nunca se usa Art. 6.1.a (consentimiento) para funcionalidades esenciales.

**2. Cuentas conectadas**:

- handle, id red social
- **Tokens OAuth**:
  - almacenados cifrados con AES-256-GCM
  - con rotación de claves
  - sin posibilidad de lectura por ningún empleado
- Configuraciones: auto-approve, tono, shield aggressiveness

**3. Roastr Persona** (cifrado AES-256-GCM):

- Lo que me define
- Líneas rojas
- Lo que me da igual
- **Equipo NO puede leer estos datos**

**4. Logs mínimos** (sin texto crudo):

- Severity score
- Bucket (normal/correctiva/roast/shield)
- Acción ejecutada
- Timestamp
- Plataforma

**5. Reincidencia**:

- offender_id, strike_level, timestamps
- **Auto-purga: 90 días**

**6. Roasts publicados** (solo si usuario publica):

- Texto final roast
- `is_ai_generated` (boolean)
- Link plataforma
- Timestamp
- ❌ NO versiones descartadas

### Datos que NO Guardamos:

❌ **PROHIBIDO almacenar**:

- Textos crudos de comentarios ajenos
- Imágenes, vídeos, contenido multimedia
- Historiales completos de edición
- Mensajes privados
- Perfiles psicológicos o embeddings
- Identificadores personales innecesarios

**NO guardamos ningún contenido generado por IA que**:

- NO haya sido publicado por el usuario
- haya sido descartado
- haya sido bloqueado por Style Validator
- forme parte de variantes o regeneraciones

**SÍ guardamos**:

- el roast final publicado por el usuario
- el corrective_reply publicado por el usuario
- `is_ai_generated` = true/false
- link + timestamp

**Razón legal**: el contenido publicado forma parte del registro de actividad del usuario.

**Validación automática**: Si sistema intenta guardar contenido crudo → **bloqueo + alerta**

**Validación anti-texto-crudo**:

Si cualquier worker, servicio o ruta intenta:

- almacenar texto crudo,
- loggear contenido sin sanitizar,
- almacenar prompts o contenido de IA,

→ Se bloquea la operación automáticamente  
→ Se genera alerta en admin_logs  
→ Se clasifica como "gdpr_violation_blocked"

### Retención:

```
Reincidencia ofensor → 90 días → purga
Cuenta eliminada → 90 días retención → purga total
Historial operativo → 90 días → purga
Roastr Persona → eliminación inmediata al borrar cuenta
Datos facturación → solo lo requerido por Polar
```

**Roasts publicados**: se conservan 90 días por motivos de auditoría técnica y seguridad.

Tras ese periodo:

- se purgan completamente
- no queda historial accesible

Si cancela pero no elimina:

- Estado "cuenta congelada"
- Retención: 90 días
- Si reactiva → recupera todo
- Si no → purga completa

### Analítica Cookieless:

**Analítica cookieless**:

- Se usa Amplitude en modo identityless.
- NO se crean identificadores persistentes.
- NO se vinculan eventos a usuarios individuales.
- NO se genera fingerprinting.
- NO se cruza información con datos de billing.

**Resultado**: NO requiere banner de cookies ni consentimiento previo.

### Derecho al Olvido:

Usuario puede solicitar **eliminación inmediata**:

- Roastr Persona → borrado permanente
- Configuración → borrada
- Cuentas conectadas → borradas
- Tokens OAuth → eliminados
- Historial roasts → borrado
- Logs relacionados → borrados

**No reversible** una vez finalizado.

Polar/Stripe mantienen mínimo legal fiscal, pero Roastr no ve esos datos.

### Disclaimers IA:

**Obligatorios cuando**:

- `autoApprove === true`
- Región bajo DSA/AI Act (UE)

**NO obligatorios cuando**:

- Usuario aprueba manualmente

**Pool configurable** (SSOT):

```typescript
type DisclaimerPool = {
  tone: RoastTone | 'corrective';
  variants: string[]; // 3-5 por tono
};
```

Archivo dedicado: `ssot-disclaimers.yaml` (nunca inventados on-the-fly)

**SSOT Legal**:

Todos los textos legales — disclaimers, copys educativos, mensajes del Wizard e información para el usuario — deben residir en el SSOT y NO en el código.

**Queda prohibido**:

- inventar disclaimers on the fly
- hardcodear textos legales

**La fuente única es**: `ssot-disclaimers.yaml` + `admin_settings.legal_texts`

Ejemplos:

- "Publicado automáticamente con ayuda de IA"
- "Generado automáticamente por IA"
- "Tu asistente digital te cubrió las espaldas"
- "Moderación automática con un toque de IA 🤖✨"

### Shield-Only Mode:

Si red **prohíbe mensajes generados por IA**:

- Roasts desactivados
- Shield sigue funcionando
- UI roasts oculta
- Banner: "Esta plataforma no permite publicaciones asistidas por IA. Roastr funcionará en modo protección (Shield)."

Configurado en SSOT → `supported_platforms`:

- `FULL_SUPPORT`
- `SHIELD_ONLY`
- `UNSUPPORTED`

### Menores de Edad:

**Política oficial**:

Roastr no está diseñado para menores de 13 años.

Roastr no realiza verificación activa de edad.  
La responsabilidad del control de edad recae en las plataformas conectadas (X, YouTube).

**Usuarios entre 13 y 16 años**:

- pueden usar Roastr si su acceso a la red social es válido
- Roastr no almacena ningún dato sensible adicional
- Roastr ayuda a protegerles frente a acoso online

**Roastr no infiere, estima ni clasifica edad mediante IA o análisis de comportamiento.**  
Toda validación depende exclusivamente del acceso permitido por la red social conectada.

Si en el futuro se integran redes específicas para menores:

- se respetarán las restricciones de cada plataforma
- solo se procesará contenido público
- nunca se almacenará contenido privado de menores

### Carta de Seguridad Interna:

1. Cifrado AES-256-GCM para Persona + rotación claves
2. Ningún texto crudo en logs/backups
3. Validación anti-texto-crudo antes de persistir
4. SSOT para copys legales/disclaimers
5. AI autopost siempre marcado `is_ai_generated`
6. Retención estricta GDPR
7. Auditoría automática DLQ, strikes, Shield, logs
8. Analítica cookieless únicamente
9. Revocación inmediata claves al eliminar cuenta

---

## 6. Dependencies

### Servicios:

- **Supabase**: Cifrado Persona, RLS
- **SSOT**: Disclaimers pool, retention policies

### Tablas:

- `profiles.roastr_persona_config` (cifrado)
- `offenders` (purga 90 días)
- `shield_logs` (purga 90 días)
- `roasts` (purga 90 días si cuenta eliminada)

### Nodos Relacionados:

- `02-autenticacion-usuarios.md` (Roastr Persona)
- `05-motor-analisis.md` (Uso Persona sin exponerla)
- `06-motor-roasting.md` (Disclaimers IA)
- `08-workers.md` (Logs sin texto crudo)

---

## 7. Edge Cases

1. **Usuario elimina cuenta**:
   - Persona borrado inmediato
   - Otros datos: retención 90 días
   - Purga total después

2. **Ofensor con strikes > 90 días**:
   - Auto-purga (worker StrikeCleanup)
   - No considerado reincidente

3. **Intento loggear texto crudo**:
   - Bloqueo automático
   - Alerta + log: "log_blocked_sensitive_content"

4. **Usuario solicita datos**:
   - Exportación completa
   - Formato JSON
   - Sin incluir datos de terceros (ofensores)

5. **Menor < 13 años intenta usar**:
   - Apoyarse en validación de red social
   - No verificación adicional en Roastr

6. **Red social no permite IA**:
   - Shield-Only Mode automático
   - Roasts desactivados
   - Banner claro

7. **Región sin DSA/AI Act**:
   - Disclaimers opcionales
   - Flag controla visibilidad

8. **Persona con contenido ofensivo**:
   - Validación pre-guardado
   - Rechazo si contiene insultos/ataques

---

## 8. Acceptance Criteria

### Datos Almacenados:

- [ ] Solo identificación básica necesaria
- [ ] Roastr Persona cifrado (AES-256-GCM)
- [ ] Logs sin texto crudo
- [ ] Tokens OAuth cifrados (AES-256-GCM + rotación)
- [ ] Base legal: Art. 6.1.b, 6.1.f, 6.1.c (no consentimiento para esenciales)

### Datos NO Almacenados:

- [ ] ❌ NO textos crudos comentarios
- [ ] ❌ NO imágenes/vídeos
- [ ] ❌ NO historiales edición completos
- [ ] ❌ NO mensajes privados
- [ ] ❌ NO embeddings usuario
- [ ] ❌ NO prompts completos

### Retención:

- [ ] Ofensores: 90 días → purga
- [ ] Logs: 90 días → purga
- [ ] Cuenta eliminada: 90 días → purga total
- [ ] Persona: borrado inmediato
- [ ] Worker StrikeCleanup ejecuta purga diaria

### Disclaimers:

- [ ] Obligatorio si auto-approve ON + UE
- [ ] Pool configurable (SSOT)
- [ ] 3-5 variantes por tono
- [ ] NO obligatorio si aprobación manual
- [ ] Nunca inventados on-the-fly

### Derecho Olvido:

- [ ] Usuario puede eliminar cuenta
- [ ] Persona borrado inmediato
- [ ] Otros datos: retención 90 días
- [ ] Purga total tras retención
- [ ] No reversible

### Analítica:

- [ ] Cookieless (Amplitude identityless)
- [ ] NO tracking personal
- [ ] NO perfilado individual
- [ ] NO requiere banner cookies

### Shield-Only Mode:

- [ ] Configurable por plataforma (SSOT)
- [ ] Roasts desactivados si red prohíbe IA
- [ ] Shield sigue funcionando
- [ ] Banner claro en UI

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Cifrado/descifrado Persona
- ✅ Validación disclaimers
- ✅ Cálculo retention_until
- ❌ NO testear: Supabase RLS

### Integration Tests (Supabase Test):

- ✅ Guardar Persona → cifrado correcto
- ✅ Leer Persona → descifrado correcto
- ✅ Eliminar cuenta → Persona borrado inmediato
- ✅ Strike > 90 días → purga automática
- ✅ Intento loggear texto → bloqueado
- ✅ Exportar datos usuario
- ✅ Shield-Only mode → roasts desactivados

### E2E Tests (Playwright):

- ✅ Configurar Persona → guardado cifrado
- ✅ Auto-approve ON → disclaimer visible
- ✅ Aprobación manual → sin disclaimer automático
- ✅ Eliminar cuenta → confirmación → datos borrados
- ✅ Descargar datos → JSON descargado

---

## 10. Implementation Notes

### Cifrado Persona:

```typescript
// apps/backend-v2/src/services/personaEncryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.PERSONA_ENCRYPTION_KEY!, 'hex');

export function encryptPersona(persona: PersonaProfile): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([cipher.update(JSON.stringify(persona), 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted: encrypted.toString('hex'),
    authTag: authTag.toString('hex')
  });
}

export function decryptPersona(encrypted: string): PersonaProfile {
  const { iv, encrypted: data, authTag } = JSON.parse(encrypted);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}
```

### Purga Automática:

```typescript
// apps/backend-v2/src/workers/StrikeCleanupWorker.ts

export class StrikeCleanupWorker {
  async process(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Purgar strikes
    await supabase.from('offenders').delete().lt('created_at', cutoffDate.toISOString());

    logger.info('strike_cleanup_completed', { cutoffDate });
  }
}
```

### Validación Anti-Texto-Crudo:

```typescript
// apps/backend-v2/src/utils/gdprValidator.ts

export function validateLogPayload(payload: any): void {
  const sensitiveFields = ['text', 'comment_text', 'roast_text', 'prompt', 'message'];

  for (const field of sensitiveFields) {
    if (field in payload) {
      logger.error('log_blocked_sensitive_content', { field });
      throw new Error(`GDPR violation: cannot log ${field}`);
    }
  }
}
```

### Disclaimers:

```typescript
// apps/backend-v2/src/services/disclaimerService.ts

export function selectDisclaimer(
  tone: RoastTone | 'corrective',
  autoApprove: boolean,
  region: string
): string | null {
  // No disclaimer si aprobación manual
  if (!autoApprove) return null;

  // No disclaimer si región no requiere
  if (!requiresDisclaimer(region)) return null;

  // Cargar pool desde SSOT
  const pool = getDisclaimerPool(tone);

  // Selección aleatoria
  return pool[Math.floor(Math.random() * pool.length)];
}

function requiresDisclaimer(region: string): boolean {
  // Load regions requiring disclaimers from SSOT (centralized, auditable)
  const regionsRequiringDisclaimers = getRegionsRequiringDisclaimersFromSSOT();
  return regionsRequiringDisclaimers.includes(region);
}

// Helper: Load legal regions from SSOT (similar pattern to getDisclaimerPool)
function getRegionsRequiringDisclaimersFromSSOT(): string[] {
  // Load from admin_settings.legal_regions or equivalent SSOT key
  // Fallback to empty array if SSOT unavailable (safe default: no disclaimers)
  // Example SSOT structure:
  // {
  //   "legal_regions": {
  //     "disclaimer_required": ["ES", "FR", "DE", "IT", ... (EU/EEA)]
  //   }
  // }
  return getLegalRegionsFromConfig('disclaimer_required') ?? [];
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 12)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 9, 6.4)
- GDPR: https://gdpr.eu/
