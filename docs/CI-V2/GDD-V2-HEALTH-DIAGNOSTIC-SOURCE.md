# GDD v2 Health Score Diagnostic - Source Identification

**Fecha:** 2025-12-08  
**Health Score Actual:** 30/100  
**Health Score Esperado (post-ROA-258):** 100/100

---

## 1. Script Ejecutado

**Script:** `scripts/calculate-gdd-health-v2.js`

**Comando de ejecución:**
```bash
node scripts/calculate-gdd-health-v2.js
```

**Archivo JSON generado:** `gdd-health-v2.json`

**Fuentes de datos:**
- `docs/system-map-v2.yaml` - Source of truth para lista de nodos
- `docs/nodes-v2/**/*.md` - Archivos de documentación de nodos
- `docs/SSOT-V2.md` - Referencias SSOT (usado para validación de alineación)

---

## 2. Lógica del Script

El script `calculate-gdd-health-v2.js`:

1. **Carga system-map-v2.yaml** como source of truth
2. **Extrae lista de nodos** de `systemMap.nodes` (15 nodos definidos)
3. **Busca archivos** en `docs/nodes-v2/` para cada nodo usando `findNodeFile()`
4. **Calcula métricas** basándose en:
   - Nodos encontrados vs nodos definidos
   - Dependencias detectadas vs esperadas
   - Crosslinks detectados vs esperados
   - Alineación SSOT

---

## 3. Función `findNodeFile()` - Lógica Actual

```javascript
function findNodeFile(nodeName) {
  // 1. Intenta match exacto: ${nodeName}.md
  // 2. Si no existe, busca formato numerado: XX-${nodeName}.md
  // 3. Extrae el nombre después del número y compara con nodeName normalizado
  // 4. NO usa el campo docs: del system-map-v2.yaml
}
```

**Problema identificado:** El script NO utiliza el campo `docs:` del `system-map-v2.yaml` que especifica explícitamente qué archivo corresponde a cada nodo.

---

## 4. Estado Actual vs Esperado

### Nodos en system-map-v2.yaml: 15

1. `roasting-engine` → espera `docs/nodes-v2/roasting-engine.md`
2. `analysis-engine` → espera `docs/nodes-v2/analysis-engine.md`
3. `shield-engine` → espera `docs/nodes-v2/shield-engine.md`
4. `integraciones-redes-sociales` → espera `docs/nodes-v2/integraciones-redes-sociales.md`
5. `billing` → espera `docs/nodes-v2/billing.md`
6. `infraestructura` → espera `docs/nodes-v2/infraestructura.md`
7. `observabilidad` → espera `docs/nodes-v2/observabilidad.md`
8. `frontend-user-app` → espera `docs/nodes-v2/frontend-user-app.md`
9. `frontend-admin` → espera `docs/nodes-v2/frontend-admin.md`
10. `ssot-integration` → espera `docs/nodes-v2/ssot-integration.md`
11. `workers` → espera `docs/nodes-v2/workers.md`
12. `auth` → espera `docs/nodes-v2/auth.md`
13. `settings-loader-and-feature-flags` → espera `docs/nodes-v2/settings-loader-and-feature-flags.md`
14. `gdpr-and-legal` → espera `docs/nodes-v2/gdpr-and-legal.md`
15. `testing-v2` → espera `docs/nodes-v2/testing-v2.md`

### Archivos reales en docs/nodes-v2/: 15 (con nombres diferentes)

1. `01-arquitectura-general.md`
2. `02-autenticacion-usuarios.md`
3. `03-billing-polar.md`
4. `04-integraciones.md`
5. `05-motor-analisis.md`
6. `06-motor-roasting.md`
7. `07-shield.md`
8. `08-workers.md`
9. `09-panel-usuario.md`
10. `10-panel-administracion.md`
11. `11-feature-flags.md`
12. `12-gdpr-legal.md`
13. `13-testing.md`
14. `14-infraestructura.md`
15. `15-ssot-integration.md`
16. `billing.md` (adicional)

---

## 5. Mapeo Actual (lo que el script encuentra)

| Nodo system-map | Archivo esperado (docs:) | Archivo real encontrado | Estado |
|----------------|-------------------------|-------------------------|--------|
| `roasting-engine` | `roasting-engine.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `analysis-engine` | `analysis-engine.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `shield-engine` | `shield-engine.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `integraciones-redes-sociales` | `integraciones-redes-sociales.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `billing` | `billing.md` | ✅ `billing.md` | Encontrado (match exacto) |
| `infraestructura` | `infraestructura.md` | ✅ `14-infraestructura.md` | Encontrado (match numerado) |
| `observabilidad` | `observabilidad.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `frontend-user-app` | `frontend-user-app.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `frontend-admin` | `frontend-admin.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `ssot-integration` | `ssot-integration.md` | ✅ `15-ssot-integration.md` | Encontrado (match numerado) |
| `workers` | `workers.md` | ✅ `08-workers.md` | Encontrado (match numerado) |
| `auth` | `auth.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `settings-loader-and-feature-flags` | `settings-loader-and-feature-flags.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `gdpr-and-legal` | `gdpr-and-legal.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |
| `testing-v2` | `testing-v2.md` | ❌ NO ENCONTRADO | Falla búsqueda exacta y numerada |

**Resultado:** Solo 4 nodos detectados de 15 (26.67%)

---

## 6. Por Qué Falla la Búsqueda Numerada

El script busca archivos en formato `XX-${nodeName}.md`, pero:

- Busca: `XX-roasting-engine.md`
- Archivo real: `06-motor-roasting.md`
- Extrae: `motor-roasting` del archivo
- Compara: `motor-roasting` vs `roasting-engine`
- **No coinciden** → No encuentra el archivo

El problema es que los nombres de los archivos no coinciden con los nombres de los nodos en el system-map.

---

## 7. Conclusión

**El script está ejecutándose correctamente**, pero **no puede encontrar los archivos** porque:

1. Los archivos tienen nombres diferentes a los especificados en `system-map-v2.yaml`
2. El script NO usa el campo `docs:` del system-map que especifica explícitamente qué archivo usar
3. La búsqueda por nombre numerado falla porque los nombres extraídos no coinciden con los nombres de los nodos

**El health score de 30/100 es REAL** - refleja que solo 4 de 15 nodos están siendo detectados correctamente.

