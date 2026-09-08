package storage

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type capturedStandardRequest struct {
	query url.Values
	body  map[string]interface{}
}

func TestStandardVocabularyRequests(t *testing.T) {
	captured := map[string][]capturedStandardRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := capturedStandardRequest{query: r.URL.Query()}
		body, _ := io.ReadAll(r.Body)
		if len(bytes.TrimSpace(body)) > 0 {
			if r.URL.Path == "/api/v1/repos/commit-pack" || r.URL.Path == "/api/v1/repos/diff-commit" {
				var envelope map[string]map[string]interface{}
				_ = json.Unmarshal(bytes.Split(body, []byte("\n"))[0], &envelope)
				request.body = envelope["metadata"]
			} else {
				_ = json.Unmarshal(body, &request.body)
			}
		}
		key := r.Method + " " + r.URL.Path
		captured[key] = append(captured[key], request)
		w.Header().Set("Content-Type", "application/json")

		switch key {
		case "GET /api/v1/repos/commits":
			_, _ = w.Write([]byte(`{"commits":[],"has_more":false}`))
		case "GET /api/v1/repos/commit":
			_, _ = w.Write([]byte(`{"commit":{"sha":"sha","parent_shas":[],"message":"message","author_name":"A","author_email":"a@example.com","committer_name":"A","committer_email":"a@example.com","date":"2026-08-28T00:00:00Z"}}`))
		case "GET /api/v1/repos/diff":
			_, _ = w.Write([]byte(`{"sha":"sha","base_sha":"base","stats":{},"files":[],"filtered_files":[]}`))
		case "GET /api/v1/repos/notes":
			_, _ = w.Write([]byte(`{"sha":"sha","note":"note","ref_sha":"notes-sha"}`))
		case "POST /api/v1/repos/merge":
			_, _ = w.Write([]byte(`{"result":"fast_forward","commit_sha":"sha","tree_sha":"tree","source":{"ref":"source","ephemeral":false,"sha":"sha"},"target":{"branch":"main","ephemeral":false,"old_sha":"old","new_sha":"sha"},"promoted_commits":1}`))
		case "POST /api/v1/repos/tags":
			_, _ = w.Write([]byte(`{"name":"v1","sha":"sha","message":"created"}`))
		case "DELETE /api/v1/repos/branches":
			_, _ = w.Write([]byte(`{"target_branch":"branch","message":"deleted","ephemeral":false}`))
		case "POST /api/v1/repos/notes", "DELETE /api/v1/repos/notes":
			_, _ = w.Write([]byte(`{"sha":"sha","notes_ref":"refs/notes/reviews","new_ref_sha":"notes-sha","result":{"success":true,"status":"ok"}}`))
		case "POST /api/v1/repos/restore-commit":
			_, _ = w.Write([]byte(`{"commit":{"commit_sha":"sha","tree_sha":"tree","target_branch":"main","pack_bytes":1},"result":{"target_branch":"main","old_sha":"old","new_sha":"sha","success":true,"status":"ok"}}`))
		case "POST /api/v1/repos/commit-pack", "POST /api/v1/repos/diff-commit":
			_, _ = w.Write([]byte(`{"commit":{"commit_sha":"sha","tree_sha":"tree","target_branch":"main","pack_bytes":1,"blob_count":0},"result":{"target_branch":"main","old_sha":"old","new_sha":"sha","success":true,"status":"ok"}}`))
		default:
			t.Fatalf("unexpected request: %s", key)
		}
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

	_, _ = repo.ListCommits(nil, ListCommitsOptions{Ref: "preferred", Branch: "legacy"})
	_, _ = repo.GetCommit(nil, GetCommitOptions{Ref: "preferred", SHA: "legacy"})
	_, _ = repo.GetCommitDiff(nil, GetCommitDiffOptions{
		Ref: "preferred", SHA: "legacy", BaseRef: "preferred-base", BaseSHA: "legacy-base",
		RefIsEphemeral: boolPtr(false), BaseIsEphemeral: boolPtr(false), GitApplyCompatible: true,
	})
	_, _ = repo.GetNote(nil, GetNoteOptions{
		ObjectRef: "preferred", SHA: "legacy", NotesRef: "preferred-notes", Ref: "legacy-notes",
	})
	_, _ = repo.Merge(nil, MergeOptions{
		SourceRef: "preferred", SourceBranch: "legacy", TargetBranch: "main", Strategy: MergeStrategyFFOnly,
	})
	_, _ = repo.CreateTag(nil, CreateTagOptions{Name: "v1", Ref: "preferred", Target: "legacy"})
	_, _ = repo.DeleteBranch(nil, DeleteBranchOptions{TargetBranch: "preferred", Name: "legacy"})
	_, _ = repo.CreateNote(nil, CreateNoteOptions{
		ObjectRef: "preferred", SHA: "legacy", Note: "note", NotesRef: "preferred-notes", Ref: "legacy-notes",
		ExpectedNotesRefSHA: "preferred-guard", ExpectedRefSHA: "legacy-guard",
	})
	_, _ = repo.AppendNote(nil, AppendNoteOptions{ObjectRef: "object", Note: "note"})
	_, _ = repo.DeleteNote(nil, DeleteNoteOptions{ObjectRef: "object"})
	_, _ = repo.RestoreCommit(nil, RestoreCommitOptions{
		TargetBranch: "main", BaseRef: "preferred", TargetCommitSHA: "legacy",
		ExpectedTargetSHA: "preferred-guard", ExpectedHeadSHA: "legacy-guard",
		Author: CommitSignature{Name: "Author", Email: "author@example.com"},
	})

	preferredFalse := false
	builder, _ := repo.CreateCommit(CommitOptions{
		TargetBranch: "main", CommitMessage: "message", Author: CommitSignature{Name: "Author", Email: "author@example.com"},
		ExpectedTargetSHA: "preferred-guard", ExpectedHeadSHA: "legacy-guard",
		BaseBranch: "base", TargetIsEphemeral: &preferredFalse, Ephemeral: true,
		BaseIsEphemeral: &preferredFalse, EphemeralBase: true,
	})
	_, _ = builder.Send(nil)
	_, _ = repo.CreateCommitFromDiff(nil, CommitFromDiffOptions{
		TargetBranch: "main", CommitMessage: "message", Author: CommitSignature{Name: "Author", Email: "author@example.com"},
		Diff: strings.NewReader("diff"), ExpectedTargetSHA: "preferred-guard", ExpectedHeadSHA: "legacy-guard",
		BaseBranch: "base", TargetIsEphemeral: &preferredFalse, Ephemeral: true,
		BaseIsEphemeral: &preferredFalse, EphemeralBase: true,
	})

	assertQuery := func(key string, expected url.Values) {
		t.Helper()
		if got := captured[key][0].query; got.Encode() != expected.Encode() {
			t.Fatalf("%s query = %v, want %v", key, got, expected)
		}
	}
	assertQuery("GET /api/v1/repos/commits", url.Values{"ref": {"preferred"}})
	assertQuery("GET /api/v1/repos/commit", url.Values{"ref": {"preferred"}})
	assertQuery("GET /api/v1/repos/diff", url.Values{
		"ref": {"preferred"}, "base_ref": {"preferred-base"}, "ref_is_ephemeral": {"false"},
		"base_is_ephemeral": {"false"}, "git_apply_compatible": {"true"},
	})
	assertQuery("GET /api/v1/repos/notes", url.Values{"object_ref": {"preferred"}, "notes_ref": {"preferred-notes"}})

	assertBodyField(t, captured["POST /api/v1/repos/merge"][0].body, "source_ref", "preferred", "source_branch")
	assertBodyField(t, captured["POST /api/v1/repos/tags"][0].body, "ref", "preferred", "target")
	assertBodyField(t, captured["DELETE /api/v1/repos/branches"][0].body, "target_branch", "preferred", "name")
	assertBodyField(t, captured["POST /api/v1/repos/notes"][0].body, "object_ref", "preferred", "sha")
	assertBodyField(t, captured["POST /api/v1/repos/notes"][0].body, "notes_ref", "preferred-notes", "ref")
	assertBodyField(t, captured["POST /api/v1/repos/notes"][0].body, "expected_notes_ref_sha", "preferred-guard", "expected_ref_sha")
	assertBodyField(t, captured["POST /api/v1/repos/notes"][1].body, "object_ref", "object", "sha")
	assertBodyField(t, captured["DELETE /api/v1/repos/notes"][0].body, "object_ref", "object", "sha")
	assertBodyField(t, captured["POST /api/v1/repos/restore-commit"][0].body["metadata"].(map[string]interface{}), "base_ref", "preferred", "target_commit_sha")
	assertBodyField(t, captured["POST /api/v1/repos/restore-commit"][0].body["metadata"].(map[string]interface{}), "expected_target_sha", "preferred-guard", "expected_head_sha")

	for _, key := range []string{"POST /api/v1/repos/commit-pack", "POST /api/v1/repos/diff-commit"} {
		body := captured[key][0].body
		assertBodyField(t, body, "expected_target_sha", "preferred-guard", "expected_head_sha")
		if body["target_is_ephemeral"] != false || body["base_is_ephemeral"] != false {
			t.Fatalf("%s did not preserve preferred false flags: %#v", key, body)
		}
		if _, ok := body["ephemeral"]; ok {
			t.Fatalf("%s sent deprecated ephemeral", key)
		}
		if _, ok := body["ephemeral_base"]; ok {
			t.Fatalf("%s sent deprecated ephemeral_base", key)
		}
	}
}

func assertBodyField(t *testing.T, body map[string]interface{}, preferred string, value interface{}, deprecated string) {
	t.Helper()
	if body[preferred] != value {
		t.Fatalf("%s = %#v, want %#v", preferred, body[preferred], value)
	}
	if _, ok := body[deprecated]; ok {
		t.Fatalf("request sent deprecated field %s", deprecated)
	}
}

func TestStandardVocabularyCommitResponseAliases(t *testing.T) {
	for _, test := range []struct {
		name         string
		targetBranch string
		branch       string
		want         string
	}{
		{name: "standard only", targetBranch: "standard", want: "standard"},
		{name: "deprecated only", branch: "legacy", want: "legacy"},
		{name: "standard wins", targetBranch: "standard", branch: "legacy", want: "standard"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var ack commitPackAck
			ack.Commit.CommitSHA = "sha"
			ack.Commit.TreeSHA = "tree"
			ack.Commit.TargetBranch = "main"
			if test.targetBranch != "" {
				ack.Result.TargetBranch = &test.targetBranch
			}
			ack.Result.Branch = test.branch
			ack.Result.Success = true
			result, err := buildCommitResult(ack)
			if err != nil {
				t.Fatalf("build result: %v", err)
			}
			if result.RefUpdate.TargetBranch != test.want || result.RefUpdate.Branch != test.want {
				t.Fatalf("unexpected aliases: %#v", result.RefUpdate)
			}

			var restore restoreCommitAck
			restore.Commit.CommitSHA = "sha"
			restore.Commit.TreeSHA = "tree"
			restore.Commit.TargetBranch = "main"
			restore.Result.TargetBranch = ack.Result.TargetBranch
			restore.Result.Branch = test.branch
			restore.Result.Success = true
			restored, err := buildRestoreCommitResult(restore)
			if err != nil {
				t.Fatalf("build restore result: %v", err)
			}
			if restored.RefUpdate.TargetBranch != test.want || restored.RefUpdate.Branch != test.want {
				t.Fatalf("unexpected restore aliases: %#v", restored.RefUpdate)
			}
		})
	}
}

func TestStandardVocabularyResponseAliases(t *testing.T) {
	for _, test := range []struct {
		name              string
		includeStandard   bool
		includeDeprecated bool
		want              string
	}{
		{name: "standard only", includeStandard: true, want: "standard"},
		{name: "deprecated only", includeDeprecated: true, want: "legacy"},
		{name: "standard wins", includeStandard: true, includeDeprecated: true, want: "standard"},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				response := map[string]interface{}{}
				switch r.Method + " " + r.URL.Path {
				case "GET /api/v1/repos":
					repo := map[string]interface{}{"repo_id": "repo", "default_branch": "main", "created_at": ""}
					setVocabularyFields(repo, test.includeStandard, test.includeDeprecated, "repo_name", "url")
					response = map[string]interface{}{"repos": []interface{}{repo}, "has_more": false}
				case "GET /api/v1/repos/diff":
					response = map[string]interface{}{"sha": "sha", "base_sha": "base", "stats": map[string]interface{}{}, "files": []interface{}{}, "filtered_files": []interface{}{}}
				case "DELETE /api/v1/repos/branches":
					response = map[string]interface{}{"message": "deleted", "ephemeral": false}
					setVocabularyFields(response, test.includeStandard, test.includeDeprecated, "target_branch", "name")
				case "POST /api/v1/repos/merge":
					source := map[string]interface{}{"ephemeral": false, "sha": "sha"}
					setVocabularyFields(source, test.includeStandard, test.includeDeprecated, "ref", "branch")
					response = map[string]interface{}{
						"result": "fast_forward", "commit_sha": "sha", "tree_sha": "tree", "source": source,
						"target": map[string]interface{}{"branch": "main", "ephemeral": false, "old_sha": "old", "new_sha": "sha"}, "promoted_commits": 1,
					}
				case "POST /api/v1/repos/notes":
					response = map[string]interface{}{"sha": "sha", "new_ref_sha": "notes-sha", "result": map[string]interface{}{"success": true, "status": "ok"}}
					setVocabularyFields(response, test.includeStandard, test.includeDeprecated, "notes_ref", "target_ref")
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
				if err := json.NewEncoder(w).Encode(response); err != nil {
					t.Fatalf("encode response: %v", err)
				}
			}))
			defer server.Close()

			client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
			if err != nil {
				t.Fatalf("client error: %v", err)
			}
			repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

			listed, err := client.ListRepos(nil, ListReposOptions{})
			if err != nil {
				t.Fatalf("list repos: %v", err)
			}
			if listed.Repos[0].RepoName != test.want || listed.Repos[0].URL != test.want {
				t.Fatalf("unexpected repo aliases: %#v", listed.Repos[0])
			}
			diff, err := repo.GetCommitDiff(nil, GetCommitDiffOptions{Ref: "main"})
			if err != nil || diff.BaseSHA != "base" {
				t.Fatalf("unexpected diff result: %#v, %v", diff, err)
			}
			deleted, err := repo.DeleteBranch(nil, DeleteBranchOptions{TargetBranch: "branch"})
			if err != nil || deleted.TargetBranch != test.want || deleted.Name != test.want {
				t.Fatalf("unexpected delete aliases: %#v, %v", deleted, err)
			}
			merged, err := repo.Merge(nil, MergeOptions{SourceRef: "source", TargetBranch: "main", Strategy: MergeStrategyFFOnly})
			if err != nil || merged.Source.Ref != test.want || merged.Source.Branch != test.want {
				t.Fatalf("unexpected merge aliases: %#v, %v", merged.Source, err)
			}
			note, err := repo.CreateNote(nil, CreateNoteOptions{ObjectRef: "object", Note: "note"})
			if err != nil || note.NotesRef != test.want || note.TargetRef != test.want {
				t.Fatalf("unexpected note aliases: %#v, %v", note, err)
			}
		})
	}
}

func setVocabularyFields(body map[string]interface{}, standard bool, deprecated bool, standardName string, deprecatedName string) {
	if standard {
		body[standardName] = "standard"
	}
	if deprecated {
		body[deprecatedName] = "legacy"
	}
}
