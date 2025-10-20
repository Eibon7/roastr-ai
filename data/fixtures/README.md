# Demo Mode Fixtures

Comprehensive demo fixtures for testing Shield triage and roast generation without external API calls.

## Overview

This directory contains structured test data for demo mode:

- **35 comment fixtures** (18 Spanish + 17 English)
- **JSON Schema validation** for consistency
- **Idempotent seed scripts** for database population
- **Multi-language support** (es, en)
- **Complete triage coverage** across 4 severity levels

## Structure

```text
data/fixtures/
├── README.md                    # This file
├── comments/
│   ├── schema.json              # JSON Schema Draft-07 validation
│   ├── comments-es.json         # 18 Spanish comment fixtures
│   └── comments-en.json         # 17 English comment fixtures
├── users/                       # (Reserved for future user fixtures)
└── organizations/               # (Reserved for future org fixtures)
```

## Comment Fixtures

### Coverage Matrix

All fixtures cover **5 topics × 4 severity levels**:

| Topic | Low (0.60-0.75) | Moderate (0.75-0.85) | High (0.85-0.95) | Extreme (0.95-1.0) |
|-------|----------------|---------------------|------------------|-------------------|
| **Politics** | 2 roast | 1 mute | 1 block | - |
| **Sports** | 2 roast | 1 mute | 1 block | - |
| **Technology** | 2 roast | 1 mute | - | - |
| **Social** | 1 roast | 1 mute | 1 block | 1 report |
| **Entertainment** | 2 roast | 1 mute | - | - |

### Severity Mapping

Fixtures align with Shield triage system:

- **LOW** (0.60-0.75): `expected_action: "roast"` - Roasteable content
- **MODERATE** (0.75-0.85): `expected_action: "mute"` - Mute-worthy content
- **HIGH** (0.85-0.95): `expected_action: "block"` - Block-worthy content
- **EXTREME** (0.95-1.0): `expected_action: "report"` - Report-worthy (threats, violence)

### Fixture Schema

Each comment fixture includes:

```json
{
  "id": "fixture-001",
  "language": "es",
  "topic": "politics",
  "comment_text": "Los políticos son todos unos corruptos...",
  "toxicity_score": 0.68,
  "expected_action": "roast",
  "severity": "low",
  "platform": "twitter",
  "metadata": {
    "has_profanity": false,
    "sentiment": "negative",
    "context": "general-political-complaint",
    "intensity": "moderate"
  }
}
```

**Required fields:**
- `id` - Unique identifier (format: `fixture-XXX`)
- `language` - `es` or `en`
- `topic` - One of: politics, sports, technology, social, entertainment
- `comment_text` - Actual comment content (10-500 characters)
- `toxicity_score` - 0.60 to 1.0 (aligned with Shield thresholds)
- `expected_action` - `roast`, `mute`, `block`, or `report`
- `severity` - `low`, `moderate`, `high`, or `extreme`
- `platform` - Social media platform (Twitter, YouTube, Facebook, etc.)

**Optional metadata:**
- `has_profanity` - Boolean
- `sentiment` - negative, neutral, positive
- `context` - Subcategory (e.g., "team-criticism", "political-complaint")
- `intensity` - mild, moderate, strong, extreme

## npm Scripts

### Validation

```bash
# Validate all fixtures against JSON schema
npm run demo:validate

# Verbose mode (show detailed errors)
npm run demo:validate:verbose
```

### Seeding Database

```bash
# Seed demo data into database
npm run demo:seed

# Preview what would be seeded (no changes)
npm run demo:seed:dry

# Force reseed (delete existing demo data first)
npm run demo:seed:force
```

**What gets seeded:**
- 2 demo organizations (Spanish, English)
- 6 demo users (3 per language: Free, Starter, Pro)
- 35 demo comments from fixtures

**Demo login credentials** (password: `demo123`):
- Spanish Free: `demo-free-es@demo.roastr.ai`
- Spanish Starter: `demo-starter-es@demo.roastr.ai`
- Spanish Pro: `demo-pro-es@demo.roastr.ai`
- English Free: `demo-free-en@demo.roastr.ai`
- English Starter: `demo-starter-en@demo.roastr.ai`
- English Pro: `demo-pro-en@demo.roastr.ai`

### Cleanup

```bash
# Delete all demo data
npm run demo:reset

# Preview what would be deleted (no changes)
npm run demo:reset:dry
```

**What gets deleted:**
- All organizations with name starting with "Demo:"
- All users with email ending in "@demo.roastr.ai"
- All comments and responses associated with demo orgs/users

## Scripts Reference

### `scripts/validate-fixtures.js`

Validates fixture files against JSON Schema Draft-07.

**Features:**
- Schema compliance validation
- Duplicate ID detection
- JSON syntax validation
- Colored terminal output

**Exit codes:**
- `0` - All fixtures valid
- `1` - Validation errors found

### `scripts/seed-demo-data.js`

Seeds demo data into database (idempotent).

**Features:**
- Idempotent (safe to run multiple times)
- Skips existing records
- Transactional operations
- Dry-run mode
- Force mode (delete + reseed)

**Options:**
- `--dry-run` - Preview without changes
- `--verbose` - Detailed logging
- `--force` - Delete existing demo data before seeding

**Exit codes:**
- `0` - Success
- `1` - Error occurred

### `scripts/clear-demo-data.js`

Clears all demo data from database.

**Features:**
- Cascade deletion (respects foreign keys)
- Dry-run mode
- Verbose logging
- Safe (only deletes demo-identified records)

**Deletion order:**
1. Responses (children)
2. Comments (children)
3. Users (children)
4. Organizations (parents)

**Options:**
- `--dry-run` - Preview what would be deleted
- `--verbose` - Show detailed deletion process

**Exit codes:**
- `0` - Success
- `1` - Error occurred

## Usage Examples

### Local Development

```bash
# 1. Validate fixtures are correct
npm run demo:validate

# 2. Preview what would be seeded
npm run demo:seed:dry

# 3. Seed demo data
npm run demo:seed

# 4. Test demo mode with users
# Log in as demo-pro-es@demo.roastr.ai / demo123

# 5. Clean up when done
npm run demo:reset
```

### CI/CD Integration

```yaml
# In CI pipeline (e.g., GitHub Actions)
- name: Validate Demo Fixtures
  run: npm run demo:validate

- name: Seed Demo Data
  run: npm run demo:seed:force  # Force mode for clean state
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

- name: Run Integration Tests
  run: npm run test:integration

- name: Cleanup Demo Data
  run: npm run demo:reset
  if: always()  # Always cleanup
```

### Testing Different Scenarios

```bash
# Test roast generation for low severity
# Use fixtures: fixture-001 to fixture-002 (politics, sports)

# Test mute action for moderate severity
# Use fixtures: fixture-003, fixture-007, fixture-011

# Test block action for high severity
# Use fixtures: fixture-004, fixture-008, fixture-014

# Test report action for extreme severity (threats)
# Use fixtures: fixture-015, fixture-115
```

## Adding New Fixtures

### Step 1: Add to fixture file

Edit `comments-es.json` or `comments-en.json`:

```json
{
  "id": "fixture-019",
  "language": "es",
  "topic": "sports",
  "comment_text": "Your new comment text here",
  "toxicity_score": 0.75,
  "expected_action": "mute",
  "severity": "moderate",
  "platform": "twitter",
  "metadata": {
    "has_profanity": false,
    "sentiment": "negative",
    "context": "new-context",
    "intensity": "moderate"
  }
}
```

### Step 2: Validate

```bash
npm run demo:validate:verbose
```

Fix any validation errors reported.

### Step 3: Test seeding

```bash
# Preview
npm run demo:seed:dry

# Seed (will skip existing, add new)
npm run demo:seed
```

### Step 4: Update documentation

Update this README if adding new topics, severities, or patterns.

## Fixture Design Principles

1. **Realism**: Comments should feel authentic, not synthetic
2. **Language-appropriate**: Natural expressions, idioms, profanity patterns
3. **Platform-specific**: Include context clues (e.g., Twitter @mentions)
4. **Coverage**: Systematic coverage of all triage scenarios
5. **Severity alignment**: Toxicity scores match Shield thresholds exactly
6. **Metadata richness**: Include context, sentiment, intensity for analysis

## Troubleshooting

### Validation fails with "JSON parse error"

**Cause**: Invalid JSON syntax in fixture file

**Fix**:
```bash
# Use a JSON linter
npx prettier --check data/fixtures/comments/*.json

# Auto-fix formatting
npx prettier --write data/fixtures/comments/*.json
```

### Seed fails with "organization not found"

**Cause**: Demo organizations don't exist yet

**Fix**:
```bash
# Check if demo data exists
npm run demo:reset:dry

# If none exists, seed should work
npm run demo:seed

# If organizations exist but incomplete, force reseed
npm run demo:seed:force
```

### Duplicate ID errors

**Cause**: Two fixtures have the same `id` field

**Fix**: Run validation with verbose to identify duplicates:
```bash
npm run demo:validate:verbose
```

Ensure all Spanish fixtures use `fixture-001` to `fixture-018` and English use `fixture-101` to `fixture-117`.

### Seeding is slow

**Cause**: Script checks for existing records individually

**Solution**: This is intentional for idempotency. Use `--force` to delete all demo data first for faster bulk insert.

## Future Enhancements

### Planned Features

- [ ] User fixtures (different personas, plan tiers)
- [ ] Organization fixtures (different settings, integrations)
- [ ] Response fixtures (sample roasts for fixtures)
- [ ] Multi-platform fixtures (cross-platform scenarios)
- [ ] Temporal fixtures (time-based scenarios)

### Fixture Expansion

- Add more languages (Portuguese, French)
- Expand topics (news, gaming, lifestyle)
- Add edge cases (emoji-only, very long text, mixed languages)
- Platform-specific patterns (TikTok hashtags, Reddit formatting)

## Related Documentation

- [Shield Triage System](../../docs/nodes/shield.md)
- [Roast Generation](../../docs/nodes/roast.md)
- [Multi-tenant Architecture](../../CLAUDE.md#multi-tenant-architecture)
- [Testing Strategy](../../docs/TESTING-STRATEGY.md)

## Support

For questions or issues with demo fixtures:

1. Check this README first
2. Review `docs/plan/issue-420.md` for implementation details
3. Run validation with `--verbose` for detailed errors
4. Check `docs/test-evidence/issue-420/` for examples

## License

Demo fixtures are for testing purposes only and contain synthetic data. Do not use in production or expose to end users.
