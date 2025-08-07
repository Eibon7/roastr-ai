Roastr.ai

Roastr.ai es un MVP (Producto Mínimo Viable) que genera “roasts” o respuestas sarcásticas e ingeniosas a comentarios en redes sociales.

Introducción

Roastr.ai es una herramienta que analiza comentarios y genera respuestas humorísticas y personalizadas mediante IA.

Características principales:
	•	Generación de roasts usando OpenAI GPT-4o mini
	•	Detección automática de idioma (español/inglés)
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
  "roast": "Tu roast generado por IA"
}

POST /csv-roast

Genera un roast simulado usando un sistema de plantillas (actualmente mock, futura integración real).

{
  "message": "Tu comentario aquí"
}

Respuesta:

{
  "roast": "
