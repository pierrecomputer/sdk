package storage

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestRemoteURLJWT(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	remote, err := repo.RemoteURL(nil, RemoteURLOptions{})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	if !strings.Contains(remote, "repo-1.git") {
		t.Fatalf("expected repo in url: %s", remote)
	}
	claims := parseJWTFromURL(t, remote)
	if claims["repo"] != "repo-1" {
		t.Fatalf("expected repo claim")
	}
}

func TestEphemeralRemoteURL(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	remote, err := repo.EphemeralRemoteURL(nil, RemoteURLOptions{})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	if !strings.Contains(remote, "repo-1+ephemeral.git") {
		t.Fatalf("expected ephemeral url: %s", remote)
	}
}

func TestImportRemoteURL(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	remote, err := repo.ImportRemoteURL(nil, RemoteURLOptions{})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	if !strings.Contains(remote, "repo-1+import.git") {
		t.Fatalf("expected import url: %s", remote)
	}
	claims := parseJWTFromURL(t, remote)
	if claims["repo"] != "repo-1" {
		t.Fatalf("expected repo claim")
	}
}

func TestRemoteURLOps(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	t.Run("includes ops in JWT when provided", func(t *testing.T) {
		remote, err := repo.RemoteURL(nil, RemoteURLOptions{
			Ops: Ops{OpNoForcePush},
		})
		if err != nil {
			t.Fatalf("remote url error: %v", err)
		}
		claims := parseJWTFromURL(t, remote)
		ops, ok := claims["ops"].([]interface{})
		if !ok {
			t.Fatalf("expected ops claim to be a list")
		}
		if len(ops) != 1 || ops[0] != "no-force-push" {
			t.Fatalf("unexpected ops: %v", ops)
		}
	})

	t.Run("omits ops from JWT when not provided", func(t *testing.T) {
		remote, err := repo.RemoteURL(nil, RemoteURLOptions{})
		if err != nil {
			t.Fatalf("remote url error: %v", err)
		}
		claims := parseJWTFromURL(t, remote)
		if _, ok := claims["ops"]; ok {
			t.Fatalf("expected no ops claim")
		}
	})
}

func TestRemoteURLRefs(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	t.Run("includes refs in JWT when provided", func(t *testing.T) {
		remote, err := repo.RemoteURL(nil, RemoteURLOptions{
			RefPolicies: RefPolicyList{
				{Pattern: "refs/heads/main", Ops: Ops{OpNoPush}},
				{Pattern: "*", Ops: Ops{OpNoForcePush}},
			},
		})
		if err != nil {
			t.Fatalf("remote url error: %v", err)
		}
		claims := parseJWTFromURL(t, remote)
		refs, ok := claims["refs"].([]interface{})
		if !ok {
			t.Fatalf("expected refs claim to be a list, got %T", claims["refs"])
		}
		if len(refs) != 2 {
			t.Fatalf("expected 2 ref rules, got %d", len(refs))
		}
		mainRule, ok := refs[0].([]interface{})
		if !ok || len(mainRule) != 2 {
			t.Fatalf("unexpected main rule shape: %v", refs[0])
		}
		if mainRule[0] != "refs/heads/main" {
			t.Fatalf("unexpected pattern: %v", mainRule[0])
		}
		mainOps, ok := mainRule[1].([]interface{})
		if !ok || len(mainOps) != 1 || mainOps[0] != "no-push" {
			t.Fatalf("unexpected main ops: %v", mainRule[1])
		}
	})

	t.Run("includes verify-sig op in refs claim", func(t *testing.T) {
		remote, err := repo.RemoteURL(nil, RemoteURLOptions{
			RefPolicies: RefPolicyList{
				{Pattern: "refs/heads/main", Ops: Ops{OpVerifySig}},
			},
		})
		if err != nil {
			t.Fatalf("remote url error: %v", err)
		}
		claims := parseJWTFromURL(t, remote)
		refs, ok := claims["refs"].([]interface{})
		if !ok || len(refs) != 1 {
			t.Fatalf("expected 1 ref rule, got %v", claims["refs"])
		}
		rule, ok := refs[0].([]interface{})
		if !ok || len(rule) != 2 {
			t.Fatalf("unexpected rule shape: %v", refs[0])
		}
		ops, ok := rule[1].([]interface{})
		if !ok || len(ops) != 1 || ops[0] != "verify-sig" {
			t.Fatalf("unexpected ops: %v", rule[1])
		}
	})

	t.Run("omits refs from JWT when not provided", func(t *testing.T) {
		remote, err := repo.RemoteURL(nil, RemoteURLOptions{})
		if err != nil {
			t.Fatalf("remote url error: %v", err)
		}
		claims := parseJWTFromURL(t, remote)
		if _, ok := claims["refs"]; ok {
			t.Fatalf("expected no refs claim")
		}
	})
}

func TestListFilesEphemeral(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/files" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("ref") != "feature/demo" || q.Get("ephemeral") != "true" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"paths":["docs/readme.md"],"ref":"refs/namespaces/ephemeral/refs/heads/feature/demo"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	flag := true
	result, err := repo.ListFiles(nil, ListFilesOptions{Ref: "feature/demo", Ephemeral: &flag})
	if err != nil {
		t.Fatalf("list files error: %v", err)
	}
	if result.Ref == "" || len(result.Paths) != 1 {
		t.Fatalf("unexpected result")
	}
}

func TestListFilesWithMetadataEphemeral(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/files/metadata" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("ref") != "feature/demo" || q.Get("ephemeral") != "true" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"files":[{"path":"docs/readme.md","mode":"100644","size":12,"last_commit_sha":"deadbeef"}],"commits":{"deadbeef":{"author":"Test User","date":"2026-02-19T12:00:00Z","message":"initial commit"}},"ref":"refs/namespaces/ephemeral/refs/heads/feature/demo"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	flag := true
	result, err := repo.ListFilesWithMetadata(nil, ListFilesWithMetadataOptions{Ref: "feature/demo", Ephemeral: &flag})
	if err != nil {
		t.Fatalf("list files with metadata error: %v", err)
	}
	if result.Ref == "" || len(result.Files) != 1 {
		t.Fatalf("unexpected result")
	}
	if result.Files[0].LastCommitSHA != "deadbeef" {
		t.Fatalf("unexpected last commit sha: %s", result.Files[0].LastCommitSHA)
	}
	commit, ok := result.Commits["deadbeef"]
	if !ok {
		t.Fatalf("expected commit metadata")
	}
	if commit.Author != "Test User" || commit.Message != "initial commit" {
		t.Fatalf("unexpected commit metadata: %+v", commit)
	}
	if commit.RawDate != "2026-02-19T12:00:00Z" {
		t.Fatalf("unexpected raw date: %s", commit.RawDate)
	}
	if commit.Date.IsZero() {
		t.Fatalf("expected parsed commit date")
	}
}

func TestListFilesSubtreeAndPagination(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/files" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("ref") != "main" || q.Get("path") != "docs" ||
			q.Get("recursive") != "false" || q.Get("cursor") != "docs/a.md" ||
			q.Get("limit") != "50" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"paths":["docs/guide.md"],"ref":"main","entries":[{"path":"docs/sub","type":"tree","mode":"040000"},{"path":"docs/guide.md","type":"blob","mode":"100644"}],"next_cursor":"docs/zz","has_more":true}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	recursive := false
	result, err := repo.ListFiles(nil, ListFilesOptions{
		Ref:       "main",
		Path:      "docs",
		Recursive: &recursive,
		Cursor:    "docs/a.md",
		Limit:     50,
	})
	if err != nil {
		t.Fatalf("list files error: %v", err)
	}
	if result.NextCursor != "docs/zz" || !result.HasMore {
		t.Fatalf("expected pagination state: %+v", result)
	}
	if len(result.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(result.Entries))
	}
	if result.Entries[0].Type != TreeEntryTree || result.Entries[0].Path != "docs/sub" ||
		result.Entries[0].Mode != "040000" {
		t.Fatalf("unexpected first entry: %+v", result.Entries[0])
	}
	if result.Entries[1].Type != TreeEntryBlob {
		t.Fatalf("expected blob, got %s", result.Entries[1].Type)
	}
}

func TestListFilesLegacyResponseDefaults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"paths":["README.md"],"ref":"main"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListFiles(nil, ListFilesOptions{})
	if err != nil {
		t.Fatalf("list files error: %v", err)
	}
	if len(result.Entries) != 0 {
		t.Fatalf("expected no entries, got %d", len(result.Entries))
	}
	if result.HasMore {
		t.Fatalf("expected has_more=false")
	}
	if result.NextCursor != "" {
		t.Fatalf("expected empty next_cursor")
	}
}

func TestListFilesWithMetadataPaginationAndType(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("path") != "src" || q.Get("cursor") != "src/a.ts" || q.Get("limit") != "100" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"files":[{"path":"src/main.ts","mode":"100644","size":42,"last_commit_sha":"deadbeef","type":"blob"}],"commits":{"deadbeef":{"author":"Test","date":"2026-02-19T12:00:00Z","message":"init"}},"ref":"main","next_cursor":"src/zz.ts","has_more":true}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListFilesWithMetadata(nil, ListFilesWithMetadataOptions{
		Path:   "src",
		Cursor: "src/a.ts",
		Limit:  100,
	})
	if err != nil {
		t.Fatalf("list files with metadata error: %v", err)
	}
	if result.Files[0].Type != TreeEntryBlob {
		t.Fatalf("expected blob type, got %s", result.Files[0].Type)
	}
	if result.NextCursor != "src/zz.ts" || !result.HasMore {
		t.Fatalf("unexpected pagination: %+v", result)
	}
}

func TestListCommitsPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("branch") != "main" || q.Get("path") != "docs/guide.md" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commits":[],"next_cursor":"","has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.ListCommits(nil, ListCommitsOptions{Branch: "main", Path: "docs/guide.md"}); err != nil {
		t.Fatalf("list commits error: %v", err)
	}
}

func TestFileStreamForwardsConditionalHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/file" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Range"); got != "bytes=0-15" {
			t.Fatalf("unexpected Range header: %q", got)
		}
		if got := r.Header.Get("If-None-Match"); got != `"abc"` {
			t.Fatalf("unexpected If-None-Match: %q", got)
		}
		if got := r.Header.Get("If-Modified-Since"); got != "Wed, 21 Oct 2026 07:28:00 GMT" {
			t.Fatalf("unexpected If-Modified-Since: %q", got)
		}
		w.WriteHeader(http.StatusPartialContent)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	resp, err := repo.FileStream(nil, GetFileOptions{
		Path: "README.md",
		Headers: FileRequestHeaders{
			Range:           "bytes=0-15",
			IfNoneMatch:     `"abc"`,
			IfModifiedSince: "Wed, 21 Oct 2026 07:28:00 GMT",
		},
	})
	if err != nil {
		t.Fatalf("file stream error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected 206, got %d", resp.StatusCode)
	}
}

func TestFileStreamPasses304Through(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotModified)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	resp, err := repo.FileStream(nil, GetFileOptions{
		Path:    "README.md",
		Headers: FileRequestHeaders{IfNoneMatch: `"abc"`},
	})
	if err != nil {
		t.Fatalf("expected 304 not to raise: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", resp.StatusCode)
	}
}

func TestFileStreamPasses416ThroughWithContentRange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Range"); got != "bytes=256-511" {
			t.Fatalf("unexpected Range header: %q", got)
		}
		w.Header().Set("Content-Range", "bytes */128")
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	resp, err := repo.FileStream(nil, GetFileOptions{
		Path:    "README.md",
		Headers: FileRequestHeaders{Range: "bytes=256-511"},
	})
	if err != nil {
		t.Fatalf("expected 416 not to raise: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusRequestedRangeNotSatisfiable {
		t.Fatalf("expected 416, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Range"); got != "bytes */128" {
		t.Fatalf("unexpected content-range: %s", got)
	}
}

func TestHeadFileParsesMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("expected HEAD, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/file" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("path") != "README.md" {
			t.Fatalf("expected path=README.md, got %s", r.URL.RawQuery)
		}
		w.Header().Set("X-Blob-Sha", "b10b5ha")
		w.Header().Set("X-Last-Commit-Sha", "c0mm1tsha")
		w.Header().Set("Content-Length", "128")
		w.Header().Set("ETag", `"b10b5ha"`)
		w.Header().Set("Last-Modified", "Wed, 21 Oct 2026 07:28:00 GMT")
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Type", "application/octet-stream")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	meta, err := repo.HeadFile(nil, HeadFileOptions{Path: "README.md"})
	if err != nil {
		t.Fatalf("head file error: %v", err)
	}
	if meta.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", meta.StatusCode)
	}
	if meta.BlobSHA != "b10b5ha" || meta.LastCommitSHA != "c0mm1tsha" {
		t.Fatalf("unexpected blob/commit sha: %+v", meta)
	}
	if meta.Size != 128 {
		t.Fatalf("expected size 128, got %d", meta.Size)
	}
	if meta.ETag != `"b10b5ha"` {
		t.Fatalf("unexpected etag: %s", meta.ETag)
	}
	if meta.AcceptRanges != "bytes" {
		t.Fatalf("unexpected accept-ranges: %s", meta.AcceptRanges)
	}
	if meta.ContentType != "application/octet-stream" {
		t.Fatalf("unexpected content-type: %s", meta.ContentType)
	}
	if meta.RawLastModified != "Wed, 21 Oct 2026 07:28:00 GMT" {
		t.Fatalf("unexpected raw last-modified: %s", meta.RawLastModified)
	}
	if meta.LastModified.IsZero() {
		t.Fatalf("expected parsed last modified")
	}
}

func TestHeadFilePreservesRangeStatusAndContentRange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("expected HEAD, got %s", r.Method)
		}
		if got := r.Header.Get("Range"); got != "bytes=0-15" {
			t.Fatalf("unexpected Range header: %q", got)
		}
		w.Header().Set("Content-Length", "16")
		w.Header().Set("Content-Range", "bytes 0-15/128")
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusPartialContent)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	meta, err := repo.HeadFile(nil, HeadFileOptions{
		Path:    "README.md",
		Headers: FileRequestHeaders{Range: "bytes=0-15"},
	})
	if err != nil {
		t.Fatalf("head file error: %v", err)
	}
	if meta.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected status 206, got %d", meta.StatusCode)
	}
	if meta.Size != 16 {
		t.Fatalf("expected size 16, got %d", meta.Size)
	}
	if meta.ContentRange != "bytes 0-15/128" {
		t.Fatalf("unexpected content-range: %s", meta.ContentRange)
	}
	if meta.AcceptRanges != "bytes" {
		t.Fatalf("unexpected accept-ranges: %s", meta.AcceptRanges)
	}
}

func TestHeadFilePreservesUnsatisfiedRangeStatusAndContentRange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("expected HEAD, got %s", r.Method)
		}
		if got := r.Header.Get("Range"); got != "bytes=256-511" {
			t.Fatalf("unexpected Range header: %q", got)
		}
		w.Header().Set("Content-Range", "bytes */128")
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	meta, err := repo.HeadFile(nil, HeadFileOptions{
		Path:    "README.md",
		Headers: FileRequestHeaders{Range: "bytes=256-511"},
	})
	if err != nil {
		t.Fatalf("head file error: %v", err)
	}
	if meta.StatusCode != http.StatusRequestedRangeNotSatisfiable {
		t.Fatalf("expected status 416, got %d", meta.StatusCode)
	}
	if meta.ContentRange != "bytes */128" {
		t.Fatalf("unexpected content-range: %s", meta.ContentRange)
	}
	if meta.AcceptRanges != "bytes" {
		t.Fatalf("unexpected accept-ranges: %s", meta.AcceptRanges)
	}
}

func TestHeadFilePreservesConditionalStatus(t *testing.T) {
	tests := []struct {
		name    string
		status  int
		headers FileRequestHeaders
	}{
		{
			name:    "not modified",
			status:  http.StatusNotModified,
			headers: FileRequestHeaders{IfNoneMatch: `"abc"`},
		},
		{
			name:    "precondition failed",
			status:  http.StatusPreconditionFailed,
			headers: FileRequestHeaders{IfMatch: `"abc"`},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodHead {
					t.Fatalf("expected HEAD, got %s", r.Method)
				}
				if tt.headers.IfNoneMatch != "" {
					if got := r.Header.Get("If-None-Match"); got != tt.headers.IfNoneMatch {
						t.Fatalf("unexpected If-None-Match header: %q", got)
					}
				}
				if tt.headers.IfMatch != "" {
					if got := r.Header.Get("If-Match"); got != tt.headers.IfMatch {
						t.Fatalf("unexpected If-Match header: %q", got)
					}
				}
				w.WriteHeader(tt.status)
			}))
			defer server.Close()

			client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
			if err != nil {
				t.Fatalf("client error: %v", err)
			}
			repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

			meta, err := repo.HeadFile(nil, HeadFileOptions{
				Path:    "README.md",
				Headers: tt.headers,
			})
			if err != nil {
				t.Fatalf("head file error: %v", err)
			}
			if meta.StatusCode != tt.status {
				t.Fatalf("expected status %d, got %d", tt.status, meta.StatusCode)
			}
		})
	}
}

func TestGrepRequestBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/grep" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["ref"] != "main" {
			t.Fatalf("expected ref main")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pattern":"SEARCH","case_sensitive":false},"repo":{"ref":"main","commit":"deadbeef"},"matches":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.Grep(nil, GrepOptions{
		Ref:   "main",
		Paths: []string{"src/"},
		Query: GrepQuery{Pattern: "SEARCH", CaseSensitive: boolPtr(false)},
	})
	if err != nil {
		t.Fatalf("grep error: %v", err)
	}
}

func TestGrepEphemeralRequestBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/grep" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["ephemeral"] != true {
			t.Fatalf("expected ephemeral=true, got %v", body["ephemeral"])
		}
		if body["ref"] != "feature" {
			t.Fatalf("expected ref=feature, got %v", body["ref"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pattern":"SEARCH","case_sensitive":false},"repo":{"ref":"feature","commit":"deadbeef"},"matches":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err = repo.Grep(nil, GrepOptions{
		Ref:       "feature",
		Ephemeral: boolPtr(true),
		Query:     GrepQuery{Pattern: "SEARCH"},
	}); err != nil {
		t.Fatalf("grep error: %v", err)
	}
}

func TestGrepRequestLegacyRev(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/grep" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var body map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["ref"] != "main" {
			t.Fatalf("expected ref main")
		}
		if _, ok := body["rev"]; ok {
			t.Fatalf("expected rev to be omitted when using legacy rev")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pattern":"SEARCH","case_sensitive":false},"repo":{"ref":"main","commit":"deadbeef"},"matches":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.Grep(nil, GrepOptions{
		Rev:   "main",
		Query: GrepQuery{Pattern: "SEARCH", CaseSensitive: boolPtr(false)},
	})
	if err != nil {
		t.Fatalf("grep error: %v", err)
	}
}

func TestCreateBranchTTL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/branches/create" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		exp := int64(claims["exp"].(float64))
		iat := int64(claims["iat"].(float64))
		if exp-iat != 600 {
			t.Fatalf("expected ttl 600, got %d", exp-iat)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message":"branch created","target_branch":"feature/demo","target_is_ephemeral":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.CreateBranch(nil, CreateBranchOptions{BaseBranch: "main", TargetBranch: "feature/demo", InvocationOptions: InvocationOptions{TTL: 600 * time.Second}})
	if err != nil {
		t.Fatalf("create branch error: %v", err)
	}
}

func TestPreviewMergeRequestAndResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/merge/preview" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("source_branch"); got != "feature/preview" {
			t.Fatalf("unexpected source_branch: %s", got)
		}
		if got := r.URL.Query().Get("target_branch"); got != "main" {
			t.Fatalf("unexpected target_branch: %s", got)
		}
		if got := r.URL.Query().Get("include_content"); got != "true" {
			t.Fatalf("unexpected include_content: %s", got)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != "git:read" {
			t.Fatalf("unexpected scopes: %v", claims["scopes"])
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"conflicted","result":"merge_commit","source_branch":"feature/preview","target_branch":"main","source_tip_sha":"source123","target_tip_sha":"target123","merge_base_sha":"base123","conflict_paths":["docs/conflict.txt"],"conflicts":[{"path":"docs/conflict.txt","result":{"oid":"result-oid","content":"<<<<<<< ours","truncated":false,"binary":false},"base":{"oid":"base-oid","truncated":false,"binary":false},"ours":{"oid":"ours-oid","content":"ours","truncated":false,"binary":false},"theirs":{"oid":"theirs-oid","content":"theirs","truncated":false,"binary":false}}],"filtered_conflicts":[{"path":"src/app.go","reason":"max_conflict_files_exceeded"}]}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.PreviewMerge(nil, PreviewMergeOptions{
		SourceBranch:   " feature/preview ",
		TargetBranch:   " main ",
		IncludeContent: boolPtr(true),
	})
	if err != nil {
		t.Fatalf("preview merge error: %v", err)
	}

	expected := PreviewMergeResult{
		Status:        PreviewMergeStatusConflicted,
		Result:        PreviewMergeResultMergeCommit,
		SourceBranch:  "feature/preview",
		TargetBranch:  "main",
		SourceTipSHA:  "source123",
		TargetTipSHA:  "target123",
		MergeBaseSHA:  "base123",
		ConflictPaths: []string{"docs/conflict.txt"},
		Conflicts: []PreviewMergeConflict{
			{
				Path: "docs/conflict.txt",
				Result: PreviewMergeBlob{
					OID:       "result-oid",
					Content:   "<<<<<<< ours",
					Truncated: false,
					Binary:    false,
				},
				Base:   PreviewMergeBlob{OID: "base-oid", Truncated: false, Binary: false},
				Ours:   PreviewMergeBlob{OID: "ours-oid", Content: "ours", Truncated: false, Binary: false},
				Theirs: PreviewMergeBlob{OID: "theirs-oid", Content: "theirs", Truncated: false, Binary: false},
			},
		},
		FilteredConflicts: []PreviewMergeFilteredConflict{
			{Path: "src/app.go", Reason: "max_conflict_files_exceeded"},
		},
	}
	if !reflect.DeepEqual(result, expected) {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestPreviewMergeValidation(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: "https://api.example.com"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err = repo.PreviewMerge(nil, PreviewMergeOptions{TargetBranch: "main"}); err == nil || err.Error() != "previewMerge sourceBranch is required" {
		t.Fatalf("unexpected source error: %v", err)
	}
	if _, err = repo.PreviewMerge(nil, PreviewMergeOptions{SourceBranch: "feature"}); err == nil || err.Error() != "previewMerge targetBranch is required" {
		t.Fatalf("unexpected target error: %v", err)
	}
}

func TestMergeGuardedTargetTipRequestAndResponse(t *testing.T) {
	var captured map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/merge" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != "git:write" {
			t.Fatalf("unexpected scopes: %v", claims["scopes"])
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"result":"merge_commit","commit_sha":"commit123","tree_sha":"tree123","source":{"branch":"feature","ephemeral":true,"sha":"source123"},"target":{"branch":"main","ephemeral":false,"old_sha":"old123","new_sha":"new123"},"merge_base_sha":"base123","promoted_commits":2}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}
	author := &CommitSignature{Name: " Bot ", Email: " bot@example.com "}
	committer := &CommitSignature{Name: "Commit Bot", Email: "commit@example.com"}

	result, err := repo.Merge(nil, MergeOptions{
		SourceBranch:            " feature ",
		SourceIsEphemeral:       true,
		TargetBranch:            " main ",
		TargetIsEphemeral:       false,
		ExpectedTargetSHA:       " old123 ",
		CommitMessage:           " Merge feature ",
		Author:                  author,
		Committer:               committer,
		Strategy:                MergeStrategyMerge,
		AllowUnrelatedHistories: true,
	})
	if err != nil {
		t.Fatalf("merge error: %v", err)
	}

	if captured["source_branch"] != "feature" {
		t.Fatalf("unexpected source_branch: %v", captured["source_branch"])
	}
	if captured["source_is_ephemeral"] != true {
		t.Fatalf("unexpected source_is_ephemeral: %v", captured["source_is_ephemeral"])
	}
	if captured["target_branch"] != "main" {
		t.Fatalf("unexpected target_branch: %v", captured["target_branch"])
	}
	if _, ok := captured["target_is_ephemeral"]; ok {
		t.Fatalf("target_is_ephemeral should be omitted when false")
	}
	if captured["expected_target_sha"] != "old123" {
		t.Fatalf("unexpected expected_target_sha: %v", captured["expected_target_sha"])
	}
	if captured["commit_message"] != "Merge feature" {
		t.Fatalf("unexpected commit_message: %v", captured["commit_message"])
	}
	if captured["strategy"] != "merge" {
		t.Fatalf("unexpected strategy: %v", captured["strategy"])
	}
	if captured["allow_unrelated_histories"] != true {
		t.Fatalf("unexpected allow_unrelated_histories: %v", captured["allow_unrelated_histories"])
	}
	authorPayload, ok := captured["author"].(map[string]interface{})
	if !ok || authorPayload["name"] != "Bot" || authorPayload["email"] != "bot@example.com" {
		t.Fatalf("unexpected author: %#v", captured["author"])
	}
	committerPayload, ok := captured["committer"].(map[string]interface{})
	if !ok || committerPayload["name"] != "Commit Bot" || committerPayload["email"] != "commit@example.com" {
		t.Fatalf("unexpected committer: %#v", captured["committer"])
	}

	expected := MergeResult{
		Result:          MergeResultMergeCommit,
		CommitSHA:       "commit123",
		TreeSHA:         "tree123",
		Source:          MergeRef{Branch: "feature", Ephemeral: true, SHA: "source123"},
		Target:          MergeTargetRef{Branch: "main", Ephemeral: false, OldSHA: "old123", NewSHA: "new123"},
		MergeBaseSHA:    "base123",
		PromotedCommits: 2,
	}
	if result != expected {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestMergeCurrentTargetTipModeOmitsExpectedTargetSHA(t *testing.T) {
	var captured map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/merge" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"result":"fast_forward","commit_sha":"new","tree_sha":"tree","source":{"branch":"feature","ephemeral":false,"sha":"new"},"target":{"branch":"main","ephemeral":true,"old_sha":"old","new_sha":"new"},"promoted_commits":1}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.Merge(nil, MergeOptions{
		SourceBranch:      "feature",
		TargetBranch:      "main",
		TargetIsEphemeral: true,
		Strategy:          MergeStrategyFFPrefer,
	})
	if err != nil {
		t.Fatalf("merge error: %v", err)
	}
	for _, key := range []string{"source_is_ephemeral", "expected_target_sha", "commit_message", "author", "committer", "allow_unrelated_histories"} {
		if _, ok := captured[key]; ok {
			t.Fatalf("expected %s to be omitted", key)
		}
	}
	if captured["target_is_ephemeral"] != true {
		t.Fatalf("unexpected target_is_ephemeral: %v", captured["target_is_ephemeral"])
	}
	if result.Result != MergeResultFastForward || !result.Target.Ephemeral || result.MergeBaseSHA != "" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestMergeValidation(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: "https://api.example.com"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	cases := []struct {
		name    string
		options MergeOptions
		want    string
	}{
		{name: "missing_source", options: MergeOptions{TargetBranch: "main", Strategy: MergeStrategyMerge}, want: "merge sourceBranch is required"},
		{name: "missing_target", options: MergeOptions{SourceBranch: "feature", Strategy: MergeStrategyMerge}, want: "merge targetBranch is required"},
		{name: "missing_strategy", options: MergeOptions{SourceBranch: "feature", TargetBranch: "main"}, want: "merge strategy is required"},
		{name: "invalid_strategy", options: MergeOptions{SourceBranch: "feature", TargetBranch: "main", Strategy: MergeStrategy("squash")}, want: "merge strategy is invalid"},
		{name: "invalid_author", options: MergeOptions{SourceBranch: "feature", TargetBranch: "main", Strategy: MergeStrategyMerge, Author: &CommitSignature{Name: "", Email: "bot@example.com"}}, want: "merge author name and email are required when provided"},
		{name: "invalid_committer", options: MergeOptions{SourceBranch: "feature", TargetBranch: "main", Strategy: MergeStrategyMerge, Committer: &CommitSignature{Name: "Bot", Email: ""}}, want: "merge committer name and email are required when provided"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := repo.Merge(nil, tc.options)
			if err == nil || err.Error() != tc.want {
				t.Fatalf("expected %q, got %v", tc.want, err)
			}
		})
	}
}

func TestMergeConflictPreservesBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/merge" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"error":"merge conflict","conflict_paths":["README.md"],"merge_base_sha":"base123"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.Merge(nil, MergeOptions{SourceBranch: "feature", TargetBranch: "main", Strategy: MergeStrategyMerge})
	if err == nil {
		t.Fatalf("expected conflict error")
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	body, ok := apiErr.Body.(map[string]interface{})
	if !ok || body["error"] != "merge conflict" || body["merge_base_sha"] != "base123" {
		t.Fatalf("unexpected error body: %#v", apiErr.Body)
	}
	paths, ok := body["conflict_paths"].([]interface{})
	if !ok || len(paths) != 1 || paths[0] != "README.md" {
		t.Fatalf("unexpected conflict paths: %#v", body["conflict_paths"])
	}
}

func TestRestoreCommitConflict(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/restore-commit" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusConflict)
		payload := map[string]interface{}{
			"commit": map[string]interface{}{
				"commit_sha":    "cafefeed",
				"tree_sha":      "feedface",
				"target_branch": "main",
				"pack_bytes":    0,
			},
			"result": map[string]interface{}{
				"branch":  "main",
				"old_sha": "old",
				"new_sha": "new",
				"success": false,
				"status":  "precondition_failed",
				"message": "branch moved",
			},
		}
		_ = json.NewEncoder(w).Encode(payload)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.RestoreCommit(nil, RestoreCommitOptions{
		TargetBranch:    "main",
		TargetCommitSHA: "abc",
		Author:          CommitSignature{Name: "Author", Email: "author@example.com"},
	})
	if err == nil {
		t.Fatalf("expected error")
	}
	if !strings.Contains(err.Error(), "branch moved") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNoteWritePayload(t *testing.T) {
	var captured []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		captured, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sha":"abc","target_ref":"refs/notes/commits","new_ref_sha":"def","result":{"success":true,"status":"ok"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.CreateNote(nil, CreateNoteOptions{SHA: "abc", Note: "note"})
	if err != nil {
		t.Fatalf("create note error: %v", err)
	}

	var payload map[string]interface{}
	_ = json.Unmarshal(captured, &payload)
	if payload["action"] != "add" {
		t.Fatalf("expected add action")
	}
}

func TestCommitDiffQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/diff" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("sha") != "abc" || q.Get("baseSha") != "base" || q.Get("gitApplyCompatible") != "true" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sha":"abc","stats":{"files":1,"additions":1,"deletions":0,"changes":1},"files":[{"path":"README.md","state":"M","old_path":"","raw":"@@","bytes":10,"is_eof":true,"additions":3,"deletions":1}],"filtered_files":[]}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.GetCommitDiff(nil, GetCommitDiffOptions{SHA: "abc", BaseSHA: "base", GitApplyCompatible: true})
	if err != nil {
		t.Fatalf("commit diff error: %v", err)
	}
	if len(result.Files) != 1 {
		t.Fatalf("expected one file diff, got %d", len(result.Files))
	}
	if result.Files[0].Additions != 3 || result.Files[0].Deletions != 1 {
		t.Fatalf("expected additions/deletions 3/1, got %d/%d", result.Files[0].Additions, result.Files[0].Deletions)
	}
}

func TestRemoteURLPermissionsAndTTL(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	remote, err := repo.RemoteURL(nil, RemoteURLOptions{
		Permissions: []Permission{PermissionGitRead},
		TTL:         2 * time.Hour,
	})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	claims := parseJWTFromURL(t, remote)
	if claims["repo"] != "repo-1" {
		t.Fatalf("expected repo claim")
	}
	scopes, ok := claims["scopes"].([]interface{})
	if !ok || len(scopes) != 1 || scopes[0] != "git:read" {
		t.Fatalf("unexpected scopes")
	}
	exp := int64(claims["exp"].(float64))
	iat := int64(claims["iat"].(float64))
	if exp-iat != int64((2*time.Hour)/time.Second) {
		t.Fatalf("unexpected ttl")
	}
}

func TestRemoteURLDefaultTTL(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo-1", DefaultBranch: "main", client: client}

	remote, err := repo.RemoteURL(nil, RemoteURLOptions{})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	claims := parseJWTFromURL(t, remote)
	scopes, ok := claims["scopes"].([]interface{})
	if !ok || len(scopes) != 2 {
		t.Fatalf("unexpected scopes")
	}
	if scopes[0] != "git:write" || scopes[1] != "git:read" {
		t.Fatalf("unexpected default scopes")
	}
	exp := int64(claims["exp"].(float64))
	iat := int64(claims["iat"].(float64))
	if exp-iat != int64((365*24*time.Hour)/time.Second) {
		t.Fatalf("unexpected default ttl")
	}
}

func TestListFilesTTL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/files" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		exp := int64(claims["exp"].(float64))
		iat := int64(claims["iat"].(float64))
		if exp-iat != 900 {
			t.Fatalf("expected ttl 900, got %d", exp-iat)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"paths":[],"ref":"main"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.ListFiles(nil, ListFilesOptions{InvocationOptions: InvocationOptions{TTL: 900 * time.Second}})
	if err != nil {
		t.Fatalf("list files error: %v", err)
	}
}

func TestListFilesWithMetadataTTL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/files/metadata" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		exp := int64(claims["exp"].(float64))
		iat := int64(claims["iat"].(float64))
		if exp-iat != 900 {
			t.Fatalf("expected ttl 900, got %d", exp-iat)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"files":[],"commits":{},"ref":"main"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.ListFilesWithMetadata(nil, ListFilesWithMetadataOptions{InvocationOptions: InvocationOptions{TTL: 900 * time.Second}})
	if err != nil {
		t.Fatalf("list files with metadata error: %v", err)
	}
}

func TestGrepResponseParsing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/grep" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pattern":"SEARCHME","case_sensitive":false},"repo":{"ref":"main","commit":"deadbeef"},"matches":[{"path":"src/a.ts","lines":[{"line_number":12,"text":"SEARCHME","type":"match"}]}],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.Grep(nil, GrepOptions{
		Ref:   "main",
		Paths: []string{"src/"},
		Query: GrepQuery{Pattern: "SEARCHME", CaseSensitive: boolPtr(false)},
		Context: &GrepContext{
			Before: intPtr(1),
			After:  intPtr(2),
		},
		Limits: &GrepLimits{
			MaxLines:          intPtr(5),
			MaxMatchesPerFile: intPtr(7),
		},
		Pagination: &GrepPagination{
			Cursor: "abc",
			Limit:  intPtr(3),
		},
		FileFilters: &GrepFileFilters{
			IncludeGlobs: []string{"**/*.ts"},
			ExcludeGlobs: []string{"**/vendor/**"},
		},
	})
	if err != nil {
		t.Fatalf("grep error: %v", err)
	}
	if result.Query.Pattern != "SEARCHME" || result.Query.CaseSensitive == nil || *result.Query.CaseSensitive != false {
		t.Fatalf("unexpected grep query")
	}
	if result.Repo.Commit != "deadbeef" {
		t.Fatalf("unexpected repo commit")
	}
	if len(result.Matches) != 1 || result.Matches[0].Path != "src/a.ts" {
		t.Fatalf("unexpected grep matches")
	}
}

func TestCreateBranchPayloadAndResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/branches/create" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		headerAgent := r.Header.Get("Code-Storage-Agent")
		if headerAgent == "" || !strings.Contains(headerAgent, "code-storage-go-sdk/") {
			t.Fatalf("missing Code-Storage-Agent header")
		}
		var body createBranchRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.BaseBranch != "main" || body.TargetBranch != "feature/demo" {
			t.Fatalf("unexpected branch payload")
		}
		if !body.BaseIsEphemeral || !body.TargetIsEphemeral {
			t.Fatalf("expected ephemeral flags")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message":"branch created","target_branch":"feature/demo","target_is_ephemeral":true,"commit_sha":"abc123"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.CreateBranch(nil, CreateBranchOptions{
		BaseBranch:        "main",
		TargetBranch:      "feature/demo",
		BaseIsEphemeral:   true,
		TargetIsEphemeral: true,
	})
	if err != nil {
		t.Fatalf("create branch error: %v", err)
	}
	if result.TargetBranch != "feature/demo" || result.CommitSHA != "abc123" {
		t.Fatalf("unexpected create branch result")
	}
}

func TestListTags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/tags" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("cursor") != "start" || q.Get("limit") != "17" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		headerAgent := r.Header.Get("Code-Storage-Agent")
		if headerAgent == "" || !strings.Contains(headerAgent, "code-storage-go-sdk/") {
			t.Fatalf("missing Code-Storage-Agent header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tags":[{"cursor":"c1","name":"v1.0.0","sha":"abc123"},{"cursor":"c2","name":"v1.0.1","sha":"def456"}],"next_cursor":"next","has_more":true}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListTags(nil, ListTagsOptions{Cursor: "start", Limit: 17})
	if err != nil {
		t.Fatalf("list tags error: %v", err)
	}
	if !result.HasMore || result.NextCursor != "next" {
		t.Fatalf("unexpected pagination: %+v", result)
	}
	if len(result.Tags) != 2 || result.Tags[0].Name != "v1.0.0" || result.Tags[1].SHA != "def456" {
		t.Fatalf("unexpected tags result: %+v", result)
	}
}

func TestCreateTag(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/tags" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		var body createTagRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.Name != "v1.0.0" || body.Target != "0123456789abcdef0123456789abcdef01234567" {
			t.Fatalf("unexpected create tag payload: %+v", body)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		if scopes, ok := claims["scopes"].([]interface{}); !ok || len(scopes) != 1 || scopes[0] != string(PermissionGitWrite) {
			t.Fatalf("unexpected scopes: %#v", claims["scopes"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"v1.0.0","sha":"0123456789abcdef0123456789abcdef01234567","message":"tag created"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.CreateTag(nil, CreateTagOptions{
		Name:   "v1.0.0",
		Target: "0123456789abcdef0123456789abcdef01234567",
	})
	if err != nil {
		t.Fatalf("create tag error: %v", err)
	}
	if result.Name != "v1.0.0" || result.Message != "tag created" {
		t.Fatalf("unexpected create tag result: %+v", result)
	}
}

func TestDeleteTag(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/tags" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		var body deleteTagRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.Name != "v1.0.0" {
			t.Fatalf("unexpected delete tag payload: %+v", body)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 2 || scopes[0] != string(PermissionGitRead) || scopes[1] != string(PermissionGitWrite) {
			t.Fatalf("unexpected scopes: %#v", claims["scopes"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"v1.0.0","message":"tag deleted"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.DeleteTag(nil, DeleteTagOptions{Name: "v1.0.0"})
	if err != nil {
		t.Fatalf("delete tag error: %v", err)
	}
	if result.Name != "v1.0.0" || result.Message != "tag deleted" {
		t.Fatalf("unexpected delete tag result: %+v", result)
	}
}

func TestDeleteBranch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/branches" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		var body deleteBranchRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.Name != "feature/old-onboarding" {
			t.Fatalf("unexpected delete branch payload: %+v", body)
		}
		if body.Ephemeral != nil {
			t.Fatalf("expected omitted ephemeral, got %#v", body.Ephemeral)
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != string(PermissionGitWrite) {
			t.Fatalf("unexpected scopes: %#v", claims["scopes"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"feature/old-onboarding","message":"branch deleted","ephemeral":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.DeleteBranch(context.Background(), DeleteBranchOptions{Name: "feature/old-onboarding"})
	if err != nil {
		t.Fatalf("delete branch error: %v", err)
	}
	if result.Name != "feature/old-onboarding" || result.Message != "branch deleted" || result.Ephemeral {
		t.Fatalf("unexpected delete branch result: %+v", result)
	}
}

func TestDeleteBranchEphemeral(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/branches" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		var body deleteBranchRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body.Name != "merge/123e4567-e89b-12d3-a456-426614174000" {
			t.Fatalf("unexpected delete branch name: %s", body.Name)
		}
		if body.Ephemeral == nil || !*body.Ephemeral {
			t.Fatalf("expected ephemeral=true, got %#v", body.Ephemeral)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"merge/123e4567-e89b-12d3-a456-426614174000","message":"branch deleted","ephemeral":true}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	ephemeral := true
	result, err := repo.DeleteBranch(context.Background(), DeleteBranchOptions{
		Name:      "merge/123e4567-e89b-12d3-a456-426614174000",
		Ephemeral: &ephemeral,
	})
	if err != nil {
		t.Fatalf("delete branch error: %v", err)
	}
	if result.Name != "merge/123e4567-e89b-12d3-a456-426614174000" || result.Message != "branch deleted" || !result.Ephemeral {
		t.Fatalf("unexpected delete branch result: %+v", result)
	}
}

func TestDeleteBranchValidation(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: "http://unused"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.DeleteBranch(nil, DeleteBranchOptions{Name: "  "}); err == nil ||
		!strings.Contains(err.Error(), "deleteBranch name is required") {
		t.Fatalf("expected name-required error, got %v", err)
	}
	if _, err := repo.DeleteBranch(nil, DeleteBranchOptions{Name: "refs/heads/feature/demo"}); err == nil ||
		!strings.Contains(err.Error(), "deleteBranch name must not start with refs/") {
		t.Fatalf("expected refs/ rejection, got %v", err)
	}
}

func TestRestoreCommitSuccess(t *testing.T) {
	var capturedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/restore-commit" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commit":{"commit_sha":"abcdef0123456789abcdef0123456789abcdef01","tree_sha":"fedcba9876543210fedcba9876543210fedcba98","target_branch":"main","pack_bytes":1024},"result":{"branch":"main","old_sha":"0123456789abcdef0123456789abcdef01234567","new_sha":"89abcdef0123456789abcdef0123456789abcdef","success":true,"status":"ok"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	response, err := repo.RestoreCommit(nil, RestoreCommitOptions{
		TargetBranch:    "main",
		ExpectedHeadSHA: "main",
		TargetCommitSHA: "0123456789abcdef0123456789abcdef01234567",
		CommitMessage:   "Restore \"feature\"",
		Author: CommitSignature{
			Name:  "Author Name",
			Email: "author@example.com",
		},
		Committer: &CommitSignature{
			Name:  "Committer Name",
			Email: "committer@example.com",
		},
	})
	if err != nil {
		t.Fatalf("restore commit error: %v", err)
	}
	if response.CommitSHA != "abcdef0123456789abcdef0123456789abcdef01" {
		t.Fatalf("unexpected commit sha")
	}

	metadataEnvelope, ok := capturedBody["metadata"].(map[string]interface{})
	if !ok {
		t.Fatalf("missing metadata envelope")
	}
	if metadataEnvelope["target_branch"] != "main" {
		t.Fatalf("unexpected target_branch")
	}
}

func TestRestoreCommitPreconditionFailed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/restore-commit" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusPreconditionFailed)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commit":null,"result":{"success":false,"status":"precondition_failed","message":"expected head SHA mismatch"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.RestoreCommit(nil, RestoreCommitOptions{
		TargetBranch:    "main",
		ExpectedHeadSHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		TargetCommitSHA: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Author:          CommitSignature{Name: "Author", Email: "author@example.com"},
	})
	if err == nil {
		t.Fatalf("expected error")
	}
	var refErr *RefUpdateError
	if !errors.As(err, &refErr) {
		t.Fatalf("expected RefUpdateError, got %T", err)
	}
	if refErr.Status != "precondition_failed" {
		t.Fatalf("unexpected status: %s", refErr.Status)
	}
}

func TestRestoreCommitNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/restore-commit" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":"not found"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.RestoreCommit(nil, RestoreCommitOptions{
		TargetBranch:    "main",
		TargetCommitSHA: "0123456789abcdef0123456789abcdef01234567",
		Author:          CommitSignature{Name: "Author Name", Email: "author@example.com"},
	})
	if err == nil || !strings.Contains(err.Error(), "HTTP 404") {
		t.Fatalf("expected HTTP 404 error, got %v", err)
	}
}

func TestNoteWriteAppendAndDelete(t *testing.T) {
	var requests []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var payload map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		requests = append(requests, payload)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sha":"abc","target_ref":"refs/notes/commits","new_ref_sha":"def","result":{"success":true,"status":"ok"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.AppendNote(nil, AppendNoteOptions{SHA: "abc", Note: "note append"}); err != nil {
		t.Fatalf("append note error: %v", err)
	}
	if _, err := repo.DeleteNote(nil, DeleteNoteOptions{SHA: "abc"}); err != nil {
		t.Fatalf("delete note error: %v", err)
	}

	if len(requests) != 2 {
		t.Fatalf("expected two note requests")
	}
	if requests[0]["action"] != "append" {
		t.Fatalf("expected append action")
	}
	if _, ok := requests[1]["action"]; ok {
		t.Fatalf("did not expect action for delete")
	}
}

func TestGetNote(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("sha") != "abc123" {
			t.Fatalf("unexpected sha query: %s", q.Get("sha"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sha":"abc123","note":"hello notes","ref_sha":"def456"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.GetNote(nil, GetNoteOptions{SHA: "abc123"})
	if err != nil {
		t.Fatalf("get note error: %v", err)
	}
	if result.Note != "hello notes" || result.RefSHA != "def456" {
		t.Fatalf("unexpected note result")
	}
}

func TestNoteRefTargeting(t *testing.T) {
	var postBody, deleteBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.Method {
		case http.MethodGet:
			if got := r.URL.Query().Get("ref"); got != "reviews" {
				t.Fatalf("unexpected ref query: %q", got)
			}
			_, _ = w.Write([]byte(`{"sha":"abc123","note":"reviewed","ref_sha":"def456"}`))
		case http.MethodPost:
			postBody, _ = io.ReadAll(r.Body)
			_, _ = w.Write([]byte(`{"sha":"abc123","target_ref":"refs/notes/reviews","new_ref_sha":"def456","result":{"success":true,"status":"ok"}}`))
		case http.MethodDelete:
			deleteBody, _ = io.ReadAll(r.Body)
			_, _ = w.Write([]byte(`{"sha":"abc123","target_ref":"refs/notes/reviews","new_ref_sha":"def456","result":{"success":true,"status":"ok"}}`))
		default:
			t.Fatalf("unexpected method: %s", r.Method)
		}
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.GetNote(nil, GetNoteOptions{SHA: "abc123", Ref: "reviews"}); err != nil {
		t.Fatalf("get note error: %v", err)
	}

	if _, err := repo.CreateNote(nil, CreateNoteOptions{SHA: "abc123", Note: "LGTM", Ref: "reviews"}); err != nil {
		t.Fatalf("create note error: %v", err)
	}
	var postPayload map[string]interface{}
	_ = json.Unmarshal(postBody, &postPayload)
	if postPayload["ref"] != "reviews" {
		t.Fatalf("expected create note ref reviews, got %v", postPayload["ref"])
	}

	if _, err := repo.DeleteNote(nil, DeleteNoteOptions{SHA: "abc123", Ref: "refs/notes/reviews"}); err != nil {
		t.Fatalf("delete note error: %v", err)
	}
	var deletePayload map[string]interface{}
	_ = json.Unmarshal(deleteBody, &deletePayload)
	if deletePayload["ref"] != "refs/notes/reviews" {
		t.Fatalf("expected delete note ref refs/notes/reviews, got %v", deletePayload["ref"])
	}
}

func TestListNotesRefs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes/refs" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("prefix") != "reviews/" {
			t.Fatalf("unexpected prefix: %q", q.Get("prefix"))
		}
		if q.Get("limit") != "50" {
			t.Fatalf("unexpected limit: %q", q.Get("limit"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"refs":[{"cursor":"refs/notes/reviews/session-a","ref":"refs/notes/reviews/session-a","sha":"a1b2c3"}],"next_cursor":"refs/notes/reviews/session-b","has_more":true,"prefix":"refs/notes/reviews/"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListNotesRefs(nil, ListNotesRefsOptions{Prefix: "reviews/", Limit: 50})
	if err != nil {
		t.Fatalf("list notes refs error: %v", err)
	}
	if len(result.Refs) != 1 || result.Refs[0].Ref != "refs/notes/reviews/session-a" {
		t.Fatalf("unexpected refs: %+v", result.Refs)
	}
	if result.Refs[0].SHA != "a1b2c3" {
		t.Fatalf("unexpected sha: %q", result.Refs[0].SHA)
	}
	if result.NextCursor != "refs/notes/reviews/session-b" || !result.HasMore {
		t.Fatalf("unexpected pagination: %+v", result)
	}
	if result.Prefix != "refs/notes/reviews/" {
		t.Fatalf("unexpected prefix: %q", result.Prefix)
	}
}

func TestListNotesRefsNoOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/notes/refs" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.RawQuery != "" {
			t.Fatalf("expected no query string, got %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"refs":[],"has_more":false,"prefix":"refs/notes/"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListNotesRefs(nil, ListNotesRefsOptions{})
	if err != nil {
		t.Fatalf("list notes refs error: %v", err)
	}
	if len(result.Refs) != 0 || result.HasMore {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.Prefix != "refs/notes/" {
		t.Fatalf("unexpected prefix: %q", result.Prefix)
	}
}

func TestFileStreamEphemeral(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/file" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("path") != "docs/readme.md" {
			t.Fatalf("unexpected path")
		}
		if q.Get("ref") != "feature/demo" {
			t.Fatalf("unexpected ref")
		}
		if q.Get("ephemeral") != "true" {
			t.Fatalf("unexpected ephemeral")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	flag := true
	resp, err := repo.FileStream(nil, GetFileOptions{Path: "docs/readme.md", Ref: "feature/demo", Ephemeral: &flag})
	if err != nil {
		t.Fatalf("file stream error: %v", err)
	}
	_ = resp.Body.Close()
}

func TestFileStreamEphemeralBase(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/file" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("ephemeral_base") != "true" {
			t.Fatalf("unexpected ephemeral_base")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	flag := true
	resp, err := repo.FileStream(nil, GetFileOptions{Path: "docs/readme.md", EphemeralBase: &flag})
	if err != nil {
		t.Fatalf("file stream error: %v", err)
	}
	_ = resp.Body.Close()
}

func TestArchiveStream(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/archive" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		var payload archiveRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		if payload.Ref != "main" {
			t.Fatalf("unexpected ref: %s", payload.Ref)
		}
		if len(payload.IncludeGlobs) != 1 || payload.IncludeGlobs[0] != "README.md" {
			t.Fatalf("unexpected include globs: %v", payload.IncludeGlobs)
		}
		if len(payload.ExcludeGlobs) != 1 || payload.ExcludeGlobs[0] != "vendor/**" {
			t.Fatalf("unexpected exclude globs: %v", payload.ExcludeGlobs)
		}
		if payload.MaxBlobSize == nil || *payload.MaxBlobSize != 1024 {
			t.Fatalf("unexpected max blob size: %v", payload.MaxBlobSize)
		}
		if payload.Archive == nil || payload.Archive.Prefix != "repo/" {
			t.Fatalf("unexpected archive prefix")
		}
		w.Header().Set("Content-Type", "application/gzip")
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}
	maxBlobSize := int64(1024)

	resp, err := repo.ArchiveStream(nil, ArchiveOptions{
		Ref:           "main",
		IncludeGlobs:  []string{"README.md"},
		ExcludeGlobs:  []string{"vendor/**"},
		MaxBlobSize:   &maxBlobSize,
		ArchivePrefix: "repo/",
	})
	if err != nil {
		t.Fatalf("archive stream error: %v", err)
	}
	_ = resp.Body.Close()
}

func TestListCommitsDateParsing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/commits" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commits":[{"sha":"abc123","parent_shas":["def456","789abc"],"message":"feat: add endpoint","author_name":"Jane Doe","author_email":"jane@example.com","committer_name":"Jane Doe","committer_email":"jane@example.com","date":"2024-01-15T14:32:18Z"}],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.ListCommits(nil, ListCommitsOptions{})
	if err != nil {
		t.Fatalf("list commits error: %v", err)
	}
	if len(result.Commits) != 1 {
		t.Fatalf("expected one commit")
	}
	commit := result.Commits[0]
	if !reflect.DeepEqual([]string{"def456", "789abc"}, commit.ParentSHAs) {
		t.Fatalf("unexpected parent SHAs: %#v", commit.ParentSHAs)
	}
	if commit.RawDate != "2024-01-15T14:32:18Z" {
		t.Fatalf("unexpected raw date")
	}
	if commit.Date.IsZero() {
		t.Fatalf("expected parsed date")
	}
}

func TestListBranchesEphemeralQueryParam(t *testing.T) {
	var rawQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/branches" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		rawQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"branches":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err = repo.ListBranches(nil, ListBranchesOptions{Ephemeral: boolPtr(true)}); err != nil {
		t.Fatalf("list branches error: %v", err)
	}
	if !strings.Contains(rawQuery, "ephemeral=true") {
		t.Fatalf("expected ephemeral=true in query, got %q", rawQuery)
	}
}

func TestListCommitsEphemeralQueryParam(t *testing.T) {
	var rawQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/commits" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		rawQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commits":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err = repo.ListCommits(nil, ListCommitsOptions{Branch: "feature", Ephemeral: boolPtr(true)}); err != nil {
		t.Fatalf("list commits error: %v", err)
	}
	if !strings.Contains(rawQuery, "ephemeral=true") {
		t.Fatalf("expected ephemeral=true in query, got %q", rawQuery)
	}
	if !strings.Contains(rawQuery, "branch=feature") {
		t.Fatalf("expected branch=feature in query, got %q", rawQuery)
	}
}

func TestListCommitsUserAgentHeader(t *testing.T) {
	var headerAgent string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/commits" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		headerAgent = r.Header.Get("Code-Storage-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commits":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, err = repo.ListCommits(nil, ListCommitsOptions{})
	if err != nil {
		t.Fatalf("list commits error: %v", err)
	}
	if headerAgent == "" || !strings.Contains(headerAgent, "code-storage-go-sdk/") {
		t.Fatalf("missing Code-Storage-Agent header")
	}
}

func TestGetCommit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/commit" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("sha"); got != "abc123" {
			t.Fatalf("unexpected sha query: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commit":{"sha":"abc123","parent_shas":["def456"],"message":"feat: add endpoint","author_name":"Jane Doe","author_email":"jane@example.com","committer_name":"Jane Doe","committer_email":"jane@example.com","date":"2024-01-15T14:32:18Z","signature":"-----BEGIN PGP SIGNATURE-----\nABC\n-----END PGP SIGNATURE-----\n","payload":"tree deadbeef\nauthor Jane Doe <jane@example.com> 1700000000 +0000\n"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.GetCommit(nil, GetCommitOptions{SHA: "abc123"})
	if err != nil {
		t.Fatalf("get commit error: %v", err)
	}
	if result.Commit.SHA != "abc123" {
		t.Fatalf("unexpected sha: %q", result.Commit.SHA)
	}
	if !reflect.DeepEqual([]string{"def456"}, result.Commit.ParentSHAs) {
		t.Fatalf("unexpected parent SHAs: %#v", result.Commit.ParentSHAs)
	}
	if result.Commit.Message != "feat: add endpoint" {
		t.Fatalf("unexpected message: %q", result.Commit.Message)
	}
	if result.Commit.AuthorName != "Jane Doe" || result.Commit.AuthorEmail != "jane@example.com" {
		t.Fatalf("unexpected author: %+v", result.Commit)
	}
	if result.Commit.RawDate != "2024-01-15T14:32:18Z" || result.Commit.Date.IsZero() {
		t.Fatalf("unexpected date: %+v", result.Commit)
	}
	if !strings.Contains(result.Commit.Signature, "BEGIN PGP SIGNATURE") {
		t.Fatalf("unexpected signature: %q", result.Commit.Signature)
	}
	if !strings.HasPrefix(result.Commit.Payload, "tree deadbeef") {
		t.Fatalf("unexpected payload: %q", result.Commit.Payload)
	}
}

func TestGetCommitUnsigned(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"commit":{"sha":"abc123","parent_shas":[],"message":"chore: noop","author_name":"Jane Doe","author_email":"jane@example.com","committer_name":"Jane Doe","committer_email":"jane@example.com","date":"2024-01-15T14:32:18Z"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.GetCommit(nil, GetCommitOptions{SHA: "abc123"})
	if err != nil {
		t.Fatalf("get commit error: %v", err)
	}
	if result.Commit.Signature != "" || result.Commit.Payload != "" {
		t.Fatalf("expected empty signature/payload for unsigned commit, got %+v", result.Commit)
	}
	if result.Commit.ParentSHAs == nil || len(result.Commit.ParentSHAs) != 0 {
		t.Fatalf("expected non-nil empty parent SHAs for root commit, got %#v", result.Commit.ParentSHAs)
	}
}

func TestGetCommitRequiresSHA(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: "https://example.invalid"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.GetCommit(nil, GetCommitOptions{}); err == nil {
		t.Fatalf("expected error for empty sha")
	}
}

func intPtr(value int) *int {
	return &value
}

func TestBlame(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos/blame" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if got := q.Get("path"); got != "src/x.go" {
			t.Fatalf("unexpected path query: %q", got)
		}
		if got := q.Get("ref"); got != "main" {
			t.Fatalf("unexpected ref query: %q", got)
		}
		if got := q["range"]; len(got) != 2 || got[0] != "10,20" || got[1] != "/getUser/,+30" {
			t.Fatalf("unexpected range query: %v", got)
		}
		if got := q.Get("detect_moves"); got != "true" {
			t.Fatalf("unexpected detect_moves query: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"ref": "main",
			"path": "src/x.go",
			"commit_sha": "aaa111",
			"lines": [
				{"line_number": 10, "commit_sha": "bbb222", "original_line_number": 5, "original_path": "src/x.go", "previous_commit_sha": "zzz000", "author_name": "Alice", "author_email": "alice@example.com", "author_time": "2024-01-15T14:32:18Z", "committer_name": "Alice", "committer_email": "alice@example.com", "committer_time": "2024-01-15T14:32:18Z", "summary": "init"},
				{"line_number": 11, "commit_sha": "ccc333", "original_line_number": 11, "original_path": "src/old.go", "author_name": "Bob", "author_email": "bob@example.com", "author_time": "2024-02-20T09:00:00Z", "committer_name": "Bob", "committer_email": "bob@example.com", "committer_time": "2024-02-20T09:00:00Z", "summary": "fix"}
			]
		}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.GetBlame(nil, BlameOptions{
		Path:        "src/x.go",
		Ref:         "main",
		Ranges:      []string{"10,20", "/getUser/,+30"},
		DetectMoves: true,
	})
	if err != nil {
		t.Fatalf("blame error: %v", err)
	}
	if result.Ref != "main" || result.Path != "src/x.go" || result.CommitSHA != "aaa111" {
		t.Fatalf("unexpected top-level fields: %+v", result)
	}
	if len(result.Lines) != 2 {
		t.Fatalf("unexpected line count: %d", len(result.Lines))
	}
	first := result.Lines[0]
	if first.CommitSHA != "bbb222" || first.LineNumber != 10 {
		t.Fatalf("unexpected first line: %+v", first)
	}
	if first.AuthorName != "Alice" || first.PreviousCommitSHA != "zzz000" {
		t.Fatalf("unexpected first-line author metadata: %+v", first)
	}
	if first.AuthorTime.IsZero() || first.RawAuthorTime != "2024-01-15T14:32:18Z" {
		t.Fatalf("unexpected first-line author time: %+v", first)
	}
	second := result.Lines[1]
	if second.OriginalPath != "src/old.go" {
		t.Fatalf("unexpected original_path: %q", second.OriginalPath)
	}
	if second.PreviousCommitSHA != "" {
		t.Fatalf("expected empty previous_commit_sha on second line, got %q", second.PreviousCommitSHA)
	}
	if second.AuthorName != "Bob" {
		t.Fatalf("unexpected second-line author: %q", second.AuthorName)
	}
}

func TestBlameOmitsEmptyParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("path") != "src/x.go" {
			t.Fatalf("expected path query")
		}
		for _, key := range []string{"ref", "ephemeral", "range", "detect_moves"} {
			if _, ok := q[key]; ok {
				t.Fatalf("unexpected %q in query: %v", key, q.Get(key))
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ref":"main","path":"src/x.go","commit_sha":"sha","lines":[]}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.GetBlame(nil, BlameOptions{Path: "src/x.go"}); err != nil {
		t.Fatalf("blame error: %v", err)
	}
}

func TestBlameRequiresPath(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: "https://example.invalid"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	if _, err := repo.GetBlame(nil, BlameOptions{}); err == nil {
		t.Fatalf("expected error for empty path")
	}
}
