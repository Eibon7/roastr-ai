const fs = require('fs-extra');
const path = require('path');

class AdvancedLogger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogsDir();
    
    // Different log types
    this.logTypes = {
      normal: 'normal',
      shield: 'shield',
      integration: 'integration',
      security: 'security'
    };
  }

  /**
   * Ensure logs directory exists
   */
  async ensureLogsDir() {
    try {
      await fs.ensureDir(this.logsDir);
      
      // Create subdirectories for different log types
      await fs.ensureDir(path.join(this.logsDir, 'integrations'));
      await fs.ensureDir(path.join(this.logsDir, 'shield'));
      await fs.ensureDir(path.join(this.logsDir, 'security'));
      
    } catch (error) {
      console.error('Error creating logs directory:', error);
    }
  }

  /**
   * Get timestamp string
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log entry
   */
  formatLogEntry(level, platform, message, data = null) {
    const entry = {
      timestamp: this.getTimestamp(),
      level: level.toUpperCase(),
      platform: platform.toUpperCase(),
      message,
      pid: process.pid
    };

    if (data) {
      entry.data = data;
    }

    return JSON.stringify(entry) + '\n';
  }

  /**
   * Write to specific log file
   */
  async writeLog(logType, platform, level, message, data = null) {
    try {
      let logFile;
      
      switch (logType) {
        case this.logTypes.integration:
          logFile = path.join(this.logsDir, 'integrations', `${platform}_integration.log`);
          break;
        case this.logTypes.shield:
          logFile = path.join(this.logsDir, 'shield', `${platform}_shield.log`);
          break;
        case this.logTypes.security:
          logFile = path.join(this.logsDir, 'security', `security.log`);
          break;
        default:
          logFile = path.join(this.logsDir, `${platform}_normal.log`);
      }

      const logEntry = this.formatLogEntry(level, platform, message, data);
      await fs.appendFile(logFile, logEntry);

      // Also log to console if debug mode
      if (process.env.DEBUG === 'true') {
        console.log(`[${level.toUpperCase()}] [${platform.toUpperCase()}] ${message}`);
        if (data) {
          console.log('Data:', data);
        }
      }

    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  /**
   * Log normal roast activity
   */
  async logNormal(platform, level, message, data = null) {
    await this.writeLog(this.logTypes.normal, platform, level, message, data);
  }

  /**
   * Log Shield activity (sensitive content warning)
   */
  async logShield(platform, level, message, data = null) {
    // Add warning to Shield logs
    const warningMessage = `[⚠️ SENSITIVE CONTENT] ${message}`;
    await this.writeLog(this.logTypes.shield, platform, level, warningMessage, data);
  }

  /**
   * Log integration activity
   */
  async logIntegration(platform, level, message, data = null) {
    await this.writeLog(this.logTypes.integration, platform, level, message, data);
  }

  /**
   * Log security events (reincidence, auto-actions, etc.)
   */
  async logSecurity(level, message, data = null) {
    await this.writeLog(this.logTypes.security, 'security', level, message, data);
  }

  /**
   * Log user reincidence
   */
  async logReincidence(platform, userId, username, count, severity, data = null) {
    const message = `User reincidence detected: ${username} (${userId}) - Count: ${count}, Severity: ${severity}`;
    
    const logData = {
      userId,
      username,
      reincidenceCount: count,
      severity,
      platform,
      ...data
    };

    await this.logSecurity('warning', message, logData);
  }

  /**
   * Log automatic actions taken
   */
  async logAutoAction(platform, action, userId, username, reason, data = null) {
    const message = `Auto-action executed: ${action} on ${username} (${userId}) - Reason: ${reason}`;
    
    const logData = {
      action,
      userId,
      username,
      reason,
      platform,
      timestamp: this.getTimestamp(),
      ...data
    };

    await this.logSecurity('info', message, logData);
    await this.logShield(platform, 'action', message, logData);
  }

  /**
   * Log roast generation
   */
  async logRoast(platform, mode, userId, originalMessage, roastResponse, tone, data = null) {
    const isShield = mode === 'shield';
    const message = `Roast generated for ${userId} - Tone: ${tone}`;
    
    const logData = {
      userId,
      originalMessage: isShield ? '[REDACTED]' : originalMessage,
      roastResponse: isShield ? '[REDACTED]' : roastResponse,
      tone,
      mode,
      ...data
    };

    if (isShield) {
      await this.logShield(platform, 'roast', message, logData);
    } else {
      await this.logNormal(platform, 'roast', message, logData);
    }
  }

  /**
   * Get log files list
   */
  async getLogFiles() {
    try {
      const logFiles = {
        normal: [],
        integration: [],
        shield: [],
        security: []
      };

      // Get normal logs
      const normalFiles = await fs.readdir(this.logsDir);
      logFiles.normal = normalFiles.filter(f => f.endsWith('_normal.log'));

      // Get integration logs
      const integrationsDir = path.join(this.logsDir, 'integrations');
      if (await fs.pathExists(integrationsDir)) {
        logFiles.integration = await fs.readdir(integrationsDir);
      }

      // Get shield logs
      const shieldDir = path.join(this.logsDir, 'shield');
      if (await fs.pathExists(shieldDir)) {
        logFiles.shield = await fs.readdir(shieldDir);
      }

      // Get security logs
      const securityDir = path.join(this.logsDir, 'security');
      if (await fs.pathExists(securityDir)) {
        logFiles.security = await fs.readdir(securityDir);
      }

      return logFiles;

    } catch (error) {
      console.error('Error getting log files:', error);
      return { normal: [], integration: [], shield: [], security: [] };
    }
  }

  /**
   * Read log file content
   */
  async readLog(logType, filename, lines = 100) {
    try {
      let logFile;
      
      switch (logType) {
        case 'integration':
          logFile = path.join(this.logsDir, 'integrations', filename);
          break;
        case 'shield':
          logFile = path.join(this.logsDir, 'shield', filename);
          break;
        case 'security':
          logFile = path.join(this.logsDir, 'security', filename);
          break;
        default:
          logFile = path.join(this.logsDir, filename);
      }

      if (!(await fs.pathExists(logFile))) {
        return [];
      }

      const content = await fs.readFile(logFile, 'utf8');
      const logLines = content.trim().split('\n').filter(line => line.length > 0);
      
      // Return last N lines
      const recentLines = logLines.slice(-lines);
      
      // Parse JSON entries
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line, timestamp: null };
        }
      });

    } catch (error) {
      console.error('Error reading log file:', error);
      return [];
    }
  }

  /**
   * Clean old log files
   */
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const logDirs = [
        this.logsDir,
        path.join(this.logsDir, 'integrations'),
        path.join(this.logsDir, 'shield'),
        path.join(this.logsDir, 'security')
      ];

      for (const dir of logDirs) {
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.remove(filePath);
              console.log(`Cleaned old log file: ${file}`);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error cleaning old logs:', error);
    }
  }
}

module.exports = new AdvancedLogger();