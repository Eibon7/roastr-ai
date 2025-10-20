# Platform Integrations

This document details all social media platform integrations supported by Roastr AI.

## Twitter / X

### Features
- Mention monitoring for real-time engagement
- Toxicity filtering using Perspective API + OpenAI fallback
- AI-powered roast generation with platform-optimized tone
- Duplicate prevention via persistent tracking
- Rate limiting and error handling (Twitter API v2 limits)
- OAuth 1.0a + Bearer Token authentication

### Technical Details
- **API Version:** Twitter API v2
- **Service File:** `src/integrations/twitter/twitterService.js`
- **Rate Limits:** Configured per Twitter Developer tier
- **Character Limit:** 280 characters (automatically enforced)

🔐 **Requires environment variables** (see internal env-setup documentation)

### Usage
```bash
npm run twitter  # Run Twitter bot
```

---

## YouTube

### Features
- Comment fetching from videos and channels
- Community post monitoring
- Toxicity analysis on comments
- Platform-appropriate response generation

### Technical Details
- **API:** YouTube Data API v3
- **Service File:** `src/integrations/youtube/youtubeService.js`
- **Rate Limits:** 10,000 quota units per day (default)

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Instagram

### Features
- Post and story comment monitoring
- DM-based roast responses (where permitted)
- Media-aware context for responses

### Technical Details
- **API:** Instagram Basic Display API + Graph API
- **Service File:** `src/integrations/instagram/instagramService.js`
- **Authentication:** OAuth2 with long-lived tokens

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Facebook

### Features
- Page post and comment monitoring
- Group comment support (with permissions)
- Multi-language support for roasts

### Technical Details
- **API:** Facebook Graph API
- **Service File:** `src/integrations/facebook/facebookService.js`
- **Permissions:** pages_read_engagement, pages_manage_posts

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Discord

### Features
- Server message monitoring
- Channel-specific bot configuration
- Real-time roast responses
- Slash command support

### Technical Details
- **API:** Discord Bot API
- **Service File:** `src/integrations/discord/discordService.js`
- **Gateway:** WebSocket connection for real-time events

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Twitch

### Features
- Chat message monitoring
- Streamer-specific moderation rules
- Real-time engagement during streams

### Technical Details
- **API:** Twitch API v5 + Helix
- **Service File:** `src/integrations/twitch/twitchService.js`
- **IRC:** Chat connection via Twitch IRC

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Reddit

### Features
- Subreddit comment monitoring
- Post reply generation
- Karma-aware engagement

### Technical Details
- **API:** Reddit API (OAuth2)
- **Service File:** `src/integrations/reddit/redditService.js`
- **Rate Limits:** 60 requests per minute

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## TikTok

### Features
- Video comment monitoring
- Short-form optimized roasts
- Hashtag tracking

### Technical Details
- **API:** TikTok Business API
- **Service File:** `src/integrations/tiktok/tiktokService.js`
- **Webhooks:** Real-time comment events

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Bluesky

### Features
- AT Protocol native integration
- Decentralized post monitoring
- Thread-aware responses

### Technical Details
- **API:** Bluesky AT Protocol
- **Service File:** `src/integrations/bluesky/blueskyService.js`
- **Authentication:** App password method

🔐 **Requires environment variables** (see internal env-setup documentation)

---

## Integration Architecture

### Worker System Integration

All platform integrations follow a unified architecture:

```
FetchCommentsWorker
  └─> PlatformService.fetchComments()
       ├─> Twitter: twitterService.js
       ├─> YouTube: youtubeService.js
       ├─> Instagram: instagramService.js
       ├─> Facebook: facebookService.js
       ├─> Discord: discordService.js
       ├─> Twitch: twitchService.js
       ├─> Reddit: redditService.js
       ├─> TikTok: tiktokService.js
       └─> Bluesky: blueskyService.js
```

### Service Interface

Each platform service must implement:

```javascript
class PlatformService {
  async authenticate() { /* OAuth/API key setup */ }
  async fetchComments(context) { /* Retrieve comments */ }
  async postReply(commentId, roastText) { /* Post response */ }
  async deleteReply(replyId) { /* Remove response */ }
  async blockUser(userId) { /* Shield action */ }
}
```

### Integration Status Monitoring

GDD Phase 15 includes automated integration health tracking:

```bash
node scripts/update-integration-status.js  # Check all platform connectivity
node scripts/validate-gdd-cross.js --full   # Cross-validate integration metadata
```

Status tracked per platform:
- ✅ **Connected:** API responding, credentials valid
- ⚠️ **Degraded:** Rate limited or partial failures
- ❌ **Offline:** Authentication failed or unreachable

---

## Adding New Platforms

To add a new platform integration:

1. **Create service file:** `src/integrations/<platform>/<platform>Service.js`
2. **Implement interface:** `authenticate()`, `fetchComments()`, `postReply()`, `blockUser()`
3. **Add worker support:** Update `FetchCommentsWorker.js` with platform routing
4. **Update GDD node:** `docs/nodes/social-platforms.md` (add platform entry)
5. **Add status check:** Update `scripts/update-integration-status.js`
6. **Document here:** Add platform section to this file following established format
7. **Test coverage:** Add integration tests in `tests/integration/<platform>.test.js`

**Naming conventions:**
- Service file: `<platform>Service.js` (camelCase for class name)
- Env vars: `<PLATFORM>_<PROPERTY>` (e.g., `YOUTUBE_API_KEY`)
- Test file: `<platform>.test.js`

---

## Related Documentation

- **GDD Node:** `docs/nodes/social-platforms.md`
- **Worker System:** `docs/nodes/queue-system.md`
- **API Limits:** `docs/nodes/cost-control.md`
- **Environment Setup:** Internal documentation (not public)

---

## Platform Priority

Current deployment priority (based on market research):

1. **Twitter/X** - Primary launch platform (highest engagement potential)
2. **Discord** - Community-driven, high retention
3. **Twitch** - Real-time engagement during streams
4. **Reddit** - Subreddit-specific communities
5. **YouTube** - Comment volume, slower engagement
6. **Instagram** - DM limitations, lower priority
7. **Facebook** - Demographics, declining usage
8. **TikTok** - Emerging, API access complex
9. **Bluesky** - Experimental, growing user base

---

**Last updated:** 2025-10-14
