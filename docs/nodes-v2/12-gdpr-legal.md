# GDD Node — GDPR y Legal v2

---
version: "2.0"
node_id: gdpr-and-legal
status: production
priority: critical
owner: Product Owner
last_updated: 2025-12-05
coverage: 0
coverage_source: auto
ssot_references:
  - gdpr_algorithms
  - gdpr_allowed_log_structure
  - gdpr_automatic_blocking
  - gdpr_cleanup_algorithm
  - gdpr_forbidden_data
  - gdpr_retention
subnodes:
  - gdpr-retention
---


**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

Este nodo depende de los siguientes nodos:

- Ninguna dependencia directa

---

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

## 11. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `gdpr_algorithms` - Algoritmos de detección y limpieza GDPR
- `gdpr_allowed_log_structure` - Estructura permitida de logs
- `gdpr_automatic_blocking` - Reglas de bloqueo automático
- `gdpr_cleanup_algorithm` - Algoritmo de limpieza de datos
- `gdpr_forbidden_data` - Datos prohibidos de registrar
- `gdpr_retention` - Reglas de retención de datos

---

## 12. Related Nodes

- TBD — No documented relationships in SSOT/Spec

---
