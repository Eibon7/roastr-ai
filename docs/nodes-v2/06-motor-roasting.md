# GDD Node — Motor de Roasting v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`analysis-engine`](./05-motor-analisis.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`shield-engine`](./07-shield.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

- [`analysis-engine`](./05-motor-analisis.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`shield-engine`](./07-shield.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

Este nodo depende de los siguientes nodos:

- [`analysis-engine`](./05-motor-analisis.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`shield-engine`](./07-shield.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

---

Este nodo depende de los siguientes nodos:

- [`analysis-engine`](./05-motor-analisis.md) - Decisión "roast" o "correctiva"
- [`integraciones-redes-sociales`](./04-integraciones.md) - Publicación en plataformas
- [`shield-engine`](./07-shield.md) - Validación de contenido
- [`billing`](./billing.md) - Créditos de roasts
- [`observabilidad`](./observabilidad.md) - Logging estructurado
- [`ssot-integration`](./15-ssot-integration.md) - Configuración de tonos y límites

### Servicios Externos:

- **OpenAI**: LLM por tono (GPT-4 Turbo para flanders, GPT-5 mini para balanceado/canalla/personal según SSOT)
- **Supabase**: Tablas `roasts`, `user_style_profiles` (cifrados)

### SSOT References

Este nodo usa los siguientes valores del SSOT:

- `credit_consumption_rules` - Reglas de consumo de créditos para roasts
- `plan_limits` - Límites por plan (roasts_per_month)
- `roast_tones` - Definición de tonos (flanders, balanceado, canalla, personal)
- `style_validator` - Reglas de validación de estilo
- `tone_personal_allowed` - Flag para habilitar tono personal
- `platform_constraints` - Límites de caracteres por plataforma

---

### Modelos IA por Tono (SSOT-mandated)

El Motor de Roasting DEBE utilizar exactamente los modelos definidos en SSOT:

- `flanders` → GPT-4 Turbo
- `balanceado` → GPT-5 mini
- `canalla` → GPT-5 mini
- `personal` → GPT-5 mini

**Reglas**:

- No se permite fallback a otros modelos.
- No se permite usar modelos no declarados en SSOT.
- Todos los workers deben cargar el modelo desde SSOT en cada job.

### Workers:

- `GenerateRoast`: Genera roasts
- `GenerateCorrectiveReply`: Genera correctivas
- `SocialPosting`: Publica roasts/correctivas
- `BillingUpdate`: Consume créditos

---

## 7. Related Nodes

- analysis-engine (depends_on)
- integraciones-redes-sociales (depends_on)
- shield-engine (depends_on)
- billing-integration (depends_on)
- observabilidad (depends_on)
- ssot-integration (depends_on)
- frontend-user-app (required_by)
