# clipper-core development log

This file records implementation milestones, problems, root causes, and fixes during
development of `clipper-core`.

Purpose:

- Keep technical history separate from `README.md`.
- Make future standalone carve-out easier by preserving engineering context.
- Document decisions that affect API stability, testing, and runtime behavior.

## 2026-03: Self-contained package foundation

### Context

Built a reusable clipping package under `packages/clipper-core` with vendored core logic
to avoid direct runtime dependency on the parent extension package.

### Key work

- Added `ClipperCore` with URL/HTML/template entry points.
- Vendored clipping engine and utilities into `src/vendor`.
- Added Node runtime compatibility polyfills required by extraction stack.

### Outcome

- Package can run locally outside browser extension context.

## 2026-03: Stage A/B adaptive auto pipeline

### Context

Need performance and quality balance: do not always render in browser, but support sites
that fail lightweight extraction.

### Key work

- Added `clipFromUrlAuto()` and modular `src/auto/*` components:
  - `quality.ts`
  - `router.ts`
  - `policy-store.ts`
  - `pipeline.ts`
  - `adapters/playwright.ts`
  - `types.ts`
- Added contracts for `PolicyStore`, `RendererAdapter`, thresholds, and trace.

### Outcome

- Stage A fast path runs first; Stage B fallback triggers only when needed.
- Domain policy and thresholds are configurable for tuning and UI integration.

## 2026-03: Testing layers

### Context

Need confidence across logic correctness, contract stability, and real runtime behavior.

### Key work

- Unit tests: `tests/unit/*.test.cjs`
- Contract tests: `tests/contract/*.test.cjs`
- E2E tests: `tests/e2e/*.test.cjs`
- Optional real Playwright integration test:
  - `tests/integration/playwright-adapter.integration.test.cjs`
  - run with `RUN_PLAYWRIGHT_INTEGRATION=1 npm run test:integration:playwright`

### Outcome

- Full baseline coverage exists for current architecture.

## 2026-03: Local visualization UI

### Context

Need an operator-friendly interface for URL input, extraction trace visibility, and output handling.

### Key work

- Added `ui/server.js` + `ui/index.html`.
- Added controls for URL, thresholds, auto mode, and template JSON.
- Added procedure timeline, metadata output option, copy, and download actions.

### Outcome

- Faster manual testing and debugging without custom scripts.

## 2026-03: Runtime issues and fixes

### Issue: port already in use (`EADDRINUSE`)

- **Root cause:** existing UI process still listening on `127.0.0.1:3040`.
- **Fix:** added friendly server error message and alternate-port guidance.

### Issue: UI showed `Failed to fetch`

- **Root cause:** server crashed during Stage B Playwright lifecycle race
  (`page.content` while page/context was closing).
- **Fix:** hardened Playwright adapter close flow and wrapped server request
  handling with top-level `try/catch` to return JSON error instead of crashing.

### Issue: unsafe timeline rendering and metadata formatting

- **Root cause:** dynamic `innerHTML` usage and unescaped metadata output.
- **Fix:** switched to `textContent` DOM rendering and escaped/quoted metadata fields.

## 2026-03: Repo hygiene

- Ignored runtime cache: `packages/clipper-core/ui/.data/`
- Ignored generated example outputs: `packages/clipper-core/examples/output/*.md`

## 2026-03: Distribution policy decision

### Decision

- Adopted **library-first npm distribution** for carve-out path.
- Publish target remains `dist/` only.
- Keep UI/examples/tests/docs as repository-level development assets.

### Playwright strategy

- Stage A requires no Playwright.
- Stage B requires Playwright runtime installation by consumer.
- Keep `playwright` as optional peer dependency for consumers and dev dependency for local UI/tests.

### Rationale

- Improves reuse by keeping package footprint minimal for non-rendering consumers.
- Keeps rendered fallback available when explicitly needed.
- Reduces ambiguity before standalone repository split.

## 2026-03: CI gate added for carve-out readiness

### Key work

- Added dedicated GitHub Actions workflow:
  - `.github/workflows/clipper-core-ci.yml`
- Workflow runs on clipper-core related changes and includes:
  - clean install (`npm ci`)
  - build (`npm run build`)
  - tests (`npm test`)
  - optional Playwright integration test job via manual dispatch input

### Outcome

- Clean-checkout validation is now automated for `clipper-core`.

## Carve-out readiness notes

When moving `clipper-core` to a standalone repository, prioritize:

1. API freeze for `clipFromUrlAuto` and trace contract.
2. Clean CI with unit/contract/E2E and optional Playwright integration.
3. Carry over docs:
   - `README.md`
   - `docs/extraction-plan.md`
   - `docs/development-log.md`
4. Ensure no hidden dependencies on files outside `packages/clipper-core`.

