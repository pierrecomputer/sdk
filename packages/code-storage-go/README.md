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
git tag packages/code-storage-go/v0.2.2
git push origin packages/code-storage-go/v0.2.2
```

Make sure the version in `version.go` (`PackageVersion`) matches the tag before tagging.

## Features

- Create, list, find, and delete repositories.
- Generate authenticated git remote URLs, including import and ephemeral variants.
- Read files, read file metadata, download archives, list branches/commits, and run grep queries.
- Create commits via streaming commit-pack or diff-commit endpoints.
- Restore commits, manage git notes, and create branches.
- Validate webhook signatures and parse push events.
