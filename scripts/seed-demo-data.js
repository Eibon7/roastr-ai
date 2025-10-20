#!/usr/bin/env node

/**
 * @file seed-demo-data.js
 * @description Seeds demo mode data into the database (idempotent)
 *
 * Creates:
 * - 2 demo organizations (Spanish, English)
 * - 6 demo users (3 per language, different plan tiers)
 * - 35 demo comments (18 Spanish, 17 English) from fixtures
 *
 * Usage:
 *   node scripts/seed-demo-data.js [--dry-run] [--verbose] [--force]
 *
 * Options:
 *   --dry-run    Preview what would be created without making changes
 *   --verbose    Show detailed information about seeding process
 *   --force      Delete existing demo data before seeding
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error occurred
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  const colors = { red: '\x1b[31m', reset: '\x1b[0m' };
  console.error(`${colors.red}Error: Missing required environment variables${colors.reset}`);
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('Copy .env.example to .env and configure your credentials');
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const force = args.includes('--force');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Paths
const FIXTURES_DIR = path.join(__dirname, '..', 'data', 'fixtures', 'comments');
const ES_FIXTURES = path.join(FIXTURES_DIR, 'comments-es.json');
const EN_FIXTURES = path.join(FIXTURES_DIR, 'comments-en.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Demo organization configurations
const DEMO_ORGANIZATIONS = [
  {
    name: 'Demo: Organización Española',
    slug: 'demo-org-es',
    language: 'es',
    plan_tier: 'pro',
    settings: {
      default_language: 'es',
      demo_mode: true,
      platforms_enabled: ['twitter', 'youtube', 'facebook']
    }
  },
  {
    name: 'Demo: English Organization',
    slug: 'demo-org-en',
    language: 'en',
    plan_tier: 'pro',
    settings: {
      default_language: 'en',
      demo_mode: true,
      platforms_enabled: ['twitter', 'youtube', 'facebook']
    }
  }
];

// Demo user configurations
const DEMO_USERS = [
  // Spanish users
  {
    email: 'demo-free-es@demo.roastr.ai',
    username: 'demo_free_es',
    full_name: 'Usuario Demo Gratis',
    language: 'es',
    organization_slug: 'demo-org-es',
    plan_tier: 'free',
    settings: {
      demo_mode: true,
      tone: 'neutral'
    }
  },
  {
    email: 'demo-starter-es@demo.roastr.ai',
    username: 'demo_starter_es',
    full_name: 'Usuario Demo Starter',
    language: 'es',
    organization_slug: 'demo-org-es',
    plan_tier: 'starter',
    settings: {
      demo_mode: true,
      tone: 'friendly'
    }
  },
  {
    email: 'demo-pro-es@demo.roastr.ai',
    username: 'demo_pro_es',
    full_name: 'Usuario Demo Pro',
    language: 'es',
    organization_slug: 'demo-org-es',
    plan_tier: 'pro',
    settings: {
      demo_mode: true,
      tone: 'savage',
      custom_styles: ['humor_negro', 'sarcasmo']
    }
  },
  // English users
  {
    email: 'demo-free-en@demo.roastr.ai',
    username: 'demo_free_en',
    full_name: 'Demo Free User',
    language: 'en',
    organization_slug: 'demo-org-en',
    plan_tier: 'free',
    settings: {
      demo_mode: true,
      tone: 'neutral'
    }
  },
  {
    email: 'demo-starter-en@demo.roastr.ai',
    username: 'demo_starter_en',
    full_name: 'Demo Starter User',
    language: 'en',
    organization_slug: 'demo-org-en',
    plan_tier: 'starter',
    settings: {
      demo_mode: true,
      tone: 'friendly'
    }
  },
  {
    email: 'demo-pro-en@demo.roastr.ai',
    username: 'demo_pro_en',
    full_name: 'Demo Pro User',
    language: 'en',
    organization_slug: 'demo-org-en',
    plan_tier: 'pro',
    settings: {
      demo_mode: true,
      tone: 'savage',
      custom_styles: ['dark_humor', 'sarcasm']
    }
  }
];

/**
 * Load fixture files
 * @returns {Promise<Object>} Fixtures by language
 */
async function loadFixtures() {
  try {
    const esContent = fs.readFileSync(ES_FIXTURES, 'utf8');
    const enContent = fs.readFileSync(EN_FIXTURES, 'utf8');

    return {
      es: JSON.parse(esContent),
      en: JSON.parse(enContent)
    };
  } catch (error) {
    console.error(`${colors.red}Error loading fixtures: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Check if demo data already exists
 * @returns {Promise<boolean>}
 */
async function demoDataExists() {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .like('name', 'Demo:%')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  } catch (error) {
    console.error(`${colors.red}Error checking existing demo data: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Seed demo organizations
 * @returns {Promise<Object>} Map of slug -> organization ID
 */
async function seedOrganizations() {
  const orgMap = {};

  console.log(`\n${colors.cyan}Seeding organizations...${colors.reset}`);

  for (const orgConfig of DEMO_ORGANIZATIONS) {
    try {
      if (dryRun) {
        console.log(`${colors.dim}  [DRY RUN] Would create: ${orgConfig.name}${colors.reset}`);
        orgMap[orgConfig.slug] = `mock-org-id-${orgConfig.slug}`;
        continue;
      }

      // Check if organization already exists
      const { data: existing, error: findError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgConfig.slug)
        .single();

      if (existing && !findError) {
        if (verbose) {
          console.log(`${colors.yellow}  ⚠ Organization already exists: ${orgConfig.name}${colors.reset}`);
        }
        orgMap[orgConfig.slug] = existing.id;
        continue;
      }

      // Create organization
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: orgConfig.name,
          slug: orgConfig.slug,
          plan_tier: orgConfig.plan_tier,
          settings: orgConfig.settings,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error(`${colors.red}  ✗ Failed to create ${orgConfig.name}: ${createError.message}${colors.reset}`);
        throw createError;
      }

      orgMap[orgConfig.slug] = newOrg.id;
      console.log(`${colors.green}  ✓ Created: ${orgConfig.name} (${newOrg.id})${colors.reset}`);

    } catch (error) {
      console.error(`${colors.red}  ✗ Error seeding organization ${orgConfig.name}: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  return orgMap;
}

/**
 * Seed demo users
 * @param {Object} orgMap - Map of organization slug -> ID
 * @returns {Promise<Object>} Map of email -> user ID
 */
async function seedUsers(orgMap) {
  const userMap = {};

  console.log(`\n${colors.cyan}Seeding users...${colors.reset}`);

  for (const userConfig of DEMO_USERS) {
    try {
      const organizationId = orgMap[userConfig.organization_slug];

      if (!organizationId) {
        console.error(`${colors.red}  ✗ Organization not found for ${userConfig.email}${colors.reset}`);
        continue;
      }

      if (dryRun) {
        console.log(`${colors.dim}  [DRY RUN] Would create: ${userConfig.email} (${userConfig.plan_tier})${colors.reset}`);
        userMap[userConfig.email] = `mock-user-id-${userConfig.username}`;
        continue;
      }

      // Check if user already exists
      const { data: existing, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userConfig.email)
        .single();

      if (existing && !findError) {
        if (verbose) {
          console.log(`${colors.yellow}  ⚠ User already exists: ${userConfig.email}${colors.reset}`);
        }
        userMap[userConfig.email] = existing.id;
        continue;
      }

      // Hash password (demo password: "demo123")
      const passwordHash = await bcrypt.hash('demo123', 10);

      // Create user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: userConfig.email,
          username: userConfig.username,
          full_name: userConfig.full_name,
          password_hash: passwordHash,
          organization_id: organizationId,
          plan_tier: userConfig.plan_tier,
          settings: userConfig.settings,
          email_verified: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error(`${colors.red}  ✗ Failed to create ${userConfig.email}: ${createError.message}${colors.reset}`);
        throw createError;
      }

      userMap[userConfig.email] = newUser.id;
      console.log(`${colors.green}  ✓ Created: ${userConfig.email} (${userConfig.plan_tier})${colors.reset}`);

    } catch (error) {
      console.error(`${colors.red}  ✗ Error seeding user ${userConfig.email}: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  return userMap;
}

/**
 * Seed demo comments from fixtures
 * @param {Object} orgMap - Map of organization slug -> ID
 * @param {Object} userMap - Map of email -> user ID
 * @param {Object} fixtures - Fixtures by language
 * @returns {Promise<number>} Number of comments created
 */
async function seedComments(orgMap, userMap, fixtures) {
  let commentsCreated = 0;

  console.log(`\n${colors.cyan}Seeding comments...${colors.reset}`);

  // Seed Spanish comments
  const esOrgId = orgMap['demo-org-es'];
  const esUserId = userMap['demo-pro-es@demo.roastr.ai']; // Use Pro user for all demo comments

  for (const fixture of fixtures.es) {
    try {
      if (dryRun) {
        if (verbose) {
          console.log(`${colors.dim}  [DRY RUN] Would create ES comment: ${fixture.id} (${fixture.severity})${colors.reset}`);
        }
        commentsCreated++;
        continue;
      }

      // Check if comment already exists
      const { data: existing, error: findError } = await supabase
        .from('comments')
        .select('id')
        .eq('external_id', fixture.id)
        .eq('organization_id', esOrgId)
        .single();

      if (existing && !findError) {
        if (verbose) {
          console.log(`${colors.yellow}  ⚠ Comment already exists: ${fixture.id}${colors.reset}`);
        }
        continue;
      }

      // Create comment
      const { error: createError } = await supabase
        .from('comments')
        .insert({
          external_id: fixture.id,
          organization_id: esOrgId,
          user_id: esUserId,
          platform: fixture.platform,
          comment_text: fixture.comment_text,
          toxicity_score: fixture.toxicity_score,
          language: fixture.language,
          topic: fixture.topic,
          severity: fixture.severity,
          metadata: fixture.metadata,
          created_at: new Date().toISOString()
        });

      if (createError) {
        console.error(`${colors.red}  ✗ Failed to create comment ${fixture.id}: ${createError.message}${colors.reset}`);
        continue; // Continue with other comments
      }

      commentsCreated++;
      if (verbose) {
        console.log(`${colors.green}  ✓ Created ES comment: ${fixture.id} (${fixture.severity})${colors.reset}`);
      }

    } catch (error) {
      console.error(`${colors.red}  ✗ Error seeding comment ${fixture.id}: ${error.message}${colors.reset}`);
    }
  }

  // Seed English comments
  const enOrgId = orgMap['demo-org-en'];
  const enUserId = userMap['demo-pro-en@demo.roastr.ai']; // Use Pro user for all demo comments

  for (const fixture of fixtures.en) {
    try {
      if (dryRun) {
        if (verbose) {
          console.log(`${colors.dim}  [DRY RUN] Would create EN comment: ${fixture.id} (${fixture.severity})${colors.reset}`);
        }
        commentsCreated++;
        continue;
      }

      // Check if comment already exists
      const { data: existing, error: findError } = await supabase
        .from('comments')
        .select('id')
        .eq('external_id', fixture.id)
        .eq('organization_id', enOrgId)
        .single();

      if (existing && !findError) {
        if (verbose) {
          console.log(`${colors.yellow}  ⚠ Comment already exists: ${fixture.id}${colors.reset}`);
        }
        continue;
      }

      // Create comment
      const { error: createError } = await supabase
        .from('comments')
        .insert({
          external_id: fixture.id,
          organization_id: enOrgId,
          user_id: enUserId,
          platform: fixture.platform,
          comment_text: fixture.comment_text,
          toxicity_score: fixture.toxicity_score,
          language: fixture.language,
          topic: fixture.topic,
          severity: fixture.severity,
          metadata: fixture.metadata,
          created_at: new Date().toISOString()
        });

      if (createError) {
        console.error(`${colors.red}  ✗ Failed to create comment ${fixture.id}: ${createError.message}${colors.reset}`);
        continue; // Continue with other comments
      }

      commentsCreated++;
      if (verbose) {
        console.log(`${colors.green}  ✓ Created EN comment: ${fixture.id} (${fixture.severity})${colors.reset}`);
      }

    } catch (error) {
      console.error(`${colors.red}  ✗ Error seeding comment ${fixture.id}: ${error.message}${colors.reset}`);
    }
  }

  console.log(`${colors.green}  ✓ Created ${commentsCreated} comments total${colors.reset}`);

  return commentsCreated;
}

/**
 * Main seeding function
 */
async function main() {
  try {
    console.log(`\n${colors.bright}=== Demo Data Seeding ===${colors.reset}\n`);

    if (dryRun) {
      console.log(`${colors.yellow}DRY RUN MODE - No changes will be made${colors.reset}\n`);
    }

    // Load fixtures
    console.log(`${colors.cyan}Loading fixtures...${colors.reset}`);
    const fixtures = await loadFixtures();
    console.log(`${colors.green}  ✓ Loaded ${fixtures.es.length} Spanish + ${fixtures.en.length} English fixtures${colors.reset}`);

    // Check for existing demo data
    if (!force) {
      const exists = await demoDataExists();
      if (exists && !dryRun) {
        console.log(`\n${colors.yellow}Demo data already exists. Use --force to delete and reseed.${colors.reset}\n`);
        process.exit(0);
      }
    } else if (!dryRun) {
      console.log(`${colors.yellow}\nForce mode: Clearing existing demo data...${colors.reset}`);
      const { clearDemoOrganizations, clearDemoUsers } = require('./clear-demo-data.js');
      try {
        await clearDemoOrganizations();
        await clearDemoUsers();
      } catch (error) {
        console.error(`${colors.red}Failed to clear existing data: ${error.message}${colors.reset}`);
        process.exit(1);
      }
    }

    // Seed data
    const orgMap = await seedOrganizations();
    const userMap = await seedUsers(orgMap);
    const commentsCreated = await seedComments(orgMap, userMap, fixtures);

    // Print summary
    console.log(`\n${colors.cyan}${colors.bright}Summary:${colors.reset}`);
    console.log(`  Organizations: ${Object.keys(orgMap).length}`);
    console.log(`  Users: ${Object.keys(userMap).length}`);
    console.log(`  Comments: ${commentsCreated}`);

    if (dryRun) {
      console.log(`\n${colors.yellow}This was a dry run. Run without --dry-run to seed data.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.green}${colors.bright}✓ Demo data seeded successfully!${colors.reset}`);
      console.log(`\n${colors.cyan}Demo Login Credentials:${colors.reset}`);
      console.log(`  Spanish Free:    demo-free-es@demo.roastr.ai / demo123`);
      console.log(`  Spanish Starter: demo-starter-es@demo.roastr.ai / demo123`);
      console.log(`  Spanish Pro:     demo-pro-es@demo.roastr.ai / demo123`);
      console.log(`  English Free:    demo-free-en@demo.roastr.ai / demo123`);
      console.log(`  English Starter: demo-starter-en@demo.roastr.ai / demo123`);
      console.log(`  English Pro:     demo-pro-en@demo.roastr.ai / demo123\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Fatal error: ${error.message}${colors.reset}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { seedOrganizations, seedUsers, seedComments, loadFixtures };
