# Claude Skills - Roastr AI

Esta carpeta contiene **Skills** (Habilidades) de Claude para el proyecto Roastr AI. Las skills son extensiones que mejoran el comportamiento de Claude cuando trabaja en tareas específicas.

## ¿Qué son las Skills?

Las Skills de Claude son instrucciones especializadas que se cargan automáticamente cuando el contexto las requiere. Claude decide cuándo usar una skill basándose en la descripción y el contexto de la conversación.

## Estructura de una Skill

```text
nombre-de-la-skill/
├── SKILL.md          # Archivo principal con metadatos y contenido
├── examples.md       # Ejemplos opcionales de uso
└── reference.md      # Referencias adicionales opcionales
```

### SKILL.md - Estructura Requerida

Cada skill debe tener un archivo `SKILL.md` con:

```markdown
---
name: Nombre de la Skill
description: Breve descripción que determina cuándo se activará
---

# Nombre de la Skill

## Instrucciones
[Guía clara paso a paso para Claude]

## Ejemplos
[Ejemplos concretos de uso]
```

## Skills Actuales

### GDD (Graph Driven Development)

**Ubicación**: `gdd/`

**Propósito**: Carga contexto GDD para un issue específico (FASE 0).

**Cuándo se activa**: Al iniciar desarrollo de cualquier issue que requiera contexto arquitectónico.

**Uso**:
```bash
/gdd 680  # Carga contexto para issue #680
```

**Output**: Nodos GDD cargados, patrones conocidos, checklist pre-implementación.

**Relacionado**: `docs/GDD-FRAMEWORK.md` - Framework completo

---

### GDD Sync

**Ubicación**: `gdd-sync.md`

**Propósito**: Sincroniza nodos modificados → spec.md (FASE 4).

**Cuándo se activa**: Post-merge automático o manual tras implementación.

**Uso**:
```bash
# Automático: workflow post-merge-doc-sync.yml
# Manual: "Sync nodes to spec.md"
```

**Output**: spec.md actualizado, metadata sincronizada, reporte de sync.

**Relacionado**: `.github/workflows/post-merge-doc-sync.yml`

---

### Code Review Helper

**Ubicación**: `code-review-helper/`

**Propósito**: Ayuda a realizar revisiones de código completas antes de crear PRs.

**Cuándo se activa**: Cuando necesites revisar código para asegurar calidad, seguridad y documentación.

**Uso**:
```bash
# Revisar el código de esta feature para validar calidad
```

## Configuración

Las skills se cargan automáticamente gracias a la configuración en `.claude/settings.local.json`:

```json
{
  "setting_sources": [
    "project",  // Carga skills desde .claude/skills/
    "user"     // Carga skills desde ~/.claude/skills/
  ]
}
```

## Crear una Nueva Skill

1. Crea un directorio en `.claude/skills/nombre-de-tu-skill/`
2. Crea el archivo `SKILL.md` con metadatos YAML y contenido
3. Añade archivos opcionales (examples.md, reference.md, etc.)
4. Documenta la skill en este README

### Ejemplo de Creación

```bash
mkdir -p .claude/skills/nueva-skill
cat > .claude/skills/nueva-skill/SKILL.md << 'EOF'
---
name: Nueva Skill
description: Descripción de cuándo usar esta skill
---

# Nueva Skill

## Instrucciones
[Tu contenido aquí]

## Ejemplos
[Ejemplos de uso]
EOF
```

## Referencias

- [Documentación oficial de Claude Skills](https://docs.claude.com/es/docs/claude-code/skills)
- `docs/QUALITY-STANDARDS.md` - Estándares de calidad del proyecto
- `CLAUDE.md` - Configuración general de Claude

