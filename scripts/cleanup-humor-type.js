#!/usr/bin/env node
/**
 * Script de limpieza automatizada: Issue #868
 * Elimina referencias a humor_type, humorType, intensity_level de archivos específicos
 * 
 * Usage: node scripts/cleanup-humor-type.js
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
  'src/routes/approval.js',
  'src/routes/analytics.js',
  'src/routes/oauth.js',
  'src/routes/config.js',
  'src/lib/prompts/roastPrompt.js'
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

console.log('\n' + '='.repeat(50));
console.log('✅ Cleanup complete!');
console.log('\nNext steps:');
console.log('1. Review changes: git diff');
console.log('2. Run tests: npm test');
console.log('3. Commit: git add . && git commit -m "refactor: automated cleanup"');

