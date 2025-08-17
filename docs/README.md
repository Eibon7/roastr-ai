# Roastr.ai Technical Documentation

Generated from test files on 16/8/2025

## Overview

This documentation is automatically generated from our test suite. It provides a comprehensive view of the system's functionality based on actual test coverage.

## Workers

Background processing workers for the multi-tenant architecture:

- [AnalyzeToxicityWorker](./generated/workers/AnalyzeToxicityWorker.md) - Analyzes comment toxicity using Google Perspective API, OpenAI Moderation API, and pattern-based detection.
- [BaseWorker.healthcheck](./generated/workers/BaseWorker.healthcheck.md) - Worker for processing background jobs in the Roastr.ai system.
- [FetchCommentsWorker](./generated/workers/FetchCommentsWorker.md) - Responsible for fetching comments from various social media platforms including Twitter, YouTube, Instagram, Discord, and others.
- [GenerateReplyWorker](./generated/workers/GenerateReplyWorker.md) - Generates contextual roast responses using OpenAI GPT-4o mini with fallback to template-based responses.
- [ShieldActionWorker](./generated/workers/ShieldActionWorker.md) - Executes Shield protection actions including platform-specific moderation (mute, block, ban) and automated response to high-toxicity content.

## Services

Core services providing business logic:

- [authPasswordRecovery](./generated/services/authPasswordRecovery.md)
- [authService](./generated/services/authService.md)
- [costControl](./generated/services/costControl.md)
- [metricsService](./generated/services/metricsService.md)
- [queueService](./generated/services/queueService.md)
- [roastGeneratorEnhanced](./generated/services/roastGeneratorEnhanced.md)
- [rqcService](./generated/services/rqcService.md)
- [shieldService](./generated/services/shieldService.md)
- [styleProfileGenerator](./generated/services/styleProfileGenerator.md)

## API Routes

REST API endpoints:

- [admin](./generated/routes/admin.md)
- [billing](./generated/routes/billing.md)
- [integrations-new](./generated/routes/integrations-new.md)
- [plan](./generated/routes/plan.md)
- [style-profile](./generated/routes/style-profile.md)
- [user](./generated/routes/user.md)

## Integration Tests

End-to-end workflow tests:

- [adminEndpoints](./generated/integration/adminEndpoints.md)
- [api-simple](./generated/integration/api-simple.md)
- [api](./generated/integration/api.md)
- [authMeEndpoint](./generated/integration/authMeEndpoint.md)
- [authWorkflow](./generated/integration/authWorkflow.md)
- [basic-setup](./generated/integration/basic-setup.md)
- [content-type](./generated/integration/content-type.md)
- [multiTenantWorkflow](./generated/integration/multiTenantWorkflow.md)
- [oauth-mock](./generated/integration/oauth-mock.md)

## Test Coverage Analysis

### Coverage Reports
- [Test Coverage Analysis Report](./test-coverage-analysis.md) - Detailed baseline coverage analysis
- [Test Improvement Plan](./test-improvement-plan.md) - 8-week strategic improvement roadmap
- [Coverage Executive Summary](./coverage-executive-summary.md) - Executive overview with ROI analysis

### Current Coverage Status
- **Overall Coverage**: 28.7%
- **Files Without Tests**: 46/72 (64%)
- **Target Coverage**: 80%
- **Estimated Timeline**: 8 weeks

## Test Coverage Statistics

- Total test files: 29
- Total test cases: 247
- Documentation generated: 2025-08-16T19:28:38.310Z
