# pierre-storage-go

Pierre Git Storage SDK for Go.

## Usage

```go
package main

import (
	"context"
	"fmt"
	"log"

	storage "github.com/pierrecomputer/sdk/packages/code-storage-go"
)

func main() {
	client, err := storage.NewClient(storage.Options{
		Name: "your-name",
		Key:  "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
	})
	if err != nil {
		log.Fatal(err)
	}

	repo, err := client.CreateRepo(context.Background(), storage.CreateRepoOptions{})
	if err != nil {
		log.Fatal(err)
	}

	url, err := repo.RemoteURL(context.Background(), storage.RemoteURLOptions{})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(url)

	importURL, err := repo.ImportRemoteURL(context.Background(), storage.RemoteURLOptions{})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(importURL)
}
```

### Repository deployments

Configure hosting while creating or updating a repository:

```go
deployOnPush := true
apiURL := "https://example.com"
repo, err := client.CreateRepo(ctx, storage.CreateRepoOptions{
	ID: "my-custom-repo",
	Deployment: &storage.DeploymentSettings{
		DeployOnPush:             &deployOnPush,
		Framework:                storage.SetDeploymentString("nextjs"),
		RootDirectory:            storage.SetDeploymentString("apps/web"),
		ServerlessFunctionRegion: storage.SetDeploymentString("fra1"),
		Env: map[string]*string{
			"API_URL": &apiURL,
		},
	},
})
if err != nil {
	log.Fatal(err)
}

_, err = client.UpdateRepo(ctx, storage.UpdateRepoOptions{
	ID: repo.ID,
	Deployment: &storage.DeploymentSettings{
		Framework:                storage.ResetDeploymentString(),
		ServerlessFunctionRegion: storage.ResetDeploymentString(),
	},
})
```

Unset fields are omitted. `ResetDeploymentString` sends an explicit null.
Region codes are at most four characters and apply from the next deployment.

```go
ready, err := repo.Deploy(ctx, storage.DeployOptions{
	Ref:            "main",
	Target:         storage.DeploymentTargetProduction,
	IdempotencyKey: "release-2026-08-27",
})
if err != nil {
	log.Fatal(err) // *storage.DeploymentFailedError on error/canceled status
}
fmt.Println(ready.URL)

created, err := repo.CreateDeployment(ctx, storage.CreateDeploymentOptions{
	Ref:    "feature",
	Target: storage.DeploymentTargetPreview,
})
page, err := repo.ListDeployments(ctx, storage.ListDeploymentsOptions{Limit: 20})
current, err := repo.GetDeployment(ctx, storage.GetDeploymentOptions{
	DeploymentID: created.ID,
})
```

`Deploy` creates and polls until the deployment reaches `ready` (2s interval,
10m timeout by default). `CreateDeployment` returns immediately with the
current state. Reuse the same idempotency key when retrying creation.

### Inspect file metadata

```go
meta, err := repo.HeadFile(context.Background(), storage.HeadFileOptions{
	Path: "README.md",
	Ref:  "main",
	Headers: storage.FileRequestHeaders{
		IfNoneMatch: `"b10b5ha"`,
		Range:       "bytes=0-1023",
	},
})
if err != nil {
	log.Fatal(err)
}

fmt.Println(meta.StatusCode, meta.ETag, meta.ContentRange)
```

### Download an archive

```go
maxBlobSize := int64(1024 * 1024)
resp, err := repo.ArchiveStream(context.Background(), storage.ArchiveOptions{
	Ref:           "main",
	IncludeGlobs:  []string{"README.md"},
	ExcludeGlobs:  []string{"vendor/**"},
	MaxBlobSize:   &maxBlobSize, // optional max file size in bytes
	ArchivePrefix: "repo/",
})
if err != nil {
	log.Fatal(err)
}
defer resp.Body.Close()
```

### List files with metadata

```go
flag := true
result, err := repo.ListFilesWithMetadata(context.Background(), storage.ListFilesWithMetadataOptions{
	Ref:       "feature/demo",
	Ephemeral: &flag,
})
if err != nil {
	log.Fatal(err)
}

fmt.Println(result.Ref)
fmt.Println(result.Files[0].LastCommitSHA)
fmt.Println(result.Commits[result.Files[0].LastCommitSHA].Author)
```

### Blame a file

```go
blame, err := repo.GetBlame(context.Background(), storage.BlameOptions{
	Path:        "src/main.go",
	Ref:         "main",
	Ranges:      []string{"10,30"},
	DetectMoves: true,
})
if err != nil {
	log.Fatal(err)
}

for _, line := range blame.Lines {
	fmt.Printf("%d (%s): %s — %s\n", line.LineNumber, line.CommitSHA[:7], line.AuthorName, line.Summary)
}
```

`Ranges` accepts repeated `git blame -L` specs (`"10,30"`, `"/getUser/,/^}/"`,
`"10,+5"`, `"10,"`, `",30"`, `"10"`, `":funcname"`). Up to 16 per request; omit
to blame the whole file. The top-level `CommitSHA` is the SHA `Ref` resolved
to; each `BlameLine` carries its authoring commit's metadata inline, with
`PreviousCommitSHA` empty when the line has no prior version.

### Manage tags

```go
tags, err := repo.ListTags(context.Background(), storage.ListTagsOptions{Limit: 10})
if err != nil {
	log.Fatal(err)
}
fmt.Println(tags.Tags)

createdTag, err := repo.CreateTag(context.Background(), storage.CreateTagOptions{
	Name:   "v1.0.0",
	Target: "0123456789abcdef0123456789abcdef01234567",
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(createdTag.Message)

deletedTag, err := repo.DeleteTag(context.Background(), storage.DeleteTagOptions{
	Name: "v1.0.0",
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(deletedTag.Message)

deletedBranch, err := repo.DeleteBranch(context.Background(), storage.DeleteBranchOptions{
	Name: "feature/old-onboarding",
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(deletedBranch.Message)

// Set Ephemeral to delete a branch from the ephemeral namespace
ephemeral := true
deletedEphemeral, err := repo.DeleteBranch(context.Background(), storage.DeleteBranchOptions{
	Name:      "merge/123e4567-e89b-12d3-a456-426614174000",
	Ephemeral: &ephemeral,
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(deletedEphemeral.Ephemeral)
```

### Manage notes

```go
// Create and read a note. Notes default to refs/notes/commits. Set Ref to
// target another notes ref; a bare name like "reviews" is placed under
// refs/notes/ (a fully-qualified refs/notes/* ref also works). Custom refs must
// be enabled server-side.
if _, err := repo.CreateNote(context.Background(), storage.CreateNoteOptions{
	SHA:  "0123456789abcdef0123456789abcdef01234567",
	Note: "LGTM",
	Ref:  "reviews",
}); err != nil {
	log.Fatal(err)
}

note, err := repo.GetNote(context.Background(), storage.GetNoteOptions{
	SHA: "0123456789abcdef0123456789abcdef01234567",
	Ref: "reviews",
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(note.Note)

// Discover custom notes namespaces with cursor pagination. Requires the custom
// notes refs feature to be enabled server-side.
refs, err := repo.ListNotesRefs(context.Background(), storage.ListNotesRefsOptions{
	Prefix: "reviews/",
	Limit:  20,
})
if err != nil {
	log.Fatal(err)
}
for _, entry := range refs.Refs {
	fmt.Println(entry.Ref, entry.SHA)
}
if refs.HasMore {
	_, _ = repo.ListNotesRefs(context.Background(), storage.ListNotesRefsOptions{
		Prefix: "reviews/",
		Cursor: refs.NextCursor,
	})
}
```

### Preview merge

```go
includeContent := true
preview, err := repo.PreviewMerge(context.Background(), storage.PreviewMergeOptions{
	SourceBranch:   "feature",
	TargetBranch:   "main",
	IncludeContent: &includeContent,
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(preview.Status, preview.Result, preview.ConflictPaths)
```

### Merge branches

```go
result, err := repo.Merge(context.Background(), storage.MergeOptions{
	SourceBranch:      "feature",
	SourceIsEphemeral: true,
	TargetBranch:      "main",
	// Leave ExpectedTargetSHA empty to merge into the current target tip.
	// Set it to require TargetBranch to still point at that commit; moved targets return 409.
	Strategy:          storage.MergeStrategyMerge,
	Author:            &storage.CommitSignature{Name: "Merge Bot", Email: "merge@example.com"},
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Result, result.Target.NewSHA)
```

### Create a commit

```go
builder, err := repo.CreateCommit(storage.CommitOptions{
	TargetBranch:  "main",
	CommitMessage: "Update docs",
	Author:        storage.CommitSignature{Name: "Docs Bot", Email: "docs@example.com"},
})
if err != nil {
	log.Fatal(err)
}

builder = builder.AddFileFromString("docs/readme.md", "# Updated\n", nil)

result, err := builder.Send(context.Background())
if err != nil {
	log.Fatal(err)
}

fmt.Println(result.CommitSHA)
```

### Inspect commit parents

`ListCommits` and `GetCommit` expose parent SHAs in Git parent order. Root
commits return an empty slice.

```go
commits, err := repo.ListCommits(context.Background(), storage.ListCommitsOptions{
	Branch: "main",
	Limit:  20,
})
if err != nil {
	log.Fatal(err)
}

for _, commit := range commits.Commits {
	fmt.Println(commit.SHA, commit.ParentSHAs)
}
```

### Get an applicable commit diff

```go
diff, err := repo.GetCommitDiff(context.Background(), storage.GetCommitDiffOptions{
	SHA:           "head-commit-sha",
	BaseSHA:       "base-commit-sha",
	GitApplyCompatible: true,
})
if err != nil {
	log.Fatal(err)
}
```

`GitApplyCompatible` generates raw diffs for use with `git apply`. When no files are filtered and every
changed file has non-empty `Raw`, concatenate each `diff.Files[i].Raw` in response order to produce
a patch for the exact base tree.

TTL fields use `time.Duration` values (for example `time.Hour`).

### Hydrate a repo without an API request

If you already know repo metadata, you can create a `Repo` handle directly:

```go
repo, err := client.Repo(storage.RepoOptions{
	ID:            "repo-id",
	DefaultBranch: "main",
	CreatedAt:     "2024-06-15T12:00:00Z",
})
if err != nil {
	log.Fatal(err)
}

url, err := repo.RemoteURL(context.Background(), storage.RemoteURLOptions{})
if err != nil {
	log.Fatal(err)
}

fmt.Println(url)
```

### Sync from a public GitHub base repository

```go
repo, err := client.CreateRepo(context.Background(), storage.CreateRepoOptions{
	BaseRepo: storage.GitHubBaseRepo{
		Owner: "octocat",
		Name:  "hello-world",
		Auth: &storage.GitHubBaseRepoAuth{
			AuthType: storage.GitHubBaseRepoAuthTypePublic,
		},
	},
})
if err != nil {
	log.Fatal(err)
}

fmt.Println(repo.ID)
```

## Features

- Create, list, find, and delete repositories.
- Configure repository hosting and create, list, or inspect durable deployments.
- Generate authenticated git remote URLs, including import and ephemeral variants.
- Read files, read file metadata, download archives, list branches/commits, and run grep queries.
- Create commits via streaming commit-pack or diff-commit endpoints.
- Restore commits, merge branches, manage git notes, create branches, and manage tags.
- Validate webhook signatures and parse push events.
