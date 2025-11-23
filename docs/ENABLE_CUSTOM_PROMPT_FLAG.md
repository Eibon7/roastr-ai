# ENABLE_CUSTOM_PROMPT Feature Flag

## 📋 Resumen

La flag `ENABLE_CUSTOM_PROMPT` controla el uso del campo `custom_style_prompt` en la generación de roasts. Esta flag permite activar/desactivar la funcionalidad de prompts personalizados desde el backend sin afectar el funcionamiento existente del sistema.

## 🎯 Propósito

- **Control granular**: Permite habilitar/deshabilitar prompts personalizados sin cambios de código
- **Compatibilidad hacia atrás**: Garantiza que el sistema funcione igual cuando está desactivada
- **Preparación futura**: Deja el código listo para cuando se implemente la UI de prompts personalizados
- **Seguridad**: Evita que prompts personalizados se usen accidentalmente en producción

## ⚙️ Configuración

### Variable de Entorno

```bash
# Desactivada por defecto (comportamiento actual)
ENABLE_CUSTOM_PROMPT=false

# Activar la funcionalidad
ENABLE_CUSTOM_PROMPT=true
```

### Comportamiento por Defecto

- **Por defecto**: `false` (desactivada)
- **Requiere activación explícita**: Solo acepta `ENABLE_CUSTOM_PROMPT=true`
- **Valores inválidos**: Cualquier otro valor se trata como `false`

## 🔧 Implementación Técnica

### Archivos Modificados

1. **`src/config/flags.js`**
   - Añadida nueva flag `ENABLE_CUSTOM_PROMPT`
   - Integrada en el sistema de status de features

2. **`src/routes/dashboard.js`**
   - Añadida flag al health check del sistema

3. **`src/services/roastGeneratorEnhanced.js`**
   - Modificadas funciones `generateWithBasicModeration()` y `generateInitialRoast()`
   - Modificada función `buildAdvancedPrompt()`
   - Lógica: `flags.isEnabled('ENABLE_CUSTOM_PROMPT') ? rqcConfig.custom_style_prompt : null`

4. **`src/services/rqcService.js`**
   - Modificada función `runStyleReviewer()`
   - Control de inclusión de prompts personalizados en revisión de estilo

### Lógica de Control

```javascript
// En roastGeneratorEnhanced.js
userConfig: {
  tone: tone,
  humor_type: rqcConfig.humor_type || 'witty',
  intensity_level: rqcConfig.intensity_level,
  custom_style_prompt: flags.isEnabled('ENABLE_CUSTOM_PROMPT') ? rqcConfig.custom_style_prompt : null
}

// En buildAdvancedPrompt()
if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && rqcConfig.custom_style_prompt) {
  prompt += `\n- Estilo personalizado: ${rqcConfig.custom_style_prompt}`;
}

// En rqcService.js
if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && userConfig.custom_style_prompt) {
  styleInstructions += `\n\nESTILO PERSONALIZADO CONFIGURADO:\n${userConfig.custom_style_prompt}`;
} else {
  styleInstructions += `\n\nESTILO ESTÁNDAR:\n- Ingenioso y sarcástico\n- Apropiado para redes sociales\n- Equilibrio entre humor y respeto`;
}
```

## 🧪 Testing

### Tests Implementados

1. **`tests/unit/config/flags-custom-prompt.test.js`**
   - Verificación de carga de flag desde variables de entorno
   - Comportamiento por defecto (desactivada)
   - Integración con sistema de flags existente

2. **`tests/unit/services/roastGenerator-custom-prompt.test.js`**
   - Lógica de control en generación de roasts
   - Verificación de que la flag controla el uso de `custom_style_prompt`
   - Tests de compatibilidad hacia atrás

3. **`tests/unit/services/rqcService.test.js`** (modificado)
   - Tests para verificar control de prompts personalizados en RQC
   - Verificación de comportamiento con flag activada/desactivada

### Ejecutar Tests

```bash
# Tests específicos de la nueva flag
npm test -- --testPathPatterns="flags-custom-prompt"

# Tests de integración con generador
npm test -- --testPathPatterns="roastGenerator-custom-prompt"

# Tests de RQC con prompts personalizados
npm test -- --testPathPatterns="rqcService" --testNamePattern="custom style prompt"
```

## 📊 Verificación de Estado

### Health Check

La flag aparece en el endpoint de health check:

```bash
GET /api/health
```

```json
{
  "services": { ... },
  "flags": {
    "rqc": false,
    "shield": false,
    "customPrompt": false,  // ← Nueva flag
    "mockMode": true,
    "verboseLogs": false
  },
  "timestamp": "2025-01-01T10:00:00.000Z",
  "status": "operational"
}
```

### Status de Features

```javascript
const { flags } = require('./src/config/flags');

// Verificar estado
console.log(flags.isEnabled('ENABLE_CUSTOM_PROMPT')); // false por defecto

// Status completo
const status = flags.getStatus();
console.log(status.features.customPrompt); // 'disabled' o 'enabled'
```

## 🔄 Flujos de Uso

### Flujo Actual (Flag Desactivada)

1. Usuario tiene `custom_style_prompt` configurado en base de datos
2. Flag `ENABLE_CUSTOM_PROMPT` = `false` (por defecto)
3. Sistema ignora `custom_style_prompt` y usa prompts estándar
4. Generación funciona exactamente igual que antes

### Flujo Futuro (Flag Activada)

1. Administrador activa: `ENABLE_CUSTOM_PROMPT=true`
2. Usuario tiene `custom_style_prompt` configurado
3. Sistema usa el prompt personalizado en generación
4. RQC incluye el estilo personalizado en revisiones

## ⚠️ Consideraciones Importantes

### Seguridad

- **Solo admin-editable**: El campo `custom_style_prompt` sigue siendo solo editable por administradores
- **No hay UI**: No existe interfaz de usuario para que usuarios finales configuren prompts
- **Control centralizado**: Solo se puede activar desde variables de entorno del servidor

### Compatibilidad

- **Backward compatible**: Cuando está desactivada, el sistema funciona exactamente igual
- **No breaking changes**: No afecta ninguna funcionalidad existente
- **Graceful degradation**: Maneja correctamente valores `null` o vacíos

### Performance

- **Mínimo overhead**: Solo añade una verificación de flag por generación
- **Sin impacto en DB**: No modifica consultas de base de datos
- **Caching**: La flag se carga una vez al inicializar el sistema

## 🚀 Activación en Producción

### Pasos para Activar

1. **Verificar configuración**:

   ```bash
   # Verificar que los prompts personalizados están configurados correctamente
   SELECT custom_style_prompt FROM user_subscriptions WHERE custom_style_prompt IS NOT NULL;
   ```

2. **Activar flag**:

   ```bash
   # En variables de entorno del servidor
   ENABLE_CUSTOM_PROMPT=true
   ```

3. **Reiniciar servicio**:

   ```bash
   # Reiniciar para cargar nueva configuración
   pm2 restart roastr-api
   ```

4. **Verificar activación**:
   ```bash
   curl https://api.roastr.ai/health | jq '.flags.customPrompt'
   # Debería retornar: true
   ```

### Rollback

Para desactivar rápidamente:

```bash
# Desactivar flag
ENABLE_CUSTOM_PROMPT=false

# Reiniciar servicio
pm2 restart roastr-api
```

## 📈 Monitoreo

### Logs a Observar

```bash
# Verificar que la flag se carga correctamente
grep "ENABLE_CUSTOM_PROMPT" logs/app.log

# Verificar uso de prompts personalizados
grep "Estilo personalizado" logs/app.log
```

### Métricas Sugeridas

- Número de generaciones que usan prompts personalizados
- Tiempo de respuesta con/sin prompts personalizados
- Tasa de éxito en generaciones con prompts personalizados

## 🎯 Próximos Pasos

1. **Testing en staging**: Activar flag en entorno de pruebas
2. **Monitoreo**: Observar métricas de performance y calidad
3. **UI development**: Desarrollar interfaz para que usuarios configuren prompts
4. **Gradual rollout**: Activar para usuarios específicos primero
5. **Full deployment**: Activación completa cuando esté validado

---

**Nota**: Esta flag está diseñada para ser un control temporal hasta que se implemente la funcionalidad completa de prompts personalizados con interfaz de usuario.
