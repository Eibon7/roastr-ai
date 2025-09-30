# UI Component Mockups - Security Enhancements Round 2

## AutoPublishNotification - Enhanced Toast States

### 1. Security Validation Success Toast
```
╔═══════════════════════════════════════════════════════════════╗
║ ✓ Auto-Approved                                               ║
║   Roast passed all security validations                       ║
║                                                               ║
║   Security Checks:                                            ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │ ● Content Filter       ● Platform Rules             │    ║
║   │ ● Toxicity Check       ● Organization Policy       │    ║
║   └─────────────────────────────────────────────────────┘    ║
║                                                               ║
║   Rate Limits:                                                ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │ Hourly:  10/50         Daily: 45/200                │    ║
║   └─────────────────────────────────────────────────────┘    ║
╚═══════════════════════════════════════════════════════════════╝
```

### 2. Security Validation Failed Toast
```
╔═══════════════════════════════════════════════════════════════╗
║ ⚠️ Auto-Approval Failed                                        ║
║   Manual review required for this roast                       ║
║                                                               ║
║   Security Checks:                                            ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │ ● Content Filter       ✗ Platform Rules             │    ║
║   │ ✗ Toxicity Check       ● Organization Policy       │    ║
║   └─────────────────────────────────────────────────────┘    ║
║                                                               ║
║   Error Details:                                              ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │ Toxicity level exceeds threshold by 0.15            │    ║
║   │ Platform rules violation: prohibited keywords        │    ║
║   │ ID: val-a3f5b2c1                                    │    ║
║   └─────────────────────────────────────────────────────┘    ║
║                                                               ║
║   [Review Manually] [Adjust Settings]                        ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3. Rate Limit Warning Toast
```
╔═══════════════════════════════════════════════════════════════╗
║ 🕐 Rate Limit Reached                                         ║
║   Please wait before processing more comments                 ║
║                                                               ║
║   Rate Limits:                                                ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │ Hourly:  [████████████] 50/50 (100%)               │    ║
║   │ Daily:   [████████░░░░] 150/200 (75%)              │    ║
║   └─────────────────────────────────────────────────────┘    ║
║                                                               ║
║   Next reset: 14 minutes                                     ║
╚═══════════════════════════════════════════════════════════════╝
```

## SecurityValidationIndicator - Enhanced States

### 1. Validation in Progress
```
╔═══════════════════════════════════════════════════════════════╗
║ 🛡️ Security Validations                    Validating Security ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                               ║
║ Validating security requirements... 60%                       ║
║ [██████████████████░░░░░░░░░░░░░░]                          ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ 📄 Content Filter                                       │  ║
║ │    Content filter passed successfully               ✓   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ⚠️ Toxicity Check                                       │  ║
║ │    Analyzing toxicity levels...                     ⟳   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ 🌐 Platform Rules                                       │  ║
║ │    Verifying platform rules...                          │  ║
║ └─────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════╝
```

### 2. System Error with Retry
```
╔═══════════════════════════════════════════════════════════════╗
║ 🛡️ Security Validations                     Validation Error   ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ 📄 Content Filter                          10:23:45 AM  │  ║
║ │    Content filter passed successfully               ✓   │  ║
║ │ ┌───────────────────────────────────────────────────┐   │  ║
║ │ │ Score: 0.25    Confidence: 98%                    │   │  ║
║ │ └───────────────────────────────────────────────────┘   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ⚠️ Toxicity Check                          10:23:47 AM  │  ║
║ │    System Error: Connection failed                  ⚠️   │  ║
║ │ ┌───────────────────────────────────────────────────┐   │  ║
║ │ │ System Error: Database connection timeout         │   │  ║
║ │ │ • Retrying automatically                          │   │  ║
║ │ └───────────────────────────────────────────────────┘   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ⚠️ Validation system error                              │  ║
║ │                                                         │  ║
║ │ Unable to complete security validation due to system    │  ║
║ │ issues. Please try again.                              │  ║
║ │                                                         │  ║
║ │ [Retry Validation]                                      │  ║
║ └─────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3. Validation Failed with Details
```
╔═══════════════════════════════════════════════════════════════╗
║ 🛡️ Security Validations                    Validation Failed  ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ 📄 Content Filter                          10:23:45 AM  │  ║
║ │    Content filter passed successfully               ✓   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ⚠️ Toxicity Check                          10:23:47 AM  │  ║
║ │    Toxicity level exceeds threshold                 ✗   │  ║
║ │ ┌───────────────────────────────────────────────────┐   │  ║
║ │ │ Failure Reason: Score 0.85 exceeds limit 0.70    │   │  ║
║ │ │ (TOXICITY_THRESHOLD_EXCEEDED)                     │   │  ║
║ │ └───────────────────────────────────────────────────┘   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ 🛡️ Shield Protection                       10:23:48 AM  │  ║
║ │    Shield detected potential issues                 ✗   │  ║
║ │ ┌───────────────────────────────────────────────────┐   │  ║
║ │ │ Failure Reason: Content flagged for manual review│   │  ║
║ │ │ (SHIELD_CONTENT_FLAGGED)                          │   │  ║
║ │ └───────────────────────────────────────────────────┘   │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ✗ Security validation failed                            │  ║
║ │                                                         │  ║
║ │ The roast requires manual review before publication.    │  ║
║ │ Review failed validations above for details.           │  ║
║ └─────────────────────────────────────────────────────────┘  ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐  ║
║ │ ℹ️ Validation Details                                   │  ║
║ │ ID: val-a3f5b2c1-8d9e-4f5a-b6c7-d8e9f0a1b2c3         │  ║
║ │ Duration: 3240ms                                       │  ║
║ │ Organization: org-123                                  │  ║
║ └─────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════╝
```

## Color Scheme

- **Success**: Green (#10b981) - Passed validations
- **Error**: Red (#ef4444) - Failed validations  
- **Warning**: Yellow (#f59e0b) - Timeouts, rate limits
- **System Error**: Orange (#f97316) - Connection/system issues
- **Info**: Blue (#3b82f6) - General information
- **Neutral**: Gray (#6b7280) - Pending/inactive states

## Animation States

1. **Loading Spinner**: 
   - Rotation: 360° per second
   - Border style: 2px solid with gradient

2. **Progress Bar**:
   - Smooth transition: 300ms ease-out
   - Striped pattern for active state

3. **Retry Button**:
   - Hover: Scale 1.05 with shadow
   - Active: Scale 0.95

## Accessibility Features

- All interactive elements have focus states
- ARIA labels for screen readers
- Keyboard navigation support (Tab, Enter, Escape)
- High contrast mode compatible
- Reduced motion support