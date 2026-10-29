// Package auth signs a token locally, with no HTTP call, and lists the
// scopes of the API.
package auth

import (
	"context"
	"errors"
	"time"

	pierre "github.com/pierrecomputer/sdk/go"
	"github.com/pierrecomputer/sdk/go/internal/bridge"
	"github.com/pierrecomputer/sdk/go/internal/config"
	"github.com/pierrecomputer/sdk/go/internal/credentials"
	"github.com/pierrecomputer/sdk/go/option"
)

// TokenParams are the claims of a token.
type TokenParams struct {
	// Scopes are the scopes of the token, for example git:read. The variable Scopes lists the
	// scopes of the API.
	Scopes []string
	// Repo is the repo claim. Leave it empty for a token whose scopes are all organization-wide.
	Repo string
	// TTL is the lifetime, a whole number of seconds from 1 second to 1 hour. Default: 15 minutes.
	TTL time.Duration
	// RefPolicies are the rules of the refs claim. Default: the ref policies of a client, and none
	// for KeyCredentials. An empty list that is not nil adds no claim.
	RefPolicies []option.RefPolicy
	// Subject is the sub claim. Default: pierre-sdk-go.
	Subject string
}

// KeyCredentials are a private key and its organization, for code with no client.
type KeyCredentials struct {
	Org string
	// PrivateKey is a PKCS #8 PEM private key.
	PrivateKey string
}

// defaultTTL is the default lifetime of a token from CreateToken.
const defaultTTL = 15 * time.Minute

// CreateToken signs a token with a private key: the key of a client, or KeyCredentials. A token in
// a URL or a config file is a bearer credential, so keep the lifetime short. The SDK rejects a
// lifetime over 1 hour.
//
// Docs: search for createToken in the docs MCP server, https://code.storage/docs/mcp.
func CreateToken[C *pierre.Client | KeyCredentials](ctx context.Context, credential C, params TokenParams) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", context.Cause(ctx)
	}
	org, signer, policies, err := signingKey(any(credential))
	if err != nil {
		return "", err
	}
	if len(params.Scopes) == 0 {
		return "", &pierre.PierreError{Message: "auth.CreateToken: Scopes must name at least one scope."}
	}
	ttl := params.TTL
	if ttl == 0 {
		ttl = defaultTTL
	}
	if err := config.CheckTTL(ttl, "auth.CreateToken"); err != nil {
		return "", &pierre.PierreError{Message: err.Error()}
	}
	if params.RefPolicies != nil {
		if policies, err = config.CheckRefPolicies(params.RefPolicies, "auth.CreateToken"); err != nil {
			return "", &pierre.PierreError{Message: err.Error()}
		}
	}
	subject := params.Subject
	if subject == "" {
		subject = credentials.Subject
	}
	token, err := signer.Sign(credentials.Claims{
		Issuer:      org,
		Subject:     subject,
		Repo:        params.Repo,
		Scopes:      params.Scopes,
		TTL:         ttl,
		RefPolicies: policies,
	})
	if err != nil {
		return "", sdkError(err)
	}
	return token, nil
}

func signingKey(value any) (string, *credentials.Signer, []config.RefPolicy, error) {
	switch given := value.(type) {
	case *pierre.Client:
		key, ok := bridge.KeyOf(given)
		if !ok {
			return "", nil, nil, &pierre.PierreError{Message: "auth.CreateToken: give a client from pierre.NewClient."}
		}
		if key.Signer == nil || key.Org == "" {
			return "", nil, nil, &pierre.PierreError{Message: "auth.CreateToken needs a client with a private key. A client with a token or a function of option.WithGetToken cannot sign."}
		}
		return key.Org, key.Signer, key.RefPolicies, nil
	case KeyCredentials:
		if given.Org == "" {
			return "", nil, nil, &pierre.PierreError{Message: "auth.CreateToken: KeyCredentials need Org."}
		}
		signer, err := credentials.ParsePrivateKey(given.PrivateKey)
		if err != nil {
			return "", nil, nil, sdkError(err)
		}
		return given.Org, signer, nil, nil
	}
	return "", nil, nil, &pierre.PierreError{Message: "auth.CreateToken: give a client or KeyCredentials."}
}

func sdkError(err error) error {
	var failure *credentials.Error
	if errors.As(err, &failure) {
		return &pierre.PierreError{Message: failure.Message, Err: failure.Err}
	}
	return err
}
