#!/usr/bin/env node

/**
 * Backfill Script for Credits v2 System
 *
 * This script initializes usage_counters for all existing users
 * with their current plan limits and billing periods.
 *
 * Usage:
 *   node scripts/backfill_credits_v2.js [--dry-run] [--batch-size=100]
 *
 * Options:
 *   --dry-run: Show what would be done without making changes
 *   --batch-size: Number of users to process per batch (default: 100)
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../src/utils/logger');

// Plan limits mapping (from issue requirements)
const PLAN_LIMITS = {
  free: {
    analysis_limit: 100,
    roast_limit: 10
  },
  starter: {
    analysis_limit: 1000,
    roast_limit: 10
  },
  pro: {
    analysis_limit: 10000,
    roast_limit: 1000
  },
  plus: {
    analysis_limit: 100000,
    roast_limit: 5000
  },
  creator_plus: {
    // Legacy plan mapping
    analysis_limit: 100000,
    roast_limit: 5000
  }
};

class CreditsV2Backfill {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.batchSize = options.batchSize || 100;
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    this.stats = {
      totalUsers: 0,
      processedUsers: 0,
      createdPeriods: 0,
      skippedUsers: 0,
      errors: 0
    };
  }

  async run() {
    logger.info('🚀 Starting Credits v2 backfill process', {
      dryRun: this.dryRun,
      batchSize: this.batchSize
    });

    try {
      // Get total user count
      await this.getTotalUserCount();

      // Process users in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const users = await this.getUserBatch(offset);

        if (users.length === 0) {
          hasMore = false;
          break;
        }

        await this.processBatch(users);

        offset += this.batchSize;
        hasMore = users.length === this.batchSize;

        // Progress update
        logger.info('📊 Batch progress', {
          processed: this.stats.processedUsers,
          total: this.stats.totalUsers,
          percentage: Math.round((this.stats.processedUsers / this.stats.totalUsers) * 100)
        });
      }

      await this.printSummary();
    } catch (error) {
      logger.error('❌ Backfill process failed', error);
      process.exit(1);
    }
  }

  async getTotalUserCount() {
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to get user count: ${error.message}`);
    }

    this.stats.totalUsers = count;
    logger.info(`📈 Found ${count} total users to process`);
  }

  async getUserBatch(offset) {
    const { data: users, error } = await this.supabase
      .from('users')
      .select(
        `
        id,
        plan,
        created_at,
        user_subscriptions (
          stripe_customer_id,
          current_period_start,
          current_period_end,
          status
        )
      `
      )
      .range(offset, offset + this.batchSize - 1)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch user batch: ${error.message}`);
    }

    return users || [];
  }

  async processBatch(users) {
    for (const user of users) {
      try {
        await this.processUser(user);
        this.stats.processedUsers++;
      } catch (error) {
        logger.error('❌ Failed to process user', {
          userId: user.id,
          error: error.message
        });
        this.stats.errors++;
      }
    }
  }

  async processUser(user) {
    // Check if user already has an active period
    const existingPeriod = await this.checkExistingPeriod(user.id);
    if (existingPeriod) {
      logger.debug('⏭️ User already has active period, skipping', {
        userId: user.id
      });
      this.stats.skippedUsers++;
      return;
    }

    // Get plan limits
    const planLimits = this.getPlanLimits(user.plan);

    // Calculate billing period
    const { periodStart, periodEnd } = this.calculateBillingPeriod(user);

    // Create usage counter record
    const usageCounter = {
      user_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      analysis_used: 0,
      analysis_limit: planLimits.analysis_limit,
      roast_used: 0,
      roast_limit: planLimits.roast_limit,
      stripe_customer_id: user.user_subscriptions?.[0]?.stripe_customer_id || null
    };

    if (this.dryRun) {
      logger.info('🔍 [DRY RUN] Would create usage counter', {
        userId: user.id,
        plan: user.plan,
        ...usageCounter
      });
    } else {
      const { error } = await this.supabase.from('usage_counters').insert(usageCounter);

      if (error) {
        throw new Error(`Failed to create usage counter: ${error.message}`);
      }

      logger.debug('✅ Created usage counter', {
        userId: user.id,
        plan: user.plan,
        analysisLimit: planLimits.analysis_limit,
        roastLimit: planLimits.roast_limit
      });
    }

    this.stats.createdPeriods++;
  }

  async checkExistingPeriod(userId) {
    const { data, error } = await this.supabase
      .from('usage_counters')
      .select('id')
      .eq('user_id', userId)
      .lte('period_start', new Date().toISOString())
      .gt('period_end', new Date().toISOString())
      .limit(1);

    if (error) {
      logger.warn('⚠️ Failed to check existing period', {
        userId,
        error: error.message
      });
      return false;
    }

    return data && data.length > 0;
  }

  getPlanLimits(planName) {
    const normalizedPlan = (planName || 'free').toLowerCase();
    return PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.free;
  }

  calculateBillingPeriod(user) {
    const subscription = user.user_subscriptions?.[0];

    // Use Stripe billing cycle if available and active
    if (
      subscription &&
      subscription.status === 'active' &&
      subscription.current_period_start &&
      subscription.current_period_end
    ) {
      return {
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end
      };
    }

    // Fallback to current natural month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    };
  }

  async printSummary() {
    logger.info('📋 Backfill Summary', {
      mode: this.dryRun ? 'DRY RUN' : 'LIVE',
      ...this.stats,
      successRate: Math.round(
        ((this.stats.processedUsers - this.stats.errors) / this.stats.processedUsers) * 100
      )
    });

    if (this.stats.errors > 0) {
      logger.warn('⚠️ Some users failed to process. Check logs for details.');
    }

    if (this.dryRun) {
      logger.info('🔍 This was a dry run. No changes were made to the database.');
      logger.info('💡 Run without --dry-run to apply changes.');
    } else {
      logger.info('✅ Backfill completed successfully!');
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1]) || 100
  };

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    logger.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const backfill = new CreditsV2Backfill(options);
  await backfill.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('❌ Unhandled error in backfill script', error);
    process.exit(1);
  });
}

module.exports = { CreditsV2Backfill, PLAN_LIMITS };
