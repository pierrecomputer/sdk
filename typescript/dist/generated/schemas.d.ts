/**
 * Output settings for an archive, such as a prefix for every file path.
 */
export interface ArchiveOptions {
    /**
     * Prefix to add to every file path inside the archive.
     */
    prefix?: string;
}
/**
 * Code Storage repository that a new repository copies once. The deprecated form, with provider and operation, also describes a sync or a fork.
 */
export interface BaseRepo {
    /**
     * Authentication for the source repository. A copy requires auth.token.
     */
    auth?: BaseRepoAuth;
    /**
     * Deprecated: use the top-level default_branch for a copy or a sync.
     *
     * @deprecated
     */
    default_branch?: string;
    /**
     * Name of the Code Storage repository to copy. In the deprecated form, the repository name on the provider.
     */
    name: string;
    /**
     * Deprecated: base_repo without provider is a copy, and upstream is a sync. In the deprecated form, sync (the default) or fork.
     *
     * @deprecated
     */
    operation?: 'fork' | 'sync' | (string & {});
    /**
     * Deprecated: omit it for a copy, and use upstream.owner for a sync.
     *
     * @deprecated
     */
    owner?: string;
    /**
     * Deprecated: omit it for a copy, and use upstream for a sync. In the deprecated form, the provider of the source.
     *
     * @deprecated
     */
    provider?: 'bitbucket' | 'code.storage' | 'codeberg' | 'forgejo' | 'gitea' | 'github' | 'gitlab' | 'sourcehut' | 'sr.ht' | (string & {});
    /**
     * Branch, tag, or commit SHA to copy. It defaults to the HEAD of the source repository.
     */
    ref?: string;
    /**
     * Deprecated: use ref, which accepts a commit SHA.
     *
     * @deprecated
     */
    sha?: string;
    /**
     * Deprecated: use upstream.host.
     *
     * @deprecated
     */
    upstream_host?: string;
}
/**
 * Authentication used to access the base repository for sync or fork operations.
 */
export interface BaseRepoAuth {
    /**
     * Deprecated: use upstream.access for a public GitHub sync. A copy needs no auth_type.
     *
     * @deprecated
     */
    auth_type?: 'jwt' | 'public' | (string & {});
    /**
     * JWT with git:read on the source repository. A copy requires it.
     */
    token?: string;
}
/**
 * Single blame entry describing the commit and author responsible for a line.
 */
export interface BlameLine {
    /**
     * Author email of the commit that last touched this line.
     */
    author_email: string;
    /**
     * Author of the commit that last touched this line.
     */
    author_name: string;
    /**
     * Author timestamp in RFC 3339 format.
     */
    author_time: string;
    /**
     * Commit SHA that last touched this line.
     */
    commit_sha: string;
    /**
     * Committer email of the commit that last touched this line.
     */
    committer_email: string;
    /**
     * Committer of the commit that last touched this line.
     */
    committer_name: string;
    /**
     * Committer timestamp in RFC 3339 format.
     */
    committer_time: string;
    /**
     * Line number in the current file.
     */
    line_number: number;
    /**
     * Line number in the original file before any renames or moves.
     */
    original_line_number: number;
    /**
     * Original repository-relative path the line was introduced at.
     */
    original_path: string;
    /**
     * Commit SHA prior to the current commit when known.
     */
    previous_commit_sha?: string;
    /**
     * First line of the commit message.
     */
    summary: string;
}
/**
 * Part of the content of one file in a create-commit NDJSON body. Send the chunks of a file in order, and set `eof` on the last one.
 */
export interface BlobChunk {
    /**
     * Ties the chunk to a file operation.
     */
    content_id: string;
    /**
     * Base64-encoded payload (decoded payload must be at most 4 MiB per chunk).
     */
    data: string;
    /**
     * Set true on the final chunk for that content_id.
     */
    eof: boolean;
}
/**
 * A branch.
 */
export interface Branch {
    /**
     * ISO 8601 creation timestamp.
     */
    created_at: string;
    /**
     * HEAD commit SHA for the branch.
     */
    head_sha: string;
    /**
     * Branch name.
     */
    name: string;
}
/**
 * A branch in a list, with its pagination cursor.
 */
export interface BranchListItem extends Branch {
    /**
     * Opaque pagination token for this branch entry.
     */
    cursor: string;
}
/**
 * Commit metadata. For a signed commit, repos.commits.get also returns the armored signature and the signed payload.
 */
export interface Commit {
    /**
     * Commit author email.
     */
    author_email: string;
    /**
     * Commit author name.
     */
    author_name: string;
    /**
     * Commit committer timestamp in RFC 3339 format. A rebase or cherry-pick sets it to a later time than the author timestamp.
     */
    committer_date?: string;
    /**
     * Commit committer email.
     */
    committer_email: string;
    /**
     * Commit committer name.
     */
    committer_name: string;
    /**
     * Commit author timestamp in RFC 3339 format.
     */
    date: string;
    /**
     * The commit message. In repos.commits.get responses, the full message. In repos.commits.list responses, only the subject line: the first paragraph of the message as one line, without the body and the trailers.
     */
    message: string;
    /**
     * Parent commit SHAs in Git parent order. Empty for root commits.
     */
    parent_shas: Array<string>;
    /**
     * The signed payload: the raw commit object with the gpgsig header removed. This is the exact data the signature is computed over. Present in repos.commits.get responses when the commit is signed.
     */
    payload?: string;
    /**
     * The commit SHA.
     */
    sha: string;
    /**
     * Armored signature from the commit's gpgsig header (OpenPGP or SSH). Present in repos.commits.get responses when the commit is signed.
     */
    signature?: string;
}
/**
 * Result of applying an NDJSON commit pack, including the resulting commit and branch update.
 */
export interface CommitWriteResponse {
    /**
     * Commit object information generated by the storage service.
     */
    commit: WrittenCommit;
    /**
     * Final branch update outcome.
     */
    result: RefUpdateResult;
}
/**
 * Part of the Git patch in a create-commit-from-diff NDJSON body. Send the chunks in order, and set `eof` on the last one.
 */
export interface DiffChunk {
    /**
     * Base64-encoded diff bytes. Decoded payloads must be at most 4 MiB. Combined diff must be compatible with git apply --cached --binary.
     */
    data: string;
    /**
     * Set true on the final chunk to signal end-of-stream.
     */
    eof: boolean;
}
/**
 * Aggregate diff statistics across all files.
 */
export interface DiffStats {
    /**
     * Total added lines across the diff.
     */
    additions: number;
    /**
     * Total line changes (additions plus deletions).
     */
    changes: number;
    /**
     * Total deleted lines across the diff.
     */
    deletions: number;
    /**
     * Number of files changed.
     */
    files: number;
}
/**
 * Per-file diff entry including the raw unified diff text.
 */
export interface FileDiff {
    /**
     * Added lines in this file.
     */
    additions: number;
    /**
     * File size in bytes.
     */
    bytes: number;
    /**
     * Deleted lines in this file.
     */
    deletions: number;
    /**
     * Whether the file ends with a newline.
     */
    is_eof: boolean;
    /**
     * Previous file path for renamed files.
     */
    old_path?: string;
    /**
     * Repository-relative file path (new location for renames).
     */
    path: string;
    /**
     * Raw unified diff content.
     */
    raw: string;
    /**
     * Git status code: A (added), M (modified), D (deleted), R (renamed), C (copied), or T (type changed).
     */
    state: string;
}
/**
 * Tree entry in a list-files response, including the repository-rooted path, six-digit Git mode, and derived type.
 */
export interface FileEntry {
    /**
     * Six-digit Git mode for the entry.
     */
    mode: string;
    /**
     * Repository-rooted path.
     */
    path: string;
    /**
     * Entry type: blob, tree, symlink, or submodule.
     */
    type: string;
}
/**
 * Commit metadata shared by one or more files in a list-files-with-metadata response.
 */
export interface FileLastCommit {
    /**
     * Author display name for the commit.
     */
    author: string;
    /**
     * RFC 3339 author date for the commit.
     */
    date: string;
    /**
     * The subject line of the commit message: the first paragraph of the message as one line, without the body and the trailers. repos.commits.get returns the full message.
     */
    message: string;
    /**
     * History-order rank relative to the resolved ref: 0 is the commit closest to the ref tip (newest in history), larger values are older. Derived from a topological walk rather than author dates, so callers can rank a folder's latest change by the smallest order among its files.
     */
    order: number;
}
/**
 * A file that a commit adds, replaces, or deletes.
 */
export interface FileOperation {
    /**
     * Identifier that blob chunks reference for this file. Required for upsert.
     */
    content_id?: string;
    /**
     * File mode such as 100644 or 100755. Defaults to 100644.
     */
    mode?: string;
    /**
     * upsert (default) to add or replace content, or delete to remove a file.
     */
    operation?: string;
    /**
     * Repository-relative path, with no leading slash.
     */
    path: string;
}
/**
 * File entry in a list-files-with-metadata response, including mode, type, and the SHA of the most recent commit that touched it.
 */
export interface FileWithMetadata {
    /**
     * Commit SHA of the most recent commit that touched this file.
     */
    last_commit_sha: string;
    /**
     * File mode as stored in Git, for example 100644.
     */
    mode: string;
    /**
     * Repository-relative file path.
     */
    path: string;
    /**
     * File size in bytes.
     */
    size: number;
    /**
     * Derived file type: blob, tree, symlink, or submodule.
     */
    type: string;
}
/**
 * Per-file diff entry that was excluded from inline diff output because of size or file-type rules.
 */
export interface FilteredFile {
    /**
     * File size in bytes.
     */
    bytes: number;
    /**
     * Whether the file ends with a newline.
     */
    is_eof: boolean;
    /**
     * Previous file path for renamed files.
     */
    old_path?: string;
    /**
     * Repository-relative file path (new location for renames). Excluded from inline diff content because of size or file-type rules.
     */
    path: string;
    /**
     * Git status code: A (added), M (modified), D (deleted), R (renamed), C (copied), or T (type changed).
     */
    state: string;
}
/**
 * Stored Git credential summary returned after a credential is created or updated.
 */
export interface GitCredential {
    /**
     * Credential creation timestamp in ISO 8601 format.
     */
    created_at?: string;
    /**
     * Credential ID returned when the credential is created.
     */
    id: string;
}
/**
 * Author or committer identity for a commit.
 */
export interface GitIdentity {
    /**
     * Email address.
     */
    email: string;
    /**
     * Display name.
     */
    name: string;
}
/**
 * A Git ref update. The type field and the X-Pierre-Event header identify this payload as push.
 */
export interface GitPushEvent {
    /**
     * The new commit SHA. All zeros for a deleted ref.
     */
    after: string;
    /**
     * The previous commit SHA. All zeros for a newly created ref.
     */
    before: string;
    /**
     * Deprecated: use org. The internal ID of the customer that owns the repository.
     *
     * @deprecated
     */
    customer_id: string;
    /**
     * The organization name. It is the iss claim of the JWTs that the organization signs. It can be absent on older deliveries.
     */
    org?: string;
    /**
     * When the push occurred, as an RFC 3339 timestamp.
     */
    pushed_at: string;
    /**
     * The full Git ref name, for example refs/heads/main.
     */
    ref: string;
    /**
     * The repository that produced the event.
     */
    repository: WebhookRepository;
    /**
     * The event type. It matches the X-Pierre-Event header. It can be absent on older deliveries.
     */
    type?: 'push' | (string & {});
}
/**
 * Sent when a repository sync run fails, including failures after retries are exhausted and infrastructure failures. Internal cancellations do not produce this event. run_count includes the run that just finished.
 */
export interface GitSyncFailedEvent {
    /**
     * When the sync run finished, as an RFC 3339 timestamp.
     */
    completed_at: string;
    /**
     * The failure message.
     */
    error: string;
    /**
     * Whether the repository had never synced successfully before this run began.
     */
    is_first_sync: boolean;
    /**
     * The sync lifecycle ID. It can be absent on older deliveries.
     */
    lifecycle_id?: string;
    /**
     * The organization name. It is the iss claim of the JWTs that the organization signs. It can be absent on older deliveries.
     */
    org?: string;
    /**
     * The repository that produced the event.
     */
    repository: WebhookRepository;
    /**
     * Completed sync runs. For started events, this excludes the current run. For succeeded and failed events, it includes the current run.
     */
    run_count: number;
    /**
     * When the sync run began, as an RFC 3339 timestamp.
     */
    started_at: string;
    /**
     * The event type. It matches the X-Pierre-Event header.
     */
    type: 'repo.sync.failed' | (string & {});
}
/**
 * Sent when a repository sync run begins, before the upstream fetch starts. run_count counts previously completed runs.
 */
export interface GitSyncStartedEvent {
    /**
     * Whether the repository had never synced successfully before this run began.
     */
    is_first_sync: boolean;
    /**
     * The sync lifecycle ID. It can be absent on older deliveries.
     */
    lifecycle_id?: string;
    /**
     * The organization name. It is the iss claim of the JWTs that the organization signs. It can be absent on older deliveries.
     */
    org?: string;
    /**
     * The repository that produced the event.
     */
    repository: WebhookRepository;
    /**
     * Completed sync runs. For started events, this excludes the current run. For succeeded and failed events, it includes the current run.
     */
    run_count: number;
    /**
     * When the sync run began, as an RFC 3339 timestamp.
     */
    started_at: string;
    /**
     * The event type. It matches the X-Pierre-Event header.
     */
    type: 'repo.sync.started' | (string & {});
}
/**
 * Sent when a repository sync run completes successfully. run_count includes the run that just finished.
 */
export interface GitSyncSucceededEvent {
    /**
     * When the sync run finished, as an RFC 3339 timestamp.
     */
    completed_at: string;
    /**
     * Whether the repository had never synced successfully before this run began.
     */
    is_first_sync: boolean;
    /**
     * The sync lifecycle ID. It can be absent on older deliveries.
     */
    lifecycle_id?: string;
    /**
     * The organization name. It is the iss claim of the JWTs that the organization signs. It can be absent on older deliveries.
     */
    org?: string;
    /**
     * The repository that produced the event.
     */
    repository: WebhookRepository;
    /**
     * Completed sync runs. For started events, this excludes the current run. For succeeded and failed events, it includes the current run.
     */
    run_count: number;
    /**
     * When the sync run began, as an RFC 3339 timestamp.
     */
    started_at: string;
    /**
     * The event type. It matches the X-Pierre-Event header.
     */
    type: 'repo.sync.succeeded' | (string & {});
}
/**
 * Number of context lines to return before and after each match.
 */
export interface GrepContext {
    /**
     * Number of lines to include after each match.
     */
    after?: number;
    /**
     * Number of lines to include before each match.
     */
    before?: number;
}
/**
 * Glob and extension filters that select the files to search.
 */
export interface GrepFileFilters {
    /**
     * Glob patterns for files to exclude.
     */
    exclude_globs?: Array<string>;
    /**
     * File extensions to filter by (e.g. [".js", ".py"]).
     */
    extension_filters?: Array<string>;
    /**
     * Glob patterns for files to include.
     */
    include_globs?: Array<string>;
}
/**
 * Matches grouped under a single file path.
 */
export interface GrepFileMatch {
    /**
     * Lines returned for the match, including optional context lines.
     */
    lines: Array<GrepLine>;
    /**
     * Repository-relative file path that matched.
     */
    path: string;
}
/**
 * Limits on the total lines and on the matches for each file in a grep response.
 */
export interface GrepLimits {
    /**
     * Maximum total lines to return (default 2000, max 2000).
     */
    max_lines?: number;
    /**
     * Maximum matches returned per file (default 200).
     */
    max_matches_per_file?: number;
}
/**
 * Single line returned by grep, either a match or a surrounding context line.
 */
export interface GrepLine {
    /**
     * Line number in the file.
     */
    line_number: number;
    /**
     * Line text content.
     */
    text: string;
    /**
     * match for lines satisfying the pattern, or context for surrounding context lines.
     */
    type: string;
}
/**
 * Cursor and page size for grep matches.
 */
export interface GrepPagination {
    /**
     * Pagination cursor returned by a previous grep response.
     */
    cursor?: string;
    /**
     * Maximum number of matches to return (default 200).
     */
    limit?: number;
}
/**
 * Pattern to search for, and whether the search is case-sensitive.
 */
export interface GrepQuery {
    /**
     * Defaults to true when omitted.
     */
    case_sensitive?: boolean;
    /**
     * Regular expression or literal pattern to search for.
     */
    pattern: string;
}
/**
 * Query settings that the server used for the search.
 */
export interface GrepResolvedQuery {
    /**
     * Echoed case-sensitivity setting.
     */
    case_sensitive: boolean;
    /**
     * Echoed pattern that was searched.
     */
    pattern: string;
}
/**
 * Ref and resolved commit that the search ran against.
 */
export interface GrepResolvedRef {
    /**
     * Resolved commit SHA the grep ran against.
     */
    commit: string;
    /**
     * Ref that was grepped.
     */
    ref: string;
}
/**
 * Resolved source ref state for a merge response.
 */
export interface MergeSourceState {
    /**
     * Deprecated: use ref. Source branch name.
     *
     * @deprecated
     */
    branch: string;
    /**
     * Whether the source ref was resolved under the ephemeral namespace.
     */
    ephemeral: boolean;
    /**
     * The source ref the merge reads.
     */
    ref: string;
    /**
     * Resolved source SHA.
     */
    sha: string;
}
/**
 * Resolved target ref state for a merge response, including the previous and new tip SHAs.
 */
export interface MergeTargetState {
    /**
     * Target branch name.
     */
    branch: string;
    /**
     * Whether the target ref was resolved under the ephemeral namespace.
     */
    ephemeral: boolean;
    /**
     * New target tip SHA after the merge.
     */
    new_sha: string;
    /**
     * Previous target tip SHA before the merge.
     */
    old_sha: string;
}
/**
 * Cloud location and inbound IP addresses of the Code Storage cluster that serves the current organisation.
 */
export interface Meta {
    /**
     * Public IPv4 addresses, in CIDR notation, that accept inbound traffic for the organisation. Allow these in firewall rules that restrict outbound connections to Code Storage.
     */
    ips: MetaIPs;
    /**
     * Cloud provider and region that host the organisation.
     */
    provider: MetaProvider;
}
/**
 * Inbound IPv4 address ranges of the cluster, grouped by the kind of traffic they accept.
 */
export interface MetaIPs {
    /**
     * Addresses that accept HTTP API traffic. Empty when no addresses are published for the organisation's cluster.
     */
    api: Array<string>;
    /**
     * Addresses that accept Git over HTTPS traffic. Empty when no addresses are published for the organisation's cluster.
     */
    git: Array<string>;
}
/**
 * Cloud provider and region of the cluster that serves the current organisation.
 */
export interface MetaProvider {
    /**
     * Cloud provider that hosts the organisation, such as aws or gcp. Empty when the gateway cannot determine its location.
     */
    name: string;
    /**
     * Cloud provider region that hosts the organisation. Empty when the gateway cannot determine its location.
     */
    region: string;
}
/**
 * Git notes ref entry including its full ref name and current tip SHA.
 */
export interface NotesRef {
    /**
     * Opaque pagination token for this notes ref entry.
     */
    cursor: string;
    /**
     * Full notes ref name.
     */
    ref: string;
    /**
     * Current tip SHA stored in the notes ref.
     */
    sha: string;
}
/**
 * Result of a notes write operation, including the resulting notes ref state.
 */
export interface NotesWriteResponse {
    /**
     * Previous notes ref commit SHA.
     */
    base_commit?: string;
    /**
     * New notes ref SHA after the operation.
     */
    new_ref_sha: string;
    /**
     * The notes ref the operation updates.
     */
    notes_ref: string;
    /**
     * Operation result with success, status, and optional message.
     */
    result: NotesWriteResult;
    /**
     * The commit SHA the note is attached to.
     */
    sha: string;
    /**
     * Deprecated: use notes_ref. The notes ref the operation updates.
     *
     * @deprecated
     */
    target_ref: string;
}
/**
 * Result of a notes write: whether it succeeded, a status, and an optional message.
 */
export interface NotesWriteResult {
    /**
     * Optional human-readable message.
     */
    message?: string;
    /**
     * Status code (e.g. ok).
     */
    status: string;
    /**
     * Whether the operation succeeded.
     */
    success: boolean;
}
/**
 * Single Git blob rendered as part of a merge conflict preview.
 */
export interface PreviewMergeBlob {
    /**
     * Whether the blob appears to be binary content.
     */
    binary: boolean;
    /**
     * UTF-8 text content when available and not binary.
     */
    content?: string;
    /**
     * Git object ID for this blob.
     */
    oid?: string;
    /**
     * Whether content was truncated by server-side limits.
     */
    truncated: boolean;
}
/**
 * Inline conflict content for a single conflicted repository path.
 */
export interface PreviewMergeConflict {
    /**
     * Base stage blob.
     */
    base: PreviewMergeBlob;
    /**
     * Target branch stage blob.
     */
    ours: PreviewMergeBlob;
    /**
     * Repository path for this conflict.
     */
    path: string;
    /**
     * Best-effort merged blob content, usually with conflict markers for text conflicts.
     */
    result: PreviewMergeBlob;
    /**
     * Source branch stage blob.
     */
    theirs: PreviewMergeBlob;
}
/**
 * Conflict omitted from inline content because of request or server limits.
 */
export interface PreviewMergeFilteredConflict {
    /**
     * Repository path omitted from inline conflict content.
     */
    path: string;
    /**
     * Reason the conflict content was omitted.
     */
    reason: string;
}
/**
 * Branch update outcome for an operation that writes a commit.
 */
export interface RefUpdateResult {
    /**
     * Deprecated: use target_branch. The branch the operation updates.
     *
     * @deprecated
     */
    branch: string;
    /**
     * Optional human-readable message.
     */
    message?: string;
    /**
     * New tip SHA after the update.
     */
    new_sha: string;
    /**
     * Previous tip SHA (40-char hex; all zeros when the branch did not previously exist).
     */
    old_sha: string;
    /**
     * Status code (ok, conflict, precondition_failed, etc.).
     */
    status: 'conflict' | 'failed' | 'forbidden' | 'internal' | 'invalid' | 'not_found' | 'ok' | 'payload_too_large' | 'precondition_failed' | 'timeout' | 'unauthorized' | 'unavailable' | (string & {});
    /**
     * Whether the operation succeeded.
     */
    success: boolean;
    /**
     * The branch the operation updates.
     */
    target_branch: string;
}
/**
 * Archive options describing the ref to snapshot and the include or exclude filters applied to the resulting tarball.
 */
export interface ReposArchiveGetRequest {
    /**
     * Optional archive output settings.
     */
    archive?: ArchiveOptions;
    /**
     * Exclude files matching these glob patterns after include filtering.
     */
    exclude_globs?: Array<string>;
    /**
     * Only include files matching these glob patterns.
     */
    include_globs?: Array<string>;
    /**
     * Maximum blob size to include in the archive, in bytes.
     */
    max_blob_size?: number;
    /**
     * Branch, tag, or commit to archive. When omitted, the default branch or HEAD is used.
     */
    ref?: string;
}
/**
 * Per-line blame information for the requested file at the resolved revision.
 */
export interface ReposBlameGetResponse {
    /**
     * Commit SHA the blame was computed at.
     */
    commit_sha: string;
    /**
     * Per-line blame results in file order.
     */
    lines: Array<BlameLine>;
    /**
     * Repository-relative file path that was blamed.
     */
    path: string;
    /**
     * Resolved ref used for the blame.
     */
    ref: string;
}
/**
 * Create-branch request body describing the new branch and its base ref.
 */
export interface ReposBranchesCreateRequest {
    /**
     * Deprecated: use base_ref. Preferred source branch name.
     *
     * @deprecated
     */
    base_branch?: string;
    /**
     * Whether the base branch should be resolved from the ephemeral namespace.
     */
    base_is_ephemeral?: boolean;
    /**
     * Optional source ref or revision. Provide base_ref or the deprecated base_branch.
     */
    base_ref?: string;
    /**
     * Allow non-fast-forward updates when recreating an existing named branch. Requires target_branch.
     */
    force?: boolean;
    /**
     * Optional pack hint. A branch name the backend prefers as the delta base when it builds the thin pack. It does not change the source or the result.
     */
    preferred_base?: string;
    /**
     * Optional destination branch name. Omit it to let the server allocate a name.
     */
    target_branch?: string;
    /**
     * Whether the new branch should be created in the ephemeral namespace.
     */
    target_is_ephemeral?: boolean;
}
/**
 * Result of creating a branch, including the resulting ref state.
 */
export interface ReposBranchesCreateResponse {
    /**
     * Resolved commit SHA at the new branch tip.
     */
    commit_sha?: string;
    /**
     * Human-readable result message.
     */
    message: string;
    /**
     * Destination branch name.
     */
    target_branch: string;
    /**
     * Whether the created branch is ephemeral.
     */
    target_is_ephemeral: boolean;
}
/**
 * Deprecated branch deletion body. Use the target_branch and ephemeral query parameters.
 */
export interface ReposBranchesDeleteRequest {
    /**
     * Deprecated: use the ephemeral query parameter. Delete the branch from the ephemeral namespace instead of the default namespace.
     *
     * @deprecated
     */
    ephemeral?: boolean;
    /**
     * Deprecated: use the target_branch query parameter. Branch name to delete.
     *
     * @deprecated
     */
    name?: string;
    /**
     * Deprecated: use the target_branch query parameter. Branch name to delete. Must not start with refs/.
     *
     * @deprecated
     */
    target_branch?: string;
}
/**
 * Result of deleting a branch.
 */
export interface ReposBranchesDeleteResponse {
    /**
     * Whether the deleted branch lived in the ephemeral namespace.
     */
    ephemeral: boolean;
    /**
     * Human-readable result message.
     */
    message: string;
    /**
     * Deprecated: use target_branch. Deleted branch name.
     *
     * @deprecated
     */
    name: string;
    /**
     * Deleted branch name.
     */
    target_branch: string;
}
/**
 * One branch that matches an exact short name.
 */
export interface ReposBranchesGetResponse {
    /**
     * The branch that has the requested name.
     */
    branch: Branch;
}
/**
 * Paginated list of branches for the repository.
 */
export interface ReposBranchesListResponse {
    /**
     * List of branch objects.
     */
    branches: Array<BranchListItem>;
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
}
/**
 * Metadata line of a create-commit-from-diff NDJSON body: the target branch and the commit message and identities. The `diff_chunk` lines that follow carry the patch.
 */
export interface ReposCommitsCreateFromDiffRequest {
    /**
     * Author identity for the commit.
     */
    author: GitIdentity;
    /**
     * Source branch to seed from when target_branch does not exist yet.
     */
    base_branch?: string;
    /**
     * When true, interpret base_branch as ephemeral.
     */
    base_is_ephemeral?: boolean;
    /**
     * Commit message for the new commit.
     */
    commit_message: string;
    /**
     * Committer identity. Defaults to author when omitted.
     */
    committer?: GitIdentity;
    /**
     * Deprecated: use target_is_ephemeral. When true, write the target branch under the ephemeral namespace.
     *
     * @deprecated
     */
    ephemeral?: boolean;
    /**
     * Deprecated: use base_is_ephemeral. When true, interpret base_branch as ephemeral.
     *
     * @deprecated
     */
    ephemeral_base?: boolean;
    /**
     * Deprecated: use expected_target_sha. Guard ensuring the branch tip matches before applying the patch.
     *
     * @deprecated
     */
    expected_head_sha?: string;
    /**
     * Guard ensuring the target branch tip matches before applying the patch.
     */
    expected_target_sha?: string;
    /**
     * Destination branch name.
     */
    target_branch: string;
    /**
     * When true, write the target branch under the ephemeral namespace.
     */
    target_is_ephemeral?: boolean;
}
/**
 * Metadata line of a create-commit NDJSON body: the target branch, the commit message and identities, and the file operations. The `blob_chunk` lines that follow carry the file content.
 */
export interface ReposCommitsCreateRequest {
    /**
     * Author identity for the commit.
     */
    author: GitIdentity;
    /**
     * Source branch to copy when target_branch does not yet exist.
     */
    base_branch?: string;
    /**
     * When true, interpret base_branch as ephemeral.
     */
    base_is_ephemeral?: boolean;
    /**
     * Commit message for the new commit.
     */
    commit_message: string;
    /**
     * Committer identity. Defaults to author when omitted.
     */
    committer?: GitIdentity;
    /**
     * Deprecated: use target_is_ephemeral. When true, write the target branch under the ephemeral namespace.
     *
     * @deprecated
     */
    ephemeral?: boolean;
    /**
     * Deprecated: use base_is_ephemeral. When true, interpret base_branch as ephemeral.
     *
     * @deprecated
     */
    ephemeral_base?: boolean;
    /**
     * Deprecated: use expected_target_sha. Commit SHA that must match the branch tip before writing.
     *
     * @deprecated
     */
    expected_head_sha?: string;
    /**
     * Commit SHA that must match the target branch tip before writing. Omit to fast-forward unconditionally.
     */
    expected_target_sha?: string;
    /**
     * File operations applied in this commit.
     */
    files: Array<FileOperation>;
    /**
     * Destination branch name (no refs/ prefix).
     */
    target_branch: string;
    /**
     * When true, write the target branch under the ephemeral namespace.
     */
    target_is_ephemeral?: boolean;
}
/**
 * Commit metadata for a single resolved revision, without diff content.
 */
export interface ReposCommitsGetResponse {
    /**
     * Resolved commit metadata.
     */
    commit: Commit;
}
/**
 * Paginated commit history for the repository, optionally filtered by branch.
 */
export interface ReposCommitsListResponse {
    /**
     * List of commit objects.
     */
    commits: Array<Commit>;
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
}
/**
 * Metadata line of a restore-commit NDJSON body: the branch to reset, the revision to reset it to, and the commit identities. The body has no other line.
 */
export interface ReposCommitsRestoreRequest {
    /**
     * Author identity for the restore commit.
     */
    author: GitIdentity;
    /**
     * Branch, tag, or commit to reset the branch to. Provide base_ref or the deprecated target_commit_sha.
     */
    base_ref?: string;
    /**
     * Commit message for the restore commit. Defaults to a message that names the branch and the commit.
     */
    commit_message?: string;
    /**
     * Committer identity. Defaults to author when omitted.
     */
    committer?: GitIdentity;
    /**
     * Deprecated: use expected_target_sha. Guard ensuring the current tip matches before applying the restore.
     *
     * @deprecated
     */
    expected_head_sha?: string;
    /**
     * Guard ensuring the target branch tip matches before applying the restore.
     */
    expected_target_sha?: string;
    /**
     * Branch name to reset (no refs/ prefix).
     */
    target_branch: string;
    /**
     * Deprecated: use base_ref. Commit to reset the branch to.
     *
     * @deprecated
     */
    target_commit_sha?: string;
}
/**
 * Result of a restore commit operation, including the created commit and the branch update.
 */
export interface ReposCommitsRestoreResponse {
    /**
     * Created restore commit metadata.
     */
    commit: RestoredCommit;
    /**
     * Branch update result.
     */
    result: RefUpdateResult;
}
/**
 * Create-repository request body. It supplies the optional repository name, default branch, and Git Sync or fork configuration.
 */
export interface ReposCreateRequest {
    /**
     * Code Storage repository to copy once. The new repository keeps no link to it. Do not set it together with upstream.
     */
    base_repo?: BaseRepo;
    /**
     * Default branch for the new repository. When omitted, a copy takes the default branch of the source, a sync from GitHub takes the default branch of the GitHub repository, and any other repository uses main.
     */
    default_branch?: string;
    /**
     * Name of the new repository. It can contain a slash.
     */
    repo_name?: string;
    /**
     * External Git host to keep syncing from. The link lasts, and the repository can sync again. Do not set it together with base_repo.
     */
    upstream?: UpstreamConfig;
}
/**
 * Result of creating a repository, including its repository name.
 */
export interface ReposCreateResponse {
    /**
     * Deprecated: use repo_name. Repository name or path, not a full URL.
     *
     * @deprecated
     */
    http_url: string;
    /**
     * Human-readable result: the repository was created, or it already exists. The status gives the same result: 201 or 200.
     */
    message: string;
    /**
     * Deprecated: use repo_name. Stable repository identifier.
     *
     * @deprecated
     */
    repo_id: string;
    /**
     * Repository name or path. It can contain a slash. It matches the JWT repo claim.
     */
    repo_name: string;
}
/**
 * Confirmation that the repository deletion has been accepted.
 */
export interface ReposDeleteResponse {
    /**
     * Human-readable deletion status message.
     */
    message: string;
    /**
     * Deprecated: use repo_name. Stable repository identifier.
     *
     * @deprecated
     */
    repo_id: string;
    /**
     * Repository name or path. It can contain a slash. It matches the JWT repo claim.
     */
    repo_name: string;
}
/**
 * Diff for a single commit, including merge base when applicable, aggregate stats, and per-file changes.
 */
export interface ReposDiffGetResponse {
    /**
     * The commit that the base revision (base_ref) resolved to. Empty for a single-commit diff. Use it to record the exact base of the comparison.
     */
    base_sha?: string;
    /**
     * Files returned with inline diff content.
     */
    files: Array<FileDiff>;
    /**
     * Files filtered out of inline diff output because of size or file-type rules.
     */
    filtered_files: Array<FilteredFile>;
    /**
     * The merge base of base_ref and ref: the commit where the diff starts. Empty for a single-commit diff.
     */
    merge_base_sha?: string;
    /**
     * The commit SHA to diff.
     */
    sha: string;
    /**
     * Aggregate diff statistics.
     */
    stats: DiffStats;
}
/**
 * Paginated tree entries in the repository at the resolved revision.
 */
export interface ReposFilesListResponse {
    /**
     * Tree entries for the resolved revision.
     */
    entries: Array<FileEntry>;
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
    /**
     * Flat blob-only path list. Mirrors the path of every entry whose type is "blob". Convenience shape for callers that just want file paths; use entries when you need type/mode.
     */
    paths: Array<string>;
    /**
     * The resolved reference (branch name or commit SHA) that was used.
     */
    ref: string;
}
/**
 * Files in the repository at the resolved revision, each annotated with mode, type, and the latest commit that changed it.
 */
export interface ReposFilesMetadataListResponse {
    /**
     * Commit metadata keyed by last_commit_sha so repeated commits are only sent once.
     */
    commits: Record<string, FileLastCommit>;
    /**
     * Files in the resolved revision, each annotated with the latest commit that changed it.
     */
    files: Array<FileWithMetadata>;
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
    /**
     * The resolved ref or commit used to generate the listing.
     */
    ref: string;
}
/**
 * Request body for storing a new HTTPS Git credential when the repository is identified via the URL path.
 */
export interface ReposGitCredentialsCreateRequest {
    /**
     * Password or access token for the upstream provider.
     */
    password: string;
    /**
     * Username for HTTPS authentication. Optional. With no username, requests to the upstream send the token as the password with the username `x-token-auth` for Bitbucket and `oauth2` for GitLab, and as the username for Gitea, Forgejo, and Codeberg. sr.ht takes no credential over HTTPS: it serves private repositories and pushes only over SSH.
     */
    username?: string;
}
/**
 * Request body for rotating an existing HTTPS Git credential when the credential is identified via the URL path.
 */
export interface ReposGitCredentialsUpdateRequest {
    /**
     * Updated password or access token for the upstream provider.
     */
    password: string;
    /**
     * Username for HTTPS authentication. Optional. With no username, requests to the upstream send the token as the password with the username `x-token-auth` for Bitbucket and `oauth2` for GitLab, and as the username for Gitea, Forgejo, and Codeberg. sr.ht takes no credential over HTTPS: it serves private repositories and pushes only over SSH. An omitted username clears the stored one.
     */
    username?: string;
}
/**
 * Grep request describing the pattern, ref, filters, limits, and pagination for a repository content search.
 */
export interface ReposGrepRequest {
    /**
     * Lines of context to include before and after each match.
     */
    context?: GrepContext;
    /**
     * Whether ref should be resolved from the ephemeral namespace.
     */
    ephemeral?: boolean;
    /**
     * Optional include and exclude filters applied before matching.
     */
    file_filters?: GrepFileFilters;
    /**
     * Maximum line and per-file match limits.
     */
    limits?: GrepLimits;
    /**
     * Cursor-based pagination controls for large result sets.
     */
    pagination?: GrepPagination;
    /**
     * Optional path prefixes used to narrow the search before pattern matching.
     */
    paths?: Array<string>;
    /**
     * Pattern configuration.
     */
    query: GrepQuery;
    /**
     * Preferred branch, tag, or commit to search.
     */
    ref?: string;
    /**
     * Deprecated: use ref. Legacy ref field retained for backwards compatibility.
     *
     * @deprecated
     */
    rev?: string;
}
/**
 * Grep results grouped per file, including the resolved ref and pagination state.
 */
export interface ReposGrepResponse {
    /**
     * Whether additional matches remain.
     */
    has_more: boolean;
    /**
     * True when the result set is incomplete because the server-side output cap was reached. Matches beyond the cap exist in the repo but cannot be retrieved by paging: narrow the query (pattern, paths, file filters) or raise max_lines if it was set below the maximum. next_cursor still pages through everything collected below the cap.
     */
    incomplete_results: boolean;
    /**
     * Files that matched the query, each with matching and context lines.
     */
    matches: Array<GrepFileMatch>;
    /**
     * Opaque cursor for the next page, if any.
     */
    next_cursor: string | null;
    /**
     * The effective query settings used by the server.
     */
    query: GrepResolvedQuery;
    /**
     * Resolved repository ref and commit used for the search.
     */
    repo: GrepResolvedRef;
}
/**
 * Paginated list of repositories for the current organisation.
 */
export interface ReposListResponse {
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
    /**
     * Repositories in the current page.
     */
    repos: Array<Repository>;
}
/**
 * Merge request body specifying source and target branches, optional pinned source SHA, merge strategy, optional squash flag, and optional retry-on-target-move behavior, which is currently unsupported for GitHub-backed public targets.
 */
export interface ReposMergeRequest {
    /**
     * Permit merges between unrelated histories.
     */
    allow_unrelated_histories?: boolean;
    /**
     * Author identity used when the backend creates a merge commit. Required for merge-commit strategies.
     */
    author?: GitIdentity;
    /**
     * Commit message used when a merge commit is created.
     */
    commit_message?: string;
    /**
     * Committer identity for the merge commit. Defaults to author when omitted.
     */
    committer?: GitIdentity;
    /**
     * Optional source commit guard. The merge uses this commit instead of the current tip of source_ref, and fails if source_ref does not contain it when the merge starts. A later advance of source_ref does not change the merged commit.
     */
    expected_source_sha?: string;
    /**
     * Optional branch tip guard. The merge fails if the target has moved since this SHA.
     */
    expected_target_sha?: string;
    /**
     * Deprecated: use source_ref. Source branch to merge from.
     *
     * @deprecated
     */
    source_branch?: string;
    /**
     * Whether source_ref should be resolved from the ephemeral namespace.
     */
    source_is_ephemeral?: boolean;
    /**
     * Branch or refs/heads ref to merge from. The merge reads the source and never updates it. Provide source_ref or the deprecated source_branch.
     */
    source_ref?: string;
    /**
     * When true, collapse the source into a single new commit whose only parent is the current target tip. Defaults to false, which preserves the standard merge/fast-forward behavior. Incompatible with the ff_only strategy.
     */
    squash?: boolean;
    /**
     * Merge strategy. merge creates a merge commit when needed, ff_only rejects non-fast-forward merges, and ff_prefer fast-forwards when possible before falling back to a merge commit.
     */
    strategy: 'ff_only' | 'ff_prefer' | 'merge' | (string & {});
    /**
     * Destination branch to update. A merge always updates a branch.
     */
    target_branch: string;
    /**
     * Whether target_branch should be resolved from the ephemeral namespace.
     */
    target_is_ephemeral?: boolean;
}
/**
 * Merge outcome including the resulting commit, source and target state, merge base information, and retry attempt counters when applicable.
 */
export interface ReposMergeResponse {
    /**
     * Commit SHA for the merge result. For a fast-forward or no-op, this is the resulting target tip.
     */
    commit_sha: string;
    /**
     * Merge base SHA when one exists and the backend reports it.
     */
    merge_base_sha?: string;
    /**
     * Number of commits promoted from source onto target.
     */
    promoted_commits: number;
    /**
     * Merge outcome: merge_commit, fast_forward, no_op, squash, or unknown.
     */
    result: string;
    /**
     * Source ref metadata with branch, ephemeral, and resolved sha.
     */
    source: MergeSourceState;
    /**
     * Target ref metadata with branch, ephemeral, previous old_sha, and resulting new_sha.
     */
    target: MergeTargetState;
    /**
     * Tree SHA for the resulting commit or target tip.
     */
    tree_sha: string;
}
/**
 * Append-note request describing the Git object, the text to add, and the optional notes ref guard.
 */
export interface ReposNotesAppendRequest {
    /**
     * Author object with name and email for the notes commit.
     */
    author?: GitIdentity;
    /**
     * Optional compare-and-swap guard for the notes ref. Provide expected_notes_ref_sha or the deprecated expected_ref_sha.
     */
    expected_notes_ref_sha?: string;
    /**
     * Deprecated: use expected_notes_ref_sha. Optional compare-and-swap guard for the notes ref.
     *
     * @deprecated
     */
    expected_ref_sha?: string;
    /**
     * Plain text to add to the note.
     */
    note: string;
    /**
     * Optional notes ref to target. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref.
     */
    notes_ref?: string;
    /**
     * Git object the note attaches to: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Provide object_ref or the deprecated sha.
     */
    object_ref?: string;
    /**
     * Deprecated: use notes_ref. Optional notes ref to target.
     *
     * @deprecated
     */
    ref?: string;
    /**
     * Deprecated: use object_ref. Git object SHA to attach the note to.
     *
     * @deprecated
     */
    sha?: string;
}
/**
 * Create-note request describing the Git object, the note content, and the optional notes ref guard.
 */
export interface ReposNotesCreateRequest {
    /**
     * Deprecated: use POST /notes/append to append. add creates a note and fails if one already exists. append adds text to the note, and creates the note if none exists.
     *
     * @deprecated
     */
    action?: string;
    /**
     * Author object with name and email for the notes commit.
     */
    author?: GitIdentity;
    /**
     * Optional compare-and-swap guard for the notes ref. Provide expected_notes_ref_sha or the deprecated expected_ref_sha.
     */
    expected_notes_ref_sha?: string;
    /**
     * Deprecated: use expected_notes_ref_sha. Optional compare-and-swap guard for the notes ref.
     *
     * @deprecated
     */
    expected_ref_sha?: string;
    /**
     * Plain-text note content. Required.
     */
    note?: string;
    /**
     * Optional notes ref to target. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref.
     */
    notes_ref?: string;
    /**
     * Git object the note attaches to: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Provide object_ref or the deprecated sha.
     */
    object_ref?: string;
    /**
     * Deprecated: use notes_ref. Optional notes ref to target.
     *
     * @deprecated
     */
    ref?: string;
    /**
     * Deprecated: use object_ref. Git object SHA to attach the note to.
     *
     * @deprecated
     */
    sha?: string;
}
/**
 * Deprecated delete-note body. Use the object_ref, notes_ref, and expected_notes_ref_sha query parameters.
 */
export interface ReposNotesDeleteRequest {
    /**
     * Deprecated: a delete ignores action.
     *
     * @deprecated
     */
    action?: string;
    /**
     * Deprecated: no replacement. Without author, the notes commit of a delete has the default author. Author object with name and email for the notes commit.
     *
     * @deprecated
     */
    author?: GitIdentity;
    /**
     * Deprecated: use the expected_notes_ref_sha query parameter. Optional compare-and-swap guard for the notes ref.
     *
     * @deprecated
     */
    expected_notes_ref_sha?: string;
    /**
     * Deprecated: use the expected_notes_ref_sha query parameter. Optional compare-and-swap guard for the notes ref.
     *
     * @deprecated
     */
    expected_ref_sha?: string;
    /**
     * Deprecated: a delete ignores note.
     *
     * @deprecated
     */
    note?: string;
    /**
     * Deprecated: use the notes_ref query parameter. Optional notes ref to target.
     *
     * @deprecated
     */
    notes_ref?: string;
    /**
     * Deprecated: use the object_ref query parameter. Git object the note attaches to.
     *
     * @deprecated
     */
    object_ref?: string;
    /**
     * Deprecated: use the notes_ref query parameter. Optional notes ref to target.
     *
     * @deprecated
     */
    ref?: string;
    /**
     * Deprecated: use the object_ref query parameter. Git object SHA the note attaches to.
     *
     * @deprecated
     */
    sha?: string;
}
/**
 * A single Git note attached to a commit, including the current notes ref tip.
 */
export interface ReposNotesGetResponse {
    /**
     * The note content.
     */
    note: string;
    /**
     * Current SHA of the notes ref the note was read from.
     */
    ref_sha: string;
    /**
     * The commit SHA.
     */
    sha: string;
}
/**
 * Paginated list of Git notes refs under the requested prefix.
 */
export interface ReposNotesRefsListResponse {
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
    /**
     * Normalized notes ref prefix used for the listing.
     */
    prefix: string;
    /**
     * List of notes refs.
     */
    refs: Array<NotesRef>;
}
/**
 * Read-only merge preview result, including clean or conflicted status and optional inline conflict content.
 */
export interface ReposPreviewMergeResponse {
    /**
     * Repository paths that conflicted during the merge preview.
     */
    conflict_paths: Array<string>;
    /**
     * Inline conflict content, populated only when include_content=true.
     */
    conflicts: Array<PreviewMergeConflict>;
    /**
     * Conflicts omitted from inline content because of request or server limits.
     */
    filtered_conflicts?: Array<PreviewMergeFilteredConflict>;
    /**
     * Merge base SHA used for the preview.
     */
    merge_base_sha?: string;
    /**
     * Operation result if applied: merge_commit, fast_forward, or no_op.
     */
    result: 'fast_forward' | 'merge_commit' | 'no_op' | (string & {});
    /**
     * Source branch requested by the caller.
     */
    source_branch: string;
    /**
     * Resolved source branch tip SHA.
     */
    source_tip_sha: string;
    /**
     * Preview status: clean or conflicted.
     */
    status: 'clean' | 'conflicted' | (string & {});
    /**
     * Target branch requested by the caller.
     */
    target_branch: string;
    /**
     * Resolved target branch tip SHA.
     */
    target_tip_sha: string;
}
/**
 * Create-tag request body describing the new tag and the commit it points to.
 */
export interface ReposTagsCreateRequest {
    /**
     * Tag name. Must be a valid Git ref name and must not start with refs/.
     */
    name: string;
    /**
     * Branch, tag, or commit the tag should point to. Provide ref or the deprecated target.
     */
    ref?: string;
    /**
     * Deprecated: use ref. Commit the tag should point to.
     *
     * @deprecated
     */
    target?: string;
}
/**
 * Result of creating a tag.
 */
export interface ReposTagsCreateResponse {
    /**
     * Human-readable result message.
     */
    message: string;
    /**
     * Tag name.
     */
    name: string;
    /**
     * Commit SHA the tag points to.
     */
    sha: string;
}
/**
 * Result of deleting a tag.
 */
export interface ReposTagsDeleteResponse {
    /**
     * Human-readable result message.
     */
    message: string;
    /**
     * Tag name.
     */
    name: string;
}
/**
 * One tag that matches an exact short name.
 */
export interface ReposTagsGetResponse {
    /**
     * The tag that has the requested name.
     */
    tag: Tag;
}
/**
 * Paginated list of tags for the repository.
 */
export interface ReposTagsListResponse {
    /**
     * Whether another page is available.
     */
    has_more: boolean;
    /**
     * Opaque cursor for the next page. Pass it as `cursor` to read the next page. Absent when there are no more results.
     */
    next_cursor?: string;
    /**
     * List of tag objects.
     */
    tags: Array<TagListItem>;
}
/**
 * Repository settings to patch, such as the default branch.
 */
export interface ReposUpdateRequest {
    /**
     * New default branch name for the Code Storage repository.
     */
    default_branch?: string;
}
/**
 * Repository state after applying the patch.
 */
export interface ReposUpdateResponse {
    /**
     * Updated default branch name.
     */
    default_branch: string;
    /**
     * Deprecated: use repo_name. Stable repository identifier.
     *
     * @deprecated
     */
    id: string;
    /**
     * Deprecated: use repo_name. Stable repository identifier.
     *
     * @deprecated
     */
    repo_id: string;
    /**
     * Repository name or path. It can contain a slash. It matches the JWT repo claim.
     */
    repo_name: string;
    /**
     * Deprecated: use repo_name. Repository name or path, not a full URL.
     *
     * @deprecated
     */
    url: string;
}
/**
 * Confirmation that the upstream link has been detached from the repository.
 */
export interface ReposUpstreamDeleteResponse {
    /**
     * Human-readable detach status message.
     */
    message: string;
}
/**
 * Deprecated upstream pull body. Its fields have no effect, so send no body.
 */
export interface ReposUpstreamPullRequest {
    /**
     * Deprecated: omit it. The field has no effect, and no response returns a token for it. A pull syncs every branch and tag of the upstream.
     *
     * @deprecated
     */
    after?: string;
    /**
     * Deprecated: omit it. The field has no effect: a pull syncs every branch and tag of the upstream.
     *
     * @deprecated
     */
    ref?: string;
}
/**
 * Acknowledgement that an upstream sync has been initiated; the sync itself runs asynchronously.
 */
export interface ReposUpstreamPullResponse {
    /**
     * Human-readable status message.
     */
    message: string;
}
/**
 * A repository, including its Git Sync upstream when one is configured.
 */
export interface Repository {
    /**
     * Deprecated: use upstream. The upstream of the repository, when it has one.
     *
     * @deprecated
     */
    base_repo?: UpstreamRepo;
    /**
     * ISO 8601 creation timestamp.
     */
    created_at: string;
    /**
     * Default branch name.
     */
    default_branch: string;
    /**
     * Deprecated: use repo_name. Stable repository identifier.
     *
     * @deprecated
     */
    repo_id: string;
    /**
     * Repository name or path. It can contain a slash. It matches the JWT repo claim.
     */
    repo_name: string;
    /**
     * External Git host that the repository keeps syncing from. Absent when the repository has no upstream.
     */
    upstream?: UpstreamRepo;
    /**
     * Deprecated: use repo_name. Repository name or path, not a full URL.
     *
     * @deprecated
     */
    url: string;
}
/**
 * Commit object generated by a restore-commit operation.
 */
export interface RestoredCommit {
    /**
     * SHA of the new restore commit.
     */
    commit_sha: string;
    /**
     * Size of the generated pack in bytes.
     */
    pack_bytes: number;
    /**
     * Branch that was reset.
     */
    target_branch: string;
    /**
     * Tree SHA of the restore commit.
     */
    tree_sha: string;
}
/**
 * A tag.
 */
export interface Tag {
    /**
     * Tag name.
     */
    name: string;
    /**
     * Dereferenced commit SHA for the tag.
     */
    sha: string;
}
/**
 * A tag in a list, with its pagination cursor.
 */
export interface TagListItem extends Tag {
    /**
     * Opaque pagination token for this tag entry.
     */
    cursor: string;
}
/**
 * External Git host that a new repository keeps syncing from.
 */
export interface UpstreamConfig {
    /**
     * GitHub only. app (the default) reads through the GitHub App installation of the organization. public mirrors a public repository without an installation, and syncs only on request.
     */
    access?: 'app' | 'public' | (string & {});
    /**
     * Bare hostname of a self-hosted provider, such as gitlab.example.com. It defaults to the public host of the provider.
     */
    host?: string;
    /**
     * Repository name on the upstream provider.
     */
    name: string;
    /**
     * Repository owner or namespace on the upstream provider.
     */
    owner: string;
    /**
     * External Git host of the upstream repository.
     */
    provider: 'bitbucket' | 'codeberg' | 'forgejo' | 'gitea' | 'github' | 'gitlab' | 'sourcehut' | 'sr.ht' | (string & {});
}
/**
 * Git Sync upstream of a repository.
 */
export interface UpstreamRepo {
    /**
     * Upstream repository name.
     */
    name?: string;
    /**
     * Upstream repository owner or namespace.
     */
    owner?: string;
    /**
     * Upstream provider name.
     */
    provider: string;
}
/**
 * The repository that produced the event.
 */
export interface WebhookRepository {
    /**
     * The internal repository ID.
     */
    id: string;
    /**
     * The repository name, for example team/project. It can be absent on older deliveries.
     */
    repo_name?: string;
    /**
     * Deprecated: use repo_name, which has the same value. The repository name, for example team/project.
     *
     * @deprecated
     */
    url: string;
}
/**
 * Commit object information generated when a pack is applied.
 */
export interface WrittenCommit {
    /**
     * Number of blobs included in the pack.
     */
    blob_count: number;
    /**
     * SHA of the new commit.
     */
    commit_sha: string;
    /**
     * Size of the generated pack in bytes.
     */
    pack_bytes: number;
    /**
     * Branch the commit was written to.
     */
    target_branch: string;
    /**
     * Tree SHA of the new commit.
     */
    tree_sha: string;
}
//# sourceMappingURL=schemas.d.ts.map