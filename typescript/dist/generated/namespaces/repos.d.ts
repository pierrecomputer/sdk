import { type ReposCommitsCreateFromDiffParams, type ReposCommitsCreateParams } from '../../helpers/commits.ts';
import type { APIPromise } from '../../runtime/api-promise.ts';
import { type PierreCore } from '../../runtime/client.ts';
import type { PagePromise } from '../../runtime/page.ts';
import type { HeadersResult, RequestOptions, Runtime } from '../../runtime/runtime.ts';
import * as operations from '../operations/repos.ts';
import type * as schemas from '../schemas.ts';
/** The `repos.archive` namespace. */
export declare class ReposArchiveNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Archive
     *
     * Download a repository snapshot without cloning the repo. This is useful for packaging docs, examples, or release artefacts directly from a branch, tag, or commit.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.archive.get`: `POST /api/repos/{repo_name}/archive`.
     *
     * Docs: search for `repos.archive.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposArchiveGetParams, options?: RequestOptions): APIPromise<Response, operations.ReposArchiveGetResponseHeaders>;
}
/** The `repos.blame` namespace. */
export declare class ReposBlameNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Blame
     *
     * Return per-line blame metadata for a file at a branch, tag, or commit. Supports `git blame -L`-style range filters and rename/copy detection for callers building IDE blame views or audit tooling.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.blame.get`: `GET /api/repos/{repo_name}/blame`.
     *
     * Docs: search for `repos.blame.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposBlameGetParams, options?: RequestOptions): APIPromise<schemas.ReposBlameGetResponse>;
}
/** The `repos.branches` namespace. */
export declare class ReposBranchesNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Create Branch
     *
     * Create a new branch from an existing branch or ref. This is useful for agent workflows, ephemeral previews, or server-side automation where you do not want to clone the repo first.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.branches.create`: `POST /api/repos/{repo_name}/branches/create`.
     *
     * Docs: search for `repos.branches.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params: operations.ReposBranchesCreateParams, options?: RequestOptions): APIPromise<schemas.ReposBranchesCreateResponse>;
    /**
     * Delete Branch
     *
     * Delete a branch from the repository. Name the branch with the `target_branch` and `ephemeral` query parameters. The server resolves the current branch tip before deleting, so the caller does not need the branch SHA. The default branch is protected and cannot be deleted through this endpoint.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.branches.delete`: `DELETE /api/repos/{repo_name}/branches`.
     *
     * Docs: search for `repos.branches.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposBranchesDeleteParams, options?: RequestOptions): APIPromise<schemas.ReposBranchesDeleteResponse>;
    /**
     * Get Branch
     *
     * Get one branch by its exact short name. The response omits list pagination fields.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.branches.get`: `GET /api/repos/{repo_name}/branch`.
     *
     * Docs: search for `repos.branches.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposBranchesGetParams, options?: RequestOptions): APIPromise<schemas.ReposBranchesGetResponse>;
    /**
     * List Branches
     *
     * List branches in the repository with cursor pagination. Use this to build branch selectors, review tools, or sync jobs without shelling out to Git.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.branches.list`: `GET /api/repos/{repo_name}/branches`.
     *
     * Docs: search for `repos.branches.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposBranchesListParams, options?: RequestOptions): PagePromise<schemas.BranchListItem, schemas.ReposBranchesListResponse>;
}
/** The `repos.commits` namespace. */
export declare class ReposCommitsNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Create Commit from Files
     *
     * Create a commit by streaming file operations directly to the service. This is designed for automation, AI agents, and other workflows that need atomic Git writes without running a local Git process.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.commits.create`: `POST /api/repos/{repo_name}/commit-pack`.
     *
     * Docs: search for `repos.commits.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params: ReposCommitsCreateParams, options?: RequestOptions): APIPromise<schemas.CommitWriteResponse>;
    /**
     * Create Commit from Diff
     *
     * Create a commit by streaming a Git patch instead of individual file blobs. Use this when your workflow already produces unified diffs or generated patches.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.commits.createFromDiff`: `POST /api/repos/{repo_name}/diff-commit`.
     *
     * Docs: search for `repos.commits.createFromDiff` in the docs MCP server, https://code.storage/docs/mcp.
     */
    createFromDiff(params: ReposCommitsCreateFromDiffParams, options?: RequestOptions): APIPromise<schemas.CommitWriteResponse>;
    /**
     * Get Commit
     *
     * Resolve a branch name, short SHA, or full SHA to a commit and return the same metadata shape used in commit listings. Use this when you need commit details without computing a diff.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.commits.get`: `GET /api/repos/{repo_name}/commit`.
     *
     * Docs: search for `repos.commits.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposCommitsGetParams, options?: RequestOptions): APIPromise<schemas.ReposCommitsGetResponse>;
    /**
     * List Commits
     *
     * List commit history for the repository default branch or for an explicit branch. Results are cursor-paginated and ordered by commit date, newest first. Set `path` to restrict the history to commits that modified a specific file or subtree.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.commits.list`: `GET /api/repos/{repo_name}/commits`.
     *
     * Docs: search for `repos.commits.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposCommitsListParams, options?: RequestOptions): PagePromise<schemas.Commit, schemas.ReposCommitsListResponse>;
    /**
     * Restore Commit
     *
     * Create a new commit that resets a branch back to a specific commit SHA while preserving normal Git history.
     *
     * Ref-level outcomes are reported in `result.status` and `result.success`, not by the status code alone, and failures raised by the restore itself come back in that same restore-result body. The problem-details schemas below describe gateway-level rejections such as `401`, `403` and `429`.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.commits.restore`: `POST /api/repos/{repo_name}/restore-commit`.
     *
     * Docs: search for `repos.commits.restore` in the docs MCP server, https://code.storage/docs/mcp.
     */
    restore(params: operations.ReposCommitsRestoreParams, options?: RequestOptions): APIPromise<schemas.ReposCommitsRestoreResponse>;
}
/** The `repos.diff` namespace. */
export declare class ReposDiffNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Get Commit Diff
     *
     * Get the diff for a commit, optionally relative to a specific base commit. Repeated `path` parameters narrow the diff to selected files or directories.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.diff.get`: `GET /api/repos/{repo_name}/diff`.
     *
     * Docs: search for `repos.diff.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposDiffGetParams, options?: RequestOptions): APIPromise<schemas.ReposDiffGetResponse>;
}
/** The `repos.files.metadata` namespace. */
export declare class ReposFilesMetadataNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Get File Headers
     *
     * Return file metadata headers for a repository file without streaming the file body. Supports byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to inspect a branch, tag, or commit without cloning the repo locally.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.files.metadata.get`: `HEAD /api/repos/{repo_name}/file`.
     *
     * Docs: search for `repos.files.metadata.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposFilesMetadataGetParams, options?: RequestOptions): APIPromise<HeadersResult<operations.ReposFilesMetadataGetResponseHeaders>, operations.ReposFilesMetadataGetResponseHeaders>;
    /**
     * List Files with Metadata
     *
     * Return a recursive file tree together with per-file commit metadata in one request. Each file also includes a derived `type` field for symmetry with `/files`.
     *
     * The server reads the last commit of each file under `path`, also when the call sends a `limit` or a `cursor`. When those files have more than 50,000 distinct last commits, the call fails with a 429 response, and a retry gets the same response. To list such a tree, send a narrower `path`.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.files.metadata.list`: `GET /api/repos/{repo_name}/files/metadata`.
     *
     * Docs: search for `repos.files.metadata.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposFilesMetadataListParams, options?: RequestOptions): PagePromise<schemas.FileWithMetadata, schemas.ReposFilesMetadataListResponse>;
}
/** The `repos.files` namespace. */
export declare class ReposFilesNamespace {
    #private;
    readonly metadata: ReposFilesMetadataNamespace;
    constructor(runtime: Runtime);
    /**
     * Get File
     *
     * Stream a file directly from the repository with byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to read from a branch, tag, or commit without cloning the repo locally.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.files.get`: `GET /api/repos/{repo_name}/file`.
     *
     * Docs: search for `repos.files.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposFilesGetParams, options?: RequestOptions): APIPromise<Response, operations.ReposFilesGetResponseHeaders>;
    /**
     * List Files
     *
     * List files or direct child entries at a branch, tag, or commit without cloning the repository. Each entry includes its path, Git mode, and derived type (`blob`, `tree`, `symlink`, or `submodule`). Trees no longer carry a trailing `/`; branch on `type` instead.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.files.list`: `GET /api/repos/{repo_name}/files`.
     *
     * Docs: search for `repos.files.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposFilesListParams, options?: RequestOptions): PagePromise<schemas.FileEntry, schemas.ReposFilesListResponse>;
}
/** The `repos.gitCredentials` namespace. */
export declare class ReposGitCredentialsNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Create Git Credential
     *
     * Create a stored HTTPS credential for a repository configured with a generic Git upstream.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.gitCredentials.create`: `POST /api/repos/{repo_name}/git-credentials`.
     *
     * Docs: search for `repos.gitCredentials.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params: operations.ReposGitCredentialsCreateParams, options?: RequestOptions): APIPromise<schemas.GitCredential>;
    /**
     * Delete Git Credential
     *
     * Delete a stored HTTPS credential for a generic Git upstream.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.gitCredentials.delete`: `DELETE /api/repos/{repo_name}/git-credentials/{git_credential_id}`.
     *
     * Docs: search for `repos.gitCredentials.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposGitCredentialsDeleteParams, options?: RequestOptions): APIPromise<HeadersResult<Record<string, never>>>;
    /**
     * Update Git Credential
     *
     * Update a stored HTTPS credential for a generic Git upstream.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.gitCredentials.update`: `PUT /api/repos/{repo_name}/git-credentials/{git_credential_id}`.
     *
     * Docs: search for `repos.gitCredentials.update` in the docs MCP server, https://code.storage/docs/mcp.
     */
    update(params: operations.ReposGitCredentialsUpdateParams, options?: RequestOptions): APIPromise<schemas.GitCredential>;
}
/** The `repos.notes.refs` namespace. */
export declare class ReposNotesRefsNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * List Notes Refs
     *
     * List Git notes refs under a notes ref prefix with cursor pagination. Use this to discover custom notes namespaces before reading individual notes.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.notes.refs.list`: `GET /api/repos/{repo_name}/notes/refs`.
     *
     * Docs: search for `repos.notes.refs.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposNotesRefsListParams, options?: RequestOptions): PagePromise<schemas.NotesRef, schemas.ReposNotesRefsListResponse>;
}
/** The `repos.notes` namespace. */
export declare class ReposNotesNamespace {
    #private;
    readonly refs: ReposNotesRefsNamespace;
    constructor(runtime: Runtime);
    /**
     * Append Note
     *
     * Add text to the note on a Git object, or create the note if the object has none. A retry after a success adds the text again. To make a retry safe, set `expected_notes_ref_sha` to the notes ref SHA that you read before the first request: a retry then fails with 409 and adds nothing.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.notes.append`: `POST /api/repos/{repo_name}/notes/append`.
     *
     * Docs: search for `repos.notes.append` in the docs MCP server, https://code.storage/docs/mcp.
     */
    append(params: operations.ReposNotesAppendParams, options?: RequestOptions): APIPromise<schemas.NotesWriteResponse>;
    /**
     * Create Note
     *
     * Attach text to a Git object without changing the repository contents. Use notes for review markers, internal decisions, or other lightweight context. To add text to a note, use `POST /notes/append`.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.notes.create`: `POST /api/repos/{repo_name}/notes`.
     *
     * Docs: search for `repos.notes.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params: operations.ReposNotesCreateParams, options?: RequestOptions): APIPromise<schemas.NotesWriteResponse>;
    /**
     * Delete Note
     *
     * Remove the Git note attached to a commit or other Git object. Name the note with the query parameters of `GET /notes`. The notes commit of the delete has the default author.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.notes.delete`: `DELETE /api/repos/{repo_name}/notes`.
     *
     * Docs: search for `repos.notes.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposNotesDeleteParams, options?: RequestOptions): APIPromise<schemas.NotesWriteResponse>;
    /**
     * Get Note
     *
     * Read the Git note attached to a commit or other Git object SHA. Notes let you store review status, handoff details, or other context without changing repository contents.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.notes.get`: `GET /api/repos/{repo_name}/notes`.
     *
     * Docs: search for `repos.notes.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposNotesGetParams, options?: RequestOptions): APIPromise<schemas.ReposNotesGetResponse>;
}
/** The `repos.tags` namespace. */
export declare class ReposTagsNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Create Tag
     *
     * Create a lightweight tag pointing to a specific commit. Annotated tags are not created through this endpoint.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.tags.create`: `POST /api/repos/{repo_name}/tags`.
     *
     * Docs: search for `repos.tags.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params: operations.ReposTagsCreateParams, options?: RequestOptions): APIPromise<schemas.ReposTagsCreateResponse>;
    /**
     * Delete Tag
     *
     * Delete a tag from the repository. The server resolves the stored ref correctly for both lightweight and annotated tags.
     *
     * Scopes: `git:read` and `git:write` on the repository.
     *
     * Catalog ID `repos.tags.delete`: `DELETE /api/repos/{repo_name}/tags/{tag_name}`.
     *
     * Docs: search for `repos.tags.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposTagsDeleteParams, options?: RequestOptions): APIPromise<schemas.ReposTagsDeleteResponse>;
    /**
     * Get Tag
     *
     * Get one tag by its exact short name. The response returns the dereferenced commit SHA and omits internal fields.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.tags.get`: `GET /api/repos/{repo_name}/tag`.
     *
     * Docs: search for `repos.tags.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposTagsGetParams, options?: RequestOptions): APIPromise<schemas.ReposTagsGetResponse>;
    /**
     * List Tags
     *
     * List tags in lexical order with cursor pagination. The returned `sha` is the dereferenced commit SHA, even for annotated tags.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.tags.list`: `GET /api/repos/{repo_name}/tags`.
     *
     * Docs: search for `repos.tags.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params: operations.ReposTagsListParams, options?: RequestOptions): PagePromise<schemas.TagListItem, schemas.ReposTagsListResponse>;
}
/** The `repos.upstream` namespace. */
export declare class ReposUpstreamNamespace {
    #private;
    constructor(runtime: Runtime);
    /**
     * Delete Upstream
     *
     * Detach the repository from its configured upstream provider. The operation is idempotent: already-detached repositories return success.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.upstream.delete`: `DELETE /api/repos/{repo_name}/upstream`.
     *
     * Docs: search for `repos.upstream.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposUpstreamDeleteParams, options?: RequestOptions): APIPromise<schemas.ReposUpstreamDeleteResponse>;
    /**
     * Pull Upstream
     *
     * Trigger a sync from the configured upstream of the repository. This only works for repositories that have an `upstream`.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.upstream.pull`: `POST /api/repos/{repo_name}/upstream/pull`.
     *
     * Docs: search for `repos.upstream.pull` in the docs MCP server, https://code.storage/docs/mcp.
     */
    pull(params: operations.ReposUpstreamPullParams, options?: RequestOptions): APIPromise<schemas.ReposUpstreamPullResponse>;
}
/**
 * The `repos` namespace. `new Pierre()` has it as `pierre.repos`. To load only this namespace, build it on a core client: `new ReposNamespace(new PierreCore())`.
 */
export declare class ReposNamespace {
    #private;
    readonly archive: ReposArchiveNamespace;
    readonly blame: ReposBlameNamespace;
    readonly branches: ReposBranchesNamespace;
    readonly commits: ReposCommitsNamespace;
    readonly diff: ReposDiffNamespace;
    readonly files: ReposFilesNamespace;
    readonly gitCredentials: ReposGitCredentialsNamespace;
    readonly notes: ReposNotesNamespace;
    readonly tags: ReposTagsNamespace;
    readonly upstream: ReposUpstreamNamespace;
    constructor(client: PierreCore);
    /**
     * Create Repo
     *
     * Create a repository.
     *
     * A repository starts empty or from a source. `base_repo` is a one-time copy of a Code Storage repository; `upstream` is a lasting link to an external Git host. A copy takes the history of one commit (`base_repo.ref`, or the source HEAD) into one branch, and keeps no link to its source. A sync keeps its upstream, and the repository can sync from it again. Set at most one of the two.
     *
     * Create is idempotent on the repository name. A new repository returns `201`. When the name already exists, the request returns `200`, and a copy copies nothing. When the name exists with a different upstream, the request returns `409`.
     *
     * The deprecated form of `base_repo`, with `provider` and `operation`, still works.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.create`: `POST /api/repos`.
     *
     * Docs: search for `repos.create` in the docs MCP server, https://code.storage/docs/mcp.
     */
    create(params?: operations.ReposCreateParams, options?: RequestOptions): APIPromise<schemas.ReposCreateResponse>;
    /**
     * Delete Repo
     *
     * Permanently retire a repository. The API performs a soft delete first and then triggers asynchronous hot and cold storage cleanup.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.delete`: `DELETE /api/repos/{repo_name}`.
     *
     * Docs: search for `repos.delete` in the docs MCP server, https://code.storage/docs/mcp.
     */
    delete(params: operations.ReposDeleteParams, options?: RequestOptions): APIPromise<schemas.ReposDeleteResponse>;
    /**
     * Get Repo
     *
     * Fetch the metadata of a repository.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.get`: `GET /api/repos/{repo_name}`.
     *
     * Docs: search for `repos.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params: operations.ReposGetParams, options?: RequestOptions): APIPromise<schemas.Repository>;
    /**
     * Grep
     *
     * Search a repository without cloning it. Results are paginated and can include surrounding context lines so downstream tools only fetch the relevant slices.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.grep`: `POST /api/repos/{repo_name}/grep`.
     *
     * Docs: search for `repos.grep` in the docs MCP server, https://code.storage/docs/mcp.
     */
    grep(params: operations.ReposGrepParams, options?: RequestOptions): APIPromise<schemas.ReposGrepResponse, operations.ReposGrepResponseHeaders>;
    /**
     * List Repos
     *
     * List repositories for the current organisation with cursor-based pagination. Supply `q` to filter results by a case-insensitive substring match against `repo_name` (for example `pierre/sdk-documentation`).
     *
     * Scope: `org:read`.
     *
     * Catalog ID `repos.list`: `GET /api/repos`.
     *
     * Docs: search for `repos.list` in the docs MCP server, https://code.storage/docs/mcp.
     */
    list(params?: operations.ReposListParams, options?: RequestOptions): PagePromise<schemas.Repository, schemas.ReposListResponse>;
    /**
     * Merge Branch
     *
     * Merge changes between branches without cloning the repository or shelling out to Git. This endpoint also supports promoting work from ephemeral branches into long-lived branches such as `main`. Set `expected_source_sha` to merge the exact source commit that a preview returned, even if the source branch advances. Omit `expected_target_sha` to merge into the current target tip and allow the gateway to retry stale target/repository movement internally; set `expected_target_sha` to require a strict target-tip precondition. GitHub-backed public targets currently do not use automatic retry.
     *
     * Scope: `git:write` on the repository.
     *
     * Catalog ID `repos.merge`: `POST /api/repos/{repo_name}/merge`.
     *
     * Docs: search for `repos.merge` in the docs MCP server, https://code.storage/docs/mcp.
     */
    merge(params: operations.ReposMergeParams, options?: RequestOptions): APIPromise<schemas.ReposMergeResponse>;
    /**
     * Preview Merge
     *
     * Preview merge conflicts without creating commits, updating refs, or touching a working tree. When requested, conflict content is rendered from Git objects produced in request-local scratch storage.
     *
     * Scope: `git:read` on the repository.
     *
     * Catalog ID `repos.previewMerge`: `GET /api/repos/{repo_name}/merge/preview`.
     *
     * Docs: search for `repos.previewMerge` in the docs MCP server, https://code.storage/docs/mcp.
     */
    previewMerge(params: operations.ReposPreviewMergeParams, options?: RequestOptions): APIPromise<schemas.ReposPreviewMergeResponse>;
    /**
     * Update Repository Settings
     *
     * Change the default branch of a repository.
     *
     * The gateway reads the current `HEAD` symbolic ref, then repoints it at the requested branch through a transactional compare-and-swap against that value, and finally records the new default branch in the repository row. Branch names are fully qualified for you: `main` is written as the symref target `refs/heads/main`, and a value that already starts with `refs/` is used verbatim. The branch itself is not created by this call.
     *
     * Scope: `repo:write` on the repository.
     *
     * Catalog ID `repos.update`: `PATCH /api/repos/{repo_name}`.
     *
     * Docs: search for `repos.update` in the docs MCP server, https://code.storage/docs/mcp.
     */
    update(params: operations.ReposUpdateParams, options?: RequestOptions): APIPromise<schemas.ReposUpdateResponse>;
}
//# sourceMappingURL=repos.d.ts.map