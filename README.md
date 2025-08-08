Roastr.ai

Roastr.ai es un MVP (Producto Mínimo Viable) que genera “roasts” o respuestas sarcásticas e ingeniosas a comentarios en redes sociales.

Introducción

Roastr.ai es una herramienta que analiza comentarios y genera respuestas humorísticas y personalizadas mediante IA.

Características principales:
	•	Generación de roasts usando OpenAI GPT-4o mini
	•	Sistema RQC (Roast Quality Control) multi-plan con moderación inteligente
	•	Detección automática de idioma (español/inglés)
	•	Arquitectura multi-tenant con planes de suscripción (Free, Pro, Creator+)
	•	9 integraciones de plataformas sociales (Twitter, YouTube, Instagram, etc.)
	•	API REST desplegada en Vercel
	•	Frontend web minimalista
	•	CLI para uso local

Arquitectura

El proyecto usa una arquitectura simple basada en Node.js + Express:
	•	Backend: src/index.js - Servidor Express con endpoints de API
	•	Frontend: public/index.html - Interfaz web básica con HTML/CSS/JS vanilla
	•	Despliegue: Vercel serverless functions usando vercel.json
	•	CLI: src/cli.js - Herramienta de línea de comandos para testing local
	•	Integraciones: src/integrations/ - Módulos para redes sociales
	•	Sistema multi-tenant: Autenticación y espacio de usuario con Supabase

La aplicación se ejecuta como una función serverless en Vercel, lo que permite escalabilidad automática y despliegues rápidos.

Endpoints

GET /

Sirve el frontend web desde public/index.html.

POST /roast

Genera un roast usando la API de OpenAI.

{
  "message": "Tu comentario aquí"
}

Respuesta:

{
  "roast": "Roast generado por CSV"
}

## 🔬 Sistema RQC (Roast Quality Control)

Roastr.ai incluye un sistema avanzado de control de calidad que funciona según el plan del usuario:

### Moderación Básica (Free y Pro)

Los planes Free y Pro utilizan **moderación básica integrada** directamente en el prompt de generación:
- ✅ Sin llamadas extra a GPT (optimizado para costes)
- ✅ Cumplimiento automático de normas de plataformas
- ✅ Intensidad controlada según configuración del usuario
- ✅ Detección automática de idioma
- ✅ Respuesta garantizada siempre

### RQC Avanzado (Creator+)

Los usuarios Creator+ obtienen acceso al **sistema RQC avanzado** con 3 revisores paralelos:

#### 🛡️ Moderador
- Verifica cumplimiento de políticas de plataformas
- Controla nivel de intensidad configurado (1-5)
- **Decisión final**: Si falla, siempre se regenera

#### 😄 Comediante  
- Evalúa calidad del humor y creatividad
- Comprueba que el roast sea suficientemente "punchy"
- Detecta contenido genérico o aburrido

#### 🎨 Revisor de Estilo
- Verifica adherencia al tono configurado
- Aplica prompts personalizados configurados por admin
- Mantiene consistencia con preferencias del usuario

### Lógica de Decisiones

```
3 verdes → ✅ Publicar inmediatamente
2 verdes (Moderador ✅) → ✅ Publicar en modo Pro
Moderador ❌ → 🔄 Regenerar (obligatorio)
< 2 verdes → 🔄 Regenerar con feedback
Max intentos → 🛡️ Fallback seguro
```

### Configuración de Usuario

- **Nivel de intensidad**: 1 (suave) a 5 (intenso) 
- **RQC habilitado**: Solo Creator+ (configurable)
- **Prompt personalizado**: Solo editable por administradores
- **Límite de regeneraciones**: Configurable por plan (Free/Pro: 0, Creator+: 3)

### Benefits

- 💰 **Optimización de costes**: Free/Pro usan 1 llamada API
- 🎯 **Control de calidad**: Creator+ obtiene revisión profesional  
- 🛡️ **Seguridad de plataforma**: Todo contenido cumple guidelines
- ⚡ **Alta velocidad**: Revisores ejecutan en paralelo
- 🔄 **Garantía de respuesta**: Sistema de fallback siempre funciona

## Comandos CLI

Ver comandos disponibles con detalles completos en [CLAUDE.md](./CLAUDE.md).

## 🧪 Tests en Entorno Sin Claves

Roastr.ai está diseñado para funcionar sin claves externas usando mocks por defecto. Ideal para desarrollo y testing local:

### Configuración de Tests

Los tests están configurados para pasar sin necesidad de claves de servicios externos:

```bash
# Ejecutar todos los tests (funciona sin claves)
npm test

# Tests específicos
npm test -- tests/unit/
npm test -- tests/integration/

# Tests con cobertura
npm run test:coverage
```

### Características del Entorno Mock

- **RQC desactivado**: `ENABLE_RQC=false` por defecto en tests
- **Servicios externos**: Auto-fallback a mocks cuando faltan claves
- **OpenAI**: Usa mock generator si `OPENAI_API_KEY` no está presente  
- **Supabase**: Mock database para todos los tests
- **Stripe**: Mock billing sin claves reales
- **Redes sociales**: Mock integrations para Twitter, YouTube, etc.

### Variables de Entorno Opcionales

```bash
# Solo necesarias para funcionalidad real (no para tests)
OPENAI_API_KEY=your_key_here          # Si quieres IA real
SUPABASE_URL=your_supabase_url        # Para BD real
STRIPE_SECRET_KEY=sk_...              # Para billing real
ENABLE_RQC=true                       # Para habilitar RQC avanzado
```

### Fallback Automático

Cuando faltan claves, los servicios automáticamente usan mocks:

- **OpenAI faltante** → Mock roast generator
- **Supabase faltante** → Mock database responses  
- **Stripe faltante** → Mock billing endpoints
- **API keys sociales** → Mock platform integrations

Esto permite desarrollo y testing completo sin configuración compleja.

## Contribución

Para desarrolladores, ver la documentación técnica completa y changelog en [CHANGELOG.md](./CHANGELOG.md).Tu roast generado por IA"
}

POST /csv-roast

Genera un roast simulado usando un sistema de plantillas (actualmente mock, futura integración real).

{
  "message": "Tu comentario aquí"
}

Respuesta:

{
  "roast": "Roast generado por CSV"
}

## 🔬 Sistema RQC (Roast Quality Control)

Roastr.ai incluye un sistema avanzado de control de calidad que funciona según el plan del usuario:

### Moderación Básica (Free y Pro)

Los planes Free y Pro utilizan **moderación básica integrada** directamente en el prompt de generación:
- ✅ Sin llamadas extra a GPT (optimizado para costes)
- ✅ Cumplimiento automático de normas de plataformas
- ✅ Intensidad controlada según configuración del usuario
- ✅ Detección automática de idioma
- ✅ Respuesta garantizada siempre

### RQC Avanzado (Creator+)

Los usuarios Creator+ obtienen acceso al **sistema RQC avanzado** con 3 revisores paralelos:

#### 🛡️ Moderador
- Verifica cumplimiento de políticas de plataformas
- Controla nivel de intensidad configurado (1-5)
- **Decisión final**: Si falla, siempre se regenera

#### 😄 Comediante  
- Evalúa calidad del humor y creatividad
- Comprueba que el roast sea suficientemente "punchy"
- Detecta contenido genérico o aburrido

#### 🎨 Revisor de Estilo
- Verifica adherencia al tono configurado
- Aplica prompts personalizados configurados por admin
- Mantiene consistencia con preferencias del usuario

### Lógica de Decisiones

```
3 verdes → ✅ Publicar inmediatamente
2 verdes (Moderador ✅) → ✅ Publicar en modo Pro
Moderador ❌ → 🔄 Regenerar (obligatorio)
< 2 verdes → 🔄 Regenerar con feedback
Max intentos → 🛡️ Fallback seguro
```

### Configuración de Usuario

- **Nivel de intensidad**: 1 (suave) a 5 (intenso) 
- **RQC habilitado**: Solo Creator+ (configurable)
- **Prompt personalizado**: Solo editable por administradores
- **Límite de regeneraciones**: Configurable por plan (Free/Pro: 0, Creator+: 3)

### Benefits

- 💰 **Optimización de costes**: Free/Pro usan 1 llamada API
- 🎯 **Control de calidad**: Creator+ obtiene revisión profesional  
- 🛡️ **Seguridad de plataforma**: Todo contenido cumple guidelines
- ⚡ **Alta velocidad**: Revisores ejecutan en paralelo
- 🔄 **Garantía de respuesta**: Sistema de fallback siempre funciona

## Comandos CLI

Ver comandos disponibles con detalles completos en [CLAUDE.md](./CLAUDE.md).

## Contribución

Para desarrolladores, ver la documentación técnica completa y changelog en [CHANGELOG.md](./CHANGELOG.md).
