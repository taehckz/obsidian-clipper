# clipper-core

Reusable clipping package for non-extension projects, with local vendored core logic.

## What this package provides

- `ClipperCore` class for embedding in apps/services.
- `clipFromUrl()` for URL-first usage.
- `clipFromUrlAuto()` for adaptive Stage A/B URL clipping.
- `clipFromHtml()` for offline/local HTML usage.
- `clipFromTemplates()` to auto-pick one template from many.
- `matchTemplateForUrl()` for optional multi-template matching.
- Custom `fetchImpl`, `htmlFetcher`, and `templateResolver` hooks.
- Pluggable auto-mode contracts: `PolicyStore`, `RendererAdapter`, threshold controls, and trace output.
- Local UI (`npm run ui:start`) for input, procedure visualization, and markdown output.

## Scope note (future carve-out)

`packages/clipper-core` is currently developed inside the main `obsidian-clipper` repo,
but this package is intentionally self-contained and designed to be moved into its own
standalone repository later.

For carve-out planning details, see:

- `docs/INDEX.md`
- `docs/extraction-plan.md`
- `docs/development-log.md`

## Distribution and dependency policy

This project uses a **library-first distribution mode**:

- Published package artifact: `dist/` only.
- UI, examples, tests, and docs are development assets in this repository/workspace.
- This keeps the npm package lean and focused for embedding in other projects.

Playwright policy:

- Stage A (HTTP + extraction) works without Playwright.
- Stage B (rendered fallback) requires Playwright at runtime.
- `playwright` is:
  - optional peer dependency for consumers that enable Stage B,
  - dev dependency here for local UI and integration testing.

Recommended Stage B setup for consumers:

```bash
npm install playwright
npx playwright install chromium
```

## Install and build

From `packages/clipper-core`:

```bash
npm install
npm run build
```

Build output is written to `dist/`.

## Minimal template shape

Use a Web Clipper template object:

```ts
const template = {
  id: "default",
  name: "Default",
  behavior: "create",
  noteNameFormat: "{{title}}",
  path: "",
  noteContentFormat: "{{content}}",
  properties: [],
};
```

## Example 1: URL input (`clipFromUrl`)

```ts
import { ClipperCore } from "clipper-core";

const core = new ClipperCore();

const template = {
  id: "default",
  name: "Default",
  behavior: "create",
  noteNameFormat: "{{title}}",
  path: "",
  noteContentFormat: "{{content}}",
  properties: [],
};

const result = await core.clipFromUrl({
  url: "https://example.com/article",
  template,
  fetchOptions: {
    headers: {
      "User-Agent": "MyClipperBot/1.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  }
});

console.log(result.noteName);
console.log(result.fullContent);
```

## Example 2: Local/offline HTML (`clipFromHtml`)

```ts
import fs from "node:fs/promises";
import { ClipperCore } from "clipper-core";

const core = new ClipperCore();
const html = await fs.readFile("./fixtures/article.html", "utf-8");

const template = {
  id: "default",
  name: "Default",
  behavior: "create",
  noteNameFormat: "{{title}}",
  path: "",
  noteContentFormat: "{{content}}",
  properties: [],
};

const result = await core.clipFromHtml({
  html,
  url: "https://example.com/article",
  template,
});

console.log(result.fullContent);
```

## Quick local run (recommended)

Create and run the included example:

```bash
# from packages/clipper-core
npm run build
npm run example:local
```

Expected output shape:

```text
noteName=debug-note
fullContent_start
...
fullContent_end
```

## Quick URL run (npm docs example)

```bash
# from packages/clipper-core
npm run build
npm run example:url
```

Expected output shape:

```text
URL: https://docs.npmjs.com/about-npm
Title: About npm | npm Docs
ContentLen: <non-zero>
H1: About npm
```

## Extract from a website URL (2 options)

### Option 1: Bundled URL runner (`run-url-any.js`)

```bash
# from packages/clipper-core
npm run build
npm run example:url:any -- "https://docs.npmjs.com/about-npm"
```

With optional flags:

```bash
npm run example:url:any -- "https://example.com/post" \
  --template-file "./templates/default-template.json" \
  --tag "clippings, news" \
  --out "./examples/output/custom-post.md" \
  --user-agent "Mozilla/5.0 ..." \
  --lang "en-US,en;q=0.9"
```

You can place custom templates under:

- `templates/`

Output will be written to:

- `examples/output/<safe-url-name>.md`

### Option 2: Reusable extraction script (`extract.js`)

If you prefer a single script you can copy into other projects:

```bash
# from packages/clipper-core
npm run build
npm run example:extract -- "https://docs.npmjs.com/about-npm"
```

Optional output path:

```bash
npm run example:extract -- "https://docs.npmjs.com/about-npm" "./examples/output/my-output.md"
```

Both options support Stage A/B auto extraction. Option 1 is more CLI-style with flags, while Option 2 is easier to copy into another project and customize in code.

## Local UI (input -> procedure -> output)

Run local UI:

```bash
# from packages/clipper-core
npm install
npm install --save-dev playwright
npx playwright install chromium
npm run ui:start
```

Open:

- `http://127.0.0.1:3040`

If port `3040` is already in use:

```bash
CLIPPER_CORE_UI_PORT=3041 npm run ui:start
```

UI provides:

- Input panel: URL, Stage A/B controls, thresholds, optional template JSON.
- Procedure panel: route decision, Stage A quality checks, Stage B fallback usage, timings.
- Output panel: final markdown content.
- Output actions: include metadata toggle, copy output, and download `.md`.
- Runtime capability status: indicates whether Stage B (Playwright) is currently available.

## Standalone extraction plan

When you are ready to split this package into an independent repository, follow:

- `docs/extraction-plan.md`

## Example 3: Pick template from a list (`clipFromTemplates`)

```ts
import { ClipperCore } from "clipper-core";

const core = new ClipperCore({
  templateResolver: ({ url, templates }) => {
    return templates.find(t => t.name === "Tech") ?? templates[0];
  },
});

const templates = [/* Template[] */];

const result = await core.clipFromTemplates({
  url: "https://example.com/post",
  templates,
  fetchOptions: {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  }
});
```

## Advanced hooks

- `fetchImpl`: plug your own fetch client (proxy, retry, auth).
- `htmlFetcher`: fully control how HTML is retrieved (Playwright, cache, signed requests).
- `templateResolver`: custom business rules for selecting a template.
- `clipFromUrl` has automatic fallback for oversized response headers (common on heavy sites), so you do not need a manual HTML export flow.
- `clipFromUrlAuto` adds quality thresholds + domain policy routing before using browser-rendered fallback.

## Auto mode (Stage A/B) for reuse

`clipFromUrlAuto` is designed to stay reusable across projects by separating concerns:

- Stage A: normal HTTP fetch + extraction (fast path).
- Stage B: browser-rendered fallback through a `RendererAdapter` (default: `PlaywrightRendererAdapter`).
- Domain policy store is pluggable (`InMemoryPolicyStore` default, optional `JsonFilePolicyStore` for persistence).
- Thresholds are configurable (`minContentLength`, `minWordCount`, `requireTitle`).
- Optional decision trace output can be used later by UI tooling.
- Decision trace is versioned via `traceVersion` (`DECISION_TRACE_VERSION` export).

Example:

```ts
import {
  ClipperCore,
  JsonFilePolicyStore
} from "clipper-core";

const core = new ClipperCore({
  enableAutoTrace: true
});

const out = await core.clipFromUrlAuto({
  url: "https://example.com/news",
  template,
  auto: {
    policyStore: new JsonFilePolicyStore("./data/domain-policy.json"),
    thresholds: {
      minContentLength: 240,
      minWordCount: 80,
      requireTitle: true
    },
    enableTrace: true
  }
});

console.log(out.result.noteName);
console.log(out.trace?.finalStage); // stageA | stageB
```

CLI-style example with bundled script:

```bash
# from packages/clipper-core
npm run build
npm run example:url:auto -- "https://example.com/article" \
  --policy-file "./examples/output/domain-policy.json" \
  --min-content-length 240 \
  --min-word-count 80 \
  --trace
```

## Testing strategy (unit + contract + E2E)

`clipper-core` now includes all three test layers:

- Unit tests: pure logic checks (quality thresholds, route decision rules).
- Contract tests: module boundary guarantees (`PolicyStore`, pipeline fallbacks, migration shape).
- E2E tests: full `ClipperCore` flow on a local HTTP server (including Stage A -> Stage B fallback path).

Run from `packages/clipper-core`:

```bash
npm run test:unit
npm run test:contract
npm run test:e2e
```

Run all:

```bash
npm test
```

Optional real Playwright integration test (covers Stage B runtime lifecycle):

```bash
RUN_PLAYWRIGHT_INTEGRATION=1 npm run test:integration:playwright
```

Test locations:

- `tests/unit/*.test.cjs`
- `tests/contract/*.test.cjs`
- `tests/e2e/*.test.cjs`
- `tests/integration/*.integration.test.cjs` (opt-in)

## Notes

- `clipFromUrl` needs network access to fetch the target URL.
- `clipFromHtml` runs fully local once dependencies are installed.
- For advanced scenarios (custom auth/session/rendered HTML), fetch HTML yourself and call `clipFromHtml`.
- Core clipping logic is vendored into `src/vendor`, so this package does not depend on `obsidian-clipper` at runtime.

## Dependency resilience checklist

Use this checklist to reduce risk from public package/repo disappearance.

### 1) Pin and lock versions

Use exact versions for critical runtime dependencies and commit lockfiles.

```bash
# from packages/clipper-core
npm install --save-exact defuddle dayjs linkedom lz-string
npm install
```

Commit:

- `packages/clipper-core/package.json`
- lockfile (`package-lock.json` in repo root, or workspace lockfile)

### 2) Archive dependency tarballs

Create a local/offline archive of exact package tarballs.

```bash
# from packages/clipper-core
mkdir -p vendor-tarballs
npm pack defuddle@0.14.0 --pack-destination vendor-tarballs
npm pack dayjs@1.11.13 --pack-destination vendor-tarballs
npm pack linkedom@0.18.0 --pack-destination vendor-tarballs
npm pack lz-string@1.5.0 --pack-destination vendor-tarballs
```

Store `vendor-tarballs/` in internal artifact storage or your own backup location.

### 3) Offline / emergency restore

If npm registry is unavailable, install from tarballs:

```bash
# from packages/clipper-core
npm install ./vendor-tarballs/defuddle-0.14.0.tgz \
  ./vendor-tarballs/dayjs-1.11.13.tgz \
  ./vendor-tarballs/linkedom-0.18.0.tgz \
  ./vendor-tarballs/lz-string-1.5.0.tgz
npm run build
```

### 4) Team / production best practice

- Use a private npm proxy/cache mirror (Verdaccio, Nexus, Artifactory).
- Configure CI to fail on unexpected lockfile changes.
- Periodically refresh tarball backups when intentionally upgrading dependencies.
