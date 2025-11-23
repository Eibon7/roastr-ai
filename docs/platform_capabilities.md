# Platform Capabilities Matrix - Shield Actions

## Overview

This document provides a comprehensive analysis of moderation capabilities across supported social media platforms. It defines what Shield actions are supported, their implementation details, and fallback strategies for each platform.

## Platforms Covered

- **X (Twitter)** - Full analysis completed
- **YouTube** - Full analysis completed
- **Discord** - Full analysis completed
- **Twitch** - Full analysis completed

---

## Platform Capabilities Matrix

| Platform        | Hide Comment | Report User | Block User | Endpoint/SDK | Scopes Required               | Rate Limits       | Notes/Fallback          |
| --------------- | ------------ | ----------- | ---------- | ------------ | ----------------------------- | ----------------- | ----------------------- |
| **X (Twitter)** | ✅ Yes       | ⚠️ Limited  | ✅ Yes     | Helix API v2 | tweet.write, users.write      | Basic: $100/month | See detailed section    |
| **YouTube**     | ✅ Yes\*     | ❌ No       | ❌ No      | Data API v3  | youtube.force-ssl             | 50 units/call     | \*Via moderation status |
| **Discord**     | ✅ Yes       | ❌ No       | ✅ Yes     | REST API v10 | Manage Messages, Ban Members  | 50 req/sec global | User-level only         |
| **Twitch**      | ❌ No        | ❌ No       | ✅ Yes     | Helix API    | moderator:manage:banned_users | 2 req/sec         | Chat-level moderation   |

---

## Detailed Platform Analysis

### 🐦 **X (Twitter)**

#### Supported Actions

| Action           | Support   | Endpoint                | Method | Scopes                  | Rate Limit   |
| ---------------- | --------- | ----------------------- | ------ | ----------------------- | ------------ |
| **Hide Comment** | ✅ Full   | `/tweets/:id/hidden`    | PUT    | OAuth 1.0a or OAuth 2.0 | Per endpoint |
| **Report User**  | ⚠️ Manual | N/A (UI only)           | N/A    | N/A                     | N/A          |
| **Block User**   | ✅ Full   | `/blocks/create` (v1.1) | POST   | OAuth 1.0a              | 15min window |

#### Implementation Details

**Hide Replies:**

```bash
PUT https://api.x.com/2/tweets/{tweet_id}/hidden
Content-Type: application/json
Authorization: Bearer {token}

{
  "hidden": true
}
```

**Block User:**

```bash
POST https://api.x.com/1.1/blocks/create.json
Content-Type: application/x-www-form-urlencoded
Authorization: OAuth

user_id={user_id}
```

#### Key Limitations & Fallbacks

- **Reporting**: No API endpoint for automated reporting. Users must report manually through the web interface.
- **Cost**: Requires at least Basic tier ($100/month) as of 2025
- **Authentication**: Multiple auth methods supported (OAuth 1.0a, OAuth 2.0 with PKCE)
- **Fallback Strategy**: If hide fails → block user, if block fails → log incident for manual review

---

### 🎥 **YouTube**

#### Supported Actions

| Action           | Support       | Endpoint                        | Method | Scopes            | Quota Cost |
| ---------------- | ------------- | ------------------------------- | ------ | ----------------- | ---------- |
| **Hide Comment** | ✅ Moderation | `/comments/setModerationStatus` | POST   | youtube.force-ssl | 50 units   |
| **Report User**  | ❌ No API     | N/A                             | N/A    | N/A               | N/A        |
| **Block User**   | ❌ No API     | N/A                             | N/A    | N/A               | N/A        |

#### Implementation Details

**Set Moderation Status (Hide Comment):**

```bash
POST https://www.googleapis.com/youtube/v3/comments/setModerationStatus
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "id": "comment_id",
  "moderationStatus": "rejected",
  "banAuthor": false
}
```

#### Valid Moderation Status Values

- `heldForReview` - Comment awaiting review
- `published` - Comment approved for display
- `rejected` - Comment hidden from display

#### Key Limitations & Fallbacks

- **User Blocking**: Not available via API, only through YouTube Studio interface
- **Reporting**: Must be done manually through YouTube's reporting system
- **Permissions**: Only works for comments on channels you own/moderate
- **Fallback Strategy**: If moderation fails → log for manual review in YouTube Studio

---

### 🎮 **Discord**

#### Supported Actions

| Action             | Support   | Endpoint                                       | Method | Permissions      | Rate Limit    |
| ------------------ | --------- | ---------------------------------------------- | ------ | ---------------- | ------------- |
| **Delete Message** | ✅ Full   | `/channels/{channel_id}/messages/{message_id}` | DELETE | Manage Messages  | Per endpoint  |
| **Report User**    | ❌ No API | N/A                                            | N/A    | N/A              | N/A           |
| **Ban User**       | ✅ Full   | `/guilds/{guild_id}/bans/{user_id}`            | PUT    | Ban Members      | Global 50/sec |
| **Timeout User**   | ✅ Full   | `/guilds/{guild_id}/members/{user_id}`         | PATCH  | Moderate Members | Global 50/sec |

#### Implementation Details

**Delete Message:**

```bash
DELETE https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}
Authorization: Bot {bot_token}
```

**Ban User:**

```bash
PUT https://discord.com/api/v10/guilds/{guild_id}/bans/{user_id}
Authorization: Bot {bot_token}
Content-Type: application/json

{
  "delete_message_days": 7,
  "reason": "Spam/inappropriate content"
}
```

**Timeout User:**

```bash
PATCH https://discord.com/api/v10/guilds/{guild_id}/members/{user_id}
Authorization: Bot {bot_token}
Content-Type: application/json

{
  "communication_disabled_until": "2025-09-17T15:30:00Z"
}
```

#### Key Limitations & Fallbacks

- **Reporting**: No API for reporting users to Discord
- **Rate Limits**: Global 50 requests/second, individual endpoint limits vary
- **Permissions**: Requires appropriate bot permissions in the server
- **Fallback Strategy**: Delete message → timeout → ban (escalating severity)

---

### 🟣 **Twitch**

#### Supported Actions

| Action             | Support   | Endpoint           | Method | Scopes                        | Rate Limit |
| ------------------ | --------- | ------------------ | ------ | ----------------------------- | ---------- |
| **Delete Message** | ❌ No API | N/A                | N/A    | N/A                           | N/A        |
| **Report User**    | ❌ No API | N/A                | N/A    | N/A                           | N/A        |
| **Ban User**       | ✅ Full   | `/moderation/bans` | POST   | moderator:manage:banned_users | 2 req/sec  |
| **Timeout User**   | ✅ Full   | `/moderation/bans` | POST   | moderator:manage:banned_users | 2 req/sec  |

#### Implementation Details

**Ban User (Permanent):**

```bash
POST https://api.twitch.tv/helix/moderation/bans?broadcaster_id={broadcaster_id}&moderator_id={moderator_id}
Authorization: Bearer {user_access_token}
Client-Id: {client_id}
Content-Type: application/json

{
  "data": {
    "user_id": "target_user_id",
    "reason": "Inappropriate behavior"
  }
}
```

**Timeout User (Temporary):**

```bash
POST https://api.twitch.tv/helix/moderation/bans?broadcaster_id={broadcaster_id}&moderator_id={moderator_id}
Authorization: Bearer {user_access_token}
Client-Id: {client_id}
Content-Type: application/json

{
  "data": {
    "user_id": "target_user_id",
    "duration": 300,
    "reason": "Temporary timeout for rule violation"
  }
}
```

#### Key Limitations & Fallbacks

- **Message Deletion**: Not available via API, handled through chat moderation
- **Reporting**: Must be done manually through Twitch interface
- **Timeout Duration**: Maximum 1,209,600 seconds (2 weeks)
- **Fallback Strategy**: Timeout → ban (escalating severity)

---

## Unified Fallback Strategy

### Primary Action Mapping

| Desired Action   | X (Twitter) | YouTube        | Discord        | Twitch        |
| ---------------- | ----------- | -------------- | -------------- | ------------- |
| **Hide Content** | Hide Reply  | Reject Comment | Delete Message | ❌ → Ban User |
| **Report User**  | ❌ → Block  | ❌ → Reject    | ❌ → Ban       | ❌ → Ban      |
| **Block User**   | Block User  | ❌ → Reject    | Ban User       | Ban User      |

### Escalation Matrix

When primary action fails, follow this escalation:

1. **Hide/Delete** → If fails, proceed to Block/Ban
2. **Report** → If no API, proceed to Block/Ban
3. **Block/Ban** → If fails, log for manual review

### Error Handling

All platforms should implement:

- **Retry Logic**: 3 attempts with exponential backoff
- **Circuit Breaker**: Suspend calls after N consecutive failures
- **Audit Logging**: Record all attempts and outcomes
- **Manual Queue**: Failed actions require human review

---

## Rate Limit Considerations

### Global Limits

- **X (Twitter)**: $100/month minimum for API access
- **YouTube**: Daily quota limits (varies by tier)
- **Discord**: 50 requests/second global
- **Twitch**: 2 requests/second for moderation endpoints

### Recommendations

- Implement request queuing for high-volume scenarios
- Use batch operations where available
- Cache permission checks to reduce API calls
- Monitor rate limit headers and adjust accordingly

---

## Security & Authentication

### Required Permissions by Platform

| Platform    | Scope/Permission                | Description                                    |
| ----------- | ------------------------------- | ---------------------------------------------- |
| **X**       | OAuth 1.0a or 2.0               | tweet.write, users.write                       |
| **YouTube** | `youtube.force-ssl`             | Full channel management                        |
| **Discord** | Bot permissions                 | Manage Messages, Ban Members, Moderate Members |
| **Twitch**  | `moderator:manage:banned_users` | User access token required                     |

### Security Considerations

- Store tokens securely with encryption
- Implement token refresh mechanisms
- Use least-privilege access patterns
- Audit all moderation actions with user context

---

## Implementation Priorities

### Phase 1 (MVP)

1. **X (Twitter)** - Hide replies + Block users
2. **Discord** - Delete messages + Ban users

### Phase 2 (Extended)

3. **YouTube** - Comment moderation status
4. **Twitch** - User bans and timeouts

### Phase 3 (Future)

- Additional platforms based on user demand
- Enhanced reporting mechanisms
- Cross-platform analytics

---

## Conclusion

Each platform offers different moderation capabilities with varying levels of API support. The unified adapter interface must handle these differences gracefully while providing consistent behavior to the Shield system.

Key takeaways:

- **X (Twitter)** has the most complete API support but requires paid access
- **YouTube** focuses on content moderation rather than user blocking
- **Discord** offers comprehensive moderation but no reporting API
- **Twitch** specializes in chat moderation with timeout capabilities

The adapter layer will normalize these differences and provide fallback strategies to ensure effective content moderation across all platforms.
