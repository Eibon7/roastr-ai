# Implementation Plan: Issue #487 - Flow Validation: Shield Automated Moderation

**Issue:** #487
**Priority:** P0 (Critical)
**Labels:** `test:e2e`, `area:shield`
**Created:** 2025-10-20
**Author:** Orchestrator Agent

---

## Estado Actual

### ✅ What Exists

**Core Shield Implementation (Issue #408):**
- ShieldService fully implemented with decision logic, action execution, history tracking
- ShieldActionWorker operational with queue-based processing
- Decision matrix implemented (toxicity thresholds + user risk levels)
- Platform integration for 9 platforms (mute, block, report actions)
- 30+ integration test files covering component-level functionality
- Perspective API configured (`PERSPECTIVE_API_KEY`)
- OpenAI fallback configured and operational
- Queue system (Redis/Upstash + Database) operational

**Documentation:**
- `docs/nodes/shield.md` - Comprehensive node documentation (1200+ lines)
- `docs/nodes/guardian.md` - Governance and monitoring layer
- Decision matrix documented and validated

### ❌ What's Missing

**Critical Gaps:**
1. **Validation Script:** `scripts/validate-flow-shield.js` does NOT exist (PRIMARY DELIVERABLE)
2. **Supabase Schema:** `shield_actions` and `user_behavior` tables NOT deployed (🔴 BLOCKER)
3. **Evidence Directory:** `docs/test-evidence/flow-shield/` does NOT exist
4. **VALIDATION.md:** No validation report template or results
5. **E2E Flow Tests:** No integrated flow validation (only component tests exist)
6. **Performance Benchmarks:** No <3s execution time validation
7. **Idempotency Tests:** No duplicate action prevention validation
8. **Dashboard (Optional):** Shield Validation Dashboard does NOT exist

**GDD Concerns:**
- Shield node coverage: 2% (likely outdated - needs auto-repair after test additions)
- No E2E test file references in node documentation
- Low coverage negatively impacts GDD health score (current threshold: ≥87)

---

## Recommendation

**Action:** CREATE (comprehensive E2E validation script)

**Rationale:**
- No existing E2E flow validation exists
- Critical P0 issue for MVP
- Clear deliverables and acceptance criteria (16 AC)
- Blocker resolvable in 1-2 hours
- High value: validates entire Shield moderation pipeline

---

## Critical Blocker Resolution

### 🔴 Blocker: Supabase Schema Not Deployed

**Issue:** `shield_actions` and `user_behavior` tables not found in codebase or deployed database.

**Impact:** Validation script cannot persist Shield actions or track offender history without these tables.

**Resolution Strategy:**

1. **Review Existing Schema** (`database/schema.sql`)
   - Check if Shield tables are defined but not deployed
   - Check if tables exist in Supabase but missing from codebase documentation

2. **Add Shield Tables if Missing:**
   ```sql
   -- shield_actions table
   CREATE TABLE shield_actions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
     user_id UUID REFERENCES users(id) ON DELETE SET NULL,
     platform TEXT NOT NULL,
     account_ref UUID,
     external_comment_id TEXT,
     external_author_id TEXT,
     external_author_username TEXT,
     original_text TEXT,
     toxicity_score NUMERIC(3,2),
     toxicity_labels TEXT[],
     action_taken TEXT NOT NULL,
     action_reason TEXT,
     action_status TEXT DEFAULT 'pending',
     action_details JSONB,
     processed_by TEXT,
     processing_time_ms INTEGER,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- user_behavior table
   CREATE TABLE user_behavior (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
     platform TEXT NOT NULL,
     external_author_id TEXT NOT NULL,
     external_author_username TEXT,
     total_offenses INTEGER DEFAULT 0,
     total_critical INTEGER DEFAULT 0,
     total_high INTEGER DEFAULT 0,
     total_moderate INTEGER DEFAULT 0,
     total_low INTEGER DEFAULT 0,
     average_toxicity NUMERIC(3,2),
     max_toxicity NUMERIC(3,2),
     escalation_level INTEGER DEFAULT 0,
     is_recidivist BOOLEAN DEFAULT FALSE,
     risk_level TEXT,
     recent_actions_summary JSONB,
     first_offense_at TIMESTAMPTZ,
     last_offense_at TIMESTAMPTZ,
     last_action TEXT,
     last_action_at TIMESTAMPTZ,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(organization_id, platform, external_author_id)
   );

   -- Indexes for performance
   CREATE INDEX idx_shield_actions_org_platform ON shield_actions(organization_id, platform);
   CREATE INDEX idx_shield_actions_status ON shield_actions(action_status);
   CREATE INDEX idx_user_behavior_org_platform_author ON user_behavior(organization_id, platform, external_author_id);
   ```

3. **Deploy Schema:**
   ```bash
   node scripts/deploy-supabase-schema.js
   ```

4. **Verify Deployment:**
   ```bash
   # Query Supabase to confirm tables exist
   psql $SUPABASE_URL -c "\dt shield_actions"
   psql $SUPABASE_URL -c "\dt user_behavior"
   ```

**Estimated Time:** 1-2 hours

**Success Criteria:**
- `shield_actions` table exists in Supabase
- `user_behavior` table exists in Supabase
- Test query succeeds: `SELECT count(*) FROM shield_actions;`
- Test query succeeds: `SELECT count(*) FROM user_behavior;`

---

## Implementation Phases

### Phase 1: Foundation (4-5 hours)

**Goal:** Resolve blocker and create basic validation infrastructure

#### Task 1.1: Deploy Supabase Schema (1-2 hours)
**Owner:** Backend Developer Agent

**Steps:**
1. Read `database/schema.sql` to check if Shield tables exist
2. Add `shield_actions` and `user_behavior` tables if missing
3. Deploy schema using `scripts/deploy-supabase-schema.js`
4. Verify tables exist with test queries
5. Document schema changes in `database/CHANGELOG.md`

**Files Affected:**
- `database/schema.sql` (if tables missing)
- `database/CHANGELOG.md`

**Validation:**
```bash
psql $SUPABASE_URL -c "\d shield_actions"
psql $SUPABASE_URL -c "\d user_behavior"
```

---

#### Task 1.2: Create Evidence Infrastructure (15 mins)
**Owner:** Orchestrator

**Steps:**
1. Create directory: `docs/test-evidence/flow-shield/`
2. Add `.gitkeep` to ensure directory is tracked
3. Create `README.md` with evidence file naming convention
4. Document evidence requirements (logs, DB dumps, screenshots, VALIDATION.md)

**Files Created:**
- `docs/test-evidence/flow-shield/.gitkeep`
- `docs/test-evidence/flow-shield/README.md`

**Evidence Naming Convention:**
```
logs-<timestamp>.json           # Execution logs
db-dump-shield-actions-<timestamp>.json
db-dump-user-behavior-<timestamp>.json
metrics-<timestamp>.json        # Performance metrics
VALIDATION.md                   # Validation report
screenshots/                    # Dashboard screenshots (optional)
```

---

#### Task 1.3: Create VALIDATION.md Template (30 mins)
**Owner:** Documentation Agent

**Steps:**
1. Create template: `docs/templates/VALIDATION-template.md`
2. Define sections: Summary, Test Cases, Results, Evidence, Recommendations
3. Add example content for each section

**Files Created:**
- `docs/templates/VALIDATION-template.md`

**Template Structure:**
```markdown
# Flow Validation: Shield Automated Moderation

## Summary
- **Date:** YYYY-MM-DD
- **Issue:** #487
- **Validator:** [Name]
- **Environment:** Development/Staging/Production
- **Overall Result:** PASS/FAIL

## Test Cases Executed
[Table with test ID, scenario, expected result, actual result, status]

## Performance Metrics
[Execution time, API latency, queue processing time]

## Evidence
[Links to logs, DB dumps, screenshots]

## Recommendations
[Next steps, concerns, follow-up actions]
```

---

### Phase 2: Validation Script (4-5 hours)

**Goal:** Create comprehensive E2E validation script

#### Task 2.1: Build Core Validation Script (3 hours)
**Owner:** Test Engineer Agent

**Steps:**
1. Create `scripts/validate-flow-shield.js`
2. Implement test case generation (Decision Matrix: 9 combinations)
3. Add toxicity simulation (Perspective API or mock)
4. Implement flow orchestration:
   - Step 1: Simulate toxic comment detection
   - Step 2: Trigger toxicity analysis (AnalyzeToxicityWorker)
   - Step 3: Invoke ShieldDecisionEngine
   - Step 4: Verify action determination
   - Step 5: Queue Shield action (priority 1)
   - Step 6: Execute action (ShieldActionWorker)
   - Step 7: Persist to `shield_actions` table
   - Step 8: Update `user_behavior` table
5. Add performance timing (track <3s requirement)
6. Add idempotency check (prevent duplicate actions)
7. Implement evidence collection (logs, DB dumps, metrics)

**Files Created:**
- `scripts/validate-flow-shield.js`

**CLI Interface:**
```bash
# Usage examples
node scripts/validate-flow-shield.js --toxicity=0.98
node scripts/validate-flow-shield.js --severity=critical  # ≥0.98
node scripts/validate-flow-shield.js --severity=high     # ≥0.95
node scripts/validate-flow-shield.js --severity=moderate # ≥0.90
node scripts/validate-flow-shield.js --full              # Run all test cases
node scripts/validate-flow-shield.js --dry-run           # Preview without execution
```

**Test Cases to Implement (Decision Matrix):**

| Test ID | Toxicity | User Risk | Expected Action | Platform |
|---------|----------|-----------|----------------|----------|
| DM-01 | 0.98 | Low | Block + Report | Twitter |
| DM-02 | 0.98 | High | Block + Report | YouTube |
| DM-03 | 0.96 | Low | Mute/Timeout | Discord |
| DM-04 | 0.96 | Medium | Mute/Timeout | Instagram |
| DM-05 | 0.96 | High | Block | Reddit |
| DM-06 | 0.91 | Low | Monitor + Roast | Facebook |
| DM-07 | 0.91 | Medium | Monitor + Roast | Twitch |
| DM-08 | 0.91 | High | Mute | TikTok |
| DM-09 | 0.85 | Any | No Action | Bluesky |

**Edge Cases to Test:**

| Test ID | Scenario | Expected Outcome |
|---------|----------|------------------|
| EDGE-01 | Platform API timeout (>5s) | Action marked failed, retry queued |
| EDGE-02 | Duplicate action (same comment ID) | Second action skipped (idempotency) |
| EDGE-03 | Queue priority | Shield actions processed before roast generation |
| EDGE-04 | Database write failure | Transaction rolled back, error logged |
| EDGE-05 | Offender history at threshold | Risk level escalated correctly |
| EDGE-06 | Multiple platforms (same user) | Actions executed independently |

**Total Test Cases:** 15

---

#### Task 2.2: Add Error Handling & Edge Cases (1 hour)
**Owner:** Test Engineer Agent

**Steps:**
1. Add Platform API failure simulation
2. Add Queue priority validation (Shield priority 1 vs roast priority 3)
3. Add Timeout handling (5s API limit)
4. Add Rollback on failure (database transaction)
5. Add Circuit breaker validation (ShieldActionExecutor)

**Error Scenarios:**
- Perspective API failure → OpenAI fallback
- Platform API timeout → Retry with exponential backoff
- Database connection lost → Queue job for retry
- Duplicate action detection → Skip execution, log warning

---

#### Task 2.3: Generate Structured Output (1 hour)
**Owner:** Test Engineer Agent

**Steps:**
1. Export logs to `docs/test-evidence/flow-shield/logs-<timestamp>.json`
2. Generate VALIDATION.md report using template
3. Create DB dump (JSON export of `shield_actions` and `user_behavior`)
4. Add CLI summary output (formatted table)

**Output Example:**
```text
╔═══════════════════════════════════════════════════════════════╗
║         Shield Flow Validation Results                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Test Cases Executed: 15                                       ║
║ Passed: 15                                                    ║
║ Failed: 0                                                     ║
║ Total Execution Time: 2.8s                                    ║
╠═══════════════════════════════════════════════════════════════╣
║ ✅ Decision Matrix (9/9 passed)                               ║
║ ✅ Edge Cases (6/6 passed)                                    ║
║ ✅ Performance (<3s requirement met)                          ║
║ ✅ Idempotency (duplicate actions prevented)                  ║
║ ✅ Queue Priority (Shield priority 1 verified)                ║
╚═══════════════════════════════════════════════════════════════╝

📊 Evidence:
   - Logs: docs/test-evidence/flow-shield/logs-2025-10-20-14-30-25.json
   - DB Dump: docs/test-evidence/flow-shield/db-dump-2025-10-20-14-30-25.json
   - Metrics: docs/test-evidence/flow-shield/metrics-2025-10-20-14-30-25.json
   - Report: docs/test-evidence/flow-shield/VALIDATION.md
```

---

### Phase 3: Evidence & Validation (2-3 hours)

**Goal:** Run validation and collect comprehensive evidence

#### Task 3.1: Execute Full Validation Run (1 hour)
**Owner:** Test Engineer Agent

**Steps:**
1. Run script: `node scripts/validate-flow-shield.js --full`
2. Collect all evidence artifacts
3. Verify all 16 AC are covered
4. Generate performance report (execution time, API latency, queue processing)
5. Take screenshots of database state (if applicable)

**Validation Checklist (16 AC):**
- [ ] AC1: Comment analyzed with toxicity ≥ 0.95
- [ ] AC2: Shield Decision Engine calculates action level correctly
- [ ] AC3: Offender history consulted from `user_behavior` table
- [ ] AC4: Correct action determined (decision matrix)
- [ ] AC5: Action queued in `shield_actions` table with priority 1
- [ ] AC6: ShieldActionWorker processes job without errors
- [ ] AC7: Platform API called (or mock verified)
- [ ] AC8: Action logged with full context
- [ ] AC9: User behavior updated
- [ ] AC10: Execution time < 3 seconds
- [ ] AC11: Decision Matrix validated (6 cases)
- [ ] AC12: No mocks (test against Perspective API + real DB)
- [ ] AC13: Queue priority verified
- [ ] AC14: Error handling (Platform API fail doesn't break flow)
- [ ] AC15: Idempotency (same action not executed twice)
- [ ] AC16: Evidence collected (logs, DB dump, VALIDATION.md)

---

#### Task 3.2: Document Results (1 hour)
**Owner:** Documentation Agent

**Steps:**
1. Complete `docs/test-evidence/flow-shield/VALIDATION.md` with actual results
2. Add decision matrix coverage table (9/9 test cases)
3. Include performance metrics (execution time, API latency, queue processing)
4. List any AC failures or concerns
5. Add recommendations for improvements

**VALIDATION.md Content:**
- Summary (date, validator, environment, result)
- Test Cases Executed (table with 15 rows)
- Performance Metrics (3s requirement, 5s API timeout, 1s queue processing)
- Evidence (links to logs, DB dumps, screenshots)
- Recommendations (next steps, concerns, follow-up)

---

#### Task 3.3: Update GDD Nodes (30 mins)
**Owner:** Orchestrator

**Steps:**
1. Add validation script reference to `docs/nodes/shield.md`
2. Add E2E test file reference to Shield node
3. Update "Agentes Relevantes" if Test Engineer or other agents were invoked
4. Run `npm test -- --coverage` to get updated coverage
5. Run `node scripts/auto-repair-gdd.js --auto-fix` to update coverage automatically
6. Run `node scripts/validate-gdd-runtime.js --full` to verify no violations

**Files Modified:**
- `docs/nodes/shield.md` (add validation script, update coverage)
- `docs/nodes/guardian.md` (if governance was involved)

**GDD Validation:**
```bash
# Update coverage automatically
npm test -- --coverage
node scripts/auto-repair-gdd.js --auto-fix

# Validate GDD health
node scripts/validate-gdd-runtime.js --full
node scripts/compute-gdd-health.js --threshold=87
node scripts/predict-gdd-drift.js --full
```

**Expected Coverage Improvement:**
- Shield node: 2% → >50% (validation script + E2E tests)
- Guardian node: 50% → >60% (if governance validation added)

---

### Phase 4: Dashboard (Optional - 2-3 hours)

**Goal:** Visual monitoring interface (can be deferred to separate PR)

#### Task 4.1: Create Validation Dashboard (2 hours)
**Owner:** Front-end Dev Agent

**Steps:**
1. Create `admin-dashboard/src/pages/ShieldValidationDashboard.jsx`
2. Add components:
   - Severity selector (Critical/High/Moderate)
   - Comment input field
   - Toxicity score display with threshold indicators
   - Decision Engine panel (shows logic applied)
   - Timeline of actions executed
   - User behavior history display
   - Platform API call logs
3. Integrate with validation script (run via API endpoint)
4. Add real-time status updates

**Files Created:**
- `admin-dashboard/src/pages/ShieldValidationDashboard.jsx`
- `admin-dashboard/src/components/ShieldTimeline.jsx` (optional)
- `admin-dashboard/src/components/DecisionEnginePanel.jsx` (optional)

**Dashboard Features:**
- Run validation with custom toxicity scores
- Display decision matrix heatmap
- Show recent Shield actions (last 24h)
- Real-time validation progress
- Export validation report (PDF/JSON)

---

#### Task 4.2: Capture Dashboard Evidence (30 mins)
**Owner:** UI Designer Agent

**Steps:**
1. Use Playwright MCP to capture dashboard screenshots
2. Add screenshots to `docs/test-evidence/flow-shield/screenshots/`
3. Update VALIDATION.md with screenshot references
4. Verify UI matches design specifications

**Playwright Commands:**
```bash
# Launch browser
mcp__playwright__browse http://localhost:3000/admin/shield-validation

# Take screenshot
mcp__playwright__screenshot --fullPage=true --path=docs/test-evidence/flow-shield/screenshots/dashboard-full.png

# Capture specific elements
mcp__playwright__inspect .decision-engine-panel
mcp__playwright__screenshot --path=docs/test-evidence/flow-shield/screenshots/decision-panel.png
```

**Evidence Files:**
- `screenshots/dashboard-full.png` - Full dashboard view
- `screenshots/decision-panel.png` - Decision engine panel
- `screenshots/timeline.png` - Actions timeline
- `screenshots/validation-results.png` - Validation results table

---

## Subagentes Involucrados

| Agent | Phase | Responsibilities |
|-------|-------|------------------|
| **Backend Developer** | 1.1 | Deploy Supabase schema, verify tables exist |
| **Test Engineer** | 2.1, 2.2, 2.3, 3.1 | Build validation script, implement test cases, execute validation |
| **Documentation Agent** | 1.3, 3.2 | Create VALIDATION.md template, document results |
| **Orchestrator** | 1.2, 3.3 | Create evidence infrastructure, update GDD nodes, coordinate workflow |
| **Front-end Dev** (Optional) | 4.1 | Create Shield Validation Dashboard |
| **UI Designer** (Optional) | 4.2 | Capture dashboard screenshots with Playwright |

---

## Archivos Afectados

### Created (New Files)
- `scripts/validate-flow-shield.js` - Main validation script
- `docs/test-evidence/flow-shield/.gitkeep` - Evidence directory
- `docs/test-evidence/flow-shield/README.md` - Evidence documentation
- `docs/test-evidence/flow-shield/VALIDATION.md` - Validation report
- `docs/test-evidence/flow-shield/logs-*.json` - Execution logs
- `docs/test-evidence/flow-shield/db-dump-*.json` - Database dumps
- `docs/test-evidence/flow-shield/metrics-*.json` - Performance metrics
- `docs/templates/VALIDATION-template.md` - Reusable validation template
- `admin-dashboard/src/pages/ShieldValidationDashboard.jsx` (Optional)

### Modified (Existing Files)
- `database/schema.sql` - Add Shield tables if missing
- `database/CHANGELOG.md` - Document schema changes
- `docs/nodes/shield.md` - Add validation script reference, update coverage
- `docs/nodes/guardian.md` - Update if governance validation added
- `package.json` - Add validation script to `scripts` section (optional)

### Read-Only (Reference)
- `src/services/shieldService.js` - Shield core logic
- `src/workers/ShieldActionWorker.js` - Action execution worker
- `src/services/queueService.js` - Queue management
- `src/integrations/<platform>/<platform>Service.js` - Platform adapters
- `config/product-guard.yaml` - Guardian configuration
- `docs/patterns/coderabbit-lessons.md` - Code quality patterns

---

## Criterios de Validación

### Functional Validation (6 AC)
1. ✅ **Toxicity Detection:** Comment with score ≥0.95 triggers Shield
2. ✅ **Decision Accuracy:** ShieldDecisionEngine calculates correct action level
3. ✅ **History Check:** Offender history consulted from `user_behavior` table
4. ✅ **Action Determination:** Correct action based on decision matrix
5. ✅ **Queue Persistence:** Action queued in `shield_actions` with priority 1
6. ✅ **Worker Execution:** ShieldActionWorker processes job without errors

### Technical Validation (4 AC)
7. ✅ **Platform API Call:** API called or mock verified
8. ✅ **Action Logging:** Full context logged in `shield_actions` table
9. ✅ **User Tracking:** `user_behavior` table updated correctly
10. ✅ **No Mocks:** Test against Perspective API + real DB

### Performance Validation (3 AC)
11. ✅ **Execution Time:** Total flow completes in <3 seconds
12. ✅ **API Timeout:** Platform API timeout set to 5 seconds
13. ✅ **Queue Processing:** Shield jobs processed in <1 second

### Evidence Validation (3 AC)
14. ✅ **Logs Exported:** Execution logs saved to evidence directory
15. ✅ **DB Dump:** Database state captured (shield_actions + user_behavior)
16. ✅ **VALIDATION.md:** Complete validation report generated

### Code Quality Validation
17. ✅ **ESLint Passing:** No semicolons, const/let rules, no console.log
18. ✅ **Security:** No hardcoded credentials, input validation
19. ✅ **Error Handling:** Platform API failures don't break flow
20. ✅ **Idempotency:** Duplicate actions prevented

### GDD Validation
21. ✅ **Coverage Authenticity:** Coverage Source: auto (NEVER manual)
22. ✅ **Health Score:** ≥87 (temp threshold until 2025-10-31)
23. ✅ **Drift Risk:** <60
24. ✅ **Node Updates:** shield.md + guardian.md updated with validation references

---

## Success Criteria (Pre-Merge)

**Code Deliverables:**
- [ ] `scripts/validate-flow-shield.js` created and executable
- [ ] All 15 test cases passing (9 decision matrix + 6 edge cases)
- [ ] Performance requirements met (<3s, <5s, <1s)
- [ ] Idempotency verified (duplicate actions prevented)
- [ ] Error handling tested (Platform API failures gracefully handled)

**Evidence Deliverables:**
- [ ] `docs/test-evidence/flow-shield/` directory created
- [ ] Execution logs exported (logs-*.json)
- [ ] DB dumps captured (db-dump-*.json)
- [ ] Performance metrics collected (metrics-*.json)
- [ ] VALIDATION.md report completed with all sections

**Database Deliverables:**
- [ ] Supabase schema deployed (`shield_actions` + `user_behavior` tables exist)
- [ ] Test queries succeed (SELECT count(*) FROM shield_actions)
- [ ] RLS policies applied (organization isolation)

**Documentation Deliverables:**
- [ ] `docs/nodes/shield.md` updated (validation script reference, coverage)
- [ ] `docs/nodes/guardian.md` updated (if applicable)
- [ ] `docs/templates/VALIDATION-template.md` created for reuse
- [ ] All 16 AC validated and documented

**GDD Deliverables:**
- [ ] Coverage updated via auto-repair (shield >50%, guardian >60%)
- [ ] GDD health ≥87 (passing threshold)
- [ ] GDD drift <60 (low risk)
- [ ] All GDD validation scripts passing

**Code Quality Deliverables:**
- [ ] ESLint passing (semicolons, const/let, no console.log)
- [ ] Security validated (no hardcoded credentials)
- [ ] CodeRabbit self-review completed (0 expected comments)
- [ ] Pre-Flight Checklist executed

**CI/CD Deliverables:**
- [ ] All tests passing (178/178 + new validation script)
- [ ] Coverage report generated
- [ ] No regressions introduced
- [ ] PR ready for review

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 1: Foundation** | 4-5 hours | None (can start immediately) |
| - Deploy Supabase Schema | 1-2 hours | Blocker resolution |
| - Create Evidence Infrastructure | 15 mins | None |
| - Create VALIDATION.md Template | 30 mins | None |
| **Phase 2: Validation Script** | 4-5 hours | Supabase schema deployed |
| - Build Core Script | 3 hours | Phase 1.1 complete |
| - Add Error Handling | 1 hour | Phase 2.1 complete |
| - Generate Structured Output | 1 hour | Phase 2.2 complete |
| **Phase 3: Evidence & Validation** | 2-3 hours | Validation script complete |
| - Execute Validation Run | 1 hour | Phase 2 complete |
| - Document Results | 1 hour | Phase 3.1 complete |
| - Update GDD Nodes | 30 mins | Phase 3.2 complete |
| **Phase 4: Dashboard (Optional)** | 2-3 hours | Can run in parallel or defer |
| - Create Dashboard | 2 hours | None (independent) |
| - Capture Evidence | 30 mins | Phase 4.1 complete |
| **TOTAL (P0 only)** | **10-13 hours** | - |
| **TOTAL (with dashboard)** | **12-16 hours** | - |

**Critical Path:** Phase 1.1 (Supabase schema) → Phase 2 → Phase 3

**Parallelization Opportunities:**
- Phase 1.2 and 1.3 can run in parallel with 1.1
- Phase 4 (Dashboard) can be deferred to separate PR or developed in parallel

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Supabase schema deploy fails** | High - Blocks all work | Review schema carefully, test locally first, have rollback plan |
| **Platform API rate limits** | Medium - Test failures | Use test accounts, implement rate limit backoff, mock APIs if needed |
| **Performance requirement not met (<3s)** | Medium - AC failure | Optimize code, separate network time from processing time, document results |
| **Evidence collection complexity** | Low - Time overrun | Start with CLI evidence, defer dashboard to Phase 4 |
| **Test data generation** | Low - Incomplete coverage | Use programmatic test case generation, validate all matrix combinations |

---

## Next Steps (Immediate Actions)

### 1. Resolve Blocker (1-2 hours)
```bash
# Review existing schema
cat database/schema.sql | grep -A 30 "shield_actions\|user_behavior"

# If missing, add tables to schema.sql
# Then deploy
node scripts/deploy-supabase-schema.js

# Verify deployment
psql $SUPABASE_URL -c "\dt shield_actions"
```

### 2. Create Evidence Infrastructure (15 mins)
```bash
mkdir -p docs/test-evidence/flow-shield
touch docs/test-evidence/flow-shield/.gitkeep
echo "# Shield Flow Validation Evidence" > docs/test-evidence/flow-shield/README.md
```

### 3. Start Validation Script Development (3-4 hours)
```bash
# Create script file
touch scripts/validate-flow-shield.js

# Implement core functionality (see Phase 2 details)
```

---

## Related Issues & Documentation

**Issues:**
- #408 - Shield Implementation (✅ Closed) - Foundation
- #480 - Test Suite Stabilization (🔄 Open) - Related effort
- #482 - Shield Test Suite (🔄 Open) - Component tests

**Documentation:**
- `docs/assessment/issue-487.md` - Full assessment (created by Task Assessor)
- `docs/nodes/shield.md` - Shield node documentation
- `docs/nodes/guardian.md` - Guardian node documentation
- `docs/patterns/coderabbit-lessons.md` - Code quality patterns
- `docs/QUALITY-STANDARDS.md` - Pre-merge requirements

**Scripts:**
- `scripts/deploy-supabase-schema.js` - Schema deployment
- `scripts/validate-gdd-runtime.js` - GDD validation
- `scripts/auto-repair-gdd.js` - Coverage auto-repair
- `scripts/compute-gdd-health.js` - Health score calculation

---

**Plan Created:** 2025-10-20
**Author:** Orchestrator Agent
**Next Review:** After Phase 1 completion (blocker resolved)
**Estimated Completion:** 2025-10-21 (assuming 10-13 hours of focused work)
