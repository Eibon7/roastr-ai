# Platform Constraints - Platform-Specific Rules & Style Guides

**Node ID:** `platform-constraints`
**Owner:** Back-end Dev
**Priority:** High
**Status:** Production
**Last Updated:** 2025-10-09
**Coverage:** 100%
**Coverage Source:** mocked
**Related PRs:** #499

## Dependencies

- `social-platforms` - 9 platform integrations (Twitter, YouTube, Instagram, etc.)

## Overview

Platform Constraints centralizes character limits, style guides, and formatting rules for 9 social media platforms. It ensures roasts are optimized for each platform's unique constraints and best practices.

**Supported Platforms:** Twitter, Instagram, Facebook, LinkedIn, TikTok, YouTube, Discord, Reddit, Bluesky

## Character Limits

**File:** `src/config/platforms.js`, `src/config/constants.js`

| Platform | Max Length | Preferred Length | Type |
|----------|-----------|------------------|------|
| **Twitter** | 280 | 240 | Hard limit |
| **Instagram** | 2,200 | 150 | Soft limit |
| **Facebook** | 63,206 | 400 | Soft limit |
| **LinkedIn** | 3,000 | 500 | Soft limit |
| **TikTok** | 2,200 | 200 | Soft limit |
| **YouTube** | 10,000 | 800 | Soft limit |
| **Discord** | 2,000 | 300 | Hard limit |
| **Reddit** | 10,000 | 600 | Soft limit |
| **Bluesky** | 300 | 250 | Hard limit |

**Hard limit:** Platform enforces truncation
**Soft limit:** Recommend staying under for better engagement

## Platform Styles

### Twitter
```javascript
{
  tone: 'concise and punchy',
  preferredLength: 240,
  emojiUsage: 'moderate',
  hashtagLimit: 2,
  formatting: {
    lineBreaks: false,
    emphasis: 'CAPS for emphasis'
  }
}
```

### Instagram
```javascript
{
  tone: 'visual and engaging',
  preferredLength: 150,
  emojiUsage: 'heavy',
  hashtagLimit: 30,
  formatting: {
    lineBreaks: true,
    bulletPoints: true,
    emphasis: 'emojis and spacing'
  }
}
```

### Discord
```javascript
{
  tone: 'casual and community-focused',
  preferredLength: 300,
  emojiUsage: 'heavy',
  customEmojiUsage: true,
  formatting: {
    lineBreaks: true,
    markdown: true,
    codeBlocks: true,
    emphasis: 'markdown formatting'
  }
}
```

### LinkedIn
```javascript
{
  tone: 'professional but clever',
  preferredLength: 500,
  emojiUsage: 'minimal',
  hashtagLimit: 3,
  formatting: {
    lineBreaks: true,
    bulletPoints: true,
    emphasis: 'professional language'
  }
}
```

## API Functions

### Get Platform Configuration

```javascript
const { getPlatformConfig } = require('./config/platforms');

const config = getPlatformConfig('twitter');
// {
//   name: 'Twitter',
//   maxLength: 280,
//   supports: { hashtags: true, emojis: true, threading: true },
//   style: { tone: 'concise and punchy', preferredLength: 240, ... },
//   formatting: { lineBreaks: false, emphasis: 'CAPS for emphasis' }
// }
```

### Validate Roast Length

```javascript
const { validateRoastForPlatform } = require('./config/platforms');

const result = validateRoastForPlatform(roastText, 'twitter');
// {
//   isValid: true/false,
//   adjustedText: 'Truncated roast...',
//   originalLength: 320,
//   limit: 280,
//   platformConfig: { /* full config */ }
// }
```

**Truncation Logic:**
- Reserves 3 chars for "..."
- Preserves word boundaries (min 80% of limit)
- Only truncates when necessary

### Check Feature Support

```javascript
const { platformSupports } = require('./config/platforms');

platformSupports('instagram', 'hashtags')  // true
platformSupports('linkedin', 'emojis')     // false
platformSupports('discord', 'markdown')    // true
```

## Integration with Roast Generation

**Path:** `RoastPromptTemplate.buildPrompt()` → Platform-specific instructions

```javascript
async buildPrompt(comment, userConfig, includeReferences = true) {
  // ... base prompt construction ...

  if (userConfig.platform) {
    const platformStyle = getPlatformStyle(userConfig.platform);
    const platformLimit = getPlatformLimit(userConfig.platform);

    prompt += `\n\n📏 RESTRICCIONES DE PLATAFORMA (${userConfig.platform}):\n`;
    prompt += `- Longitud máxima: ${platformLimit} caracteres\n`;
    prompt += `- Longitud preferida: ${platformStyle.preferredLength} caracteres\n`;
    prompt += `- Tono: ${platformStyle.tone}\n`;
    prompt += `- Uso de emojis: ${platformStyle.emojiUsage}\n`;

    if (platformSupports(userConfig.platform, 'hashtags')) {
      prompt += `- Hashtags permitidos: hasta ${platformStyle.hashtagLimit || 'ilimitados'}\n`;
    }

    if (platformSupports(userConfig.platform, 'markdown')) {
      prompt += `- Soporta markdown: usa **negrita** e _itálica_\n`;
    }
  }

  return prompt;
}
```

## Validation & Error Handling

### Pre-Generation Validation

```javascript
// Before generating roast
const platformConfig = getPlatformConfig(platform);
if (!platformConfig) {
  throw new Error(`Unsupported platform: ${platform}`);
}

const maxLength = platformConfig.maxLength;
if (comment.length > maxLength * 2) {
  throw new Error(`Comment too long for ${platform} (max: ${maxLength * 2} chars)`);
}
```

### Post-Generation Validation

```javascript
// After generating roast
const validation = validateRoastForPlatform(generatedRoast, platform);

if (!validation.isValid) {
  // Option 1: Use truncated version
  roast = validation.adjustedText;

  // Option 2: Regenerate with stricter length constraint
  await regenerateRoast(comment, {
    ...userConfig,
    maxLength: validation.limit - 20  // 20 char buffer
  });
}
```

## Testing

```javascript
describe('Platform Constraints', () => {
  test('validates Twitter character limit', () => {
    const longRoast = 'a'.repeat(300);
    const result = validateRoastForPlatform(longRoast, 'twitter');

    expect(result.isValid).toBe(false);
    expect(result.adjustedText.length).toBeLessThanOrEqual(280);
    expect(result.adjustedText).toMatch(/\.\.\.$/);
  });

  test('preserves word boundaries when truncating', () => {
    const roast = 'This is a very long roast that exceeds Twitter limit by a lot';
    const result = validateRoastForPlatform(roast, 'bluesky');  // 300 char limit

    expect(result.adjustedText).not.toMatch(/\w\.\.\./);  // No mid-word truncation
  });

  test('returns correct platform configuration', () => {
    const config = getPlatformConfig('discord');

    expect(config.maxLength).toBe(2000);
    expect(config.supports.markdown).toBe(true);
    expect(config.style.emojiUsage).toBe('heavy');
  });
});
```

## Future Enhancements

- [ ] Dynamic platform constraint fetching from API
- [ ] A/B testing of optimal lengths
- [ ] Platform-specific emoji recommendations
- [ ] Multi-part roast support for threading
- [ ] Real-time platform API limit sync


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Test Engineer**
- **Backend Developer**
- **Integration Specialist**


## Related Nodes

- **social-platforms** - Platform integrations consume these constraints
- **roast** - Roast generation applies platform-specific rules
- **tone** - Tone verbosity adapts to platform limits

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** On platform API changes
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0
