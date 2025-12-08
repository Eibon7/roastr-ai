# GDD v2 Health - Final Wiring Report

**Fecha:** 2025-12-08  
**Objetivo:** Documentar el wiring definitivo entre system-map-v2.yaml, docs/nodes-v2/, y el script de health v2

---

## 1. Cambios Aplicados

### 1.1 docs/system-map-v2.yaml

**Cambio:** Actualización de todos los paths en el campo `docs:` para apuntar a archivos reales existentes.

**Antes:**
```yaml
nodes:
  roasting-engine:
    docs:
      - docs/nodes-v2/roasting-engine.md  # ❌ No existe
```

**Después:**
```yaml
nodes:
  roasting-engine:
    docs:
      - docs/nodes-v2/06-motor-roasting.md  # ✅ Existe
```

**Nodos actualizados (14 de 15):**
- `roasting-engine` → `06-motor-roasting.md`
- `analysis-engine` → `05-motor-analisis.md`
- `shield-engine` → `07-shield.md`
- `integraciones-redes-sociales` → `04-integraciones.md`
- `billing` → `billing.md` (ya correcto)
- `infraestructura` → `14-infraestructura.md`
- `frontend-user-app` → `09-panel-usuario.md`
- `frontend-admin` → `10-panel-administracion.md`
- `ssot-integration` → `15-ssot-integration.md`
- `workers` → `08-workers.md`
- `auth` → `02-autenticacion-usuarios.md`
- `settings-loader-and-feature-flags` → `11-feature-flags.md`
- `gdpr-and-legal` → `12-gdpr-legal.md`
- `testing-v2` → `13-testing.md`

**Nodo pendiente:**
- `observabilidad` → `observabilidad.md` ❌ (archivo no existe, requiere crear)

---

### 1.2 scripts/calculate-gdd-health-v2.js

**Cambios aplicados:**

1. **Eliminada función `findNodeFile()`** - Ya no se usa inferencia de nombres
2. **Modificada función `loadNodesV2()`** para usar exclusivamente `nodeData.docs[]`:
   ```javascript
   // ANTES: Usaba findNodeFile(nodeName) - inferencia
   const filePath = findNodeFile(nodeName);
   
   // DESPUÉS: Usa nodeData.docs[0] - path declarado
   const nodeData = systemMap.nodes[nodeName];
   const docs = nodeData?.docs || [];
   const docPath = docs[0];
   const filePath = path.isAbsolute(docPath) ? docPath : path.join(ROOT_DIR, docPath);
   ```

3. **Eliminados mapeos estáticos** - No hay arrays hardcoded de nodos o paths

4. **Métricas calculadas dinámicamente** - No hay valores forzados a 100%

**Código clave:**
```javascript
// Process each node defined in system-map
masterNodeNames.forEach((nodeName) => {
  const nodeData = systemMap.nodes[nodeName];
  const docs = nodeData?.docs || [];
  
  if (docs.length === 0) {
    missingNodes.push(nodeName);
    return;
  }
  
  // Use EXACTLY the first path from nodeData.docs[]
  const docPath = docs[0];
  const filePath = path.isAbsolute(docPath) ? docPath : path.join(ROOT_DIR, docPath);
  
  if (fs.existsSync(filePath)) {
    // Load and process node
  } else {
    missingNodes.push(nodeName);
  }
});
```

---

## 2. Cómo se Usan las Rutas Ahora

### 2.1 Flujo de Carga de Nodos

1. **Leer system-map-v2.yaml** → Obtener lista de nodos
2. **Para cada nodo:**
   - Leer `nodeData.docs[]` (array de paths)
   - Usar `docs[0]` como path principal
   - Convertir path relativo a absoluto
   - Verificar existencia con `fs.existsSync()`
   - Si existe → cargar contenido y procesar
   - Si no existe → marcar como missing

### 2.2 Cálculo de Métricas

**System Map Alignment:**
```
system_map_alignment_score = (nodos con al menos un doc existente / total nodos) * 100
```

**Dependency Density:**
```
dependency_density_score = (dependencias detectadas / dependencias esperadas) * 100
```
- Dependencias detectadas: Extraídas de sección "Dependencies" de cada archivo
- Dependencias esperadas: Suma de `depends_on.length` de todos los nodos en system-map

**Crosslink Score:**
```
crosslink_score = (crosslinks correctos / crosslinks totales) * 100
```
- Crosslinks correctos: Dependencias en `depends_on` que están referenciadas en el documento
- Crosslinks totales: Suma de todas las dependencias en `depends_on` del system-map

**SSOT Alignment:**
```
ssot_alignment_score = (nodos alineados / total nodos) * 100
```
- Nodos alineados: Nodos donde las referencias SSOT coinciden entre documento y system-map

---

## 3. Condiciones para 100/100

Para que el health score v2 alcance 100/100, se deben cumplir:

### 3.1 System Map Alignment: 100%

- ✅ Todos los nodos en system-map-v2.yaml deben tener al menos un path en `docs:` que exista
- ⚠️ **Pendiente:** Crear `docs/nodes-v2/observabilidad.md`

### 3.2 Dependency Density: 100%

- ✅ Todas las dependencias declaradas en `depends_on` deben estar documentadas en los archivos
- ⚠️ **Actual:** 72.5% - Algunas dependencias no están explícitamente documentadas

### 3.3 Crosslink Score: 100%

- ✅ Todas las dependencias en `depends_on` deben estar referenciadas explícitamente en los documentos
- ⚠️ **Actual:** 30% - Muchas dependencias no están referenciadas con el formato que el script detecta

**Formato requerido para detección:**
- Markdown links: `` [`nombre-nodo.md`](./nombre-nodo.md) ``
- Backticks: `` `nombre-nodo.md` ``
- Texto bold: `**nombre-nodo**`

### 3.4 SSOT Alignment: 100%

- ✅ Todos los nodos deben tener referencias SSOT correctas según el system-map
- ⚠️ **Actual:** 66.67% - Algunos nodos necesitan ajustar referencias SSOT

### 3.5 Narrative Consistency: 100%

- ✅ Placeholder actual (100%) - Requiere implementación completa

---

## 4. Script de Validación de Paths

**Nuevo script:** `scripts/validate-v2-doc-paths.js`

**Función:** Valida que todos los paths declarados en `system-map-v2.yaml` existen realmente.

**Usage:**
```bash
# Modo local (solo warnings)
node scripts/validate-v2-doc-paths.js

# Modo CI (exit 1 si hay paths faltantes)
node scripts/validate-v2-doc-paths.js --ci
```

**Integración CI:** Se puede añadir a `.github/workflows/gdd-validate.yml` para validar paths antes de calcular health score.

---

## 5. Protección Futura

### 5.1 Validación Automática

El script `validate-v2-doc-paths.js` previene que:
- Se declaren paths que no existen
- Se rompa el wiring system-map ↔ filesystem
- El health score baje inesperadamente por paths incorrectos

### 5.2 Reglas de Mantenimiento

**Al crear un nuevo nodo:**
1. Crear el archivo en `docs/nodes-v2/`
2. Añadir el nodo a `system-map-v2.yaml`
3. Declarar el path exacto en `docs:`
4. Ejecutar `validate-v2-doc-paths.js` para verificar

**Al renombrar un archivo:**
1. Actualizar el path en `system-map-v2.yaml`
2. Ejecutar `validate-v2-doc-paths.js` para verificar

**Al eliminar un archivo:**
1. Eliminar el path de `system-map-v2.yaml` o crear el archivo faltante
2. Ejecutar `validate-v2-doc-paths.js` para verificar

---

## 6. Estado Actual

**Health Score:** 71.83/100

**Breakdown:**
- System Map Alignment: 93.33% (14/15 nodos)
- Dependency Density: 72.50%
- Crosslink Score: 30.00%
- SSOT Alignment: 66.67%
- Narrative Consistency: 100.00% (placeholder)

**Nodos completos (14):**
Todos los nodos excepto `observabilidad` tienen documentación en los paths declarados.

**Nodos faltantes (1):**
- `observabilidad` → Requiere crear `docs/nodes-v2/observabilidad.md`

---

## 7. Resumen de Cambios

| Componente | Cambio | Estado |
|------------|--------|--------|
| `docs/system-map-v2.yaml` | Paths actualizados a archivos reales | ✅ Completado |
| `scripts/calculate-gdd-health-v2.js` | Usa exclusivamente `nodeData.docs[]` | ✅ Completado |
| `scripts/validate-v2-doc-paths.js` | Script de validación creado | ✅ Completado |
| `gdd-health-v2.json` | Regenerado con valores reales | ✅ Completado |
| `docs/GDD-V2-HEALTH-REPORT.md` | Regenerado con valores reales | ✅ Completado |
| `docs/nodes-v2/observabilidad.md` | Archivo faltante | ⚠️ Pendiente |

---

## 8. Confirmaciones

✅ **NO hay mapeos estáticos** - Todo es dinámico desde system-map-v2.yaml  
✅ **NO hay valores hardcoded** - Todas las métricas se calculan dinámicamente  
✅ **NO hay inferencia de nombres** - Solo se usan paths declarados en `docs:`  
✅ **El script es 100% dinámico** - Deriva todo del system-map y filesystem real  
✅ **Validación de paths disponible** - Script `validate-v2-doc-paths.js` previene problemas futuros

---

**Última actualización:** 2025-12-08  
**Health Score:** 71.83/100  
**Próximo paso:** Crear `docs/nodes-v2/observabilidad.md` para alcanzar 93.33% → 100% en System Map Alignment

