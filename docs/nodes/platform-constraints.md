# Platform Constraints

**Node ID:** `platform-constraints`  
**Owner:** Back-end Dev  
**Priority:** High  
**Status:** Production  
**Last Updated:** 2025-11-16  
**Coverage:** 100% (Issue #718)
**Coverage Source:** auto

## Dependencies

- `social-platforms` - Platform integrations that use these constraints

## Overview

Platform Constraints defines character limits, style guides, rate limits, and API-specific constraints for all 9 social media platform integrations. This ensures roasts and responses are properly formatted and respect platform-specific limitations.

## Character Limits

| Platform | Max Characters | Preferred Length | Notes |
|----------|---------------|------------------|-------|
| **Twitter** | 280 | 240 | Leave room for RTs and threading |
| **YouTube** | 10,000 | 800 | Supports detailed responses |
| **Instagram** | 2,200 | 150 | Visual-first platform |
| **Facebook** | 63,206 | 400 | Very permissive limit |
| **Discord** | 2,000 | 300 | Community-focused |
| **Twitch** | 500 | 200 | Fast-paced chat |
| **Reddit** | 10,000 | 600 | Supports markdown |
| **TikTok** | 2,200 | 200 | Trend-focused |
| **Bluesky** | 300 | 250 | Similar to Twitter |

## Rate Limits

| Platform | Rate Limit | Window | Notes |
|----------|------------|--------|-------|
| **Twitter** | Varies by tier | Per hour | Free tier: 1,500 tweets/month |
| **YouTube** | 10,000 quota units | Per day | Different operations cost different units |
| **Instagram** | 200 requests | Per hour | Graph API limits |
| **Facebook** | 200 requests | Per hour | Graph API limits |
| **Discord** | 50 requests | Per second | Burst limit |
| **Twitch** | 800 requests | Per minute | Helix API limits |
| **Reddit** | 60 requests | Per minute | OAuth app limits |
| **TikTok** | 1,000 requests | Per hour | Business API limits |
| **Bluesky** | 300 requests | Per 5 minutes | AT Protocol limits |

## Style Guides

### Twitter
- Tone: Concise and punchy
- Emoji usage: Moderate
- Hashtag limit: 2
- Supports: Hashtags, mentions, threading

### YouTube
- Tone: Detailed and engaging
- Emoji usage: Moderate
- Hashtag limit: 15
- Supports: Hashtags, multiline, timestamps

### Discord
- Tone: Casual and community-focused
- Emoji usage: Heavy
- Supports: Mentions, custom emojis, markdown, code blocks

### Twitch
- Tone: Fast-paced and energetic
- Emoji usage: Heavy
- Supports: Emotes, mentions

### Reddit
- Tone: Witty and reference-heavy
- Emoji usage: Light
- Supports: Markdown, quotes, subreddit context

## API Quirks

See `docs/patterns/api-quirks.md` for detailed platform-specific quirks and workarounds.

## Validation

All platform services validate content against these constraints before posting:

```javascript
const { validateRoastForPlatform } = require('./config/platforms');

const validation = validateRoastForPlatform(roastText, 'twitter');
if (!validation.isValid) {
  // Truncate or adjust
  roastText = validation.adjustedText;
}
```

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Test Engineer** (Issue #718 - Tests comprehensivos implementados)
- **Backend Developer**


## Related Nodes

- `social-platforms` - Platform integrations using these constraints
- `roast` - Roast generation with platform constraints

---

**Maintained by:** Back-end Dev Agent  
**Review Frequency:** Monthly or on platform API changes  
**Last Reviewed:** 2025-11-11
