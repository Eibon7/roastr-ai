#!/usr/bin/env node

/**
 * Documentation Generator from Test Files
 *
 * Extracts describe() and it() blocks from test files to generate
 * technical documentation automatically.
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob').sync;

// Configuration
const CONFIG = {
  testPaths: [
    'tests/unit/workers/*.test.js',
    'tests/unit/services/*.test.js',
    'tests/unit/routes/*.test.js',
    'tests/integration/**/*.test.js'
  ],
  outputDir: 'docs/generated',
  indexFile: 'docs/README.md'
};

// Parse test file and extract test structure
async function parseTestFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const relativePath = path.relative(process.cwd(), filePath);

  const structure = {
    file: fileName,
    path: relativePath,
    suites: []
  };

  // Regex patterns for describe and it blocks
  const describePattern = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const itPattern = /it\s*\(\s*['"`]([^'"`]+)['"`]/g;

  // Split content into lines for better parsing
  const lines = content.split('\n');
  let currentIndent = 0;
  let suiteStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);

    // Check for describe block
    const describeMatch = line.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
      const suite = {
        name: describeMatch[1],
        level: indent,
        tests: [],
        subSuites: [],
        lineNumber: i + 1
      };

      // Find the right parent based on indentation
      while (suiteStack.length > 0 && suiteStack[suiteStack.length - 1].level >= indent) {
        suiteStack.pop();
      }

      if (suiteStack.length === 0) {
        structure.suites.push(suite);
      } else {
        suiteStack[suiteStack.length - 1].subSuites.push(suite);
      }

      suiteStack.push(suite);
    }

    // Check for it block
    const itMatch = line.match(/it\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (itMatch && suiteStack.length > 0) {
      suiteStack[suiteStack.length - 1].tests.push({
        name: itMatch[1],
        lineNumber: i + 1
      });
    }
  }

  return structure;
}

// Generate markdown for a test suite
function generateSuiteMarkdown(suite, level = 2) {
  let md = '';
  const prefix = '#'.repeat(level);

  md += `${prefix} ${suite.name}\n\n`;

  if (suite.tests.length > 0) {
    md += 'Tests:\n';
    suite.tests.forEach((test) => {
      md += `- ✓ ${test.name}\n`;
    });
    md += '\n';
  }

  suite.subSuites.forEach((subSuite) => {
    md += generateSuiteMarkdown(subSuite, level + 1);
  });

  return md;
}

// Generate markdown documentation for a test file
function generateFileDocumentation(testStructure) {
  let md = `# ${testStructure.file}\n\n`;
  md += `**Path:** \`${testStructure.path}\`\n\n`;

  // Extract module name from file name
  const moduleName = testStructure.file
    .replace('.test.js', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
  md += `## ${moduleName} Tests\n\n`;

  // Add test suites
  testStructure.suites.forEach((suite) => {
    md += generateSuiteMarkdown(suite, 3);
  });

  return md;
}

// Generate worker-specific documentation
async function generateWorkerDocs(testFiles) {
  const workerDocs = {};

  for (const file of testFiles) {
    if (file.includes('workers/')) {
      const structure = await parseTestFile(file);
      const workerName = path.basename(file).replace('.test.js', '');

      if (!workerDocs[workerName]) {
        workerDocs[workerName] = {
          name: workerName,
          description: getWorkerDescription(workerName),
          tests: []
        };
      }

      workerDocs[workerName].tests.push(structure);
    }
  }

  // Generate markdown for each worker
  for (const [workerName, workerData] of Object.entries(workerDocs)) {
    let md = `# ${workerName}\n\n`;
    md += `${workerData.description}\n\n`;

    workerData.tests.forEach((testStructure) => {
      testStructure.suites.forEach((suite) => {
        md += generateSuiteMarkdown(suite);
      });
    });

    const outputPath = path.join(CONFIG.outputDir, 'workers', `${workerName}.md`);
    await ensureDirectory(path.dirname(outputPath));
    await fs.writeFile(outputPath, md);
    console.log(`✓ Generated: ${outputPath}`);
  }
}

// Get worker description based on name
function getWorkerDescription(workerName) {
  const descriptions = {
    FetchCommentsWorker:
      'Responsible for fetching comments from various social media platforms including Twitter, YouTube, Instagram, Discord, and others.',
    AnalyzeToxicityWorker:
      'Analyzes comment toxicity using Google Perspective API, OpenAI Moderation API, and pattern-based detection.',
    GenerateReplyWorker:
      'Generates contextual roast responses using OpenAI GPT-4o mini with fallback to template-based responses.',
    ShieldActionWorker:
      'Executes Shield protection actions including platform-specific moderation (mute, block, ban) and automated response to high-toxicity content.',
    BaseWorker:
      'Base class providing common functionality for all worker types including queue management, error handling, and job processing lifecycle.'
  };

  return (
    descriptions[workerName] || 'Worker for processing background jobs in the Roastr.ai system.'
  );
}

// Ensure directory exists
async function ensureDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Generate index file
async function generateIndex(allDocs) {
  let md = `# Roastr.ai Technical Documentation\n\n`;
  md += `Generated from test files on ${new Date().toLocaleDateString()}\n\n`;

  md += `## Overview\n\n`;
  md += `This documentation is automatically generated from our test suite. `;
  md += `It provides a comprehensive view of the system's functionality based on actual test coverage.\n\n`;

  // Group docs by category
  const categories = {
    workers: [],
    services: [],
    routes: [],
    integration: []
  };

  allDocs.forEach((doc) => {
    if (doc.path.includes('workers/')) categories.workers.push(doc);
    else if (doc.path.includes('services/')) categories.services.push(doc);
    else if (doc.path.includes('routes/')) categories.routes.push(doc);
    else if (doc.path.includes('integration/')) categories.integration.push(doc);
  });

  // Add workers section
  if (categories.workers.length > 0) {
    md += `## Workers\n\n`;
    md += `Background processing workers for the multi-tenant architecture:\n\n`;
    categories.workers.forEach((doc) => {
      const name = doc.file.replace('.test.js', '');
      md += `- [${name}](./generated/workers/${name}.md) - ${getWorkerDescription(name)}\n`;
    });
    md += '\n';
  }

  // Add services section
  if (categories.services.length > 0) {
    md += `## Services\n\n`;
    md += `Core services providing business logic:\n\n`;
    categories.services.forEach((doc) => {
      const name = doc.file.replace('.test.js', '');
      md += `- [${name}](./generated/services/${name}.md)\n`;
    });
    md += '\n';
  }

  // Add routes section
  if (categories.routes.length > 0) {
    md += `## API Routes\n\n`;
    md += `REST API endpoints:\n\n`;
    categories.routes.forEach((doc) => {
      const name = doc.file.replace('.test.js', '');
      md += `- [${name}](./generated/routes/${name}.md)\n`;
    });
    md += '\n';
  }

  // Add integration tests section
  if (categories.integration.length > 0) {
    md += `## Integration Tests\n\n`;
    md += `End-to-end workflow tests:\n\n`;
    categories.integration.forEach((doc) => {
      const name = doc.file.replace('.test.js', '');
      md += `- [${name}](./generated/integration/${name}.md)\n`;
    });
    md += '\n';
  }

  // Add statistics
  const totalTests = allDocs.reduce((sum, doc) => {
    return (
      sum +
      doc.suites.reduce((suiteSum, suite) => {
        return suiteSum + countTests(suite);
      }, 0)
    );
  }, 0);

  md += `## Test Coverage Statistics\n\n`;
  md += `- Total test files: ${allDocs.length}\n`;
  md += `- Total test cases: ${totalTests}\n`;
  md += `- Documentation generated: ${new Date().toISOString()}\n`;

  await fs.writeFile(CONFIG.indexFile, md);
  console.log(`✓ Generated index: ${CONFIG.indexFile}`);
}

// Count tests in a suite recursively
function countTests(suite) {
  let count = suite.tests.length;
  suite.subSuites.forEach((subSuite) => {
    count += countTests(subSuite);
  });
  return count;
}

// Main function
async function main() {
  console.log('📚 Generating documentation from tests...\n');

  try {
    // Ensure output directory exists
    await ensureDirectory(CONFIG.outputDir);

    // Find all test files
    const testFiles = [];
    CONFIG.testPaths.forEach((pattern) => {
      const files = glob(pattern);
      testFiles.push(...files);
    });

    console.log(`Found ${testFiles.length} test files\n`);

    // Parse all test files
    const allDocs = [];
    for (const file of testFiles) {
      console.log(`Parsing: ${file}`);
      const structure = await parseTestFile(file);
      allDocs.push(structure);

      // Generate individual documentation
      const doc = generateFileDocumentation(structure);
      const category = file.includes('workers/')
        ? 'workers'
        : file.includes('services/')
          ? 'services'
          : file.includes('routes/')
            ? 'routes'
            : 'integration';

      const outputPath = path.join(
        CONFIG.outputDir,
        category,
        path.basename(file).replace('.test.js', '.md')
      );
      await ensureDirectory(path.dirname(outputPath));
      await fs.writeFile(outputPath, doc);
    }

    // Generate worker-specific docs
    await generateWorkerDocs(testFiles);

    // Generate index
    await generateIndex(allDocs);

    console.log('\n✅ Documentation generation complete!');
    console.log(`📁 Output directory: ${CONFIG.outputDir}`);
    console.log(`📄 Index file: ${CONFIG.indexFile}`);
  } catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { parseTestFile, generateFileDocumentation, generateIndex };
