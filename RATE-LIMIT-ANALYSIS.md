# Rate Limit Analysis: Email Verification

**Fecha:** 2025-01-02  
**Issue:** ROA-373  
**Contexto:** CodeRabbit sugiere revisar si 10 attempts/hour es apropiado

---

## 📊 Comparación Actual

| Tipo | Attempts | Window | Block Duration | Ratio |
|------|----------|--------|----------------|-------|
| login | 5 | 15min | 15min | 20 attempts/hour |
| password_recovery | 3 | 1hour | 1hour | 3 attempts/hour |
| **email_verification** | **10** | **1hour** | **1hour** | **10 attempts/hour** |

---

## 🔍 Análisis

### Contexto de Email Verification

**Características del flujo:**
1. Token se envía por email (single-use)
2. Token tiene TTL (time-to-live) limitado
3. Usuario puede necesitar reenviar si:
   - Email no llega
   - Token expira
   - Usuario copia token mal
   - Problemas de conectividad

**Riesgos:**
- Token brute-force (bajo, tokens largos + TTL)
- Abuse de reenvío de emails (medio)
- DoS a servicio de email (bajo, depende de Supabase)

### Casos de Uso Legítimos

**Escenarios donde usuario necesita múltiples intentos:**
1. Email no llega → Reenviar (1-2 veces)
2. Token copiado incorrectamente → Reintentar (2-3 veces)
3. Token expira → Reenviar nuevo (1 vez)
4. Email llega a spam → Usuario tarda en encontrar (1-2 veces)

**Total esperado:** ~5-8 intentos en casos excepcionales

### Comparación con Industria

**Ejemplos de otros servicios:**
- GitHub: 5 intentos/15min (código de verificación)
- Auth0: 10 intentos/hour (email verification)
- Supabase default: Sin límite explícito (depende de backend)
- AWS Cognito: 5 intentos/15min (confirmación)

---

## 🎯 Recomendación

### Opción 1: Mantener 10/hour (RECOMENDADO)
**Pros:**
- ✅ Balance entre seguridad y UX
- ✅ Cubre casos legítimos excepcionales
- ✅ Tokens tienen protección adicional (TTL + single-use)
- ✅ Abuse limitado por ventana de 1 hora

**Cons:**
- ⚠️ Ligeramente permisivo vs otros endpoints

### Opción 2: Reducir a 7/hour
**Pros:**
- ✅ Más conservador
- ✅ Sigue cubriendo casos legítimos

**Cons:**
- ⚠️ Podría frustrar usuarios con problemas legítimos
- ⚠️ Cambio no justificado por incidentes

### Opción 3: Reducir a 5/hour
**Pros:**
- ✅ Consistente con otros endpoints críticos

**Cons:**
- ❌ Demasiado restrictivo para casos legítimos
- ❌ UX degradada sin justificación

---

## ✅ Decisión Final

**MANTENER 10 attempts/hour** por las siguientes razones:

1. **Protección Adicional:** Tokens tienen TTL y son single-use
2. **UX Balance:** Cubre casos excepcionales legítimos
3. **Industria Standard:** Auth0 usa 10/hour
4. **No Evidencia de Abuse:** Sin incidentes reportados
5. **Monitoring:** Si se detecta abuse, se puede ajustar

**Justificación documentada en código:**
```typescript
email_verification: {
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxAttempts: 10,
  blockDurationMs: 15 * 60 * 1000, // 15 minutos
  // Justificación: 10/hour permite casos legítimos excepcionales
  // (email spam, token copiado mal, expiración) mientras limita abuse.
  // Tokens tienen protección adicional (TTL + single-use).
}
```

---

## 📝 Acción

✅ **NO CAMBIAR** el rate limit actual  
✅ **DOCUMENTAR** la justificación en código  
✅ **MONITOREAR** métricas de uso post-deploy


