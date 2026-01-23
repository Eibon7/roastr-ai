---
description: "Parsear PRD y generar subtareas desde Acceptance Criteria"
tags: ["loop", "prd", "parser", "subtasks"]
---

# Loop: Parsear PRD

Parsea un PRD (Product Requirements Document) y genera subtareas desde los Acceptance Criteria.

## Uso Básico

```bash
node -e "
const {parsePRD} = require('./scripts/loop/lib/prd-parser');
const prd = parsePRD('docs/prd/my-feature.md');
console.log(JSON.stringify(prd, null, 2));
"
```

## Formato de PRD

```markdown
# PRD: Feature X

**Estado:** En desarrollo
**Fecha:** 2026-01-22

---

## Objetivos

- Objetivo 1
- Objetivo 2

---

## Acceptance Criteria

### AC1: Título del AC

- [ ] Checklist item 1
- [ ] Checklist item 2

### AC2: Otro AC

- [ ] Checklist item

---

## Out of Scope

- Item fuera de scope

---

## Technical Notes

- Nota técnica 1
```

## Parsear PRD

### Extraer todo

```javascript
const {parsePRD} = require('./scripts/loop/lib/prd-parser');

const prd = parsePRD('docs/prd/example-roast-v2-endpoint.md');

console.log('Título:', prd.title);
console.log('Objetivos:', prd.objectives);
console.log('ACs:', prd.acceptanceCriteria.length);
console.log('Subtareas:', prd.subtasks.length);
```

### Extraer solo ACs

```javascript
const {extractAcceptanceCriteria} = require('./scripts/loop/lib/prd-parser');
const fs = require('fs');

const content = fs.readFileSync('docs/prd/my-feature.md', 'utf-8');
const acs = extractAcceptanceCriteria(content);

acs.forEach(ac => {
  console.log(`${ac.id}: ${ac.title}`);
  console.log(`  Items: ${ac.checklist.length}`);
  console.log(`  Completados: ${ac.checklist.filter(i => i.completed).length}`);
});
```

## Generar Subtareas

```javascript
const {parsePRD} = require('./scripts/loop/lib/prd-parser');

const prd = parsePRD('docs/prd/my-feature.md');

prd.subtasks.forEach(subtask => {
  console.log(`\n📋 Subtask: ${subtask.id}`);
  console.log(`   AC: ${subtask.acId}`);
  console.log(`   Title: ${subtask.title}`);
  console.log(`   Status: ${subtask.status}`);
  console.log(`   Checklist:`);
  
  subtask.checklist.forEach(item => {
    const check = item.completed ? '✅' : '⬜';
    console.log(`     ${check} ${item.item}`);
  });
});
```

## Validar Scope

```javascript
const {parsePRD, isInScope} = require('./scripts/loop/lib/prd-parser');

const prd = parsePRD('docs/prd/my-feature.md');

const tasks = [
  'Crear endpoint POST /api/v2/roast',
  'Integrar con roasting-engine',
  'UI para el endpoint', // Out of scope
];

tasks.forEach(task => {
  const inScope = isInScope(prd, task);
  const status = inScope ? '✅ In scope' : '❌ Out of scope';
  console.log(`${status}: ${task}`);
});
```

## Actualizar Progreso

### Marcar item del checklist

```javascript
const {updateACProgress} = require('./scripts/loop/lib/prd-parser');

// Marcar primer item de AC1 como completado
updateACProgress('docs/prd/my-feature.md', 'AC1', 0);
```

### Marcar AC completo

```javascript
const {markACComplete} = require('./scripts/loop/lib/prd-parser');

// Marcar todos los items de AC1 como completados
markACComplete('docs/prd/my-feature.md', 'AC1');
```

## Integración con Loop

### Ejecutar tarea con PRD

```bash
node scripts/loop/execute-task.js \
  --task-id="roast-v2-ac1" \
  --description="Implementar AC1: Crear endpoint" \
  --prd="docs/prd/example-roast-v2-endpoint.md" \
  --instruction="mkdir -p apps/backend-v2/src/routes && touch apps/backend-v2/src/routes/roast.ts"
```

### Script helper: Generar tareas desde PRD

```bash
#!/bin/bash
# save as: scripts/generate-tasks-from-prd.sh

PRD_PATH=$1

if [ -z "$PRD_PATH" ]; then
  echo "Usage: $0 <prd-path>"
  exit 1
fi

node -e "
const {parsePRD} = require('./scripts/loop/lib/prd-parser');
const prd = parsePRD('$PRD_PATH');

console.log('PRD:', prd.title);
console.log('Total subtasks:', prd.subtasks.length);
console.log('');

prd.subtasks.forEach((st, idx) => {
  console.log(\`Task \${idx + 1}: \${st.id}\`);
  console.log(\`  AC: \${st.acId}\`);
  console.log(\`  Title: \${st.title}\`);
  console.log(\`  Checklist: \${st.checklist.length} items\`);
  console.log('');
  console.log('  Loop command:');
  console.log(\`  node scripts/loop/execute-task.js \\\\\`);
  console.log(\`    --task-id=\"\${st.id}\" \\\\\`);
  console.log(\`    --description=\"\${st.description}\" \\\\\`);
  console.log(\`    --prd=\"$PRD_PATH\" \\\\\`);
  console.log(\`    --instruction=\"...\"\`);
  console.log('');
});
"
```

**Usar:**
```bash
chmod +x scripts/generate-tasks-from-prd.sh
./scripts/generate-tasks-from-prd.sh docs/prd/my-feature.md
```

## Output Example

```json
{
  "path": "docs/prd/example-roast-v2-endpoint.md",
  "title": "Roast V2 Endpoint",
  "objectives": [
    "Crear endpoint RESTful para generación de roasts en V2",
    "Integrar con roasting-engine V2",
    "Asegurar compatibilidad con Polar billing"
  ],
  "acceptanceCriteria": [
    {
      "id": "AC1",
      "title": "Crear endpoint POST /api/v2/roast",
      "checklist": [
        { "item": "Endpoint POST /api/v2/roast implementado", "completed": false },
        { "item": "Validación de input", "completed": false }
      ]
    }
  ],
  "outOfScope": [
    "UI para el endpoint",
    "Deployment automático a producción"
  ],
  "technicalNotes": [
    "Usar apps/backend-v2/src/routes/roast.ts",
    "Seguir convenciones V2"
  ],
  "subtasks": [
    {
      "id": "subtask-ac1",
      "acId": "AC1",
      "title": "Crear endpoint POST /api/v2/roast",
      "description": "Implementar Crear endpoint POST /api/v2/roast",
      "status": "pending",
      "completed": false,
      "checklist": [...]
    }
  ]
}
```

## Referencias

- **Tests:** `tests/loop/prd-parser.test.js`
- **PRD Ejemplo:** `docs/prd/example-roast-v2-endpoint.md`
- **Arquitectura:** `docs/loop/ARCHITECTURE.md`

---

**Versión:** 1.0  
**Estado:** ✅ Operacional
