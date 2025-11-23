/**
 * Toxicity Patterns Service
 * Issue #154: Review and modularize slur regex patterns - isolate in external file
 *
 * This service manages toxicity detection patterns in a maintainable way:
 * - Loads patterns from external JSON configuration
 * - Provides pattern matching and scoring functionality
 * - Supports multiple languages and evasion detection
 * - Allows for easy pattern updates without code changes
 * - Implements caching for performance
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

class ToxicityPatternsService {
  constructor() {
    this.patterns = null;
    this.compiledPatterns = new Map();
    this.lastLoaded = null;
    this.loadPatterns();
  }

  /**
   * Load toxicity patterns from JSON configuration
   */
  loadPatterns() {
    try {
      const patternsPath = path.join(__dirname, '../config/toxicity-patterns.json');
      const patternsData = fs.readFileSync(patternsPath, 'utf8');
      this.patterns = JSON.parse(patternsData);
      this.lastLoaded = new Date();

      // Compile regex patterns for better performance
      this.compilePatterns();

      logger.info('Toxicity patterns loaded successfully:', {
        version: this.patterns.meta?.version,
        totalPatterns: this.getTotalPatternCount(),
        lastUpdated: this.patterns.meta?.lastUpdated
      });
    } catch (error) {
      logger.error('Failed to load toxicity patterns:', {
        error: error.message,
        fallbackUsed: true
      });

      // Fallback to basic patterns if file loading fails
      this.patterns = this.getFallbackPatterns();
      this.compilePatterns();
    }
  }

  /**
   * Compile regex patterns for better performance
   */
  compilePatterns() {
    this.compiledPatterns.clear();

    if (!this.patterns?.patterns) return;

    Object.keys(this.patterns.patterns).forEach((category) => {
      const categoryPatterns = this.patterns.patterns[category];
      this.compiledPatterns.set(category, []);

      categoryPatterns.forEach((patternConfig) => {
        try {
          const regex = new RegExp(patternConfig.pattern, patternConfig.flags || 'i');
          this.compiledPatterns.get(category).push({
            regex,
            score: patternConfig.score || 0.5,
            category,
            severity: patternConfig.severity || 'moderate',
            description: patternConfig.description || ''
          });
        } catch (error) {
          logger.warn('Invalid regex pattern skipped:', {
            pattern: patternConfig.pattern,
            category,
            error: error.message
          });
        }
      });
    });

    // Compile Spanish patterns if available
    if (this.patterns.spanish_patterns?.patterns) {
      Object.keys(this.patterns.spanish_patterns.patterns).forEach((category) => {
        const spanishCategory = `spanish_${category}`;
        const categoryPatterns = this.patterns.spanish_patterns.patterns[category];
        this.compiledPatterns.set(spanishCategory, []);

        categoryPatterns.forEach((patternConfig) => {
          try {
            const regex = new RegExp(patternConfig.pattern, patternConfig.flags || 'i');
            this.compiledPatterns.get(spanishCategory).push({
              regex,
              score: patternConfig.score || 0.5,
              category: spanishCategory,
              severity: patternConfig.severity || 'moderate',
              description: patternConfig.description || ''
            });
          } catch (error) {
            logger.warn('Invalid Spanish regex pattern skipped:', {
              pattern: patternConfig.pattern,
              category: spanishCategory,
              error: error.message
            });
          }
        });
      });
    }
  }

  /**
   * Analyze text for toxicity using loaded patterns
   * @param {string} text - Text to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} - Analysis results with matches and scores
   */
  analyzeText(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        totalScore: 0,
        matches: [],
        categories: [],
        severity: 'none',
        hasToxicity: false
      };
    }

    const {
      includeSpanish = true,
      contextWindow = this.patterns?.configuration?.context_window_chars || 50,
      minScore = this.patterns?.configuration?.min_score_threshold || 0.1
    } = options;

    const matches = [];
    let totalScore = 0;
    const categoriesFound = new Set();

    // Analyze with all compiled patterns
    for (const [category, patterns] of this.compiledPatterns) {
      // Skip Spanish patterns if not requested
      if (!includeSpanish && category.startsWith('spanish_')) {
        continue;
      }

      for (const patternData of patterns) {
        const regexMatches = text.matchAll(new RegExp(patternData.regex.source, 'gi'));

        for (const match of regexMatches) {
          const startIndex = match.index;
          const endIndex = startIndex + match[0].length;

          // Extract context around the match
          const contextStart = Math.max(0, startIndex - contextWindow);
          const contextEnd = Math.min(text.length, endIndex + contextWindow);
          const context = text.substring(contextStart, contextEnd);

          matches.push({
            match: match[0],
            pattern: patternData.regex.source,
            score: patternData.score,
            category: patternData.category,
            severity: patternData.severity,
            description: patternData.description,
            position: { start: startIndex, end: endIndex },
            context: context.trim()
          });

          totalScore += patternData.score;
          categoriesFound.add(patternData.category);
        }
      }
    }

    // Apply contextual rules and amplifiers
    totalScore = this.applyContextualRules(text, matches, totalScore);

    // Cap the score at maximum
    const maxScore = this.patterns?.configuration?.max_score_cap || 1.0;
    totalScore = Math.min(totalScore, maxScore);

    // Determine overall severity
    const severity = this.calculateOverallSeverity(matches, totalScore);

    return {
      totalScore: Math.round(totalScore * 1000) / 1000, // Round to 3 decimal places
      matches,
      categories: Array.from(categoriesFound),
      severity,
      hasToxicity: totalScore >= minScore,
      analysisDetails: {
        patternCount: this.getTotalPatternCount(),
        contextWindow,
        minScore,
        includeSpanish
      }
    };
  }

  /**
   * Apply contextual rules to adjust toxicity scores
   */
  applyContextualRules(text, matches, baseScore) {
    if (!this.patterns?.contextual_rules) return baseScore;

    let adjustedScore = baseScore;

    for (const rule of this.patterns.contextual_rules) {
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const ruleMatches = text.match(regex);

          if (ruleMatches) {
            const boost = Math.min(
              ruleMatches.length * (rule.multiplier - 1) * baseScore,
              rule.max_boost || 0.2
            );
            adjustedScore += boost;
          }
        } catch (error) {
          logger.warn('Invalid contextual rule pattern:', {
            rule: rule.name,
            pattern,
            error: error.message
          });
        }
      }
    }

    return adjustedScore;
  }

  /**
   * Calculate overall severity based on matches and score
   */
  calculateOverallSeverity(matches, totalScore) {
    if (totalScore < 0.2) return 'none';
    if (totalScore < 0.4) return 'mild';
    if (totalScore < 0.6) return 'moderate';
    if (totalScore < 0.8) return 'high';
    return 'severe';
  }

  /**
   * Get patterns compatible with AnalyzeToxicityWorker format
   * @returns {Array} - Array of pattern objects for backward compatibility
   */
  getToxicPatternsForWorker() {
    const workerPatterns = [];

    if (!this.compiledPatterns) return workerPatterns;

    for (const [category, patterns] of this.compiledPatterns) {
      for (const patternData of patterns) {
        workerPatterns.push({
          pattern: patternData.regex,
          score: patternData.score,
          category: patternData.category
        });
      }
    }

    return workerPatterns;
  }

  /**
   * Get slur patterns specifically (for backward compatibility)
   * @returns {Array} - Array of slur regex patterns
   */
  getSlurPatterns() {
    const slurPatterns = [];

    if (this.compiledPatterns.has('slurs')) {
      for (const patternData of this.compiledPatterns.get('slurs')) {
        slurPatterns.push(patternData.regex);
      }
    }

    return slurPatterns;
  }

  /**
   * Get pattern statistics
   */
  getPatternStats() {
    const stats = {
      totalPatterns: this.getTotalPatternCount(),
      categories: {},
      lastLoaded: this.lastLoaded,
      version: this.patterns?.meta?.version
    };

    for (const [category, patterns] of this.compiledPatterns) {
      stats.categories[category] = patterns.length;
    }

    return stats;
  }

  /**
   * Get total pattern count
   */
  getTotalPatternCount() {
    let total = 0;
    for (const patterns of this.compiledPatterns.values()) {
      total += patterns.length;
    }
    return total;
  }

  /**
   * Fallback patterns if external file fails to load
   */
  getFallbackPatterns() {
    return {
      meta: {
        version: '1.0.0-fallback',
        description: 'Fallback toxicity patterns'
      },
      patterns: {
        insults: [
          { pattern: '\\b(idiot|stupid|dumb|moron)\\b', flags: 'i', score: 0.4, category: 'insult' }
        ],
        threats: [
          { pattern: '\\b(hate|kill|die|death)\\b', flags: 'i', score: 0.8, category: 'threat' }
        ],
        profanity: [
          { pattern: '\\b(fuck|shit|damn|ass)\\b', flags: 'i', score: 0.3, category: 'profanity' }
        ]
      },
      configuration: {
        context_window_chars: 50,
        min_score_threshold: 0.1,
        max_score_cap: 1.0
      }
    };
  }

  /**
   * Reload patterns from file (useful for updates)
   */
  reloadPatterns() {
    logger.info('Reloading toxicity patterns...');
    this.loadPatterns();
  }
}

// Export singleton instance
module.exports = new ToxicityPatternsService();
