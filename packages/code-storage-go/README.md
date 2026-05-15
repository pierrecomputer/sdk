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

### Merge branches

```go
result, err := repo.Merge(context.Background(), storage.MergeOptions{
	SourceBranch:      "feature",
	SourceIsEphemeral: true,
	TargetBranch:      "main",
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

## Releasing a new version

Because this Go module lives in a monorepo, git tags must be prefixed with the module's subdirectory path:

```bash
git tag packages/code-storage-go/v0.7.0
git push origin packages/code-storage-go/v0.7.0
```

Make sure the version in `version.go` (`PackageVersion`) matches the tag before tagging.

## Features

- Create, list, find, and delete repositories.
- Generate authenticated git remote URLs, including import and ephemeral variants.
- Read files, read file metadata, download archives, list branches/commits, and run grep queries.
- Create commits via streaming commit-pack or diff-commit endpoints.
- Restore commits, merge branches, manage git notes, create branches, and manage tags.
- Validate webhook signatures and parse push events.
