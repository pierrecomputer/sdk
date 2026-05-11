# @pierre/storage

Pierre Git Storage SDK for TypeScript/JavaScript applications.

## End-to-End Smoke Test

- `node packages/git-storage-sdk/tests/full-workflow.js -e production -s pierre -k /home/ian/pierre-prod-key.pem`  
  Drives
  the Pierre workflow via the SDK: creates a repository, writes commits, fetches
  branch and diff data, and confirms storage APIs. Swap in your own private key
  path when running outside this workstation and adjust `-e`/`-s` for
  non-production environments.

## Installation

```bash
npm install @pierre/storage
```

## Usage

### Basic Setup

```typescript
import { GitStorage } from '@pierre/storage';

// Initialize the client with your name and key
const store = new GitStorage({
  name: 'your-name', // e.g., 'v0'
  key: 'your-key', // Your API key
});
```

### Creating a Repository

```typescript
// Create a new repository with auto-generated ID
const repo = await store.createRepo();
console.log(repo.id); // e.g., '123e4567-e89b-12d3-a456-426614174000'

// Create a repository with custom ID
const customRepo = await store.createRepo({ id: 'my-custom-repo' });
console.log(customRepo.id); // 'my-custom-repo'

// Create a repository by forking an existing repo
const forkedRepo = await store.createRepo({
  id: 'my-fork', // optional
  baseRepo: {
    id: 'my-template-id',
    ref: 'main', // optional
  },
});
// If defaultBranch is omitted, the SDK returns "main".

// Create a repo synced to a public GitHub repository without app auth
const publicSyncRepo = await store.createRepo({
  baseRepo: {
    owner: 'octocat',
    name: 'Hello-World',
    auth: { authType: 'public' },
  },
});
```

### Finding a Repository

```typescript
const foundRepo = await store.findOne({ id: 'repo-id' });
if (foundRepo) {
  const url = await foundRepo.getRemoteURL();
  console.log(`Repository URL: ${url}`);
}
```

### Hydrating a Repository Without a Request

If you already know the repo metadata, you can construct a `Repo` directly:

```typescript
const repo = store.repo({
  id: 'repo-id',
  defaultBranch: 'main',
  createdAt: '2024-06-15T12:00:00Z',
});

// No HTTP request is made by repo()
const url = await repo.getRemoteURL();
console.log(url);
```

### Grep

```typescript
const result = await foundRepo.grep({
  ref: 'main',
  query: { pattern: 'TODO', caseSensitive: true },
  paths: ['src/'],
});
console.log(result.matches);
```

### Getting Remote URLs

The SDK generates secure URLs with JWT authentication for Git operations:

```typescript
// Get URL with default permissions (git:write, git:read) and 1-year TTL
const url = await repo.getRemoteURL();
// Returns: https://t:JWT@your-name.code.storage/repo-id.git

// Configure the Git remote
console.log(`Run: git remote add origin ${url}`);

// Get URL with custom permissions and TTL
const readOnlyUrl = await repo.getRemoteURL({
  permissions: ['git:read'], // Read-only access
  ttl: 3600, // 1 hour in seconds
});

// Available permissions:
// - 'git:read'   - Read access to Git repository
// - 'git:write'  - Write access to Git repository
// - 'repo:write' - Create a repository
```

#### Ephemeral Branches

For working with ephemeral branches (temporary branches isolated from the main
repository), use `getEphemeralRemoteURL()`:

```typescript
// Get ephemeral namespace remote URL
const ephemeralUrl = await repo.getEphemeralRemoteURL();
// Returns: https://t:JWT@your-name.code.storage/repo-id+ephemeral.git

// Configure separate remotes for default and ephemeral branches
console.log(`Run: git remote add origin ${await repo.getRemoteURL()}`);
console.log(
  `Run: git remote add ephemeral ${await repo.getEphemeralRemoteURL()}`
);

// Push ephemeral branch
// git push ephemeral feature-branch

// The ephemeral remote supports all the same options and permission as regular remotes
```

#### Import Remote

For write-only history imports, use `getImportRemoteURL()`:

```typescript
// Get import remote URL
const importUrl = await repo.getImportRemoteURL();
// Returns: https://t:JWT@your-name.code.storage/repo-id+import.git

console.log(`Run: git remote add import ${importUrl}`);

// Push imported history through the import remote
// git push import main

// Reads are disabled on +import remotes; use the repository remote for clone/fetch
```

### Working with Repository Content

Once you have a repository instance, you can perform various Git operations:

```typescript
const repo = await store.createRepo();
// or
const repo = await store.findOne({ id: 'existing-repo-id' });

// List repositories for the org
const repos = await store.listRepos({ limit: 20 });
console.log(repos.repos);

// Get file content (streaming)
const resp = await repo.getFileStream({
  path: 'README.md',
  ref: 'main', // optional, defaults to default branch
});
const text = await resp.text();
console.log(text);

// Download repository archive (streaming tar.gz)
const archiveResp = await repo.getArchiveStream({
  ref: 'main',
  includeGlobs: ['README.md'],
  excludeGlobs: ['vendor/**'],
  maxBlobSize: 1024 * 1024, // optional max file size in bytes
  archivePrefix: 'repo/',
});
const archiveBytes = new Uint8Array(await archiveResp.arrayBuffer());
console.log(archiveBytes.length);

// List all files in the repository
const files = await repo.listFiles({
  ref: 'main', // optional, defaults to default branch
});
console.log(files.paths); // Array of file paths

// List files with mode/size and last commit metadata
const metadata = await repo.listFilesWithMetadata({
  ref: 'main',
});
console.log(metadata.files[0].lastCommitSha);
console.log(metadata.commits[metadata.files[0].lastCommitSha].author);

// List branches
const branches = await repo.listBranches({
  limit: 10,
  cursor: undefined, // for pagination
});
console.log(branches.branches);

// List tags
const tags = await repo.listTags({
  limit: 10,
  cursor: undefined, // for pagination
});
console.log(tags.tags);

// Create a lightweight tag at a commit SHA
const createdTag = await repo.createTag({
  name: 'v1.0.0',
  target: '0123456789abcdef0123456789abcdef01234567',
});
console.log(createdTag.message);

// Delete a tag
const deletedTag = await repo.deleteTag({ name: 'v1.0.0' });
console.log(deletedTag.message);

// List commits
const commits = await repo.listCommits({
  branch: 'main', // optional
  limit: 20,
  cursor: undefined, // for pagination
});
console.log(commits.commits);

// Get a single commit's metadata (no diff)
const { commit } = await repo.getCommit({ sha: 'abc123...' });
console.log(commit.message, commit.authorName);

// Blame a file (per-line authorship). The top-level `commitSha` is the SHA the
// `ref` resolved to; each entry in `lines` carries its own author/committer
// metadata inline.
const blame = await repo.getBlame({
  path: 'src/main.go',
  ref: 'main',
  ranges: ['10,30'],
  detectMoves: true,
});
for (const line of blame.lines) {
  console.log(`${line.lineNumber} (${line.commitSha.slice(0, 7)}): ${line.authorName} — ${line.summary}`);
}

// Read a git note for a commit
const note = await repo.getNote({ sha: 'abc123...' });
console.log(note.note);

// Add a git note
const noteResult = await repo.createNote({
  sha: 'abc123...',
  note: 'Release QA approved',
  author: { name: 'Release Bot', email: 'release@example.com' },
});
console.log(noteResult.newRefSha);

// Append to an existing git note
await repo.appendNote({
  sha: 'abc123...',
  note: 'Follow-up review complete',
});

// Delete a git note
await repo.deleteNote({ sha: 'abc123...' });

// Get branch diff
const branchDiff = await repo.getBranchDiff({
  branch: 'feature-branch',
  base: 'main', // optional, defaults to main
});
console.log(branchDiff.stats);
console.log(branchDiff.files);

// Get commit diff
const commitDiff = await repo.getCommitDiff({
  sha: 'abc123...',
});
console.log(commitDiff.stats);
console.log(commitDiff.files);

// Create a new branch from an existing ref
const branch = await repo.createBranch({
  baseRef: 'refs/heads/main',
  targetBranch: 'feature/demo',
  // baseIsEphemeral: true,
  // targetIsEphemeral: true,
});
console.log(branch.targetBranch, branch.commitSha);

// Delete a branch (default branch deletion is rejected)
const deletedBranch = await repo.deleteBranch({ name: 'feature/demo' });
console.log(deletedBranch.message);

// `baseBranch` is still accepted for backwards compatibility, but deprecated.
// Prefer `baseRef` for new code.


// Merge one branch into another. Source and target can independently be
// ephemeral branches.
const mergeResult = await repo.merge({
  sourceBranch: 'feature/demo',
  sourceIsEphemeral: true,
  targetBranch: 'main',
  targetIsEphemeral: false,
  expectedTargetSha: '0123456789abcdef0123456789abcdef01234567', // optional guard
  strategy: 'merge', // 'merge' | 'ff_only' | 'ff_prefer'
  commitMessage: 'Merge feature/demo', // optional
  author: { name: 'Merge Bot', email: 'merge@example.com' }, // optional
  committer: { name: 'Merge Bot', email: 'merge@example.com' }, // optional
  allowUnrelatedHistories: false, // optional
});
console.log(mergeResult.result); // 'merge_commit', 'fast_forward', 'no_op', or 'unknown'
console.log(mergeResult.commitSha, mergeResult.target.newSha);

// repo.merge() requires sourceBranch, targetBranch, and strategy. It returns
// camelCase metadata for the source tip, target update, merge base (when
// reported), and number of promoted commits. A backend conflict response
// (HTTP 409) is surfaced as an API error with the response body preserved for
// callers that need conflict_paths or merge_base_sha.

// Create a commit using the streaming helper
const fs = await import('node:fs/promises');
const result = await repo
  .createCommit({
    targetBranch: 'main',
    commitMessage: 'Update docs',
    author: { name: 'Docs Bot', email: 'docs@example.com' },
  })
  .addFileFromString('docs/changelog.md', '# v2.0.2\n- add streaming SDK\n')
  .addFile('docs/readme.md', await fs.readFile('README.md'))
  .deletePath('docs/legacy.txt')
  .send();

console.log(result.commitSha);
console.log(result.refUpdate.newSha);
console.log(result.refUpdate.oldSha); // All zeroes when the ref is created
```

The builder exposes:

- `addFile(path, source, options)` to attach bytes from strings, typed arrays,
  ArrayBuffers, `Blob` or `File` objects, `ReadableStream`s, or
  iterable/async-iterable sources.
- `addFileFromString(path, contents, options)` for text helpers (defaults to
  UTF-8 and accepts any Node.js `BufferEncoding`).
- `deletePath(path)` to remove files or folders.
- `send()` to finalize the commit and receive metadata about the new commit.

`send()` resolves to an object with the new commit metadata plus the ref update:

```ts
type CommitResult = {
  commitSha: string;
  treeSha: string;
  targetBranch: string;
  packBytes: number;
  blobCount: number;
  refUpdate: {
    branch: string;
    oldSha: string; // All zeroes when the ref is created
    newSha: string;
  };
};
```

If the backend reports a failure (for example, the branch advanced past
`expectedHeadSha`) the builder throws a `RefUpdateError` containing the status,
reason, and ref details.

**Options**

- `targetBranch` (required): Branch name (for example `main`) that will receive
  the commit.
- `expectedHeadSha` (optional): Commit SHA that must match the remote tip; omit
  to fast-forward unconditionally.
- `baseBranch` (optional): Mirrors the `base_branch` metadata and names an
  existing branch whose tip should seed `targetBranch` if it does not exist.
  Leave `expectedHeadSha` empty when creating a new branch from `baseBranch`;
  when both are provided and the branch already exists, `expectedHeadSha`
  continues to enforce the fast-forward guard.
- `commitMessage` (required): The commit message.
- `author` (required): Include `name` and `email` for the commit author.
- `committer` (optional): Include `name` and `email`. If omitted, the author
  identity is reused.
- `signal` (optional): Abort an in-flight upload with `AbortController`.
- `targetRef` (deprecated, optional): Fully qualified ref (for example
  `refs/heads/main`). Prefer `targetBranch`, which now accepts plain branch
  names.

> Files are chunked into 4 MiB segments under the hood, so you can stream large
> assets without buffering them entirely in memory. File paths are normalized
> relative to the repository root.

> The `targetBranch` must already exist on the remote repository unless you
> provide `baseBranch` (or the repository has no refs). To seed an empty
> repository, point to the default branch and omit `expectedHeadSha`. To create
> a missing branch within an existing repository, set `baseBranch` to the source
> branch and omit `expectedHeadSha` so the service clones that tip before
> applying your changes.

### Apply a pre-generated diff

If you already have a patch (for example, the output of `git diff --binary`) you
can stream it to the gateway with a single call. The SDK handles chunking and
NDJSON streaming just like it does for regular commits:

```ts
const fs = await import('node:fs/promises');

const patch = await fs.readFile('build/generated.patch', 'utf8');

const diffResult = await repo.createCommitFromDiff({
  targetBranch: 'feature/apply-diff',
  expectedHeadSha: 'abc123def4567890abc123def4567890abc12345',
  commitMessage: 'Apply generated API changes',
  author: { name: 'Diff Bot', email: 'diff@example.com' },
  diff: patch,
});

console.log(diffResult.commitSha);
console.log(diffResult.refUpdate.newSha);
```

The `diff` field accepts a `string`, `Uint8Array`, `ArrayBuffer`, `Blob`,
`File`, `ReadableStream`, iterable, or async iterable of byte chunks—the same
sources supported by the standard commit builder. `createCommitFromDiff` returns
a `Promise<CommitResult>` and throws a `RefUpdateError` when the server rejects
the diff (for example, if the branch tip changed).

### Streaming Large Files

The commit builder accepts any async iterable of bytes, so you can stream large
assets without buffering:

```typescript
import { createReadStream } from 'node:fs';

await repo
  .createCommit({
    targetBranch: 'assets',
    expectedHeadSha: 'abc123def4567890abc123def4567890abc12345',
    commitMessage: 'Upload latest design bundle',
    author: { name: 'Assets Uploader', email: 'assets@example.com' },
  })
  .addFile('assets/design-kit.zip', createReadStream('/tmp/design-kit.zip'))
  .send();
```

## API Reference

### GitStorage

```typescript
class GitStorage {
  constructor(options: GitStorageOptions);
  async createRepo(options?: CreateRepoOptions): Promise<Repo>;
  async findOne(options: FindOneOptions): Promise<Repo | null>;
  repo(options: RepoOptions): Repo;
  getConfig(): GitStorageOptions;
}
```

### Interfaces

```typescript
interface GitStorageOptions {
  name: string; // Your identifier
  key: string; // Your API key
  defaultTTL?: number; // Default TTL for generated JWTs (seconds)
}

interface CreateRepoOptions {
  id?: string; // Optional custom repository ID
  baseRepo?:
    | {
        id: string; // Fork source repo ID
        ref?: string; // Optional ref to fork from
        sha?: string; // Optional commit SHA to fork from
      }
    | {
        owner: string; // GitHub owner
        name: string; // GitHub repository name
        defaultBranch?: string;
        provider?: 'github';
        auth?: {
          authType: 'public'; // Force public GitHub mode (no app install)
        };
      };
  defaultBranch?: string; // Optional default branch name (defaults to "main")
}

interface FindOneOptions {
  id: string; // Repository ID to find
}

interface RepoOptions {
  id: string; // Repository ID
  defaultBranch?: string; // Defaults to "main"
  createdAt?: string; // Defaults to ""
}

interface Repo {
  id: string;
  getRemoteURL(options?: GetRemoteURLOptions): Promise<string>;
  getEphemeralRemoteURL(options?: GetRemoteURLOptions): Promise<string>;

  getFileStream(options: GetFileOptions): Promise<Response>;
  getArchiveStream(options?: ArchiveOptions): Promise<Response>;
  listFiles(options?: ListFilesOptions): Promise<ListFilesResult>;
  listFilesWithMetadata(
    options?: ListFilesWithMetadataOptions
  ): Promise<ListFilesWithMetadataResult>;
  listBranches(options?: ListBranchesOptions): Promise<ListBranchesResult>;
  listCommits(options?: ListCommitsOptions): Promise<ListCommitsResult>;
  getCommit(options: GetCommitOptions): Promise<GetCommitResult>;
  getBlame(options: BlameOptions): Promise<BlameResult>;
  getNote(options: GetNoteOptions): Promise<GetNoteResult>;
  createNote(options: CreateNoteOptions): Promise<NoteWriteResult>;
  appendNote(options: AppendNoteOptions): Promise<NoteWriteResult>;
  deleteNote(options: DeleteNoteOptions): Promise<NoteWriteResult>;
  getBranchDiff(options: GetBranchDiffOptions): Promise<GetBranchDiffResult>;
  getCommitDiff(options: GetCommitDiffOptions): Promise<GetCommitDiffResult>;
}

interface GetRemoteURLOptions {
  permissions?: ('git:write' | 'git:read' | 'repo:write')[];
  ttl?: number; // Time to live in seconds (default: 31536000 = 1 year)
}

// Git operation interfaces
interface GetFileOptions {
  path: string;
  ref?: string; // Branch, tag, or commit SHA
  ttl?: number;
}

// getFileStream() returns a standard Fetch Response for streaming bytes

interface ArchiveOptions {
  ref?: string; // Branch, tag, or commit SHA (defaults to default branch)
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxBlobSize?: number; // Optional max file size in bytes
  archivePrefix?: string;
  ttl?: number;
}

// getArchiveStream() returns a standard Fetch Response for streaming tar.gz bytes

interface ListFilesOptions {
  ref?: string; // Branch, tag, or commit SHA
  ephemeral?: boolean; // Resolve ref in ephemeral namespace
  ttl?: number;
}

interface ListFilesResponse {
  paths: string[]; // Array of file paths
  ref: string; // The resolved reference
}

interface ListFilesResult {
  paths: string[];
  ref: string;
}

interface ListFilesWithMetadataOptions {
  ref?: string; // Branch, tag, or commit SHA
  ephemeral?: boolean; // Resolve ref in ephemeral namespace
  ttl?: number;
}

interface FileWithMetadata {
  path: string;
  mode: string;
  size: number;
  lastCommitSha: string;
}

interface CommitMetadata {
  author: string;
  date: Date;
  rawDate: string;
  message: string;
}

interface ListFilesWithMetadataResult {
  files: FileWithMetadata[];
  commits: Record<string, CommitMetadata>;
  ref: string;
}

interface GetNoteOptions {
  sha: string; // Commit SHA to look up notes for
  ttl?: number;
}

interface GetNoteResult {
  sha: string;
  note: string;
  refSha: string;
}

interface CreateNoteOptions {
  sha: string;
  note: string;
  expectedRefSha?: string;
  author?: { name: string; email: string };
  ttl?: number;
}

interface AppendNoteOptions {
  sha: string;
  note: string;
  expectedRefSha?: string;
  author?: { name: string; email: string };
  ttl?: number;
}

interface DeleteNoteOptions {
  sha: string;
  expectedRefSha?: string;
  author?: { name: string; email: string };
  ttl?: number;
}

interface NoteWriteResult {
  sha: string;
  targetRef: string;
  baseCommit?: string;
  newRefSha: string;
  result: {
    success: boolean;
    status: string;
    message?: string;
  };
}

interface ListBranchesOptions {
  cursor?: string;
  limit?: number;
  ttl?: number;
}

interface ListBranchesResponse {
  branches: BranchInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

interface ListBranchesResult {
  branches: BranchInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

interface BranchInfo {
  cursor: string;
  name: string;
  headSha: string;
  createdAt: string;
}

interface ListCommitsOptions {
  branch?: string;
  cursor?: string;
  limit?: number;
  ttl?: number;
}

interface ListCommitsResponse {
  commits: CommitInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

interface ListCommitsResult {
  commits: CommitInfo[];
  nextCursor?: string;
  hasMore: boolean;
}

interface CommitInfo {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  date: Date;
  rawDate: string;
}

interface GetCommitOptions {
  sha: string;
  ttl?: number;
}

interface GetCommitResult {
  commit: CommitInfo;
}

interface BlameOptions {
  path: string;
  ref?: string;
  ephemeral?: boolean;
  ranges?: string[];
  detectMoves?: boolean;
  ttl?: number;
}

interface BlameLine {
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

interface BlameResult {
  ref: string;       // The ref passed in (or default branch resolved)
  path: string;
  commitSha: string; // SHA the input ref resolved to at request time
  lines: BlameLine[];
}

interface GetBranchDiffOptions {
  branch: string;
  base?: string; // Defaults to 'main'
  ttl?: number;
  ephemeral?: boolean;
  ephemeralBase?: boolean;
}

interface GetCommitDiffOptions {
  sha: string;
  ttl?: number;
}

interface GetBranchDiffResponse {
  branch: string;
  base: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}

interface GetBranchDiffResult {
  branch: string;
  base: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}

interface GetCommitDiffResponse {
  sha: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}

interface GetCommitDiffResult {
  sha: string;
  stats: DiffStats;
  files: FileDiff[];
  filteredFiles: FilteredFile[];
}
interface DiffStats {
  files: number;
  additions: number;
  deletions: number;
  changes: number;
}

type DiffFileState =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'type_changed'
  | 'unmerged'
  | 'unknown';

interface DiffFileBase {
  path: string;
  state: DiffFileState;
  rawState: string;
  oldPath?: string;
  bytes: number;
  isEof: boolean;
}

interface FileDiff {
  path: string;
  state: DiffFileState;
  rawState: string;
  oldPath?: string;
  bytes: number;
  isEof: boolean;
  raw: string;
  additions: number;
  deletions: number;
}

interface FilteredFile {
  path: string;
  state: DiffFileState;
  rawState: string;
  oldPath?: string;
  bytes: number;
  isEof: boolean;
}

interface RefUpdate {
  branch: string;
  oldSha: string;
  newSha: string;
}

interface CommitResult {
  commitSha: string;
  treeSha: string;
  targetBranch: string;
  packBytes: number;
  blobCount: number;
  refUpdate: RefUpdate;
}

interface RestoreCommitOptions {
  targetBranch: string;
  targetCommitSha: string;
  commitMessage?: string;
  expectedHeadSha?: string;
  author: CommitSignature;
  committer?: CommitSignature;
}

interface RestoreCommitResult {
  commitSha: string;
  treeSha: string;
  targetBranch: string;
  packBytes: number;
  refUpdate: {
    branch: string;
    oldSha: string;
    newSha: string;
  };
}
```

## Authentication

The SDK uses JWT (JSON Web Tokens) for authentication. When you call
`getRemoteURL()`, it:

1. Creates a JWT with your name, repository ID, and requested permissions
2. Signs it with your key
3. Embeds it in the Git remote URL as the password

The generated URLs are compatible with standard Git clients and include all
necessary authentication.

## Error Handling

The SDK validates inputs and provides helpful error messages:

```typescript
try {
  const store = new GitStorage({ name: '', key: 'key' });
} catch (error) {
  // Error: GitStorage name must be a non-empty string.
}

try {
  const store = new GitStorage({ name: 'v0', key: '' });
} catch (error) {
  // Error: GitStorage key must be a non-empty string.
}
-
```

- Mutating operations (commit builder, `restoreCommit`) throw `RefUpdateError`
  when the backend reports a ref failure. Inspect `error.status`,
  `error.reason`, `error.message`, and `error.refUpdate` for details.

## License

MIT
