# Repository Guidelines

## Project Structure & Module Organization
- `packages/code-storage-typescript/`: TypeScript/JavaScript SDK (`src/`, `tests/`,
  build output in `dist/`).
- `packages/code-storage-python/`: Python SDK (`pierre_storage/`, `tests/`,
  scripts in `scripts/`, local `venv/` and build output in `dist/`).
- `packages/code-storage-go/`: Go SDK (package sources and `*_test.go` files).
- `.moon/` and per-package `moon.yml`: workspace task definitions.

## SDK Release Builds

`typescript/`, `cli/`, `python/`, and `go/` hold the builds of `@pierre/sdk`,
`@pierre/cli`, `pierre-sdk`, and the Go module `github.com/pierrecomputer/sdk/go`.
`sdk-build.json` records their version, their npm tag, and the SHA-256 of each
file. These files are build output: do not edit them by hand. A release pull
request replaces all of them, and `.github/workflows/check-sdk-build.yml` checks
it with `scripts/sdk_build.py`. When it merges, `.github/workflows/publish-sdk.yml`
publishes each package that its registry does not have: PyPI first, then npm,
then the tag `go/v<version>`. Its last job waits up to 10 minutes for each
registry to show the version; a failure there skips no publish. When a publish
stops, use "Re-run all jobs" on the same run: the plan job then skips each
published package. "Re-run failed jobs" keeps the first plan and can publish a
package again. The reviewer of a release pull request checks that it changes only
`sdk-build.json` and the four directories, and that the public files have no
internal notes. The packages in `packages/`, `.version`, and `publish.yml` are
not part of these releases.

## Build, Test, and Development Commands
- TypeScript (from repo root):
  - `pnpm --filter @pierre/storage build` builds `dist/` with tsup.
  - `pnpm --filter @pierre/storage exec vitest --run` runs unit tests.
  - `pnpm --filter @pierre/storage run dev` starts watch builds.
- Python (from `packages/code-storage-python/`):
  - `bash scripts/setup.sh` creates `venv/` and installs dev deps.
  - `./venv/bin/pytest -v` runs tests.
  - `./venv/bin/ruff check pierre_storage` lints; `./venv/bin/ruff format pierre_storage`
    formats.
- Go (from `packages/code-storage-go/`):
  - `go test ./...` runs unit tests.
- Optional Moon tasks (repo root):
  - `moon run code-storage-typescript:build`
  - `moon run git-storage-sdk-python:test`
  - `moon run git-storage-sdk-go:test`
- Package versions (repo root):
  - Edit only `.version` when you set a package version.
  - Use `MAJOR.MINOR.PATCH`. npm, PyPI, and Go do not accept the same
    prerelease and build metadata.
  - Set a version above the previous version. CI rejects a version that goes
    backward.
  - `python3 scripts/sync_versions.py` sets all package versions from `.version`.
  - `python3 scripts/sync_versions.py --check` detects version differences.
  - `python3 scripts/sync_versions.py --print` reads the version for a release
    tag. Use it instead of a second parser for `.version`.
  - CI runs the check with `.github/actions/check-package-versions`. Reuse that
    action in a new workflow.

## Coding Style & Naming Conventions
- TypeScript: follow existing `src/` style; use `camelCase` variables and
  `PascalCase` types/classes.
- Python: type hints for public APIs, Google-style docstrings, Ruff formatting
  (`line-length 100`).
- Go: run `gofmt`; keep idiomatic error handling and `*_test.go` naming.

## Testing Guidelines
- TypeScript: Vitest; tests in `tests/*.test.ts`. `tests/full-workflow.js` is an
  integration smoke test and requires real credentials.
- Python: pytest; tests in `tests/test_*.py` with coverage options in
  `pyproject.toml`.
- Go: `go test` across the module.
- Version tool: `python3 -m unittest discover -s scripts/tests` runs the tests in
  `scripts/tests/`.

## TypeScript SDK Rules

The `@pierre/storage` package is a public production SDK. Preserve semver
compatibility and coordinate each breaking change.

- The package supports ESM and CommonJS consumers.
- The package supports Node and edge runtimes that provide `fetch`.
- The package creates authenticated Git URLs and wraps repository REST APIs.
- Consumers depend on the generated `dist` output.
- `packages/code-storage-typescript/src/index.ts` is the public entry point.
- `packages/code-storage-typescript/src/types.ts` defines the shared API types.
- `packages/code-storage-typescript/tests/index.test.ts` covers the public API.
- `packages/code-storage-typescript/tests/full-workflow.js` is the live smoke
  test.
- `packages/code-storage-typescript/tsup.config.ts` defines the API and storage
  base URLs.
- Keep the TypeScript types and README in sync with each request or response
  change.
- Avoid Node built-in imports that break browser use.
- Keep the `resolveCommitTtlSeconds` default at one hour.
- Use `DEFAULT_TOKEN_TTL_SECONDS` for that default.
- Keep `Repo.restoreCommit` on `repos/restore-commit`. Do not add an automatic
  fallback to the legacy endpoints.
- Preserve the `RefUpdateError` status, reason, message, and ref fields.
- Keep `Repo.createCommitFromDiff` on `repos/diff-commit`.
- Keep its return type as `Promise<CommitResult>`.
- Reuse the commit-pack error helpers in `Repo.createCommitFromDiff`.
- Keep ES256 private-key authentication compatible with the README example.
- Keep raw API payload names as `*Response`.
- Keep camelCase consumer results as `*Result`.
- Extend `normalizeDiffState` when the API adds a Git status.
- Preserve `state` and `rawState` in normalized diff results.
- Keep webhook push events typed and preserve `WebhookUnknownEvent`.
- Convert commit timestamps to `Date` and preserve `rawDate`.
- Route new commit sources through `toAsyncIterable` and `ensureUint8Array`.
- Keep `CommitFileOptions.mode` restricted to `GitFileMode`.
- Keep UTF-8 as the default text encoding.
- Keep the Node `Buffer` fallback for non-UTF text encodings.

## Commit & Pull Request Guidelines
- Git history shows short, informal subjects and no strict convention. Prefer
  clear, imperative summaries (e.g., `python: tighten webhook parsing`).
- PRs should include a behavior summary, test evidence (commands + results), and
  notes on any required credentials or environment setup. Update docs when
  public API shapes change.

## Security & Configuration Notes
- Never commit private keys or API tokens. Use local files or environment
  variables for SDK credentials.
- `skills/code-storage/SKILL.md` points to the `pierre` and `pierre-migrate`
  skills in `pierrecomputer/skills`. Do not add API details to it.
