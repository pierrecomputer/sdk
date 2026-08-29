/**
 * Type definitions for Pierre Git Storage SDK
 */
import type {
  CreateBranchResponseRaw,
  CreateTagResponseRaw,
  DeleteBranchResponseRaw,
  DeleteTagResponseRaw,
  BlameResponseRaw,
  GetBranchDiffResponseRaw,
  GetBranchResponseRaw,
  GetCommitDiffResponseRaw,
  GetCommitResponseRaw,
  ListBranchesResponseRaw,
  ListCommitsResponseRaw,
  ListFilesResponseRaw,
  ListFilesWithMetadataResponseRaw,
  ListReposResponseRaw,
  MergeResponseRaw,
  PreviewMergeBlobRaw as SchemaPreviewMergeBlob,
  PreviewMergeConflictRaw as SchemaPreviewMergeConflict,
  PreviewMergeFilteredConflictRaw as SchemaPreviewMergeFilteredConflict,
  PreviewMergeResponseRaw,
  ListTagsResponseRaw,
  GetTagResponseRaw,
  ListNotesRefsResponseRaw,
  NoteReadResponseRaw,
  NoteWriteResponseRaw,
  RawBranchInfo as SchemaRawBranchInfo,
  RawNotesRefInfo as SchemaRawNotesRefInfo,
  RawCommitMetadata as SchemaRawCommitMetadata,
  RawCommitInfo as SchemaRawCommitInfo,
  RawFileWithMetadata as SchemaRawFileWithMetadata,
  RawFileDiff as SchemaRawFileDiff,
  RawFilteredFile as SchemaRawFilteredFile,
  RawRepoBaseInfo as SchemaRawRepoBaseInfo,
  RawRepoInfo as SchemaRawRepoInfo,
  RawTagInfo as SchemaRawTagInfo,
  RawTreeEntry as SchemaRawTreeEntry,
  TreeEntryTypeRaw as SchemaTreeEntryTypeRaw,
} from './schemas';

export interface OverrideableGitStorageOptions {
  apiBaseUrl?: string;
  storageBaseUrl?: string;
  /**
   * @deprecated The API is served on unversioned `/api` paths; this option is
   * still accepted for backwards compatibility but no longer affects request
   * URLs.
   */
  apiVersion?: ValidAPIVersion;
  defaultTTL?: number;
}

export interface GitStorageOptions extends OverrideableGitStorageOptions {
  /**
   * ES256 private key (PKCS#8 PEM) used to mint a fresh JWT for each API call.
   * Required unless `token` is supplied.
   */
  key?: string;
  name: string;
  /**
   * A pre-minted JWT to send on every authenticated request instead of signing
   * one per call from `key`. When set, `key` is not required and per-call scope,
   * TTL, and ref-policy options are ignored — the token's own claims (repo,
   * scopes, exp) govern what the client is allowed to do.
   */
  token?: string;
  defaultTTL?: number;
}

export type ValidAPIVersion = 1;

/** A policy operation included in the JWT. */
export type Op = string;

export const OP_NO_FORCE_PUSH: Op = "no-force-push";

export const OP_NO_PUSH: Op = "no-push";

/**
 * Requires every commit introduced by a push to a matching ref to carry a
 * valid signature from a registered signing key.
 */
export const OP_VERIFY_SIG: Op = "verify-sig";

/** A list of policy operations. */
export type Ops = Op[];

/** A single ordered ref-matching policy rule (first match wins). */
export interface RefPolicy {
  pattern: string;
  ops?: Ops;
}

/** Ordered per-ref policy rules for the JWT `refs` claim. */
export type RefPolicies = RefPolicy[];

/** Optional per-ref policies that can be attached to a minted JWT for any ref-mutating call. */
export interface PolicyOptions {
  /** Per-ref policy rules evaluated in declaration order (first match wins). */
  refPolicies?: RefPolicies;
}

export interface GetRemoteURLOptions extends PolicyOptions {
  permissions?: ("git:write" | "git:read" | "repo:write" | "org:read")[];
  ttl?: number;
  /**
   * Repo-wide policy ops.
   *
   * @deprecated Use `refPolicies` instead.
   */
  ops?: Ops;
}

export interface Repo {
  id: string;
  defaultBranch: string;
  createdAt: string;
  getRemoteURL(options?: GetRemoteURLOptions): Promise<string>;
  getEphemeralRemoteURL(options?: GetRemoteURLOptions): Promise<string>;
  getImportRemoteURL(options?: GetRemoteURLOptions): Promise<string>;

  getFileStream(options: GetFileOptions): Promise<Response>;
  headFile(options: HeadFileOptions): Promise<FileMetadata>;
  getArchiveStream(options?: ArchiveOptions): Promise<Response>;
  listFiles(options?: ListFilesOptions): Promise<ListFilesResult>;
  listFilesWithMetadata(
    options?: ListFilesWithMetadataOptions,
  ): Promise<ListFilesWithMetadataResult>;
  listBranches(options?: ListBranchesOptions): Promise<ListBranchesResult>;
  getBranch(options: GetBranchOptions): Promise<GetBranchResult>;
  listTags(options?: ListTagsOptions): Promise<ListTagsResult>;
  getTag(options: GetTagOptions): Promise<GetTagResult>;
  listCommits(options?: ListCommitsOptions): Promise<ListCommitsResult>;
  getCommit(options: GetCommitOptions): Promise<GetCommitResult>;
  getBlame(options: BlameOptions): Promise<BlameResult>;
  createTag(options: CreateTagOptions): Promise<CreateTagResult>;
  deleteTag(options: DeleteTagOptions): Promise<DeleteTagResult>;
  getNote(options: GetNoteOptions): Promise<GetNoteResult>;
  createNote(options: CreateNoteOptions): Promise<NoteWriteResult>;
  appendNote(options: AppendNoteOptions): Promise<NoteWriteResult>;
  deleteNote(options: DeleteNoteOptions): Promise<NoteWriteResult>;
  listNotesRefs(options?: ListNotesRefsOptions): Promise<ListNotesRefsResult>;
  getBranchDiff(options: GetBranchDiffOptions): Promise<GetBranchDiffResult>;
  getCommitDiff(options: GetCommitDiffOptions): Promise<GetCommitDiffResult>;
  grep(options: GrepOptions): Promise<GrepResult>;
  pullUpstream(options?: PullUpstreamOptions): Promise<void>;
  restoreCommit(options: RestoreCommitOptions): Promise<RestoreCommitResult>;
  previewMerge(options: PreviewMergeOptions): Promise<PreviewMergeResult>;
  merge(options: MergeOptions): Promise<MergeResult>;
  createBranch(options: CreateBranchOptions): Promise<CreateBranchResult>;
  deleteBranch(options: DeleteBranchOptions): Promise<DeleteBranchResult>;
  createCommit(options: CreateCommitOptions): CommitBuilder;
  createCommitFromDiff(
    options: CreateCommitFromDiffOptions,
  ): Promise<CommitResult>;
}

export type ValidMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
type SimplePath = string;
type ComplexPath = {
  path: string;
  params?: Record<string, string | string[]>;
  body?: Record<string, any>;
};
export type ValidPath = SimplePath | ComplexPath;

interface GitStorageInvocationOptions {
  ttl?: number;
}

export interface FindOneOptions {
  id: string;
}

export interface RepoOptions {
  id: string;
  defaultBranch?: string;
  createdAt?: string;
}

export type SupportedRepoProvider =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "gitea"
  | "forgejo"
  | "codeberg"
  | "sr.ht";

export interface PublicGitHubBaseRepoAuth {
  /**
   * Force public GitHub mode (no GitHub App installation required).
   */
  authType: "public";
}

export interface GitHubBaseRepo {
  /**
   * @default github
   */
  provider?: "github";
  owner: string;
  name: string;
  defaultBranch?: string;
  auth?: PublicGitHubBaseRepoAuth;
}

export interface GenericGitBaseRepo {
  /**
   * The git host provider. Must be one of the supported generic git providers.
   */
  provider: Exclude<SupportedRepoProvider, "github">;
  owner: string;
  name: string;
  defaultBranch?: string;
  /**
   * Bare hostname for self-hosted instances (e.g. "gitlab.example.com").
   * Falls back to the provider's default host when omitted.
   */
  upstreamHost?: string;
}

export interface ForkBaseRepo {
  id: string;
  ref?: string;
  sha?: string;
}

export type BaseRepo = GitHubBaseRepo | ForkBaseRepo | GenericGitBaseRepo;

export interface CreateGitCredentialOptions {
  /** @deprecated Use `repoName` with `CreateGitCredentialByNameOptions`. */
  repoId: string;
  username?: string;
  password: string;
  ttl?: number;
}

export interface CreateGitCredentialByNameOptions {
  repoName: string;
  /** @deprecated The preferred route ignores this internal repository ID. */
  repoId?: string;
  username?: string;
  password: string;
  ttl?: number;
}

export interface UpdateGitCredentialOptions {
  /**
   * Repository name. When omitted, the SDK keeps the deprecated request for
   * source compatibility.
   */
  repoName?: string;
  id: string;
  username?: string;
  password: string;
  ttl?: number;
}

export interface DeleteGitCredentialOptions {
  /**
   * Repository name. When omitted, the SDK keeps the deprecated request for
   * source compatibility.
   */
  repoName?: string;
  id: string;
  ttl?: number;
}

export interface GitCredential {
  id: string;
  createdAt?: string;
}

export interface ListReposOptions extends GitStorageInvocationOptions {
  cursor?: string;
  limit?: number;
  /**
   * Case-insensitive substring matched against repository `url`. Trimmed before
   * matching; empty after trim is treated as omitted.
   */
  q?: string;
}

export type RawRepoBaseInfo = SchemaRawRepoBaseInfo;

export interface RepoBaseInfo {
  provider: string;
  owner: string;
  name: string;
}

export type RawRepoInfo = SchemaRawRepoInfo;

export interface RepoInfo {
  repoId: string;
  repoName: string;
  /** @deprecated Use repoName instead. */
  url: string;
  defaultBranch: string;
  createdAt: string;
  baseRepo?: RepoBaseInfo;
}

export type ListReposResponse = ListReposResponseRaw;

export interface ListReposResult {
  repos: RepoInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CreateRepoOptions extends GitStorageInvocationOptions {
  id?: string;
  baseRepo?: BaseRepo;
  defaultBranch?: string;
}

export interface DeleteRepoOptions extends GitStorageInvocationOptions {
  id: string;
}

export interface DeleteRepoResult {
  repoId: string;
  message: string;
}

// Get File API types
export interface FileRequestHeaders {
  range?: string;
  ifMatch?: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifUnmodifiedSince?: string;
  ifRange?: string;
}

export interface GetFileOptions extends GitStorageInvocationOptions {
  path: string;
  ref?: string;
  ephemeral?: boolean;
  ephemeralBase?: boolean;
  headers?: FileRequestHeaders;
}

export type HeadFileOptions = GetFileOptions;

export interface FileMetadata {
  status?: number;
  blobSha: string;
  lastCommitSha: string;
  size?: number;
  etag?: string;
  lastModified?: Date;
  rawLastModified?: string;
  acceptRanges?: string;
  contentRange?: string;
  contentType?: string;
}

export interface ArchiveOptions extends GitStorageInvocationOptions {
  ref?: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxBlobSize?: number;
  archivePrefix?: string;
}

export interface PullUpstreamOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  ref?: string;
}

export type RawTreeEntry = SchemaRawTreeEntry;
export type TreeEntryType = SchemaTreeEntryTypeRaw;

export interface TreeEntry {
  path: string;
  type: TreeEntryType;
  mode: string;
}

// List Files API types
export interface ListFilesOptions extends GitStorageInvocationOptions {
  ref?: string;
  ephemeral?: boolean;
  path?: string;
  recursive?: boolean;
  cursor?: string;
  limit?: number;
}

export type ListFilesResponse = ListFilesResponseRaw;

export interface ListFilesResult {
  paths: string[];
  ref: string;
  entries: TreeEntry[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ListFilesWithMetadataOptions extends GitStorageInvocationOptions {
  ref?: string;
  ephemeral?: boolean;
  path?: string;
  /** Accepted for symmetry with listFiles; metadata listings are always recursive. */
  recursive?: boolean;
  cursor?: string;
  limit?: number;
}

export type RawFileWithMetadata = SchemaRawFileWithMetadata;

export interface FileWithMetadata {
  path: string;
  mode: string;
  size: number;
  lastCommitSha: string;
  type?: TreeEntryType;
}

export type RawCommitMetadata = SchemaRawCommitMetadata;

export interface CommitMetadata {
  author: string;
  date: Date;
  rawDate: string;
  message: string;
}

export type ListFilesWithMetadataResponse = ListFilesWithMetadataResponseRaw;

export interface ListFilesWithMetadataResult {
  files: FileWithMetadata[];
  commits: Record<string, CommitMetadata>;
  ref: string;
  nextCursor?: string;
  hasMore: boolean;
}

// List Branches API types
export interface ListBranchesOptions extends GitStorageInvocationOptions {
  cursor?: string;
  limit?: number;
  ephemeral?: boolean;
}

export type RawBranchInfo = SchemaRawBranchInfo;

export interface BranchInfo {
  cursor: string;
  name: string;
  headSha: string;
  createdAt: string;
}

export type ListBranchesResponse = ListBranchesResponseRaw;

export interface ListBranchesResult {
  branches: BranchInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface GetBranchOptions extends GitStorageInvocationOptions {
  name: string;
  ephemeral?: boolean;
}

export type GetBranchResponse = GetBranchResponseRaw;

export interface GetBranchResult {
  name: string;
  headSha: string;
  createdAt: string;
}

// Create Branch API types
export interface CreateBranchOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  baseRef?: string;
  /** @deprecated Use baseRef instead. */
  baseBranch?: string;
  targetBranch: string;
  baseIsEphemeral?: boolean;
  targetIsEphemeral?: boolean;
}

export type CreateBranchResponse = CreateBranchResponseRaw;

export interface CreateBranchResult {
  message: string;
  targetBranch: string;
  targetIsEphemeral: boolean;
  commitSha?: string;
}

export interface DeleteBranchOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  targetBranch?: string;
  /** @deprecated Use targetBranch instead. */
  name?: string;
  ephemeral?: boolean;
}

export type DeleteBranchResponse = DeleteBranchResponseRaw;

export interface DeleteBranchResult {
  targetBranch: string;
  /** @deprecated Use targetBranch instead. */
  name: string;
  message: string;
  ephemeral: boolean;
}

export interface ListTagsOptions extends GitStorageInvocationOptions {
  cursor?: string;
  limit?: number;
}

export type RawTagInfo = SchemaRawTagInfo;

export interface TagInfo {
  cursor: string;
  name: string;
  sha: string;
}

export type ListTagsResponse = ListTagsResponseRaw;

export interface ListTagsResult {
  tags: TagInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface GetTagOptions extends GitStorageInvocationOptions {
  name: string;
}

export type GetTagResponse = GetTagResponseRaw;

export interface GetTagResult {
  name: string;
  sha: string;
}

export interface CreateTagOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  name: string;
  ref?: string;
  /** @deprecated Use ref instead. */
  target?: string;
}

export type CreateTagResponse = CreateTagResponseRaw;

export interface CreateTagResult {
  name: string;
  sha: string;
  message: string;
}

export interface DeleteTagOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  name: string;
}

export type DeleteTagResponse = DeleteTagResponseRaw;

export interface DeleteTagResult {
  name: string;
  message: string;
}

// List Commits API types
export interface ListCommitsOptions extends GitStorageInvocationOptions {
  ref?: string;
  /** @deprecated Use ref instead. */
  branch?: string;
  cursor?: string;
  limit?: number;
  ephemeral?: boolean;
  path?: string;
}

export type RawCommitInfo = SchemaRawCommitInfo;

export interface CommitInfo {
  sha: string;
  /** Parent commit SHAs in Git parent order. Empty for root commits. */
  parentShas: string[];
  message: string;
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  date: Date;
  rawDate: string;
  /**
   * Armored OpenPGP/SSH signature from the commit's gpgsig header. Only set by
   * `getCommit` for signed commits. Always undefined for list-commits entries
   * and unsigned commits.
   */
  signature?: string;
  /**
   * The exact bytes the signature is computed over (the raw commit object with
   * the gpgsig header removed). Only set by `getCommit` for signed commits.
   * Always undefined for list-commits entries and unsigned commits.
   */
  payload?: string;
}

export type ListCommitsResponse = ListCommitsResponseRaw;

export interface ListCommitsResult {
  commits: CommitInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

// Get Commit API types
export interface GetCommitOptions extends GitStorageInvocationOptions {
  ref?: string;
  /** @deprecated Use ref instead. */
  sha?: string;
}

export type GetCommitResponse = GetCommitResponseRaw;

export interface GetCommitResult {
  commit: CommitInfo;
}

// Blame API types
export interface BlameOptions extends GitStorageInvocationOptions {
  path: string;
  ref?: string;
  ephemeral?: boolean;
  ranges?: string[];
  detectMoves?: boolean;
}

export type BlameResponse = BlameResponseRaw;

export interface BlameLine {
  lineNumber: number;
  commitSha: string;
  originalLineNumber: number;
  originalPath: string;
  previousCommitSha?: string;
  authorName: string;
  authorEmail: string;
  authorTime: Date;
  rawAuthorTime: string;
  committerName: string;
  committerEmail: string;
  committerTime: Date;
  rawCommitterTime: string;
  summary: string;
}

export interface BlameResult {
  ref: string;
  path: string;
  commitSha: string;
  lines: BlameLine[];
}

// Git notes API types
export interface GetNoteOptions extends GitStorageInvocationOptions {
  objectRef?: string;
  /** @deprecated Use objectRef instead. */
  sha?: string;
  /**
   * Notes ref to read from. A bare name like `reviews` is placed under
   * `refs/notes/`; a fully-qualified `refs/notes/*` ref is also accepted.
   * Defaults to `refs/notes/commits`. Custom refs require the feature to be
   * enabled server-side.
   */
  notesRef?: string;
  /** @deprecated Use notesRef instead. */
  ref?: string;
}

export type GetNoteResponse = NoteReadResponseRaw;

export interface GetNoteResult {
  sha: string;
  note: string;
  refSha: string;
}

interface NoteWriteBaseOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  objectRef?: string;
  /** @deprecated Use objectRef instead. */
  sha?: string;
  note: string;
  expectedNotesRefSha?: string;
  /** @deprecated Use expectedNotesRefSha instead. */
  expectedRefSha?: string;
  author?: CommitSignature;
  /**
   * Notes ref to target. A bare name like `reviews` is placed under
   * `refs/notes/`; a fully-qualified `refs/notes/*` ref is also accepted.
   * Defaults to `refs/notes/commits`. Custom refs require the feature to be
   * enabled server-side, and the JWT `refPolicies` must permit writing to it.
   */
  notesRef?: string;
  /** @deprecated Use notesRef instead. */
  ref?: string;
}

export type CreateNoteOptions = NoteWriteBaseOptions;

export type AppendNoteOptions = NoteWriteBaseOptions;

export interface DeleteNoteOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  objectRef?: string;
  /** @deprecated Use objectRef instead. */
  sha?: string;
  expectedNotesRefSha?: string;
  /** @deprecated Use expectedNotesRefSha instead. */
  expectedRefSha?: string;
  author?: CommitSignature;
  /**
   * Notes ref to target. A bare name like `reviews` is placed under
   * `refs/notes/`; a fully-qualified `refs/notes/*` ref is also accepted.
   * Defaults to `refs/notes/commits`.
   */
  notesRef?: string;
  /** @deprecated Use notesRef instead. */
  ref?: string;
}

export interface NoteWriteResultPayload {
  success: boolean;
  status: string;
  message?: string;
}

export type NoteWriteResponse = NoteWriteResponseRaw;

export interface NoteWriteResult {
  sha: string;
  notesRef: string;
  /**
   * The notes ref the operation targeted (the resolved value of the request
   * `notesRef`, defaulting to `refs/notes/commits`).
   *
   * @deprecated Use notesRef instead.
   */
  targetRef: string;
  baseCommit?: string;
  newRefSha: string;
  result: NoteWriteResultPayload;
}

// List notes refs API types
export interface ListNotesRefsOptions extends GitStorageInvocationOptions {
  /**
   * Notes ref prefix to enumerate. A bare prefix like `reviews/` is placed
   * under `refs/notes/`; a fully-qualified `refs/notes/*` prefix is also
   * accepted. Defaults to `refs/notes/`.
   */
  prefix?: string;
  cursor?: string;
  limit?: number;
}

export type RawNotesRefInfo = SchemaRawNotesRefInfo;

export interface NotesRefInfo {
  cursor: string;
  ref: string;
  sha: string;
}

export type ListNotesRefsResponse = ListNotesRefsResponseRaw;

export interface ListNotesRefsResult {
  refs: NotesRefInfo[];
  nextCursor?: string;
  hasMore: boolean;
  /** Normalized notes ref prefix used for the listing. */
  prefix: string;
}

// Branch Diff API types
export interface GetBranchDiffOptions extends GitStorageInvocationOptions {
  branch: string;
  base?: string;
  ephemeral?: boolean;
  ephemeralBase?: boolean;
  /** Optional paths to filter the diff to specific files */
  paths?: string[];
}

export type GetBranchDiffResponse = GetBranchDiffResponseRaw;

export interface GetBranchDiffResult {
  branch: string;
  base: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}

// Commit Diff API types
export interface GetCommitDiffOptions extends GitStorageInvocationOptions {
  ref?: string;
  /** @deprecated Use ref instead. */
  sha?: string;
  baseRef?: string;
  /** @deprecated Use baseRef instead. */
  baseSha?: string;
  refIsEphemeral?: boolean;
  baseIsEphemeral?: boolean;
  /** Generate raw diffs that can be applied to the exact base tree. Defaults to false. */
  gitApplyCompatible?: boolean;
  /** Optional paths to filter the diff to specific files */
  paths?: string[];
}

export type GetCommitDiffResponse = GetCommitDiffResponseRaw;

export interface GetCommitDiffResult {
  sha: string;
  baseSha?: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}

// Grep API types
export interface GrepOptions extends GitStorageInvocationOptions {
  ref?: string;
  /**
   * @deprecated Use ref instead.
   */
  rev?: string;
  ephemeral?: boolean;
  paths?: string[];
  query: {
    pattern: string;
    /**
     * Default is case-sensitive.
     * When omitted, the server default is used.
     */
    caseSensitive?: boolean;
  };
  fileFilters?: {
    includeGlobs?: string[];
    excludeGlobs?: string[];
    extensionFilters?: string[];
  };
  context?: {
    before?: number;
    after?: number;
  };
  limits?: {
    maxLines?: number;
    maxMatchesPerFile?: number;
  };
  pagination?: {
    cursor?: string;
    limit?: number;
  };
}

export interface GrepLine {
  lineNumber: number;
  text: string;
  type: string;
}

export interface GrepFileMatch {
  path: string;
  lines: GrepLine[];
}

export interface GrepResult {
  query: {
    pattern: string;
    caseSensitive: boolean;
  };
  repo: {
    ref: string;
    commit: string;
  };
  matches: GrepFileMatch[];
  nextCursor?: string;
  hasMore: boolean;
}

// Shared diff types
export interface DiffStats {
  files: number;
  additions: number;
  deletions: number;
  changes: number;
}

export type RawFileDiff = SchemaRawFileDiff;

export type RawFilteredFile = SchemaRawFilteredFile;

export type DiffFileState =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type_changed"
  | "unmerged"
  | "unknown";

export interface DiffFileBase {
  path: string;
  state: DiffFileState;
  rawState: string;
  oldPath?: string;
  bytes: number;
  isEof: boolean;
}

export interface FileDiff extends DiffFileBase {
  raw: string;
  additions: number;
  deletions: number;
}

export interface FilteredFile extends DiffFileBase {}

interface CreateCommitBaseOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  commitMessage: string;
  expectedTargetSha?: string;
  /** @deprecated Use expectedTargetSha instead. */
  expectedHeadSha?: string;
  baseBranch?: string;
  targetIsEphemeral?: boolean;
  /** @deprecated Use targetIsEphemeral instead. */
  ephemeral?: boolean;
  baseIsEphemeral?: boolean;
  /** @deprecated Use baseIsEphemeral instead. */
  ephemeralBase?: boolean;
  author: CommitSignature;
  committer?: CommitSignature;
  signal?: AbortSignal;
}

export interface CreateCommitBranchOptions extends CreateCommitBaseOptions {
  targetBranch: string;
  targetRef?: never;
}

/**
 * @deprecated Use {@link CreateCommitBranchOptions} instead.
 */
export interface LegacyCreateCommitOptions extends CreateCommitBaseOptions {
  targetBranch?: never;
  targetRef: string;
}

export type CreateCommitOptions =
  | CreateCommitBranchOptions
  | LegacyCreateCommitOptions;

export interface CommitSignature {
  name: string;
  email: string;
}

export interface ReadableStreamReaderLike<T> {
  read(): Promise<{ value?: T; done: boolean }>;
  releaseLock?(): void;
}

export interface ReadableStreamLike<T> {
  getReader(): ReadableStreamReaderLike<T>;
}

export interface BlobLike {
  stream(): unknown;
}

export interface FileLike extends BlobLike {
  name: string;
  lastModified?: number;
}

export type GitFileMode = "100644" | "100755" | "120000" | "160000";

export type TextEncoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "utf-16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "base64url"
  | "latin1"
  | "binary"
  | "hex";

export type CommitFileSource =
  | string
  | Uint8Array
  | ArrayBuffer
  | BlobLike
  | FileLike
  | ReadableStreamLike<Uint8Array | ArrayBuffer | ArrayBufferView | string>
  | AsyncIterable<Uint8Array | ArrayBuffer | ArrayBufferView | string>
  | Iterable<Uint8Array | ArrayBuffer | ArrayBufferView | string>;

export interface CommitFileOptions {
  mode?: GitFileMode;
}

export interface CommitTextFileOptions extends CommitFileOptions {
  encoding?: TextEncoding;
}

export interface CommitBuilder {
  addFile(
    path: string,
    source: CommitFileSource,
    options?: CommitFileOptions,
  ): CommitBuilder;
  addFileFromString(
    path: string,
    contents: string,
    options?: CommitTextFileOptions,
  ): CommitBuilder;
  deletePath(path: string): CommitBuilder;
  send(): Promise<CommitResult>;
}

export type DiffSource = CommitFileSource;

export interface CreateCommitFromDiffOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  targetBranch: string;
  commitMessage: string;
  diff: DiffSource;
  expectedTargetSha?: string;
  /** @deprecated Use expectedTargetSha instead. */
  expectedHeadSha?: string;
  baseBranch?: string;
  targetIsEphemeral?: boolean;
  /** @deprecated Use targetIsEphemeral instead. */
  ephemeral?: boolean;
  baseIsEphemeral?: boolean;
  /** @deprecated Use baseIsEphemeral instead. */
  ephemeralBase?: boolean;
  author: CommitSignature;
  committer?: CommitSignature;
  signal?: AbortSignal;
}

export interface RefUpdate {
  targetBranch: string;
  /** @deprecated Use targetBranch instead. */
  branch: string;
  oldSha: string;
  newSha: string;
}

export type RefUpdateReason =
  | "precondition_failed"
  | "conflict"
  | "not_found"
  | "invalid"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "unavailable"
  | "internal"
  | "failed"
  | "unknown";

export interface CommitResult {
  commitSha: string;
  treeSha: string;
  targetBranch: string;
  packBytes: number;
  blobCount: number;
  refUpdate: RefUpdate;
}

export type MergeStrategy = "merge" | "ff_only" | "ff_prefer";

export type MergeResultLabel =
  | "merge_commit"
  | "fast_forward"
  | "no_op"
  | "squash"
  | "unknown";

export interface MergeOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  sourceRef?: string;
  /** @deprecated Use sourceRef instead. */
  sourceBranch?: string;
  sourceIsEphemeral?: boolean;
  targetBranch: string;
  targetIsEphemeral?: boolean;
  /**
   * When provided, the target branch must still point at this commit; the merge
   * fails with HTTP 409 if it moved. Omit to merge into the current target tip.
   * Native Code Storage targets may retry stale target/repository movement while
   * preserving the resolved source commit.
   */
  expectedTargetSha?: string;
  commitMessage?: string;
  author?: CommitSignature;
  committer?: CommitSignature;
  strategy: MergeStrategy;
  allowUnrelatedHistories?: boolean;
  /** Incompatible with the `ff_only` strategy. */
  squash?: boolean;
}

export type MergeResponse = Omit<MergeResponseRaw, "result"> & {
  result: MergeResultLabel;
};

export type PreviewMergeStatus = "clean" | "conflicted";

export type PreviewMergeResultLabel = "merge_commit" | "fast_forward" | "no_op";

export interface PreviewMergeOptions extends GitStorageInvocationOptions {
  sourceBranch: string;
  targetBranch: string;
  includeContent?: boolean;
}

export type PreviewMergeBlob = SchemaPreviewMergeBlob;

export interface PreviewMergeConflict
  extends Omit<SchemaPreviewMergeConflict, "result" | "base" | "ours" | "theirs"> {
  result: PreviewMergeBlob;
  base: PreviewMergeBlob;
  ours: PreviewMergeBlob;
  theirs: PreviewMergeBlob;
}

export type PreviewMergeFilteredConflict = SchemaPreviewMergeFilteredConflict;

export type PreviewMergeResponse = Omit<PreviewMergeResponseRaw, "result"> & {
  result: PreviewMergeResultLabel;
};

export interface PreviewMergeResult {
  status: PreviewMergeStatus;
  result: PreviewMergeResultLabel;
  sourceBranch: string;
  targetBranch: string;
  sourceTipSha: string;
  targetTipSha: string;
  mergeBaseSha?: string;
  conflictPaths: string[];
  conflicts: PreviewMergeConflict[];
  filteredConflicts: PreviewMergeFilteredConflict[];
}

export interface MergeSourceResult {
  ref: string;
  /** @deprecated Use ref instead. */
  branch: string;
  ephemeral: boolean;
  sha: string;
}

export interface MergeTargetResult {
  branch: string;
  ephemeral: boolean;
  oldSha: string;
  newSha: string;
}

export interface MergeResult {
  result: MergeResultLabel;
  commitSha: string;
  treeSha: string;
  source: MergeSourceResult;
  target: MergeTargetResult;
  mergeBaseSha?: string;
  promotedCommits: number;
}

export interface RestoreCommitOptions
  extends GitStorageInvocationOptions, PolicyOptions {
  targetBranch: string;
  baseRef?: string;
  /** @deprecated Use baseRef instead. */
  targetCommitSha?: string;
  commitMessage?: string;
  expectedTargetSha?: string;
  /** @deprecated Use expectedTargetSha instead. */
  expectedHeadSha?: string;
  author: CommitSignature;
  committer?: CommitSignature;
}

export interface RestoreCommitResult {
  commitSha: string;
  treeSha: string;
  targetBranch: string;
  packBytes: number;
  refUpdate: RefUpdate;
}

// Webhook types
export interface WebhookValidationOptions {
  /**
   * Maximum age of webhook in seconds (default: 300 seconds / 5 minutes)
   * Set to 0 to disable timestamp validation
   */
  maxAgeSeconds?: number;
}

export interface WebhookValidationResult {
  /**
   * Whether the webhook signature and timestamp are valid
   */
  valid: boolean;
  /**
   * Error message if validation failed
   */
  error?: string;
  /**
   * The parsed webhook event type (e.g., "push")
   */
  eventType?: string;
  /**
   * The timestamp from the signature (Unix seconds)
   */
  timestamp?: number;
}

// Webhook event payloads
export interface RawWebhookPushEvent {
  repository: {
    id: string;
    url: string;
  };
  ref: string;
  before: string;
  after: string;
  customer_id: string;
  pushed_at: string; // RFC3339 timestamp
}

export interface WebhookPushEvent {
  type: "push";
  repository: {
    id: string;
    url: string;
  };
  ref: string;
  before: string;
  after: string;
  customerId: string;
  pushedAt: Date;
  rawPushedAt: string;
}

export interface WebhookUnknownEvent {
  type: string;
  raw: unknown;
}

export type WebhookEventPayload = WebhookPushEvent | WebhookUnknownEvent;

export interface ParsedWebhookSignature {
  timestamp: string;
  signature: string;
}
