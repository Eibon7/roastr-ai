# 🛡️ Protección del Archivo .env

## Problema Identificado

El archivo `.env` fue eliminado accidentalmente durante el desarrollo, causando que el proyecto no pudiera ejecutarse correctamente. Este archivo contiene variables de entorno críticas para el funcionamiento del sistema.

**Fecha del incidente:** 12 Nov 2025  
**Impacto:** Pérdida de configuración local de desarrollo  
**Causa raíz:** No existían salvaguardas que verificaran la existencia de `.env`

---

## Solución Implementada

### 1. Script de Verificación Automática

**Ubicación:** `scripts/verify-env-exists.js`

**Funcionalidad:**

- ✅ Verifica que `.env` existe antes de commits
- 💾 Crea backups automáticos con timestamp
- 🗑️ Mantiene solo los últimos 5 backups (limpieza automática)
- 🔧 Puede recrear `.env` desde `.env.example` si falta
- 📊 Reporte claro de estado

**Ejecución manual:**

```bash
# Verificar si .env existe
npm run verify:env

# Verificar y crear si falta
npm run verify:env:create

# Crear backup silencioso (útil para scripts)
npm run backup:env
```

---

### 2. Integración en Git Hooks

**Hook actualizado:** `.git/hooks/pre-commit`

**Verificaciones agregadas:**

1. ✅ Verificar que `.env` existe **ANTES** de cualquier commit
2. 💾 Crear backup automático de `.env`
3. 🔒 Verificar que estás en la rama correcta (`.issue_lock`)

**Resultado:** Si `.env` falta, el commit se bloquea con instrucciones claras.

---

### 3. Sistema de Backups Automáticos

**Estrategia de backups:**

- 💾 Backup automático en cada verificación exitosa
- 📅 Nombre con timestamp: `.env.backup-2025-11-12T11-39-00`
- 🗑️ Rotación automática: solo los últimos 5 backups se mantienen
- 🚀 Sin intervención manual necesaria

**Ubicación de backups:**

```
.env.backup-2025-11-12T11-39-00  ← Más reciente
.env.backup-2025-11-11T14-20-15
.env.backup-2025-11-10T09-45-30
.env.backup-2025-11-09T16-12-45
.env.backup-2025-11-08T10-05-20  ← Más antiguo (se eliminará en próximo backup)
```

---

### 4. Comandos NPM Agregados

**En `package.json`:**

```json
{
  "scripts": {
    "verify:env": "node scripts/verify-env-exists.js",
    "verify:env:create": "node scripts/verify-env-exists.js --create-if-missing",
    "backup:env": "node scripts/verify-env-exists.js --silent"
  }
}
```

---

## Workflow de Uso

### Para Desarrolladores Nuevos

**Al clonar el repositorio:**

```bash
git clone <repo>
cd roastr-ai
npm run verify:env:create  # Crea .env desde .env.example
```

### Durante Desarrollo

**Antes de commits (automático):**

```bash
git add .
git commit -m "..."
# ← Git hook verifica .env automáticamente
# ← Crea backup si pasa la verificación
```

**Verificación manual:**

```bash
npm run verify:env
```

### Recuperación de Desastre

**Si `.env` se pierde:**

**Opción 1: Recrear desde example**

```bash
npm run verify:env:create
```

**Opción 2: Restaurar desde backup**

```bash
# Listar backups disponibles
ls .env.backup-*

# Restaurar el más reciente
cp .env.backup-2025-11-12T11-39-00 .env
```

---

## Política de Seguridad

### ✅ PERMITIDO

- Crear `.env` desde `.env.example`
- Modificar `.env` localmente
- Crear backups manuales adicionales
- Restaurar desde backups

### ❌ PROHIBIDO

- Commitear `.env` al repositorio (protegido por `.gitignore`)
- Compartir `.env` entre desarrolladores (cada uno tiene el suyo)
- Subir `.env` a Slack, Discord, o cualquier medio público
- Hardcodear valores de `.env` en el código

---

## Integración con CI/CD

**GitHub Actions:** Los workflows en CI deben usar secrets de GitHub, NO el archivo `.env`.

**Variables en CI:**

- Se configuran en: Settings → Secrets and variables → Actions
- Se acceden como: `${{ secrets.VARIABLE_NAME }}`
- NO se usan archivos `.env` en CI

---

## Troubleshooting

### Error: ".env no encontrado"

**Síntoma:**

```
❌ .env NO ENCONTRADO
⚠️  ACCIÓN REQUERIDA:
   Crea .env ejecutando: cp .env.example .env
```

**Solución:**

```bash
npm run verify:env:create
```

---

### Error: "Git hook blocking commit"

**Síntoma:**

```
❌ .env no encontrado. Ejecuta: cp .env.example .env
```

**Solución:**

```bash
npm run verify:env:create
git add .env
git commit -m "..."
```

---

### Backups no se crean

**Verificar permisos:**

```bash
ls -l scripts/verify-env-exists.js
# Debe tener: -rwxr-xr-x (ejecutable)
```

**Arreglar si es necesario:**

```bash
chmod +x scripts/verify-env-exists.js
```

---

## Mantenimiento

### Limpieza Manual de Backups

**Si necesitas liberar espacio:**

```bash
# Ver tamaño total de backups
du -sh .env.backup-*

# Eliminar backups antiguos (más de 30 días)
find . -name ".env.backup-*" -mtime +30 -delete
```

### Actualización de .env.example

**Cuando agregas nuevas variables:**

1. Añade la variable a `.env.example` con valor de ejemplo
2. Documenta la variable en comentarios
3. Actualiza este documento si es crítica

```bash
# .env.example
# Nueva variable para feature X
NEW_FEATURE_API_KEY=your_api_key_here  # Obtener en: https://example.com/api
```

---

## Testing

**Verificar que el sistema funciona:**

```bash
# 1. Simular pérdida de .env
mv .env .env.temp

# 2. Intentar commit (debe fallar)
git add README.md
git commit -m "test"
# Resultado esperado: ❌ .env no encontrado

# 3. Verificar auto-recreación
npm run verify:env:create

# 4. Restaurar
mv .env.temp .env
```

---

## Historial de Cambios

| Fecha      | Versión | Cambio                                    |
| ---------- | ------- | ----------------------------------------- |
| 2025-11-12 | 1.0.0   | Implementación inicial de protección .env |
|            |         | - Script verify-env-exists.js             |
|            |         | - Integración en pre-commit hook          |
|            |         | - Sistema de backups automáticos          |
|            |         | - Comandos NPM                            |

---

## Referencias

- **Script principal:** `scripts/verify-env-exists.js`
- **Hook:** `.git/hooks/pre-commit`
- **Package.json:** Líneas 106-108
- **Ejemplo:** `.env.example`
- **Gitignore:** `.gitignore` (línea 8: `.env`)

---

## Responsabilidades

| Rol               | Responsabilidad                                |
| ----------------- | ---------------------------------------------- |
| **Desarrollador** | Mantener `.env` actualizado localmente         |
| **Tech Lead**     | Actualizar `.env.example` con nuevas variables |
| **DevOps**        | Configurar secrets en GitHub Actions           |
| **Git Hooks**     | Verificar `.env` antes de commits              |
| **Script**        | Crear backups automáticos                      |

---

## FAQ

**Q: ¿Debo commitear `.env`?**  
A: ❌ NO. `.env` está en `.gitignore` y NUNCA debe subirse al repositorio.

**Q: ¿Qué hago si pierdo mi `.env`?**  
A: Ejecuta `npm run verify:env:create` o restaura desde backup más reciente.

**Q: ¿Cuántos backups se mantienen?**  
A: Los últimos 5 backups. Los más antiguos se eliminan automáticamente.

**Q: ¿Puedo desactivar la verificación?**  
A: ❌ NO recomendado. Es una salvaguarda crítica.

**Q: ¿Cómo comparto configuración con el equipo?**  
A: Actualiza `.env.example` (sin valores reales) y commitea esos cambios.

**Q: ¿Funciona en Windows?**  
A: ✅ Sí. El script es multiplataforma (Node.js).

---

**📋 Documento creado:** 12 Nov 2025  
**✍️ Autor:** Roastr Development Team  
**🔄 Última actualización:** 12 Nov 2025  
**📌 Versión:** 1.0.0
