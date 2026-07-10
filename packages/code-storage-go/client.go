package storage

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	defaultAPIBaseURL     = "https://api.{{org}}.code.storage"
	defaultStorageBaseURL = "{{org}}.code.storage"
	defaultTokenTTL       = time.Hour
	defaultJWTTTL         = 365 * 24 * time.Hour
)

// NewClient creates a Git storage client.
func NewClient(options Options) (*Client, error) {
	if strings.TrimSpace(options.Name) == "" {
		return nil, errors.New("git storage requires a name")
	}
	if strings.TrimSpace(options.Key) == "" && strings.TrimSpace(options.Token) == "" {
		return nil, errors.New("git storage requires either a key or a token")
	}

	apiBaseURL := options.APIBaseURL
	if apiBaseURL == "" {
		apiBaseURL = DefaultAPIBaseURL(options.Name)
	}
	storageBaseURL := options.StorageBaseURL
	if storageBaseURL == "" {
		storageBaseURL = DefaultStorageBaseURL(options.Name)
	}
	version := options.APIVersion
	if version == 0 {
		version = DefaultAPIVersion
	}

	var privateKey *ecdsa.PrivateKey
	if strings.TrimSpace(options.Key) != "" {
		var err error
		privateKey, err = parseECPrivateKey([]byte(options.Key))
		if err != nil {
			return nil, err
		}
	}

	client := &Client{
		options: Options{
			Name:           options.Name,
			Key:            options.Key,
			Token:          options.Token,
			APIBaseURL:     apiBaseURL,
			StorageBaseURL: storageBaseURL,
			APIVersion:     version,
			DefaultTTL:     options.DefaultTTL,
			HTTPClient:     options.HTTPClient,
		},
		privateKey: privateKey,
	}
	client.api = newAPIFetcher(apiBaseURL, version, options.HTTPClient)
	return client, nil
}

// DefaultAPIBaseURL builds the default API base URL for an org.
func DefaultAPIBaseURL(name string) string {
	return strings.ReplaceAll(defaultAPIBaseURL, "{{org}}", name)
}

// DefaultStorageBaseURL builds the default storage base URL for an org.
func DefaultStorageBaseURL(name string) string {
	return strings.ReplaceAll(defaultStorageBaseURL, "{{org}}", name)
}

// Config returns the resolved client options.
func (c *Client) Config() Options {
	return c.options
}

// CreateRepo creates a new repository.
func (c *Client) CreateRepo(ctx context.Context, options CreateRepoOptions) (*Repo, error) {
	repoID := options.ID
	if repoID == "" {
		repoID = uuid.NewString()
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT(repoID, RemoteURLOptions{Permissions: []Permission{PermissionRepoWrite}, TTL: ttl})
	if err != nil {
		return nil, err
	}

	var baseRepo *baseRepoPayload
	isFork := false
	resolvedDefaultBranch := ""

	if options.BaseRepo != nil {
		switch base := options.BaseRepo.(type) {
		case ForkBaseRepo:
			isFork = true
			baseRepoToken, err := c.generateJWT(base.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
			if err != nil {
				return nil, err
			}
			baseRepo = &baseRepoPayload{
				Provider:  "code",
				Owner:     c.options.Name,
				Name:      base.ID,
				Operation: "fork",
				Auth:      &authPayload{Token: baseRepoToken},
			}
			if strings.TrimSpace(base.Ref) != "" {
				baseRepo.Ref = base.Ref
			}
			if strings.TrimSpace(base.SHA) != "" {
				baseRepo.SHA = base.SHA
			}
			if strings.TrimSpace(options.DefaultBranch) != "" {
				resolvedDefaultBranch = options.DefaultBranch
			}
		case GitHubBaseRepo:
			provider := base.Provider
			if provider == "" {
				provider = RepoProviderGitHub
			}
			baseRepo = &baseRepoPayload{
				Provider: string(provider),
				Owner:    base.Owner,
				Name:     base.Name,
			}
			if base.Auth != nil && strings.TrimSpace(string(base.Auth.AuthType)) != "" {
				baseRepo.Auth = &authPayload{AuthType: string(base.Auth.AuthType)}
			}
			if strings.TrimSpace(base.DefaultBranch) != "" {
				baseRepo.DefaultBranch = base.DefaultBranch
				resolvedDefaultBranch = base.DefaultBranch
			}
		case GenericGitBaseRepo:
			baseRepo = &baseRepoPayload{
				Provider: string(base.Provider),
				Owner:    base.Owner,
				Name:     base.Name,
			}
			if strings.TrimSpace(base.DefaultBranch) != "" {
				baseRepo.DefaultBranch = base.DefaultBranch
				resolvedDefaultBranch = base.DefaultBranch
			}
			if strings.TrimSpace(base.UpstreamHost) != "" {
				baseRepo.UpstreamHost = base.UpstreamHost
			}
		default:
			return nil, errors.New("unsupported base repo type")
		}
	}

	if resolvedDefaultBranch == "" {
		if strings.TrimSpace(options.DefaultBranch) != "" {
			resolvedDefaultBranch = options.DefaultBranch
		} else if !isFork {
			resolvedDefaultBranch = "main"
		}
	}

	var body interface{}
	if baseRepo != nil || resolvedDefaultBranch != "" {
		body = &createRepoRequest{
			BaseRepo:      baseRepo,
			DefaultBranch: resolvedDefaultBranch,
		}
	}

	resp, err := c.api.post(ctx, "repos", nil, body, jwtToken, &requestOptions{allowedStatus: map[int]bool{409: true}})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		return nil, errors.New("repository already exists")
	}

	if resolvedDefaultBranch == "" {
		resolvedDefaultBranch = "main"
	}
	return c.Repo(RepoOptions{
		ID:            repoID,
		DefaultBranch: resolvedDefaultBranch,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	})
}

// ListRepos lists repositories for the org.
func (c *Client) ListRepos(ctx context.Context, options ListReposOptions) (ListReposResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT("org", RemoteURLOptions{Permissions: []Permission{PermissionOrgRead}, TTL: ttl})
	if err != nil {
		return ListReposResult{}, err
	}

	params := url.Values{}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
	}
	if q := strings.TrimSpace(options.Q); q != "" {
		params.Set("q", q)
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := c.api.get(ctx, "repos", params, jwtToken, nil)
	if err != nil {
		return ListReposResult{}, err
	}
	defer resp.Body.Close()

	var payload listReposResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListReposResult{}, err
	}

	result := ListReposResult{HasMore: payload.HasMore}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, repo := range payload.Repos {
		entry := RepoInfo{
			RepoID:        repo.RepoID,
			URL:           repo.URL,
			DefaultBranch: repo.DefaultBranch,
			CreatedAt:     repo.CreatedAt,
		}
		if repo.BaseRepo != nil {
			entry.BaseRepo = &RepoBaseInfo{
				Provider: repo.BaseRepo.Provider,
				Owner:    repo.BaseRepo.Owner,
				Name:     repo.BaseRepo.Name,
			}
		}
		result.Repos = append(result.Repos, entry)
	}

	return result, nil
}

// FindOne retrieves a repo by ID.
func (c *Client) FindOne(ctx context.Context, options FindOneOptions) (*Repo, error) {
	if strings.TrimSpace(options.ID) == "" {
		return nil, errors.New("findOne id is required")
	}
	jwtToken, err := c.generateJWT(options.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: defaultTokenTTL})
	if err != nil {
		return nil, err
	}

	resp, err := c.api.get(ctx, "repo", nil, jwtToken, &requestOptions{allowedStatus: map[int]bool{404: true}})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, nil
	}

	var payload struct {
		DefaultBranch string `json:"default_branch"`
		CreatedAt     string `json:"created_at"`
	}
	if err := decodeJSON(resp, &payload); err != nil {
		return nil, err
	}
	defaultBranch := payload.DefaultBranch
	if defaultBranch == "" {
		defaultBranch = "main"
	}
	return c.Repo(RepoOptions{
		ID:            options.ID,
		DefaultBranch: defaultBranch,
		CreatedAt:     payload.CreatedAt,
	})
}

// Repo creates a repo handle from known metadata without making an HTTP request.
func (c *Client) Repo(options RepoOptions) (*Repo, error) {
	if strings.TrimSpace(options.ID) == "" {
		return nil, errors.New("repo id is required")
	}

	defaultBranch := options.DefaultBranch
	if strings.TrimSpace(defaultBranch) == "" {
		defaultBranch = "main"
	}

	return &Repo{
		ID:            options.ID,
		DefaultBranch: defaultBranch,
		CreatedAt:     options.CreatedAt,
		client:        c,
	}, nil
}

// DeleteRepo deletes a repository by ID.
func (c *Client) DeleteRepo(ctx context.Context, options DeleteRepoOptions) (DeleteRepoResult, error) {
	if strings.TrimSpace(options.ID) == "" {
		return DeleteRepoResult{}, errors.New("deleteRepo id is required")
	}
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT(options.ID, RemoteURLOptions{Permissions: []Permission{PermissionRepoWrite}, TTL: ttl})
	if err != nil {
		return DeleteRepoResult{}, err
	}

	resp, err := c.api.delete(ctx, "repos/delete", nil, nil, jwtToken, &requestOptions{allowedStatus: map[int]bool{404: true, 409: true}})
	if err != nil {
		return DeleteRepoResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return DeleteRepoResult{}, errors.New("repository not found")
	}
	if resp.StatusCode == 409 {
		return DeleteRepoResult{}, errors.New("repository already deleted")
	}

	var payload struct {
		RepoID  string `json:"repo_id"`
		Message string `json:"message"`
	}
	if err := decodeJSON(resp, &payload); err != nil {
		return DeleteRepoResult{}, err
	}

	return DeleteRepoResult{RepoID: payload.RepoID, Message: payload.Message}, nil
}

// CreateGitCredential creates a generic git credential for a repository.
func (c *Client) CreateGitCredential(ctx context.Context, options CreateGitCredentialOptions) (*GitCredential, error) {
	if strings.TrimSpace(options.RepoID) == "" {
		return nil, errors.New("createGitCredential repoId is required")
	}
	if strings.TrimSpace(options.Password) == "" {
		return nil, errors.New("createGitCredential password is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT(options.RepoID, RemoteURLOptions{Permissions: []Permission{PermissionRepoWrite}, TTL: ttl})
	if err != nil {
		return nil, err
	}

	body := &createGitCredentialRequest{
		RepoID:   options.RepoID,
		Password: options.Password,
	}
	if strings.TrimSpace(options.Username) != "" {
		body.Username = options.Username
	}

	resp, err := c.api.post(ctx, "repos/git-credentials", nil, body, jwtToken, &requestOptions{allowedStatus: map[int]bool{409: true}})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		return nil, errors.New("a credential already exists for this repository")
	}

	var payload struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(resp, &payload); err != nil {
		return nil, err
	}

	return &GitCredential{ID: payload.ID}, nil
}

// UpdateGitCredential updates an existing generic git credential.
func (c *Client) UpdateGitCredential(ctx context.Context, options UpdateGitCredentialOptions) (*GitCredential, error) {
	if strings.TrimSpace(options.ID) == "" {
		return nil, errors.New("updateGitCredential id is required")
	}
	if strings.TrimSpace(options.Password) == "" {
		return nil, errors.New("updateGitCredential password is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT("org", RemoteURLOptions{Permissions: []Permission{PermissionRepoWrite}, TTL: ttl})
	if err != nil {
		return nil, err
	}

	body := &updateGitCredentialRequest{
		ID:       options.ID,
		Password: options.Password,
	}
	if strings.TrimSpace(options.Username) != "" {
		body.Username = options.Username
	}

	resp, err := c.api.put(ctx, "repos/git-credentials", nil, body, jwtToken, &requestOptions{allowedStatus: map[int]bool{404: true}})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, errors.New("credential not found")
	}

	var payload struct {
		ID        string `json:"id"`
		CreatedAt string `json:"created_at,omitempty"`
	}
	if err := decodeJSON(resp, &payload); err != nil {
		return nil, err
	}

	return &GitCredential{ID: payload.ID, CreatedAt: payload.CreatedAt}, nil
}

// DeleteGitCredential deletes a generic git credential.
func (c *Client) DeleteGitCredential(ctx context.Context, options DeleteGitCredentialOptions) error {
	if strings.TrimSpace(options.ID) == "" {
		return errors.New("deleteGitCredential id is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := c.generateJWT("org", RemoteURLOptions{Permissions: []Permission{PermissionRepoWrite}, TTL: ttl})
	if err != nil {
		return err
	}

	body := &deleteGitCredentialRequest{ID: options.ID}

	resp, err := c.api.delete(ctx, "repos/git-credentials", nil, body, jwtToken, &requestOptions{allowedStatus: map[int]bool{404: true}})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return errors.New("credential not found")
	}

	return nil
}

func (c *Client) generateJWT(repoID string, options RemoteURLOptions) (string, error) {
	if strings.TrimSpace(c.options.Token) != "" {
		return c.options.Token, nil
	}
	if c.privateKey == nil {
		return "", errors.New("git storage requires a key to generate a JWT")
	}

	permissions := options.Permissions
	if len(permissions) == 0 {
		permissions = []Permission{PermissionGitWrite, PermissionGitRead}
	}

	ttl := options.TTL
	if ttl <= 0 {
		if c.options.DefaultTTL > 0 {
			ttl = c.options.DefaultTTL
		} else {
			ttl = defaultJWTTTL
		}
	}

	issuedAt := time.Now()
	claims := jwt.MapClaims{
		"iss":    c.options.Name,
		"sub":    "@pierre/storage",
		"repo":   repoID,
		"scopes": permissions,
		"iat":    issuedAt.Unix(),
		"exp":    issuedAt.Add(ttl).Unix(),
	}
	if len(options.RefPolicies) > 0 {
		claims["refs"] = encodeRefsClaim(options.RefPolicies)
	}
	if len(options.Ops) > 0 {
		claims["ops"] = options.Ops
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	return token.SignedString(c.privateKey)
}

func parseECPrivateKey(pemBytes []byte) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("failed to parse private key PEM")
	}

	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if ecKey, ok := key.(*ecdsa.PrivateKey); ok {
			return ecKey, nil
		}
		return nil, errors.New("private key is not ECDSA")
	}

	if ecKey, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
		return ecKey, nil
	}

	return nil, errors.New("unsupported private key format")
}

func resolveInvocationTTL(options InvocationOptions, defaultTTL time.Duration) time.Duration {
	if options.TTL > 0 {
		return options.TTL
	}
	return defaultTTL
}
