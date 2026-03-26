# clipper-core carve-out go/no-go summary

Last updated: 2026-03

## Decision (current)

- **Recommendation:** **No-Go (temporary)** for immediate standalone split.
- **Reason:** Technical foundation is strong; only the API stability process gate remains.

## Completed gates

- Correctness and robustness
  - JSON policy store is concurrency-safe.
  - Stage B runtime lifecycle no longer crashes local API server.
  - Runtime capability checks expose Stage B availability.
- API and contract stability
  - `DecisionTrace` is versioned (`traceVersion` / `DECISION_TRACE_VERSION`).
  - Contract tests cover core router/evaluator/store/pipeline boundaries.
- Packaging decision
  - Distribution mode fixed to library-first publish (`dist` only).
  - Playwright strategy explicitly documented.
- Documentation
  - `README.md` and `development-log.md` are aligned with latest implementation.

## Remaining blockers

1. **API stability window (process gate)**
   - `clipFromUrlAuto` contract should remain stable across two iterations.

## Evidence from current audit

- Clean-install run completed locally with:
  - `npm ci`
  - `npm run build`
  - `npm test`
- Unit, contract, and E2E tests all passed.
- No hidden dependency references to parent repo paths were found.

## Next-step plan to reach Go

1. Hold API freeze window for 1-2 iterations:
   - no breaking changes to `clipFromUrlAuto`/trace shape.
2. Re-run checklist and mark final Go.

Use:

- `docs/api-freeze-checklist.md`

