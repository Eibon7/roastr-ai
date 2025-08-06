#!/bin/bash

# =============================================================================
# Roastr.ai Twitter Bot - Cron Job Script para macOS
# =============================================================================
# Este script ejecuta el bot de Twitter en modo single (una sola vez) 
# y guarda los logs en la carpeta logs/ del proyecto.
#
# Uso: Se ejecuta automáticamente via crontab cada X minutos
# Logs: Revisa /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log
# =============================================================================

# Cambiar al directorio del proyecto
cd /Users/emiliopostigo/roastr-ai

# Ejecutar el bot de Twitter en modo single (una sola ejecución)
# --silent suprime los mensajes de npm para logs más limpios
/usr/local/bin/npm run twitter:batch:single --silent >> /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log 2>&1

# Opcional: Rotar logs si crecen mucho (mantener solo las últimas 1000 líneas)
tail -n 1000 /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log > /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log.tmp && mv /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log.tmp /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log