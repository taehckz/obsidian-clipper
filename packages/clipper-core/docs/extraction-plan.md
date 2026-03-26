# clipper-core extraction plan (to standalone repo)

This plan assumes `clipper-core` remains in the monorepo while UI and APIs are stabilized, then moves out once the public contract is stable.

## Goals

- Keep current delivery speed while reducing extraction risk.
- Preserve API compatibility for downstream users.
- Move to independent CI/version/release lifecycle.

## Readiness checklist

- Public API for `clipFromUrl`, `clipFromUrlAuto`, trace, and stores is stable for 2 iterations.
- Unit + contract + E2E tests are green in CI.
- README includes install, examples, testing, and migration notes.
- No hidden imports from parent repo remain.
- Package can build and test from clean checkout.

## Proposed standalone repo structure

```text
clipper-core/
  src/
  ui/
  tests/
  templates/
  examples/
  docs/
  package.json
  tsconfig.json
  README.md
```

## Step-by-step migration

1. Freeze interface
   - Tag current monorepo commit.
   - Capture API signature and expected trace schema in docs.

2. Bootstrap new repository
   - Create `clipper-core` standalone repo.
   - Copy package contents from `packages/clipper-core` only.

3. Wire CI and release
   - Add CI for `npm run build` + `npm test`.
   - Add semantic versioning policy and release notes template.

4. Validate independently
   - Run tests from clean environment.
   - Validate UI start flow.

5. Publish strategy
   - Phase 1: pre-release tag (e.g. `0.x`).
   - Phase 2: stable release after one full consumer integration cycle.

6. Backlink from monorepo
   - Replace package folder with docs pointer.
   - Optionally consume standalone package back in monorepo as dependency.

## Risks and mitigations

- API drift during migration
  - Mitigation: freeze contracts before copy.

- Dependency mismatch
  - Mitigation: lockfile and CI clean-install checks.

- UI/backend coupling growth
  - Mitigation: keep UI calling API only; avoid importing internal modules directly.

## Suggested timeline

- Week 1-2: UI stabilization + API hardening in monorepo.
- Week 3: standalone repo bootstrap + CI + dry run release.
- Week 4: first consumer migration and stable release decision.

