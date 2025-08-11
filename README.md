# Roastr.ai

[![CI/CD Pipeline](https://github.com/Eibon7/roastr-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Eibon7/roastr-ai/actions/workflows/ci.yml)
[![Style Profile](https://img.shields.io/badge/Style%20Profile-Ready-purple)](/)
[![OAuth Integration](https://img.shields.io/badge/OAuth-7%20Platforms-blue)](/)
[![Multi-Tenant](https://img.shields.io/badge/Multi--Tenant-Ready-green)](/)

Roastr.ai is a comprehensive multi-tenant SaaS platform for AI-powered social media roast generation with advanced style profile analysis and seamless OAuth integrations.

## 🚀 Overview

Roastr.ai is an enterprise-grade platform that analyzes social media content and generates personalized, witty responses using advanced AI. Built with a robust multi-tenant architecture supporting multiple subscription plans and sophisticated content moderation.

### ✨ Key Features

- 🤖 **AI-Powered Roast Generation** using OpenAI GPT-4o mini
- 📊 **Style Profile Analysis** with multi-language support 
- 🔐 **OAuth Integration** for 7 major social platforms
- 🛡️ **RQC System** (Roast Quality Control) with intelligent moderation
- 🌍 **Multi-Language Support** (Spanish/English detection)
- 🏢 **Multi-Tenant Architecture** with subscription plans (Free, Pro, Creator+)
- 🔌 **9 Platform Integrations** (Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky)
- 🚀 **Serverless Deployment** on Vercel
- 💻 **Modern React Frontend** with shadcn/ui
- ⚡ **CLI Tools** for local development and testing
- 🔄 **Automatic Session Refresh** with sliding expiration
- 🛡️ **Rate Limiting** and security features
- 🧪 **Mock Mode** for testing and development

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
