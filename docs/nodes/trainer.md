# Trainer - AI Model Fine-Tuning & Custom Style Training

**Node ID:** `trainer`
**Owner:** Back-end Dev
**Priority:** Planned
**Status:** Roadmap
**Last Updated:** 2025-10-06
**Coverage:** 0%
**Coverage Source:** auto
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%
**Coverage:** 50%

## Dependencies

- `roast` - Training data from generated roasts
- `persona` - User style profiles for personalization
- `plan-features` - Plus plan feature gate (custom models)

## Overview

Trainer provides AI model fine-tuning capabilities for organization-specific roast generation styles. It enables Plus plan users to train custom GPT models based on their roast history, persona preferences, and approved examples, creating unique brand voices.

### Key Capabilities

1. **Custom Model Training** - Fine-tune GPT-4o on organization roast history
2. **Style Transfer Learning** - Train from approved roast examples
3. **Persona-Based Training** - Incorporate user identity and preferences
4. **A/B Testing** - Compare custom models vs. base model performance
5. **Continuous Learning** - Incrementally improve models with feedback
6. **Cost Optimization** - Train smaller, faster models for specific use cases

## Architecture

### Training Data Pipeline

```
Approved Roasts → Data Collection → Preprocessing → Fine-Tuning → Model Deployment
     ↓                  ↓                ↓               ↓               ↓
Feedback Loop ← Performance Metrics ← A/B Testing ← Validation ← Training Job
```

### Training Tables

**Table:** `training_datasets`

```sql
CREATE TABLE training_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Dataset details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Training data
  roast_count INTEGER DEFAULT 0,
  min_quality_score DECIMAL(3,2) DEFAULT 0.7, -- Only use high-quality roasts
  include_persona BOOLEAN DEFAULT TRUE,
  include_platform_context BOOLEAN DEFAULT TRUE,

  -- Training parameters
  training_params JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'preparing', -- preparing, ready, training, failed
  prepared_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT training_datasets_status_check CHECK (
    status IN ('preparing', 'ready', 'training', 'completed', 'failed')
  )
);
```

**Table:** `custom_models`

```sql
CREATE TABLE custom_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Model details
  name VARCHAR(255) NOT NULL,
  base_model VARCHAR(50) NOT NULL, -- gpt-4o, gpt-4o-mini
  fine_tuned_model_id VARCHAR(255), -- OpenAI fine-tuned model ID

  -- Training info
  training_dataset_id UUID REFERENCES training_datasets(id),
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  training_duration_seconds INTEGER,

  -- Training metrics
  training_loss DECIMAL(6,4),
  validation_loss DECIMAL(6,4),
  training_examples INTEGER,

  -- Performance metrics
  avg_response_time_ms INTEGER,
  quality_score DECIMAL(3,2), -- Average RQC score
  user_approval_rate DECIMAL(3,2), -- % of roasts approved by user

  -- Deployment
  is_active BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,

  -- Costs
  training_cost_cents INTEGER,
  inference_cost_per_roast_cents INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT custom_models_base_check CHECK (
    base_model IN ('gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo')
  )
);
```

**Table:** `model_feedback`

```sql
CREATE TABLE model_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  custom_model_id UUID REFERENCES custom_models(id),
  response_id UUID REFERENCES responses(id),

  -- Feedback
  feedback_type VARCHAR(20) NOT NULL, -- approved, rejected, edited
  original_roast TEXT,
  edited_roast TEXT, -- If user edited before approving

  -- Quality metrics
  quality_score DECIMAL(3,2),
  tone_match BOOLEAN, -- Did tone match user preference?
  humor_effectiveness DECIMAL(3,2), -- User rating 0.0-1.0

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT model_feedback_type_check CHECK (
    feedback_type IN ('approved', 'rejected', 'edited', 'regenerated')
  )
);
```

## Training Workflow

### 1. Prepare Training Dataset

```javascript
const { TrainingService } = require('./services/training');

async function prepareTrainingDataset(organizationId, config) {
  // Fetch high-quality roasts from history
  const { data: approvedRoasts } = await supabase
    .from('responses')
    .select(`
      *,
      comments(original_text, platform, toxicity_score),
      roast_metadata(rqc_score, quality_metrics)
    `)
    .eq('organization_id', organizationId)
    .gte('roast_metadata.rqc_score', config.minQualityScore || 0.7)
    .order('created_at', { ascending: false })
    .limit(1000); // Minimum for fine-tuning

  if (approvedRoasts.length < 100) {
    throw new Error('Insufficient training data. Need at least 100 high-quality roasts.');
  }

  // Get persona data
  const { data: persona } = await supabase
    .from('roastr_persona')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  // Format training examples
  const trainingExamples = approvedRoasts.map(roast => ({
    messages: [
      {
        role: 'system',
        content: buildPersonaSystemPrompt(persona)
      },
      {
        role: 'user',
        content: `Generate a roast for this comment: "${roast.comments.original_text}"`
      },
      {
        role: 'assistant',
        content: roast.response_text
      }
    ]
  }));

  // Create dataset
  const { data: dataset } = await supabase
    .from('training_datasets')
    .insert({
      organization_id: organizationId,
      name: `Training Dataset ${new Date().toISOString()}`,
      roast_count: trainingExamples.length,
      min_quality_score: config.minQualityScore,
      training_params: {
        examples: trainingExamples,
        base_model: config.baseModel || 'gpt-4o',
        epochs: config.epochs || 3,
        learning_rate_multiplier: config.learningRate || 0.1
      },
      status: 'ready'
    })
    .select()
    .single();

  return dataset;
}
```

### 2. Submit Fine-Tuning Job

```javascript
const { OpenAI } = require('openai');

async function submitFineTuningJob(datasetId) {
  const { data: dataset } = await supabase
    .from('training_datasets')
    .select('*')
    .eq('id', datasetId)
    .single();

  // Upload training file to OpenAI
  const trainingFile = await openai.files.create({
    file: createJSONLFile(dataset.training_params.examples),
    purpose: 'fine-tune'
  });

  // Create fine-tuning job
  const fineTuningJob = await openai.fineTuning.jobs.create({
    training_file: trainingFile.id,
    model: dataset.training_params.base_model,
    hyperparameters: {
      n_epochs: dataset.training_params.epochs,
      learning_rate_multiplier: dataset.training_params.learning_rate_multiplier
    }
  });

  // Create custom model record
  const { data: customModel } = await supabase
    .from('custom_models')
    .insert({
      organization_id: dataset.organization_id,
      name: `Custom Model ${new Date().toISOString()}`,
      base_model: dataset.training_params.base_model,
      fine_tuned_model_id: fineTuningJob.id,
      training_dataset_id: datasetId,
      training_started_at: new Date().toISOString(),
      training_examples: dataset.roast_count
    })
    .select()
    .single();

  // Update dataset status
  await supabase
    .from('training_datasets')
    .update({ status: 'training' })
    .eq('id', datasetId);

  return { customModel, fineTuningJob };
}
```

### 3. Monitor Training Progress

```javascript
async function monitorTrainingJob(customModelId) {
  const { data: model } = await supabase
    .from('custom_models')
    .select('*')
    .eq('id', customModelId)
    .single();

  // Check OpenAI job status
  const job = await openai.fineTuning.jobs.retrieve(model.fine_tuned_model_id);

  if (job.status === 'succeeded') {
    // Update model with results
    await supabase
      .from('custom_models')
      .update({
        fine_tuned_model_id: job.fine_tuned_model,
        training_completed_at: new Date().toISOString(),
        training_duration_seconds: Math.floor((Date.now() - new Date(model.training_started_at)) / 1000),
        training_loss: job.trained_tokens ? job.training_loss : null,
        validation_loss: job.validation_loss,
        training_cost_cents: calculateTrainingCost(job),
        is_active: true,
        deployed_at: new Date().toISOString()
      })
      .eq('id', customModelId);

    // Notify organization
    await sendTrainingCompleteNotification(model.organization_id, customModelId);

  } else if (job.status === 'failed') {
    await supabase
      .from('custom_models')
      .update({ is_active: false })
      .eq('id', customModelId);

    await sendTrainingFailedNotification(model.organization_id, job.error);
  }

  return job;
}
```

### 4. Use Custom Model for Generation

```javascript
async function generateRoastWithCustomModel(commentId) {
  const { data: comment } = await supabase
    .from('comments')
    .select('*, organizations(*)')
    .eq('id', commentId)
    .single();

  // Get active custom model for organization
  const { data: customModel } = await supabase
    .from('custom_models')
    .select('*')
    .eq('organization_id', comment.organization_id)
    .eq('is_active', true)
    .order('deployed_at', { ascending: false })
    .limit(1)
    .single();

  if (!customModel) {
    // Fallback to base model
    return generateRoastWithBaseModel(commentId);
  }

  // Generate roast with custom model
  const completion = await openai.chat.completions.create({
    model: customModel.fine_tuned_model_id,
    messages: [
      { role: 'system', content: getPersonaSystemPrompt(comment.organization_id) },
      { role: 'user', content: `Generate a roast for: "${comment.original_text}"` }
    ],
    temperature: 0.8,
    max_tokens: 200
  });

  const roastText = completion.choices[0].message.content;

  // Record inference cost
  await updateModelInferenceCost(customModel.id, calculateInferenceCost(completion));

  return roastText;
}
```

### 5. Collect Feedback & Retrain

```javascript
async function collectFeedback(responseId, feedback) {
  const { data: response } = await supabase
    .from('responses')
    .select('*, roast_metadata(*)')
    .eq('id', responseId)
    .single();

  // Get custom model used
  const { data: customModel } = await supabase
    .from('custom_models')
    .select('*')
    .eq('organization_id', response.organization_id)
    .eq('is_active', true)
    .single();

  // Store feedback
  await supabase.from('model_feedback').insert({
    organization_id: response.organization_id,
    custom_model_id: customModel.id,
    response_id: responseId,
    feedback_type: feedback.type, // approved, rejected, edited
    original_roast: response.response_text,
    edited_roast: feedback.editedText,
    quality_score: response.roast_metadata.rqc_score,
    tone_match: feedback.toneMatch,
    humor_effectiveness: feedback.rating
  });

  // Update model approval rate
  await updateModelApprovalRate(customModel.id);

  // Check if retraining threshold reached
  const feedbackCount = await getFeedbackCount(customModel.id);
  if (feedbackCount >= 100) { // Retrain every 100 feedback samples
    await scheduleRetraining(customModel.id);
  }
}
```

## A/B Testing

### Compare Custom vs. Base Model

```javascript
async function runABTest(organizationId, duration = 7) {
  // Enable A/B test
  await supabase.from('custom_models').update({
    ab_test_enabled: true,
    ab_test_started_at: new Date().toISOString(),
    ab_test_duration_days: duration
  }).eq('organization_id', organizationId).eq('is_active', true);

  // For each roast request, randomly select model
  const useCustomModel = Math.random() < 0.5;

  // Track metrics separately
  await supabase.from('ab_test_metrics').insert({
    organization_id: organizationId,
    model_type: useCustomModel ? 'custom' : 'base',
    response_id: responseId,
    quality_score: rqcScore,
    user_approval: approved,
    response_time_ms: responseTime
  });

  // After test duration, analyze results
  setTimeout(async () => {
    const results = await analyzeABTestResults(organizationId);
    await notifyABTestComplete(organizationId, results);
  }, duration * 24 * 60 * 60 * 1000);
}
```

## Cost Analysis

### Training Costs

```javascript
function calculateTrainingCost(fineTuningJob) {
  // OpenAI fine-tuning pricing (as of 2025)
  const costPerToken = {
    'gpt-4o': 0.000025, // $0.025 per 1K tokens
    'gpt-4o-mini': 0.000003, // $0.003 per 1K tokens
  };

  const baseModel = fineTuningJob.model;
  const tokensUsed = fineTuningJob.trained_tokens || 0;
  const costCents = (tokensUsed / 1000) * costPerToken[baseModel] * 100;

  return Math.ceil(costCents);
}
```

### Inference Cost Comparison

```javascript
async function compareInferenceCosts(organizationId) {
  const { data: customModel } = await supabase
    .from('custom_models')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single();

  // Get usage over last 30 days
  const { data: responses } = await supabase
    .from('responses')
    .select('cost_cents, tokens_used')
    .eq('organization_id', organizationId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const totalCost = responses.reduce((sum, r) => sum + r.cost_cents, 0);
  const totalTokens = responses.reduce((sum, r) => sum + r.tokens_used, 0);

  // Project cost with custom model (usually higher per token but fewer retries)
  const customModelCost = customModel.inference_cost_per_roast_cents * responses.length;

  return {
    baseCost: totalCost,
    customCost: customModelCost,
    savings: totalCost - customModelCost,
    savingsPercent: ((totalCost - customModelCost) / totalCost) * 100
  };
}
```

## Testing

### Unit Tests

```javascript
describe('TrainingService', () => {
  test('prepares training dataset with sufficient examples', async () => {
    const dataset = await trainingService.prepareTrainingDataset(orgId, {
      minQualityScore: 0.8,
      baseModel: 'gpt-4o'
    });

    expect(dataset.roast_count).toBeGreaterThanOrEqual(100);
    expect(dataset.status).toBe('ready');
  });

  test('rejects dataset with insufficient examples', async () => {
    await expect(
      trainingService.prepareTrainingDataset(newOrgId, {})
    ).rejects.toThrow('Insufficient training data');
  });

  test('calculates training cost correctly', () => {
    const cost = calculateTrainingCost({
      model: 'gpt-4o',
      trained_tokens: 1000000 // 1M tokens
    });

    expect(cost).toBe(2500); // $25.00 in cents
  });
});
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Insufficient training data` | < 100 high-quality roasts | Continue using base model until more data available |
| `Training job failed` | OpenAI service error | Retry with lower learning rate |
| `Model deployment failed` | Invalid model ID | Verify fine-tuning job completed |
| `Plan restriction` | Not on Plus plan | Upgrade to Plus plan for custom models |
| `Cost limit exceeded` | Training cost > budget | Reduce training examples or use smaller base model |

## Monitoring & Alerts

### Key Metrics

- **Models trained** - Total custom models created
- **Training success rate** - % of jobs that complete successfully
- **Average training time** - Time to complete fine-tuning
- **Model approval rate** - % of custom model roasts approved by users
- **A/B test wins** - Custom model vs. base model performance

### Grafana Dashboard

```javascript
{
  models_trained: { type: 'counter', value: 45 },
  training_success_rate: { type: 'gauge', value: 0.92 },
  avg_training_time_hours: { type: 'gauge', value: 2.5 },
  custom_model_approval_rate: { type: 'gauge', value: 0.88 },
  ab_test_custom_wins: { type: 'gauge', value: 0.67 }
}
```


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Backend Developer**
- **ML Engineer**
- **Data Scientist**


## Related Nodes

- **roast** - Source of training data (approved roasts)
- **persona** - Persona data for personalized training
- **plan-features** - Plus plan required for custom models
- **cost-control** - Training and inference cost tracking

---

## Tests

### Ubicación de Tests

**Unit Tests** (2 archivos):
- `tests/unit/csvRoastService.test.js` - CSV roast reference system (full tests)
- `tests/unit/csvRoastService-simple.test.js` - Simplified CSV tests

**Test Data**:
- `tests/data/roasts_test.csv` - Sample CSV data for testing

### Cobertura de Tests

- **CSV Roast Service**: ~60% coverage (basic functionality tested)
- **Test Data**: Sample CSV with various roast categories
- **Integration**: Falta integration con roast generation

### Casos de Prueba Cubiertos

**CSV Roast System (Current Implementation):**
- ✅ CSV file loading and parsing
- ✅ Roast retrieval by category
- ✅ Random roast selection
- ✅ Category matching logic
- ✅ Error handling for missing files
- ✅ Edge cases (empty CSV, invalid format)

**Current Functionality:**
- ✅ Reference roast database (CSV-based)
- ✅ Category-based roast lookup
- ✅ Integration with roast generator (basic)

### Tests Pendientes (Trainer Roadmap)

**Feedback Loop (Phase 2):**
- [ ] User rating collection tests
- [ ] Rating validation (1-5 stars)
- [ ] Organization-scoped feedback storage
- [ ] Aggregated rating queries

**Quality Metrics (Phase 3):**
- [ ] Quality score calculation tests
- [ ] Low-quality roast detection
- [ ] Variant comparison tests
- [ ] A/B testing framework tests

**Fine-tuning System (Phase 4-5):**
- [ ] Training data generation tests
- [ ] Fine-tuning job creation tests
- [ ] Model versioning tests
- [ ] Rollout strategy tests (canary, blue-green)
- [ ] Performance regression detection

**Auto-Improvement (Phase 6-7):**
- [ ] Variant generation tests
- [ ] Automatic retraining trigger tests
- [ ] Quality improvement validation
- [ ] Drift detection tests

### Comandos de Test

```bash
# Run CSV roast service tests
npm test -- csvRoastService

# Run simple tests
npm test -- csvRoastService-simple

# Run specific test file
npm test -- tests/unit/csvRoastService.test.js
```

### Roadmap de Testing

**Fase 1 (Current)**: CSV Roast Reference System
- Status: ✅ Básico implementado, 60% coverage

**Fase 2**: Feedback Loop
- Status: ⏳ Pendiente
- Tests needed: User rating collection, validation, storage

**Fase 3**: Quality Metrics
- Status: ⏳ Pendiente
- Tests needed: Quality scoring, low-quality detection

**Fase 4**: Fine-tuning System
- Status: ⏳ Pendiente
- Tests needed: Training data, fine-tuning jobs, model versioning

**Fase 5-7**: Auto-Improvement
- Status: ⏳ Pendiente
- Tests needed: Variant generation, retraining triggers, drift detection

### Notas

El nodo **trainer** está en fase de roadmap. La cobertura actual (50-60%) refleja solo la funcionalidad CSV básica implementada. El sistema completo de fine-tuning y auto-improvement requiere tests adicionales que se implementarán en fases futuras.

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Quarterly or on feature prioritization
**Last Reviewed:** 2025-10-06
**Version:** 1.0.0 (Roadmap)
