# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive multi-tenant toxicity detection and roast generation system for social media platforms. The project features a scalable architecture built with Node.js, supporting multiple organizations with dedicated workers, cost control, and automated moderation through the Shield system.

### Multi-Tenant Architecture

The system is designed as a multi-tenant SaaS platform with:

- **Row Level Security (RLS)** for complete data isolation between organizations
- **Usage-based billing** with plan limits and cost tracking
- **Dedicated worker system** for scalable background processing  
- **Unified queue management** supporting Redis/Upstash and database fallback
- **Shield automated moderation** with priority-based action system
- **9 platform integrations** (Twitter, YouTube, Instagram, Facebook, etc.)
- **Master Prompt Template System** (v1-roast-prompt) for consistent, high-quality roast generation

## Business Model

The platform operates on a subscription-based model with multiple tiers:

- **Free Plan**: Basic roast generation with limited features and platform access
- **Starter Plan**: €5/month - Enhanced features with increased limits and additional platforms
- **Pro Plan**: €15/month - Advanced features, custom styles, multiple platforms, analytics
- **Plus Plan**: €50/month - Premium tier with maximum capabilities, priority support, custom integrations

*Note: Enterprise plans are not currently available but may be considered for future releases.*

## Development Commands

```bash
# Start the application
npm start

# Start in development mode with auto-reload
npm run dev

# Start API server
npm run start:api

# Use CLI tool
npm run roast "your message here"

# Run Twitter bot
npm run twitter

# Install dependencies
npm install

# Setup admin and test users for backoffice development (Issue #237)
npm run setup:test-users:dry      # Preview what will be created
npm run setup:test-users          # Execute the setup

# Multi-tenant worker system
npm run workers:start           # Start all workers
npm run workers:status          # Check worker status
npm run workers:status:watch    # Monitor workers in real-time

# Queue management
npm run queue:status            # Check queue status
npm run queue:manage            # Interactive queue management
npm run queue:monitor           # Real-time queue monitoring
npm run queue:clear-all         # Clear all queues
npm run queue:retry             # Retry failed jobs

# Testing
npm test                        # Run all tests
npm run test:coverage           # Run tests with coverage
```

## Multi-Tenant Project Structure

```
src/
├── index.js                          # Main API server
├── cli.js                            # CLI tool for testing
├── server.js                         # Alternative server entry point
├── config/
│   └── index.js                      # Configuration management
├── services/
│   ├── costControl.js                # Usage tracking & billing
│   ├── queueService.js               # Unified Redis/DB queue system
│   ├── shieldService.js              # Automated moderation
│   ├── roastPromptTemplate.js        # Master prompt template system (v1)
│   ├── roastGeneratorEnhanced.js     # Enhanced roast generation with RQC
│   ├── csvRoastService.js            # CSV-based reference roast system
│   ├── openai.js                     # OpenAI integration
│   ├── perspective.js                # Perspective API
│   └── twitter.js                    # Legacy Twitter bot
├── workers/
│   ├── BaseWorker.js                 # Base worker class
│   ├── FetchCommentsWorker.js        # Comment fetching
│   ├── AnalyzeToxicityWorker.js      # Toxicity analysis
│   ├── GenerateReplyWorker.js        # Roast generation
│   ├── ShieldActionWorker.js         # Moderation actions
│   └── cli/
│       ├── start-workers.js          # Worker management
│       ├── worker-status.js          # Status monitoring  
│       └── queue-manager.js          # Queue management
├── integrations/
│   ├── twitter/twitterService.js     # Twitter API v2
│   ├── youtube/youtubeService.js     # YouTube Data API
│   ├── instagram/instagramService.js # Instagram Basic API
│   ├── facebook/facebookService.js   # Facebook Graph API
│   ├── discord/discordService.js     # Discord Bot API
│   ├── twitch/twitchService.js       # Twitch API
│   ├── reddit/redditService.js       # Reddit API
│   ├── tiktok/tiktokService.js       # TikTok Business API
│   └── bluesky/blueskyService.js     # Bluesky AT Protocol
└── utils/
    └── logger.js                     # Logging utility

database/
└── schema.sql                        # Multi-tenant PostgreSQL schema

tests/
├── unit/
│   ├── services/                     # Service unit tests
│   └── workers/                      # Worker unit tests
├── integration/
│   └── multiTenantWorkflow.test.js   # E2E workflow tests
└── helpers/
    └── testUtils.js                  # Test utilities
```

## Environment Variables

Set these environment variables for API integrations:

**Core Database & Queue:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key (for server operations)
- `SUPABASE_ANON_KEY` - Supabase anonymous key (for client operations)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL for serverless queues
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token
- `REDIS_URL` - Standard Redis URL (fallback)

**AI & Moderation APIs:**
- `OPENAI_API_KEY` - OpenAI API key for roast generation and content moderation
- `PERSPECTIVE_API_KEY` - Google Perspective API key for toxicity detection
- `NODE_ENV` - Set to 'production' to disable debug logging
- `DEBUG` - Set to 'true' to enable detailed logging

**Platform Integrations:**
- `TWITTER_BEARER_TOKEN` - Twitter Bearer Token for reading
- `TWITTER_APP_KEY` - Twitter Consumer Key
- `TWITTER_APP_SECRET` - Twitter Consumer Secret  
- `TWITTER_ACCESS_TOKEN` - Twitter Access Token for posting
- `TWITTER_ACCESS_SECRET` - Twitter Access Token Secret
- `YOUTUBE_API_KEY` - YouTube Data API v3 key
- `INSTAGRAM_ACCESS_TOKEN` - Instagram Basic Display API token
- `FACEBOOK_ACCESS_TOKEN` - Facebook Graph API token
- `DISCORD_BOT_TOKEN` - Discord bot token
- `TWITCH_CLIENT_ID` - Twitch API client ID
- `TWITCH_CLIENT_SECRET` - Twitch API client secret
- `REDDIT_CLIENT_ID` - Reddit API client ID
- `REDDIT_CLIENT_SECRET` - Reddit API client secret

**Optional Configuration:**
- `ROASTR_API_KEY` - Custom API key for /roast endpoint authentication
- `ROAST_API_URL` - URL of roast API (optional, defaults to production)
- `SHIELD_ENABLED` - Enable Shield automated moderation (default: true for Pro+ plans)

### Setting up OpenAI API for real roast generation:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env` file in the project root:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Run the CLI with real AI: `npm run roast "tu comentario aquí"`

If the OpenAI API fails, the CLI automatically falls back to the mock generator.

### Setting up Twitter Integration:

1. Create a Twitter Developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create a new project and application
3. Configure app permissions to "Read and Write" 
4. Generate OAuth 1.0a tokens (for posting) and Bearer Token (for reading)
5. Add all credentials to `.env` file
6. Run `npm run twitter` to start the bot

## Multi-Tenant Architecture

The system is built on a comprehensive multi-tenant architecture designed for scale:

### Core Components

- **API Layer**: Express server with multi-tenant authentication and organization-scoped endpoints
- **Database Layer**: PostgreSQL with Row Level Security (RLS) for complete tenant isolation
- **Queue System**: Unified Redis/Upstash + Database queue management with priority support
- **Worker System**: Dedicated background workers for scalable comment processing
- **Cost Control**: Usage tracking, billing integration, and automatic limit enforcement
- **Shield System**: Automated content moderation with escalating actions

### Worker Architecture

1. **FetchCommentsWorker**: Fetches comments from 9 social media platforms
2. **AnalyzeToxicityWorker**: Analyzes content toxicity using Perspective API + OpenAI fallback
3. **GenerateReplyWorker**: Generates AI roast responses with cost control
4. **ShieldActionWorker**: Executes automated moderation actions (mute, block, report)

### Data Flow

```
Comment Detection → Queue (fetch_comments)
    ↓
Comment Fetching → Store in Database → Queue (analyze_toxicity)
    ↓
Toxicity Analysis → Update Database → Queue (generate_reply) + Shield Analysis
    ↓
Response Generation → Store Roast → Queue (post_response)
    ↓
Shield Actions (if needed) → Queue (shield_action) [Priority 1]
    ↓
Platform Actions → Moderation Complete
```

### Scaling Features

- **Horizontal scaling** via multiple worker instances
- **Priority-based job processing** (Shield actions get priority 1)
- **Automatic failover** from Redis to Database queues
- **Cost-based throttling** to prevent overages
- **Real-time monitoring** and alerting

## Master Prompt Template System (v1-roast-prompt)

The roast generation system has been enhanced with a comprehensive master prompt template that ensures consistency, quality, and personalization across all roast generations.

### Key Features

- **Dynamic Field Replacement**: Supports placeholders for original comment, category, references, and user tone
- **Comment Categorization**: Automatically categorizes comments (insults, body shaming, political, etc.)
- **Reference Integration**: Includes similar roasts from CSV database as examples
- **User Tone Mapping**: Personalizes responses based on user preferences and plan features
- **Version Control**: Template versioning for future improvements and A/B testing
- **🔒 Security Protection**: Robust input sanitization and prompt injection prevention

### Security Features (Issue #127)

- **Prompt Injection Protection**: Automatically sanitizes malicious template placeholders (`{{placeholder}}` patterns)
- **Input Validation**: Strict validation for `originalComment` (type, length, content)
- **Error Traceability**: Comprehensive logging with error context and version tracking
- **Length Limits**: 2000 character limit to prevent DoS attacks
- **Fallback System**: Graceful degradation when validation fails or errors occur

### GDPR Rate Limiting (Issue #115)

The system implements strict rate limiting for GDPR-sensitive endpoints to prevent DoS and brute force attacks:

- **Account Deletion**: 3 attempts per hour per IP/user (`DELETE /api/user/account`)
- **Data Export**: 5 attempts per hour per IP/user (`GET /api/user/data-export`)  
- **Data Download**: 10 attempts per hour per IP/token (`GET /api/user/data-export/download/:token`)
- **Deletion Cancellation**: 5 attempts per hour per IP/user (`POST /api/user/account/deletion/cancel`)
- **Global GDPR Limit**: 20 total GDPR requests per hour per IP across all endpoints

Rate limiters are automatically disabled in test environment and can be configured via feature flags.

### Template Structure

```
Tu tarea es generar una respuesta sarcástica e ingeniosa...

💬 COMENTARIO ORIGINAL: {{original_comment}}
🎭 CATEGORÍA DEL COMENTARIO: {{comment_category}}
📚 EJEMPLOS DE ROASTS: {{reference_roasts_from_CSV}}
👤 TONO PERSONAL: {{user_tone}}
```

### Integration Points

- **RoastGeneratorEnhanced**: Used in both basic moderation and advanced RQC modes
- **GenerateReplyWorker**: Integrated into the worker pipeline for queue processing
- **Platform Constraints**: Automatically adds platform-specific character limits and style guides
- **Plan Differentiation**: Free plans exclude references, Pro+ plans include full examples
- **Security Layer**: All inputs sanitized before template processing

### Usage Example

```javascript
const promptTemplate = new RoastPromptTemplate();
const prompt = await promptTemplate.buildPrompt({
  originalComment: "Esta aplicación es horrible",
  toxicityData: { score: 0.5, categories: ['TOXICITY'] },
  userConfig: { tone: 'sarcastic', humor_type: 'witty', intensity_level: 3 },
  includeReferences: true
});
```

## Twitter Bot Features

- **Mention Monitoring**: Automatically detects mentions to your Twitter account
- **Toxicity Filtering**: Uses stub (always true) with skeleton for Perspective API
- **Roast Generation**: Calls your deployed API to generate responses
- **Duplicate Prevention**: Tracks processed tweets in `data/processed_tweets.json`
- **Rate Limiting**: Adds delays between responses to respect API limits
- **Error Handling**: Graceful failure handling and detailed logging