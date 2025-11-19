#!/usr/bin/env node
/**
 * Script de limpieza automatizada: Issue #868
 * Elimina referencias a humor_type, humorType, intensity_level de archivos específicos
 * 
 * Usage: node scripts/cleanup-humor-type.js
 */

const fs = require('fs');
const path = require('path');

// CodeRabbit feedback (3479986167): Expanded to cover ALL 35 files with references
const TARGET_FILES = [
  // Backend routes (8 files)
  'src/routes/approval.js',
  'src/routes/analytics.js',
  'src/routes/oauth.js',
  'src/routes/config.js',
  'src/routes/roast.js',
  'src/routes/user.js',
  'src/index.js',
  
  // Services (7 files)
  'src/services/roastEngine.js',
  'src/services/roastGeneratorMock.js',
  'src/services/roastGeneratorEnhanced.js',
  'src/services/roastPromptTemplate.js',
  'src/services/userIntegrationsService.js',
  'src/services/twitter.js',
  
  // Workers (1 file)
  'src/workers/GenerateReplyWorker.js',
  
  // Config (2 files)
  'src/config/integrations.js',
  'src/config/validationConstants.js',
  
  // Integrations (4 files)
  'src/integrations/base/BaseIntegration.js',
  'src/integrations/discord/discordService.js',
  'src/integrations/twitch/twitchService.js',
  
  // Lib (1 file)
  'src/lib/prompts/roastPrompt.js',
  
  // Frontend (4 files)
  'frontend/src/pages/Approval.jsx',
  'frontend/src/pages/Configuration.jsx',
  'frontend/src/components/StyleSelector.jsx',
  'frontend/src/pages/__tests__/ApprovalCard.test.jsx'
];

const REPLACEMENTS = [
  // Remove humor_type from destructuring
  {
    pattern: /const\s*\{\s*([^}]*),\s*humor_type\s*([^}]*)\}\s*=/g,
    replacement: 'const { $1$2 } ='
  },
  // Remove humorType from destructuring
  {
    pattern: /const\s*\{\s*([^}]*),\s*humorType\s*([^}]*)\}\s*=/g,
    replacement: 'const { $1$2 } ='
  },
  // Remove intensity_level from destructuring
  {
    pattern: /const\s*\{\s*([^}]*),\s*intensity_level\s*([^}]*)\}\s*=/g,
    replacement: 'const { $1$2 } ='
  },
  // Remove humor_type from object literals (single line)
  {
    pattern: /humor_type:\s*[^,\}]+,/g,
    replacement: '// Issue #868: Removed humor_type (deprecated)'
  },
  // Remove humorType from object literals (single line)
  {
    pattern: /humorType:\s*[^,\}]+,/g,
    replacement: '// Issue #868: Removed humorType (deprecated)'
  },
  // Remove intensity_level from object literals
  {
    pattern: /intensity_level:\s*[^,\}]+,?/g,
    replacement: '// Issue #868: Removed intensity_level (deprecated)'
  }
];

function cleanFile(filePath) {
  console.log(`\n📄 Processing: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found, skipping`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      changes += matches.length;
    }
  });
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ Cleaned ${changes} references`);
  } else {
    console.log(`   ✓  No changes needed`);
  }
}

console.log('🚀 Issue #868: Automated Cleanup Script');
console.log('=' .repeat(50));

TARGET_FILES.forEach(cleanFile);

// Validate syntax of modified files (CodeRabbit suggestion)
console.log('\n🔍 Validating syntax of modified files...');
const { execSync } = require('child_process');
let syntaxErrors = 0;

TARGET_FILES.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  try {
    execSync(`node --check ${filePath}`, { stdio: 'ignore' });
    console.log(`   ✓  ${filePath} syntax valid`);
  } catch (error) {
    console.log(`   ❌ ${filePath} syntax ERROR - manual fix required`);
    syntaxErrors++;
  }
});

console.log('\n' + '='.repeat(50));

if (syntaxErrors > 0) {
  console.log(`❌ Cleanup failed with ${syntaxErrors} syntax error(s)`);
  console.log('Fix syntax errors before committing.');
  process.exit(1);
}

console.log('✅ Cleanup complete! All files have valid syntax.');
console.log('\nNext steps:');
console.log('1. Review changes: git diff');
console.log('2. Run tests: npm test');
console.log('3. Commit: git add . && git commit -m "refactor: automated cleanup"');

