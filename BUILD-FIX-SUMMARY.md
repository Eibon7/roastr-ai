# Build Fix Summary - ROA-328

**Fecha:** 2025-12-15  
**Issue:** Build Check failing en CI  
**Causa:** Peer dependencies faltantes en `frontend/package-lock.json`

---

## 🚨 Problema Detectado

### Error en CI
```
npm error `npm ci` can only install packages when your package.json 
and package-lock.json are in sync.

npm error Missing: @testing-library/dom@10.4.1 from lock file
npm error Missing: @types/aria-query@5.0.4 from lock file
npm error Missing: dom-accessibility-api@0.5.16 from lock file
npm error Missing: lz-string@1.5.0 from lock file
npm error Missing: pretty-format@27.5.1 from lock file
npm error Missing: ansi-regex@5.0.1 from lock file
npm error Missing: ansi-styles@5.2.0 from lock file
npm error Missing: react-is@17.0.2 from lock file
```

### Logs de CI
```
Build Check / Install frontend deps (lockfile-first with fallback)
npm ci FAILED
⚠️ npm ci failed, falling back to npm install for diagnostics
npm install SUCCESS (501 packages)
##[error]Process completed with exit code 1.
```

---

## 🔍 Diagnóstico

### Causa Raíz
En el commit anterior (`f54107cb`) intentamos **optimizar** el lockfile removiendo peer dependencies:

```bash
# Lo que hicimos (INCORRECTO)
cd frontend
rm -f package-lock.json
npm install --package-lock-only --legacy-peer-deps  # ❌ Removió peer deps necesarias
```

**Resultado:** El lockfile quedó "optimizado" pero **incompatible con `npm ci`** porque:
1. `package.json` declara `@testing-library/react` como devDependency
2. `@testing-library/react` requiere `@testing-library/dom` como peer dependency
3. `--legacy-peer-deps` ignora peer deps → lockfile incompleto
4. `npm ci` requiere lockfile completo → BUILD FAIL

---

## ✅ Solución Aplicada

### Fix
```bash
cd frontend
rm -f package-lock.json
npm install --package-lock-only  # ✅ SIN --legacy-peer-deps

# Cambios aplicados:
✅ Restauradas peer dependencies necesarias:
   - @testing-library/dom@10.4.1
   - @types/aria-query@5.0.4
   - dom-accessibility-api@0.5.16
   - lz-string@1.5.0
   - pretty-format@27.5.1
   - ansi-regex@5.0.1
   - ansi-styles (actualizada a 5.2.0)
   - react-is@17.0.2

✅ Lockfile ahora compatible con npm ci
✅ +84 líneas (peer deps restauradas)
```

### Commit
```bash
git add frontend/package-lock.json
git commit -m "fix(ROA-328): Restore peer dependencies in frontend/package-lock.json for npm ci compatibility"
git push origin feature/ROA-328-auto-clean
```

**Commit hash:** `503dbcf2`

---

## 📊 Verificación

### Diferencias Aplicadas
```diff
+ "node_modules/@testing-library/dom": {
+   "version": "10.4.1",
+   "dev": true,
+   "license": "MIT",
+   "peer": true,
+   ...
+ },
+ "node_modules/@types/aria-query": {
+   "version": "5.0.4",
+   ...
+ },
+ "node_modules/dom-accessibility-api": {
+   "version": "0.5.16",
+   ...
+ },
```

### Estado Esperado
```bash
# En CI, esto debería pasar ahora:
npm ci
✅ SUCCESS (todas las peer deps presentes)
```

---

## 🎓 Lecciones Aprendidas

### ❌ NO Hacer
```bash
# NUNCA usar --legacy-peer-deps para lockfiles de producción
npm install --package-lock-only --legacy-peer-deps  # ❌ Incompatible con npm ci
```

### ✅ SÍ Hacer
```bash
# SIEMPRE generar lockfile completo para npm ci
npm install --package-lock-only  # ✅ Incluye todas las peer deps

# O si hay conflictos de peer deps reales:
npm install --package-lock-only --legacy-peer-deps  # Solo si es necesario
# PERO entonces también usar en CI:
npm ci --legacy-peer-deps  # Debe coincidir
```

### Regla de Oro
> **`npm ci` requiere que el lockfile refleje EXACTAMENTE lo que `npm install` instalaría.**
> 
> Si usas flags especiales al generar el lockfile (`--legacy-peer-deps`), 
> debes usar los mismos flags en `npm ci`.

---

## 📋 Checklist de Validación

### Pre-Commit (Local)
- [x] `npm install --package-lock-only` (sin flags especiales)
- [x] `git diff package-lock.json` (revisar cambios)
- [x] Verificar que peer deps están presentes
- [x] Commit y push

### CI (Automático)
- [ ] ⏳ `npm ci` debe pasar (sin flags especiales)
- [ ] ⏳ Build Check debe pasar
- [ ] ⏳ Frontend tests deben ejecutarse

---

## 🔄 Timeline de Fixes

| Commit | Acción | Resultado |
|--------|--------|-----------|
| `f54107cb` | Optimizar lockfile con `--legacy-peer-deps` | ❌ Build fail (peer deps faltantes) |
| `436894e5` | Documentación de optimización | ℹ️ Documentación |
| `503dbcf2` | **Restaurar peer deps (este fix)** | ✅ Lockfile completo |

---

## 🚀 Próximos Pasos

1. ⏳ **Esperar CI run** - Debe pasar ahora
2. 🔍 **Verificar `npm ci` pasa** - Sin errores de peer deps
3. ✅ **Build Check pasa** - Frontend build exitoso
4. ✅ **Tests pasan** - Frontend tests con Vitest

---

## 🎯 Estado Actual

**Commit actual:** `503dbcf2`  
**Branch:** `feature/ROA-328-auto-clean`  
**PR:** #1148  
**Esperando:** Nueva ejecución de CI

**Predicción:** ✅ Build Check debería pasar ahora

---

**Conclusión:** El error de `npm ci` fue causado por usar `--legacy-peer-deps` al generar el lockfile. Fix aplicado restaurando peer dependencies necesarias. CI debería pasar en el próximo run.

