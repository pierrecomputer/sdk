// Package config holds the settings that the options of package option write. A client reads
// them when it is made, and a method reads them for one request.
package config

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// RefPolicy is one ordered rule of the refs claim. The first rule whose
// pattern matches a ref applies.
type RefPolicy struct {
	// Pattern is a full ref name (refs/heads/main), a branch name (main), a prefix that ends with
	// /* (refs/heads/feature/*), or * for every ref. The gateway rejects a token with another form.
	Pattern string
	// Ops are the policy operations: no-push, no-force-push, or verify-sig. The gateway rejects a
	// token with an op that it does not know.
	Ops []string
}

// TokenRequest is the token that a request needs.
type TokenRequest struct {
	// Scopes are the scopes of the operation.
	Scopes []string
	// Repo is the repo claim of a repository-scoped operation, or empty for none.
	Repo string
	// TTL is the lifetime of the token.
	TTL time.Duration
	// RefPolicies are the rules of the refs claim, or nil when the call has none.
	RefPolicies []RefPolicy
}

// GetToken returns a token for a request, for a client with no private key. The context ends
// when the call stops or the attempt times out.
type GetToken func(ctx context.Context, request TokenRequest) (string, error)

// Options holds the options of a client or of one request. A nil field is not set.
type Options struct {
	// Request is true when the options apply to one request. An option that applies only to a
	// client, or only to a request, reads it.
	Request bool
	// Err is the first error of an option.
	Err error

	Org        *string
	PrivateKey *string
	Token      *string
	GetToken   GetToken
	BaseURL    *string
	GitHost    *string
	HTTPClient *http.Client

	Timeout    *time.Duration
	MaxRetries *int
	// Headers are the default headers of a client, or the headers of one request.
	Headers http.Header
	// RefPolicies is set also for an empty list, which removes the policies.
	RefPolicies    *[]RefPolicy
	IdempotencyKey *string
	TokenTTL       *time.Duration
	ResponseInto   **http.Response
}

// Option changes the options. It records an error in Options.Err.
type Option = func(*Options)

// Apply gives the options in order, and returns the first error.
func Apply(options *Options, list []Option) error {
	for _, option := range list {
		if option == nil {
			continue
		}
		option(options)
		if options.Err != nil {
			return options.Err
		}
	}
	return nil
}

// MaxTokenTTL is the longest token lifetime that the SDK signs.
const MaxTokenTTL = time.Hour

// CheckRefPolicies checks the shape of ref policies, and returns a copy. The gateway checks the
// pattern forms and the ops. The copy is not nil, so an empty list stays a set value.
func CheckRefPolicies(policies []RefPolicy, name string) ([]RefPolicy, error) {
	copied := make([]RefPolicy, 0, len(policies))
	for index, policy := range policies {
		if policy.Pattern == "" {
			return nil, fmt.Errorf("%s: the pattern of rule %d must not be empty", name, index)
		}
		for _, op := range policy.Ops {
			if op == "" {
				return nil, fmt.Errorf("%s: the ops of rule %d must be op names", name, index)
			}
		}
		var ops []string
		if policy.Ops != nil {
			ops = append([]string{}, policy.Ops...)
		}
		copied = append(copied, RefPolicy{Pattern: policy.Pattern, Ops: ops})
	}
	return copied, nil
}

// CheckTTL checks a token lifetime: a whole number of seconds from 1 second to 1 hour.
func CheckTTL(ttl time.Duration, name string) error {
	if ttl < time.Second || ttl > MaxTokenTTL || ttl%time.Second != 0 {
		return fmt.Errorf("%s: the lifetime must be a whole number of seconds from 1 second to 1 hour", name)
	}
	return nil
}
