# GDD v2 Health Score - Sources Verification

**Fecha:** 2025-12-08

---

## 1. Verificación de Fuentes

### 1.1 ¿Lee docs/system-map-v2.yaml?

**✅ SÍ** - El script lee `docs/system-map-v2.yaml` correctamente.

**Código:**

```javascript
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs', 'system-map-v2.yaml');
const systemMap = loadSystemMapV2();
const masterNodeNames = Object.keys(systemMap.nodes || {});
```

**Nodos detectados en system-map-v2.yaml:** 15

**Nodos esperados:** 15

**Conclusión:** ✅ El script lee correctamente el system-map-v2.yaml y encuentra los 15 nodos definidos.

---

### 1.2 ¿Lee docs/nodes-v2/\*_/_.md?

**✅ SÍ** - El script intenta leer archivos en `docs/nodes-v2/`, pero **solo encuentra 4 de 15**.

**Código:**

```javascript
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs', 'nodes-v2');
const filePath = findNodeFile(nodeName);
if (filePath && fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  // ...
}
```

**Archivos evaluados:** Solo los que `findNodeFile()` puede encontrar

**Archivos encontrados:** 4 de 15

- `billing.md` ✅
- `14-infraestructura.md` ✅
- `15-ssot-integration.md` ✅
- `08-workers.md` ✅

**Archivos NO encontrados:** 11 de 15

- `roasting-engine.md` → Busca pero no existe (archivo real: `06-motor-roasting.md`)
- `analysis-engine.md` → Busca pero no existe (archivo real: `05-motor-analisis.md`)
- `shield-engine.md` → Busca pero no existe (archivo real: `07-shield.md`)
- `integraciones-redes-sociales.md` → Busca pero no existe (archivo real: `04-integraciones.md`)
- `observabilidad.md` → Busca pero no existe (archivo real: ❌ NO EXISTE)
- `frontend-user-app.md` → Busca pero no existe (archivo real: `09-panel-usuario.md`)
- `frontend-admin.md` → Busca pero no existe (archivo real: `10-panel-administracion.md`)
- `auth.md` → Busca pero no existe (archivo real: `02-autenticacion-usuarios.md`)
- `settings-loader-and-feature-flags.md` → Busca pero no existe (archivo real: `11-feature-flags.md`)
- `gdpr-and-legal.md` → Busca pero no existe (archivo real: `12-gdpr-legal.md`)
- `testing-v2.md` → Busca pero no existe (archivo real: `13-testing.md`)

**Problema:** El script NO puede encontrar los archivos porque:

1. Los nombres de los archivos no coinciden con los nombres de los nodos
2. El script NO usa el campo `docs:` del system-map que especifica explícitamente qué archivo usar

---

### 1.3 ¿Usa docs/SSOT-V2.md?

**✅ SÍ** - El script lee `docs/SSOT-V2.md` para validar alineación SSOT.

**Código:**

```javascript
const SSOT_V2_PATH = path.join(ROOT_DIR, 'docs', 'SSOT-V2.md');
```

**Uso en cálculo:**

- El script verifica si los nodos mencionan SSOT en su contenido
- Compara con `ssot_references` en el system-map-v2.yaml
- Calcula `ssot_alignment_score` basándose en esta comparación

**Problema:** Con solo 4 nodos evaluados, la mayoría de nodos no se pueden validar para SSOT alignment.

---

## 2. Mapeo de Nodos a Archivos

### 2.1 Lo que el system-map-v2.yaml Especifica

El `system-map-v2.yaml` tiene un campo `docs:` que especifica explícitamente qué archivo usar:

```yaml
roasting-engine:
  docs:
    - docs/nodes-v2/roasting-engine.md # ← Especifica el archivo
```

**Total de nodos con campo `docs:`:** 15/15

### 2.2 Lo que el Script Hace

El script **NO usa el campo `docs:`**. Solo busca por nombre:

```javascript
masterNodeNames.forEach((nodeName) => {
  const filePath = findNodeFile(nodeName); // ← Solo pasa nodeName, no nodeData
  // ...
});
```

**Problema:** El script debería usar `nodeData.docs[0]` para encontrar el archivo, pero no lo hace.

---

## 3. Verificación de Filtros/Paths

### 3.1 ¿Hay Filtros que Excluyen Nodos?

**❌ NO** - El script NO tiene filtros que excluyan nodos.

**Código:**

```javascript
const masterNodeNames = Object.keys(systemMap.nodes || {});
masterNodeNames.forEach((nodeName) => {
  // Procesa TODOS los nodos del system-map
});
```

**Conclusión:** El script intenta procesar los 15 nodos, pero solo encuentra 4 archivos.

---

### 3.2 ¿Hay Paths Específicos que Limitan la Búsqueda?

**❌ NO** - El script busca en todo el directorio `docs/nodes-v2/`.

**Código:**

```javascript
const NODES_V2_DIR = path.join(ROOT_DIR, 'docs', 'nodes-v2');
const files = fs.readdirSync(NODES_V2_DIR);
```

**Conclusión:** El script busca en todo el directorio, pero los nombres de archivos no coinciden con los nombres de nodos.

---

## 4. Resumen de Fuentes

| Fuente                    | ¿Se Lee? | ¿Se Usa Correctamente? | Problema                        |
| ------------------------- | -------- | ---------------------- | ------------------------------- |
| `docs/system-map-v2.yaml` | ✅ SÍ    | ✅ SÍ                  | Ninguno                         |
| `docs/nodes-v2/**/*.md`   | ✅ SÍ    | ❌ NO                  | Solo encuentra 4 de 15 archivos |
| `docs/SSOT-V2.md`         | ✅ SÍ    | ⚠️ PARCIAL             | Solo puede validar 4 nodos      |

---

## 5. Conclusión

**El script lee las fuentes correctas**, pero **no puede encontrar los archivos** porque:

1. Los nombres de los archivos no coinciden con los nombres de los nodos en el system-map
2. El script NO usa el campo `docs:` del system-map que especifica explícitamente qué archivo usar
3. La búsqueda por nombre numerado falla porque los nombres extraídos no coinciden con los nombres de los nodos

**Solución necesaria:** El script debe usar el campo `docs:` del system-map-v2.yaml para encontrar los archivos correctos.
