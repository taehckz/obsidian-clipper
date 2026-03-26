# clipper-core carve-out go/no-go summary

Last updated: 2026-03

## Decision (current)

- **Recommendation:** **Go** for standalone split planning.
- **Reason:** Technical and process gates are complete, including two-pass API stability window and green CI.

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

- None blocking the carve-out gate at this stage.

## Evidence from current audit

- Clean-install run completed locally with:
  - `npm ci`
  - `npm run build`
  - `npm test`
- Unit, contract, and E2E tests all passed.
- API freeze checklist now records two consecutive PASS iterations.
- GitHub Actions `clipper-core ci` run #3 is green on commit `042615b`.
- No hidden dependency references to parent repo paths were found.

## Next-step plan after Go

1. Bootstrap standalone repository from `packages/clipper-core`.
2. Copy CI workflow and verify clean checkout in the new repository.
3. Run first consumer integration cycle before tagging stable release.

Use:

- `docs/api-freeze-checklist.md`

