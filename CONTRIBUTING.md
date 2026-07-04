# Contributing

webgraphiclibrary is intentionally small. Contributions should keep the package close to WebGL, typed, and easy to inspect.

## Local setup

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs the same gate as CI: formatting check, linting, type checking, tests, build, and a packaged-export check (`pnpm check:package`) that verifies every dist subpath and installs the packed tarball into a temporary project. Screenshot regeneration (`pnpm screenshots`) is a separate, browser-dependent step and is not part of the gate.

## Development standards

- Keep APIs focused on one WebGL resource or workflow.
- Prefer explicit lifecycle methods over hidden global state.
- Throw early for invalid input and incomplete WebGL resources.
- Keep raw WebGL handles available when direct control is useful.
- Add tests for resource validation, lifecycle behavior, and failure paths.
- Update the README and example screenshots when public behavior changes.

## Release notes

Any user-visible change should update `CHANGELOG.md`. New modules should include:

- a short purpose statement
- import examples
- option/property/method documentation
- at least one focused test file
- an example or screenshot when the workflow is visual
