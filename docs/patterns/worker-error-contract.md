# Worker Error Contract

Workers built on top of `BaseWorker` communicate retry intent through the
`error.permanent` and `error.retriable` flags. Since **November 2025** the base
class checks these flags _before_ falling back to legacy HTTP status / message
heuristics. This contract allows worker implementations to classify upstream
failures precisely (e.g. 404 from `fetchComment` should fail fast instead of
retrying three times).

## Guidelines

- Use `this.createPermanentError(message, metadata)` to mark non‑recoverable
  failures. The helper sets `error.permanent = true` and `error.retriable = false`.
- Use `this.createRetriableError(message, metadata)` for transient issues that
  should retry regardless of HTTP status.
- When throwing framework or third‑party errors directly, set the flags before
  rethrowing:
  ```js
  error.permanent = true;
  error.retriable = false;
  throw error;
  ```
- `BaseWorker.isRetryableError()` now behaves as:
  1. `permanent === true` → _no retry_.
  2. `retriable === true` → _retry_, even if status is 4xx.
  3. Otherwise, fall back to status/code/pattern heuristics.
- Unit tests should cover both branches to prevent regressions (see
  `tests/unit/workers/BaseWorker.retry-flags.test.js`).

Following this contract keeps retry behaviour consistent across all workers and
prevents queue saturation caused by permanent failures.
