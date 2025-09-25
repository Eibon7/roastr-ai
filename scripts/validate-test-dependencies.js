/**
 * Test Dependencies Validator
 * 
 * Addresses CodeRabbit PR #424 critical issues:
 * 1. Non-existent adapter imports
 * 2. Non-existent API routes
 * 3. Missing dependencies
 * 4. Inappropriate performance thresholds
 */

const fs = require('fs');
const path = require('path');

class TestValidator {
  constructor() {
    this.issues = [];
    this.availableAdapters = [
      'TwitterShieldAdapter',
      'YouTubeShieldAdapter', 
      'DiscordShieldAdapter',
      'TwitchShieldAdapter'
    ];
    this.nonExistentAdapters = [
      'InstagramShieldAdapter',
      'FacebookShieldAdapter'
    ];
    this.availableRoutes = this.getAvailableRoutes();
  }

  getAvailableRoutes() {
    // Read main API file to extract available routes
    try {
      const indexPath = path.join(__dirname, '..', 'src', 'index.js');
      if (!fs.existsSync(indexPath)) {
        console.warn('Could not find src/index.js to validate routes');
        return [];
      }
      
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Extract routes from Express app definitions
      const routeMatches = content.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
      const routes = routeMatches.map(match => {
        const routeMatch = match.match(/['"`]([^'"`]+)['"`]/);
        return routeMatch ? routeMatch[1] : null;
      }).filter(Boolean);
      
      return routes;
    } catch (error) {
      console.warn(`Could not read API routes from src/index.js: ${error.message}`);
      return [];
    }
  }

  validateTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check for non-existent shield adapter imports
    this.nonExistentAdapters.forEach(adapter => {
      const importRegex = new RegExp(`import.*${adapter}.*from`, 'g');
      const requireRegex = new RegExp(`require\\(['"\`][^'"\`]*${adapter}`, 'g');
      
      if (importRegex.test(content) || requireRegex.test(content)) {
        this.issues.push({
          file: relativePath,
          type: 'non-existent-adapter',
          message: `Import of non-existent ${adapter} - only available: ${this.availableAdapters.join(', ')}`
        });
      }
    });

    // Check for non-existent API routes
    const apiCalls = content.match(/['"`]\/api\/[^'"`]+['"`]/g) || [];
    apiCalls.forEach(call => {
      const route = call.replace(/['"`]/g, '');
      
      // Check for known problematic routes
      if (route.includes('/comments/ingest')) {
        this.issues.push({
          file: relativePath,
          type: 'non-existent-route',
          message: `Route ${route} does not exist - verify available routes in src/index.js`
        });
      }
    });

    // Check for references to missing dependencies
    if (content.includes('jest-html-reporters')) {
      // Check if it exists in package.json
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const hasDevDep = packageJson.devDependencies && packageJson.devDependencies['jest-html-reporters'];
        const hasDep = packageJson.dependencies && packageJson.dependencies['jest-html-reporters'];
        
        if (!hasDevDep && !hasDep) {
          this.issues.push({
            file: relativePath,
            type: 'missing-dependency',
            message: 'jest-html-reporters is referenced but not in package.json dependencies'
          });
        }
      }
    }

    // Check for development performance thresholds that may be too tight for CI
    // Only flag performance-related assertions, not business logic limits
    const performanceChecks = [
      { pattern: /(time|Time|duration|Duration|ms|millisecond|performance).*\.toBeLessThan\((\d+)\)/g, unit: 'ms' },
      { pattern: /expect.*\.toBeSpeedyGonzales/g, unit: 'perf' },
      { pattern: /responseTime.*<.*(\d+)/g, unit: 'ms' },
      { pattern: /\.toBeLessThan\((\d+)\).*\/\/.*[Tt]ime|ms|performance|speed|fast/g, unit: 'ms' }
    ];

    performanceChecks.forEach(check => {
      const matches = Array.from(content.matchAll(check.pattern));
      if (matches.length > 0) {
        matches.forEach(match => {
          const numberMatch = match[0].match(/(\d+)/);
          if (numberMatch) {
            const threshold = parseInt(numberMatch[1]);
            if (threshold < 100 && check.unit === 'ms') {
              this.issues.push({
                file: relativePath,
                type: 'tight-performance-threshold',
                message: `Performance threshold ${threshold}ms may be too tight for CI environments (consider >= 100ms)`
              });
            }
          }
        });
      }
    });
  }

  validateAllTestFiles() {
    const testDir = path.join(__dirname, '..', 'tests');
    
    if (!fs.existsSync(testDir)) {
      console.log('No tests directory found - validation skipped');
      return true;
    }

    const testFiles = this.getAllTestFiles(testDir);
    
    if (testFiles.length === 0) {
      console.log('No test files found - validation passed');
      return true;
    }

    testFiles.forEach(file => {
      try {
        this.validateTestFile(file);
      } catch (error) {
        this.issues.push({
          file: path.relative(process.cwd(), file),
          type: 'validation-error',
          message: `Error validating file: ${error.message}`
        });
      }
    });

    return this.issues.length === 0;
  }

  getAllTestFiles(dir) {
    let files = [];
    
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files = files.concat(this.getAllTestFiles(fullPath));
        } else if (item.endsWith('.test.js')) {
          files.push(fullPath);
        }
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }
    return files;
  }

  report() {
    if (this.issues.length === 0) {
      console.log('✅ All test files validated successfully');
      console.log(`📊 Scanned ${this.getAllTestFiles(path.join(__dirname, '..', 'tests')).length} test files`);
      return true;
    }

    console.log('❌ Issues found in test files:');
    console.log('=' .repeat(60));
    
    this.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type.toUpperCase().replace(/-/g, ' ')}`);
      console.log(`   File: ${issue.file}`);
      console.log(`   Issue: ${issue.message}`);
      console.log('');
    });

    console.log('💡 Fix these issues before committing test files.');
    console.log('📚 See docs/test-validation-guidelines.md for detailed guidance');
    
    return false;
  }
}

// CLI execution
if (require.main === module) {
  console.log('🔍 Running test dependencies validation...');
  console.log('');
  
  const validator = new TestValidator();
  const success = validator.validateAllTestFiles();
  
  if (!validator.report()) {
    console.log('');
    console.log('⚠️  Validation failed - please fix issues above before proceeding');
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All validations passed - ready for testing!');
  }
}

module.exports = { TestValidator };