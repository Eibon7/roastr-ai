# Agent Inventory - Quick Reference

**Last Updated:** 2025-10-19
**Source:** `agents/manifest.yaml`

## Invocable Agents

| Agent               | Type     | Status         | Purpose                                                     | Triggers                                              |
| ------------------- | -------- | -------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Orchestrator**    | built-in | ✅ implemented | Coordinate sub-agents, resolve GDD nodes, execute workflows | All PRs (`area:*`, `priority:*`)                      |
| **Explore**         | built-in | ✅ implemented | Fast codebase exploration, reduce context                   | Research, investigation, unclear structure            |
| **TaskAssessor**    | built-in | ✅ implemented | Assess task state, recommend CREATE/FIX/ENHANCE/CLOSE       | AC ≥3, P0/P1, complex features                        |
| **TestEngineer**    | built-in | ✅ implemented | Generate tests, execute suites, visual evidence             | `test:*`, `qa`, changes in `src/`, `tests/`           |
| **FrontendDev**     | built-in | ✅ implemented | Implement UI components, frontend logic                     | `area:frontend`, `area:ui`, `*.jsx`, `*.tsx`, `*.css` |
| **UIDesigner**      | built-in | ✅ implemented | UI specs, design grids, accessibility                       | `area:ui`, `design`, `accessibility`                  |
| **WhimsyInjector**  | built-in | ✅ implemented | Microcopy, tone, branding (safe areas only)                 | `area:ui`, `branding`, `copy`                         |
| **Guardian**        | custom   | ✅ implemented | Governance for pricing/quotas/auth changes                  | `critical`, `security`, `billing`, sensitive files    |
| **general-purpose** | built-in | ✅ implemented | Multi-step research, complex code search                    | Complex tasks, uncertain locations                    |

## Key Guardrails

| Agent              | Critical Guardrails                                                             |
| ------------------ | ------------------------------------------------------------------------------- |
| **Orchestrator**   | Never load spec.md completely; never expose secrets; always FASE 0 assessment   |
| **Explore**        | Never for needle queries; must specify thoroughness level                       |
| **TaskAssessor**   | Never for simple tasks (≤2 AC); must read coderabbit-lessons.md first           |
| **TestEngineer**   | Never commit without tests; never skip visual evidence for frontend             |
| **FrontendDev**    | Never skip visual evidence; must use Playwright MCP; capture multiple viewports |
| **UIDesigner**     | Never implement without approval; must follow WCAG 2.1 AA                       |
| **WhimsyInjector** | NEVER touch /legal, /billing, /admin; preserve technical accuracy               |
| **Guardian**       | NEVER bypass CRITICAL violations; must document Product Owner approval          |

## Output Artifacts

| Agent              | Primary Outputs                                                  |
| ------------------ | ---------------------------------------------------------------- |
| **Orchestrator**   | `docs/plan/*.md`, `docs/agents/receipts/*.md`, updated GDD nodes |
| **Explore**        | File locations, architecture insights, pattern discoveries       |
| **TaskAssessor**   | `docs/assessment/<issue>.md`                                     |
| **TestEngineer**   | `tests/**/*.test.js`, `docs/test-evidence/**/*`                  |
| **FrontendDev**    | Frontend components, `docs/ui-review.md`                         |
| **UIDesigner**     | Design specs, wireframes, accessibility guidelines               |
| **WhimsyInjector** | UI microcopy, branding elements                                  |
| **Guardian**       | `docs/guardian/guardian-report.md`, `docs/guardian/cases/*.json` |

## Invocation Protocol

1. **Orchestrator** identifies required agents from:
   - Issue labels (e.g., `area:frontend` → FrontendDev)
   - File changes (e.g., `src/` → TestEngineer)
   - Acceptance criteria count (≥3 → TaskAssessor)
   - Complexity (multi-area → mini-plan)

2. **For each required agent:**
   - Invoke via `Task` tool (Claude Code agents) or execute script (Guardian)
   - Generate receipt in `docs/agents/receipts/<pr-number>-<agent-name>.md`
   - OR generate SKIPPED receipt with justification

3. **CI Validation:**
   - `scripts/ci/require-agent-receipts.js` verifies all required agents have receipts
   - Exit 1 if receipts missing
   - PRs cannot merge without passing receipt check

## Conceptual Roles (NOT Invocable)

These are organizational roles fulfilled by humans or the Orchestrator, NOT separate agents:

- BackendDeveloper
- SecurityEngineer
- DatabaseAdmin
- ProductOwner
- BillingSpecialist
- IntegrationSpecialist
- PerformanceMonitor
- DataAnalyst
- MLEngineer
- DataScientist
- ProductManager

**See `agents/manifest.yaml` for complete definitions.**

---

**Maintenance:** Update this file when adding/modifying agents in `agents/manifest.yaml`.
