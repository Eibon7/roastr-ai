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
const Logger = require('../src/utils/logger');
require('dotenv').config();

class LinearHelper {
  constructor() {
    this.apiKey = process.env.LINEAR_API_KEY;

    if (!this.apiKey) {
      Logger.error('❌ LINEAR_API_KEY not found in environment');
      Logger.error('   Get your Personal API key from: https://linear.app/settings/api');
      Logger.error('   Section: "Personal API keys" → Create key');
      Logger.error('   Add to .env: LINEAR_API_KEY=lin_api_...');
      Logger.error('   ⚠️  Use Personal API key, NOT Application key');
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

    Logger.info(`📍 Using team: ${team.name} (${team.key})`);
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

    Logger.info('✅ Issue created in Linear:');
    Logger.info(`   ID: ${issue.identifier}`);
    Logger.info(`   Title: ${issue.title}`);
    Logger.info(`   URL: ${issue.url}`);

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
    // Use teamId fallback for safer access
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

    Logger.info(`✅ Issue ${identifier} updated`);
    Logger.info(`   URL: ${issue.url}`);

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

    Logger.info(`📋 Found ${issues.nodes.length} issues:\n`);

    // Access state safely (may need async fetch)
    for (const [index, issue] of issues.nodes.entries()) {
      const state = await issue.state;
      Logger.info(`${index + 1}. ${issue.identifier}: ${issue.title}`);
      Logger.info(`   Status: ${state?.name || 'Unknown'}`);
      Logger.info(`   Priority: ${this.getPriorityLabel(issue.priority)}`);
      Logger.info(`   URL: ${issue.url}`);
      Logger.info('');
    }

    return issues.nodes;
  }

  /**
   * Show issue details
   */
  async showIssue(identifier) {
    const issueNumber = identifier.split('-')[1];
    const team = await this.getDefaultTeam();

    // Use team.id (works with LINEAR_TEAM_ID) or fallback to team.key
    const teamFilter = team.key 
      ? { team: { key: { eq: team.key } } }
      : { team: { id: { eq: team.id } } };

    const issues = await this.client.issues({
      filter: {
        ...teamFilter,
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

    Logger.info('📋 Issue Details');
    Logger.info('='.repeat(60));
    Logger.info('');
    Logger.info(`ID:          ${issue.identifier}`);
    Logger.info(`Title:       ${issue.title}`);
    Logger.info(`Status:      ${state?.name || 'Unknown'}`);
    Logger.info(`Priority:    ${this.getPriorityLabel(issue.priority)}`);
    Logger.info(`Assignee:    ${assignee?.name || 'Unassigned'}`);
    Logger.info(`Creator:     ${creator?.name || 'Unknown'}`);
    Logger.info(`Created:     ${new Date(issue.createdAt).toLocaleString()}`);
    Logger.info(`Updated:     ${new Date(issue.updatedAt).toLocaleString()}`);
    Logger.info(`URL:         ${issue.url}`);

    if (labels.nodes.length > 0) {
      Logger.info(`Labels:      ${labels.nodes.map((l) => l.name).join(', ')}`);
    }

    Logger.info('');
    Logger.info('Description:');
    Logger.info('-'.repeat(60));
    Logger.info(issue.description || 'No description');
    Logger.info('');

    return issue;
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

    // Check if GitHub URL already exists (prevent duplication)
    if (issue.description && issue.description.includes(githubUrl)) {
      Logger.info(`ℹ️  ${linearId} already synced with GitHub #${githubIssueNumber}`);
      Logger.info(`   Linear: ${issue.url}`);
      Logger.info(`   GitHub: ${githubUrl}`);
      return issue;
    }

    const updatedDescription = issue.description
      ? `${issue.description}\n\n---\n**GitHub:** ${githubUrl}`
      : `**GitHub:** ${githubUrl}`;

    await this.client.updateIssue(issue.id, {
      description: updatedDescription
    });

    Logger.info(`✅ Synced ${linearId} with GitHub #${githubIssueNumber}`);
    Logger.info(`   Linear: ${issue.url}`);
    Logger.info(`   GitHub: ${githubUrl}`);

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
   * Get team info
   */
  async getTeamInfo() {
    const teams = await this.client.teams();

    Logger.info('📊 Linear Teams:\n');

    teams.nodes.forEach((team, index) => {
      Logger.info(`${index + 1}. ${team.name}`);
      Logger.info(`   Key: ${team.key}`);
      Logger.info(`   ID: ${team.id}`);
      Logger.info('');
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

        if (titleIndex === -1 || !args[titleIndex + 1]) {
          Logger.error('❌ Missing --title argument or value');
          Logger.error(
            '   Usage: create --title "Issue title" [--description "..."] [--priority 0-4]'
          );
          process.exit(1);
        }

        const title = args[titleIndex + 1];
        const description = descIndex !== -1 && args[descIndex + 1] ? args[descIndex + 1] : '';

        // Validate priority (0-4)
        let priority = 2; // default
        if (priorityIndex !== -1) {
          if (!args[priorityIndex + 1]) {
            Logger.error('❌ Missing value for --priority argument');
            Logger.error('   Priority must be 0-4 (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)');
            process.exit(1);
          }
          priority = parseInt(args[priorityIndex + 1], 10);
          if (isNaN(priority) || priority < 0 || priority > 4) {
            Logger.error(`❌ Invalid priority: ${args[priorityIndex + 1]}`);
            Logger.error('   Priority must be 0-4 (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)');
            process.exit(1);
          }
        }

        await helper.createIssue({ title, description, priority });
        break;
      }

      case 'show': {
        const idIndex = args.indexOf('--id');

        if (idIndex === -1 || !args[idIndex + 1]) {
          Logger.error('❌ Missing --id argument or value');
          Logger.error('   Usage: show --id ROA-123');
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

        if (idIndex === -1 || !args[idIndex + 1]) {
          Logger.error('❌ Missing --id argument or value');
          Logger.error('   Usage: update --id ROA-123 [--status "In Progress"] [--title "..."]');
          process.exit(1);
        }

        const identifier = args[idIndex + 1];
        const updates = {};

        // Validate status value if provided
        if (statusIndex !== -1) {
          if (!args[statusIndex + 1]) {
            Logger.error('❌ Missing value for --status argument');
            process.exit(1);
          }
          // Normalize state name (case-insensitive)
          updates.status = args[statusIndex + 1].trim();
        }

        // Validate title value if provided
        if (titleIndex !== -1) {
          if (!args[titleIndex + 1]) {
            Logger.error('❌ Missing value for --title argument');
            process.exit(1);
          }
          updates.title = args[titleIndex + 1];
        }

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

        if (linearIndex === -1 || !args[linearIndex + 1]) {
          Logger.error('❌ Missing --linear argument or value');
          Logger.error('   Usage: sync --linear ROA-123 --github 1093');
          process.exit(1);
        }

        if (githubIndex === -1 || !args[githubIndex + 1]) {
          Logger.error('❌ Missing --github argument or value');
          Logger.error('   Usage: sync --linear ROA-123 --github 1093');
          process.exit(1);
        }

        const linearId = args[linearIndex + 1];
        const githubIssue = args[githubIndex + 1];

        // Validate GitHub issue number is numeric
        if (isNaN(parseInt(githubIssue, 10))) {
          Logger.error(`❌ Invalid GitHub issue number: ${githubIssue}`);
          Logger.error('   GitHub issue number must be numeric');
          process.exit(1);
        }

        await helper.syncWithGitHub(linearId, githubIssue);
        break;
      }

      case 'teams': {
        await helper.getTeamInfo();
        break;
      }

      default:
        Logger.info('Linear Helper - Usage:\n');
        Logger.info('  create    --title "..." [--description "..."] [--priority 0-4]');
        Logger.info('  show      --id ROA-123');
        Logger.info('  update    --id ROA-123 [--status "In Progress"] [--title "..."]');
        Logger.info('  list      [--state "Todo"]');
        Logger.info('  sync      --linear ROA-123 --github 1093');
        Logger.info('  teams     Show team information');
        Logger.info('\nStates: Todo, In Progress, Done, Canceled');
        Logger.info('Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low');
        process.exit(1);
    }
  } catch (error) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LinearHelper;
