# Stylecards System - Issue #293

## Overview

The Stylecards system automatically generates personalized style profiles for Pro and Creator Plus users by analyzing their recent social media content. This reduces onboarding friction and improves response quality from day one.

## Architecture

### Core Components

1. **StylecardService** - Main orchestrator for stylecard generation
2. **Content Collectors** - Platform-specific content gathering
3. **Style Analysis** - AI-powered style characteristic detection
4. **Embedding Generation** - Vector representations for style matching
5. **Database Schema** - Secure storage with privacy controls

### Database Schema

#### `stylecards` Table

- Stores generated style profiles with characteristics
- Includes tone, formality, sarcasm levels
- Contains AI-generated style prompts
- Tracks source platforms and content analyzed

#### `stylecard_content_samples` Table

- Stores encrypted content samples used for analysis
- Includes embeddings for similarity matching
- Implements automatic retention policies
- Requires explicit user consent

#### `stylecard_generation_jobs` Table

- Tracks generation job status and progress
- Handles error recovery and retry logic
- Monitors cost and API usage

## Content Collection

### Supported Platforms

1. **Twitter/X** - Tweets and replies via Twitter API v2
2. **Instagram** - Posts and captions via Instagram Basic Display API
3. **YouTube** - Video titles and descriptions via YouTube Data API
4. **TikTok** - Video captions via TikTok API (limited availability)
5. **Twitch** - Stream titles and descriptions via Twitch API

### Collection Process

1. **Authentication Check** - Verify platform credentials
2. **Rate Limiting** - Respect platform API limits
3. **Content Filtering** - Remove sensitive/inappropriate content
4. **Language Detection** - Filter by user's preferred language
5. **Quality Control** - Ensure minimum content length and quality

### Content Filtering

- Excludes retweets, shares, and reposts
- Filters out content with only URLs/mentions
- Removes sensitive information (emails, phone numbers, etc.)
- Skips very short content (< 10 characters)
- Limits content length for embedding generation

## Style Analysis

### Characteristics Detected

1. **Tone** - ligero, equilibrado, contundente, humorous, sarcastic
2. **Formality Level** - Scale 1-10 (informal to formal)
3. **Sarcasm Level** - Scale 1-10 (literal to highly sarcastic)

### Analysis Methods

- **Keyword Analysis** - Pattern matching for tone indicators
- **Linguistic Features** - Punctuation, length, structure analysis
- **Emoji Usage** - Emotional expression patterns
- **Engagement Patterns** - High-performing content characteristics

### Representative Examples

- Selects 3-5 best examples of user's style
- Prioritizes high-engagement content
- Ensures diversity in content types
- Filters appropriate length (20-200 characters)

## Privacy & Security

### Data Protection

- **Encryption** - All content samples encrypted at rest
- **Retention Policies** - Automatic deletion after 90 days
- **User Consent** - Explicit opt-in required
- **Opt-out Rights** - Users can delete stylecards anytime

### Compliance

- **GDPR Compliant** - Right to deletion and data portability
- **Minimal Data** - Only stores necessary content for analysis
- **Audit Logs** - Track all access and modifications
- **Secure Storage** - Vector embeddings instead of raw text when possible

## API Endpoints

### Generate Stylecard

```
POST /api/stylecards/generate
```

Triggers stylecard generation for connected platforms.

**Request:**

```json
{
  "platforms": ["twitter", "instagram"],
  "language": "es",
  "forceRegenerate": false,
  "maxContentPerPlatform": 50
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid",
  "message": "Stylecard generation started",
  "estimatedCompletionMinutes": 4
}
```

### Check Generation Status

```
GET /api/stylecards/status/:jobId
```

Returns current status of generation job.

### Get Current Stylecard

```
GET /api/stylecards/current?language=es
```

Returns user's active stylecard.

### Delete Stylecard (Opt-out)

```
DELETE /api/stylecards/current?language=es
```

Deletes user's stylecard and all associated data.

## Automatic Activation

### Trigger Conditions

1. User upgrades to Pro or Creator Plus plan
2. User has connected at least one supported platform
3. Platform contains sufficient content (minimum 3 posts)

### Webhook Integration

The system integrates with Stripe webhooks to automatically trigger stylecard generation when:

- `checkout.session.completed` event for Pro/Plus plans
- User has active platform integrations

### Fallback Handling

- **Insufficient Content** - Generates neutral stylecard
- **API Failures** - Graceful degradation to manual input
- **Rate Limits** - Automatic retry with exponential backoff

## Cost Management

### Optimization Strategies

1. **Content Limits** - Maximum 50 posts per platform
2. **Embedding Caching** - Reuse embeddings when possible
3. **Batch Processing** - Group API calls efficiently
4. **Model Selection** - Use cost-effective embedding models

### Budget Controls

- **Per-User Limits** - Configurable token limits
- **Cost Tracking** - Monitor API usage and costs
- **Alert System** - Notify when approaching limits

## Error Handling

### Common Scenarios

1. **Platform API Unavailable** - Fallback to manual input
2. **Insufficient Content** - Generate neutral stylecard
3. **Rate Limit Exceeded** - Retry with exponential backoff
4. **Authentication Failure** - Notify user to reconnect

### Recovery Mechanisms

- **Automatic Retries** - Up to 3 attempts with delays
- **Partial Success** - Use available platforms if others fail
- **Graceful Degradation** - Continue with reduced functionality

## Testing

### Unit Tests

- StylecardService core functionality
- Content collector platform integrations
- Style analysis algorithms
- Privacy and security controls

### Integration Tests

- End-to-end generation workflow
- Platform API integrations (mocked in CI)
- Database operations and constraints
- Webhook integration with Stripe

### Manual Testing

1. Connect test accounts with recent content
2. Verify content collection (up to 50 posts)
3. Check stylecard accuracy against expected tone
4. Test autopost integration with generated style
5. Verify opt-out and data deletion

## Monitoring & Metrics

### Key Metrics

1. **Generation Success Rate** - Percentage of successful generations
2. **Content Quality Score** - Average content samples per user
3. **Style Accuracy** - User satisfaction with generated style
4. **API Cost per User** - Average cost of stylecard generation
5. **Processing Time** - Average time to complete generation

### Alerts

- Generation failure rate > 10%
- API costs exceeding budget
- Platform API rate limits hit
- User complaints about style accuracy

## Deployment Checklist

### Prerequisites

- [ ] Database migration applied
- [ ] Platform API credentials configured
- [ ] Encryption keys set up
- [ ] Rate limiting configured
- [ ] Cost monitoring enabled

### Validation

- [ ] All unit tests passing
- [ ] Integration tests with mocked APIs
- [ ] Manual testing with real accounts
- [ ] Legal review of privacy policies
- [ ] Cost analysis within budget

### Rollout Strategy

1. **Alpha** - Internal testing with team accounts
2. **Beta** - Limited rollout to select Pro users
3. **Production** - Full rollout to all Pro/Plus users

## Future Enhancements

### Planned Features

1. **Multi-language Support** - Stylecards for different languages
2. **Style Evolution** - Update stylecards based on new content
3. **Advanced Analytics** - Detailed style insights for users
4. **Custom Styles** - User-defined style modifications
5. **Team Stylecards** - Shared styles for organization accounts

### Platform Expansion

- LinkedIn professional content
- Reddit comment analysis
- Discord message patterns
- Custom platform integrations
