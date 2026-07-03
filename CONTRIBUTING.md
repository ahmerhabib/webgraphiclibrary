# Contributing

webgraphiclibrary is intentionally small. Contributions should keep the package close to WebGL, typed, and easy to inspect.

## Local setup

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs the same practical gate expected before release: formatting check, linting, type checking, tests, build, screenshot regeneration, and an npm package dry-run.

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
