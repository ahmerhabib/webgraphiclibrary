# Testing

How to test webgraphiclibrary locally, and how to add tests as you change it.

## Commands at a glance

| Command              | What it does                                                                                                            | When                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `pnpm test`          | Run the mock-GL unit suite once (fast, no browser)                                                                      | Quick check                        |
| `pnpm test:watch`    | Re-run affected tests on every save                                                                                     | While coding                       |
| `pnpm test:coverage` | Run the suite with V8 coverage + threshold enforcement                                                                  | Before a PR / in CI                |
| `pnpm typecheck`     | `tsc --noEmit` in strict mode across all packages                                                                       | After type changes                 |
| `pnpm lint`          | Type-aware ESLint over everything                                                                                       | After code changes                 |
| `pnpm build`         | Bundle to `dist/` (ESM + `.d.ts`) with tsup                                                                             | Before browser/package checks      |
| `pnpm check:package` | Import every dist subpath, check declarations + class identity, then pack the tarball and import it from a temp project | Before a release                   |
| `pnpm check:browser` | Run the real-WebGL self-test and smoke-test every example (needs a build)                                               | Before a PR that touches rendering |
| `pnpm verify`        | The gate: format → lint → typecheck → test → build → check:package                                                      | Before every commit                |
| `pnpm screenshots`   | Regenerate the README showcase images (needs a build + Playwright)                                                      | After changing a showcase          |

## The everyday loop

```bash
pnpm install          # once
pnpm test:watch       # leave running while you work
```

Before committing:

```bash
pnpm verify           # format, lint, typecheck, tests, build, packaged-export check
```

If you touched rendering (a wrapper's GL calls, an example, a new resource type):

```bash
pnpm build && pnpm check:browser
```

## Running a subset

```bash
pnpm exec vitest run packages/fbo              # one package
pnpm exec vitest run packages/fbo/src/multi-target.test.ts   # one file
pnpm exec vitest run -t "restores the previous"              # by test name
pnpm exec vitest                                # watch mode (alias: pnpm test:watch)
```

## Two kinds of tests

### 1. Mock-GL unit tests (`packages/**/*.test.ts`)

Fast, deterministic, no browser. Each test builds a hand-rolled fake `gl` object that records the calls a wrapper makes, then asserts on the sequence and on state restoration. This is where the bulk of behavior is covered — validation, lifecycle, error paths, and that every helper restores the bindings it touched.

Adding one — mirror the `createMockGL` factory in the sibling test and assert against `gl.calls`:

```ts
import { describe, expect, it } from "vitest";
import { GLBuffer } from "./index";

it("restores the previous binding after upload", () => {
  const gl = createMockGL();
  const previous = { type: "previous" };
  gl.bindBuffer(gl.ARRAY_BUFFER, previous);

  new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array([0, 1]) });

  expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previous); // not clobbered
});
```

Guidelines:

- Write the test first, watch it fail, then implement (TDD).
- Add the GL constants and methods your code touches to the mock factory (copy the pattern from the nearest test).
- Cover the failure paths too: invalid input, failed allocation (`create*` returns `null`), incomplete framebuffers, and use-after-`dispose()`.
- When a helper binds a resource, assert the previous binding is restored afterwards.

### 2. Real-browser tests (`pnpm check:browser`)

Mock tests can't catch real WebGL behavior — format/type mismatches, actual pixel output, or bundler issues. `scripts/check-browser.mjs` builds the package, launches headless Chromium with a software WebGL backend, and:

- runs `examples/self-test/index.html`, which renders against a **live** WebGL/WebGL2 context and asserts real pixel readback, texture uploads, MRT and MSAA round-trips, and error paths;
- loads every example and fails on any console or page error.

Add a browser assertion by extending `examples/self-test/index.html` (it reports failures on `window.__WGL_RESULT__`). This is how the cross-subpath `instanceof WebGLError` bug was caught — something the mock suite could not see.

## Coverage

```bash
pnpm test:coverage
```

Prints a per-file summary and writes an HTML report to `coverage/index.html`. Coverage is measured over the shipped source only (`packages/*/src`, excluding tests) and **enforced** — CI fails if global coverage drops below: 90% statements/lines, 85% branches, 95% functions. Keep new code covered as you add it.

## What CI runs

Every push and pull request runs the same gate (`.github/workflows/ci.yml`): format, lint, typecheck, **test with coverage**, build, `check:package`, and a `pnpm audit`, plus a separate **real-browser** job. Screenshot regeneration is a manual (`workflow_dispatch`) job.

## Pre-commit checklist

- [ ] `pnpm verify` is green
- [ ] New behavior has a failing-first test; failure paths covered
- [ ] Helpers that bind a resource restore the previous binding
- [ ] `pnpm check:browser` passes if rendering changed
- [ ] `pnpm test:coverage` still meets the thresholds
