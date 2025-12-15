# Amplitude Analytics - Roastr.AI (V2-ready)

## 📊 Descripción

Amplitude Analytics está integrado en la aplicación Roastr.AI para rastrear interacciones de usuarios y métricas clave de producto.

Este documento refleja las convenciones V2 y las decisiones de gobernanza para analytics.

## ✅ Estado de Implementación

- **✅ Instalado**: SDK `@amplitude/unified`
- **✅ Inicializado**: Se inicializa automáticamente al cargar la aplicación
- **✅ Configurado**: Servidor EU (GDPR compliant) + Autocapture habilitado
- **✅ Testeado**: Tests unitarios con cobertura completa
- **✅ V2-ready**: Variables de entorno + snake_case events + session replay condicional

## 🔧 Configuración

### API Key (Variables de Entorno)

**⚠️ IMPORTANTE**: La API key ya NO está hardcodeada. Se carga desde variables de entorno.

**Setup:**

1. Copia `.env.example` a `.env` en el directorio `frontend/`:
   ```bash
   cp .env.example .env
   ```

2. Añade tu API key de Amplitude:
   ```env
   VITE_AMPLITUDE_API_KEY=your_amplitude_api_key_here
   ```

3. Obtén tu API key desde: https://analytics.amplitude.com/

**Comportamiento sin API key:**
- Si `VITE_AMPLITUDE_API_KEY` no está definida, Amplitude NO se inicializa.
- Se muestra un warning en consola (desarrollo).
- La aplicación sigue funcionando normalmente (no rompe).

### Configuración

- **Server Zone**: EU (para cumplimiento GDPR)
- **Autocapture**: Habilitado en TODAS las pantallas (incluyendo auth)
- **Session Replay**: Habilitado globalmente (seguro porque autocapture NO captura valores de inputs)

### Inicialización

La inicialización se realiza automáticamente en `src/main.tsx`:

```typescript
import { initializeAmplitude } from './lib/analytics';

// Se ejecuta antes de renderizar la aplicación
initializeAmplitude();
```

**Session Replay y Autocapture:**

Session replay y autocapture están **habilitados globalmente**, incluyendo en pantallas de auth.

**¿Por qué es seguro?**

1. **Autocapture NO captura valores de inputs**:
   - Solo rastrea eventos (clicks, form submissions)
   - NO captura contraseñas, emails, ni datos sensibles
   - Es GDPR compliant

2. **Diagnóstico de fricción**:
   - Permite identificar problemas en flujos críticos (login, registro)
   - Útil para debugging de magic link, OAuth, etc.

3. **Cumplimiento de privacidad**:
   - Solo eventos de interacción, no PII (Personal Identifiable Information)
   - Datos almacenados en servidores EU (GDPR)

**Decisión V2:**
Después de investigación técnica, determinamos que session replay con autocapture es seguro en auth screens porque:
- Amplitude autocapture está diseñado para NO capturar input values
- Beneficio de diagnóstico supera el riesgo (que es mínimo)
- Cumple con regulaciones de privacidad (GDPR)

## 📝 Uso

### Tracking Automático (Autocapture)

Con `autocapture: true`, Amplitude rastrea automáticamente:
- ✅ Clicks en botones y enlaces
- ✅ Cambios de página (pageviews)
- ✅ Envíos de formularios
- ✅ Cambios en inputs

### Tracking Manual

Para eventos personalizados, importa `amplitude` desde el módulo de analytics:

```typescript
import { amplitude } from '@/lib/analytics';

// Rastrear evento personalizado (V2 convention: snake_case)
amplitude.track('roast_generated', {
  tone: 'canalla',
  platform: 'twitter',
  character_count: 280
});

// Identificar usuario
amplitude.setUserId('user_123');

// Setear propiedades de usuario
amplitude.setUserProperties({
  plan: 'pro',
  subscription_status: 'active',
  email: 'user@example.com'
});
```

## 🎯 Convención de Nombres de Eventos (V2)

**⚠️ OBLIGATORIO: Usar snake_case para todos los eventos**

### ❌ INCORRECTO (PascalCase / Spaces)
```typescript
amplitude.track('User Logged In');
amplitude.track('RoastGenerated');
```

### ✅ CORRECTO (snake_case)
```typescript
amplitude.track('auth_login_success');
amplitude.track('roast_generated');
```

## 🎯 Eventos Definidos (V2 Convention)

### Autenticación
- `auth_login_success` - Login exitoso
  - Properties: `method` ('email_password', 'demo_mode', 'magic_link', 'oauth')
  - Properties: `redirect_to` (ruta de redirección)
- `auth_login_failed` - Login fallido
  - Properties: `method`, `error` (mensaje de error)
- `auth_logout_success` - Logout exitoso
- `auth_register_success` - Registro completado
- `auth_register_failed` - Registro fallido
- `auth_password_reset_requested` - Solicitud de reset de contraseña
- `auth_magic_link_requested` - Solicitud de magic link

### Roast Generation
- `roast_generated` - Cuando se genera un roast
  - Properties: `tone`, `platform`, `character_count`, `generation_time_ms`
- `roast_posted` - Cuando se publica un roast
  - Properties: `platform`, `manual_edit`, `auto_post`
- `roast_rejected` - Cuando un roast es rechazado por Shield
  - Properties: `rejection_reason`, `toxicity_score`

### Social Accounts
- `account_connected` - Cuando se conecta una cuenta social
  - Properties: `platform`
- `account_disconnected` - Cuando se desconecta una cuenta
  - Properties: `platform`, `reason`

### Billing
- `plan_upgraded` - Cuando un usuario actualiza su plan
  - Properties: `from_plan`, `to_plan`, `payment_frequency`
- `plan_downgraded` - Cuando un usuario baja de plan
  - Properties: `from_plan`, `to_plan`, `reason`
- `subscription_cancelled` - Cuando se cancela una suscripción
  - Properties: `plan`, `reason`

### Settings
- `persona_updated` - Cuando se actualiza la configuración de persona
  - Properties: `has_encryption`, `field_count`
- `tone_preference_changed` - Cuando se cambia la preferencia de tono
  - Properties: `tone`
- `shield_settings_updated` - Cuando se actualizan configuraciones de Shield
  - Properties: `threshold_changed`, `auto_block_enabled`

### Admin Panel (Solo Admin)
- `admin_feature_flag_updated`
- `admin_plan_limit_changed`
- `admin_user_action` - Acciones administrativas sobre usuarios
  - Properties: `action_type`, `target_user_id`

### CTAs y Forms
- `cta_click` - Click en CTA
  - Properties: `cta_name`, `cta_location`
- `form_submit` - Envío de formulario
  - Properties: `form_name`, `form_location`

## 🧪 Testing

Los tests se encuentran en `src/lib/__tests__/analytics.test.ts`.

Para ejecutar los tests:

```bash
cd frontend
npm test -- src/lib/__tests__/analytics.test.ts
```

Tests implementados:
- ✅ Inicialización correcta con configuración EU + autocapture
- ✅ Prevención de doble inicialización
- ✅ Estado de inicialización verificable
- ✅ Manejo de errores en inicialización

## 🔒 Privacidad y GDPR

### Decisiones de Privacidad

1. **Server Zone EU**: Datos almacenados en servidores europeos (cumplimiento GDPR)

2. **Autocapture en Auth Screens**: 
   - ✅ **HABILITADO** en login/register/recover
   - **Razón**: Diagnosticar fricción en flujos críticos
   - **Seguro**: NO captura contenido de inputs, solo eventos de interacción
   - **Justificación**: Útil para debugging de magic link, OAuth, etc.

3. **Session Replay en Auth Screens**:
   - ⚠️ **POLÍTICA ACTUALIZADA**: Ver `docs/analytics/amplitude.md` para política V2 final
   - **Decisión final V2**: Session replay habilitado globalmente (SDK no permite control granular por ruta)
   - **Seguro porque**: Autocapture NO captura valores de inputs sensibles (contraseñas, emails)
   - **GDPR**: Cumple con best practices - no se graban datos sensibles

4. **No PII por defecto**: 
   - Autocapture NO captura información personal identificable
   - User identification es explícita (solo después de login)

5. **Control de usuario**: 
   - Opt-out puede implementarse si es necesario
   - Variable de entorno puede deshabilitarse en desarrollo local

## 📚 Referencias

- [Amplitude Docs - Unified SDK](https://www.docs.developers.amplitude.com/data/sdks/typescript-browser/)
- [Amplitude - EU Data Residency](https://help.amplitude.com/hc/en-us/articles/360058073772-Amplitude-EU-Residency)
- [Amplitude - Autocapture](https://www.docs.developers.amplitude.com/data/sdks/typescript-browser/autocapture/)

## 🚀 Próximos Pasos

1. **Implementar eventos personalizados** en componentes clave
2. **Configurar user identification** después del login
3. **Crear dashboards en Amplitude** para métricas de producto
4. **Implementar opt-out** para usuarios que no quieran tracking
5. **Añadir tracking de conversión** para funnel de suscripción

## 📞 Soporte

Para soporte técnico de Amplitude:
- Dashboard: [https://analytics.amplitude.com/](https://analytics.amplitude.com/)
- Docs: [https://www.docs.developers.amplitude.com/](https://www.docs.developers.amplitude.com/)

---

**Última actualización**: 2025-12-15  
**Versión SDK**: @amplitude/unified (latest)  
**Mantenedor**: Roastr.AI Team

