package pierre

import (
	"context"

	"github.com/pierrecomputer/sdk/go/option"
)

// createRepo is the repository create. The SDK names a new repository when the
// caller does not, and a copy reads its source with a token that the SDK adds when the caller
// gives none. A null RepoName or Auth.Token counts as not given.
func createRepo(ctx context.Context, c *core, op *operation, params ReposCreateParams, opts []option.RequestOption) (*ReposCreateResponse, error) {
	// The create token needs the name before the request, and each retry keeps it, so a retry
	// cannot make a second repository.
	if _, ok := params.RepoName.Get(); !ok {
		params.RepoName = String(newUUID())
	}
	source, ok := params.BaseRepo.Get()
	if ok && source.Provider.IsZero() {
		auth, _ := source.Auth.Get()
		// The deprecated sync form, with provider, reads no Code Storage repository.
		if _, given := auth.Token.Get(); !given {
			token, err := c.readToken(ctx, source.Name, opts)
			if err != nil {
				return nil, err
			}
			auth.Token = String(token)
			source.Auth = Value(auth)
			params.BaseRepo = Value(source)
		}
	}
	return requestJSON[ReposCreateResponse](ctx, c, op, input{params: &params}, opts)
}
