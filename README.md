# Roastr.ai

[![CI/CD Pipeline](https://github.com/Eibon7/roastr-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Eibon7/roastr-ai/actions/workflows/ci.yml)
[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-Passing-brightgreen)]()
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-Passing-brightgreen)]()
[![Mock Mode](https://img.shields.io/badge/Mock%20Mode-100%25%20Coverage-blue)]()
[![Style Profile](https://img.shields.io/badge/Style%20Profile-Ready-purple)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Sistema multi-tenant de detección de toxicidad y generación de roasts automáticos para redes sociales.

## 🚀 Quick Start (Mock Mode)

```bash
# Clonar y configurar
git clone https://github.com/Eibon7/roastr-ai.git
cd roastr-ai
npm install

# Frontend
cd frontend && npm install
npm start  # Abre http://localhost:3001

# Backend (nueva terminal)
npm run start:api  # API en http://localhost:3000
```

**¡No necesitas APIs externas!** El sistema funciona en **Mock Mode** por defecto.

## 📊 Dashboard Frontend + Social Networks Panel

**Sistema completo de dashboard con:**
- ✅ 7 widgets interactivos reordenables  
- ✅ **Panel de Redes Sociales** con multi-account support
- ✅ **Sistema de Auth** con edge cases y feature flags (magic link)
- ✅ Mock-first design (funciona sin APIs externas)
- ✅ 7 páginas completas (Dashboard, Compose, Integrations, Billing, Settings, Logs, **Accounts**)
- ✅ Diseño responsivo con shadcn/ui + Tailwind CSS
- ✅ Sistema de feature flags centralizado
- ✅ Tests completos (Jest + React Testing Library) - **>85% coverage**

## 🎯 Características Principales

### Core Features
- **Generación de roasts** usando OpenAI GPT-4o mini
- **Sistema RQC** (Roast Quality Control) multi-plan con moderación inteligente
- **Social Networks Panel** - Gestión multi-cuenta con modals por red (roasts, shield, settings)
- **Sistema de Auth completo** con magic link, edge cases, y feature flags
- **Detección automática** de idioma (español/inglés) 
- **Arquitectura multi-tenant** con planes de suscripción (Free, Pro, Creator+)
- **9 integraciones** de plataformas sociales (Twitter, YouTube, Instagram, etc.)
- **Shield Protection** - Moderación automática con acciones escalonadas
- **Worker system** dedicado para procesamiento en background

### Frontend + Social Panel Features
- **Mock Mode** automático cuando faltan API keys con switch para producción
- **Widget system** modular y extensible
- **Social Networks Panel** con multi-account support (múltiples cuentas por red)
- **AccountModal** con 3 tabs (Roasts, Shield, Settings) y UI condicional
- **Optimistic UI** con rollback automático en caso de errores de API
- **Auth System** con 37 tests de edge cases y feature flags por entorno
- **Real-time updates** en widgets seleccionados
- **Responsive design** para mobile y desktop
- **Filtros avanzados** en logs y data tables
- **Estados de loading** y error handling completo

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
