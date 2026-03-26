# clipper-core API freeze checklist

Use this checklist during the next 1-2 iterations to confirm API stability before standalone carve-out.

## Scope

Primary freeze targets:

- `clipFromUrlAuto` input options
- `clipFromUrlAuto` result shape
- `DecisionTrace` schema (`traceVersion`)

Glossary:

- CI = Continuous Integration (automated clean-environment build/test checks, e.g. GitHub Actions).

## Iteration checklist

Repeat this section for each freeze iteration.

### 1) Contract compatibility

- [ ] No breaking change in `ClipFromUrlAutoOptions`.
- [ ] No breaking change in `ClipFromUrlAutoResult`.
- [ ] `DecisionTrace.traceVersion` unchanged unless intentionally bumped.
- [ ] Contract tests still pass without schema updates.

### 2) Runtime behavior

- [ ] Stage A-only flow behaves unchanged for existing callers.
- [ ] Stage B fallback behavior unchanged for existing thresholds.
- [ ] Capability status (`/api/capabilities`) remains backward compatible.

### 3) Documentation sync

- [ ] `README.md` examples match current API.
- [ ] `docs/extraction-plan.md` checklist state still accurate.
- [ ] `docs/development-log.md` captures any notable contract-impacting change.

### 4) Release signal

- [ ] Mark iteration as pass/fail.
- [ ] Record any deferred breaking change candidates for post-carve-out major version.

## Exit criteria (Go for API freeze)

- Two consecutive iterations pass all checks above.
- No pending breaking-change proposals for freeze targets.
- CI build/test remains green on clean checkout.

## Iteration record template

Use this template to log each freeze iteration.

```md
### Freeze Iteration <N> (<YYYY-MM-DD>)

- Contract compatibility: PASS | FAIL
- Runtime behavior: PASS | FAIL
- Documentation sync: PASS | FAIL
- CI status: PASS | FAIL

Notes:
- API changes observed:
- Trace/schema changes observed:
- Deferred breaking changes:
- Decision: PASS | FAIL
```

## Freeze iteration tracking

### Freeze Iteration 1 (2026-03-25)

- Contract compatibility: PASS
- Runtime behavior: PASS
- Documentation sync: PASS
- CI status: PASS (GitHub Actions `clipper-core ci` run #3 on commit `042615b`)

Notes:
- API changes observed: none in this freeze run.
- Trace/schema changes observed: none in this freeze run.
- Deferred breaking changes: none.
- Decision: PASS

### Freeze Iteration 2 (2026-03-26)

- Contract compatibility: PASS
- Runtime behavior: PASS
- Documentation sync: PASS
- CI status: PASS (GitHub Actions `clipper-core ci` run #3 on commit `042615b`)

Notes:
- API changes observed: none in freeze-target contracts (`ClipFromUrlAutoOptions`, `ClipFromUrlAutoResult`).
- Trace/schema changes observed: none (`DecisionTrace.traceVersion` unchanged).
- Deferred breaking changes: none.
- Decision: PASS

