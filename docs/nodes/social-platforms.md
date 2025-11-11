# Social Platforms - 9 Platform Integrations

**Node ID:** `social-platforms`
**Owner:** Back-end Dev
**Priority:** High
**Status:** Production
**Last Updated:** 2025-11-11
**Coverage:** 0%
**Coverage Source:** auto
**Note:** Integration tests exist but not included in coverage report. Platform-specific implementations in subdirectories (twitter/, youtube/, etc.)
**Related PRs:** #499
**Note:** Integration tests exist but not included in coverage report. Platform-specific implementations in subdirectories (Twitter/, YouTube/, etc.)

## Dependencies

- `multi-tenant` - Organization-scoped integration configs
- `platform-constraints` - Character limits and style guides
- `queue-system` - Comment fetching via workers

## Used By

- `queue-system` - PublisherWorker calls platform services via postResponse

## Overview

Social Platforms provides unified integration layer for 9 social media platforms, enabling automated comment monitoring, roast generation, and posting across Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, and Bluesky.

### Key Capabilities

1. **9 Platform Integrations** - Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky
2. **Unified API** - Common interface via `MultiTenantIntegration` base class
3. **Platform-Specific Constraints** - Character limits, style guides, formatting rules
4. **Comment Monitoring** - Automated fetching via `FetchCommentsWorker`
5. **Direct Posting** - Post roasts back to platforms (varies by platform)
6. **Moderation Support** - Shield actions for supported platforms

## Supported Platforms

| Platform | Auth Type | Character Limit | Moderation | Status |
|----------|-----------|-----------------|------------|--------|
| **Twitter** | OAuth 1.0a + Bearer | 280 | ✅ Full | Production |
| **YouTube** | API Key | 10,000 | ✅ Full | Production |
| **Instagram** | Basic Display API | 2,200 | ❌ Limited | Production |
| **Facebook** | Graph API | 63,206 | ❌ Limited | Production |
| **Discord** | Bot Token | 2,000 | ✅ Full | Production |
| **Twitch** | OAuth 2.0 | 500 | ✅ Full | Production |
| **Reddit** | OAuth 2.0 | 10,000 | ❌ Limited | Production |
| **TikTok** | Business API | 2,200 | ❌ None | Production |
| **Bluesky** | AT Protocol | 300 | ❌ None | Production |

## Architecture

### Base Integration Classes

**Class:** `MultiTenantIntegration`

```javascript
class MultiTenantIntegration {
  constructor(platform, options = {}) {
    this.platform = platform;
    this.rateLimit = options.rateLimit || 100;
    this.supportDirectPosting = options.supportDirectPosting || false;
    this.supportModeration = options.supportModeration || false;
  }

  async authenticate() { throw new Error('Not implemented'); }
  async fetchComments(organizationId, config) { throw new Error('Not implemented'); }
  async postResponse(organizationId, config, commentId, roastText) { throw new Error('Not implemented'); }
  async performModerationAction(organizationId, config, commentId, action) { throw new Error('Not implemented'); }

  log(level, message, metadata = {}) {
    // Unified logging
  }
}
```

**Class:** `BaseIntegration` (Legacy)

Used by YouTube and Twitch (pre-multi-tenant implementations).

### Integration Configs Table

```sql
CREATE TABLE integration_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Integration details
  platform VARCHAR(50) NOT NULL, -- twitter, youtube, discord, etc.
  enabled BOOLEAN DEFAULT TRUE,

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}', -- platform-specific config
  credentials JSONB DEFAULT '{}', -- encrypted credentials

  -- Personalization
  tone VARCHAR(50) DEFAULT 'sarcastic', -- sarcastic, ironic, absurd
  humor_type VARCHAR(50) DEFAULT 'witty', -- witty, clever, playful
  response_frequency DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
  trigger_words TEXT[] DEFAULT ARRAY['roast', 'burn', 'insult'],

  -- Shield settings
  shield_enabled BOOLEAN DEFAULT FALSE,
  shield_config JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, platform),
  CONSTRAINT integration_configs_platform_check CHECK (
    platform IN ('twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok')
  )
);
```

## Twitter Legacy Adapter Pattern

**Context:** CodeRabbit Review #3302108179 - Missing Twitter Service Path

The Twitter integration uses an **adapter pattern** to bridge legacy architecture with the unified integration path convention:

**Legacy Path:** `src/services/twitter.js` (600+ lines)
- Used by: Twitter bot, collectors, OAuth providers
- Maintained for backward compatibility

**Integration Path:** `src/integrations/twitter/twitterService.js` (NEW - adapter)
- Delegates to legacy TwitterRoastBot
- Provides path consistency with other 8 platforms
- Required by PublisherWorker

**Adapter Implementation:**
```javascript
class TwitterService {
  constructor() {
    this.bot = new TwitterRoastBot(); // Delegate to legacy
    this.supportDirectPosting = true;
  }

  async postResponse(tweetId, responseText, userId) {
    try {
      // Adapt PublisherWorker signature → legacy bot signature
      const result = await this.bot.postResponse(tweetId, responseText);

      if (result.success) {
        const responseTweetId = result.data?.id || result.id;
        return {
          success: true,
          responseId: responseTweetId,
          id: responseTweetId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

**Future Migration:**
Once all dependent code migrates to the integration pattern, the legacy bot can be deprecated and the adapter can become the primary implementation.

**Related:**
- Issue #410 (PublisherWorker)
- CodeRabbit Review #3302108179

## Platform Details

### 1. Twitter (X)

**Authentication:** OAuth 1.0a + Bearer Token

**Capabilities:**
- ✅ Fetch mentions via Twitter API v2
- ✅ Post replies with threading support
- ✅ Mute/block users (Shield)
- ✅ Report tweets (Shield)

**Configuration:**

```javascript
{
  platform: 'twitter',
  credentials: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    consumerKey: process.env.TWITTER_APP_KEY,
    consumerSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  },
  config: {
    monitorMentions: true,
    triggerWords: ['roast', 'burn', 'insult'],
    maxResponsesPerHour: 50
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'concise and punchy',
  maxLength: 280,
  preferredLength: 240, // Leave room for RTs
  emojiUsage: 'moderate',
  hashtagLimit: 2,
  supports: {
    hashtags: true,
    mentions: true,
    threading: true
  }
}
```

### 2. YouTube

**Authentication:** API Key (read-only) + OAuth 2.0 (posting)

**Capabilities:**
- ✅ Fetch comments from monitored videos
- ✅ Reply to comments
- ✅ Hide/report comments (Shield)
- ✅ Monitor channel comments

**Configuration:**

```javascript
{
  platform: 'youtube',
  credentials: {
    apiKey: process.env.YOUTUBE_API_KEY
  },
  config: {
    channelId: process.env.YOUTUBE_CHANNEL_ID,
    monitoredVideos: ['VIDEO_ID_1', 'VIDEO_ID_2'],
    triggerWords: ['roast', 'burn', 'insult', 'comeback'],
    maxResponsesPerHour: 5 // YouTube stricter rate limits
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'detailed and engaging',
  maxLength: 10000,
  preferredLength: 800,
  emojiUsage: 'moderate',
  hashtagLimit: 15,
  supports: {
    hashtags: true,
    multiline: true,
    timestamps: true
  }
}
```

### 3. Discord

**Authentication:** Bot Token + Gateway Intents

**Capabilities:**
- ✅ Monitor server messages
- ✅ Direct message responses
- ✅ Slash command support
- ✅ Role-based permissions
- ✅ Kick/ban users (Shield)

**Configuration:**

```javascript
{
  platform: 'discord',
  credentials: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID
  },
  config: {
    guildId: process.env.DISCORD_GUILD_ID,
    monitoredChannels: ['CHANNEL_ID_1', 'CHANNEL_ID_2'],
    triggerWords: ['roast', 'burn', 'insult', 'comeback', 'bot'],
    mentionTrigger: true, // Respond to @mentions
    dmEnabled: true,
    slashCommands: true
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'casual and community-focused',
  maxLength: 2000,
  preferredLength: 300,
  emojiUsage: 'heavy',
  supports: {
    mentions: true,
    customEmojis: true,
    markdown: true,
    codeBlocks: true
  }
}
```

### 4. Instagram

**Authentication:** Basic Display API + Graph API

**Capabilities:**
- ⚠️ Limited comment fetching (media owner only)
- ⚠️ Reply to comments (media owner only)
- ❌ No moderation API

**Configuration:**

```javascript
{
  platform: 'instagram',
  credentials: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    userId: process.env.INSTAGRAM_USER_ID
  },
  config: {
    monitoredMedia: ['MEDIA_ID_1', 'MEDIA_ID_2'],
    triggerWords: ['roast', 'burn', 'insult']
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'visual and engaging',
  maxLength: 2200,
  preferredLength: 150,
  emojiUsage: 'heavy',
  hashtagLimit: 30,
  supports: {
    hashtags: true,
    multiline: true
  }
}
```

### 5. Facebook

**Authentication:** Graph API Access Token

**Capabilities:**
- ⚠️ Limited comment fetching (page owner only)
- ⚠️ Reply to comments (page owner only)
- ❌ No moderation API

**Configuration:**

```javascript
{
  platform: 'facebook',
  credentials: {
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    pageId: process.env.FACEBOOK_PAGE_ID
  },
  config: {
    monitoredPosts: ['POST_ID_1', 'POST_ID_2'],
    triggerWords: ['roast', 'burn', 'insult']
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'conversational and detailed',
  maxLength: 63206,
  preferredLength: 400,
  emojiUsage: 'light',
  hashtagLimit: 5,
  supports: {
    hashtags: true,
    multiline: true,
    links: true
  }
}
```

### 6. Twitch

**Authentication:** OAuth 2.0 + Chat IRC

**Capabilities:**
- ✅ Monitor chat messages
- ✅ Post chat responses
- ✅ Timeout/ban users (Shield)
- ✅ Delete messages (Shield)

**Configuration:**

```javascript
{
  platform: 'twitch',
  credentials: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    channelName: process.env.TWITCH_CHANNEL_NAME
  },
  config: {
    triggerWords: ['roast', 'burn', 'insult', '!roast'],
    maxResponsesPerHour: 20
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'fast-paced and energetic',
  maxLength: 500,
  preferredLength: 200,
  emojiUsage: 'heavy',
  supports: {
    emotes: true,
    mentions: true
  }
}
```

### 7. Reddit

**Authentication:** OAuth 2.0 Application

**Capabilities:**
- ⚠️ Limited comment monitoring (subreddit moderation required)
- ✅ Reply to comments
- ❌ No moderation API (requires mod permissions)

**Configuration:**

```javascript
{
  platform: 'reddit',
  credentials: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD
  },
  config: {
    monitoredSubreddits: ['SUBREDDIT_1', 'SUBREDDIT_2'],
    triggerWords: ['roast', 'burn', 'insult']
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'witty and reference-heavy',
  maxLength: 10000,
  preferredLength: 600,
  emojiUsage: 'light',
  supports: {
    markdown: true,
    quotes: true,
    subredditContext: true
  }
}
```

### 8. TikTok

**Authentication:** Business API Access Token

**Capabilities:**
- ⚠️ Very limited API access (business accounts only)
- ❌ No comment API
- ❌ No moderation API

**Configuration:**

```javascript
{
  platform: 'tiktok',
  credentials: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN
  },
  config: {
    // Limited functionality
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'trendy and energetic',
  maxLength: 2200,
  preferredLength: 200,
  emojiUsage: 'heavy',
  hashtagLimit: 10,
  supports: {
    hashtags: true,
    trending: true
  }
}
```

### 9. Bluesky

**Authentication:** AT Protocol Handle + App Password

**Capabilities:**
- ✅ Monitor mentions
- ✅ Post replies
- ❌ No moderation API yet

**Configuration:**

```javascript
{
  platform: 'bluesky',
  credentials: {
    handle: process.env.BLUESKY_HANDLE,
    appPassword: process.env.BLUESKY_APP_PASSWORD
  },
  config: {
    monitorMentions: true,
    triggerWords: ['roast', 'burn', 'insult']
  }
}
```

**Style Guide:**

```javascript
{
  tone: 'thoughtful and concise',
  maxLength: 300,
  preferredLength: 250,
  emojiUsage: 'light',
  hashtagLimit: 3,
  supports: {
    mentions: true,
    threading: true
  }
}
```

## Unified Integration Flow

### 1. Fetch Comments (via FetchCommentsWorker)

```javascript
// Worker processes fetch_comments jobs
class FetchCommentsWorker extends BaseWorker {
  async processJob(job) {
    const { organization_id, integration_config_id } = job.payload;

    // Get integration config
    const { data: config } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('id', integration_config_id)
      .single();

    // Load platform service
    const service = this.loadPlatformService(config.platform);
    await service.authenticate();

    // Fetch new comments
    const comments = await service.fetchComments(organization_id, config);

    // Store in database
    for (const comment of comments) {
      await supabase.from('comments').insert({
        organization_id,
        integration_config_id,
        platform: config.platform,
        platform_comment_id: comment.id,
        platform_user_id: comment.author.id,
        platform_username: comment.author.username,
        original_text: comment.text,
        metadata: comment.metadata
      });

      // Queue for toxicity analysis
      await queueService.addJob('analyze_toxicity', {
        organization_id,
        comment_id: comment.id
      });
    }
  }

  loadPlatformService(platform) {
    const services = {
      twitter: require('./integrations/twitter/twitterService'),
      youtube: require('./integrations/youtube/youtubeService'),
      discord: require('./integrations/discord/discordService'),
      // ... other platforms
    };
    return new services[platform]();
  }
}
```

### 2. Post Response (after roast generation)

```javascript
async function postRoastToPlatform(commentId, roastText) {
  // Get comment details
  const { data: comment } = await supabase
    .from('comments')
    .select('*, integration_configs(*)')
    .eq('id', commentId)
    .single();

  // Load platform service
  const service = loadPlatformService(comment.platform);
  await service.authenticate();

  // Validate roast for platform
  const { isValid, adjustedText } = validateRoastForPlatform(
    roastText,
    comment.platform
  );

  // Post response
  const platformResponseId = await service.postResponse(
    comment.organization_id,
    comment.integration_configs,
    comment.platform_comment_id,
    isValid ? roastText : adjustedText
  );

  // Update response record
  await supabase.from('responses').update({
    platform_response_id: platformResponseId,
    posted_at: new Date().toISOString(),
    post_status: 'posted'
  }).eq('comment_id', commentId);
}
```

### 3. Shield Moderation Action

```javascript
async function performShieldAction(commentId, action) {
  // Get comment and config
  const { data: comment } = await supabase
    .from('comments')
    .select('*, integration_configs(*)')
    .eq('id', commentId)
    .single();

  // Load platform service
  const service = loadPlatformService(comment.platform);
  await service.authenticate();

  // Check if platform supports moderation
  if (!service.supportModeration) {
    throw new Error(`Platform ${comment.platform} does not support moderation`);
  }

  // Perform action (mute, block, report, remove)
  await service.performModerationAction(
    comment.organization_id,
    comment.integration_configs,
    comment.platform_comment_id,
    action
  );

  // Log shield action
  await supabase.from('shield_actions').insert({
    organization_id: comment.organization_id,
    comment_id: commentId,
    action,
    platform: comment.platform,
    executed_at: new Date().toISOString()
  });
}
```

## Platform Constraints Validation

### Character Limit Validation

```javascript
const { validateRoastForPlatform } = require('./config/platforms');

// Before posting roast
const validation = validateRoastForPlatform(roastText, 'twitter');

if (!validation.isValid) {
  console.warn('Roast exceeds Twitter limit, truncating:', {
    original: validation.originalLength,
    limit: validation.limit,
    adjusted: validation.adjustedText.length
  });
  roastText = validation.adjustedText;
}
```

### Style Guide Application

```javascript
const { getPlatformStyle } = require('./config/platforms');

// Get platform-specific style
const style = getPlatformStyle('instagram');
// {
//   tone: 'visual and engaging',
//   preferredLength: 150,
//   emojiUsage: 'heavy',
//   hashtagLimit: 30
// }

// Apply style in prompt template
const prompt = `Generate roast with ${style.tone} tone, ${style.emojiUsage} emoji usage...`;
```

## Testing

### Unit Tests

```javascript
describe('Platform Integrations', () => {
  test('validates roast length for each platform', () => {
    const roast = 'A'.repeat(500);

    const twitter = validateRoastForPlatform(roast, 'twitter');
    expect(twitter.isValid).toBe(false);
    expect(twitter.adjustedText.length).toBeLessThanOrEqual(280);

    const discord = validateRoastForPlatform(roast, 'discord');
    expect(discord.isValid).toBe(true);
  });

  test('loads correct platform service', () => {
    const twitterService = loadPlatformService('twitter');
    expect(twitterService.platform).toBe('twitter');
    expect(twitterService.supportModeration).toBe(true);

    const tiktokService = loadPlatformService('tiktok');
    expect(tiktokService.supportModeration).toBe(false);
  });
});
```

### Integration Tests

```javascript
describe('Multi-Platform Workflow', () => {
  test('fetches comments from YouTube and posts roast', async () => {
    // 1. Configure YouTube integration
    const config = await createIntegrationConfig(orgId, 'youtube', {
      apiKey: 'test_key',
      channelId: 'test_channel'
    });

    // 2. Simulate comment fetch
    await fetchCommentsWorker.processJob({
      payload: { organization_id: orgId, integration_config_id: config.id }
    });

    // 3. Check comment was stored
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('organization_id', orgId)
      .eq('platform', 'youtube');

    expect(comments).toHaveLength(1);

    // 4. Generate roast (queue job)
    await generateReplyWorker.processJob({
      payload: { comment_id: comments[0].id }
    });

    // 5. Check roast was generated
    const { data: response } = await supabase
      .from('responses')
      .select('*')
      .eq('comment_id', comments[0].id)
      .single();

    expect(response.response_text).toBeDefined();
    expect(response.post_status).toBe('posted');
  });
});
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Authentication failed` | Invalid credentials | Update integration config credentials |
| `Rate limit exceeded` | Too many API calls | Reduce `maxResponsesPerHour` |
| `Platform API unavailable` | Service outage | Retry with exponential backoff |
| `Comment not found` | Deleted or private comment | Skip, mark as error |
| `Posting disabled` | Platform doesn't support posting | Log warning, skip posting |
| `Moderation not supported` | Platform lacks moderation API | Disable Shield for this platform |

## Monitoring & Alerts

### Key Metrics

- **Comments fetched per platform** - Track activity by platform
- **Roasts posted per platform** - Posting success rate
- **API errors per platform** - Platform-specific health
- **Shield actions per platform** - Moderation activity
- **Rate limit violations** - API quota management

### Grafana Dashboard

```javascript
{
  twitter_comments_fetched: { type: 'counter', value: 1542 },
  youtube_comments_fetched: { type: 'counter', value: 893 },
  discord_comments_fetched: { type: 'counter', value: 2341 },
  twitter_roasts_posted: { type: 'counter', value: 1203 },
  shield_actions_twitter: { type: 'counter', value: 45 },
  platform_api_errors: { type: 'counter', value: 12 }
}
```


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **API Specialist**
- **Backend Developer**
- **Documentation Agent**
- **Integration Specialist**
- **Test Engineer**


## Related Nodes

- **multi-tenant** - Organization-scoped integration configs
- **platform-constraints** - Character limits and style guides
- **queue-system** - Comment fetching via workers
- **shield** - Moderation actions per platform
- **roast** - Roast generation with platform constraints

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on platform API changes
**Last Reviewed:** 2025-10-04
**Version:** 1.1.0 (PublisherWorker integration - Issue #410)
