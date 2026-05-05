---
name: code-storage
description: >
  Agent skill for interacting with code.storage, a managed Git
  infrastructure layer. Provides repository creation, branching, commits, file access,
  diffs, search, notes, GitHub sync, ephemeral branches, and forking through a RESTful
  HTTP API authenticated with customer-signed JWTs. Every repo operation scoped per-JWT.
---

MCP server: https://code.storage/docs/mcp
Docs index: https://code.storage/docs/llms.txt

Official SDKs (in this repository):
- TypeScript / JavaScript: `@pierre/storage` (npm)
- Python: `pierre-storage` (PyPI; import `pierre_storage`)
- Go: `github.com/pierrecomputer/sdk/packages/code-storage-go`

# ENVIRONMENT SETUP

## Required Environment Variables

| Variable                | Description                                                    | Example                                          |
|-------------------------|----------------------------------------------------------------|--------------------------------------------------|
| `ORG_NAME`              | Your organization identifier (subdomain slug)                  | `acme`                                           |
| `PIERRE_PRIVATE_KEY`    | PEM-encoded EC (ES256) or RSA (RS256) private key              | `-----BEGIN PRIVATE KEY-----\n...`               |
| `CODE_STORAGE_BASE_URL` | Derived base URL for HTTP API                                  | `https://api.acme.code.storage/api/v1`           |
| `CODE_STORAGE_TOKEN`    | JWT minted for current operation (per-repo or org-wide)        | `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...`       |

Export for curl sessions:
```bash
export ORG_NAME="your-org"
export CODE_STORAGE_BASE_URL="https://api.${ORG_NAME}.code.storage/api/v1"
export CODE_STORAGE_TOKEN="YOUR_JWT_TOKEN"
```

## JWT Token Structure

Every request requires a JWT signed with your private key. Tokens are per-repository
(except `org:read` which is org-wide).

```json
{
  "iss": "your-org",          // Organization identifier
  "sub": "@pierre/storage",   // Subject (the SDKs set this to the package name)
  "repo": "team/project",     // Repository the token grants access to
  "scopes": ["git:read", "git:write"],
  "ops": ["no-force-push"],   // Optional policy operations (see below)
  "iat": 1723453189,
  "exp": 1723456789
}
```

JWT header: `{ "alg": "ES256", "typ": "JWT" }` (RS256 and EdDSA also supported)

### Policy Operations (`ops`)

The optional `ops` claim narrows what a token may do at the protocol layer. The
SDKs expose the canonical constant for force-push prevention:

| Op string        | SDK constant                                                              | Effect                                                |
|------------------|---------------------------------------------------------------------------|-------------------------------------------------------|
| `no-force-push`  | TS `OP_NO_FORCE_PUSH` / Py `OP_NO_FORCE_PUSH` / Go `storage.OpNoForcePush` | Rejects force pushes / non-fast-forward ref updates. |

Pass via the SDK `getRemoteURL` / `getEphemeralRemoteURL` / `getImportRemoteURL`
helpers (`{ ops: [OP_NO_FORCE_PUSH] }`) or include the `ops` array directly when
minting a JWT manually.

### Permission Scopes

| Scope        | Grants                          | Required By                                    |
|--------------|---------------------------------|------------------------------------------------|
| `git:read`   | clone, fetch, pull, read API    | GET file/branch/commit/diff/grep endpoints     |
| `git:write`  | push, write API (includes read) | POST/DELETE commit/branch/note endpoints       |
| `repo:write` | create/delete repositories      | POST /repos, DELETE /repos/delete              |
| `org:read`   | list all repos in org           | GET /repos (list)                              |

### Git Remote URL Format

```
https://t:{JWT}@{ORG_NAME}.code.storage/{REPO_ID}.git
```
Username is always `t`. Password is the JWT.

# QUICK-REFERENCE ENDPOINT TABLE

| Goal                          | Method   | Endpoint                          | Scope Required  |
|-------------------------------|----------|-----------------------------------|-----------------|
| **REPOSITORIES**              |          |                                   |                 |
| Create repository             | POST     | `/repos`                          | `repo:write`    |
| List all repositories         | GET      | `/repos`                          | `org:read`      |
| Get repository metadata       | GET      | `/repo`                           | (repo in JWT)   |
| Delete repository             | DELETE   | `/repos/delete`                   | `repo:write`    |
| **BRANCHES**                  |          |                                   |                 |
| Create branch                 | POST     | `/repos/branches/create`          | `git:write`     |
| List branches                 | GET      | `/repos/branches`                 | `git:read`      |
| Get branch diff               | GET      | `/repos/branches/diff`            | `git:read`      |
| Merge branches                | POST     | `/repos/merge`                    | `git:write`     |
| Delete branch                 | DELETE   | `/repos/branches`                 | `git:write`     |
| **COMMITS**                   |          |                                   |                 |
| Create commit (file blobs)    | POST     | `/repos/commit-pack`              | `git:write`     |
| Create commit from diff/patch | POST     | `/repos/diff-commit`              | `git:write`     |
| List commits                  | GET      | `/repos/commits`                  | `git:read`      |
| Get commit                    | GET      | `/repos/commit`                   | `git:read`      |
| Get commit diff               | GET      | `/repos/diff`                     | `git:read`      |
| Restore branch to commit      | POST     | `/repos/restore-commit`           | `git:write`     |
| **FILES**                     |          |                                   |                 |
| List files at ref             | GET      | `/repos/files`                    | `git:read`      |
| List files with metadata      | GET      | `/repos/files/metadata`           | `git:read`      |
| Get file content (stream)     | GET      | `/repos/file`                     | `git:read`      |
| Blame file at ref             | GET      | `/repos/blame`                    | `git:read`      |
| Search content (grep)         | POST     | `/repos/grep`                     | `git:read`      |
| Download archive (tar.gz)     | POST     | `/repos/archive`                  | `git:read`      |
| **TAGS**                      |          |                                   |                 |
| Create tag                    | POST     | `/repos/tags`                     | `git:write`     |
| List tags                     | GET      | `/repos/tags`                     | `git:read`      |
| Delete tag                    | DELETE   | `/repos/tags`                     | `git:read`+`git:write` |
| **NOTES**                     |          |                                   |                 |
| Create note on commit         | POST     | `/repos/notes` (action:"add")     | `git:write`     |
| Append to note                | POST     | `/repos/notes` (action:"append")  | `git:write`     |
| Get note for commit           | GET      | `/repos/notes?sha=SHA`            | `git:read`      |
| Delete note                   | DELETE   | `/repos/notes`                    | `git:write`     |
| **GIT SYNC**                  |          |                                   |                 |
| Pull from upstream            | POST     | `/repos/pull-upstream`            | `git:write`     |
| Detach upstream               | DELETE   | `/repos/base`                     | `git:write`     |
| **GENERIC GIT SYNC**          |          |                                   |                 |
| Create Git credential         | POST     | `/repos/git-credentials`          | `repo:write`    |
| Update Git credential         | PUT      | `/repos/git-credentials`          | `repo:write`    |
| Delete Git credential         | DELETE   | `/repos/git-credentials`          | `repo:write`    |

All endpoints: `BASE_URL = https://api.{org}.code.storage/api/v1`
All requests: `Authorization: Bearer $CODE_STORAGE_TOKEN`

# ENDPOINT REFERENCE

## POST /repos — Create Repository

```bash
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_branch": "main"}'
```

**With GitHub Sync:**
```json
{
  "default_branch": "main",
  "base_repo": { "provider": "github", "owner": "ORG", "name": "REPO", "default_branch": "main" }
}
```

**With generic HTTPS Git Sync:**
```json
{
  "default_branch": "main",
  "base_repo": {
    "provider": "gitlab",
    "owner": "GROUP",
    "name": "REPO",
    "default_branch": "main"
  }
}
```

Generic providers: `gitlab`, `bitbucket`, `gitea`, `forgejo`, `codeberg`, `sr.ht`.
For self-hosted providers, include `upstream_host`, for example `"upstream_host": "git.example.com"`.
After creating a generic Git Sync repository, store upstream credentials with `/repos/git-credentials`.

**With public GitHub (no GitHub App install required):**
```json
{
  "default_branch": "main",
  "base_repo": {
    "provider": "github",
    "owner": "octocat",
    "name": "Hello-World",
    "default_branch": "main",
    "auth": { "auth_type": "public" }
  }
}
```

**Fork from existing Code Storage repo:**
```json
{
  "base_repo": {
    "provider": "code",
    "owner": "ORG_NAME",
    "name": "source-repo-id",
    "operation": "fork",
    "ref": "main",
    "auth": { "token": "JWT_WITH_GIT_READ_ON_SOURCE" }
  }
}
```
`provider` for forks is the literal string `"code"`. Forking also supports `sha`
to pin an exact source commit; `sha` overrides `ref`. `owner` is the
organization name (the same value used as the JWT `iss`).

Response `201`: `{ "repo_id": "...", "message": "..." }`
Errors: `401` bad JWT/scope, `409` repo already exists or upstream already configured, `412` GitHub App config required for authenticated GitHub sync

## POST/PUT/DELETE /repos/git-credentials — Manage Generic Git Sync Credentials

Use this endpoint family for generic HTTPS Git providers such as GitLab, Bitbucket, Gitea,
Forgejo, Codeberg, sr.ht, and self-hosted remotes.

```bash
# Create credential
curl "$CODE_STORAGE_BASE_URL/repos/git-credentials" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repo_id":"REPO_ID","username":"git","password":"ACCESS_TOKEN_OR_PASSWORD"}'

# Update credential
curl "$CODE_STORAGE_BASE_URL/repos/git-credentials" -X PUT \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"CREDENTIAL_ID","username":"git","password":"ROTATED_ACCESS_TOKEN"}'

# Delete credential
curl "$CODE_STORAGE_BASE_URL/repos/git-credentials" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"CREDENTIAL_ID"}'
```

`username` is optional for token-only providers. A repository can have one stored Git credential.
GitHub App sync does not use this endpoint.

## GET /repos — List Repositories

```bash
curl "$CODE_STORAGE_BASE_URL/repos?limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `cursor` (pagination), `limit` (default 20, max 100)
Scope: `org:read`
Response: `{ "repos": [...], "next_cursor": "...", "has_more": true }`

## GET /repo — Get Repository

```bash
curl "$CODE_STORAGE_BASE_URL/repo" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Repository identified from JWT `repo` claim. Returns `404` when the repo does not exist.
Response: `{ "default_branch", "created_at", "base_repo?" }` (the SDKs read
`default_branch` and `created_at`; additional fields may be present.)

## DELETE /repos/delete — Delete Repository

```bash
curl "$CODE_STORAGE_BASE_URL/repos/delete" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Scope: `repo:write`. Deletion is async; physical storage cleanup completes asynchronously.
Errors: `403` missing scope, `404` not found, `409` already deleted

## POST /repos/branches/create — Create Branch

```bash
curl "$CODE_STORAGE_BASE_URL/repos/branches/create" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base_ref":"refs/heads/main","target_branch":"feature/x","base_is_ephemeral":false,"target_is_ephemeral":false}'
```

Required: `target_branch` plus one of `base_ref` (preferred — accepts `refs/heads/...`,
plain branch names, or commit SHAs) or `base_branch` (deprecated alias).
Optional: `base_is_ephemeral`, `target_is_ephemeral`.
Response: `{ "message", "target_branch", "target_is_ephemeral", "commit_sha" }`

## GET /repos/branches — List Branches

```bash
curl "$CODE_STORAGE_BASE_URL/repos/branches?limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Response: `{ "branches": [{ "name", "head_sha", "created_at" }], "next_cursor", "has_more" }`

## GET /repos/branches/diff — Get Branch Diff

```bash
curl "$CODE_STORAGE_BASE_URL/repos/branches/diff?branch=BRANCH&base=main&path=src/foo.go" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `branch`(required), `base`, `ephemeral`, `ephemeral_base`, `path` (repeatable)
Response: `{ "branch", "base", "stats": {files,additions,deletions,changes}, "files": [...], "filtered_files": [...] }`
State codes in `files[].state`: `A`=added, `M`=modified, `D`=deleted, `R`=renamed

## POST /repos/merge — Merge Branches

```bash
curl "$CODE_STORAGE_BASE_URL/repos/merge" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_branch": "feature/demo",
    "target_branch": "main",
    "strategy": "merge",
    "source_is_ephemeral": false,
    "target_is_ephemeral": false,
    "commit_message": "Merge feature/demo",
    "author": {"name": "Merge Bot", "email": "merge@example.com"}
  }'
```

Required: `source_branch`, `target_branch`, `strategy` (`merge` | `ff_only` | `ff_prefer`).
Optional: `source_is_ephemeral`, `target_is_ephemeral`, `expected_target_sha`,
`commit_message`, `author`, `committer`, `allow_unrelated_histories`.
Response: `{ "result": "merge_commit"|"fast_forward"|"no_op"|"unknown",
  "commit_sha", "tree_sha", "source": {branch,ephemeral,sha},
  "target": {branch,ephemeral,old_sha,new_sha}, "merge_base_sha?", "promoted_commits" }`
Conflicts return HTTP 409 with `conflict_paths` and `merge_base_sha` preserved on the body.

## DELETE /repos/branches — Delete Branch

```bash
curl "$CODE_STORAGE_BASE_URL/repos/branches" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"feature/old-onboarding"}'
```

The default branch cannot be deleted. If the repository is connected to GitHub sync, branch deletion
triggers a sync automatically.
Response: `{ "name": "feature/old-onboarding", "message": "branch deleted" }`

## POST /repos/commit-pack — Create Commit

Content-Type: `application/x-ndjson`
Send metadata line first, then blob_chunk lines.

```
{"metadata":{"target_branch":"main","commit_message":"msg","author":{"name":"Bot","email":"bot@x.com"},"files":[{"path":"README.md","operation":"upsert","content_id":"b1","mode":"100644"}]}}
{"blob_chunk":{"content_id":"b1","data":"BASE64_CONTENT","eof":true}}
```

Key metadata fields: `target_branch`*, `commit_message`*, `author`* (`name`+`email`), `files`*, `expected_head_sha`, `base_branch`, `committer`, `ephemeral`, `ephemeral_base`
File operations: `upsert` (default) or `delete`. For `delete`, omit blob chunks; only the metadata entry is required. `data` is base64; decoded chunks must be 4 MiB or smaller.
Response `201`: `{ "commit": { "commit_sha", "tree_sha", "target_branch", "pack_bytes", "blob_count" }, "result": { "branch", "old_sha", "new_sha", "success", "status", "message" } }`
Errors: `409` head SHA mismatch, `404` base branch not found

## POST /repos/diff-commit — Create Commit from Diff

Content-Type: `application/x-ndjson`
Same pattern as commit-pack but uses `diff_chunk` instead of `blob_chunk`.

```
{"metadata":{"target_branch":"main","commit_message":"Apply patch","author":{"name":"Bot","email":"bot@x.com"}}}
{"diff_chunk":{"data":"BASE64_ENCODED_DIFF","eof":true}}
```

Diff must be compatible with `git apply --cached --binary`. Same response schema as commit-pack.

## GET /repos/commits — List Commits

```bash
curl "$CODE_STORAGE_BASE_URL/repos/commits?branch=main&limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Response: `{ "commits": [{ "sha", "message", "author_name", "author_email", "date" }], "next_cursor", "has_more" }`

## GET /repos/commit — Get Commit

```bash
curl "$CODE_STORAGE_BASE_URL/repos/commit?sha=COMMIT_SHA" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `sha` (required — full SHA, short SHA, branch name, or any revision Git
can resolve). Returns commit metadata only; use `/repos/diff` for the diff.
Response: `{ "commit": { "sha", "message", "author_name", "author_email", "committer_name", "committer_email", "date" } }`
Errors: `400` missing/blank `sha`, `404` commit not found.

## GET /repos/diff — Get Commit Diff

```bash
curl "$CODE_STORAGE_BASE_URL/repos/diff?sha=COMMIT_SHA&baseSha=OPTIONAL_BASE&path=src/foo.go" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `sha`(required), `baseSha`, `path` (repeatable)
Response: `{ "sha", "stats", "files": [...], "filtered_files": [...] }`
Large files (>500KB) or binary files appear in `filtered_files` without diff content.

## POST /repos/restore-commit — Restore Branch to Commit

Content-Type: `application/json`. Body wraps the metadata in a `metadata` envelope:

```bash
curl "$CODE_STORAGE_BASE_URL/repos/restore-commit" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"target_branch":"main","target_commit_sha":"abc123...","author":{"name":"Bot","email":"bot@x.com"},"commit_message":"Rollback"}}'
```

Required metadata fields: `target_branch`, `target_commit_sha`, `author` (`name`+`email`).
Optional: `commit_message`, `expected_head_sha` (guard), `committer`.
Response: same schema as commit-pack result. Failed ref updates surface as
`RefUpdateError` in the SDKs (status, message, ref details preserved).

## GET /repos/files — List Files

```bash
curl "$CODE_STORAGE_BASE_URL/repos/files?ref=main&ephemeral=false" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `ref` (branch/SHA, defaults to default branch), `ephemeral`
Response: `{ "paths": ["README.md", "src/index.js", ...], "ref": "main" }`

## GET /repos/files/metadata — List Files with Git Metadata

```bash
curl "$CODE_STORAGE_BASE_URL/repos/files/metadata?ref=main&ephemeral=false" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `ref` (branch/SHA, falls back to default branch then `HEAD` then `main`), `ephemeral`.
This endpoint is unpaginated and returns the full file list in one response.
Response: `{ "files": [{ "path", "mode", "size", "last_commit_sha" }], "commits": { "sha": { "author", "date", "message" } }, "ref": "main" }`

## GET /repos/file — Get File Content

```bash
curl "$CODE_STORAGE_BASE_URL/repos/file?path=src/main.go&ref=main" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Response: raw file bytes (streaming), `Content-Type` set appropriately.

## GET /repos/blame — Blame File

```bash
curl "$CODE_STORAGE_BASE_URL/repos/blame?path=src/main.go&ref=main&start_line=10&end_line=30&detect_moves=true" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `path` (required — repository-relative file path), `ref` (branch, tag, or
SHA; defaults to the repository default branch), `ephemeral` (resolve `ref` from
the ephemeral namespace), `start_line`/`end_line` (1-based inclusive; both zero
blames the whole file), `detect_moves` (follow renames and copies).
Response:
```json
{
  "ref": "main",
  "path": "src/main.go",
  "commit": "<resolved sha>",
  "lines": [{
    "line_number": 1,
    "commit_sha": "...",
    "original_line_number": 1,
    "original_path": "src/main.go",
    "text": "..."
  }],
  "commits": {
    "<sha>": {
      "previous_commit_sha": "...",
      "author_name": "...", "author_email": "...", "author_time": "...",
      "committer_name": "...", "committer_email": "...", "committer_time": "...",
      "summary": "..."
    }
  }
}
```
The top-level `commit` is the SHA the input ref resolved to. The `commits` map
holds per-commit metadata for every authoring commit referenced by `lines[]`,
deduped by SHA. Errors: `400` missing/invalid params, `404` ref/path not found.

## POST /repos/grep — Search Content (Beta)

```bash
curl "$CODE_STORAGE_BASE_URL/repos/grep" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "main",
    "query": {"pattern": "function.*Error", "case_sensitive": false},
    "file_filters": {"include_globs": ["*.ts"], "exclude_globs": ["node_modules/**"]},
    "context": {"before": 2, "after": 2},
    "limits": {"max_lines": 1000},
    "pagination": {"limit": 100}
  }'
```

Response: `{ "matches": [{ "path", "lines": [{ "line_number", "text", "type" }] }], "next_cursor", "has_more" }`

## POST /repos/archive — Download Archive

```bash
curl "$CODE_STORAGE_BASE_URL/repos/archive" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","include_globs":["src/**"],"exclude_globs":["vendor/**"],"archive":{"prefix":"repo/"}}' \
  -o repo.tar.gz
```

Response: streaming `tar.gz`. Headers: `Content-Type: application/gzip`.

## Tags Endpoints (POST/GET/DELETE /repos/tags)

```bash
# Create lightweight tag
curl "$CODE_STORAGE_BASE_URL/repos/tags" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"v1.0.0","target":"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"}'

# List tags
curl "$CODE_STORAGE_BASE_URL/repos/tags?limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Delete tag
curl "$CODE_STORAGE_BASE_URL/repos/tags" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"v1.0.0"}'
```

Tag names must not start with `refs/`. `target` must be a full 40-character lowercase hex commit SHA.
Create uses `git:write`; list uses `git:read`; delete requires both `git:read` and `git:write`.
If the repository is synced to GitHub, tag create/delete triggers sync automatically.

## Notes Endpoints (POST/GET/DELETE /repos/notes)

POST creates or appends, differentiated by the `action` field (`"add"` or
`"append"`). DELETE does not take an `action`.

```bash
# Create note
curl "$CODE_STORAGE_BASE_URL/repos/notes" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"sha":"COMMIT_SHA","action":"add","note":"Build passed","author":{"name":"CI","email":"ci@x.com"}}'

# Append to note
curl "$CODE_STORAGE_BASE_URL/repos/notes" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"sha":"COMMIT_SHA","action":"append","note":"\nDeployed to staging","author":{"name":"CI","email":"ci@x.com"}}'

# Get note
curl "$CODE_STORAGE_BASE_URL/repos/notes?sha=COMMIT_SHA" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Delete note
curl "$CODE_STORAGE_BASE_URL/repos/notes" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"sha":"COMMIT_SHA","author":{"name":"CI","email":"ci@x.com"}}'
```

Optional fields on writes: `expected_ref_sha` (optimistic guard), `author` (`name`+`email`).
Write response: `{ "sha", "target_ref": "refs/notes/commits", "base_commit?", "new_ref_sha", "result": { "success", "status", "message?" } }`
Read response: `{ "sha", "note", "ref_sha" }`

## POST /repos/pull-upstream — Sync from Upstream

```bash
curl "$CODE_STORAGE_BASE_URL/repos/pull-upstream" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'                # or '{"ref":"main"}' to scope the sync to one ref
```

Optional body: `{ "ref": "BRANCH_OR_REF" }` to limit the pull to a single ref.
Returns `202 Accepted`. Sync is async. Only works if repo was created with `base_repo`.
Works for GitHub App sync and generic HTTPS Git Sync providers with stored credentials.

## DELETE /repos/base — Detach Upstream

```bash
curl "$CODE_STORAGE_BASE_URL/repos/base" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Idempotent. Removes the upstream Git Sync link.

# PAGINATION

All list endpoints use cursor-based pagination.

```bash
# First page
curl "$CODE_STORAGE_BASE_URL/repos/commits?branch=main&limit=20"

# Subsequent pages — use next_cursor from previous response
curl "$CODE_STORAGE_BASE_URL/repos/commits?branch=main&limit=20&cursor=NEXT_CURSOR_VALUE"
```

Stop when `"has_more": false` or `next_cursor` is absent.

# AGENT PROCEDURES (MULTI-STEP RECIPES)

## PROCEDURE 1: New Repository + First Commit

**Goal:** Create a repo and push initial files via HTTP API (no local git required).

```bash
# Step 1 — Mint JWT with repo:write scope for the new repo ID
# (Use SDK or manual JWT generation; set TOKEN env var)
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-app --scope repo:write)"

# Step 2 — Create the repository
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_branch":"main"}'
# Response: { "repo_id": "my-app", ... }

# Step 3 — Mint JWT with git:write scope for commits
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-app --scope git:write)"

# Step 4 — Create first commit via NDJSON stream
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"main","commit_message":"Initial commit","author":{"name":"Agent","email":"agent@x.com"},"files":[{"path":"README.md","operation":"upsert","content_id":"f1"}]}}' \
  '{"blob_chunk":{"content_id":"f1","data":"IyBIZWxsbwp=","eof":true}}' | \
curl "$CODE_STORAGE_BASE_URL/repos/commit-pack" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" \
  --data-binary @-
# Response: { "commit": { "commit_sha": "abc123..." }, "result": { "success": true } }
```

## PROCEDURE 2: Clone Repo into Sandbox (Git)

**Goal:** Get an authenticated git URL and clone into an ephemeral environment.

```bash
# Step 1 — Mint JWT with git:read (or git:write) scope
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-app --scope git:read --ttl 3600)"

# Step 2 — Build remote URL
REMOTE_URL="https://t:${CODE_STORAGE_TOKEN}@${ORG_NAME}.code.storage/my-app.git"

# Step 3 — Shallow clone (fastest for sandboxes)
git clone --depth 1 --single-branch "$REMOTE_URL" ./repo

# Step 4 — Work, then push (requires git:write JWT in remote URL)
cd repo
git add . && git commit -m "Agent changes"
git push
```

## PROCEDURE 3: Ephemeral Branch Workflow (Preview Environment)

**Goal:** Create isolated preview branch, work, then promote to persistent branch.

```bash
# Step 1 — Create ephemeral commit (sets up ephemeral branch)
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"preview/pr-42","base_branch":"main","ephemeral":true,"commit_message":"Preview for PR 42","author":{"name":"CI","email":"ci@x.com"},"files":[{"path":"index.html","operation":"upsert","content_id":"h1"}]}}' \
  '{"blob_chunk":{"content_id":"h1","data":"PGgxPlByZXZpZXc8L2gxPg==","eof":true}}' | \
curl "$CODE_STORAGE_BASE_URL/repos/commit-pack" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" --data-binary @-

# Step 2 — Read files from ephemeral branch
curl "$CODE_STORAGE_BASE_URL/repos/files?ref=preview/pr-42&ephemeral=true" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Step 3 — Promote ephemeral branch to persistent (uses createBranch)
curl "$CODE_STORAGE_BASE_URL/repos/branches/create" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base_ref":"preview/pr-42","target_branch":"feature/new-ui","base_is_ephemeral":true,"target_is_ephemeral":false}'
```

## PROCEDURE 4: Fork + Customize (Template Pattern)

**Goal:** Create new project from a template repo, then customize it.

```bash
# Step 1 — Mint repo:write JWT for new repo; also need git:read JWT for source
SOURCE_TOKEN="$(mint_jwt --repo templates/starter --scope git:read)"
export CODE_STORAGE_TOKEN="$(mint_jwt --repo users/alice/my-project --scope repo:write)"

# Step 2 — Fork template
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"base_repo\":{\"provider\":\"code\",\"owner\":\"$ORG_NAME\",\"name\":\"templates/starter\",\"operation\":\"fork\",\"ref\":\"main\",\"auth\":{\"token\":\"$SOURCE_TOKEN\"}}}"

# Step 3 — Customize with a commit
export CODE_STORAGE_TOKEN="$(mint_jwt --repo users/alice/my-project --scope git:write)"
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"main","commit_message":"Initialize project","author":{"name":"System","email":"system@x.com"},"files":[{"path":"README.md","operation":"upsert","content_id":"r1"}]}}' \
  '{"blob_chunk":{"content_id":"r1","data":"IyBNeSBQcm9qZWN0Cg==","eof":true}}' | \
curl "$CODE_STORAGE_BASE_URL/repos/commit-pack" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" --data-binary @-
```

## PROCEDURE 5: Git Sync Setup

**Goal:** Create a repo mirrored from GitHub or a generic HTTPS Git provider and keep it in sync.

```bash
# Step 1 — Create repo with GitHub base_repo (GitHub App must be installed)
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-synced-repo --scope repo:write)"
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_branch":"main","base_repo":{"provider":"github","owner":"my-org","name":"my-repo","default_branch":"main"}}'

# Or create with a generic provider, then store credentials.
# Provider values: gitlab, bitbucket, gitea, forgejo, codeberg, sr.ht.
# For self-hosted remotes, include upstream_host in base_repo.
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_branch":"main","base_repo":{"provider":"gitlab","owner":"my-group","name":"my-repo","default_branch":"main"}}'

curl "$CODE_STORAGE_BASE_URL/repos/git-credentials" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repo_id":"REPO_ID","username":"git","password":"ACCESS_TOKEN_OR_PASSWORD"}'

# Step 2 — Trigger initial sync from the configured upstream
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-synced-repo --scope git:write)"
curl "$CODE_STORAGE_BASE_URL/repos/pull-upstream" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
# Returns 202 — sync is async

# Step 3 — (Optional) Detach if sync no longer needed
curl "$CODE_STORAGE_BASE_URL/repos/base" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

## PROCEDURE 6: Search and Apply Patch

**Goal:** Find code with grep, generate a diff, apply it as a commit.

```bash
# Step 1 — Search for pattern
curl "$CODE_STORAGE_BASE_URL/repos/grep" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","query":{"pattern":"TODO","case_sensitive":false},"file_filters":{"exclude_globs":["node_modules/**"]}}'

# Step 2 — Generate patch (standard unified diff format)
PATCH_B64=$(echo "$DIFF_TEXT" | base64)

# Step 3 — Apply as commit
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"main","commit_message":"Fix TODOs","author":{"name":"Agent","email":"agent@x.com"}}}' \
  "{\"diff_chunk\":{\"data\":\"$PATCH_B64\",\"eof\":true}}" | \
curl "$CODE_STORAGE_BASE_URL/repos/diff-commit" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" --data-binary @-
```

## PROCEDURE 7: Mint a Force-Push-Prevented Remote URL (SDK)

**Goal:** Hand out a clone/push URL that cannot rewrite history.

```typescript
import { GitStorage, OP_NO_FORCE_PUSH } from '@pierre/storage';

const store = new GitStorage({ name: process.env.ORG_NAME!, key: process.env.PIERRE_PRIVATE_KEY! });
const repo = store.repo({ id: 'team/project' });
const safeRemote = await repo.getRemoteURL({
  permissions: ['git:write'],
  ttl: 3600,
  ops: [OP_NO_FORCE_PUSH],
});
// git push to safeRemote — non-fast-forward updates are rejected.
```

```python
from pierre_storage import GitStorage, OP_NO_FORCE_PUSH

store = GitStorage(name=ORG_NAME, key=PIERRE_PRIVATE_KEY)
repo = store.repo(id="team/project")
safe_remote = await repo.get_remote_url(
    permissions=["git:write"],
    ttl=3600,
    ops=[OP_NO_FORCE_PUSH],
)
```

The same `ops` array also works on `getEphemeralRemoteURL` and
`getImportRemoteURL`. When minting JWTs by hand, add `"ops": ["no-force-push"]`
to the payload before signing.

## PROCEDURE 8: Rollback a Branch

**Goal:** Reset a branch to a known-good commit SHA.

```bash
# Step 1 — List commits to find the target SHA
curl "$CODE_STORAGE_BASE_URL/repos/commits?branch=main&limit=20" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Step 2 — Restore branch to that commit
curl "$CODE_STORAGE_BASE_URL/repos/restore-commit" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"target_branch":"main","target_commit_sha":"GOOD_SHA","author":{"name":"Agent","email":"agent@x.com"},"commit_message":"Rollback to stable"}}'
```

# ERROR HANDLING GUIDE

All API errors return JSON: `{ "error": "description" }` plus HTTP status code.
**Branch on status codes, not error strings** (error strings are not stable).

| HTTP Status | Meaning                         | Agent Action                                                                 |
|-------------|---------------------------------|------------------------------------------------------------------------------|
| **400**     | Bad request / invalid params    | Fix request body or query params. Check required fields and formats.         |
| **401**     | Invalid or missing JWT          | Re-mint JWT. Verify `iss`, `repo`, `exp` claims. Check key matches org.     |
| **403**     | JWT valid but missing scope     | Re-mint JWT with required scope (`git:read`, `git:write`, `repo:write`).    |
| **404**     | Resource not found              | Verify repo ID, branch name, file path, or commit SHA. Repo may be empty.   |
| **409**     | Conflict (optimistic lock)      | Fetch current state (`GET /repo`, list commits), resolve, retry with fresh `expected_head_sha`. |
| **500**     | Internal server error           | Retry once with exponential backoff. If persistent, contact support.         |
| **502/503** | Storage unavailable / sync busy | Wait and retry. Repository may be mid-sync or storage temporarily offline.   |
| **504**     | Gateway timeout                 | Retry the operation. If streaming commit, reduce chunk size.                 |

### Specific Scenarios

**JWT expired (401):**
```bash
# Re-mint and retry
export CODE_STORAGE_TOKEN="$(mint_jwt --repo REPO --scope SCOPE --ttl 3600)"
# then retry the original curl
```

**Head SHA mismatch (409 on commit):**
```bash
# Fetch current HEAD
CURRENT_SHA=$(curl "$CODE_STORAGE_BASE_URL/repos/commits?limit=1" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" | jq -r '.commits[0].sha')
# Include in next commit attempt as expected_head_sha
```

**Diff cannot be applied (400/result.success=false on diff-commit):**
Check `result.status` in response: `conflict` = merge conflict, `precondition_failed` = head SHA
mismatch, empty diff = no changes. Re-generate the diff against current HEAD.

**Empty repo / 404 on file list:**
Repo exists but has no commits yet. Run PROCEDURE 1 Step 4 to create initial commit.

**503 during grep/archive:**
Repository may be warming up from cold tier storage. Wait 5-10 seconds and retry.

# GIT OPERATIONS REFERENCE

```bash
# Clone (git:read JWT)
git clone "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_ID}.git"

# Push (git:write JWT)
git push "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_ID}.git" main

# Ephemeral remote (insert +ephemeral before .git)
git remote add ephemeral "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_ID}+ephemeral.git"
git push ephemeral feature-branch

# Promote ephemeral → default
git fetch ephemeral feature-branch:feature-branch
git push origin feature-branch
```

**JWT TTL guidelines:**
- CI/CD pipelines: `ttl=3600` (1 hour)
- Development environment: `ttl=2592000` (30 days)
- Sandbox/ephemeral tasks: `ttl=3600` (1 hour)

# KEY CONCEPTS CHEATSHEET

| Concept               | Details                                                                                 |
|-----------------------|-----------------------------------------------------------------------------------------|
| Repo ID               | String; can contain `/` for namespacing (e.g. `team/project`, `users/alice/app`)       |
| JWT `repo` claim      | Must match exactly the repo ID being accessed                                           |
| Ephemeral namespace   | Set `ephemeral:true` on commits/files; URL: `REPO_ID+ephemeral.git`; no GitHub sync    |
| Forking               | One-time copy from Code Storage repo. Independent after fork. Same org only.           |
| Git Sync              | Upstream sync via GitHub App or generic HTTPS Git providers with stored credentials.   |
| Notes                 | Attach metadata to commits without modifying commit SHA. Stored in `refs/notes/commits`|
| Pagination            | Cursor-based. Pass `next_cursor` as `cursor` param. Stop when `has_more: false`.       |
| Blob data encoding    | Always base64. Max 4 MiB per chunk. Use multiple chunks for large files.               |
| `expected_head_sha`   | Optimistic lock. Provide current branch tip SHA to enforce fast-forward semantics.      |
| Policy ops (`ops`)    | JWT-level guards. `no-force-push` (TS/Py `OP_NO_FORCE_PUSH`, Go `OpNoForcePush`) blocks non-FF updates. |
| Merge endpoint        | `POST /repos/merge`; strategies: `merge`, `ff_only`, `ff_prefer`. 409 on conflict.       |
