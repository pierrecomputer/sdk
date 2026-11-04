// Package git builds a Git remote URL with a token in it. It makes no
// HTTP call.
package git

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	pierre "github.com/pierrecomputer/sdk/go"
	"github.com/pierrecomputer/sdk/go/internal/bridge"
	"github.com/pierrecomputer/sdk/go/internal/config"
	"github.com/pierrecomputer/sdk/go/internal/credentials"
	"github.com/pierrecomputer/sdk/go/internal/segment"
	"github.com/pierrecomputer/sdk/go/option"
)

// RemoteKind is the form of a remote URL.
type RemoteKind string

const (
	// KindDefault is the remote of the repository.
	KindDefault RemoteKind = "default"
	// KindEphemeral is the remote of the ephemeral refs, apart from the default namespace. It adds
	// +ephemeral before .git.
	KindEphemeral RemoteKind = "ephemeral"
	// KindImport is the remote of an import. It adds +import before .git.
	KindImport RemoteKind = "import"
)

var suffixes = map[RemoteKind]string{KindDefault: "", KindEphemeral: "+ephemeral", KindImport: "+import"}

// RemoteURLParams are the repository and the claims of the token of a remote URL.
type RemoteURLParams struct {
	// RepoName is the repository name, for example acme/web.
	RepoName string
	// Scopes are the scopes of the token. Default: git:read and git:write.
	Scopes []string
	// TTL is the lifetime of the token, a whole number of seconds from 1 second to 1 hour.
	// Default: 15 minutes.
	TTL time.Duration
	// RefPolicies are the rules of the refs claim. Default: the ref policies of the client, so a
	// confined client stays confined through Git. An empty list that is not nil adds no claim.
	RefPolicies []option.RefPolicy
	// Kind is the form of the remote. Default: KindDefault.
	Kind RemoteKind
}

// defaultTTL is the default lifetime of a token in a remote URL.
const defaultTTL = 15 * time.Minute

func failure(message string) error {
	return &pierre.PierreError{Message: message}
}

// RemoteURL builds https://t:<token>@{gitHost}/{repo_name}.git for git clone, git fetch, and
// git push. The token is a bearer credential that Git copies into .git/config, so keep the
// lifetime short. Longer work uses the credential helper (pierre auth setup-git).
//
// The client signs the token with its private key, or gets it from its function of
// option.WithGetToken, with ctx. A client with a fixed token cannot set the claims of its token,
// so RemoteURL returns a *pierre.PierreError.
//
// Docs: search for remoteUrl in the docs MCP server, https://code.storage/docs/mcp.
func RemoteURL(ctx context.Context, client *pierre.Client, params RemoteURLParams) (string, error) {
	key, ok := bridge.KeyOf(client)
	if !ok {
		return "", failure("git.RemoteURL: give a client from pierre.NewClient.")
	}
	if key.Source.Fixed() {
		return "", failure("git.RemoteURL needs a client with a private key or a function of option.WithGetToken. A client with a fixed token cannot set the claims of its token.")
	}
	host, err := hostOf(key.GitHost)
	if err != nil {
		return "", err
	}
	path, err := repositoryPath(params.RepoName)
	if err != nil {
		return "", err
	}
	kind := params.Kind
	if kind == "" {
		kind = KindDefault
	}
	suffix, ok := suffixes[kind]
	if !ok {
		return "", failure("git.RemoteURL: Kind must be KindDefault, KindEphemeral, or KindImport.")
	}
	scopes := params.Scopes
	if scopes == nil {
		scopes = []string{"git:read", "git:write"}
	}
	if len(scopes) == 0 {
		return "", failure("git.RemoteURL: Scopes must name at least one scope.")
	}
	ttl := params.TTL
	if ttl == 0 {
		ttl = defaultTTL
	}
	if err := config.CheckTTL(ttl, "git.RemoteURL"); err != nil {
		return "", failure(err.Error())
	}
	policies := key.RefPolicies
	if params.RefPolicies != nil {
		if policies, err = config.CheckRefPolicies(params.RefPolicies, "git.RemoteURL"); err != nil {
			return "", failure(err.Error())
		}
	}
	if len(policies) == 0 {
		policies = nil
	}
	token, err := key.Source.Token(ctx, config.TokenRequest{
		Scopes: append([]string{}, scopes...),
		// An ephemeral or import remote uses the token of its repository.
		Repo:        params.RepoName,
		TTL:         ttl,
		RefPolicies: policies,
	})
	if err != nil {
		var sdk *credentials.Error
		if errors.As(err, &sdk) {
			return "", &pierre.PierreError{Message: sdk.Message, Err: sdk.Err}
		}
		return "", err
	}
	remote := url.URL{
		Scheme:  "https",
		User:    url.UserPassword("t", token),
		Host:    host,
		Path:    "/" + params.RepoName + suffix + ".git",
		RawPath: "/" + path + suffix + ".git",
	}
	return remote.String(), nil
}

// hostOf checks the Git host of the client: a host name with an optional port. A scheme, a path,
// or another URL part would send the token to another host.
func hostOf(gitHost string) (string, error) {
	if gitHost == "" {
		return "", failure("git.RemoteURL needs the Git host. Set option.WithOrg or option.WithGitHost.")
	}
	// A scheme, a path, a query, a fragment, or a user would change the host of the token.
	parsed, err := url.Parse("https://" + gitHost)
	if strings.ContainsAny(gitHost, "/?#@\\ ") || err != nil || parsed.Host != gitHost || parsed.Hostname() == "" {
		return "", failure("option.WithGitHost must be a host name with an optional port, for example acme.code.storage.")
	}
	return strings.TrimSuffix(strings.ToLower(gitHost), ":443"), nil
}

// repositoryPath is the URL path of a repository name: each segment percent-encoded, with /
// between them.
func repositoryPath(name string) (string, error) {
	if name == "" {
		return "", failure("git.RemoteURL: RepoName must not be empty.")
	}
	segments := strings.Split(name, "/")
	for index, part := range segments {
		// The URL parser resolves . and .., which would name another repository.
		if part == "" || part == "." || part == ".." {
			return "", failure("git.RemoteURL: RepoName cannot have an empty, ., or .. segment: " + name)
		}
		segments[index] = segment.Escape(part)
	}
	return strings.Join(segments, "/"), nil
}
