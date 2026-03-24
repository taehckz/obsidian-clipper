# clipper-core

Reusable clipping package for non-extension projects, with local vendored core logic.

## What this package provides

- `ClipperCore` class for embedding in apps/services.
- `clipFromUrl()` for URL-first usage.
- `clipFromHtml()` for offline/local HTML usage.
- `clipFromTemplates()` to auto-pick one template from many.
- `matchTemplateForUrl()` for optional multi-template matching.
- Custom `fetchImpl`, `htmlFetcher`, and `templateResolver` hooks.

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

## Quick URL run (any URL)

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
