# Enhanced /api/roast/preview Endpoint Documentation

## Issue #326: Real AI Integration with GPT-4

This document describes the enhanced `/api/roast/preview` endpoint that connects the Compose frontend with real GPT-4 AI generation, implementing a dual credit system for analysis and roast generation.

## Overview

The endpoint now supports advanced roast generation with:
- **Real GPT-4 integration** (GPT-3.5 for Free plan, GPT-4 for paid plans)
- **Dual credit system**: Analysis credits for previews, Roast credits for final generation
- **Style profiles and personas** for personalized roast generation  
- **Platform-specific optimization** for different social media platforms
- **Automatic fallback to mock mode** on API failures with debugging logs

## Endpoint Details

### Request

**URL:** `POST /api/roast/preview`

**Authentication:** Required (Bearer token)

**Content-Type:** `application/json`

### Request Body

```json
{
  "text": "Message to generate a roast for",
  "styleProfile": {
    "tone": "sarcastic",
    "intensity": 4,
    "humorType": "witty"
  },
  "persona": "Sarcastic comedian",
  "platform": "twitter"
}
```

#### Required Fields
- `text` (string): The message to roast (max 2000 characters)

#### Optional Fields
- `styleProfile` (object): Style configuration for the roast
- `persona` (string): Personality to adopt for roast generation (max 100 characters)
- `platform` (string): Target platform for optimization

#### Supported Platforms
- `twitter` (default)
- `facebook`
- `instagram` 
- `youtube`
- `tiktok`
- `reddit`
- `discord`
- `twitch`
- `bluesky`

### Response Format (Success)

```json
{
  "success": true,
  "roast": "Generated roast response",
  "tokensUsed": 85,
  "analysisCountRemaining": 999,
  "roastsRemaining": 99,
  "metadata": {
    "platform": "twitter",
    "styleProfile": {...},
    "persona": "Sarcastic comedian",
    "tone": "sarcastic",
    "intensity": 4,
    "humorType": "witty",
    "toxicityScore": 0.3,
    "safe": true,
    "plan": "pro",
    "processingTimeMs": 1250,
    "generatedAt": "2024-01-20T15:30:00Z",
    "model": "gpt-4o"
  },
  "timestamp": "2024-01-20T15:30:00Z"
}
```

### Response Fields

#### Core Response (Issue #326 Requirements)
- `roast` (string): The generated roast response
- `tokensUsed` (number): OpenAI tokens consumed for this request  
- `analysisCountRemaining` (number): Analysis credits remaining this month
- `roastsRemaining` (number): Roast generation credits remaining this month

#### Metadata
- `platform` (string): Platform the roast was optimized for
- `styleProfile` (object): Applied style configuration
- `persona` (string): Applied persona
- `model` (string): AI model used for generation
- `processingTimeMs` (number): Request processing time
- `plan` (string): User's current subscription plan

## Credit System

### Analysis Credits
- **Consumed**: 1 credit per preview request
- **Purpose**: Toxicity analysis and roast preview generation
- **Limits by Plan**:
  - Free: 1,000/month
  - Starter: 1,000/month  
  - Pro: 10,000/month
  - Plus: 100,000/month
  - Custom: Unlimited

### Roast Credits
- **Consumed**: 1 credit per final roast generation (via `/api/roast/generate`)
- **Purpose**: Final roast generation for publishing
- **Limits by Plan**:
  - Free: 50/month
  - Starter: 100/month
  - Pro: 1,000/month
  - Plus: 5,000/month
  - Custom: Unlimited

## AI Model Usage by Plan

| Plan | Model | Features |
|------|--------|----------|
| Free | GPT-3.5 Turbo | Basic roast generation |
| Starter | GPT-4o | Enhanced quality + Shield |
| Pro | GPT-4o | Personal tone + Analytics |
| Plus | GPT-4o | RQC embedded + All features |
| Custom | GPT-4o | Unlimited + Custom features |

## Error Handling

### Insufficient Analysis Credits (402)
```json
{
  "success": false,
  "error": "Insufficient analysis credits",
  "details": {
    "analysisCountRemaining": 0,
    "analysisLimit": 1000,
    "plan": "free",
    "message": "Agotaste tu límite de análisis, actualiza tu plan"
  },
  "timestamp": "2024-01-20T15:30:00Z"
}
```

### Content Safety Issues (400)
```json
{
  "success": false,
  "error": "Content not suitable for roasting",
  "details": {
    "toxicityScore": 0.8,
    "categories": ["TOXICITY", "INSULT"],
    "reason": "Content exceeds toxicity threshold"
  },
  "timestamp": "2024-01-20T15:30:00Z"
}
```

### OpenAI API Failure (200 - Fallback Mode)
When OpenAI API fails, the system automatically falls back to mock mode:

```json
{
  "success": true,
  "roast": "Mock roast response (Modo de prueba)",
  "tokensUsed": 50,
  "analysisCountRemaining": 999,
  "roastsRemaining": 99,
  "metadata": {
    "fallbackMode": true,
    "error": "OpenAI API unavailable",
    "generatedAt": "2024-01-20T15:30:00Z"
  },
  "timestamp": "2024-01-20T15:30:00Z"
}
```

## Rate Limiting

The endpoint is protected by:
- **Authentication**: Requires valid Bearer token
- **Rate limiting**: Applied per user/IP
- **Input validation**: Comprehensive request validation
- **Content moderation**: Automatic toxicity checking

## Usage Examples

### Basic Preview
```javascript
const response = await fetch('/api/roast/preview', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    text: 'This app is terrible'
  })
});
```

### Advanced Preview with Persona
```javascript
const response = await fetch('/api/roast/preview', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    text: 'This app is terrible',
    styleProfile: { tone: 'witty', intensity: 4 },
    persona: 'Tech reviewer with a sense of humor',
    platform: 'twitter'
  })
});
```

## Frontend Integration

The endpoint is integrated with the Compose component:
- Real-time credit display
- Error handling with upgrade prompts
- Platform selection UI
- Persona input field
- Automatic fallback messaging

## Database Changes

New table `analysis_usage` tracks analysis credit consumption:
- Separate from `roast_usage` table
- Monthly usage calculation
- Atomic credit consumption with `consume_analysis_credits()` function
- Row Level Security for multi-tenant isolation

## Migration Required

Run migration `015_add_analysis_usage_table.sql` to add:
- `analysis_usage` table
- Helper functions for credit management
- Proper indexes and RLS policies

## Security Features

- **Input sanitization**: All parameters validated
- **Content moderation**: Perspective API integration  
- **Credit verification**: Atomic credit consumption
- **Error logging**: Comprehensive debug information
- **Fallback protection**: Graceful degradation on API failures

## Monitoring & Logging

The endpoint logs:
- Successful generations with metadata
- API failures with fallback activation
- Credit consumption patterns
- Processing times and token usage
- Platform-specific usage statistics