/**
 * Stylecard Service - Issue #293
 * Manages automatic style profile generation from social media content
 */

const { supabaseServiceClient } = require('../config/supabase');
const embeddingsService = require('./embeddingsService');
const styleProfileGenerator = require('./styleProfileGenerator');
const logger = require('../utils/logger');

class StylecardService {
  constructor() {
    this.supabase = supabaseServiceClient;
    
    // Configuration
    this.config = {
      maxContentPerPlatform: parseInt(process.env.STYLECARD_MAX_CONTENT_PER_PLATFORM) || 50,
      maxRetries: 3,
      retentionDays: parseInt(process.env.STYLECARD_CONTENT_RETENTION_DAYS) || 90,
      supportedPlatforms: ['twitter', 'instagram', 'tiktok', 'youtube', 'twitch'],
      embeddingModel: 'text-embedding-3-small',
      maxTokensPerContent: 8000 // Limit for embedding generation
    };
  }

  /**
   * Trigger stylecard generation for a user when they upgrade to Pro/Plus
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {Array} connectedPlatforms - Array of connected platform names
   * @param {Object} options - Generation options
   */
  async triggerStylecardGeneration(userId, organizationId, connectedPlatforms, options = {}) {
    try {
      logger.info('Starting stylecard generation', {
        userId,
        organizationId,
        platforms: connectedPlatforms,
        options
      });

      // Check if user already has an active stylecard
      const existingStylecard = await this.getActiveStylecard(userId, options.language || 'es');
      if (existingStylecard && !options.forceRegenerate) {
        logger.info('User already has active stylecard', { userId, stylecardId: existingStylecard.id });
        return { success: true, stylecard: existingStylecard, regenerated: false };
      }

      // Create generation job
      const job = await this.createGenerationJob(userId, organizationId, connectedPlatforms, options);
      
      // Start processing asynchronously
      this.processGenerationJob(job.id).catch(error => {
        logger.error('Stylecard generation job failed', {
          jobId: job.id,
          userId,
          error: error.message,
          stack: error.stack
        });
      });

      return { 
        success: true, 
        jobId: job.id, 
        message: 'Stylecard generation started',
        estimatedCompletionMinutes: Math.ceil(connectedPlatforms.length * 2) // Rough estimate
      };

    } catch (error) {
      logger.error('Failed to trigger stylecard generation', {
        userId,
        organizationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create a new generation job
   * @private
   */
  async createGenerationJob(userId, organizationId, platforms, options) {
    const { data: job, error } = await this.supabase
      .from('stylecard_generation_jobs')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        target_platforms: platforms,
        max_content_per_platform: options.maxContent || this.config.maxContentPerPlatform,
        language_filter: options.language || 'es',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return job;
  }

  /**
   * Process a generation job
   * @private
   */
  async processGenerationJob(jobId) {
    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running', { started_at: new Date().toISOString() });

      const job = await this.getGenerationJob(jobId);
      if (!job) throw new Error('Generation job not found');

      logger.info('Processing stylecard generation job', { jobId, userId: job.user_id });

      // Get user's connected integrations
      const integrations = await this.getUserIntegrations(job.organization_id, job.target_platforms);
      
      if (integrations.length === 0) {
        throw new Error('No connected integrations found for specified platforms');
      }

      let totalContentAnalyzed = 0;
      const platformResults = {};
      const allContentSamples = [];

      // Process each platform
      for (let i = 0; i < integrations.length; i++) {
        const integration = integrations[i];
        const progress = Math.floor((i / integrations.length) * 80); // Reserve 20% for final processing
        
        await this.updateJobProgress(jobId, progress);

        try {
          logger.info('Processing platform content', { 
            jobId, 
            platform: integration.platform,
            progress: `${progress}%`
          });

          const contentSamples = await this.collectPlatformContent(
            integration, 
            job.max_content_per_platform,
            job.language_filter
          );

          if (contentSamples.length > 0) {
            allContentSamples.push(...contentSamples);
            totalContentAnalyzed += contentSamples.length;
            platformResults[integration.platform] = {
              contentCount: contentSamples.length,
              status: 'success'
            };
          } else {
            platformResults[integration.platform] = {
              contentCount: 0,
              status: 'no_content',
              message: 'No suitable content found'
            };
          }

        } catch (platformError) {
          logger.warn('Failed to process platform content', {
            jobId,
            platform: integration.platform,
            error: platformError.message
          });
          
          platformResults[integration.platform] = {
            contentCount: 0,
            status: 'error',
            error: platformError.message
          };
        }
      }

      // Update progress to 80%
      await this.updateJobProgress(jobId, 80);

      // Generate stylecard if we have enough content
      if (allContentSamples.length < 3) {
        // Fallback to neutral stylecard
        const neutralStylecard = await this.generateNeutralStylecard(
          job.user_id, 
          job.organization_id, 
          job.language_filter
        );
        
        await this.completeJob(jobId, neutralStylecard.id, totalContentAnalyzed, platformResults);
        return neutralStylecard;
      }

      // Generate embeddings and analyze content
      await this.updateJobProgress(jobId, 90);
      const stylecard = await this.generateStylecardFromContent(
        job.user_id,
        job.organization_id,
        allContentSamples,
        job.language_filter,
        platformResults
      );

      // Complete the job
      await this.updateJobProgress(jobId, 100);
      await this.completeJob(jobId, stylecard.id, totalContentAnalyzed, platformResults);

      logger.info('Stylecard generation completed successfully', {
        jobId,
        stylecardId: stylecard.id,
        contentAnalyzed: totalContentAnalyzed,
        platforms: Object.keys(platformResults)
      });

      return stylecard;

    } catch (error) {
      logger.error('Stylecard generation job failed', {
        jobId,
        error: error.message,
        stack: error.stack
      });

      await this.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
        completed_at: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Get user's connected integrations for specified platforms
   * @private
   */
  async getUserIntegrations(organizationId, targetPlatforms) {
    const { data: integrations, error } = await this.supabase
      .from('integration_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('enabled', true)
      .in('platform', targetPlatforms);

    if (error) throw error;
    return integrations || [];
  }

  /**
   * Get active stylecard for user
   */
  async getActiveStylecard(userId, language = 'es') {
    const { data: stylecard, error } = await this.supabase
      .from('stylecards')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return stylecard;
  }

  /**
   * Update job status
   * @private
   */
  async updateJobStatus(jobId, status, additionalFields = {}) {
    const { error } = await this.supabase
      .from('stylecard_generation_jobs')
      .update({
        status,
        ...additionalFields
      })
      .eq('id', jobId);

    if (error) throw error;
  }

  /**
   * Update job progress
   * @private
   */
  async updateJobProgress(jobId, percentage) {
    await this.updateJobStatus(jobId, 'running', { progress_percentage: percentage });
  }

  /**
   * Get generation job by ID
   * @private
   */
  async getGenerationJob(jobId) {
    const { data: job, error } = await this.supabase
      .from('stylecard_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return job;
  }

  /**
   * Complete a generation job
   * @private
   */
  async completeJob(jobId, stylecardId, contentAnalyzed, platformResults) {
    await this.updateJobStatus(jobId, 'completed', {
      stylecard_id: stylecardId,
      content_analyzed: contentAnalyzed,
      platforms_processed: platformResults,
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Collect content from a specific platform
   * @private
   */
  async collectPlatformContent(integration, maxContent, languageFilter) {
    const platformCollector = this.getPlatformCollector(integration.platform);
    if (!platformCollector) {
      throw new Error(`No collector available for platform: ${integration.platform}`);
    }

    try {
      const content = await platformCollector.collectRecentContent(
        integration.config,
        maxContent,
        languageFilter
      );

      // Filter and validate content
      const validContent = content.filter(item =>
        item.text &&
        item.text.trim().length > 10 &&
        item.text.length <= this.config.maxTokensPerContent &&
        !this.isSensitiveContent(item)
      );

      logger.info('Collected platform content', {
        platform: integration.platform,
        totalFound: content.length,
        validContent: validContent.length
      });

      return validContent;

    } catch (error) {
      logger.error('Failed to collect platform content', {
        platform: integration.platform,
        error: error.message
      });

      // Return empty array instead of throwing to allow other platforms to continue
      return [];
    }
  }

  /**
   * Get platform-specific content collector
   * @private
   */
  getPlatformCollector(platform) {
    const collectors = {
      twitter: require('./collectors/twitterCollector'),
      instagram: require('./collectors/instagramCollector'),
      tiktok: require('./collectors/tiktokCollector'),
      youtube: require('./collectors/youtubeCollector'),
      twitch: require('./collectors/twitchCollector')
    };

    return collectors[platform] || null;
  }

  /**
   * Check if content contains sensitive information
   * @private
   */
  isSensitiveContent(content) {
    const sensitivePatterns = [
      /\b(password|token|key|secret)\b/i,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email patterns
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ // Phone patterns
    ];

    return sensitivePatterns.some(pattern => pattern.test(content.text));
  }

  /**
   * Generate stylecard from collected content
   * @private
   */
  async generateStylecardFromContent(userId, organizationId, contentSamples, language, platformResults) {
    try {
      // Generate embeddings for all content
      const contentWithEmbeddings = await this.generateContentEmbeddings(contentSamples);

      // Analyze style characteristics
      const styleAnalysis = await this.analyzeContentStyle(contentWithEmbeddings, language);

      // Generate style prompt using AI
      const stylePrompt = await this.generateStylePrompt(styleAnalysis, contentWithEmbeddings);

      // Create stylecard record
      const stylecard = await this.createStylecard(
        userId,
        organizationId,
        styleAnalysis,
        stylePrompt,
        platformResults,
        language
      );

      // Store content samples (encrypted)
      await this.storeContentSamples(stylecard.id, contentWithEmbeddings);

      return stylecard;

    } catch (error) {
      logger.error('Failed to generate stylecard from content', {
        userId,
        contentCount: contentSamples.length,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for content samples
   * @private
   */
  async generateContentEmbeddings(contentSamples) {
    const contentWithEmbeddings = [];

    for (const content of contentSamples) {
      try {
        const embedding = await embeddingsService.generateEmbedding(
          content.text,
          this.config.embeddingModel
        );

        contentWithEmbeddings.push({
          ...content,
          embedding: embedding.data[0].embedding
        });

      } catch (error) {
        logger.warn('Failed to generate embedding for content', {
          contentId: content.id,
          platform: content.platform,
          error: error.message
        });
        // Continue without this content sample
      }
    }

    return contentWithEmbeddings;
  }

  /**
   * Analyze style characteristics from content
   * @private
   */
  async analyzeContentStyle(contentWithEmbeddings, language) {
    // Use existing style profile generator
    const analysis = await styleProfileGenerator.analyzeContentStyle(
      contentWithEmbeddings.map(c => c.text),
      language
    );

    // Calculate average characteristics
    const toneDistribution = this.calculateToneDistribution(contentWithEmbeddings);
    const formalityLevel = this.calculateFormalityLevel(contentWithEmbeddings);
    const sarcasmLevel = this.calculateSarcasmLevel(contentWithEmbeddings);

    return {
      ...analysis,
      tone: this.determinePredominantTone(toneDistribution),
      formality_level: formalityLevel,
      sarcasm_level: sarcasmLevel,
      examples: this.selectRepresentativeExamples(contentWithEmbeddings, 5),
      metadata: {
        total_content_analyzed: contentWithEmbeddings.length,
        tone_distribution: toneDistribution,
        language_detected: language
      }
    };
  }

  /**
   * Generate neutral stylecard for users with insufficient content
   * @private
   */
  async generateNeutralStylecard(userId, organizationId, language) {
    const neutralStyle = {
      tone: 'equilibrado',
      formality_level: 5,
      sarcasm_level: 3,
      examples: [],
      metadata: {
        generation_method: 'neutral_fallback',
        reason: 'insufficient_content'
      }
    };

    const stylePrompt = await styleProfileGenerator.generateNeutralPrompt(language);

    return await this.createStylecard(
      userId,
      organizationId,
      neutralStyle,
      stylePrompt,
      {},
      language
    );
  }

  /**
   * Create stylecard record in database
   * @private
   */
  async createStylecard(userId, organizationId, styleAnalysis, stylePrompt, platformResults, language) {
    // Generate style embedding from the prompt
    const styleEmbedding = await embeddingsService.generateEmbedding(
      stylePrompt,
      this.config.embeddingModel
    );

    const { data: stylecard, error } = await this.supabase
      .from('stylecards')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        language: language,
        tone: styleAnalysis.tone,
        formality_level: styleAnalysis.formality_level,
        sarcasm_level: styleAnalysis.sarcasm_level,
        style_prompt: stylePrompt,
        examples: styleAnalysis.examples || [],
        metadata: styleAnalysis.metadata || {},
        source_platforms: platformResults,
        total_content_analyzed: styleAnalysis.metadata?.total_content_analyzed || 0,
        style_embedding: styleEmbedding.data[0].embedding,
        status: 'active',
        generation_method: styleAnalysis.metadata?.generation_method || 'auto'
      })
      .select()
      .single();

    if (error) throw error;
    return stylecard;
  }

  /**
   * Store encrypted content samples
   * @private
   */
  async storeContentSamples(stylecardId, contentWithEmbeddings) {
    const crypto = require('crypto');
    const encryptionKey = process.env.CONTENT_ENCRYPTION_KEY;

    if (!encryptionKey) {
      logger.warn('No encryption key provided, skipping content storage');
      return;
    }

    const samples = contentWithEmbeddings.map(content => {
      // Encrypt the content text
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
      let encrypted = cipher.update(content.text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        stylecard_id: stylecardId,
        platform: content.platform,
        platform_content_id: content.id,
        content_type: content.type || 'post',
        content_text_encrypted: encrypted,
        content_metadata: {
          length: content.text.length,
          language: content.language || 'unknown',
          created_at: content.created_at
        },
        content_embedding: content.embedding,
        language_detected: content.language || 'unknown',
        user_consented: true, // User consented when upgrading to Pro/Plus
        retention_until: new Date(Date.now() + (this.config.retentionDays * 24 * 60 * 60 * 1000)),
        content_date: content.created_at || new Date()
      };
    });

    const { error } = await this.supabase
      .from('stylecard_content_samples')
      .insert(samples);

    if (error) {
      logger.error('Failed to store content samples', { error: error.message });
      // Don't throw - stylecard can exist without stored samples
    }
  }

  /**
   * Calculate tone distribution from content
   * @private
   */
  calculateToneDistribution(contentSamples) {
    // Simplified tone analysis - in production, use more sophisticated NLP
    const tones = { ligero: 0, equilibrado: 0, contundente: 0, humorous: 0, sarcastic: 0 };

    contentSamples.forEach(content => {
      const text = content.text.toLowerCase();

      // Simple keyword-based tone detection
      if (text.includes('jaja') || text.includes('lol') || text.includes('😂')) {
        tones.humorous++;
      } else if (text.includes('!') && text.split('!').length > 2) {
        tones.contundente++;
      } else if (text.includes('...') || text.includes('tal vez') || text.includes('quizás')) {
        tones.ligero++;
      } else {
        tones.equilibrado++;
      }
    });

    return tones;
  }

  /**
   * Determine predominant tone
   * @private
   */
  determinePredominantTone(toneDistribution) {
    return Object.keys(toneDistribution).reduce((a, b) =>
      toneDistribution[a] > toneDistribution[b] ? a : b
    );
  }

  /**
   * Calculate formality level (1-10)
   * @private
   */
  calculateFormalityLevel(contentSamples) {
    let formalityScore = 0;

    contentSamples.forEach(content => {
      const text = content.text;

      // Formal indicators
      if (/\b(usted|estimado|cordialmente|atentamente)\b/i.test(text)) formalityScore += 2;
      if (/[.!?]$/.test(text.trim())) formalityScore += 1;
      if (text.length > 100) formalityScore += 1;

      // Informal indicators
      if (/\b(jaja|lol|xd|wey|bro)\b/i.test(text)) formalityScore -= 2;
      if (/[\u{1F600}-\u{1F64F}]/u.test(text)) formalityScore -= 1; // Emoji range
      if (text.includes('...')) formalityScore -= 1;
    });

    // Normalize to 1-10 scale
    const avgScore = formalityScore / contentSamples.length;
    return Math.max(1, Math.min(10, Math.round(5 + avgScore)));
  }

  /**
   * Calculate sarcasm level (1-10)
   * @private
   */
  calculateSarcasmLevel(contentSamples) {
    let sarcasmScore = 0;

    contentSamples.forEach(content => {
      const text = content.text.toLowerCase();

      // Sarcasm indicators
      if (text.includes('obvio') || text.includes('claro que sí')) sarcasmScore += 2;
      if (text.includes('qué sorpresa') || text.includes('no me digas')) sarcasmScore += 2;
      if (/\b(genial|perfecto|excelente)\b/.test(text) && text.includes('...')) sarcasmScore += 1;
      if (text.includes('🙄') || text.includes('😏')) sarcasmScore += 1;
    });

    // Normalize to 1-10 scale
    const avgScore = sarcasmScore / contentSamples.length;
    return Math.max(1, Math.min(10, Math.round(3 + avgScore * 2)));
  }

  /**
   * Select representative examples from content
   * @private
   */
  selectRepresentativeExamples(contentSamples, count = 5) {
    // Sort by engagement or length, then take diverse samples
    const sorted = contentSamples
      .filter(c => c.text.length > 20 && c.text.length < 200)
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0));

    return sorted.slice(0, count).map(c => ({
      text: c.text,
      platform: c.platform,
      engagement: c.engagement || 0,
      created_at: c.created_at
    }));
  }

  /**
   * Generate style prompt using AI
   * @private
   */
  async generateStylePrompt(styleAnalysis, contentSamples) {
    return await styleProfileGenerator.generateStylePrompt(
      styleAnalysis,
      contentSamples.slice(0, 10) // Use top 10 samples for prompt generation
    );
  }
}

module.exports = new StylecardService();
