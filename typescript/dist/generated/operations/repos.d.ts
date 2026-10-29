import type { OperationSpec } from '../../runtime/operation.ts';
import type * as schemas from '../schemas.ts';
/**
 * The params of `repos.archive.get`.
 */
export interface ReposArchiveGetParams extends Partial<schemas.ReposArchiveGetRequest> {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
/**
 * The declared response headers of `repos.archive.get`.
 */
export interface ReposArchiveGetResponseHeaders {
    /**
     * `Cache-Control`: Archive downloads are returned with `no-store`.
     */
    cache_control?: string;
    /**
     * `Content-Disposition`: Attachment filename generated from the repository URL and resolved revision.
     */
    content_disposition?: string;
}
export declare const reposArchiveGet: OperationSpec;
/**
 * The params of `repos.blame.get`.
 */
export interface ReposBlameGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Follow the file across renames and copies.
     */
    detect_moves?: boolean;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Repository-relative file path to blame.
     */
    path: string;
    /**
     * Optional `git blame -L`-style range spec. May be repeated to blame multiple regions (max 16). Each value is one `-L` argument: e.g. `10,20`, `10,+5`, `/getUser/,/^}/`, `/getUser/,+30`, `10,`, `,20`, `10`, `:^func .*Foo`, `:funcname`.
     */
    range?: Array<string>;
    /**
     * Optional branch, tag, or commit SHA to blame at. When omitted, the repository default branch is used.
     */
    ref?: string;
}
export declare const reposBlameGet: OperationSpec;
/**
 * The params of `repos.branches.create`.
 */
export interface ReposBranchesCreateParams extends schemas.ReposBranchesCreateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposBranchesCreate: OperationSpec;
/**
 * The params of `repos.branches.delete`.
 */
export interface ReposBranchesDeleteParams extends Partial<Omit<schemas.ReposBranchesDeleteRequest, 'ephemeral' | 'target_branch'>> {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * When true, delete the branch from the ephemeral namespace instead of the default namespace.
     */
    ephemeral?: boolean;
    /**
     * Exact short name of the branch to delete. Must not start with refs/. Required unless the deprecated body names the branch.
     */
    target_branch?: string;
}
export declare const reposBranchesDelete: OperationSpec;
/**
 * The params of `repos.branches.get`.
 */
export interface ReposBranchesGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * When true, get the branch from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Exact short branch name.
     */
    name: string;
}
export declare const reposBranchesGet: OperationSpec;
/**
 * The params of `repos.branches.list`.
 */
export interface ReposBranchesListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Pagination cursor returned by a previous `list_branches` response.
     */
    cursor?: string;
    /**
     * When true, list branches under the ephemeral namespace instead of regular branches.
     */
    ephemeral?: boolean;
    /**
     * Maximum number of branches to return. Defaults to 20.
     */
    limit?: number;
}
export declare const reposBranchesList: OperationSpec;
/**
 * The params of `repos.commits.create`.
 */
export interface ReposCommitsCreateWireParams extends schemas.ReposCommitsCreateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /** The lines after the first line, in order. */
    chunks?: Iterable<{
        blob_chunk: schemas.BlobChunk;
    }> | AsyncIterable<{
        blob_chunk: schemas.BlobChunk;
    }>;
}
export declare const reposCommitsCreate: OperationSpec;
/**
 * The params of `repos.commits.createFromDiff`.
 */
export interface ReposCommitsCreateFromDiffWireParams extends schemas.ReposCommitsCreateFromDiffRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /** The lines after the first line, in order. */
    chunks?: Iterable<{
        diff_chunk: schemas.DiffChunk;
    }> | AsyncIterable<{
        diff_chunk: schemas.DiffChunk;
    }>;
}
export declare const reposCommitsCreateFromDiff: OperationSpec;
/**
 * The params of `repos.commits.get`.
 */
export interface ReposCommitsGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Branch name, tag, full commit SHA, short SHA, or other revision Git can resolve. Provide `ref` or the deprecated `sha`.
     */
    ref?: string;
    /**
     * Deprecated: use ref instead. Commit SHA, short SHA, branch name, or other revision Git can resolve.
     *
     * @deprecated
     */
    sha?: string;
}
export declare const reposCommitsGet: OperationSpec;
/**
 * The params of `repos.commits.list`.
 */
export interface ReposCommitsListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Deprecated: use ref instead. Optional branch name to list commits from. When omitted, the repository default branch is used.
     *
     * @deprecated
     */
    branch?: string;
    /**
     * Pagination cursor returned by a previous `list_commits` response.
     */
    cursor?: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Maximum number of commits to return. Defaults to 20.
     */
    limit?: number;
    /**
     * Optional repository-relative path to scope the history to commits that touched that path.
     */
    path?: string;
    /**
     * Optional branch, tag, or commit to list commits from. When omitted, the repository default branch is used. Provide `ref` or the deprecated `branch`.
     */
    ref?: string;
}
export declare const reposCommitsList: OperationSpec;
/**
 * The params of `repos.commits.restore`.
 */
export interface ReposCommitsRestoreParams extends schemas.ReposCommitsRestoreRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposCommitsRestore: OperationSpec;
/**
 * The params of `repos.create`.
 */
export interface ReposCreateParams extends Partial<schemas.ReposCreateRequest> {
}
export declare const reposCreate: OperationSpec;
/**
 * The params of `repos.delete`.
 */
export interface ReposDeleteParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposDelete: OperationSpec;
/**
 * The params of `repos.diff.get`.
 */
export interface ReposDiffGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Deprecated: use base_ref instead. Optional base commit SHA to diff against. When omitted, the diff is generated against the commit's parent.
     *
     * @deprecated
     */
    baseSha?: string;
    /**
     * Whether `base_ref` should be resolved from the ephemeral namespace.
     */
    base_is_ephemeral?: boolean;
    /**
     * Optional base branch, tag, or commit to diff against. When omitted, the diff is generated against the commit's parent. When set, the diff starts at the merge base of `base_ref` and `ref`, as `git diff base_ref...ref` does, and `merge_base_sha` gives that commit. So the diff holds only the changes on `ref` after the two histories split. When `ref` is an ancestor of `base_ref`, the merge base is `ref`, and the diff is empty. Provide `base_ref` or the deprecated `baseSha`.
     */
    base_ref?: string;
    /**
     * Deprecated: use git_apply_compatible instead. When enabled, concatenate `files[].raw` in response order and apply the result against the selected base with `git apply`. Changes listed in `filtered_files` are not included in the patch. Defaults to false, preserving review-oriented whitespace suppression.
     *
     * @deprecated
     */
    gitApplyCompatible?: boolean;
    /**
     * When enabled, concatenate `files[].raw` in response order and apply the result against the selected base with `git apply`. Changes listed in `filtered_files` are not included in the patch. Defaults to false, preserving review-oriented whitespace suppression. Provide `git_apply_compatible` or the deprecated `gitApplyCompatible`.
     */
    git_apply_compatible?: boolean;
    /**
     * Optional repeated path filter. Provide multiple `path` query values to restrict the diff to specific files or directories.
     */
    path?: Array<string>;
    /**
     * Branch, tag, or commit to diff. Provide `ref` or the deprecated `sha`.
     */
    ref?: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ref_is_ephemeral?: boolean;
    /**
     * Deprecated: use ref instead. Commit SHA to diff.
     *
     * @deprecated
     */
    sha?: string;
}
export declare const reposDiffGet: OperationSpec;
/**
 * The params of `repos.files.get`.
 */
export interface ReposFilesGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Repository-relative file path to fetch.
     */
    path: string;
    /**
     * Optional branch, tag, or commit SHA to read from. When omitted, the repository default branch is used.
     */
    ref?: string;
    /**
     * Returns `412 Precondition Failed` when the current `ETag` does not match.
     */
    if_match?: string;
    /**
     * Returns `304 Not Modified` when `Last-Modified` is on or before this date.
     */
    if_modified_since?: string;
    /**
     * Returns `304 Not Modified` when the current `ETag` matches.
     */
    if_none_match?: string;
    /**
     * Conditional range request: when the supplied validator matches `ETag` or `Last-Modified`, the server returns `206 Partial Content`; otherwise the full body is returned with `200 OK`.
     */
    if_range?: string;
    /**
     * Returns `412 Precondition Failed` when `Last-Modified` is after this date.
     */
    if_unmodified_since?: string;
    /**
     * Standard HTTP byte-range header (`bytes=<start>-<end>`). Triggers a `206 Partial Content` response.
     */
    range?: string;
}
/**
 * The declared response headers of `repos.files.get`.
 */
export interface ReposFilesGetResponseHeaders {
    /**
     * `Accept-Ranges`: Set to `bytes`; the endpoint accepts byte-range requests via `Range`.
     */
    accept_ranges?: string;
    /**
     * `Content-Length`: Full blob size in bytes for 200 responses, or range size for 206 responses.
     */
    content_length?: string;
    /**
     * `Content-Range`: Returned for 206 responses; identifies the byte range served.
     */
    content_range?: string;
    /**
     * `Content-Type`: Always `application/octet-stream`.
     */
    content_type?: string;
    /**
     * `ETag`: Strong validator equal to the quoted blob object SHA. Use with `If-Match` / `If-None-Match`.
     */
    etag?: string;
    /**
     * `Last-Modified`: Committer date of the most recent commit reachable from `ref` that modified `path`. Use with `If-Modified-Since` / `If-Unmodified-Since`.
     */
    last_modified?: string;
    /**
     * `X-Blob-Sha`: Git blob object SHA of the served file.
     */
    x_blob_sha?: string;
    /**
     * `X-Last-Commit-Sha`: SHA of the most recent commit reachable from `ref` that modified `path`.
     */
    x_last_commit_sha?: string;
}
export declare const reposFilesGet: OperationSpec;
/**
 * The params of `repos.files.list`.
 */
export interface ReposFilesListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Pagination cursor returned by a previous `list_files` response.
     */
    cursor?: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Maximum number of paths to return. A call with no `limit` and no `cursor` returns every path in one response, with `has_more` false. A `limit` of 0 is the same as no `limit`. A call with a `cursor` and no `limit` returns up to 1000 paths.
     */
    limit?: number;
    /**
     * Optional repository-relative subtree to list. Empty means the repository root.
     */
    path?: string;
    /**
     * When true, include descendants recursively. When false, only direct children are returned. Defaults to true.
     */
    recursive?: boolean;
    /**
     * Optional branch, tag, or commit SHA to list from. When omitted, the repository default branch is used.
     */
    ref?: string;
}
export declare const reposFilesList: OperationSpec;
/**
 * The params of `repos.files.metadata.get`.
 */
export interface ReposFilesMetadataGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Repository-relative file path to fetch.
     */
    path: string;
    /**
     * Optional branch, tag, or commit SHA to read from. When omitted, the repository default branch is used.
     */
    ref?: string;
    /**
     * Returns `412 Precondition Failed` when the current `ETag` does not match.
     */
    if_match?: string;
    /**
     * Returns `304 Not Modified` when `Last-Modified` is on or before this date.
     */
    if_modified_since?: string;
    /**
     * Returns `304 Not Modified` when the current `ETag` matches.
     */
    if_none_match?: string;
    /**
     * Conditional range request: when the supplied validator matches `ETag` or `Last-Modified`, the server returns `206 Partial Content`; otherwise the full body is returned with `200 OK`.
     */
    if_range?: string;
    /**
     * Returns `412 Precondition Failed` when `Last-Modified` is after this date.
     */
    if_unmodified_since?: string;
    /**
     * Standard HTTP byte-range header (`bytes=<start>-<end>`). Triggers a `206 Partial Content` response.
     */
    range?: string;
}
/**
 * The declared response headers of `repos.files.metadata.get`.
 */
export interface ReposFilesMetadataGetResponseHeaders {
    /**
     * `Accept-Ranges`: Set to `bytes`; the endpoint accepts byte-range requests via `Range`.
     */
    accept_ranges?: string;
    /**
     * `Content-Length`: Full blob size in bytes for 200 responses, or range size for 206 responses.
     */
    content_length?: string;
    /**
     * `Content-Range`: Returned for 206 responses; identifies the byte range served.
     */
    content_range?: string;
    /**
     * `Content-Type`: Always `application/octet-stream`.
     */
    content_type?: string;
    /**
     * `ETag`: Strong validator equal to the quoted blob object SHA. Use with `If-Match` / `If-None-Match`.
     */
    etag?: string;
    /**
     * `Last-Modified`: Committer date of the most recent commit reachable from `ref` that modified `path`. Use with `If-Modified-Since` / `If-Unmodified-Since`.
     */
    last_modified?: string;
    /**
     * `X-Blob-Sha`: Git blob object SHA of the served file.
     */
    x_blob_sha?: string;
    /**
     * `X-Last-Commit-Sha`: SHA of the most recent commit reachable from `ref` that modified `path`.
     */
    x_last_commit_sha?: string;
}
export declare const reposFilesMetadataGet: OperationSpec;
/**
 * The params of `repos.files.metadata.list`.
 */
export interface ReposFilesMetadataListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Pagination cursor returned by a previous `list_files_with_metadata` response.
     */
    cursor?: string;
    /**
     * Whether `ref` should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Maximum number of files to return. A call with no `limit` and no `cursor` returns every file in one response, with `has_more` false. A `limit` of 0 is the same as no `limit`. A call with a `cursor` and no `limit` returns up to 200 files.
     */
    limit?: number;
    /**
     * Optional repository-relative subtree to list recursively. Empty means the repository root.
     */
    path?: string;
    /**
     * Accepted for API symmetry. Metadata listings are recursive regardless of this flag.
     */
    recursive?: boolean;
    /**
     * Optional branch, tag, or commit SHA to list from. When omitted, the repository default branch is used.
     */
    ref?: string;
}
export declare const reposFilesMetadataList: OperationSpec;
/**
 * The params of `repos.get`.
 */
export interface ReposGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposGet: OperationSpec;
/**
 * The params of `repos.gitCredentials.create`.
 */
export interface ReposGitCredentialsCreateParams extends schemas.ReposGitCredentialsCreateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposGitCredentialsCreate: OperationSpec;
/**
 * The params of `repos.gitCredentials.delete`.
 */
export interface ReposGitCredentialsDeleteParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Credential identifier.
     */
    git_credential_id: string;
}
export declare const reposGitCredentialsDelete: OperationSpec;
/**
 * The params of `repos.gitCredentials.update`.
 */
export interface ReposGitCredentialsUpdateParams extends schemas.ReposGitCredentialsUpdateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Credential identifier.
     */
    git_credential_id: string;
}
export declare const reposGitCredentialsUpdate: OperationSpec;
/**
 * The params of `repos.grep`.
 */
export interface ReposGrepParams extends schemas.ReposGrepRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
/**
 * The declared response headers of `repos.grep`.
 */
export interface ReposGrepResponseHeaders {
    /**
     * `X-Cache`: Indicates grep cache status (`HIT` or `MISS`).
     */
    x_cache?: string;
}
export declare const reposGrep: OperationSpec;
/**
 * The params of `repos.list`.
 */
export interface ReposListParams {
    /**
     * Pagination cursor from previous response (base64 encoded)
     */
    cursor?: string;
    /**
     * Maximum number of repositories to return. Defaults to 20 and is capped at 100.
     */
    limit?: number;
    /**
     * Case-insensitive substring to match against `repo_name`. Trimmed before matching. When omitted or empty after trimming, the full repository list is returned.
     */
    q?: string;
}
export declare const reposList: OperationSpec;
/**
 * The params of `repos.merge`.
 */
export interface ReposMergeParams extends schemas.ReposMergeRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposMerge: OperationSpec;
/**
 * The params of `repos.notes.append`.
 */
export interface ReposNotesAppendParams extends schemas.ReposNotesAppendRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposNotesAppend: OperationSpec;
/**
 * The params of `repos.notes.create`.
 */
export interface ReposNotesCreateParams extends schemas.ReposNotesCreateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposNotesCreate: OperationSpec;
/**
 * The params of `repos.notes.delete`.
 */
export interface ReposNotesDeleteParams extends Partial<Omit<schemas.ReposNotesDeleteRequest, 'expected_notes_ref_sha' | 'notes_ref' | 'object_ref'>> {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Optional compare-and-swap guard: the notes ref SHA that you read before the delete. The delete fails with 409 when the notes ref has a different SHA.
     */
    expected_notes_ref_sha?: string;
    /**
     * Optional notes ref to delete from. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits.
     */
    notes_ref?: string;
    /**
     * Git object whose note should be deleted: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Required unless the deprecated body names the object.
     */
    object_ref?: string;
}
export declare const reposNotesDelete: OperationSpec;
/**
 * The params of `repos.notes.get`.
 */
export interface ReposNotesGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Optional notes ref to read from. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref.
     */
    notes_ref?: string;
    /**
     * Git object whose note should be fetched. A full object SHA today. Provide object_ref or the deprecated sha.
     */
    object_ref?: string;
    /**
     * Deprecated: use notes_ref instead. Optional notes ref to read from. Defaults to refs/notes/commits.
     *
     * @deprecated
     */
    ref?: string;
    /**
     * Deprecated: use object_ref instead. Git object SHA whose note should be fetched.
     *
     * @deprecated
     */
    sha?: string;
}
export declare const reposNotesGet: OperationSpec;
/**
 * The params of `repos.notes.refs.list`.
 */
export interface ReposNotesRefsListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Pagination cursor returned by a previous `list_notes_refs` response.
     */
    cursor?: string;
    /**
     * Maximum number of notes refs to return. Defaults to 20.
     */
    limit?: number;
    /**
     * Notes ref prefix to enumerate. A bare prefix like reviews is placed under refs/notes/; a fully-qualified refs/notes/* prefix is also accepted. Defaults to refs/notes/.
     */
    prefix?: string;
}
export declare const reposNotesRefsList: OperationSpec;
/**
 * The params of `repos.previewMerge`.
 */
export interface ReposPreviewMergeParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * When true, include bounded conflict content in the response.
     */
    include_content?: boolean;
    /**
     * Source branch to merge from.
     */
    source_branch: string;
    /**
     * Whether `source_branch` should be resolved from the ephemeral namespace.
     */
    source_is_ephemeral?: boolean;
    /**
     * Destination branch to preview merging into.
     */
    target_branch: string;
    /**
     * Whether `target_branch` should be resolved from the ephemeral namespace.
     */
    target_is_ephemeral?: boolean;
}
export declare const reposPreviewMerge: OperationSpec;
/**
 * The params of `repos.tags.create`.
 */
export interface ReposTagsCreateParams extends schemas.ReposTagsCreateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposTagsCreate: OperationSpec;
/**
 * The params of `repos.tags.delete`.
 */
export interface ReposTagsDeleteParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Tag name.
     */
    tag_name: string;
}
export declare const reposTagsDelete: OperationSpec;
/**
 * The params of `repos.tags.get`.
 */
export interface ReposTagsGetParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Exact short tag name.
     */
    name: string;
}
export declare const reposTagsGet: OperationSpec;
/**
 * The params of `repos.tags.list`.
 */
export interface ReposTagsListParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
    /**
     * Pagination cursor returned by a previous `list_tags` response.
     */
    cursor?: string;
    /**
     * Maximum number of tags to return. Defaults to 20.
     */
    limit?: number;
}
export declare const reposTagsList: OperationSpec;
/**
 * The params of `repos.update`.
 */
export interface ReposUpdateParams extends schemas.ReposUpdateRequest {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposUpdate: OperationSpec;
/**
 * The params of `repos.upstream.delete`.
 */
export interface ReposUpstreamDeleteParams {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposUpstreamDelete: OperationSpec;
/**
 * The params of `repos.upstream.pull`.
 */
export interface ReposUpstreamPullParams extends Partial<schemas.ReposUpstreamPullRequest> {
    /**
     * The repository name, for example `acme/web`.
     */
    repo_name: string;
}
export declare const reposUpstreamPull: OperationSpec;
//# sourceMappingURL=repos.d.ts.map