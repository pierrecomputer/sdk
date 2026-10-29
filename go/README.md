# The Pierre SDK for Go

The Pierre SDK for Go. The module is not published yet.

The package `pierre` holds the client, the namespaces, and their types. The packages `option`,
`auth`, `git`, and `webhooks` hold the options and the local utilities.

## Docs for agents

Read the docs through the MCP server first, then as Markdown pages:

- MCP server: https://code.storage/docs/mcp
- Index of the Markdown pages: https://code.storage/docs/llms.txt
- Each page as Markdown: add `.md` to its URL, for example https://code.storage/docs/api/overview.md

Each method has a catalog ID, for example `repos.branches.create`. The SDK path is the catalog ID in
Go names, `client.Repos.Branches.Create`, and the JSON tags of the params are the HTTP wire names.
Search for the catalog ID in the docs.

## Start

```go
import (
	"context"
	"fmt"

	pierre "github.com/pierrecomputer/sdk/go"
)

// NewClient reads PIERRE_ORG and PIERRE_PRIVATE_KEY.
client, err := pierre.NewClient()
if err != nil {
	return err
}
ctx := context.Background()
meta, err := client.Meta.Get(ctx, pierre.MetaGetParams{})
fmt.Println(meta.Provider.Region)
_, err = client.Repos.Branches.Create(ctx, pierre.ReposBranchesCreateParams{
	RepoName:     "acme/web",
	TargetBranch: pierre.String("feat"),
	BaseRef:      pierre.String("main"),
})
page, err := client.Repos.Branches.List(ctx, pierre.ReposBranchesListParams{RepoName: "acme/web"})
for branch, err := range page.All(ctx) {
	if err != nil {
		return err
	}
	fmt.Println(branch.Name)
}
```

Each method takes a `context.Context`, a params struct, and request options. The context stops the
call at any time, also the wait between two attempts.

## Params

A params struct has a field for each parameter and for each field of the body, with the wire name in
its tag. A required field has its plain type. An optional field, or a field that can be null, is
`pierre.Opt[T]`:

- The zero value is omitted: the request does not send it, so the server keeps the stored value.
- `pierre.String`, `pierre.Int`, `pierre.Float`, `pierre.Bool`, and `pierre.Value` give a value.
- `pierre.Null[T]()` gives `null`, which resets the stored value.

A response field that is optional or can be null is an `Opt` too: `Get` gives the value and whether
the response has one, and `IsNull` reports `null`. An enum is a string type with a constant for each
known value, and a response can hold a value that this SDK version does not list.

The params of a method do not have the deprecated parameters and body fields of the API. Use the
current names, for example `ExpectedTargetSHA` in place of `expected_head_sha`. A type of a nested
request field, such as `pierre.BaseRepo`, and a response type keep their deprecated fields, each
with a `Deprecated:` comment that Go tools show. In a request, use the field that the comment names.

## Credentials

Give one credential. A credential option replaces every credential of the environment.

| Option                  | Variable                                                       | Use                                                                                     |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `option.WithPrivateKey` | `PIERRE_PRIVATE_KEY`, or the file at `PIERRE_PRIVATE_KEY_FILE` | The SDK signs a 5-minute token for each request, with only the scopes of the operation. |
| `option.WithToken`      | `PIERRE_TOKEN`                                                 | A fixed token. The server checks its scopes.                                            |
| `option.WithGetToken`   | none                                                           | A function that returns a token for each request, for a client with no private key.     |

With no credential option, the SDK uses the first variable that is set: `PIERRE_TOKEN`, then
`PIERRE_PRIVATE_KEY`, then `PIERRE_PRIVATE_KEY_FILE`.

`option.WithOrg` (`PIERRE_ORG`) names the organization. With a token, the SDK reads it from the
`iss` claim. `option.WithBaseURL` (`PIERRE_API_BASE_URL`) and `option.WithGitHost`
(`PIERRE_GIT_HOST`) replace the default hosts, `https://api.{org}.code.storage` and
`{org}.code.storage`. The base URL ends before `/api`, because each operation path starts with
`/api`: for example `https://api.acme.code.storage`, not `https://api.acme.code.storage/api/v1`. A
path in front of `/api`, such as the prefix of a proxy, stays in the base URL. The Git host is a
host name with an optional port and no scheme, for example `acme.code.storage`. `pierre.NewClient`
reads the private key and returns an error for a key that it cannot read.

## Options

One `option.RequestOption` serves a client and one request. Give it to `pierre.NewClient` or
`client.WithOptions` for the client default, or to a method for one call.

- For a client or one call: `option.WithTimeout` (60 seconds for each attempt),
  `option.WithMaxRetries` (2), `option.WithHeader`, and `option.WithRefPolicies`.
- For a client only: `option.WithOrg`, the credentials, `option.WithBaseURL`, `option.WithGitHost`,
  and `option.WithHTTPClient`.
- For one call only: `option.WithIdempotencyKey`, `option.WithTokenTTL` (1 second to 1 hour), and
  `option.WithResponseInto`.

`option.WithIdempotencyKey` applies only to an operation that accepts an `Idempotency-Key`. On any
other operation, the method returns a `*pierre.PierreError` and sends no request.

`option.WithHeader("Pierre-Client", ...)` replaces `Pierre-Client: pierre-sdk-go/<version>`, for
example with `pierre-cli/<version>`. `client.Options()` returns the settings, with no credential,
and `client.WithOptions(...)` returns a copy with changed options.

## Ref policies

`option.WithRefPolicies` limits the refs that a write can change. The SDK puts the rules in the
`refs` claim of each request token, and the first rule whose pattern matches a ref applies.

```go
confined, err := client.WithOptions(option.WithRefPolicies(
	option.RefPolicy{Pattern: "agent/*"},
	option.RefPolicy{Pattern: "*", Ops: []string{"no-push"}},
))
```

- A request option replaces the client option for that call, and `option.WithRefPolicies()` with no
  rule removes it.
- The function of `option.WithGetToken` receives the rules. A client with a fixed token cannot use
  ref policies, because the SDK cannot change the claims of that token.
- `git.RemoteURL` and `auth.CreateToken` use the rules of the client when the call gives none, so a
  confined client stays confined through Git.

## Copies, retries, and commits

`client.Repos.Create` names a new repository with a UUID when the params give no `RepoName`. With
`BaseRepo: pierre.Value(pierre.BaseRepo{Name: ...})`, it copies a Code Storage repository, and adds
a `git:read` token for the source when you give none.

The SDK retries a connection error, a timeout, 408, 429, 5xx, and 409 `repository_thawing` or
`sync_in_progress`, for `GET`, `HEAD`, `PUT`, and `DELETE`, and for a request with an
`Idempotency-Key`. It waits for `Retry-After` up to 60 seconds, or else backs off from 0.5 seconds.
It does not retry a streaming commit.

`client.Repos.Commits.Create` takes the files of a commit as `Files []pierre.CommitFile`, or as
`FileSeq iter.Seq[pierre.CommitFile]`. A file has `Content`, an `io.Reader`, or `Open`, a function
that the SDK calls when it sends that file, so that only one file is open at a time.

## Responses

A method returns a pointer to the JSON body, `io.ReadCloser` for a byte stream, or
`*pierre.HeadersResult[H]` for a response with no body: the status, and the response headers that
the docs declare. Close the stream of a byte read. The timeout of a byte read ends with the headers,
so you can read a slow body.

`option.WithResponseInto(&response)` stores the HTTP response of the last attempt, with every
response header, for example `X-Request-Id` and the headers that the docs declare.

## Lists

A list method returns the first page, a `*pierre.Page[Item, Body]` with `Data`, `HasMore`,
`NextCursor`, `Body`, and `Response`. `page.All(ctx)` iterates over the items of every page from
that page on, `page.IterPages(ctx)` over the pages, and `page.HasNextPage()` and
`page.GetNextPage(ctx)` move one page at a time. Each next page sends the params and the request
options of the first call. `json.Marshal(page)` encodes `page.Body`, the response that the API sent.

## Errors

Each error of the SDK unwraps to a `*pierre.PierreError`. Branch with `errors.As`:

- `*pierre.APIError` for an HTTP error response, with `Status`, `Code`, `Title`, `Detail`,
  `RequestID`, `Headers`, `Body`, and `DocURL`. Each status family has its own type, which unwraps
  to the `*APIError`: `BadRequestError`, `AuthenticationError`, `PermissionDeniedError`,
  `NotFoundError`, `ConflictError`, `RateLimitError`, and `InternalServerError`.
- `*pierre.MergeConflictError` for a merge conflict, and `*pierre.RefUpdateError` for a Git write
  whose ref update failed, with `Result` and `Commit`. `Result` is a decoded `RefUpdateResult`, so
  `Result.Status` gives the reason, for example `conflict`. `Body` holds the response as it arrived.
- `*pierre.RefGuardError` for a failed ref guard, with the code `ref_guard_failed`. It unwraps to a
  `*ConflictError`, with `Guard` and `CurrentSHA`: send `CurrentSHA` as the guard of the next
  attempt.
- `*pierre.APIConnectionError` when the request got no response, and `*pierre.APITimeoutError` when
  the timeout of the attempt passed.

The end of the context of the call returns the cause of the context. The error of a function of the
caller, such as `Open` or the function of `option.WithGetToken`, reaches the caller as it is.

## Local utilities

- `auth.CreateToken(ctx, client, params)` signs a token with the key of a client, or with
  `auth.KeyCredentials{Org, PrivateKey}`. The default lifetime is 15 minutes, and the maximum is 1
  hour. `auth.Scopes` lists the scopes of the API.
- `git.RemoteURL(ctx, client, params)` builds `https://t:<token>@{gitHost}/{repo_name}.git`, in the
  kind `git.KindDefault`, `git.KindEphemeral`, or `git.KindImport`.
- `webhooks.VerifyWebhook(params)` checks the `X-Pierre-Signature` header and returns the typed
  event, such as `*pierre.GitPushEvent`, or a `*webhooks.UnknownEvent` for a type that this SDK
  version does not know.
