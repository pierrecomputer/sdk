// Package option holds the options of a Pierre client and of one request. One RequestOption
// value serves both uses: give it to pierre.NewClient or client.WithOptions to set the client
// default, or to a method to change one call. An option that applies only to a client, or only
// to a request, returns an error in the other use.
package option

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/pierrecomputer/sdk/go/internal/config"
)

// RequestOption is an option of a client or of one request.
type RequestOption = config.Option

// RefPolicy is one ordered rule of the refs claim, which limits the refs that a write can
// change. The first rule whose pattern matches a ref applies.
type RefPolicy = config.RefPolicy

// TokenRequest is the token that a request needs. A function of WithGetToken receives it.
type TokenRequest = config.TokenRequest

// maxIdempotencyKeyBytes is the largest Idempotency-Key, in bytes of UTF-8.
const maxIdempotencyKeyBytes = 255

func fail(options *config.Options, format string, args ...any) {
	options.Err = fmt.Errorf(format, args...)
}

// clientOnly records an error when a method gets an option of the client.
func clientOnly(options *config.Options, name string) bool {
	if options.Request {
		fail(options, "option.%s is a client option: give it to pierre.NewClient or client.WithOptions", name)
		return false
	}
	return true
}

// requestOnly records an error when a client gets an option of one request.
func requestOnly(options *config.Options, name string) bool {
	if !options.Request {
		fail(options, "option.%s is a request option: give it to a method", name)
		return false
	}
	return true
}

// WithOrg sets the organization name. Default: PIERRE_ORG, or the iss claim of the token.
// The default hosts use it: https://api.{org}.code.storage and {org}.code.storage.
func WithOrg(org string) RequestOption {
	return func(options *config.Options) {
		if !clientOnly(options, "WithOrg") {
			return
		}
		if org == "" {
			fail(options, "option.WithOrg: the organization name must not be empty")
			return
		}
		options.Org = &org
	}
}

// WithPrivateKey sets a PKCS #8 PEM private key, which signs a token for each request.
// Default: PIERRE_PRIVATE_KEY, or the file at PIERRE_PRIVATE_KEY_FILE. A credential option
// replaces every credential of the environment.
func WithPrivateKey(pem string) RequestOption {
	return func(options *config.Options) {
		if !clientOnly(options, "WithPrivateKey") {
			return
		}
		if pem == "" {
			fail(options, "option.WithPrivateKey: the private key must not be empty")
			return
		}
		options.PrivateKey = &pem
	}
}

// WithToken sets a fixed token. Default: PIERRE_TOKEN. The server checks its scopes. A
// repository-scoped token covers one repository.
func WithToken(token string) RequestOption {
	return func(options *config.Options) {
		if !clientOnly(options, "WithToken") {
			return
		}
		if token == "" {
			fail(options, "option.WithToken: the token must not be empty")
			return
		}
		options.Token = &token
	}
}

// WithGetToken sets a function that returns a token for each request, for a client with no
// private key. The SDK gives it the scopes, the repo claim, the lifetime, and the ref policies of
// the request. The SDK calls it on its own goroutine, and stops the wait
// when the context of the attempt ends, so a panic in it stops the process.
func WithGetToken(getToken func(ctx context.Context, request TokenRequest) (string, error)) RequestOption {
	return func(options *config.Options) {
		if !clientOnly(options, "WithGetToken") {
			return
		}
		if getToken == nil {
			fail(options, "option.WithGetToken: the function must not be nil")
			return
		}
		options.GetToken = getToken
	}
}

// WithBaseURL sets the API base URL, an absolute https or http URL. Default:
// PIERRE_API_BASE_URL, or https://api.{org}.code.storage.
func WithBaseURL(baseURL string) RequestOption {
	return func(options *config.Options) {
		if clientOnly(options, "WithBaseURL") {
			options.BaseURL = &baseURL
		}
	}
}

// WithGitHost sets the Git host, a host name with an optional port. Default: PIERRE_GIT_HOST,
// or {org}.code.storage.
func WithGitHost(gitHost string) RequestOption {
	return func(options *config.Options) {
		if clientOnly(options, "WithGitHost") {
			options.GitHost = &gitHost
		}
	}
}

// WithHTTPClient sets the HTTP client that sends each request. Default: http.DefaultClient.
func WithHTTPClient(client *http.Client) RequestOption {
	return func(options *config.Options) {
		if !clientOnly(options, "WithHTTPClient") {
			return
		}
		if client == nil {
			fail(options, "option.WithHTTPClient: the client must not be nil")
			return
		}
		options.HTTPClient = client
	}
}

// WithTimeout sets the timeout of each attempt. Default: 60 seconds. It runs until the
// response headers arrive, and for a JSON response until the SDK reads the body. It includes
// the token and the upload, so give a larger value for a large commit. The context of the call
// stops the call at any time.
func WithTimeout(timeout time.Duration) RequestOption {
	return func(options *config.Options) {
		if timeout <= 0 {
			fail(options, "option.WithTimeout: the timeout must be greater than 0")
			return
		}
		options.Timeout = &timeout
	}
}

// WithMaxRetries sets the number of retries of a transient failure.
// Default: 2.
func WithMaxRetries(maxRetries int) RequestOption {
	return func(options *config.Options) {
		if maxRetries < 0 {
			fail(options, "option.WithMaxRetries: the number of retries must be 0 or more")
			return
		}
		options.MaxRetries = &maxRetries
	}
}

// WithHeader sets a header: a default header of each request of a client, or a header of one
// request. A request header replaces a default header of the same name. In client.WithOptions, it
// adds to the default headers of the client. A header that the operation declares is a typed
// param instead.
func WithHeader(name, value string) RequestOption {
	return func(options *config.Options) {
		if name == "" {
			fail(options, "option.WithHeader: the header name must not be empty")
			return
		}
		if options.Headers == nil {
			options.Headers = http.Header{}
		}
		options.Headers.Set(name, value)
	}
}

// WithRefPolicies sets the refs claim of each request token, which limits the refs that a write
// can change. A request option replaces the client option, and no policies
// remove it for that call. A client with a fixed token cannot use it, because the SDK cannot
// change the claims of that token.
func WithRefPolicies(policies ...RefPolicy) RequestOption {
	return func(options *config.Options) {
		copied, err := config.CheckRefPolicies(policies, "option.WithRefPolicies")
		if err != nil {
			options.Err = err
			return
		}
		options.RefPolicies = &copied
	}
}

// WithIdempotencyKey sets the Idempotency-Key of a create that accepts one. The SDK sends the
// same key on each retry. Default: a new UUID for each call.
func WithIdempotencyKey(key string) RequestOption {
	return func(options *config.Options) {
		if !requestOnly(options, "WithIdempotencyKey") {
			return
		}
		if len(key) == 0 || len(key) > maxIdempotencyKeyBytes {
			fail(options, "option.WithIdempotencyKey: the key must have 1 to %d bytes", maxIdempotencyKeyBytes)
			return
		}
		options.IdempotencyKey = &key
	}
}

// WithTokenTTL sets the lifetime of the request token, a whole number of seconds from 1 second
// to 1 hour. Default: 5 minutes. The SDK ignores it for a fixed token.
func WithTokenTTL(ttl time.Duration) RequestOption {
	return func(options *config.Options) {
		if !requestOnly(options, "WithTokenTTL") {
			return
		}
		if err := config.CheckTTL(ttl, "option.WithTokenTTL"); err != nil {
			options.Err = err
			return
		}
		options.TokenTTL = &ttl
	}
}

// WithResponseInto stores the HTTP response of the last attempt in *dst. Its headers include
// the response headers that the operation declares, and X-Request-Id. The SDK has read the
// body of a JSON or error response, and gives a copy that the caller can read again. For a byte
// stream, the body is the stream of the result.
func WithResponseInto(dst **http.Response) RequestOption {
	return func(options *config.Options) {
		if !requestOnly(options, "WithResponseInto") {
			return
		}
		if dst == nil {
			fail(options, "option.WithResponseInto: the destination must not be nil")
			return
		}
		options.ResponseInto = dst
	}
}
