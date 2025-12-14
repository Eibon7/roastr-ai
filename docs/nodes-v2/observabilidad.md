# GDD Node — Observabilidad v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-08

---

## 1. Summary

Sistema de observabilidad que proporciona logging estructurado, correlation tracking, end-to-end request tracing, usage analytics, métricas y dashboard de reportes. Integrado con servicios de logging externos (Axiom/Datadog para backend, Sentry para frontend) y respetando reglas GDPR para estructura de logs.

---

## 2. Responsibilities

- **Structured Logging:** Logs JSON estructurados con formato estándar
- **Correlation Tracking:** Tracking de IDs de correlación para requests end-to-end
- **Request Tracing:** Trazabilidad completa de requests desde entrada hasta salida
- **Usage Analytics:** Analytics de uso de la plataforma por usuario/organización
- **Metrics & Reporting:** Métricas agregadas y dashboard de reportes
- **GDPR Compliance:** Estructura de logs que respeta reglas GDPR (no datos prohibidos)

---

## 3. Dependencies

Este nodo depende de los siguientes nodos:

- [`billing`](./billing.md) - Para tracking de consumo y límites
- [`infraestructura`](./14-infraestructura.md) - Para acceso a servicios de logging y base de datos
- [`roasting-engine`](./06-motor-roasting.md) - Para logging de generación de roasts
- [`shield-engine`](./07-shield.md) - Para logging de acciones de moderación
- [`integraciones-redes-sociales`](./04-integraciones.md) - Para logging de integraciones con plataformas

---

## 4. Related Nodes

Este nodo está relacionado con los siguientes nodos:

- [`roasting-engine`](./06-motor-roasting.md) - Genera eventos que son loggeados
- [`analysis-engine`](./05-motor-analisis.md) - Genera eventos de análisis
- [`shield-engine`](./07-shield.md) - Genera eventos de moderación
- [`integraciones-redes-sociales`](./04-integraciones.md) - Genera eventos de integración
- [`billing`](./billing.md) - Genera eventos de consumo y billing
- [`infraestructura`](./14-infraestructura.md) - Genera eventos de infraestructura
- [`frontend-user-app`](./09-panel-usuario.md) - Frontend envía logs a Sentry
- [`workers`](./08-workers.md) - Workers generan logs estructurados

---

## 5. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `gdpr_allowed_log_structure` - Estructura de logs permitida según GDPR
- `gdpr_automatic_blocking` - Reglas de bloqueo automático por GDPR
- `gdpr_forbidden_data` - Datos prohibidos en logs según GDPR
- `worker_logs` - Configuración de logs por worker

---

## 6. Implementation Details

### 6.1 Structured Logging

Logs en formato JSON con estructura estándar:

```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "service-name",
  "correlation_id": "uuid",
  "organization_id": "uuid",
  "message": "log message",
  "metadata": {}
}
```

### 6.2 Correlation Tracking

Cada request recibe un `correlation_id` único que se propaga a través de:

- Workers
- Servicios
- Integraciones externas
- Frontend requests

### 6.3 Request Tracing

Trazabilidad end-to-end mediante:

- Correlation IDs
- Request IDs
- Trace IDs (para servicios externos)

### 6.4 Usage Analytics

Tracking de:

- Consumo de créditos por usuario/organización
- Uso de features por plan
- Métricas de performance
- Errores y excepciones

### 6.5 Metrics & Reporting

Métricas agregadas:

- Requests por minuto/hora/día
- Error rates
- Latency percentiles
- Usage por plan

---

## 7. Integration Points

### 7.1 Backend Logging

- **Axiom/Datadog:** Destino principal para logs estructurados del backend
- **Format:** JSON estructurado
- **Retention:** Según reglas GDPR

### 7.2 Frontend Logging

- **Sentry:** Destino principal para logs del frontend
- **Format:** Eventos estructurados
- **Retention:** Según reglas GDPR

### 7.3 Workers

Todos los workers extienden `BaseWorker` que incluye logging estructurado automático.

---

## 8. GDPR Compliance

### 8.1 Allowed Log Structure

Solo se registran datos permitidos según SSOT:

- Timestamps
- Correlation IDs
- Organization IDs (no user IDs directamente)
- Service names
- Error messages (sin datos personales)

### 8.2 Forbidden Data

No se registran:

- User emails
- User names
- Personal data
- API keys
- Tokens

### 8.3 Automatic Blocking

Si se detecta intento de loggear datos prohibidos:

- Bloqueo automático del log
- Alerta al sistema
- Log de intento (sin datos sensibles)

---

## 9. Error Budget

Sistema de error budget para proteger producción:

- Tracking de errores por servicio
- Alertas cuando se excede error budget
- Circuit breakers automáticos

---

## 10. Alertas

Sistema de alertas por criticidad:

- **P0 (Critical):** Errores que afectan producción inmediatamente
- **P1 (High):** Errores que afectan funcionalidad crítica
- **P2 (Medium):** Warnings y degradaciones
- **P3 (Low):** Información y métricas

---

## 11. Agentes Relevantes

- **Back-end Dev:** Implementación de logging estructurado
- **Test Engineer:** Validación de logs y métricas
- **Guardian:** Validación de compliance GDPR

---

**Última actualización:** 2025-12-08  
**Mantenido por:** Back-end Dev

---

## Related Nodes

- roasting-engine (required_by)
- analysis-engine (required_by)
- shield-engine (required_by)
- integraciones-redes-sociales (required_by)
- billing-integration (required_by)
- frontend-user-app (required_by)
