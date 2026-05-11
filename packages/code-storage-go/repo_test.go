package storage

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
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

func TestMergeRequestAndResponse(t *testing.T) {
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

func TestMergeOmitsOptionalFields(t *testing.T) {
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
		if q.Get("sha") != "abc" || q.Get("baseSha") != "base" {
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

	result, err := repo.GetCommitDiff(nil, GetCommitDiffOptions{SHA: "abc", BaseSHA: "base"})
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
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != string(PermissionGitWrite) {
			t.Fatalf("unexpected scopes: %#v", claims["scopes"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"feature/old-onboarding","message":"branch deleted"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	result, err := repo.DeleteBranch(nil, DeleteBranchOptions{Name: "feature/old-onboarding"})
	if err != nil {
		t.Fatalf("delete branch error: %v", err)
	}
	if result.Name != "feature/old-onboarding" || result.Message != "branch deleted" {
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
		_, _ = w.Write([]byte(`{"commits":[{"sha":"abc123","message":"feat: add endpoint","author_name":"Jane Doe","author_email":"jane@example.com","committer_name":"Jane Doe","committer_email":"jane@example.com","date":"2024-01-15T14:32:18Z"}],"has_more":false}`))
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
		_, _ = w.Write([]byte(`{"commit":{"sha":"abc123","message":"feat: add endpoint","author_name":"Jane Doe","author_email":"jane@example.com","committer_name":"Jane Doe","committer_email":"jane@example.com","date":"2024-01-15T14:32:18Z"}}`))
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
	if result.Commit.Message != "feat: add endpoint" {
		t.Fatalf("unexpected message: %q", result.Commit.Message)
	}
	if result.Commit.AuthorName != "Jane Doe" || result.Commit.AuthorEmail != "jane@example.com" {
		t.Fatalf("unexpected author: %+v", result.Commit)
	}
	if result.Commit.RawDate != "2024-01-15T14:32:18Z" || result.Commit.Date.IsZero() {
		t.Fatalf("unexpected date: %+v", result.Commit)
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
