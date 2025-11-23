#!/usr/bin/env node

/**
 * Replace console.log with logger - Issue #971
 * 
 * This script replaces console.log/warn/error with logger.info/warn/error
 * Excludes CLI tools which legitimately use console.log for user output
 * 
 * Usage:
 *   node scripts/replace-console-logs.js --dry-run  # Preview changes
 *   node scripts/replace-console-logs.js            # Apply changes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CLI argument parsing
const isDryRun = process.argv.includes('--dry-run');

// Exclusion patterns (CLI tools should use console.log)
const EXCLUDE_PATHS = [
  'src/cli.js', // Main CLI entry point
  'src/cli/', // CLI tools directory
  'src/workers/cli/', // Worker CLI tools
  'src/integrations/cli/', // Integration CLI tools (Issue #971)
  'src/utils/logger.js', // Logger itself (Issue #971 - avoid circular import)
  'node_modules/',
  'coverage/',
  'dist/',
  '.git/'
];

// Statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: {
    'console.log': 0,
    'console.warn': 0,
    'console.error': 0
  },
  filesWithMissingImport: 0
};

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATHS.some(exclude => filePath.includes(exclude));
}

/**
 * Find all JS files in src/
 */
function findJSFiles(dir = 'src') {
  let files = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (shouldExclude(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files = files.concat(findJSFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * Check if file has logger import
 */
function hasLoggerImport(content) {
  const loggerImportPatterns = [
    // Destructured require with various paths
    /const\s+{\s*logger\s*}\s*=\s*require\(['"](\.\.\/)*utils\/logger['"]\)/,
    /const\s+{\s*logger\s*}\s*=\s*require\(['"]\.\/logger['"]\)/, // ./logger (Issue #971)
    /const\s+{\s*logger\s*}\s*=\s*require\(['"]\.\.\/logger['"]\)/, // ../logger
    // Default require
    /const\s+logger\s*=\s*require\(['"](\.\.\/)*utils\/logger['"]\)/,
    /const\s+logger\s*=\s*require\(['"]\.\/logger['"]\)/,
    /const\s+logger\s*=\s*require\(['"]\.\.\/logger['"]\)/,
    // ES6 imports
    /import\s+{\s*logger\s*}\s+from\s+['"](\.\.\/)*utils\/logger['"]/,
    /import\s+logger\s+from\s+['"](\.\.\/)*utils\/logger['"]/
  ];
  
  return loggerImportPatterns.some(pattern => pattern.test(content));
}

/**
 * Calculate relative path to logger from file
 */
function getLoggerImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const loggerPath = 'src/utils/logger.js';
  
  const relative = path.relative(fileDir, loggerPath);
  // Convert to Unix-style path and remove .js extension
  return './' + relative.replace(/\\/g, '/').replace(/\.js$/, '');
}

/**
 * Add logger import if missing
 */
function addLoggerImport(content, filePath) {
  // Don't add if already present
  if (hasLoggerImport(content)) {
    return content;
  }
  
  const loggerPath = getLoggerImportPath(filePath);
  const importStatement = `const { logger } = require('${loggerPath}'); // Issue #971: Added for console.log replacement\n`;
  
  // Find first require statement and insert after it
  const requirePattern = /^(.*require\(['"]).+$/m;
  const match = content.match(requirePattern);
  
  if (match) {
    // Insert after first require
    const insertIndex = content.indexOf(match[0]) + match[0].length + 1;
    return content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
  } else {
    // No requires found, insert at top after comments/docstrings
    const lines = content.split('\n');
    let insertLine = 0;
    
    // Skip initial comments and docstrings
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('/*')) inComment = true;
      if (line.endsWith('*/')) {
        inComment = false;
        insertLine = i + 1;
        continue;
      }
      if (inComment || line.startsWith('//') || line.startsWith('*') || line === '') {
        insertLine = i + 1;
        continue;
      }
      break;
    }
    
    lines.splice(insertLine, 0, importStatement);
    return lines.join('\n');
  }
}

/**
 * Replace console calls with logger
 */
function replaceConsoleCalls(content) {
  let modified = content;
  let replacementsMade = {
    'console.log': 0,
    'console.warn': 0,
    'console.error': 0
  };
  
  // Replace console.log → logger.info
  const logPattern = /console\.log\(/g;
  const logMatches = (content.match(logPattern) || []).length;
  if (logMatches > 0) {
    modified = modified.replace(logPattern, 'logger.info(');
    replacementsMade['console.log'] = logMatches;
  }
  
  // Replace console.warn → logger.warn
  const warnPattern = /console\.warn\(/g;
  const warnMatches = (content.match(warnPattern) || []).length;
  if (warnMatches > 0) {
    modified = modified.replace(warnPattern, 'logger.warn(');
    replacementsMade['console.warn'] = warnMatches;
  }
  
  // Replace console.error → logger.error
  const errorPattern = /console\.error\(/g;
  const errorMatches = (content.match(errorPattern) || []).length;
  if (errorMatches > 0) {
    modified = modified.replace(errorPattern, 'logger.error(');
    replacementsMade['console.error'] = errorMatches;
  }
  
  return { modified, replacementsMade };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  stats.filesScanned++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has console.log/warn/error
    const hasConsoleCalls = /console\.(log|warn|error)\(/.test(content);
    
    if (!hasConsoleCalls) {
      return; // Nothing to do
    }
    
    // Replace console calls
    const { modified: contentAfterReplace, replacementsMade } = replaceConsoleCalls(content);
    
    // Add logger import if needed (check AFTER replacements, not original content)
    const needsImport = !hasLoggerImport(contentAfterReplace); // Issue #971: Fixed - check after replacements
    const finalContent = needsImport 
      ? addLoggerImport(contentAfterReplace, filePath)
      : contentAfterReplace;
    
    // Track statistics
    if (finalContent !== content) {
      stats.filesModified++;
      Object.keys(replacementsMade).forEach(key => {
        stats.replacements[key] += replacementsMade[key];
      });
      
      if (needsImport) {
        stats.filesWithMissingImport++;
      }
      
      // Log change
      console.log(`\n📝 ${filePath}`);
      Object.entries(replacementsMade).forEach(([type, count]) => {
        if (count > 0) {
          let replacement = type.replace('console.log', 'logger.info')
                                .replace('console.warn', 'logger.warn')
                                .replace('console.error', 'logger.error');
          console.log(`   ${type} → ${replacement}: ${count} occurrences`);
        }
      });
      
      if (needsImport) {
        console.log(`   ✅ Added logger import`);
      }
      
      // Write file (unless dry-run)
      if (!isDryRun) {
        fs.writeFileSync(filePath, finalContent, 'utf8');
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Replace console.log with logger - Issue #971\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  console.log('📂 Scanning src/ for console.log/warn/error...\n');
  console.log(`⚠️  Excluding: ${EXCLUDE_PATHS.join(', ')}\n`);
  
  // Find and process files
  const files = findJSFiles('src');
  
  console.log(`Found ${files.length} JavaScript files\n`);
  console.log('═'.repeat(60));
  
  files.forEach(processFile);
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary:\n');
  console.log(`   Files scanned:       ${stats.filesScanned}`);
  console.log(`   Files modified:      ${stats.filesModified}`);
  console.log(`   Imports added:       ${stats.filesWithMissingImport}`);
  console.log(`\n   Replacements:`);
  console.log(`   - console.log:       ${stats.replacements['console.log']} → logger.info`);
  console.log(`   - console.warn:      ${stats.replacements['console.warn']} → logger.warn`);
  console.log(`   - console.error:     ${stats.replacements['console.error']} → logger.error`);
  console.log(`   - Total:             ${Object.values(stats.replacements).reduce((a, b) => a + b, 0)}`);
  
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN - No files were modified');
    console.log('   Run without --dry-run to apply changes\n');
  } else {
    console.log('\n✅ Changes applied successfully\n');
    
    // Count remaining console.log
    try {
      const remaining = execSync('grep -r "console.log" src/ | wc -l', { encoding: 'utf8' }).trim();
      console.log(`📈 Remaining console.log in src/: ${remaining}`);
      
      if (parseInt(remaining) < 50) {
        console.log('✅ AC2 PASSED: <50 console.log in code\n');
      } else {
        console.log('⚠️  AC2 NOT MET: Still >50 console.log in code\n');
      }
    } catch (error) {
      console.log('ℹ️  Could not count remaining console.log\n');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, processFile, replaceConsoleCalls, addLoggerImport };

