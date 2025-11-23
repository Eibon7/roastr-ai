#!/usr/bin/env node
/**
 * Cursor Agent Trigger Detector
 *
 * Detecta cambios en el código y sugiere qué agent usar según el manifest.
 * Ejecutar antes de usar Composer para tener contexto claro.
 *
 * Uso:
 *   node scripts/cursor-agents/detect-triggers.js
 *   node scripts/cursor-agents/detect-triggers.js --staged  # Solo staged files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '../../agents/manifest.yaml');
const RECEIPTS_DIR = path.join(__dirname, '../../docs/agents/receipts');

// Parsear manifest YAML básico
function parseManifest() {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const agents = [];

  let currentAgent = null;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('- name:')) {
      if (currentAgent) agents.push(currentAgent);
      currentAgent = {
        name: line.replace('- name:', '').trim(),
        triggers: { labels: [], diffIncludes: [], conditions: [] },
        guardrails: []
      };
    } else if (currentAgent) {
      if (line.startsWith('labels:')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.startsWith('-')) {
          const labels = nextLine.split(',').map((l) => l.trim().replace(/["\[\]]/g, ''));
          currentAgent.triggers.labels = labels;
        }
      } else if (line.startsWith('diffIncludes:')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.startsWith('-')) {
          const files = nextLine.split(',').map((f) => f.trim().replace(/["\[\]]/g, ''));
          currentAgent.triggers.diffIncludes = files;
        }
      } else if (line.startsWith('conditions:')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.startsWith('-')) {
          const conditions = nextLine.split(',').map((c) => c.trim().replace(/["\[\]]/g, ''));
          currentAgent.triggers.conditions = conditions;
        }
      }
    }
  }

  if (currentAgent) agents.push(currentAgent);
  return agents;
}

// Detectar archivos modificados
function getChangedFiles(stagedOnly = false) {
  try {
    const command = stagedOnly ? 'git diff --cached --name-only HEAD' : 'git diff --name-only HEAD';
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return output
      .trim()
      .split('\n')
      .filter((f) => f);
  } catch (error) {
    // Si no hay cambios, retornar array vacío
    return [];
  }
}

// Detectar labels de issue actual (si estamos en una rama de issue)
function getCurrentIssueLabels() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const match = branch.match(/issue[_-]?(\d+)/i);
    if (match) {
      const issueNum = match[1];
      // Intentar obtener labels con gh CLI
      try {
        const output = execSync(`gh issue view ${issueNum} --json labels`, { encoding: 'utf8' });
        const data = JSON.parse(output);
        return data.labels.map((l) => l.name);
      } catch (e) {
        // gh CLI no disponible o issue no existe
        return [];
      }
    }
  } catch (e) {
    // No estamos en una rama de issue o git no disponible
  }
  return [];
}

// Matchear agent según triggers
function matchAgents(changedFiles, labels, agents) {
  const matches = [];

  for (const agent of agents) {
    let score = 0;
    const reasons = [];

    // Check diffIncludes
    for (const pattern of agent.triggers.diffIncludes) {
      if (changedFiles.some((f) => f.includes(pattern) || pattern.includes(f))) {
        score += 10;
        reasons.push(`Archivo modificado: ${pattern}`);
      }
    }

    // Check labels
    for (const label of agent.triggers.labels) {
      if (labels.includes(label)) {
        score += 5;
        reasons.push(`Label: ${label}`);
      }
    }

    if (score > 0) {
      matches.push({
        agent: agent.name,
        score,
        reasons,
        guardrails: agent.guardrails
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// Generar sugerencia de Composer
function generateComposerSuggestion(matches, changedFiles) {
  if (matches.length === 0) {
    return {
      message: '⚠️  No se detectaron triggers de agents específicos.',
      suggestion: 'Usa Composer normalmente con los archivos modificados.'
    };
  }

  const topMatch = matches[0];
  const relevantFiles = changedFiles.slice(0, 5).map((f) => `@${f}`);

  let composerPrompt = '';
  let workflow = '';

  switch (topMatch.agent) {
    case 'TestEngineer':
      composerPrompt = `@tests/ ${relevantFiles.join(' ')}`;
      workflow = `Generate comprehensive tests following test-generation-skill. Verify: npm test`;
      break;
    case 'FrontendDev':
      composerPrompt = `${relevantFiles.join(' ')} @docs/ui-guidelines.md`;
      workflow = `Implement feature. Visual validation: npm run playwright`;
      break;
    case 'Guardian':
      composerPrompt = `${relevantFiles.join(' ')}`;
      workflow = `Run: node scripts/guardian-gdd.js --full. Manual security audit required.`;
      break;
    default:
      composerPrompt = relevantFiles.join(' ');
      workflow = `Follow ${topMatch.agent} workflow from .cursorrules`;
  }

  return {
    agent: topMatch.agent,
    score: topMatch.score,
    reasons: topMatch.reasons,
    composerPrompt,
    workflow,
    guardrails: topMatch.guardrails
  };
}

// Crear receipt template
function createReceiptTemplate(suggestion, changedFiles) {
  const timestamp = new Date().toISOString();
  const receiptPath = path.join(
    RECEIPTS_DIR,
    `cursor-${suggestion.agent?.toLowerCase() || 'general'}-${Date.now()}.md`
  );

  if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  }

  const receipt = `## ${suggestion.agent || 'General'} Receipt (Cursor)
**Date:** ${timestamp}
**Trigger:** Auto-detected from git changes

### Files Modified:
${changedFiles.map((f) => `- ${f}`).join('\n')}

### Agent Match:
- **Agent:** ${suggestion.agent || 'N/A'}
- **Score:** ${suggestion.score || 0}
- **Reasons:** ${suggestion.reasons?.join(', ') || 'N/A'}

### Composer Workflow:
\`\`\`
Cmd+I → ${suggestion.composerPrompt || 'Select files manually'}
Prompt: ${suggestion.workflow || 'Follow standard workflow'}
\`\`\`

### Guardrails:
${suggestion.guardrails?.map((g) => `- ${g}`).join('\n') || '- None specified'}

### Status:
- [ ] Composer workflow executed
- [ ] Tests passing (if applicable)
- [ ] GDD validated (if applicable)
- [ ] Receipt completed

---
*Generated by cursor-agents/detect-triggers.js*
`;

  fs.writeFileSync(receiptPath, receipt);
  return receiptPath;
}

// Main
function main() {
  const stagedOnly = process.argv.includes('--staged');

  console.log('🔍 Cursor Agent Trigger Detector\n');

  // Parsear manifest
  const agents = parseManifest();
  console.log(`✅ Loaded ${agents.length} agents from manifest\n`);

  // Detectar cambios
  const changedFiles = getChangedFiles(stagedOnly);
  const labels = getCurrentIssueLabels();

  if (changedFiles.length === 0) {
    console.log('⚠️  No hay archivos modificados detectados.');
    console.log('   Usa --staged para revisar solo staged files.\n');
    return;
  }

  console.log(`📝 Archivos modificados (${changedFiles.length}):`);
  changedFiles.slice(0, 10).forEach((f) => console.log(`   - ${f}`));
  if (changedFiles.length > 10) {
    console.log(`   ... y ${changedFiles.length - 10} más`);
  }
  console.log();

  if (labels.length > 0) {
    console.log(`🏷️  Labels detectados: ${labels.join(', ')}\n`);
  }

  // Matchear agents
  const matches = matchAgents(changedFiles, labels, agents);

  if (matches.length === 0) {
    console.log('ℹ️  No se encontraron matches específicos de agents.');
    console.log('   Usa Composer normalmente con los archivos modificados.\n');
    return;
  }

  console.log('🎯 Agents sugeridos:\n');
  matches.forEach((match, i) => {
    console.log(`${i + 1}. ${match.agent} (score: ${match.score})`);
    match.reasons.forEach((r) => console.log(`   ✓ ${r}`));
    console.log();
  });

  // Generar sugerencia
  const suggestion = generateComposerSuggestion(matches, changedFiles);

  console.log('💡 Sugerencia de Composer:\n');
  console.log(`   Agent: ${suggestion.agent || 'General'}`);
  console.log(`   Composer: Cmd+I → ${suggestion.composerPrompt}`);
  console.log(`   Prompt: "${suggestion.workflow}"\n`);

  if (suggestion.guardrails && suggestion.guardrails.length > 0) {
    console.log('⚠️  Guardrails importantes:');
    suggestion.guardrails.slice(0, 3).forEach((g) => console.log(`   - ${g}`));
    console.log();
  }

  // Crear receipt
  const receiptPath = createReceiptTemplate(suggestion, changedFiles);
  console.log(`📋 Receipt creado: ${receiptPath}\n`);

  console.log('✅ Listo para usar Composer con el contexto sugerido.\n');
}

if (require.main === module) {
  main();
}

module.exports = { matchAgents, getChangedFiles, getCurrentIssueLabels };
