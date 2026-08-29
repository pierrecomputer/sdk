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
| `CODE_STORAGE_BASE_URL` | Derived base URL for HTTP API                                  | `https://api.acme.code.storage/api`              |
| `REPO_NAME`             | Raw repository name; use this value in the JWT `repo` claim    | `pierre/example`                                 |
| `REPO_NAME_ENCODED`     | Repository name encoded as one URL path segment                | `pierre%2Fexample`                               |
| `CODE_STORAGE_TOKEN`    | JWT minted for current operation (per-repo or org-wide)        | `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...`       |

Export for curl sessions:
```bash
export ORG_NAME="your-org"
export CODE_STORAGE_BASE_URL="https://api.${ORG_NAME}.code.storage/api"
export REPO_NAME="pierre/example"
export REPO_NAME_ENCODED="pierre%2Fexample"
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
  "refs": [                    // Optional per-ref policy rules (first match wins)
    ["refs/heads/main", ["no-push"]],
    ["refs/heads/feature/*", ["no-force-push"]]
  ],
  "iat": 1723453189,
  "exp": 1723456789
}
```

JWT header: `{ "alg": "ES256", "typ": "JWT" }` (RS256 and EdDSA also supported)

### Policy Operations

| Op string        | SDK constant                                                                 | Effect                                                |
|------------------|------------------------------------------------------------------------------|-------------------------------------------------------|
| `no-force-push`  | TS `OP_NO_FORCE_PUSH` / Py `OP_NO_FORCE_PUSH` / Go `storage.OpNoForcePush`   | Rejects force pushes / non-fast-forward ref updates. |
| `no-push`        | TS `OP_NO_PUSH` / Py `OP_NO_PUSH` / Go `storage.OpNoPush`                    | Rejects any push to matching refs.                   |
| `verify-sig`     | TS `OP_VERIFY_SIG` / Py `OP_VERIFY_SIG` / Go `storage.OpVerifySig`           | Rejects pushes introducing commits without a valid signature from a registered signing key. |

#### Per-ref policies (preferred, use this for new code)

The `refs` claim is an **ordered** array of `[pattern, [ops...]]` tuples.
Rules are evaluated in declaration order. The first pattern that matches the ref
wins. Patterns may be fully-qualified refs (`refs/heads/main`), prefix globs
(`refs/heads/feature/*`, `refs/tags/*`), or `*` for every ref. Short branch names
like `main` are normalized to `refs/heads/main` on verify. The policies are
accepted by every URL-minting method and every ref-mutating REST method via the
SDK option `refPolicies` (TS), `ref_policies` (Py), `RefPolicies` (Go).

#### Repo-wide `ops` (legacy, do not use in new code)

The optional top-level `ops` claim applies to every ref. On verify it is folded
into the catch-all `*` rule. It is merged into an existing `*` entry in the ref
policies when one is present, or appended as a new trailing `*` rule otherwise.
Only available on the URL-minting methods (`getRemoteURL` /
`getEphemeralRemoteURL` / `getImportRemoteURL`). Use
`refPolicies: [{ pattern: '*', ops: [...] }]` instead.

```typescript
await repo.getRemoteURL({
  refPolicies: [
    { pattern: 'refs/heads/main', ops: [OP_NO_PUSH] },
    { pattern: '*', ops: [OP_NO_FORCE_PUSH] },
  ],
});
```

```python
await repo.get_remote_url(
    ref_policies=[
        {"pattern": "refs/heads/main", "ops": [OP_NO_PUSH]},
        {"pattern": "*", "ops": [OP_NO_FORCE_PUSH]},
    ],
)
```

```go
repo.RemoteURL(ctx, storage.RemoteURLOptions{
    RefPolicies: storage.RefPolicyList{
        {Pattern: "refs/heads/main", Ops: storage.Ops{storage.OpNoPush}},
        {Pattern: "*", Ops: storage.Ops{storage.OpNoForcePush}},
    },
})
```

### Permission Scopes

| Scope        | Grants                          | Required By                                    |
|--------------|---------------------------------|------------------------------------------------|
| `git:read`   | clone, fetch, pull, read API    | GET file/branch/commit/diff/grep endpoints     |
| `git:write`  | push, write API (includes read) | POST/DELETE commit/branch/note endpoints       |
| `repo:write` | create/delete repositories      | POST /repos, DELETE /repos/{repo_name}              |
| `org:read`   | list all repos in org           | GET /repos (list)                              |

### Git Remote URL Format

```
https://t:{JWT}@{ORG_NAME}.code.storage/{REPO_NAME}.git
```
Username is always `t`. Password is the JWT.

# QUICK-REFERENCE ENDPOINT TABLE

| Goal                          | Method   | Endpoint                          | Scope Required  |
|-------------------------------|----------|-----------------------------------|-----------------|
| **REPOSITORIES**              |          |                                   |                 |
| Create repository             | POST     | `/repos`                          | `repo:write`    |
| List all repositories         | GET      | `/repos`                          | `org:read`      |
| Get repository metadata       | GET      | `/repos/{repo_name}`              | (repo in JWT)   |
| Delete repository             | DELETE   | `/repos/{repo_name}`              | `repo:write`    |
| **BRANCHES**                  |          |                                   |                 |
| Create branch                 | POST     | `/repos/{repo_name}/branches/create`          | `git:write`     |
| List branches                 | GET      | `/repos/{repo_name}/branches`                 | `git:read`      |
| Get branch by name            | GET      | `/repos/{repo_name}/branch?name=...`          | `git:read`      |
| Get branch diff               | GET      | `/repos/{repo_name}/branches/diff`            | `git:read`      |
| Preview merge                 | GET      | `/repos/{repo_name}/merge/preview`            | `git:read`      |
| Merge branches                | POST     | `/repos/{repo_name}/merge`                    | `git:write`     |
| Delete branch                 | DELETE   | `/repos/{repo_name}/branches`                 | `git:write`     |
| **COMMITS**                   |          |                                   |                 |
| Create commit (file blobs)    | POST     | `/repos/{repo_name}/commit-pack`              | `git:write`     |
| Create commit from diff/patch | POST     | `/repos/{repo_name}/diff-commit`              | `git:write`     |
| List commits                  | GET      | `/repos/{repo_name}/commits`                  | `git:read`      |
| Get commit                    | GET      | `/repos/{repo_name}/commit`                   | `git:read`      |
| Get commit diff               | GET      | `/repos/{repo_name}/diff`                     | `git:read`      |
| Restore branch to commit      | POST     | `/repos/{repo_name}/restore-commit`           | `git:write`     |
| **FILES**                     |          |                                   |                 |
| List files at ref             | GET      | `/repos/{repo_name}/files`                    | `git:read`      |
| List files with metadata      | GET      | `/repos/{repo_name}/files/metadata`           | `git:read`      |
| Get file content (stream)     | GET/HEAD | `/repos/{repo_name}/file`                     | `git:read`      |
| Blame file at ref             | GET      | `/repos/{repo_name}/blame`                    | `git:read`      |
| Search content (grep)         | POST     | `/repos/{repo_name}/grep`                     | `git:read`      |
| Download archive (tar.gz)     | POST     | `/repos/{repo_name}/archive`                  | `git:read`      |
| **TAGS**                      |          |                                   |                 |
| Create tag                    | POST     | `/repos/{repo_name}/tags`                     | `git:write`     |
| List tags                     | GET      | `/repos/{repo_name}/tags`                     | `git:read`      |
| Get tag by name               | GET      | `/repos/{repo_name}/tag?name=...`             | `git:read`      |
| Delete tag                    | DELETE   | `/repos/{repo_name}/tags/{tag_name}` | `git:read`+`git:write` |
| **NOTES**                     |          |                                   |                 |
| Create note on commit         | POST     | `/repos/{repo_name}/notes` (action:"add")     | `git:write`     |
| Append to note                | POST     | `/repos/{repo_name}/notes` (action:"append")  | `git:write`     |
| Get note for commit           | GET      | `/repos/{repo_name}/notes?object_ref=REF`     | `git:read`      |
| Delete note                   | DELETE   | `/repos/{repo_name}/notes`                    | `git:write`     |
| List notes refs               | GET      | `/repos/{repo_name}/notes/refs`               | `git:read`      |
| **GIT SYNC**                  |          |                                   |                 |
| Pull from upstream            | POST     | `/repos/{repo_name}/pull-upstream`            | `git:write`     |
| Detach upstream               | DELETE   | `/repos/{repo_name}/base`                     | `git:write`     |
| **GENERIC GIT SYNC**          |          |                                   |                 |
| Create Git credential         | POST     | `/repos/{repo_name}/git-credentials`          | `repo:write`    |
| Update Git credential         | PUT      | `/repos/{repo_name}/git-credentials/{git_credential_id}` | `repo:write`    |
| Delete Git credential         | DELETE   | `/repos/{repo_name}/git-credentials/{git_credential_id}` | `repo:write`    |

All endpoints: `BASE_URL = https://api.{org}.code.storage/api`
`{repo_name}` is the repository name as a single URL-encoded path segment
(`pierre/example` -> `pierre%2Fexample`); it must match the JWT `repo` claim.
The SDKs keep explicit compatibility for deprecated credential call shapes.
New integrations must use the paths above.
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
After creating a generic Git Sync repository, store upstream credentials with `/repos/{repo_name}/git-credentials`.

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
    "name": "source-repo-name",
    "operation": "fork",
    "ref": "main",
    "auth": { "token": "JWT_WITH_GIT_READ_ON_SOURCE" }
  }
}
```
`provider` for forks is the literal string `"code"`. Forking also supports `sha`
to pin an exact source commit; `sha` overrides `ref`. `owner` is the
organization name (the same value used as the JWT `iss`).

Response `200` or `201` includes both identities: `{ "repo_id": "repo_7f2b3d9", "repo_name": "team/project", "message": "repository created" }`.
`repo_id` is the stable internal repository ID. `repo_name` is the public name or path used in API
paths, Git URLs, and the JWT `repo` claim.
Errors: `401` bad JWT/scope, `409` repo already exists or upstream already configured, `412` GitHub App config required for authenticated GitHub sync

## POST/PUT/DELETE /repos/{repo_name}/git-credentials — Manage Generic Git Sync Credentials

Use this endpoint family for generic HTTPS Git providers such as GitLab, Bitbucket, Gitea,
Forgejo, Codeberg, sr.ht, and self-hosted remotes.

```bash
# Create credential
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/git-credentials" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"git","password":"ACCESS_TOKEN_OR_PASSWORD"}'

# Update credential
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/git-credentials/CREDENTIAL_ID" -X PUT \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"git","password":"ROTATED_ACCESS_TOKEN"}'

# Delete credential
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/git-credentials/CREDENTIAL_ID" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

`username` is optional for token-only providers. A repository can have one stored Git credential.
GitHub App sync does not use this endpoint.

For SDK calls, use `repoName` (TypeScript), `repo_name` (Python), or `RepoName`
(Go). The create-only `repoId`, `repo_id`, and `RepoID` inputs are deprecated
internal repository IDs. Update and delete do not accept an internal repository
ID. Calls without the preferred repository name keep their old request shape
only for source compatibility.

## GET /repos — List Repositories

```bash
curl "$CODE_STORAGE_BASE_URL/repos?limit=20&cursor=CURSOR&q=sdk" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `cursor` (pagination), `limit` (default 20, max 100), `q` (optional
case-insensitive substring matched against the repository `url`, trimmed before
matching, empty/whitespace is treated as omitted)
Scope: `org:read`
Response: `{ "repos": [...], "next_cursor": "...", "has_more": true }`

## GET /repos/{repo_name} — Get Repository

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

`{repo_name}` must match the JWT `repo` claim. Returns `404` when the repo does not exist.
Response: `{ "default_branch", "created_at", "base_repo?" }` (the SDKs read
`default_branch` and `created_at`; additional fields may be present.)

## DELETE /repos/{repo_name} — Delete Repository

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Scope: `repo:write`. Deletion is async; physical storage cleanup completes asynchronously.
Errors: `403` missing scope, `404` not found, `409` already deleted

## POST /repos/{repo_name}/branches/create — Create Branch

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branches/create" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base_ref":"refs/heads/main","target_branch":"feature/x","base_is_ephemeral":false,"target_is_ephemeral":false}'
```

Required: `target_branch` plus one of `base_ref` (preferred, accepts `refs/heads/...`,
plain branch names, or commit SHAs) or `base_branch` (deprecated alias).
Optional: `base_is_ephemeral`, `target_is_ephemeral`.
Response: `{ "message", "target_branch", "target_is_ephemeral", "commit_sha" }`

## GET /repos/{repo_name}/branches — List Branches

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branches?limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Optional `ephemeral=true` lists branches under the ephemeral namespace instead of regular branches (defaults to `false`).

Response: `{ "branches": [{ "name", "head_sha", "created_at" }], "next_cursor", "has_more" }`

## GET /repos/{repo_name}/branch — Get Branch by Name

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branch?name=feature%2Fpreview" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Use `ephemeral=true` to read from the ephemeral namespace. The exact response is `{ "branch": { "name", "head_sha", "created_at" } }`. It has no cursor.

SDK methods: TypeScript `getBranch`, Python `get_branch`, and Go `GetBranch`.

## GET /repos/{repo_name}/branches/diff — Get Branch Diff

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branches/diff?branch=BRANCH&base=main&path=src/foo.go" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `branch`(required), `base`, `ephemeral`, `ephemeral_base`, `path` (repeatable)
Response: `{ "branch", "base", "stats": {files,additions,deletions,changes}, "files": [...], "filtered_files": [...] }`
State codes in `files[].state`: `A`=added, `M`=modified, `D`=deleted, `R`=renamed

## POST /repos/{repo_name}/merge — Merge Branches

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/merge" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_ref": "feature/demo",
    "target_branch": "main",
    "strategy": "merge",
    "source_is_ephemeral": false,
    "target_is_ephemeral": false,
    "commit_message": "Merge feature/demo",
    "author": {"name": "Merge Bot", "email": "merge@example.com"}
  }'
```

Required: `source_ref`, `target_branch`, `strategy` (`merge` | `ff_only` | `ff_prefer`).
Optional: `source_is_ephemeral`, `target_is_ephemeral`, `expected_target_sha`,
`commit_message`, `author`, `committer`, `allow_unrelated_histories`, `squash`.

Target-tip modes:
- Set `expected_target_sha` when the target branch must still point at a specific
  commit; movement returns HTTP 409.
- Omit `expected_target_sha` to merge into the current target tip. For native Code
  Storage targets, the gateway may retry stale target/repository movement internally
  while keeping the originally resolved source commit pinned.

Set `squash: true` to collapse the source into a single new commit whose only
parent is the current target tip. It is incompatible with `ff_only`.
Response: `{ "result": "merge_commit"|"fast_forward"|"no_op"|"squash"|"unknown",
  "commit_sha", "tree_sha", "source": {ref,ephemeral,sha},
  "target": {branch,ephemeral,old_sha,new_sha}, "merge_base_sha?", "promoted_commits" }`
Conflicts return HTTP 409 with `conflict_paths` and `merge_base_sha` preserved on the body.

## GET /repos/{repo_name}/merge/preview — Preview Merge

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/merge/preview?source_branch=feature/demo&target_branch=main&include_content=true" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Required params: `source_branch`, `target_branch`.
Optional: `include_content=true` to include bounded conflict blob content.
Scope: `git:read`.

Clean previews return HTTP 200 with `status: "clean"` and `result` set to
`merge_commit`, `fast_forward`, or `no_op`. Conflicted previews also return HTTP
200 with `status: "conflicted"`, `conflict_paths`, optional `conflicts` content,
and `filtered_conflicts` for omitted content such as `max_conflict_files_exceeded`.

## DELETE /repos/{repo_name}/branches — Delete Branch

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branches" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_branch":"feature/old-onboarding"}'
```

The default branch cannot be deleted. If the repository is connected to GitHub sync, branch deletion
triggers a sync automatically.
Response: `{ "target_branch": "feature/old-onboarding", "message": "branch deleted", "ephemeral": false }`

Pass `"ephemeral": true` in the body to delete a branch under the ephemeral namespace. When `ephemeral` is true the default-branch protection is skipped
(the default branch is always non-ephemeral) and GitHub mirroring is not triggered. The response
echoes which namespace the deletion targeted via the `ephemeral` field.

## POST /repos/{repo_name}/commit-pack — Create Commit

Content-Type: `application/x-ndjson`
Send metadata line first, then blob_chunk lines.

```
{"metadata":{"target_branch":"main","commit_message":"msg","author":{"name":"Bot","email":"bot@x.com"},"files":[{"path":"README.md","operation":"upsert","content_id":"b1","mode":"100644"}]}}
{"blob_chunk":{"content_id":"b1","data":"BASE64_CONTENT","eof":true}}
```

Key metadata fields: `target_branch`*, `commit_message`*, `author`* (`name`+`email`), `files`*, `expected_target_sha`, `base_branch`, `committer`, `target_is_ephemeral`, `base_is_ephemeral`
File operations: `upsert` (default) or `delete`. For `delete`, omit blob chunks; only the metadata entry is required. `data` is base64; decoded chunks must be 4 MiB or smaller.
Response `201`: `{ "commit": { "commit_sha", "tree_sha", "target_branch", "pack_bytes", "blob_count" }, "result": { "target_branch", "old_sha", "new_sha", "success", "status", "message" } }`
Errors: `409` head SHA mismatch, `404` base branch not found

## POST /repos/{repo_name}/diff-commit — Create Commit from Diff

Content-Type: `application/x-ndjson`
Same pattern as commit-pack but uses `diff_chunk` instead of `blob_chunk`.

```
{"metadata":{"target_branch":"main","commit_message":"Apply patch","author":{"name":"Bot","email":"bot@x.com"}}}
{"diff_chunk":{"data":"BASE64_ENCODED_DIFF","eof":true}}
```

Diff must be compatible with `git apply --cached --binary`. Same response schema as commit-pack.

## GET /repos/{repo_name}/commits — List Commits

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commits?ref=main&path=docs/guide.md&limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params:
- `ref` (defaults to repository default branch)
- `ephemeral=true` (resolve `ref` from the ephemeral namespace; defaults to `false`)
- `path` (optional repository-relative file or subtree to scope history to —
  only commits that touched that path are returned)
- `cursor`, `limit` (default 20, max 100)

Response: `{ "commits": [{ "sha", "parent_shas", "message", "author_name", "author_email", "committer_name", "committer_email", "date" }], "next_cursor", "has_more" }`
`parent_shas` preserves Git parent order and is an empty array for root commits.

## GET /repos/{repo_name}/commit — Get Commit

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commit?ref=COMMIT_SHA" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `ref` (required — full SHA, short SHA, branch name, or any revision Git
can resolve). Returns commit metadata only; use `/repos/{repo_name}/diff` for the diff.
Response: `{ "commit": { "sha", "parent_shas", "message", "author_name", "author_email", "committer_name", "committer_email", "date", "signature"?, "payload"? } }`
`parent_shas` preserves Git parent order and is an empty array for root commits.
`signature` (armored OpenPGP/SSH block from the commit's gpgsig header) and
`payload` (the exact signed bytes: the raw commit object with the gpgsig header
removed) are present only for signed commits and omitted otherwise. Together
they let callers verify the signature themselves, mirroring GitHub's `verification` object.
Errors: `400` missing/blank `ref`, `404` commit not found.

## GET /repos/{repo_name}/diff — Get Commit Diff

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/diff?ref=COMMIT_SHA&base_ref=OPTIONAL_BASE&git_apply_compatible=true&path=src/foo.go" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `ref` (required), `base_ref`, `ref_is_ephemeral`, `base_is_ephemeral`,
`git_apply_compatible` (boolean), `path` (repeatable).
The default suppresses changes in the amount of whitespace for review readability. Set
`git_apply_compatible=true` when the raw output will be passed to `git apply`; it includes whitespace
changes consistently in file discovery, raw diffs, and stats. When `filtered_files` is empty and
every changed file has non-empty `raw`, concatenating `files[].raw` in response order produces a
patch for the exact base tree.
Response: `{ "sha", "base_sha", "stats", "files": [...], "filtered_files": [...] }`
Large files (>500KB) or binary files appear in `filtered_files` without diff content.

## POST /repos/{repo_name}/restore-commit — Restore Branch to Commit

Content-Type: `application/json`. Body wraps the metadata in a `metadata` envelope:

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/restore-commit" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"target_branch":"main","base_ref":"abc123...","author":{"name":"Bot","email":"bot@x.com"},"commit_message":"Rollback"}}'
```

Required metadata fields: `target_branch`, `base_ref`, `author` (`name`+`email`).
Optional: `commit_message`, `expected_target_sha` (guard), `committer`.
Response: same schema as commit-pack result. Failed ref updates surface as
`RefUpdateError` in the SDKs (status, message, ref details preserved).

## GET /repos/{repo_name}/files — List Files

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/files?ref=main&path=docs&recursive=false&limit=200" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params:
- `ref` (branch/SHA, defaults to the repository default branch)
- `ephemeral` (resolve `ref` from the ephemeral namespace)
- `path` (optional repository-relative subtree; empty means repo root)
- `recursive` (default `true`; set `false` to return only direct children)
- `cursor` + `limit` (opt into paginated response; `limit` defaults to 1000, max 5000)

Response (paginated shape):
```json
{
  "paths": ["docs/guide.md"],
  "entries": [
    { "path": "docs/sub",        "type": "tree", "mode": "040000" },
    { "path": "docs/guide.md",   "type": "blob", "mode": "100644" }
  ],
  "ref": "main",
  "next_cursor": "docs/zz",
  "has_more": true
}
```
`paths` is a flat blob-only list (convenience for callers that don't need
directory entries). `entries` is the structured tree — branch on `type`
(`blob` / `tree` / `symlink` / `submodule`) rather than checking for a
trailing `/`, since trees do not carry one. Omit both `cursor` and `limit` to
get the unpaginated legacy response.

## GET /repos/{repo_name}/files/metadata — List Files with Git Metadata

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/files/metadata?ref=main&path=src&limit=100" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params:
- `ref` (branch/SHA, falls back to default branch → `HEAD` → `main`)
- `ephemeral` (resolve `ref` from the ephemeral namespace)
- `path` (optional repository-relative subtree)
- `recursive` (accepted for symmetry with `/files`; this endpoint is always
  recursive)
- `cursor` + `limit` (opt into paginated response; `limit` defaults to 200,
  max 1000)

Response:
```json
{
  "files": [
    { "path": "src/main.ts", "mode": "100644", "size": 42, "type": "blob", "last_commit_sha": "deadbeef" }
  ],
  "commits": { "deadbeef": { "author": "...", "date": "...", "message": "..." } },
  "ref": "main",
  "next_cursor": "src/zz.ts",
  "has_more": true
}
```
`type` is derived from each entry's git mode. Omit both `cursor` and `limit`
for the unpaginated legacy response.

## GET|HEAD /repos/{repo_name}/file — Get File Content

```bash
# Stream the full file
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/file?path=src/main.go&ref=main" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Fetch just metadata (no body)
curl -I "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/file?path=src/main.go&ref=main" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Partial read + cached revalidation
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/file?path=src/main.go&ref=main" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H 'Range: bytes=0-1023' \
  -H 'If-None-Match: "b10b5ha"'
```

Methods: `GET` returns the file bytes; `HEAD` returns only the headers.
Query params: `path` (required), `ref`, `ephemeral`, `ephemeral_base`.
Both accept `Range`, `If-Range`, `If-Match`, `If-None-Match`,
`If-Modified-Since`, and `If-Unmodified-Since`.

Status codes:
- `200 OK` — full body returned (GET) or metadata-only (HEAD).
- `206 Partial Content` — byte range satisfied; `Content-Range` identifies it.
- `304 Not Modified` — cached representation still valid.
- `412 Precondition Failed` — `If-Match`/`If-Unmodified-Since` failed.
- `416 Requested Range Not Satisfiable` — range outside blob size.

Response headers for successful/ranged responses:
- `ETag` — strong validator equal to the quoted Git blob SHA.
- `Last-Modified` — committer date of the most recent commit reachable from
  `ref` that touched `path`.
- `Accept-Ranges: bytes`.
- `Content-Type: application/octet-stream`.
- `Content-Length` — full size on 200, range size on 206.
- `Content-Range` — present on 206 responses and 416 unsatisfied ranges.
- `X-Blob-Sha` — Git blob SHA of the served file.
- `X-Last-Commit-Sha` — SHA of the most recent commit touching `path`.

SDK HEAD metadata helpers preserve the HTTP status and ranged metadata:
TypeScript exposes `status` and `contentRange`; Python exposes `status_code`
and `content_range`; Go exposes `StatusCode` and `ContentRange`.

## GET /repos/{repo_name}/blame — Blame File

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/blame?path=src/main.go&ref=main&range=10,30&range=/getUser/,+30&detect_moves=true" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Params: `path` (required, repository-relative file path), `ref` (branch, tag, or
SHA, defaults to the repository default branch), `ephemeral` (resolve `ref` from
the ephemeral namespace), `range` (repeatable `git blame -L`-style spec, up to
16 per request, each value is one `-L` argument, e.g. `10,20`, `10,+5`,
`/getUser/,/^}/`, `/getUser/,+30`, `10,`, `,20`, `10`, `:^func .*Foo`,
`:funcname`; when omitted, the whole file is blamed), `detect_moves` (follow
renames and copies).
Response:
```json
{
  "ref": "main",
  "path": "src/main.go",
  "commit_sha": "<resolved sha>",
  "lines": [{
    "line_number": 1,
    "commit_sha": "...",
    "original_line_number": 1,
    "original_path": "src/main.go",
    "previous_commit_sha": "...",
    "author_name": "...", "author_email": "...", "author_time": "...",
    "committer_name": "...", "committer_email": "...", "committer_time": "...",
    "summary": "..."
  }]
}
```
The top-level `commit_sha` is the SHA the input ref resolved to. Each entry in
`lines[]` carries its authoring commit's metadata inline. `previous_commit_sha`
is omitted when the line has no prior version (e.g. introduced in the initial
commit). Errors: `400` missing/invalid params, `404` ref/path not found.

## POST /repos/{repo_name}/grep — Search Content (Beta)

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/grep" -X POST \
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

Optional `"ephemeral": true` in the body resolves `ref` from the ephemeral namespace (defaults to `false`).

Response: `{ "matches": [{ "path", "lines": [{ "line_number", "text", "type" }] }], "next_cursor", "has_more" }`

## POST /repos/{repo_name}/archive — Download Archive

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/archive" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","include_globs":["src/**"],"exclude_globs":["vendor/**"],"archive":{"prefix":"repo/"}}' \
  -o repo.tar.gz
```

Response: streaming `tar.gz`. Headers: `Content-Type: application/gzip`.

## Tags Endpoints (POST/GET /repos/{repo_name}/tags, GET /repos/{repo_name}/tag, DELETE /repos/{repo_name}/tags/{tag_name})

```bash
# Create lightweight tag
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/tags" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"v1.0.0","ref":"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"}'

# List tags
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/tags?limit=20&cursor=CURSOR" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Get one tag by its exact name
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/tag?name=releases%2Fv1.0.0" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Delete tag
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/tags/v1.0.0" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Tag names must not start with `refs/`. `ref` must be a resolvable revision.
Create uses `git:write`; list and exact lookup use `git:read`; delete requires both `git:read` and `git:write`.
The exact response is `{ "tag": { "name", "sha" } }`. The SHA is the dereferenced commit SHA. The response has no cursor or `object_sha`.
SDK methods: TypeScript `getTag`, Python `get_tag`, and Go `GetTag`.
If the repository is synced to GitHub, tag create/delete triggers sync automatically.

## Notes Endpoints (POST/GET/DELETE /repos/{repo_name}/notes)

POST creates or appends, differentiated by the `action` field (`"add"` or
`"append"`). DELETE does not take an `action`.

```bash
# Create note
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"object_ref":"COMMIT_SHA","action":"add","note":"Build passed","author":{"name":"CI","email":"ci@x.com"}}'

# Append to note
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"object_ref":"COMMIT_SHA","action":"append","note":"\nDeployed to staging","author":{"name":"CI","email":"ci@x.com"}}'

# Get note
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes?object_ref=COMMIT_SHA" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Delete note
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"object_ref":"COMMIT_SHA","author":{"name":"CI","email":"ci@x.com"}}'

# Create/read a note on a custom notes ref (default is refs/notes/commits).
# The write `notes_ref` field and the read `notes_ref` query param accept a bare name like
# "reviews" (placed under refs/notes/), the "notes/reviews" shorthand, or a
# fully-qualified "refs/notes/reviews".
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"object_ref":"COMMIT_SHA","action":"add","note":"LGTM","notes_ref":"reviews"}'
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes?object_ref=COMMIT_SHA&notes_ref=reviews" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Optional fields on writes: `expected_notes_ref_sha` (optimistic guard), `author` (`name`+`email`),
`notes_ref` (target notes ref). `add` fails if a note already exists; use `append` to
extend one, or delete then add to replace it.
Write response: `{ "sha", "notes_ref", "base_commit?", "new_ref_sha", "result": { "success", "status", "message?" } }`
(`notes_ref` echoes the resolved notes ref, defaulting to `refs/notes/commits`).
Read response: `{ "sha", "note", "ref_sha" }`

**Notes refs.** Every note lives under a `refs/notes/*` ref. Omit `notes_ref` to use
the default `refs/notes/commits`. A non-default `notes_ref` requires custom notes refs
to be enabled server-side (otherwise HTTP 400 `custom notes refs are not
enabled`); when writing to a custom ref, the JWT's per-ref policies must permit
it. Notes are not synced to a connected GitHub remote — custom refs stay
internal.

## List Notes Refs (GET /repos/{repo_name}/notes/refs)

Enumerate `refs/notes/*` refs under a prefix with cursor pagination — use it to
discover custom notes namespaces before reading individual notes. Requires
custom notes refs to be enabled server-side (otherwise HTTP 400). Scope:
`git:read`.

```bash
# List notes refs under refs/notes/reviews/
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/notes/refs?prefix=reviews/&limit=20" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Query params: `prefix` (notes ref prefix; a bare `reviews/` is placed under
`refs/notes/`, a fully-qualified `refs/notes/*` prefix also works; defaults to
`refs/notes/`), `cursor` (from a previous response), `limit` (default 20).
Response: `{ "refs": [{ "cursor", "ref", "sha" }], "next_cursor?", "has_more", "prefix" }`
where `prefix` is the normalized prefix used for the listing. Paginate by passing
`next_cursor` back as `cursor` until `has_more` is `false`.

## POST /repos/{repo_name}/pull-upstream — Sync from Upstream

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/pull-upstream" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'                # or '{"ref":"main"}' to scope the sync to one ref
```

Optional body: `{ "ref": "BRANCH_OR_REF" }` to limit the pull to a single ref.
Returns `202 Accepted`. Sync is async. Only works if repo was created with `base_repo`.
Works for GitHub App sync and generic HTTPS Git Sync providers with stored credentials.

## DELETE /repos/{repo_name}/base — Detach Upstream

```bash
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/base" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

Idempotent. Removes the upstream Git Sync link.

# PAGINATION

All list endpoints use cursor-based pagination.

```bash
# First page
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commits?ref=main&limit=20"

# Subsequent pages — use next_cursor from previous response
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commits?ref=main&limit=20&cursor=NEXT_CURSOR_VALUE"
```

Stop when `"has_more": false` or `next_cursor` is absent.

# AGENT PROCEDURES (MULTI-STEP RECIPES)

## PROCEDURE 1: New Repository + First Commit

**Goal:** Create a repo and push initial files via HTTP API (no local git required).

```bash
# Step 1 — Mint JWT with repo:write scope for the new public repository name
export REPO_NAME="my-app"
export REPO_NAME_ENCODED="my-app"
# (Use SDK or manual JWT generation; set TOKEN env var)
export CODE_STORAGE_TOKEN="$(mint_jwt --repo "$REPO_NAME" --scope repo:write)"

# Step 2 — Create the repository
curl "$CODE_STORAGE_BASE_URL/repos" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_branch":"main"}'
# Response: { "repo_id": "repo_7f2b3d9", "repo_name": "my-app", ... }
# Keep repo_id only when you need the stable internal identifier.

# Step 3 — Mint JWT with git:write scope for commits
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-app --scope git:write)"

# Step 4 — Create first commit via NDJSON stream
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"main","commit_message":"Initial commit","author":{"name":"Agent","email":"agent@x.com"},"files":[{"path":"README.md","operation":"upsert","content_id":"f1"}]}}' \
  '{"blob_chunk":{"content_id":"f1","data":"IyBIZWxsbwp=","eof":true}}' | \
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commit-pack" -X POST \
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
  '{"metadata":{"target_branch":"preview/pr-42","base_branch":"main","target_is_ephemeral":true,"commit_message":"Preview for PR 42","author":{"name":"CI","email":"ci@x.com"},"files":[{"path":"index.html","operation":"upsert","content_id":"h1"}]}}' \
  '{"blob_chunk":{"content_id":"h1","data":"PGgxPlByZXZpZXc8L2gxPg==","eof":true}}' | \
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commit-pack" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" --data-binary @-

# Step 2 — Read files from ephemeral branch
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/files?ref=preview/pr-42&ephemeral=true" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Step 3 — Promote ephemeral branch to persistent (uses createBranch)
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/branches/create" -X POST \
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
export REPO_NAME="users/alice/my-project"
export REPO_NAME_ENCODED="users%2Falice%2Fmy-project"

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
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commit-pack" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/x-ndjson" --data-binary @-
```

## PROCEDURE 5: Git Sync Setup

**Goal:** Create a repo mirrored from GitHub or a generic HTTPS Git provider and keep it in sync.

```bash
# Step 1 — Create repo with GitHub base_repo (GitHub App must be installed)
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-synced-repo --scope repo:write)"
export REPO_NAME="my-synced-repo"
export REPO_NAME_ENCODED="my-synced-repo"
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

curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/git-credentials" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"git","password":"ACCESS_TOKEN_OR_PASSWORD"}'

# Step 2 — Trigger initial sync from the configured upstream
export CODE_STORAGE_TOKEN="$(mint_jwt --repo my-synced-repo --scope git:write)"
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/pull-upstream" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
# Returns 202 — sync is async

# Step 3 — (Optional) Detach if sync no longer needed
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/base" -X DELETE \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"
```

## PROCEDURE 6: Search and Apply Patch

**Goal:** Find code with grep, generate a diff, apply it as a commit.

```bash
# Step 1 — Search for pattern
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/grep" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","query":{"pattern":"TODO","case_sensitive":false},"file_filters":{"exclude_globs":["node_modules/**"]}}'

# Step 2 — Generate patch (standard unified diff format)
PATCH_B64=$(echo "$DIFF_TEXT" | base64)

# Step 3 — Apply as commit
printf '%s\n%s\n' \
  '{"metadata":{"target_branch":"main","commit_message":"Fix TODOs","author":{"name":"Agent","email":"agent@x.com"}}}' \
  "{\"diff_chunk\":{\"data\":\"$PATCH_B64\",\"eof\":true}}" | \
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/diff-commit" -X POST \
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
  refPolicies: [{ pattern: '*', ops: [OP_NO_FORCE_PUSH] }],
});
// git push to safeRemote. Non-fast-forward updates are rejected.
```

```python
from pierre_storage import GitStorage, OP_NO_FORCE_PUSH

store = GitStorage(name=ORG_NAME, key=PIERRE_PRIVATE_KEY)
repo = store.repo(id="team/project")
safe_remote = await repo.get_remote_url(
    permissions=["git:write"],
    ttl=3600,
    ref_policies=[{"pattern": "*", "ops": [OP_NO_FORCE_PUSH]}],
)
```

The `refPolicies` option (`ref_policies` in Python, `RefPolicies` in Go) is also
accepted by `getEphemeralRemoteURL`, `getImportRemoteURL`, and every
ref-mutating REST method (`createBranch`, `merge`, `createCommit`, notes, tags,
etc.). Define the policy once and reuse it. When minting JWTs by hand, add the
`"refs"` claim to the payload before signing.

> The legacy top-level `ops` claim is still accepted on URL-minting methods for
> backwards compatibility (folded into a catch-all `*` rule on verify), but new
> code should use `refPolicies` everywhere.

## PROCEDURE 8: Rollback a Branch

**Goal:** Reset a branch to a known-good commit SHA.

```bash
# Step 1 — List commits to find the target SHA
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commits?ref=main&limit=20" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN"

# Step 2 — Restore branch to that commit
curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/restore-commit" -X POST \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"target_branch":"main","base_ref":"GOOD_SHA","author":{"name":"Agent","email":"agent@x.com"},"commit_message":"Rollback to stable"}}'
```

# ERROR HANDLING GUIDE

All API errors return JSON: `{ "error": "description" }` plus HTTP status code.
**Branch on status codes, not error strings** (error strings are not stable).

| HTTP Status | Meaning                         | Agent Action                                                                 |
|-------------|---------------------------------|------------------------------------------------------------------------------|
| **400**     | Bad request / invalid params    | Fix request body or query params. Check required fields and formats.         |
| **401**     | Invalid or missing JWT          | Re-mint JWT. Verify `iss`, `repo`, `exp` claims. Check key matches org.     |
| **403**     | JWT valid but missing scope     | Re-mint JWT with required scope (`git:read`, `git:write`, `repo:write`).    |
| **404**     | Resource not found              | Verify repository name, branch name, file path, or commit SHA. The repository may be empty.   |
| **409**     | Conflict (optimistic lock)      | Fetch current state (`GET /repo`, list commits), resolve, retry with fresh `expected_target_sha`. |
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
CURRENT_SHA=$(curl "$CODE_STORAGE_BASE_URL/repos/$REPO_NAME_ENCODED/commits?limit=1" \
  -H "Authorization: Bearer $CODE_STORAGE_TOKEN" | jq -r '.commits[0].sha')
# Include in next commit attempt as expected_target_sha
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
git clone "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_NAME}.git"

# Push (git:write JWT)
git push "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_NAME}.git" main

# Ephemeral remote (insert +ephemeral before .git)
git remote add ephemeral "https://t:${JWT}@${ORG_NAME}.code.storage/${REPO_NAME}+ephemeral.git"
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
| Repository name       | Public name or path; can contain `/` for namespacing (for example, `team/project`)     |
| Internal repo ID      | Stable `repo_id` returned by repository responses; it is not used in Git URLs or JWT `repo` claims |
| JWT `repo` claim      | Must match the raw public repository name exactly                                       |
| Ephemeral namespace   | Set `target_is_ephemeral:true` on commits and `ephemeral:true` on files; URL: `REPO_NAME+ephemeral.git`; no GitHub sync |
| Forking               | One-time copy from Code Storage repo. Independent after fork. Same org only.           |
| Git Sync              | Upstream sync via GitHub App or generic HTTPS Git providers with stored credentials.   |
| Notes                 | Attach metadata to commits without modifying commit SHA. Default ref `refs/notes/commits`; pass `notes_ref` to target another `refs/notes/*` ref (custom refs must be enabled server-side). List refs via `GET /repos/{repo_name}/notes/refs`. |
| Pagination            | Cursor-based. Pass `next_cursor` as `cursor` param. Stop when `has_more: false`.       |
| Blob data encoding    | Always base64. Max 4 MiB per chunk. Use multiple chunks for large files.               |
| `expected_target_sha` | Optimistic lock. Provide current branch tip SHA to enforce fast-forward semantics.      |
| Policy ops            | JWT-level guards via `refPolicies` (per-ref, first match wins, preferred). `no-force-push` (TS/Py `OP_NO_FORCE_PUSH`, Go `OpNoForcePush`) blocks non-FF updates. `no-push` (`OP_NO_PUSH`/`OpNoPush`) blocks pushes to matching refs. `verify-sig` (`OP_VERIFY_SIG`/`OpVerifySig`) blocks pushes introducing commits not signed by a registered signing key. Top-level `ops` is a legacy alias on URL-minting methods only. |
| Merge endpoint        | `POST /repos/{repo_name}/merge`. Strategies: `merge`, `ff_only`, `ff_prefer`. Optional `expected_target_sha` guards the target tip (409 if moved); omit it to merge into the current target tip. Optional `squash` (not with `ff_only`). 409 on conflict. |
| Merge preview         | `GET /repos/{repo_name}/merge/preview?source_branch=...&target_branch=...&include_content=true`. Requires `git:read`; never creates commits or updates refs. Conflicts return HTTP 200 with `status:conflicted`. |
