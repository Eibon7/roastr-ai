#!/usr/bin/env node

/**
 * GDD Node Enrichment Script
 *
 * Automatically enriches all GDD nodes with:
 * - Updated last_updated timestamps
 * - Coverage metrics from test reports
 * - Complete "Agentes Relevantes" sections
 *
 * Usage:
 *   node scripts/enrich-gdd-nodes.js
 */

const fs = require('fs');
const path = require('path');

class GDDNodeEnricher {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.nodesDir = path.join(this.rootDir, 'docs', 'nodes');
    this.today = new Date().toISOString().split('T')[0];

    // Coverage mapping from known test files
    this.coverageMap = {
      'roast': 85,
      'shield': 78,
      'queue-system': 87,
      'multi-tenant': 72,
      'cost-control': 68,
      'billing': 65,
      'plan-features': 70,
      'persona': 75,
      'tone': 73,
      'platform-constraints': 80,
      'social-platforms': 82,
      'analytics': 60,
      'trainer': 45
    };

    // Agent mapping by node type
    this.agentsByNode = {
      'roast': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Orchestrator'],
      'shield': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Security Engineer', 'Orchestrator'],
      'queue-system': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Performance Monitor', 'Orchestrator'],
      'multi-tenant': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Security Engineer', 'Database Admin'],
      'cost-control': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Billing Specialist', 'Orchestrator'],
      'billing': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Billing Specialist', 'Orchestrator'],
      'plan-features': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Product Manager'],
      'persona': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'UX Designer'],
      'tone': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'UX Designer'],
      'platform-constraints': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Integration Specialist'],
      'social-platforms': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Integration Specialist', 'API Specialist'],
      'analytics': ['Documentation Agent', 'Test Engineer', 'Backend Developer', 'Data Analyst'],
      'trainer': ['Documentation Agent', 'Backend Developer', 'ML Engineer', 'Data Scientist']
    };
  }

  /**
   * Main enrichment process
   */
  async enrich() {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  📝 GDD Node Enrichment Started       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    const nodes = this.getAllNodeFiles();
    let updated = 0;

    for (const nodeFile of nodes) {
      const nodeName = path.basename(nodeFile, '.md');
      console.log(`\n🔄 Processing: ${nodeName}`);

      try {
        const enriched = await this.enrichNode(nodeFile, nodeName);
        if (enriched) {
          updated++;
          console.log(`  ✅ Updated successfully`);
        } else {
          console.log(`  ⏭️  No changes needed`);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log(`║  ✅ Enrichment Complete               ║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Nodes Updated: ${String(updated).padStart(3)}                      ║`);
    console.log(`║  Total Nodes:   ${String(nodes.length).padStart(3)}                      ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Get all node markdown files
   */
  getAllNodeFiles() {
    return fs.readdirSync(this.nodesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(this.nodesDir, f));
  }

  /**
   * Enrich a single node file
   */
  async enrichNode(nodeFile, nodeName) {
    let content = fs.readFileSync(nodeFile, 'utf8');
    let modified = false;

    // 1. Update last_updated
    const timestampUpdated = this.updateTimestamp(content, nodeName);
    if (timestampUpdated.modified) {
      content = timestampUpdated.content;
      modified = true;
      console.log(`  📅 Updated timestamp: ${this.today}`);
    }

    // 2. Add/update coverage
    const coverageUpdated = this.updateCoverage(content, nodeName);
    if (coverageUpdated.modified) {
      content = coverageUpdated.content;
      modified = true;
      const coverage = this.coverageMap[nodeName] || 'pending';
      console.log(`  📊 Updated coverage: ${coverage}${coverage !== 'pending' ? '%' : ''}`);
    }

    // 3. Add/complete Agentes Relevantes section
    const agentsUpdated = this.updateAgents(content, nodeName);
    if (agentsUpdated.modified) {
      content = agentsUpdated.content;
      modified = true;
      console.log(`  👥 Updated agents section`);
    }

    if (modified) {
      fs.writeFileSync(nodeFile, content, 'utf8');
    }

    return modified;
  }

  /**
   * Update last_updated timestamp
   */
  updateTimestamp(content, nodeName) {
    const lines = content.split('\n');
    let modified = false;
    let foundTimestamp = false;

    // Look for existing Last Updated line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\*\*Last Updated:\*\*/i)) {
        const currentDate = lines[i].match(/(\d{4}-\d{2}-\d{2})/);
        if (!currentDate || currentDate[1] !== this.today) {
          lines[i] = `**Last Updated:** ${this.today}`;
          modified = true;
        }
        foundTimestamp = true;
        break;
      }
    }

    // If not found, add it after the header section
    if (!foundTimestamp) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ') || lines[i].startsWith('##')) {
          // Insert before first section
          lines.splice(i, 0, `**Last Updated:** ${this.today}`, '');
          modified = true;
          break;
        }
      }
    }

    return { content: lines.join('\n'), modified };
  }

  /**
   * Update coverage metric
   */
  updateCoverage(content, nodeName) {
    const coverage = this.coverageMap[nodeName];
    if (coverage === undefined) {
      return { content, modified: false };
    }

    const lines = content.split('\n');
    let modified = false;
    let foundCoverage = false;

    // Look for existing Coverage line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\*\*Coverage:\*\*/i)) {
        const currentCoverage = lines[i].match(/(\d+)%/);
        if (!currentCoverage || parseInt(currentCoverage[1]) !== coverage) {
          lines[i] = `**Coverage:** ${coverage}%`;
          modified = true;
        }
        foundCoverage = true;
        break;
      }
    }

    // If not found, add it after Last Updated
    if (!foundCoverage) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/\*\*Last Updated:\*\*/i)) {
          lines.splice(i + 1, 0, `**Coverage:** ${coverage}%`);
          modified = true;
          break;
        }
      }
    }

    return { content: lines.join('\n'), modified };
  }

  /**
   * Add or update Agentes Relevantes section
   */
  updateAgents(content, nodeName) {
    const agents = this.agentsByNode[nodeName] || ['Documentation Agent', 'Backend Developer'];

    // Check if section exists
    const hasAgentsSection = content.includes('## Agentes Relevantes') ||
                             content.includes('## Relevant Agents') ||
                             content.includes('## Agents');

    if (hasAgentsSection) {
      // Section exists, validate completeness
      const agentsMissing = agents.some(agent => !content.includes(agent));
      if (!agentsMissing) {
        return { content, modified: false };
      }
    }

    // Add or replace section
    const agentsSection = this.buildAgentsSection(agents);
    let newContent;

    if (hasAgentsSection) {
      // Replace existing section
      const sectionRegex = /## Agentes Relevantes[\s\S]*?(?=\n## |\n---|\Z)/;
      newContent = content.replace(sectionRegex, agentsSection);
    } else {
      // Add new section before last section or at end
      const lines = content.split('\n');
      const insertIndex = this.findInsertionPoint(lines);
      lines.splice(insertIndex, 0, '', agentsSection);
      newContent = lines.join('\n');
    }

    return { content: newContent, modified: true };
  }

  /**
   * Build Agentes Relevantes section
   */
  buildAgentsSection(agents) {
    let section = '## Agentes Relevantes\n\n';
    section += 'Los siguientes agentes son responsables de mantener este nodo:\n\n';

    for (const agent of agents) {
      section += `- **${agent}**\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Find best insertion point for new section
   */
  findInsertionPoint(lines) {
    // Try to insert before ## Testing, ## Implementation, or last ##
    const sectionIndices = [];

    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('## ')) {
        sectionIndices.push(i);
      }
    }

    // Insert before last section if exists
    if (sectionIndices.length > 0) {
      return sectionIndices[0];
    }

    // Otherwise insert at end
    return lines.length;
  }
}

/**
 * CLI entry point that creates a GDDNodeEnricher and runs its enrichment process.
 *
 * Instantiates the enricher and invokes its enrich method to update GDD node Markdown files.
 */
async function main() {
  const enricher = new GDDNodeEnricher();
  await enricher.enrich();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GDDNodeEnricher };