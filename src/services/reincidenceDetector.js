const fs = require('fs-extra');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement
const path = require('path');
const advancedLogger = require('../utils/advancedLogger');

class ReincidenceDetector {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.reincidenceFile = path.join(this.dataDir, 'user_reincidence.json');
    this.actionsFile = path.join(this.dataDir, 'auto_actions.json');
    
    // Initialize data structures
    this.userHistory = new Map();
    this.actionHistory = new Map();
    
    this.init();
  }

  /**
   * Initialize detector
   */
  async init() {
    try {
      await fs.ensureDir(this.dataDir);
      await this.loadData();
    } catch (error) {
      logger.error('Error initializing ReincidenceDetector:', error);
    }
  }

  /**
   * Load existing data from files
   */
  async loadData() {
    try {
      // Load user reincidence data
      if (await fs.pathExists(this.reincidenceFile)) {
        const reincidenceData = await fs.readJson(this.reincidenceFile);
        this.userHistory = new Map(Object.entries(reincidenceData));
      }

      // Load action history
      if (await fs.pathExists(this.actionsFile)) {
        const actionsData = await fs.readJson(this.actionsFile);
        this.actionHistory = new Map(Object.entries(actionsData));
      }

    } catch (error) {
      logger.error('Error loading reincidence data:', error);
    }
  }

  /**
   * Save data to files
   */
  async saveData() {
    try {
      // Save user reincidence data
      const reincidenceData = Object.fromEntries(this.userHistory);
      await fs.writeJson(this.reincidenceFile, reincidenceData, { spaces: 2 });

      // Save action history
      const actionsData = Object.fromEntries(this.actionHistory);
      await fs.writeJson(this.actionsFile, actionsData, { spaces: 2 });

    } catch (error) {
      logger.error('Error saving reincidence data:', error);
    }
  }

  /**
   * Record user interaction
   */
  async recordInteraction(platform, userId, username, messageText, severity = 'low') {
    try {
      const userKey = `${platform}_${userId}`;
      const timestamp = new Date().toISOString();

      // Get or create user history
      if (!this.userHistory.has(userKey)) {
        this.userHistory.set(userKey, {
          platform,
          userId,
          username,
          interactions: [],
          totalCount: 0,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          lastInteraction: null,
          firstInteraction: timestamp
        });
      }

      const userRecord = this.userHistory.get(userKey);
      
      // Update interaction
      userRecord.interactions.push({
        timestamp,
        messageText,
        severity
      });
      
      userRecord.totalCount++;
      userRecord.severityCounts[severity]++;
      userRecord.lastInteraction = timestamp;
      userRecord.username = username; // Update in case it changed

      // Keep only last 50 interactions per user
      if (userRecord.interactions.length > 50) {
        userRecord.interactions = userRecord.interactions.slice(-50);
      }

      // Save data
      await this.saveData();

      // Log reincidence if threshold exceeded
      const config = require('../config/integrations');
      const threshold = config.shield.reincidenceThreshold;

      if (userRecord.totalCount >= threshold) {
        await advancedLogger.logReincidence(
          platform,
          userId,
          username,
          userRecord.totalCount,
          severity,
          {
            severityCounts: userRecord.severityCounts,
            recentInteractions: userRecord.interactions.slice(-5)
          }
        );
      }

      return userRecord;

    } catch (error) {
      logger.error('Error recording interaction:', error);
      return null;
    }
  }

  /**
   * Check if user qualifies for automatic action
   */
  shouldTakeAutoAction(platform, userId, severity = 'low') {
    try {
      const config = require('../config/integrations');
      const userKey = `${platform}_${userId}`;
      const userRecord = this.userHistory.get(userKey);

      if (!userRecord) return null;

      const severityLevel = config.shield.severityLevels[severity];
      if (!severityLevel) return null;

      // Check if user exceeds threshold for this severity
      const severityCount = userRecord.severityCounts[severity] || 0;
      const totalCount = userRecord.totalCount || 0;

      // Different criteria based on severity
      switch (severity) {
        case 'critical':
          // Critical infractions: immediate action
          return severityCount >= severityLevel.threshold ? severityLevel.action : null;
          
        case 'high':
          // High severity: action after threshold
          return severityCount >= severityLevel.threshold ? severityLevel.action : null;
          
        case 'medium':
          // Medium severity: consider total interactions
          return (severityCount >= severityLevel.threshold || totalCount >= 5) ? severityLevel.action : null;
          
        case 'low':
          // Low severity: only if many repeated interactions
          return totalCount >= 10 ? severityLevel.action : null;
          
        default:
          return null;
      }

    } catch (error) {
      logger.error('Error checking auto action criteria:', error);
      return null;
    }
  }

  /**
   * Record automatic action taken
   */
  async recordAutoAction(platform, userId, username, action, reason, severity) {
    try {
      const actionKey = `${platform}_${userId}_${Date.now()}`;
      const timestamp = new Date().toISOString();

      const actionRecord = {
        platform,
        userId,
        username,
        action,
        reason,
        severity,
        timestamp
      };

      this.actionHistory.set(actionKey, actionRecord);
      
      // Save data
      await this.saveData();

      // Log the action
      await advancedLogger.logAutoAction(
        platform,
        action,
        userId,
        username,
        reason,
        { severity, actionKey }
      );

      return actionRecord;

    } catch (error) {
      logger.error('Error recording auto action:', error);
      return null;
    }
  }

  /**
   * Get user reincidence stats
   */
  getUserStats(platform, userId) {
    const userKey = `${platform}_${userId}`;
    return this.userHistory.get(userKey) || null;
  }

  /**
   * Get platform reincidence summary
   */
  getPlatformSummary(platform) {
    const summary = {
      totalUsers: 0,
      totalInteractions: 0,
      severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
      actionsTaken: 0,
      recentActions: []
    };

    // Count user stats for this platform
    for (const [userKey, userRecord] of this.userHistory) {
      if (userRecord.platform === platform) {
        summary.totalUsers++;
        summary.totalInteractions += userRecord.totalCount;
        
        Object.keys(summary.severityCounts).forEach(severity => {
          summary.severityCounts[severity] += userRecord.severityCounts[severity] || 0;
        });
      }
    }

    // Count actions for this platform
    const recentActions = [];
    for (const [actionKey, actionRecord] of this.actionHistory) {
      if (actionRecord.platform === platform) {
        summary.actionsTaken++;
        recentActions.push(actionRecord);
      }
    }

    // Sort by timestamp and get recent 10
    summary.recentActions = recentActions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    return summary;
  }

  /**
   * Get global summary across all platforms
   */
  getGlobalSummary() {
    const summary = {
      totalUsers: this.userHistory.size,
      totalActions: this.actionHistory.size,
      platformBreakdown: {},
      recentActivity: []
    };

    // Get breakdown by platform
    const platforms = new Set();
    for (const userRecord of this.userHistory.values()) {
      platforms.add(userRecord.platform);
    }

    for (const platform of platforms) {
      summary.platformBreakdown[platform] = this.getPlatformSummary(platform);
    }

    // Get recent activity across all platforms
    const recentActions = Array.from(this.actionHistory.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    summary.recentActivity = recentActions;

    return summary;
  }

  /**
   * Clean old data (keep only last N days)
   */
  async cleanOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean old interactions from user history
      for (const [userKey, userRecord] of this.userHistory) {
        userRecord.interactions = userRecord.interactions.filter(
          interaction => new Date(interaction.timestamp) > cutoffDate
        );

        // Remove users with no recent interactions
        if (userRecord.interactions.length === 0) {
          this.userHistory.delete(userKey);
        } else {
          // Recalculate counts based on remaining interactions
          userRecord.totalCount = userRecord.interactions.length;
          userRecord.severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
          
          userRecord.interactions.forEach(interaction => {
            userRecord.severityCounts[interaction.severity]++;
          });
        }
      }

      // Clean old actions
      for (const [actionKey, actionRecord] of this.actionHistory) {
        if (new Date(actionRecord.timestamp) <= cutoffDate) {
          this.actionHistory.delete(actionKey);
        }
      }

      // Save cleaned data
      await this.saveData();

      logger.info(`Cleaned reincidence data older than ${daysToKeep} days`);

    } catch (error) {
      logger.error('Error cleaning old reincidence data:', error);
    }
  }
}

module.exports = ReincidenceDetector;