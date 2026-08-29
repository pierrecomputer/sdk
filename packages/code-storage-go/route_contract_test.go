package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type routeContractRequest struct {
	method string
	path   string
	query  url.Values
	body   []byte
}

func TestPreferredRESTRouteContract(t *testing.T) {
	ctx := context.Background()
	signature := CommitSignature{Name: "Route Test", Email: "route@example.test"}

	tests := []struct {
		name   string
		method string
		path   string
		query  url.Values
		body   map[string]interface{}
		noBody bool
		invoke func(*Client, *Repo)
	}{
		{name: "CreateRepo", method: "POST", path: "/api/repos", invoke: func(c *Client, _ *Repo) { _, _ = c.CreateRepo(ctx, CreateRepoOptions{ID: "owner/name"}) }},
		{name: "ListRepos", method: "GET", path: "/api/repos", invoke: func(c *Client, _ *Repo) { _, _ = c.ListRepos(ctx, ListReposOptions{}) }},
		{name: "FindOne", method: "GET", path: "/api/repos/owner%2Fname", invoke: func(c *Client, _ *Repo) { _, _ = c.FindOne(ctx, FindOneOptions{ID: "owner/name"}) }},
		{name: "DeleteRepo", method: "DELETE", path: "/api/repos/owner%2Fname", invoke: func(c *Client, _ *Repo) { _, _ = c.DeleteRepo(ctx, DeleteRepoOptions{ID: "owner/name"}) }},
		{name: "CreateGitCredential", method: "POST", path: "/api/repos/owner%2Fname/git-credentials", invoke: func(c *Client, _ *Repo) {
			_, _ = c.CreateGitCredential(ctx, CreateGitCredentialOptions{RepoName: "owner/name", Password: "secret"})
		}},
		{name: "UpdateGitCredential", method: "PUT", path: "/api/repos/owner%2Fname/git-credentials/credential%2Fid", invoke: func(c *Client, _ *Repo) {
			_, _ = c.UpdateGitCredential(ctx, UpdateGitCredentialOptions{RepoName: "owner/name", ID: "credential/id", Password: "secret"})
		}},
		{name: "DeleteGitCredential", method: "DELETE", path: "/api/repos/owner%2Fname/git-credentials/credential%2Fid", noBody: true, invoke: func(c *Client, _ *Repo) {
			_ = c.DeleteGitCredential(ctx, DeleteGitCredentialOptions{RepoName: "owner/name", ID: "credential/id"})
		}},
		{name: "FileStream", method: "GET", path: "/api/repos/owner%2Fname/file", invoke: func(_ *Client, r *Repo) {
			response, _ := r.FileStream(ctx, GetFileOptions{Path: "README.md"})
			if response != nil {
				_ = response.Body.Close()
			}
		}},
		{name: "HeadFile", method: "HEAD", path: "/api/repos/owner%2Fname/file", invoke: func(_ *Client, r *Repo) { _, _ = r.HeadFile(ctx, HeadFileOptions{Path: "README.md"}) }},
		{name: "ArchiveStream", method: "POST", path: "/api/repos/owner%2Fname/archive", invoke: func(_ *Client, r *Repo) {
			response, _ := r.ArchiveStream(ctx, ArchiveOptions{})
			if response != nil {
				_ = response.Body.Close()
			}
		}},
		{name: "ListFiles", method: "GET", path: "/api/repos/owner%2Fname/files", invoke: func(_ *Client, r *Repo) { _, _ = r.ListFiles(ctx, ListFilesOptions{}) }},
		{name: "ListFilesWithMetadata", method: "GET", path: "/api/repos/owner%2Fname/files/metadata", invoke: func(_ *Client, r *Repo) { _, _ = r.ListFilesWithMetadata(ctx, ListFilesWithMetadataOptions{}) }},
		{name: "ListBranches", method: "GET", path: "/api/repos/owner%2Fname/branches", invoke: func(_ *Client, r *Repo) { _, _ = r.ListBranches(ctx, ListBranchesOptions{}) }},
		{name: "ListTags", method: "GET", path: "/api/repos/owner%2Fname/tags", invoke: func(_ *Client, r *Repo) { _, _ = r.ListTags(ctx, ListTagsOptions{}) }},
		{name: "ListCommits", method: "GET", path: "/api/repos/owner%2Fname/commits", invoke: func(_ *Client, r *Repo) { _, _ = r.ListCommits(ctx, ListCommitsOptions{}) }},
		{name: "GetCommit", method: "GET", path: "/api/repos/owner%2Fname/commit", invoke: func(_ *Client, r *Repo) { _, _ = r.GetCommit(ctx, GetCommitOptions{Ref: "main"}) }},
		{name: "GetBlame", method: "GET", path: "/api/repos/owner%2Fname/blame", invoke: func(_ *Client, r *Repo) { _, _ = r.GetBlame(ctx, BlameOptions{Path: "README.md"}) }},
		{name: "GetNote", method: "GET", path: "/api/repos/owner%2Fname/notes", invoke: func(_ *Client, r *Repo) { _, _ = r.GetNote(ctx, GetNoteOptions{ObjectRef: "main"}) }},
		{name: "CreateNote", method: "POST", path: "/api/repos/owner%2Fname/notes", invoke: func(_ *Client, r *Repo) { _, _ = r.CreateNote(ctx, CreateNoteOptions{ObjectRef: "main", Note: "note"}) }},
		{name: "AppendNote", method: "POST", path: "/api/repos/owner%2Fname/notes", invoke: func(_ *Client, r *Repo) { _, _ = r.AppendNote(ctx, AppendNoteOptions{ObjectRef: "main", Note: "note"}) }},
		{name: "DeleteNote", method: "DELETE", path: "/api/repos/owner%2Fname/notes", invoke: func(_ *Client, r *Repo) { _, _ = r.DeleteNote(ctx, DeleteNoteOptions{ObjectRef: "main"}) }},
		{name: "ListNotesRefs", method: "GET", path: "/api/repos/owner%2Fname/notes/refs", invoke: func(_ *Client, r *Repo) { _, _ = r.ListNotesRefs(ctx, ListNotesRefsOptions{}) }},
		{name: "GetBranchDiff", method: "GET", path: "/api/repos/owner%2Fname/branches/diff", query: url.Values{"branch": {"feature"}, "base": {"main"}}, invoke: func(_ *Client, r *Repo) {
			_, _ = r.GetBranchDiff(ctx, GetBranchDiffOptions{Branch: "feature", Base: "main"})
		}},
		{name: "GetCommitDiff", method: "GET", path: "/api/repos/owner%2Fname/diff", invoke: func(_ *Client, r *Repo) { _, _ = r.GetCommitDiff(ctx, GetCommitDiffOptions{Ref: "main"}) }},
		{name: "Grep", method: "POST", path: "/api/repos/owner%2Fname/grep", invoke: func(_ *Client, r *Repo) { _, _ = r.Grep(ctx, GrepOptions{Query: GrepQuery{Pattern: "TODO"}}) }},
		{name: "PullUpstream", method: "POST", path: "/api/repos/owner%2Fname/pull-upstream", body: map[string]interface{}{"ref": "main"}, invoke: func(_ *Client, r *Repo) { _ = r.PullUpstream(ctx, PullUpstreamOptions{Ref: "main"}) }},
		{name: "CreateBranch", method: "POST", path: "/api/repos/owner%2Fname/branches/create", invoke: func(_ *Client, r *Repo) {
			_, _ = r.CreateBranch(ctx, CreateBranchOptions{BaseRef: "main", TargetBranch: "next"})
		}},
		{name: "DeleteBranch", method: "DELETE", path: "/api/repos/owner%2Fname/branches", invoke: func(_ *Client, r *Repo) { _, _ = r.DeleteBranch(ctx, DeleteBranchOptions{TargetBranch: "next"}) }},
		{name: "PreviewMerge", method: "GET", path: "/api/repos/owner%2Fname/merge/preview", invoke: func(_ *Client, r *Repo) {
			_, _ = r.PreviewMerge(ctx, PreviewMergeOptions{SourceBranch: "feature", TargetBranch: "main"})
		}},
		{name: "Merge", method: "POST", path: "/api/repos/owner%2Fname/merge", invoke: func(_ *Client, r *Repo) {
			_, _ = r.Merge(ctx, MergeOptions{SourceRef: "feature", TargetBranch: "main", Strategy: MergeStrategyFFOnly})
		}},
		{name: "CreateTag", method: "POST", path: "/api/repos/owner%2Fname/tags", invoke: func(_ *Client, r *Repo) { _, _ = r.CreateTag(ctx, CreateTagOptions{Name: "v1", Ref: "main"}) }},
		{name: "DeleteTag", method: "DELETE", path: "/api/repos/owner%2Fname/tags/release%2Fv1", noBody: true, invoke: func(_ *Client, r *Repo) { _, _ = r.DeleteTag(ctx, DeleteTagOptions{Name: "release/v1"}) }},
		{name: "RestoreCommit", method: "POST", path: "/api/repos/owner%2Fname/restore-commit", invoke: func(_ *Client, r *Repo) {
			_, _ = r.RestoreCommit(ctx, RestoreCommitOptions{TargetBranch: "main", BaseRef: "HEAD~1", Author: signature})
		}},
		{name: "CreateCommit", method: "POST", path: "/api/repos/owner%2Fname/commit-pack", invoke: func(_ *Client, r *Repo) {
			builder, err := r.CreateCommit(CommitOptions{TargetBranch: "main", CommitMessage: "test route", Author: signature})
			if err == nil {
				_, _ = builder.AddFileFromString("README.md", "content", nil).Send(ctx)
			}
		}},
		{name: "CreateCommitFromDiff", method: "POST", path: "/api/repos/owner%2Fname/diff-commit", invoke: func(_ *Client, r *Repo) {
			_, _ = r.CreateCommitFromDiff(ctx, CommitFromDiffOptions{TargetBranch: "main", CommitMessage: "test route", Author: signature, Diff: strings.NewReader("diff --git a/README.md b/README.md")})
		}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var captured routeContractRequest
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				captured = routeContractRequest{
					method: r.Method,
					path:   r.URL.EscapedPath(),
					query:  r.URL.Query(),
					body:   body,
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{}`))
			}))
			defer server.Close()

			client, err := NewClient(Options{Name: "route-contract", Token: "test-token", APIBaseURL: server.URL})
			if err != nil {
				t.Fatalf("new client: %v", err)
			}
			repo, err := client.Repo(RepoOptions{ID: "owner/name"})
			if err != nil {
				t.Fatalf("repo: %v", err)
			}

			test.invoke(client, repo)
			if captured.method == "" {
				t.Fatal("method did not send a request")
			}
			if captured.method != test.method || captured.path != test.path {
				t.Fatalf("request = %s %s, want %s %s", captured.method, captured.path, test.method, test.path)
			}
			for name, values := range test.query {
				if got := captured.query[name]; strings.Join(got, "\x00") != strings.Join(values, "\x00") {
					t.Fatalf("query %s = %v, want %v", name, got, values)
				}
			}
			if test.body != nil {
				var body map[string]interface{}
				if err := json.Unmarshal(captured.body, &body); err != nil {
					t.Fatalf("decode body: %v", err)
				}
				for name, value := range test.body {
					if body[name] != value {
						t.Fatalf("body %s = %#v, want %#v", name, body[name], value)
					}
				}
			}
			if test.noBody && len(bytes.TrimSpace(captured.body)) != 0 {
				t.Fatalf("body = %q, want empty", captured.body)
			}
		})
	}
}
