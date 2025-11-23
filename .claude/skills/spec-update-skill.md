---

name: spec-update-skill
description: Actualiza y formatea spec.md tras cada feature, PR o cierre de issue.
triggers:

- "spec"
- "update"
- "merge"
- "feature"
- "close issue"
  used_by:
- orchestrator
- documentation-agent
- all-agents
  steps:
- paso1: "Leer spec.md actual para entender estructura y secciones"
- paso2: "Identificar qué secciones fueron modificadas en el código"
- paso3: "Actualizar secciones relevantes con cambios implementados"
- paso4: "Normalizar formato Markdown (headings, lists, code blocks)"
- paso5: "Actualizar TOC (Table of Contents) si existe"
- paso6: "Añadir entrada de changelog con formato estándar"
- paso7: "Validar coherencia con nodos GDD en docs/nodes/"
- paso8: "Verificar que no hay conflictos con documentación existente"
- paso9: "Validar sintaxis Markdown (headings anidados, links, etc)"
  output: |
- spec.md actualizado con cambios
- Changelog entry: docs/changelog/issue-{id}.md
- Validación de coherencia con nodos GDD
  secciones_especiales:
- "Agentes Relevantes": "Actualizar al invocar agentes"
- "Node-Agent Matrix": "Sincronizar tabla global"
- "Coverage": "Verificar Source: auto"
- "Architecture": "Actualizar diagramas y flujos"
  formato_changelog:
- template: | ## Issue #{id}: {título}
        **Fecha**: {fecha}
        **Tipo**: {Feature|Bug|Test|Docs|Refactor}
        **Prioridad**: {P0|P1|P2}

        ### Cambios
        - {descripción del cambio}

        ### Archivos Modificados
        - {lista de archivos}

        ### Tests
        - {cobertura de tests}

        ### Nodos GDD Afectados
        - {nodos actualizados}

        ### Agentes Involucrados
        - {agentes que trabajaron}
  estructura_spec:
- "Sección 1: Overview"
- "Sección 2: Architecture"
- "Sección 3: Features"
- "Sección 4: Testing"
- "Sección 5: Deployment"
- "Sección 6: Agentes Relevantes"
- "Sección 7: Node-Agent Matrix"
- "Sección 8: Changelog"
  reglas_formato:
- "Headings deben seguir jerarquía (## para secciones, ### para subsecciones)"
- "Listas usar - para bullets, números para ordered"
- "Code blocks con lenguaje especificado (```language)"
- "Links usar formato [texto](ruta)"
- "Tablas con pipes | para separar columnas"
- "No dejar líneas vacías innecesarias"
  validacion:
- "¿Coherente con nodos GDD?"
- "¿Changelog completo?"
- "¿TOC actualizado?"
- "¿Sin conflictos con docs existentes?"
- "¿Headings bien formateados?"
- "¿Links válidos?"
  ejemplos:
- contexto: "Issue #500: Se añadió feature de User Profile"
  cambios_spec: |
  ## Features
  - User Profile con avatar, stats y actividad (Issue #500)
  ## Architecture
  - Nuevo endpoint: GET /api/user/profile
  - Nuevo componente: UserProfile.jsx
- contexto: "Issue #600: Fix de seguridad en auth"
  cambios_spec: | ## Security - Validación mejorada de tokens JWT - Rate limiting añadido a endpoints de login
        ## Tests
        - Cobertura aumentada: 95% en auth flows
  coherencia_gdd:
- validar: "¿Los nodos en docs/nodes/ coinciden con spec.md?"
- validar: "¿Coverage source es auto?"
- validar: "¿Agentes Relevantes están actualizados?"
- accion: "Si hay inconsistencia → actualizar nodos primero, luego spec.md"
  referencias:
- "spec.md - Archivo principal"
- "docs/nodes/ - Nodos GDD"
- "docs/changelog/ - Historial"
- "CLAUDE.md - Documentación general"
