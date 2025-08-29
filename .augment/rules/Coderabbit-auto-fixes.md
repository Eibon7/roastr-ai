---
type: "always_apply"
---

# Rule: Apply CodeRabbit Fixes Automatically (No Auto-Merge)

## Context
Esta regla asegura que Augment procese automáticamente las sugerencias de CodeRabbit y valide que no rompan nada en el proyecto. El merge de la PR queda siempre bajo control del usuario.

## Behavior
- Cuando CodeRabbit sugiera cambios o fixes en un commit o PR:
  1. **Aplicar automáticamente** las sugerencias en el código.
  2. **Ejecutar los tests existentes** (npm test / jest) para verificar que todo sigue funcionando.
  3. Si los tests pasan:
     - Comentar en la PR que las sugerencias se aplicaron y los tests han pasado correctamente.
     - **Cerrar la issue original asociada** si corresponde.
     - Dejar la PR lista para merge manual por parte del usuario.
  4. Si los tests fallan:
     - Mantener la PR abierta.
     - Crear un comentario en GitHub resumiendo los fallos y proponiendo pasos siguientes.
- Nunca eliminar ni sobrescribir código crítico sin dejar un diff claro en la PR.
- En caso de conflicto con sugerencias de Copilot u otros agentes, **priorizar las de CodeRabbit**.

## Scope
Se aplica a todas las interacciones de Augment relacionadas con revisiones de CodeRabbit.