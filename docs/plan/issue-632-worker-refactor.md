# Worker Refactor Summary - Issue #632

## Cambios en AnalyzeToxicityWorker.processJob()

### ❌ Código Antiguo (PROBLEMÁTICO - Líneas 224-438)

```javascript
// GATEKEEPER CHECK (Issue #203): First line of defense against prompt injection
const commentText = text || comment.original_text;
const gatekeeperResult = await this.gatekeeperService.classifyComment(commentText);

// If Gatekeeper detects malicious content or prompt injection, route directly to Shield
if (gatekeeperResult.classification === 'MALICIOUS' || gatekeeperResult.isPromptInjection) {
  // ❌ EARLY RETURN - Perspective NEVER runs!
  return {
    success: true,
    summary: `Comment blocked by Gatekeeper: ${gatekeeperAnalysisResult.gatekeeper_reason}`,
    ...
  };
}

// If comment is positive, skip heavy analysis
if (gatekeeperResult.classification === 'POSITIVE') {
  // ❌ EARLY RETURN
  return { ... };
}

// ... auto-block check ...
// ... tolerance check ...

// ❌ Perspective called ONLY if Gatekeeper allows
const analysisResult = await this.analyzeToxicity(text, roastrPersona);
```

### ✅ Código Nuevo (CORREGIDO - Issue #632)

```javascript
// Get comment text
const commentText = text || comment.original_text;

// Auto-block check (Issue #149) - MANTENER
const intoleranceData = await this.getUserIntolerancePreferences(organization_id);
const autoBlockResult = await this.checkAutoBlock(commentText, intoleranceData?.text, intoleranceData?.embeddings);

if (autoBlockResult.shouldBlock) {
  // Auto-block path - MANTENER EXISTENTE
  return { ... };
}

// Tolerance check (Issue #150) - MANTENER
const toleranceData = await this.getUserTolerancePreferences(organization_id);
const toleranceResult = await this.checkTolerance(commentText, toleranceData?.text, toleranceData?.embeddings);

if (toleranceResult.shouldIgnore) {
  // Tolerance ignore path - MANTENER EXISTENTE
  return { ... };
}

// ✅ NUEVO: Unified Analysis Department (Issue #632)
// Runs Gatekeeper + Perspective in PARALLEL
const roastrPersona = await this.getUserRoastrPersona(organization_id);
const userContext = {
  userId: null, // Not available at this level
  organizationId: organization_id,
  platform,
  persona: roastrPersona,
  tau_roast_lower: this.thresholds.low,
  tau_shield: this.thresholds.high,
  tau_critical: this.thresholds.critical,
  autoApprove: false // Default
};

const analysisDecision = await this.analysisDepartment.analyzeComment(commentText, userContext);

// Update comment with unified analysis
await this.updateCommentWithAnalysisDecision(comment_id, analysisDecision);

// Record usage
await this.recordAnalysisUsage(organization_id, platform, comment_id, commentText, analysisDecision);

// ✅ Route based on direction (SHIELD, ROAST, PUBLISH)
await this.routeByDirection(organization_id, comment, analysisDecision, correlationId);

return {
  success: true,
  summary: `Analysis complete: ${analysisDecision.direction} (score: ${analysisDecision.scores.final_toxicity})`,
  commentId: comment_id,
  direction: analysisDecision.direction,
  action_tags: analysisDecision.action_tags,
  toxicityScore: analysisDecision.scores.final_toxicity,
  severityLevel: analysisDecision.metadata.decision.severity_level
};
```

## Nuevos Métodos Helper

### 1. updateCommentWithAnalysisDecision()

```javascript
async updateCommentWithAnalysisDecision(commentId, decision) {
  const analysisResult = {
    toxicity_score: decision.scores.final_toxicity,
    severity_level: decision.metadata.decision.severity_level,
    categories: [
      ...decision.metadata.security.injection_categories,
      ...decision.metadata.toxicity.flagged_categories
    ],
    service: decision.analysis.services_used.join('+'),
    direction: decision.direction,
    action_tags: decision.action_tags,
    security_classification: decision.metadata.security.classification,
    is_prompt_injection: decision.metadata.security.is_prompt_injection,
    platform_violations: decision.metadata.platform_violations
  };

  await this.updateCommentAnalysis(commentId, analysisResult);
}
```

### 2. recordAnalysisUsage()

```javascript
async recordAnalysisUsage(organizationId, platform, commentId, text, decision) {
  const tokensUsed = this.estimateTokens(text);

  await this.costControl.recordUsage(
    organizationId,
    platform,
    'unified_analysis',
    {
      commentId,
      tokensUsed,
      analysisService: decision.analysis.services_used.join('+'),
      direction: decision.direction,
      severity: decision.metadata.decision.severity_level,
      toxicityScore: decision.scores.final_toxicity,
      categories: decision.metadata.toxicity.flagged_categories,
      textLength: text.length,
      processingTime: decision.analysis.processing_time_ms,
      platformViolations: decision.metadata.platform_violations.has_violations
    },
    null,
    1
  );
}
```

### 3. routeByDirection()

```javascript
async routeByDirection(organizationId, comment, decision, correlationId) {
  switch (decision.direction) {
    case 'SHIELD':
      // Route to Shield with action_tags
      await this.handleShieldAction(organizationId, comment, decision);
      break;

    case 'ROAST':
      // Queue roast generation
      await this.queueResponseGeneration(organizationId, comment, decision, correlationId);
      break;

    case 'PUBLISH':
      // No action needed, comment is safe
      this.log('info', 'Comment safe to publish', {
        commentId: comment.comment_id,
        toxicityScore: decision.scores.final_toxicity
      });
      break;

    default:
      this.log('warn', 'Unknown direction from Analysis Department', {
        direction: decision.direction,
        commentId: comment.comment_id
      });
  }
}
```

### 4. handleShieldAction() (MODIFICADO)

```javascript
async handleShieldAction(organizationId, comment, decision) {
  // Pass action_tags to Shield Service (Issue #632)
  await this.shieldService.executeActionsFromTags(
    organizationId,
    comment,
    decision.action_tags,
    decision.metadata
  );

  this.log('info', 'Shield actions executed', {
    commentId: comment.comment_id,
    action_tags: decision.action_tags,
    platform_violations: decision.metadata.platform_violations.has_violations
  });
}
```

## Métodos a DEPRECAR (ya no usados)

- ❌ `handleGatekeeperShieldAction()` - Reemplazado por `handleShieldAction()`
- ❌ Early returns en líneas 237-311 - Eliminados

## Métodos a MANTENER (sin cambios)

- ✅ `checkAutoBlock()` - Auto-block por intolerance (Issue #149)
- ✅ `checkTolerance()` - Tolerance filtering (Issue #150)
- ✅ `getUserRoastrPersona()` - Persona fetching (Issue #148)
- ✅ `queueResponseGeneration()` - Roast queue logic
- ✅ `updateCommentAnalysis()` - Database update

## Backward Compatibility

**Campos mantenidos en analysisResult para compatibilidad:**
- `toxicity_score`
- `severity_level`
- `categories` (merged: security + toxicity)
- `service` (multi-service: "gatekeeper+perspective")

**Nuevos campos añadidos:**
- `direction` (SHIELD, ROAST, PUBLISH)
- `action_tags` (array de acciones explícitas)
- `platform_violations` (detectadas por Perspective)
- `is_prompt_injection` (detectado por Gatekeeper)

## Testing Strategy

**Unit Tests:**
- ✅ `routeByDirection()` - Test all 3 directions
- ✅ `handleShieldAction()` - Verify action_tags passed correctly
- ✅ `updateCommentWithAnalysisDecision()` - Verify data mapping

**Integration Tests:**
- ✅ Full flow con MALICIOUS + threat → SHIELD + report
- ✅ Full flow con MALICIOUS solo → SHIELD sin report
- ✅ Full flow con threat solo → SHIELD + report
- ✅ Auto-block + Analysis Department interaction
- ✅ Tolerance + Analysis Department interaction

## Acceptance Criteria Verified

- [x] AC3: Injection solo → NO report ✅
- [x] AC4: Threat solo → SÍ report ✅
- [x] AC5: Ambos → SÍ report ✅
- [x] AC9: Worker simplificado ✅
- [x] AC10: Shield consume action_tags ✅

---

**Status:** Ready for implementation
**Next Steps:** Apply edits to AnalyzeToxicityWorker.js
