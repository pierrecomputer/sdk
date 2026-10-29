# @pierre/sdk

The Pierre SDK for TypeScript.

## Docs for agents

Read the docs through the MCP server first, then as Markdown pages:

- MCP server: https://code.storage/docs/mcp
- Index of the Markdown pages: https://code.storage/docs/llms.txt
- Each page as Markdown: add `.md` to its URL, for example https://code.storage/docs/api/overview.md

Each method has a catalog ID, for example `repos.branches.create`. The SDK path is the catalog ID,
and the fields are the HTTP wire names. Search for the catalog ID in the docs.

## Install

```sh
npm install @pierre/sdk@canary
```

A canary version is `0.1.0-canary.N`, and its API can change with no notice. To keep a build
repeatable, put an exact version in `package.json`, for example `"@pierre/sdk": "0.1.0-canary.5"`.

On Node.js, the SDK needs 22.23.4 or a later 22 release, 24.22.1 or a later 24 release, or 26.12.1
or later.

## Start

```ts
import { Pierre } from '@pierre/sdk';

const pierre = new Pierre(); // reads PIERRE_ORG and PIERRE_PRIVATE_KEY

const meta = await pierre.meta.get();
await pierre.repos.branches.create({
  repo_name: 'acme/web',
  target_branch: 'feat',
  base_ref: 'main',
});
for await (const branch of pierre.repos.branches.list({ repo_name: 'acme/web' })) {
  console.log(branch.name);
}
```

## Credentials

Give one credential. A credential in the options replaces every credential in the environment.

| Option       | Variable                                                       | Use                                                                                     |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `privateKey` | `PIERRE_PRIVATE_KEY`, or the file at `PIERRE_PRIVATE_KEY_FILE` | The SDK signs a 5-minute token for each request, with only the scopes of the operation. |
| `token`      | `PIERRE_TOKEN`                                                 | A fixed token. The server checks its scopes.                                            |
| `getToken`   | none                                                           | A function that returns a token for each request, for a browser or an edge runtime.     |

With no credential in the options, the SDK uses the first variable that is set: `PIERRE_TOKEN`, then
`PIERRE_PRIVATE_KEY`, then `PIERRE_PRIVATE_KEY_FILE`.

`org` (`PIERRE_ORG`) names the organization. With `token`, the SDK reads it from the `iss` claim.
`baseUrl` (`PIERRE_API_BASE_URL`) and `gitHost` (`PIERRE_GIT_HOST`) replace the default hosts,
`https://api.{org}.code.storage` and `{org}.code.storage`. The base URL ends before `/api`, because
each operation path starts with `/api`: for example `https://api.acme.code.storage`, not
`https://api.acme.code.storage/api/v1`. A path in front of `/api`, such as the prefix of a proxy,
stays in the base URL. The Git host is a host name with an optional port and no scheme, for example
`acme.code.storage`.

## Options

Client options: `timeout` (60000 ms for each attempt), `maxRetries` (2), `defaultHeaders`, `fetch`,
and `refPolicies`. `defaultHeaders` can replace `Pierre-Client: pierre-sdk-typescript/<version>`,
for example with `pierre-cli/<version>`. `pierre.options` holds the settings, and
`pierre.withOptions({ ... })` returns a copy with changed options.

Request options, the second argument of each method: `signal`, `timeout`, `maxRetries`,
`idempotencyKey`, `headers`, `tokenTtl` (in seconds, up to 3600), and `refPolicies`.

`idempotencyKey` applies only to an operation that accepts an `Idempotency-Key`. On any other
operation, the call fails with a `PierreError` and sends no request.

## Ref policies

`refPolicies` limits the refs that a write can change. The SDK puts the rules in the `refs` claim of
each request token, and the first rule whose pattern matches a ref applies.

```ts
const confined = pierre.withOptions({
  refPolicies: [
    { pattern: 'agent/*', ops: [] },
    { pattern: '*', ops: ['no-push'] },
  ],
});
```

- A pattern is a full ref name (`refs/heads/main`), a branch name (`main`), a prefix that ends with
  `/*`, or `*`. The ops are `no-push`, `no-force-push`, and `verify-sig`.
- A request option replaces the client option for that call, and `refPolicies: []` removes it.
- `getToken` receives the rules as `ref_policies`. A client with a fixed `token` cannot use
  `refPolicies`, because the SDK cannot change the claims of that token.
- `remoteUrl` and `createToken` use the client's rules when the call gives no `ref_policies`, so a
  confined client stays confined through Git.

## Copies

`repos.create` with `base_repo: { name }` copies a Code Storage repository. The SDK adds
`base_repo.auth.token`, a `git:read` token for the source, when you give none. A client with a fixed
`token` must give it.

The SDK retries a connection error, a timeout, 408, 429, 5xx, and 409 `repository_thawing` or
`sync_in_progress`, for `GET`, `HEAD`, `PUT`, and `DELETE`, and for a request with an
`Idempotency-Key`. It waits for `Retry-After` up to 60 seconds, or else backs off from 0.5 seconds.
It does not retry a streaming commit.

## Responses

Each method returns an `APIPromise`. The request starts when you call the method. `await` gives the
result: the JSON body, `{ status, headers }` for a response with no body, or the platform `Response`
for a byte stream.

```ts
const { data, headers, request_id, response } = await pierre.repos.grep(params).withResponse();
console.log(headers.x_cache); // 'HIT', 'MISS', or undefined

const raw = await pierre.repos.archive.get({ repo_name: 'acme/web' }).asResponse();
```

- `withResponse()` gives the result with `response`, the platform response of the last attempt,
  `headers`, and `request_id`, the `X-Request-Id` header or `null`.
- `headers` holds the response headers that the docs declare for the operation, with the wire form
  of each name: `x_cache`, `etag`, `x_blob_sha`. Each field is optional and holds the header text.
  In a browser, the SDK can read only the headers that the API exposes through CORS.
- `asResponse()` gives the platform response when its headers arrive, and does not read the body.
  You read the body, so the timeout ends with the headers, and the SDK does not retry the body.
- `await`, `withResponse()`, and `asResponse()` read the same request. After `await` or
  `withResponse()`, the body of the response is already read.

## Lists

A list method returns the first page. `for await` on the result iterates over the items of every
page.

```ts
const first = await pierre.repos.files.metadata.list({ repo_name: 'acme/web' });
for await (const page of first.iterPages()) {
  console.log(page.data.length, Object.keys(page.body.commits).length);
}
```

A page has `data`, `has_more`, `next_cursor`, `body`, and `response`. `body` is the full response
body, with the fields beside the items. `hasNextPage()` and `getNextPage()` move one page at a time,
and `getNextPage()` sends the params and the request options of the first call. `withResponse()` and
`asResponse()` on a list give the response of the first page. `JSON.stringify(page)` gives
`page.body`, the response that the API sent.

## Errors

Every error extends `PierreError`. An HTTP error is an `APIError` with `status`, `code`, `title`,
`detail`, `request_id`, `headers`, `body`, and `doc_url`. `headers` holds the response headers, for
example `error.headers.get('retry-after')`. Branch on `code`, not on the message. Each status family
has a class, for example `NotFoundError` and `ConflictError`. A failed ref update raises
`RefUpdateError`, with `result` and `commit`. `result` is a `RefUpdateResult`, or a
`NotesWriteResult` for a notes write, so `error.result.status` gives the reason with no cast, for
example `conflict`. A failed ref guard, with the code `ref_guard_failed`, raises `RefGuardError`, a
`ConflictError` with `guard` and `current_sha`: send `current_sha` as the guard of the next attempt.
The codes: https://code.storage/docs/api/overview.md#error-codes

## Subpaths

| Import                 | Exports                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `@pierre/sdk`          | `Pierre`, with every namespace, the errors, and the types                      |
| `@pierre/sdk/core`     | `PierreCore`, the client with no namespaces, and the errors                    |
| `@pierre/sdk/repos`    | `ReposNamespace`, built with `new ReposNamespace(new PierreCore())`            |
| `@pierre/sdk/auth`     | `createToken`, which signs a token with no HTTP call, and `SCOPES`             |
| `@pierre/sdk/git`      | `remoteUrl`, which builds a Git remote URL with a token in it                  |
| `@pierre/sdk/webhooks` | `verifyWebhook`, which checks `X-Pierre-Signature` and returns the typed event |

No subpath loads another, so a browser or edge bundle holds only what it imports.

```ts
import { createToken } from '@pierre/sdk/auth';
import { remoteUrl } from '@pierre/sdk/git';

const token = await createToken(pierre, { scopes: ['org:read'], ttl: 900 });
const url = await remoteUrl(pierre, { repo_name: 'acme/web' }); // https://t:<token>@acme.code.storage/acme/web.git
```

`remoteUrl` gives a token with `git:read` and `git:write` that lives 15 minutes, up to 1 hour with
`ttl`. `kind: 'ephemeral'` or `kind: 'import'` gives the `+ephemeral` or `+import` remote. It takes
`ref_policies`, and works with a private key or `getToken`. For longer work, use the credential
helper (`pierre auth setup-git`).

## License

Apache 2.0.

