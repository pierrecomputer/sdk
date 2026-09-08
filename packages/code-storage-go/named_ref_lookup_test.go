package storage

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetBranchRequestAndResult(t *testing.T) {
	tests := []struct {
		name           string
		ephemeral      *bool
		expectedQuery  string
		responseBranch string
	}{
		{
			name:           "true",
			ephemeral:      boolPtr(true),
			expectedQuery:  "ephemeral=true&name=attempt%2F7",
			responseBranch: "attempt/7",
		},
		{
			name:           "false",
			ephemeral:      boolPtr(false),
			expectedQuery:  "ephemeral=false&name=attempt%2F7",
			responseBranch: "attempt/7",
		},
		{
			name:           "omitted",
			expectedQuery:  "name=attempt%2F7",
			responseBranch: "attempt/7",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					t.Fatalf("unexpected method: %s", r.Method)
				}
				if r.URL.Path != "/api/repos/owner/repo/branch" {
					t.Fatalf("unexpected path: %s", r.URL.Path)
				}
				if r.URL.RawQuery != test.expectedQuery {
					t.Fatalf("unexpected query: %s", r.URL.RawQuery)
				}
				if strings.Contains(r.URL.RawQuery, "%252F") {
					t.Fatalf("name was encoded twice: %s", r.URL.RawQuery)
				}
				assertGitReadScope(t, r)
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"branch":{"name":"attempt/7","head_sha":"abc123","created_at":"2026-08-29T10:00:00Z","cursor":"private-cursor"}}`))
			}))
			defer server.Close()

			client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
			if err != nil {
				t.Fatalf("client error: %v", err)
			}
			repo := &Repo{ID: "owner/repo", DefaultBranch: "main", client: client}

			result, err := repo.GetBranch(context.Background(), GetBranchOptions{
				Name:      "attempt/7",
				Ephemeral: test.ephemeral,
			})
			if err != nil {
				t.Fatalf("get branch error: %v", err)
			}
			expected := GetBranchResult{
				Name:      test.responseBranch,
				HeadSHA:   "abc123",
				CreatedAt: "2026-08-29T10:00:00Z",
			}
			if result != expected {
				t.Fatalf("unexpected result: %+v", result)
			}
		})
	}
}

func TestGetTagRequestAndResult(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/repos/owner/repo/tag" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.RawQuery != "name=releases%2Fv1.4.0" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		if strings.Contains(r.URL.RawQuery, "%252F") {
			t.Fatalf("name was encoded twice: %s", r.URL.RawQuery)
		}
		assertGitReadScope(t, r)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag":{"name":"releases/v1.4.0","sha":"commit123","object_sha":"tag-object-123","cursor":"private-cursor"}}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	repo := &Repo{ID: "owner/repo", DefaultBranch: "main", client: client}

	result, err := repo.GetTag(context.Background(), GetTagOptions{Name: "releases/v1.4.0"})
	if err != nil {
		t.Fatalf("get tag error: %v", err)
	}
	if result != (GetTagResult{Name: "releases/v1.4.0", SHA: "commit123"}) {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestNamedRefLookupNotFound(t *testing.T) {
	for _, resource := range []string{"branch", "tag"} {
		t.Run(resource, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"error":"ref not found"}`))
			}))
			defer server.Close()

			client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
			if err != nil {
				t.Fatalf("client error: %v", err)
			}
			repo := &Repo{ID: "repo", DefaultBranch: "main", client: client}

			if resource == "branch" {
				_, err = repo.GetBranch(context.Background(), GetBranchOptions{Name: "missing/ref"})
			} else {
				_, err = repo.GetTag(context.Background(), GetTagOptions{Name: "missing/ref"})
			}
			var apiErr *APIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("expected APIError, got %T", err)
			}
			if apiErr.Status != http.StatusNotFound || apiErr.Message != "ref not found" {
				t.Fatalf("unexpected error: %+v", apiErr)
			}
		})
	}
}

func assertGitReadScope(t *testing.T, r *http.Request) {
	t.Helper()
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	claims := parseJWTFromToken(t, token)
	scopes, ok := claims["scopes"].([]interface{})
	if !ok || len(scopes) != 1 || scopes[0] != "git:read" {
		t.Fatalf("unexpected scopes: %v", claims["scopes"])
	}
}
