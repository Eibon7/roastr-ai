#!/usr/bin/env node

/**
 * Migration Script: Free → Starter Trial
 * Issue #678 - Convert existing Free users to Starter Trial
 *
 * This script:
 * 1. Finds all users with plan_id = 'free'
 * 2. Converts them to starter_trial with 30-day trial
 * 3. Logs the conversion for audit purposes
 *
 * Run once after deploying the new schema.
 */

const { supabaseServiceClient } = require('../src/config/supabase');
const { logger } = require('../src/utils/logger');

async function migrateFreeToStarterTrial() {
  logger.info('Starting migration: Free → Starter Trial');

  try {
    // Find all users with free plan
    const { data: freeUsers, error: fetchError } = await supabaseServiceClient
      .from('organizations')
      .select('id, plan_id, created_at')
      .eq('plan_id', 'free');

    if (fetchError) {
      throw new Error(`Failed to fetch free users: ${fetchError.message}`);
    }

    if (!freeUsers || freeUsers.length === 0) {
      logger.info('No users found with free plan. Migration complete.');
      return { migrated: 0, skipped: 0 };
    }

    logger.info(`Found ${freeUsers.length} users with free plan`);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    let migrated = 0;
    let skipped = 0;

    // Migrate each user
    for (const user of freeUsers) {
      try {
        const { error: updateError } = await supabaseServiceClient
          .from('organizations')
          .update({
            plan_id: 'starter_trial',
            trial_starts_at: new Date().toISOString(),
            trial_ends_at: trialEndDate.toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          logger.error(`Failed to migrate user ${user.id}: ${updateError.message}`);
          skipped++;
        } else {
          logger.info(`Migrated user ${user.id} from free to starter_trial`);
          migrated++;
        }
      } catch (error) {
        logger.error(`Error migrating user ${user.id}: ${error.message}`);
        skipped++;
      }
    }

    logger.info(`Migration complete: ${migrated} migrated, ${skipped} skipped`);

    // Verify migration
    const { data: remainingFree, error: verifyError } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('plan_id', 'free');

    if (verifyError) {
      logger.warn(`Could not verify migration: ${verifyError.message}`);
    } else if (remainingFree && remainingFree.length > 0) {
      logger.warn(`${remainingFree.length} users still have free plan after migration`);
    } else {
      logger.info('✅ Migration verification passed: no users remain on free plan');
    }

    return { migrated, skipped };

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateFreeToStarterTrial()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateFreeToStarterTrial };
