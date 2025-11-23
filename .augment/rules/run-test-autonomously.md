---
type: 'automatic'
---

Context

Actualmente, Augment solicita confirmación antes de ejecutar npm test o Jest. Queremos que las pruebas formen parte natural del flujo de desarrollo (validar cambios, confirmar correcciones, CI local) sin depender de la intervención manual.

Behavior

1. Detonantes:
   - Después de aplicar fixes sugeridos por CodeRabbit.
   - Después de implementar cualquier issue o feature.
   - Antes de preparar una PR.

2. Acciones:
   - Ejecutar automáticamente los tests (npm test o jest) sin pedir confirmación.
   - Analizar el resultado y actuar:
     - ✅ Si todos los tests pasan: continuar el flujo (cerrar tarea original, abrir PR, etc.).
     - ❌ Si fallan:
       - Intentar autocorregir el problema en 1–2 iteraciones.
       - Si aún falla → dejar la PR abierta y crear una issue detallando los fallos detectados con logs y propuestas de fix.

3. Restricciones:
   - No repetir indefinidamente: máximo 2 intentos de corrección automática.
   - Si hay flakiness (tests que fallan de forma intermitente), añadir nota en la issue.

Scope

Aplicable a todos los commits gestionados por Augment, independientemente del origen (issues, fixes, CodeRabbit).
