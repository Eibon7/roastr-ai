---

name: security-audit-skill
description: Evalúa la seguridad de commits y configuración (auth, secrets, policies, datos).
triggers:

- "auth"
- "secret"
- "policy"
- "vulnerability"
- "security"
- "credential"
  used_by:
- github-guardian
- back-end-dev
- orchestrator
  steps:
- paso1: "Revisar todos los archivos modificados con grep para detectar strings de credenciales"
- paso2: "Buscar patrones: API_KEY, SECRET, PASSWORD, TOKEN, AUTH_TOKEN en código"
- paso3: "Validar que variables de entorno se cargan desde .env (NO hardcoded)"
- paso4: "Revisar políticas RLS en migraciones SQL (database/migrations/)"
- paso5: "Verificar sanitización de inputs en endpoints (protección XSS, SQL injection)"
- paso6: "Revisar permisos de archivos y configuración de CORS"
- paso7: "Detectar uso seguro de .env vs exponer credenciales en logs"
- paso8: "Generar reporte con hallazgos y recomendaciones"
  output: |
- Reporte de seguridad: docs/audit/security-report-{id}.md
- Lista de vulnerabilidades detectadas (si las hay)
- Recomendaciones específicas por hallazgo
- Checklist de mitigaciones sugeridas
  examples:
- contexto: "Se añadió funcionalidad de autenticación"
  verificar:
  - "¿Se usan variables de entorno para API keys?"
  - "¿Los tokens están siendo almacenados de forma segura?"
  - "¿Existe rate limiting en endpoints de login?"
- contexto: "Cambios en schema.sql"
  verificar: - "¿Las políticas RLS están habilitadas?" - "¿Los permisos de usuario están correctamente configurados?" - "¿Hay exposición de datos sensibles en queries?"
  rules:
- ❌ CRÍTICO: Si se detectan credenciales hardcoded → detener inmediatamente y reportar
- ❌ NUNCA commitear con secrets en logs o código
- ✅ SIEMPRE usar variables de entorno
- ✅ Validar permisos RLS en cada cambio de DB
- ✅ Sanitizar inputs de usuario antes de procesar
  checklist:
- [ ] Sin credenciales hardcoded en código
- [ ] Variables de entorno configuradas correctamente
- [ ] Políticas RLS verificadas y activas
- [ ] Inputs de usuario validados y sanitizados
- [ ] CORS configurado correctamente
- [ ] Rate limiting implementado donde necesario
- [ ] No hay exposición de datos sensibles
      references:
- "docs/SECURITY.md - Guía de seguridad"
- "config/product-guard.yaml - Guardian rules"
- "CLAUDE.md - Reglas de guardian"
