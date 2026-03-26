# clipper-core docs index

Use this index to quickly find the right document.

## Reading order

1. `../README.md`
   - Day-to-day usage, setup, scripts, examples, UI run instructions.

2. `extraction-plan.md`
   - Step-by-step plan for moving `clipper-core` into a standalone repository,
     including a pre-carve-out readiness checklist.

3. `development-log.md`
   - Engineering history: milestones, issues, root causes, fixes, and lessons.

4. `carveout-go-no-go.md`
   - Current carve-out readiness status, remaining blockers, and immediate next actions.

5. `api-freeze-checklist.md`
   - Iteration checklist to validate `clipFromUrlAuto` and trace schema stability pre-carve-out.

## Document boundaries

- `README.md` answers: "How do I use this package now?"
- `extraction-plan.md` answers: "How do we split this package into a new repo safely?"
- `development-log.md` answers: "What happened during development, and why were decisions made?"

## Maintenance guidance

- Update `README.md` when scripts/API/usage changes.
- Update `development-log.md` when notable issues or architectural decisions occur.
- Update `extraction-plan.md` when carve-out prerequisites or migration steps change.

