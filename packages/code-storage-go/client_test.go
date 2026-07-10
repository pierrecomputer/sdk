package storage

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewClientValidation(t *testing.T) {
	_, err := NewClient(Options{})
	if err == nil || !strings.Contains(err.Error(), "requires a name") {
		t.Fatalf("expected validation error for missing name, got %v", err)
	}
	_, err = NewClient(Options{Name: "", Key: "test"})
	if err == nil {
		t.Fatalf("expected error for empty name")
	}
	_, err = NewClient(Options{Name: "test", Key: ""})
	if err == nil || !strings.Contains(err.Error(), "requires either a key or a token") {
		t.Fatalf("expected error for missing key and token, got %v", err)
	}
	_, err = NewClient(Options{Name: "test"})
	if err == nil || !strings.Contains(err.Error(), "requires either a key or a token") {
		t.Fatalf("expected error when neither key nor token provided, got %v", err)
	}
}

func TestNewClientWithToken(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Token: "my-pre-minted-jwt"})
	if err != nil {
		t.Fatalf("expected no error for token-only client, got %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil client")
	}
}

func TestNewClientWithTokenEmptyKey(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: "", Token: "my-pre-minted-jwt"})
	if err != nil {
		t.Fatalf("expected no error for token with empty key, got %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil client")
	}
}

func TestTokenSentVerbatim(t *testing.T) {
	expectedToken := "my-pre-minted-jwt-token-value"
	var receivedAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Token: expectedToken, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	expected := "Bearer " + expectedToken
	if receivedAuth != expected {
		t.Fatalf("expected Authorization header %q, got %q", expected, receivedAuth)
	}
}

func TestDefaultBaseURLs(t *testing.T) {
	api := DefaultAPIBaseURL("acme")
	if api != "https://api.acme.code.storage" {
		t.Fatalf("unexpected api url: %s", api)
	}
	storage := DefaultStorageBaseURL("acme")
	if storage != "acme.code.storage" {
		t.Fatalf("unexpected storage url: %s", storage)
	}
}

func TestCreateRepoDefaultBranch(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repos" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	if receivedBody["default_branch"] != "main" {
		t.Fatalf("expected default_branch main, got %#v", receivedBody["default_branch"])
	}
}

func TestCreateRepoForkBaseRepo(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: ForkBaseRepo{ID: "template", Ref: "main"},
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	baseRepo, ok := receivedBody["base_repo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected base_repo payload")
	}
	if baseRepo["provider"] != "code" {
		t.Fatalf("expected provider code")
	}
	if baseRepo["name"] != "template" {
		t.Fatalf("expected name template")
	}
	auth, ok := baseRepo["auth"].(map[string]interface{})
	if !ok || auth["token"] == "" {
		t.Fatalf("expected auth token")
	}
}

func TestCreateRepoGitHubBaseRepoDefaultBranch(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: GitHubBaseRepo{
			Owner:         "octocat",
			Name:          "hello-world",
			DefaultBranch: "main",
		},
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	baseRepo, ok := receivedBody["base_repo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected base_repo payload")
	}
	if baseRepo["provider"] != "github" {
		t.Fatalf("expected provider github")
	}
	if baseRepo["default_branch"] != "main" {
		t.Fatalf("expected default_branch main")
	}
	if receivedBody["default_branch"] != "main" {
		t.Fatalf("expected default_branch main in request")
	}
}

func TestCreateRepoGitHubBaseRepoPublicAuthType(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: GitHubBaseRepo{
			Owner: "octocat",
			Name:  "hello-world",
			Auth: &GitHubBaseRepoAuth{
				AuthType: GitHubBaseRepoAuthTypePublic,
			},
		},
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	baseRepo, ok := receivedBody["base_repo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected base_repo payload")
	}
	auth, ok := baseRepo["auth"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected auth payload")
	}
	if auth["auth_type"] != "public" {
		t.Fatalf("expected auth_type public, got %#v", auth["auth_type"])
	}
	if _, found := auth["token"]; found {
		t.Fatalf("did not expect auth token for public github auth mode")
	}
}

func TestCreateRepoGitHubBaseRepoCustomDefaultBranch(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: GitHubBaseRepo{
			Owner: "octocat",
			Name:  "hello-world",
		},
		DefaultBranch: "develop",
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	if receivedBody["default_branch"] != "develop" {
		t.Fatalf("expected default_branch develop in request")
	}
}

func TestCreateRepoForkBaseRepoTokenScopes(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: ForkBaseRepo{ID: "template", Ref: "develop"},
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	baseRepo, ok := receivedBody["base_repo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected base_repo payload")
	}
	auth, ok := baseRepo["auth"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected auth payload")
	}
	token, _ := auth["token"].(string)
	claims := parseJWTFromToken(t, token)
	if claims["repo"] != "template" {
		t.Fatalf("expected repo claim template")
	}
	scopes, ok := claims["scopes"].([]interface{})
	if !ok || len(scopes) != 1 || scopes[0] != "git:read" {
		t.Fatalf("expected git:read scope")
	}
}

func TestCreateRepoConflict(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{ID: "existing-repo"})
	if err == nil || !strings.Contains(err.Error(), "repository already exists") {
		t.Fatalf("expected repository already exists error, got %v", err)
	}
}

func TestListReposCursorLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("cursor") != "cursor-1" || q.Get("limit") != "25" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repos":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.ListRepos(nil, ListReposOptions{Cursor: "cursor-1", Limit: 25})
	if err != nil {
		t.Fatalf("list repos error: %v", err)
	}
}

func TestListReposScopes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		if claims["repo"] != "org" {
			t.Fatalf("expected repo org")
		}
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != "org:read" {
			t.Fatalf("expected org:read scope")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repos":[],"has_more":false}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.ListRepos(nil, ListReposOptions{})
	if err != nil {
		t.Fatalf("list repos error: %v", err)
	}
}

func TestFindOneReturnsRepo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/repo" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"default_branch":"develop"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.FindOne(nil, FindOneOptions{ID: "repo-1"})
	if err != nil {
		t.Fatalf("find one error: %v", err)
	}
	if repo == nil || repo.DefaultBranch != "develop" {
		t.Fatalf("unexpected repo result")
	}
}

func TestFindOneCreatedAt(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"default_branch":"main","created_at":"2024-06-15T12:00:00Z"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.FindOne(nil, FindOneOptions{ID: "repo-1"})
	if err != nil {
		t.Fatalf("find one error: %v", err)
	}
	if repo == nil {
		t.Fatalf("expected repo")
	}
	if repo.CreatedAt != "2024-06-15T12:00:00Z" {
		t.Fatalf("expected createdAt 2024-06-15T12:00:00Z, got %s", repo.CreatedAt)
	}
}

func TestFindOneCreatedAtMissing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"default_branch":"main"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.FindOne(nil, FindOneOptions{ID: "repo-1"})
	if err != nil {
		t.Fatalf("find one error: %v", err)
	}
	if repo == nil {
		t.Fatalf("expected repo")
	}
	if repo.CreatedAt != "" {
		t.Fatalf("expected empty createdAt, got %s", repo.CreatedAt)
	}
}

func TestRepoNoHTTPRequest(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.Repo(RepoOptions{
		ID:            "known-repo-id",
		DefaultBranch: "develop",
		CreatedAt:     "2024-06-15T12:00:00Z",
	})
	if err != nil {
		t.Fatalf("repo error: %v", err)
	}

	if repo.ID != "known-repo-id" {
		t.Fatalf("expected repo id known-repo-id, got %s", repo.ID)
	}
	if repo.DefaultBranch != "develop" {
		t.Fatalf("expected default branch develop, got %s", repo.DefaultBranch)
	}
	if repo.CreatedAt != "2024-06-15T12:00:00Z" {
		t.Fatalf("expected createdAt 2024-06-15T12:00:00Z, got %s", repo.CreatedAt)
	}

	remote, err := repo.RemoteURL(nil, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}})
	if err != nil {
		t.Fatalf("remote url error: %v", err)
	}
	if !strings.Contains(remote, "@acme.code.storage/known-repo-id.git") {
		t.Fatalf("unexpected remote url: %s", remote)
	}
}

func TestRepoDefaults(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey, StorageBaseURL: "acme.code.storage"})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.Repo(RepoOptions{ID: "known-repo-id"})
	if err != nil {
		t.Fatalf("repo error: %v", err)
	}

	if repo.DefaultBranch != "main" {
		t.Fatalf("expected default branch main, got %s", repo.DefaultBranch)
	}
	if repo.CreatedAt != "" {
		t.Fatalf("expected empty createdAt, got %s", repo.CreatedAt)
	}
}

func TestRepoRequiresID(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.Repo(RepoOptions{})
	if err == nil || !strings.Contains(err.Error(), "repo id is required") {
		t.Fatalf("expected repo id is required error, got %v", err)
	}

	_, err = client.Repo(RepoOptions{ID: "   "})
	if err == nil || !strings.Contains(err.Error(), "repo id is required") {
		t.Fatalf("expected repo id is required error for whitespace id, got %v", err)
	}
}

func TestCreateRepoCreatedAt(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	before := time.Now().UTC()
	repo, err := client.CreateRepo(nil, CreateRepoOptions{})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}
	after := time.Now().UTC()

	if repo.CreatedAt == "" {
		t.Fatalf("expected non-empty createdAt")
	}
	parsed, err := time.Parse(time.RFC3339, repo.CreatedAt)
	if err != nil {
		t.Fatalf("failed to parse createdAt: %v", err)
	}
	if parsed.Before(before.Add(-time.Second)) || parsed.After(after.Add(time.Second)) {
		t.Fatalf("createdAt %s not within expected range", repo.CreatedAt)
	}
}

func TestFindOneNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	repo, err := client.FindOne(nil, FindOneOptions{ID: "repo-1"})
	if err != nil {
		t.Fatalf("find one error: %v", err)
	}
	if repo != nil {
		t.Fatalf("expected nil repo")
	}
}

func TestDeleteRepoTTL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		exp := int64(claims["exp"].(float64))
		iat := int64(claims["iat"].(float64))
		if exp-iat != 300 {
			t.Fatalf("expected ttl 300, got %d", exp-iat)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","message":"ok"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.DeleteRepo(nil, DeleteRepoOptions{ID: "repo", InvocationOptions: InvocationOptions{TTL: 300 * time.Second}})
	if err != nil {
		t.Fatalf("delete repo error: %v", err)
	}
}

func TestDeleteRepoNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.DeleteRepo(nil, DeleteRepoOptions{ID: "missing"})
	if err == nil || !strings.Contains(err.Error(), "repository not found") {
		t.Fatalf("expected repository not found error, got %v", err)
	}
}

func TestDeleteRepoAlreadyDeleted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.DeleteRepo(nil, DeleteRepoOptions{ID: "deleted"})
	if err == nil || !strings.Contains(err.Error(), "repository already deleted") {
		t.Fatalf("expected repository already deleted error, got %v", err)
	}
}

func TestDeleteRepoScope(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := parseJWTFromToken(t, token)
		if claims["repo"] != "repo-delete" {
			t.Fatalf("expected repo claim")
		}
		scopes, ok := claims["scopes"].([]interface{})
		if !ok || len(scopes) != 1 || scopes[0] != "repo:write" {
			t.Fatalf("expected repo:write scope")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo-delete","message":"ok"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.DeleteRepo(nil, DeleteRepoOptions{ID: "repo-delete"})
	if err != nil {
		t.Fatalf("delete repo error: %v", err)
	}
}

func TestConfig(t *testing.T) {
	client, err := NewClient(Options{Name: "acme", Key: testKey})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}
	cfg := client.Config()
	if cfg.Name != "acme" {
		t.Fatalf("unexpected config")
	}
}

func TestCreateRepoUserAgentHeader(t *testing.T) {
	var headerAgent string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headerAgent = r.Header.Get("Code-Storage-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{ID: "repo"})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	if headerAgent == "" || !strings.Contains(headerAgent, "code-storage-go-sdk/") {
		t.Fatalf("missing Code-Storage-Agent header")
	}
}

func TestCreateRepoGenericGitBaseRepo(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo_id":"repo","url":"https://repo.git"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	_, err = client.CreateRepo(nil, CreateRepoOptions{
		BaseRepo: GenericGitBaseRepo{
			Provider:     RepoProviderGitLab,
			Owner:        "myorg",
			Name:         "myrepo",
			UpstreamHost: "gitlab.example.com",
		},
	})
	if err != nil {
		t.Fatalf("create repo error: %v", err)
	}

	baseRepo, ok := receivedBody["base_repo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected base_repo payload")
	}
	if baseRepo["provider"] != "gitlab" {
		t.Fatalf("expected provider gitlab, got %v", baseRepo["provider"])
	}
	if baseRepo["owner"] != "myorg" {
		t.Fatalf("expected owner myorg")
	}
	if baseRepo["upstream_host"] != "gitlab.example.com" {
		t.Fatalf("expected upstream_host gitlab.example.com, got %v", baseRepo["upstream_host"])
	}
}

func TestCreateGitCredential(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/git-credentials" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"cred-123"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	cred, err := client.CreateGitCredential(nil, CreateGitCredentialOptions{
		RepoID:   "repo-abc",
		Username: "user1",
		Password: "s3cret",
	})
	if err != nil {
		t.Fatalf("create credential error: %v", err)
	}
	if cred.ID != "cred-123" {
		t.Fatalf("expected cred id cred-123, got %s", cred.ID)
	}
	if receivedBody["repo_id"] != "repo-abc" {
		t.Fatalf("expected repo_id repo-abc")
	}
	if receivedBody["username"] != "user1" {
		t.Fatalf("expected username user1")
	}
	if receivedBody["password"] != "s3cret" {
		t.Fatalf("expected password s3cret")
	}
}

func TestUpdateGitCredential(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Fatalf("expected PUT, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/git-credentials" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cred-456","created_at":"2024-01-01T00:00:00Z"}`))
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	cred, err := client.UpdateGitCredential(nil, UpdateGitCredentialOptions{
		ID:       "cred-456",
		Username: "user2",
		Password: "newpassword",
	})
	if err != nil {
		t.Fatalf("update credential error: %v", err)
	}
	if cred.ID != "cred-456" {
		t.Fatalf("expected cred id cred-456, got %s", cred.ID)
	}
	if cred.CreatedAt != "2024-01-01T00:00:00Z" {
		t.Fatalf("expected createdAt 2024-01-01T00:00:00Z, got %s", cred.CreatedAt)
	}
	if receivedBody["id"] != "cred-456" {
		t.Fatalf("expected id cred-456 in request body")
	}
	if receivedBody["username"] != "user2" {
		t.Fatalf("expected username user2 in request body")
	}
	if receivedBody["password"] != "newpassword" {
		t.Fatalf("expected password newpassword in request body")
	}
}

func TestDeleteGitCredential(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("expected DELETE, got %s", r.Method)
		}
		if r.URL.Path != "/api/v1/repos/git-credentials" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		decoder := json.NewDecoder(r.Body)
		_ = decoder.Decode(&receivedBody)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client, err := NewClient(Options{Name: "acme", Key: testKey, APIBaseURL: server.URL})
	if err != nil {
		t.Fatalf("client error: %v", err)
	}

	err = client.DeleteGitCredential(nil, DeleteGitCredentialOptions{
		ID: "cred-789",
	})
	if err != nil {
		t.Fatalf("delete credential error: %v", err)
	}
	if receivedBody["id"] != "cred-789" {
		t.Fatalf("expected id cred-789 in request body, got %v", receivedBody["id"])
	}
}
