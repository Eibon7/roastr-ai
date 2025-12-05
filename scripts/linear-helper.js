#!/usr/bin/env node

/**
 * Linear Integration Helper
 *
 * Provides utilities to interact with Linear API for issue management.
 * Supports creating issues, updating status, and syncing with GitHub.
 *
 * Usage:
 *   node scripts/linear-helper.js create --title "Issue title" --description "..."
 *   node scripts/linear-helper.js update --id ROA-123 --status "In Progress"
 *   node scripts/linear-helper.js list --state "todo"
 *   node scripts/linear-helper.js sync --github-issue 1093
 *
 * Environment:
 *   LINEAR_API_KEY - Linear Personal API key (get from https://linear.app/settings/api)
 *                    IMPORTANT: Use Personal API key, NOT Application key
 *   LINEAR_TEAM_ID - Team ID (optional, uses default team if not set)
 */

const { LinearClient } = require('@linear/sdk');
require('dotenv').config();

class LinearHelper {
  constructor() {
    this.apiKey = process.env.LINEAR_API_KEY;

    if (!this.apiKey) {
      console.error('❌ LINEAR_API_KEY not found in environment');
      console.error('   Get your Personal API key from: https://linear.app/settings/api');
      console.error('   Section: "Personal API keys" → Create key');
      console.error('   Add to .env: LINEAR_API_KEY=lin_api_...');
      console.error('   ⚠️  Use Personal API key, NOT Application key');
      process.exit(1);
    }

    this.client = new LinearClient({ apiKey: this.apiKey });
    this.teamId = process.env.LINEAR_TEAM_ID;
  }

  /**
   * Get default team
   */
  async getDefaultTeam() {
    if (this.teamId) {
      return { id: this.teamId };
    }

    const teams = await this.client.teams();
    const team = teams.nodes[0];

    if (!team) {
      throw new Error('No teams found in Linear workspace');
    }

    console.log(`📍 Using team: ${team.name} (${team.key})`);
    return team;
  }

  /**
   * Create issue in Linear
   */
  async createIssue(options) {
    const team = await this.getDefaultTeam();

    const issuePayload = {
      teamId: team.id,
      title: options.title,
      description: options.description,
      priority: options.priority || 2, // 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
      ...(options.assigneeId && { assigneeId: options.assigneeId }),
      ...(options.labelIds && { labelIds: options.labelIds }),
      ...(options.projectId && { projectId: options.projectId })
    };

    const issueResult = await this.client.createIssue(issuePayload);
    const issue = await issueResult.issue;

    if (!issue) {
      throw new Error('Failed to create issue');
    }

    console.log('✅ Issue created in Linear:');
    console.log(`   ID: ${issue.identifier}`);
    console.log(`   Title: ${issue.title}`);
    console.log(`   URL: ${issue.url}`);

    return issue;
  }

  /**
   * Update issue status
   */
  async updateIssue(identifier, updates) {
    // Get issue by identifier (e.g., "ROA-123")
    const issues = await this.client.issues({
      filter: { identifier: { eq: identifier } }
    });

    const issue = issues.nodes[0];

    if (!issue) {
      throw new Error(`Issue ${identifier} not found`);
    }

    // Get workflow states if status update requested
    // Use teamId fallback for safer access (CodeRabbit fix)
    let stateId;
    if (updates.status) {
      const teamId = issue.teamId || (await issue.team)?.id || (await this.getDefaultTeam()).id;
      const teamObj = await this.client.team(teamId);
      const states = await teamObj.states();

      const targetState = states.nodes.find(
        (s) => s.name.toLowerCase() === updates.status.toLowerCase()
      );

      if (!targetState) {
        const availableStates = states.nodes.map((s) => s.name).join(', ');
        throw new Error(`Status "${updates.status}" not found. Available: ${availableStates}`);
      }

      stateId = targetState.id;
    }

    // Update issue
    const updatePayload = {
      ...(updates.title && { title: updates.title }),
      ...(updates.description && { description: updates.description }),
      ...(stateId && { stateId }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.assigneeId && { assigneeId: updates.assigneeId })
    };

    await this.client.updateIssue(issue.id, updatePayload);

    console.log(`✅ Issue ${identifier} updated`);
    console.log(`   URL: ${issue.url}`);

    return issue;
  }

  /**
   * List issues
   */
  async listIssues(filters = {}) {
    const team = await this.getDefaultTeam();

    const issueFilter = {
      team: { id: { eq: team.id } },
      ...(filters.state && {
        state: { name: { eq: filters.state } }
      }),
      ...(filters.assigneeId && {
        assignee: { id: { eq: filters.assigneeId } }
      })
    };

    const issues = await this.client.issues({ filter: issueFilter });

    console.log(`📋 Found ${issues.nodes.length} issues:\n`);

    // Access state safely with async (CodeRabbit fix)
    for (const [index, issue] of issues.nodes.entries()) {
      const state = await issue.state;
      console.log(`${index + 1}. ${issue.identifier}: ${issue.title}`);
      console.log(`   Status: ${state?.name || 'Unknown'}`);
      console.log(`   Priority: ${this.getPriorityLabel(issue.priority)}`);
      console.log(`   URL: ${issue.url}`);
      console.log('');
    }

    return issues.nodes;
  }

  /**
   * Sync Linear issue with GitHub PR
   */
  async syncWithGitHub(linearId, githubIssueNumber) {
    const issues = await this.client.issues({
      filter: { identifier: { eq: linearId } }
    });

    const issue = issues.nodes[0];

    if (!issue) {
      throw new Error(`Linear issue ${linearId} not found`);
    }

    // Add GitHub reference to Linear issue description
    const githubUrl = `https://github.com/Eibon7/roastr-ai/issues/${githubIssueNumber}`;
    
    // Check if already contains GitHub URL to prevent duplication (CodeRabbit fix)
    if (issue.description && issue.description.includes(githubUrl)) {
      console.log(`ℹ️  ${linearId} already synced with GitHub #${githubIssueNumber}`);
      console.log(`   Linear: ${issue.url}`);
      console.log(`   GitHub: ${githubUrl}`);
      return issue;
    }
    
    const updatedDescription = issue.description
      ? `${issue.description}\n\n---\n**GitHub:** ${githubUrl}`
      : `**GitHub:** ${githubUrl}`;

    await this.client.updateIssue(issue.id, {
      description: updatedDescription
    });

    console.log(`✅ Synced ${linearId} with GitHub #${githubIssueNumber}`);
    console.log(`   Linear: ${issue.url}`);
    console.log(`   GitHub: ${githubUrl}`);

    return issue;
  }

  /**
   * Get priority label
   */
  getPriorityLabel(priority) {
    const labels = {
      0: '⚪ None',
      1: '🔴 Urgent',
      2: '🟠 High',
      3: '🟡 Medium',
      4: '🟢 Low'
    };
    return labels[priority] || '⚪ None';
  }

  /**
   * Show issue details
   */
  async showIssue(identifier) {
    const issueNumber = identifier.split('-')[1];
    const team = await this.getDefaultTeam();
    
    const issues = await this.client.issues({
      filter: { 
        team: { key: { eq: team.key } },
        number: { eq: parseInt(issueNumber) }
      }
    });

    const issue = issues.nodes[0];

    if (!issue) {
      throw new Error(`Issue ${identifier} not found`);
    }

    // Safely access nested relations
    const state = await issue.state;
    const assignee = await issue.assignee;
    const labels = await issue.labels();
    const creator = await issue.creator;

    console.log('📋 Issue Details');
    console.log('='.repeat(60));
    console.log('');
    console.log(`ID:          ${issue.identifier}`);
    console.log(`Title:       ${issue.title}`);
    console.log(`Status:      ${state?.name || 'Unknown'}`);
    console.log(`Priority:    ${this.getPriorityLabel(issue.priority)}`);
    console.log(`Assignee:    ${assignee?.name || 'Unassigned'}`);
    console.log(`Creator:     ${creator?.name || 'Unknown'}`);
    console.log(`Created:     ${new Date(issue.createdAt).toLocaleString()}`);
    console.log(`Updated:     ${new Date(issue.updatedAt).toLocaleString()}`);
    console.log(`URL:         ${issue.url}`);
    
    if (labels.nodes.length > 0) {
      console.log(`Labels:      ${labels.nodes.map((l) => l.name).join(', ')}`);
    }

    console.log('');
    console.log('Description:');
    console.log('-'.repeat(60));
    console.log(issue.description || 'No description');
    console.log('');

    return issue;
  }

  /**
   * Get team info
   */
  async getTeamInfo() {
    const teams = await this.client.teams();

    console.log('📊 Linear Teams:\n');

    teams.nodes.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
      console.log(`   Key: ${team.key}`);
      console.log(`   ID: ${team.id}`);
      console.log('');
    });

    return teams.nodes;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const helper = new LinearHelper();

  try {
    switch (command) {
      case 'create': {
        const titleIndex = args.indexOf('--title');
        const descIndex = args.indexOf('--description');
        const priorityIndex = args.indexOf('--priority');

        if (titleIndex === -1) {
          console.error('❌ Missing --title argument');
          process.exit(1);
        }

        const title = args[titleIndex + 1];
        const description = descIndex !== -1 ? args[descIndex + 1] : '';
        const priority = priorityIndex !== -1 ? parseInt(args[priorityIndex + 1]) : 2;

        await helper.createIssue({ title, description, priority });
        break;
      }

      case 'show': {
        const idIndex = args.indexOf('--id');

        if (idIndex === -1) {
          console.error('❌ Missing --id argument');
          console.error('   Usage: show --id ROA-123');
          process.exit(1);
        }

        const identifier = args[idIndex + 1];
        await helper.showIssue(identifier);
        break;
      }

      case 'update': {
        const idIndex = args.indexOf('--id');
        const statusIndex = args.indexOf('--status');
        const titleIndex = args.indexOf('--title');

        if (idIndex === -1) {
          console.error('❌ Missing --id argument');
          process.exit(1);
        }

        const identifier = args[idIndex + 1];
        const updates = {};

        if (statusIndex !== -1) updates.status = args[statusIndex + 1];
        if (titleIndex !== -1) updates.title = args[titleIndex + 1];

        await helper.updateIssue(identifier, updates);
        break;
      }

      case 'list': {
        const stateIndex = args.indexOf('--state');
        const filters = {};

        if (stateIndex !== -1) {
          filters.state = args[stateIndex + 1];
        }

        await helper.listIssues(filters);
        break;
      }

      case 'sync': {
        const linearIndex = args.indexOf('--linear');
        const githubIndex = args.indexOf('--github');

        if (linearIndex === -1 || githubIndex === -1) {
          console.error('❌ Missing --linear and/or --github arguments');
          console.error('   Usage: sync --linear ROA-123 --github 1093');
          process.exit(1);
        }

        const linearId = args[linearIndex + 1];
        const githubIssue = args[githubIndex + 1];

        await helper.syncWithGitHub(linearId, githubIssue);
        break;
      }

      case 'teams': {
        await helper.getTeamInfo();
        break;
      }

      default:
        console.log('Linear Helper - Usage:\n');
        console.log('  create    --title "..." [--description "..."] [--priority 1-4]');
        console.log('  show      --id ROA-123');
        console.log('  update    --id ROA-123 [--status "In Progress"] [--title "..."]');
        console.log('  list      [--state "Todo"]');
        console.log('  sync      --linear ROA-123 --github 1093');
        console.log('  teams     Show team information');
        console.log('\nStates: Todo, In Progress, Done, Canceled');
        console.log('Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LinearHelper;
