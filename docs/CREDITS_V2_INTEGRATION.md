# Credits v2 Integration Guide

**How to integrate the dual credit system into existing and new routes**

## Overview

The Credits v2 system introduces two types of credits:
- **Analysis Credits**: Used for gatekeeper checks, toxicity analysis, shield protection
- **Roast Credits**: Used for roast generation and posting responses

## Middleware Integration

### Basic Usage

```javascript
const { 
  requireAnalysisCredits, 
  requireRoastCredits, 
  requireBothCredits 
} = require('../middleware/requireCredits');

// Protect route with analysis credits
router.post('/api/analyze', 
  authenticateToken,
  requireAnalysisCredits({ amount: 1, actionType: 'toxicity_analysis' }),
  async (req, res) => {
    // Route logic here
    // Credits already consumed by middleware
  }
);

// Protect route with roast credits
router.post('/api/roast', 
  authenticateToken,
  requireRoastCredits({ amount: 1, actionType: 'roast_generation' }),
  async (req, res) => {
    // Route logic here
  }
);

// Protect route requiring both credit types
router.post('/api/full-roast', 
  authenticateToken,
  requireBothCredits({ 
    analysisAmount: 2, 
    roastAmount: 1, 
    actionType: 'full_roast_workflow' 
  }),
  async (req, res) => {
    // Route logic here
  }
);
```

### Pre-Check Mode

Use pre-check mode to verify credits without consuming them immediately:

```javascript
router.post('/api/roast/preview', 
  authenticateToken,
  requireRoastCredits({ preCheck: true, actionType: 'roast_preview' }),
  async (req, res) => {
    // Credits verified but not consumed
    // Show preview to user
    
    // Later, when user confirms, consume credits manually:
    const consumed = await creditsService.consume(req.user.id, 'roast', {
      amount: 1,
      actionType: 'roast_generation_confirmed',
      platform: req.body.platform
    });
    
    if (!consumed) {
      return res.status(402).json({ error: 'Credits no longer available' });
    }
    
    // Proceed with actual roast generation
  }
);
```

## Route Integration Examples

### Gatekeeper Service Integration

```javascript
// src/routes/gatekeeper.js
const { requireAnalysisCredits } = require('../middleware/requireCredits');

router.post('/check', 
  authenticateToken,
  requireAnalysisCredits({ 
    amount: 1, 
    actionType: 'gatekeeper_check' 
  }),
  async (req, res) => {
    try {
      const { content, platform } = req.body;
      
      // Perform gatekeeper analysis
      const result = await gatekeeperService.analyze(content, platform);
      
      res.json({
        success: true,
        data: result,
        creditsConsumed: req.creditsConsumed // Added by middleware
      });
      
    } catch (error) {
      logger.error('Gatekeeper check failed', { 
        userId: req.user.id, 
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        error: 'Gatekeeper check failed'
      });
    }
  }
);
```

### Roast Generation Integration

```javascript
// src/routes/roast.js
const { requireBothCredits } = require('../middleware/requireCredits');

router.post('/generate', 
  authenticateToken,
  requireBothCredits({ 
    analysisAmount: 1, // For content analysis
    roastAmount: 1,    // For roast generation
    actionType: 'roast_generation' 
  }),
  async (req, res) => {
    try {
      const { content, platform, style } = req.body;
      
      // Step 1: Analyze content (analysis credit already consumed)
      const analysis = await analysisService.analyze(content);
      
      // Step 2: Generate roast (roast credit already consumed)
      const roast = await roastService.generate(analysis, style);
      
      res.json({
        success: true,
        data: {
          roast,
          analysis: analysis.summary
        },
        creditsConsumed: req.creditsConsumed // { analysis: 1, roast: 1 }
      });
      
    } catch (error) {
      logger.error('Roast generation failed', { 
        userId: req.user.id, 
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        error: 'Roast generation failed'
      });
    }
  }
);
```

### Conditional Credit Consumption

```javascript
// src/routes/shield.js
const { requireAnalysisCredits } = require('../middleware/requireCredits');

router.post('/protect', 
  authenticateToken,
  requireAnalysisCredits({ 
    preCheck: true, // Don't consume yet
    actionType: 'shield_protection' 
  }),
  async (req, res) => {
    try {
      const { content, platform } = req.body;
      
      // Quick local check first (free)
      const quickCheck = await shieldService.quickCheck(content);
      
      if (quickCheck.safe) {
        // Content is safe, no need to consume credits
        return res.json({
          success: true,
          data: { safe: true, reason: 'quick_check' },
          creditsConsumed: { analysis: 0 }
        });
      }
      
      // Need deeper analysis, consume credits now
      const consumed = await creditsService.consume(req.user.id, 'analysis', {
        amount: 1,
        actionType: 'shield_deep_analysis',
        platform,
        metadata: { quickCheckResult: quickCheck }
      });
      
      if (!consumed) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient analysis credits for deep protection'
        });
      }
      
      // Perform deep analysis
      const deepAnalysis = await shieldService.deepAnalyze(content);
      
      res.json({
        success: true,
        data: deepAnalysis,
        creditsConsumed: { analysis: 1 }
      });
      
    } catch (error) {
      logger.error('Shield protection failed', { 
        userId: req.user.id, 
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        error: 'Shield protection failed'
      });
    }
  }
);
```

## Error Handling

### Credit Insufficient Responses

The middleware automatically returns appropriate error responses:

```javascript
// 402 Payment Required for insufficient credits
{
  "success": false,
  "error": "Insufficient analysis credits",
  "code": "INSUFFICIENT_ANALYSIS_CREDITS",
  "data": {
    "creditType": "analysis",
    "required": 5,
    "remaining": 2,
    "limit": 10000,
    "periodEnd": "2024-02-01T00:00:00Z"
  }
}
```

### Custom Error Handling

```javascript
router.post('/api/custom-endpoint', 
  authenticateToken,
  async (req, res) => {
    try {
      // Manual credit check
      const availability = await creditsService.canConsume(
        req.user.id, 
        'analysis', 
        5
      );
      
      if (!availability.canConsume) {
        return res.status(402).json({
          success: false,
          error: 'Not enough credits for this operation',
          data: {
            required: 5,
            available: availability.remaining,
            upgradeUrl: '/billing'
          }
        });
      }
      
      // Proceed with operation...
      
    } catch (error) {
      // Handle errors
    }
  }
);
```

## Frontend Integration

### Credit Status Display

```javascript
// Frontend component
import { CreditsCard } from '../components/widgets/CreditsCard';

function Dashboard() {
  return (
    <div className="dashboard">
      <CreditsCard />
      {/* Other dashboard components */}
    </div>
  );
}
```

### Pre-Flight Credit Checks

```javascript
// Before expensive operations
async function checkCreditsBeforeRoast(platform) {
  try {
    const response = await fetch('/api/user/credits/check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creditType: 'roast',
        amount: 1
      })
    });
    
    const result = await response.json();
    
    if (!result.data.canConsume) {
      // Show upgrade prompt
      showUpgradeModal({
        creditType: 'roast',
        required: 1,
        remaining: result.data.remaining
      });
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('Credit check failed:', error);
    return true; // Fail open
  }
}
```

## Migration Strategy

### Gradual Migration

1. **Phase 1**: Add middleware to new routes only
2. **Phase 2**: Migrate high-traffic routes with monitoring
3. **Phase 3**: Complete migration of all routes
4. **Phase 4**: Remove legacy credit checks

### Backward Compatibility

```javascript
// During migration, support both systems
const { flags } = require('../config/flags');

router.post('/api/legacy-route', 
  authenticateToken,
  // Conditional middleware based on feature flag
  (req, res, next) => {
    if (flags.isEnabled('ENABLE_CREDITS_V2')) {
      return requireAnalysisCredits({ actionType: 'legacy_operation' })(req, res, next);
    } else {
      return legacyPlanLimitCheck(req, res, next);
    }
  },
  async (req, res) => {
    // Route logic
  }
);
```

## Best Practices

### 1. Action Type Naming
Use descriptive action types for better analytics:
```javascript
// Good
actionType: 'gatekeeper_toxicity_check'
actionType: 'roast_generation_twitter'
actionType: 'shield_deep_analysis'

// Avoid
actionType: 'check'
actionType: 'generate'
actionType: 'analyze'
```

### 2. Platform Tracking
Always include platform information:
```javascript
requireAnalysisCredits({ 
  actionType: 'gatekeeper_check',
  // Platform will be extracted from req.body.platform or req.query.platform
})
```

### 3. Metadata for Debugging
Include relevant metadata for troubleshooting:
```javascript
await creditsService.consume(userId, 'analysis', {
  amount: 1,
  actionType: 'custom_analysis',
  platform: 'twitter',
  metadata: {
    contentLength: content.length,
    analysisType: 'deep',
    userAgent: req.get('User-Agent')
  }
});
```

### 4. Error Recovery
Always handle credit service failures gracefully:
```javascript
try {
  const consumed = await creditsService.consume(userId, 'analysis');
  if (!consumed) {
    return res.status(402).json({ error: 'Insufficient credits' });
  }
} catch (error) {
  logger.error('Credit service error', { error });
  // Fail open for critical operations
  // Fail closed for premium features
}
```

## Testing

### Unit Tests
```javascript
describe('Route with credits middleware', () => {
  it('should consume credits and proceed', async () => {
    creditsService.canConsume.mockResolvedValue({ canConsume: true });
    creditsService.consume.mockResolvedValue(true);
    
    const response = await request(app)
      .post('/api/test-route')
      .send({ content: 'test' })
      .expect(200);
      
    expect(creditsService.consume).toHaveBeenCalledWith(
      'user-id',
      'analysis',
      expect.objectContaining({
        amount: 1,
        actionType: 'test_action'
      })
    );
  });
});
```

### Integration Tests
```javascript
describe('Credits integration', () => {
  it('should handle insufficient credits', async () => {
    // Set up user with low credits
    await setupUserWithCredits('user-id', { analysis: 1, roast: 0 });
    
    const response = await request(app)
      .post('/api/roast/generate')
      .send({ content: 'test' })
      .expect(402);
      
    expect(response.body.code).toBe('INSUFFICIENT_ROAST_CREDITS');
  });
});
```
