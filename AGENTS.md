# Repository Guidelines

## Project Structure & Module Organization
- `packages/code-storage-typescript/`: TypeScript/JavaScript SDK (`src/`, `tests/`,
  build output in `dist/`).
- `packages/code-storage-python/`: Python SDK (`pierre_storage/`, `tests/`,
  scripts in `scripts/`, local `venv/` and build output in `dist/`).
- `packages/code-storage-go/`: Go SDK (package sources and `*_test.go` files).
- `.moon/` and per-package `moon.yml`: workspace task definitions.

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

## Commit & Pull Request Guidelines
- Git history shows short, informal subjects and no strict convention. Prefer
  clear, imperative summaries (e.g., `python: tighten webhook parsing`).
- PRs should include a behavior summary, test evidence (commands + results), and
  notes on any required credentials or environment setup. Update docs when
  public API shapes change.

## Security & Configuration Notes
- Never commit private keys or API tokens. Use local files or environment
  variables for SDK credentials.
- Keep package-level docs (for example,
  `packages/code-storage-typescript/AGENTS.md`) in sync with code changes.
- Audit `skills/code-storage/SKILL.md` against the SDK packages whenever public
  API surface changes (endpoints, request/response shapes, JWT claims, scopes,
  policy ops, base-repo providers, exported constants/helpers). The skill
  doubles as agent-facing API documentation, so naming, examples, and the
  endpoint table must match what the TypeScript, Python, and Go SDKs actually
  send and accept.
