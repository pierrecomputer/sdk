# pierre-storage

Pierre Git Storage SDK for Python applications.

## Installation

```bash
# Using uv (recommended)
uv add pierre-storage

# Or using pip
pip install pierre-storage
```

## Usage

### Basic Setup

```python
from pierre_storage import GitStorage

# Initialize the client with your name and key
storage = GitStorage({
    "name": "your-name",  # e.g., 'v0'
    "key": "your-key",  # Your API key in PEM format
})
```

### Creating a Repository

```python
# Create a new repository with auto-generated ID
repo = await storage.create_repo()
print(repo.id)  # e.g., '123e4567-e89b-12d3-a456-426614174000'

# Create a repository with custom ID
custom_repo = await storage.create_repo(id="my-custom-repo")
print(custom_repo.id)  # 'my-custom-repo'

# Create a repository with GitHub sync
github_repo = await storage.create_repo(
    id="my-synced-repo",
    base_repo={
        "owner": "octocat",
        "name": "Hello-World",
        "default_branch": "main",  # optional
        # Optional: force unauthenticated GitHub mode
        # "auth": {"auth_type": "public"},
    }
)
# This repository will sync with github.com/octocat/Hello-World

# Create a repository by forking an existing repo
forked_repo = await storage.create_repo(
    id="my-fork",
    base_repo={
        "id": "my-template-id",
        "ref": "main",  # optional
    },
)
```

### Finding a Repository

```python
found_repo = await storage.find_one(id="repo-id")
if found_repo:
    url = await found_repo.get_remote_url()
    print(f"Repository URL: {url}")
```

### Hydrating a Repository Without a Request

If you already know the repo metadata, you can construct a `Repo` directly:

```python
repo = storage.repo(
    id="repo-id",
    default_branch="main",
    created_at="2024-06-15T12:00:00Z",
)

# No HTTP request is made by repo()
url = await repo.get_remote_url()
print(url)
```

### Grep

```python
result = await repo.grep(
    pattern="TODO",
    ref="main",
    paths=["src/"],
    case_sensitive=True,
)
print(result["matches"])
```

### Getting Remote URLs

The SDK generates secure URLs with JWT authentication for Git operations:

```python
# Get URL with default permissions (git:write, git:read) and 1-year TTL
url = await repo.get_remote_url()
# Returns: https://t:JWT@your-name.code.storage/repo-id.git

# Configure the Git remote
print(f"Run: git remote add origin {url}")

# Get URL with custom permissions and TTL
read_only_url = await repo.get_remote_url(
    permissions=["git:read"],  # Read-only access
    ttl=3600,  # 1 hour in seconds
)

# Get ephemeral remote URL (points to ephemeral namespace)
ephemeral_url = await repo.get_ephemeral_remote_url()
# Returns: https://t:JWT@your-name.code.storage/repo-id+ephemeral.git

# Get import remote URL (points to import namespace)
import_url = await repo.get_import_remote_url()
# Returns: https://t:JWT@your-name.code.storage/repo-id+import.git

# Get ephemeral URL with custom permissions and TTL
ephemeral_url = await repo.get_ephemeral_remote_url(
    permissions=["git:write", "git:read"],
    ttl=3600,
)

# Get import URL with custom permissions and TTL
import_url = await repo.get_import_remote_url(
    permissions=["git:write", "git:read"],
    ttl=3600,
)

# Available permissions:
# - 'git:read'   - Read access to Git repository
# - 'git:write'  - Write access to Git repository
# - 'repo:write' - Create a repository
```

### Working with Repository Content

Once you have a repository instance, you can perform various Git operations:

```python
repo = await storage.create_repo()
# or
repo = await storage.find_one(id="existing-repo-id")

# List repositories for the org
repos = await storage.list_repos(limit=20)
print(repos["repos"])

# Get file content (streaming)
response = await repo.get_file_stream(
    path="README.md",
    ref="main",  # optional, defaults to default branch
    ephemeral=False,  # optional, set to True to read from ephemeral namespace
    ephemeral_base=False,  # optional, resolve base under ephemeral namespace
)
text = await response.aread()
print(text.decode())

# Fetch metadata or validate cached/ranged content without a body
metadata = await repo.head_file(
    path="README.md",
    ref="main",
    ephemeral_base=False,
    headers={
        "if_none_match": '"b10b5ha"',
        "range": "bytes=0-1023",
    },
)
print(metadata["status_code"], metadata.get("etag"), metadata.get("content_range"))

# Download repository archive (streaming tar.gz)
archive_response = await repo.get_archive_stream(
    ref="main",
    include_globs=["README.md"],
    exclude_globs=["vendor/**"],
    max_blob_size=1024 * 1024,  # optional max file size in bytes
    archive_prefix="repo/",
)
archive_bytes = await archive_response.aread()
print(len(archive_bytes))

# List all files in the repository
files = await repo.list_files(
    ref="main",  # optional, defaults to default branch
    ephemeral=False,  # optional, set to True to list files from ephemeral namespace
)
print(files["paths"])  # List of file paths

# List files with mode/size and last-commit metadata
metadata = await repo.list_files_with_metadata(
    ref="main",
    ephemeral=False,
)
print(metadata["files"][0]["last_commit_sha"])
print(metadata["commits"][metadata["files"][0]["last_commit_sha"]]["author"])

# List branches
branches = await repo.list_branches(
    limit=10,
    cursor=None,  # for pagination
)
print(branches["branches"])

# Create or promote a branch (synchronous Temporal workflow)
branch_result = await repo.create_branch(
    base_ref="main",
    target_branch="feature/preview",
    base_is_ephemeral=False,   # set True when the base lives in the ephemeral namespace
    target_is_ephemeral=True,  # set True to create an ephemeral branch
    ttl=900,                   # optional JWT TTL in seconds
)
print(branch_result["target_branch"], branch_result.get("commit_sha"))

# Delete a branch (default branch deletion is rejected)
delete_branch_result = await repo.delete_branch(name="feature/old-onboarding")
print(delete_branch_result["message"])

# Pass ephemeral=True to delete a branch from the ephemeral namespace
ephemeral_delete = await repo.delete_branch(
    name="merge/123e4567-e89b-12d3-a456-426614174000",
    ephemeral=True,
)
print(ephemeral_delete["ephemeral"])  # True

# Merge one branch into another
merge_result = await repo.merge(
    source_branch="feature/preview",
    source_is_ephemeral=True,   # optional; source branch can live in ephemeral namespace
    target_branch="main",
    target_is_ephemeral=False,  # optional; target branch can independently be ephemeral
    strategy="merge",           # one of: "merge", "ff_only", "ff_prefer"
    expected_target_sha="abc123",  # optional optimistic concurrency check
    commit_message="Merge feature/preview",  # optional
    author={"name": "Bot", "email": "bot@example.com"},  # optional
    committer={"name": "Bot", "email": "bot@example.com"},  # optional
    allow_unrelated_histories=False,  # optional
    ttl=900,  # optional JWT TTL in seconds
)
print(merge_result["result"], merge_result["commit_sha"])
print(merge_result["source"]["sha"], merge_result["target"]["new_sha"])

# List tags
tags = await repo.list_tags(limit=10)
print(tags["tags"])

# Create a lightweight tag at a commit SHA
tag_result = await repo.create_tag(
    name="v1.0.0",
    target="0123456789abcdef0123456789abcdef01234567",
)
print(tag_result["message"])

# Delete a tag
delete_result = await repo.delete_tag(name="v1.0.0")
print(delete_result["message"])

# List commits
commits = await repo.list_commits(
    branch="main",  # optional
    limit=20,
    cursor=None,  # for pagination
)
print(commits["commits"])

# Get a single commit's metadata (no diff)
result = await repo.get_commit(sha="abc123...")
print(result["commit"]["message"], result["commit"]["author_name"])
# Signed commits also include the armored signature plus the exact signed
# payload (raw commit object minus the gpgsig header) so you can verify it
# yourself. Both keys are absent for unsigned commits.
if "signature" in result["commit"]:
    print(result["commit"]["signature"], result["commit"]["payload"])

# Blame a file (per-line authorship). The top-level "commit_sha" is the SHA the
# `ref` resolved to; each entry in "lines" carries its own author/committer
# metadata inline.
blame = await repo.get_blame(
    path="src/main.go",
    ref="main",
    ranges=["10,30"],
    detect_moves=True,
)
for line in blame["lines"]:
    print(f"{line['line_number']} ({line['commit_sha'][:7]}): {line['author_name']} — {line['summary']}")

# Read a git note for a commit
note = await repo.get_note(sha="abc123...")
print(note["note"])

# Add a git note
note_result = await repo.create_note(
    sha="abc123...",
    note="Release QA approved",
    author={"name": "Release Bot", "email": "release@example.com"},
)
print(note_result["new_ref_sha"])

# Append to a git note
await repo.append_note(
    sha="abc123...",
    note="Follow-up review complete",
)

# Delete a git note
await repo.delete_note(sha="abc123...")

# Get branch diff
branch_diff = await repo.get_branch_diff(
    branch="feature-branch",
    base="main",  # optional, defaults to main
    ephemeral=False,  # optional, resolve branch under ephemeral namespace
    ephemeral_base=False,  # optional, resolve base under ephemeral namespace
)
print(branch_diff["stats"])
print(branch_diff["files"])

# Get commit diff
commit_diff = await repo.get_commit_diff(
    sha="abc123...",
)
print(commit_diff["stats"])
print(commit_diff["files"])
```

### Creating Commits

The SDK provides a fluent builder API for creating commits with streaming
support:

```python
# Create a commit
result = await (
    repo.create_commit(
        target_branch="main",
        commit_message="Update docs",
        author={"name": "Docs Bot", "email": "docs@example.com"},
    )
    .add_file_from_string("docs/changelog.md", "# v2.0.2\n- add streaming SDK\n")
    .add_file("docs/readme.md", b"Binary content here")
    .delete_path("docs/legacy.txt")
    .send()
)

print(result["commit_sha"])
print(result["ref_update"]["new_sha"])
print(result["ref_update"]["old_sha"])  # All zeroes when ref is created
```

The builder exposes:

- `add_file(path, source, *, mode=None)` - Attach bytes from various sources
- `add_file_from_string(path, contents, encoding="utf-8", *, mode=None)` - Add
  text files (defaults to UTF-8)
- `delete_path(path)` - Remove files or folders
- `send()` - Finalize the commit and receive metadata

`send()` returns a result with:

```python
{
    "commit_sha": str,
    "tree_sha": str,
    "target_branch": str,
    "pack_bytes": int,
    "blob_count": int,
    "ref_update": {
        "branch": str,
        "old_sha": str,  # All zeroes when the ref is created
        "new_sha": str,
    }
}
```

If the backend reports a failure, the builder raises a `RefUpdateError`
containing the status, reason, and ref details.

**Options:**

- `target_branch` (required): Branch name (without `refs/heads/` prefix)
- `expected_head_sha` (optional): Branch or commit that must match the remote
  tip
- `base_branch` (optional): Name of the branch to use as the base when creating
  a new branch (without `refs/heads/` prefix)
- `ephemeral` (optional): Mark the target branch as ephemeral (stored in
  separate namespace)
- `ephemeral_base` (optional): Indicates the base branch is ephemeral (requires
  `base_branch`)
- `commit_message` (required): The commit message
- `author` (required): Dictionary with `name` and `email`
- `committer` (optional): Dictionary with `name` and `email` (defaults to
  author)

### Creating Commits from Diff Streams

When you already have a unified diff, you can let the SDK apply it directly
without building individual file operations:

```python
diff_text = """\
--- a/docs/README.md
+++ b/docs/README.md
@@
-Old line
+New line
"""

result = await repo.create_commit_from_diff(
    target_branch="main",
    commit_message="Apply docs update",
    diff=diff_text,
    author={"name": "Docs Bot", "email": "docs@example.com"},
    expected_head_sha="abc123...",  # optional optimistic lock
    base_branch="release",          # optional branch fallback
)

print(result["commit_sha"])
```

`diff` accepts the same source types as the commit builder (string, bytes, async
iterator, etc.). The helper automatically streams the diff to the `/diff-commit`
endpoint and returns a `CommitResult`. On conflicts or validation errors, it
raises `RefUpdateError` with the server-provided status and message.

You can provide the same metadata options as `create_commit`, including
`expected_head_sha`, `base_branch`, `ephemeral`, `ephemeral_base`, and
`committer`.

> Files are chunked into 4 MiB segments, allowing streaming of large assets
> without buffering in memory.

> The `target_branch` must already exist on the remote repository. To seed an
> empty repository, omit `expected_head_sha`; the service will create the first
> commit only when no refs are present.

**Branching Example:**

```python
# Create a new branch off of 'main'
result = await (
    repo.create_commit(
        target_branch="feature/new-feature",
        base_branch="main",  # Branch off from main
        commit_message="Start new feature",
        author={"name": "Developer", "email": "dev@example.com"},
    )
    .add_file_from_string("feature.py", "# New feature implementation\n")
    .send()
)
```

### Ephemeral Branches

Ephemeral branches are temporary branches that are stored in a separate
namespace. They're useful for preview environments, temporary workspaces, or
short-lived feature branches that don't need to be permanent.

**Creating an ephemeral branch:**

```python
# Create an ephemeral branch off of 'main'
result = await (
    repo.create_commit(
        target_branch="preview/pr-123",
        base_branch="main",
        ephemeral=True,  # Mark the target branch as ephemeral
        commit_message="Preview environment for PR 123",
        author={"name": "CI Bot", "email": "ci@example.com"},
    )
    .add_file_from_string("index.html", "<h1>Preview</h1>")
    .send()
)

# Access files from the ephemeral branch
response = await repo.get_file_stream(
    path="index.html",
    ref="preview/pr-123",
    ephemeral=True,  # Read from ephemeral namespace
)
content = await response.aread()

# List files in the ephemeral branch
files = await repo.list_files(
    ref="preview/pr-123",
    ephemeral=True,
)
print(files["paths"])
```

**Branching from an ephemeral base:**

```python
# Create an ephemeral branch off another ephemeral branch
result = await (
    repo.create_commit(
        target_branch="preview/pr-123-variant",
        base_branch="preview/pr-123",
        ephemeral=True,
        ephemeral_base=True,  # Indicates the base branch is also ephemeral
        commit_message="Variant of preview environment",
        author={"name": "CI Bot", "email": "ci@example.com"},
    )
    .add_file_from_string("variant.txt", "This is a variant\n")
    .send()
)
```

**Promoting an ephemeral branch:**

```python
# Promote an ephemeral branch to a persistent branch (keeping the same name)
result = await repo.promote_ephemeral_branch(base_branch="preview/pr-123")

# Or provide a new target name
result = await repo.promote_ephemeral_branch(
    base_branch="preview/pr-123",
    target_branch="feature/awesome-change",
)

print(result["target_branch"])  # "feature/awesome-change"
```

`promote_ephemeral_branch()` keeps its branch-oriented `base_branch` parameter.
Use `create_branch(base_ref=...)` for new code when you need to choose the base.

**Key points about ephemeral branches:**

- Ephemeral branches are stored separately from regular branches
- Use `ephemeral=True` when creating commits, reading files, or listing files
- Use `ephemeral_base=True` when branching off another ephemeral branch
  (requires `base_branch`)
- Promote an ephemeral branch with `repo.promote_ephemeral_branch()`; omit
  `target_branch` to keep the same name
- Ephemeral branches are ideal for temporary previews, CI/CD environments, or
  experiments

### Streaming Large Files

The commit builder accepts async iterables, allowing streaming of large files:

```python
async def file_chunks():
    """Generate file chunks asynchronously."""
    with open("/tmp/large-file.zip", "rb") as f:
        while chunk := f.read(1024 * 1024):  # Read 1MB at a time
            yield chunk

result = await (
    repo.create_commit(
        target_branch="assets",
        expected_head_sha="abc123...",
        commit_message="Upload latest design bundle",
        author={"name": "Assets Uploader", "email": "assets@example.com"},
    )
    .add_file("assets/design-kit.zip", file_chunks())
    .send()
)
```

### GitHub Repository Sync

You can create a Pierre repository that syncs with a GitHub repository:

```python
# Create a repository synced with GitHub
repo = await storage.create_repo(
    id="my-synced-repo",
    base_repo={
        "owner": "your-org",
        "name": "your-repo",
        "default_branch": "main",  # optional, defaults to "main"
        # Optional: force public GitHub mode
        # "auth": {"auth_type": "public"},
    }
)

# Pull latest changes from GitHub upstream
await repo.pull_upstream()

# Now you can work with the synced content
files = await repo.list_files()
commits = await repo.list_commits()
```

**How it works:**

1. When you create a repo with `base_repo`, Pierre links it to the specified
   GitHub repository
2. The `pull_upstream()` method fetches the latest changes from GitHub
3. You can then use all Pierre SDK features (diffs, commits, file access) on the
   synced content
4. The provider is automatically set to `"github"` when using `base_repo`
5. Set `base_repo.auth.auth_type="public"` to force unauthenticated GitHub mode

### Forking Repositories

You can fork an existing repository within the same Pierre org:

```python
forked_repo = await storage.create_repo(
    id="my-fork",
    base_repo={
        "id": "my-template-id",
        "ref": "main",  # optional (branch/tag)
        # "sha": "abc123..."  # optional commit SHA (overrides ref)
    },
)
```

When `default_branch` is omitted, the SDK returns `"main"`.

### Restoring Commits

You can restore a repository to a previous commit:

```python
result = await repo.restore_commit(
    target_branch="main",
    target_commit_sha="abc123...",  # Commit to restore to
    expected_head_sha="def456...",  # Optional: current HEAD for safety
    commit_message="Restore to stable version",
    author={"name": "DevOps", "email": "devops@example.com"},
)

print(result["commit_sha"])
print(result["ref_update"])
```

## API Reference

### GitStorage

```python
class GitStorage:
    def __init__(self, options: GitStorageOptions) -> None: ...
    async def create_repo(
        self,
        *,
        id: Optional[str] = None,
        default_branch: Optional[str] = None,  # defaults to "main"
        base_repo: Optional[BaseRepo] = None,
        ttl: Optional[int] = None,
    ) -> Repo: ...
    async def find_one(self, *, id: str) -> Optional[Repo]: ...
    def repo(
        self,
        *,
        id: str,
        default_branch: Optional[str] = None,  # defaults to "main"
        created_at: Optional[str] = None,  # defaults to ""
    ) -> Repo: ...
    def get_config(self) -> GitStorageOptions: ...
```

### Repo

```python
class Repo:
    @property
    def id(self) -> str: ...

    async def get_remote_url(
        self,
        *,
        permissions: Optional[List[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[List[str]] = None,  # deprecated; use ref_policies
        ref_policies: Optional[Refs] = None,
    ) -> str: ...

    async def get_import_remote_url(
        self,
        *,
        permissions: Optional[List[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[List[str]] = None,  # deprecated; use ref_policies
        ref_policies: Optional[Refs] = None,
    ) -> str: ...

    async def get_ephemeral_remote_url(
        self,
        *,
        permissions: Optional[List[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[List[str]] = None,  # deprecated; use ref_policies
        ref_policies: Optional[Refs] = None,
    ) -> str: ...

    async def get_file_stream(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        headers: Optional[FileRequestHeaders] = None,
        ttl: Optional[int] = None,
    ) -> Response: ...

    async def head_file(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        headers: Optional[FileRequestHeaders] = None,
        ttl: Optional[int] = None,
    ) -> FileMetadata: ...

    async def get_archive_stream(
        self,
        *,
        ref: Optional[str] = None,
        include_globs: Optional[List[str]] = None,
        exclude_globs: Optional[List[str]] = None,
        max_blob_size: Optional[int] = None,
        archive_prefix: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> Response: ...

    async def list_files(
        self,
        *,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        path: Optional[str] = None,
        recursive: Optional[bool] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesResult: ...

    async def list_files_with_metadata(
        self,
        *,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        path: Optional[str] = None,
        recursive: Optional[bool] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesWithMetadataResult: ...

    async def list_branches(
        self,
        *,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> ListBranchesResult: ...

    async def create_branch(
        self,
        *,
        base_ref: Optional[str] = None,
        base_branch: Optional[str] = None,  # deprecated
        target_branch: str,
        base_is_ephemeral: bool = False,
        target_is_ephemeral: bool = False,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> CreateBranchResult: ...

    async def delete_branch(
        self,
        *,
        name: str,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> DeleteBranchResult: ...

    async def merge(
        self,
        *,
        source_branch: str,
        target_branch: str,
        strategy: Literal["merge", "ff_only", "ff_prefer"],
        source_is_ephemeral: Optional[bool] = None,
        target_is_ephemeral: Optional[bool] = None,
        expected_target_sha: Optional[str] = None,
        commit_message: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        committer: Optional[CommitSignature] = None,
        allow_unrelated_histories: Optional[bool] = None,
        squash: Optional[bool] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> MergeBranchesResult: ...

    async def list_tags(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListTagsResult: ...

    async def create_tag(
        self,
        *,
        name: str,
        target: str,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> CreateTagResult: ...

    async def delete_tag(
        self,
        *,
        name: str,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> DeleteTagResult: ...

    async def promote_ephemeral_branch(
        self,
        *,
        base_branch: str,
        target_branch: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> CreateBranchResult: ...

    async def list_commits(
        self,
        *,
        branch: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        path: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> ListCommitsResult: ...

    async def get_commit(
        self,
        *,
        sha: str,
        ttl: Optional[int] = None,
    ) -> GetCommitResult: ...

    async def get_blame(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ranges: Optional[list[str]] = None,
        detect_moves: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> BlameResult: ...

    async def get_note(
        self,
        *,
        sha: str,
        ttl: Optional[int] = None,
    ) -> NoteReadResult: ...

    async def create_note(
        self,
        *,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult: ...

    async def append_note(
        self,
        *,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult: ...

    async def delete_note(
        self,
        *,
        sha: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult: ...

    async def get_branch_diff(
        self,
        *,
        branch: str,
        base: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        paths: Optional[List[str]] = None,
        ttl: Optional[int] = None,
    ) -> GetBranchDiffResult: ...

    async def get_commit_diff(
        self,
        *,
        sha: str,
        base_sha: Optional[str] = None,
        paths: Optional[List[str]] = None,
        ttl: Optional[int] = None,
    ) -> GetCommitDiffResult: ...

    async def pull_upstream(
        self,
        *,
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> None: ...

    async def restore_commit(
        self,
        *,
        target_branch: str,
        target_commit_sha: str,
        author: CommitSignature,
        commit_message: Optional[str] = None,
        expected_head_sha: Optional[str] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> RestoreCommitResult: ...

    def create_commit(
        self,
        *,
        target_branch: str,
        commit_message: str,
        author: CommitSignature,
        expected_head_sha: Optional[str] = None,
        base_branch: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> CommitBuilder: ...

    async def create_commit_from_diff(
        self,
        *,
        target_branch: str,
        commit_message: str,
        diff: FileSource,
        author: CommitSignature,
        expected_head_sha: Optional[str] = None,
        base_branch: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> CommitResult: ...
```

### Type Definitions

Key types are provided via TypedDict for better IDE support:

```python
from pierre_storage.types import (
    GitStorageOptions,
    Refs,
    FileSource,
    BaseRepo,
    PublicGitHubBaseRepoAuth,
    GitHubBaseRepo,
    ForkBaseRepo,
    CommitSignature,
    CreateCommitOptions,
    ListFilesResult,
    ListFilesWithMetadataResult,
    ListBranchesResult,
    ListTagsResult,
    ListCommitsResult,
    BlameResult,
    GetBranchDiffResult,
    GetCommitDiffResult,
    CreateBranchResult,
    DeleteBranchResult,
    CreateTagResult,
    DeleteTagResult,
    MergeBranchesResult,
    RestoreCommitResult,
    CommitResult,
    NoteReadResult,
    NoteWriteResult,
    RefUpdate,
    # ... and more
)

# BaseRepo type for GitHub sync or forks
class PublicGitHubBaseRepoAuth(TypedDict):
    auth_type: Literal["public"]

class GitHubBaseRepo(TypedDict, total=False):
    provider: Literal["github"]   # Always "github"
    owner: str                     # GitHub organization or user
    name: str                      # Repository name
    default_branch: Optional[str]  # Default branch (optional)
    auth: PublicGitHubBaseRepoAuth # Optional public GitHub mode

class ForkBaseRepo(TypedDict, total=False):
    id: str                       # Source repo ID
    ref: Optional[str]            # Optional ref name
    sha: Optional[str]            # Optional commit SHA

BaseRepo = Union[GitHubBaseRepo, ForkBaseRepo]
```

## Webhook Validation

The SDK includes utilities for validating webhook signatures:

```python
from pierre_storage import validate_webhook

# Validate webhook signature
result = validate_webhook(
    payload=request.body,  # Raw payload bytes or string
    headers={
        "X-Pierre-Signature": request.headers["X-Pierre-Signature"],
        "X-Pierre-Event": request.headers["X-Pierre-Event"],
    },
    secret="your-webhook-secret",
    options={"max_age_seconds": 300},  # 5 minutes
)

if result["valid"] and result.get("event_type") == "push":
    event = result.get("payload")
    if event:
        print(f"Push to {event['ref']}")
        print(f"Commit: {event['before']} -> {event['after']}")
else:
    print(f"Invalid webhook: {result.get('error')}")
```

## Authentication

The SDK uses JWT (JSON Web Tokens) for authentication. When you call
`get_remote_url()`, it:

1. Creates a JWT with your name, repository ID, and requested permissions
2. Signs it with your private key (ES256, RS256, or EdDSA)
3. Embeds it in the Git remote URL as the password

The generated URLs are compatible with standard Git clients and include all
necessary authentication.

### Manual JWT Generation

For advanced use cases, you can generate JWTs manually using the `generate_jwt`
helper:

```python
from pierre_storage import generate_jwt

# Read your private key
with open("path/to/key.pem", "r") as f:
    private_key = f.read()

# Generate a JWT token
token = generate_jwt(
    key_pem=private_key,
    issuer="your-name",  # e.g., 'v0'
    repo_id="your-repo-id",
    scopes=["git:write", "git:read"],  # Optional, defaults to git:write and git:read
    ttl=3600,  # Optional, defaults to 1 year (31536000 seconds)
)

# Use the token in your Git URL or API calls
git_url = f"https://t:{token}@your-name.code.storage/your-repo-id.git"
```

**Parameters:**

- `key_pem` (required): Private key in PEM format (PKCS8)
- `issuer` (required): Token issuer (your customer name)
- `repo_id` (required): Repository identifier
- `scopes` (optional): List of permission scopes. Defaults to
  `["git:write", "git:read"]`
  - Available scopes: `"git:read"`, `"git:write"`, `"repo:write"`
- `ttl` (optional): Time-to-live in seconds. Defaults to 31536000 (1 year)

The function automatically detects the key type (RSA, EC, or EdDSA) and uses the
appropriate signing algorithm (RS256, ES256, or EdDSA).

## Error Handling

The SDK provides specific error classes:

```python
from pierre_storage import ApiError, RefUpdateError

try:
    repo = await storage.create_repo(id="existing")
except ApiError as e:
    print(f"API error: {e.message}")
    print(f"Status code: {e.status_code}")

try:
    result = await builder.send()
except RefUpdateError as e:
    print(f"Ref update failed: {e.message}")
    print(f"Status: {e.status}")
    print(f"Reason: {e.reason}")
    print(f"Ref update: {e.ref_update}")
```

## Development

### Setup

```bash
# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Or use Moon
moon run git-storage-sdk-python:setup

# Run tests
pytest

# Run tests with coverage
pytest --cov=pierre_storage --cov-report=html

# Type checking
mypy pierre_storage

# Linting
ruff check pierre_storage
```

### Building

```bash
python -m build
```

## License

MIT
