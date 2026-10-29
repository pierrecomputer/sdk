# @pierre/cli

`pierre` is the command-line tool for [Code Storage](https://code.storage). Each API command calls
one operation of the HTTP API through `@pierre/sdk`, with the same name and the same fields as the
SDK method. The helpers store a private key and make plain Git work against every Code Storage
repository.

## Docs for agents

Read the docs through the MCP server first, then as Markdown pages:

- MCP server: https://code.storage/docs/mcp
- Index of the Markdown pages: https://code.storage/docs/llms.txt

Each operation has a catalog ID, for example `repos.branches.create`. Search for the catalog ID in
the docs. `pierre mcp` prints the MCP server and the command that installs the `pierre` agent skill.

## Install

Install the canary, or run it with no install:

```sh
npm install -g @pierre/cli@canary
pierre version

npx @pierre/cli@canary version
```

A canary version is `0.1.0-canary.N`, and its commands can change with no notice. To keep a build
repeatable, use an exact version: `"@pierre/cli": "0.1.0-canary.6"` in `package.json`, or
`@pierre/cli@0.1.0-canary.6` with `npm` and `npx`.

The CLI needs Node.js 22.23.4 or a later 22 release, 24.22.1 or a later 24 release, or 26.12.1 or
later. Run `pierre auth setup-git` from a global install: Git stores the path of that `pierre`, and
`npx` and `pnpm dlx` run the CLI from a cache that can change.

## Quick start

Create a key on the **Keys** page of your organization dashboard, and keep the private key in your
secrets manager. Then store it, and let Git get its credential from `pierre`:

```sh
pierre auth login --hostname acme.code.storage --with-key < key.pem
pierre auth setup-git
```

Create a repository, and push a local repository to it:

```sh
pierre repos create my-app
git remote add storage https://acme.code.storage/my-app.git
git push -u storage main
```

`git clone https://acme.code.storage/my-app.git`, `git fetch`, and `git push` now work. No token
appears in a URL or in a file.

### CI and containers

Configure Git when you build the image. Put no secret in the image.

```sh
pierre auth setup-git --hostname acme.code.storage
```

At runtime, set `PIERRE_PRIVATE_KEY` to the private key PEM, so that no key touches the disk. The
other variables depend on the command and the host:

- Git on an `<org>.code.storage` host needs no other variable. The helper takes the organization
  from the host that Git sends.
- An API command takes the organization from an `<org>.code.storage` remote of the current clone.
  Outside such a clone, also set `PIERRE_ORG`.
- A host on another domain needs `PIERRE_ORG` for Git, and also `PIERRE_GIT_HOST` and
  `PIERRE_API_BASE_URL` for an API command.

A job with no private key can set `PIERRE_TOKEN` to a token that another system signed. The CLI and
the Git helper send that token and sign nothing. The claims of the token limit what the job can do.

A job with no hosts file sets the organization and, for a host outside `<org>.code.storage`, the
hosts, as for the SDKs:

```sh
export PIERRE_ORG=acme
export PIERRE_PRIVATE_KEY="$(cat key.pem)"
export PIERRE_GIT_HOST=git.example.com
export PIERRE_API_BASE_URL=https://api.example.com
pierre repos list --json
```

## API commands

The command is the catalog ID with `:` between the resources, then the method. The flags are the
fields of the SDK method, with the wire names in kebab-case:

| Catalog ID              | SDK method                       | Command                                                                                  |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `repos.list`            | `pierre.repos.list()`            | `pierre repos list`                                                                      |
| `repos.get`             | `pierre.repos.get()`             | `pierre repos get acme/web`                                                              |
| `repos.branches.create` | `pierre.repos.branches.create()` | `pierre repos:branches create --repo-name acme/web --target-branch feat --base-ref main` |

`pierre --help` lists every API command, and `pierre <resource> <method> --help` gives its flags,
its catalog ID, its HTTP route, and its scopes.

- **Singular nouns.** `pierre repo list` and `pierre repo:branch create` run the plural commands.
  `pierre repo view` runs `pierre repos get`.
- **One argument.** A command takes at most one positional argument: the resource it acts on. Its
  flag works too: `pierre repos:branches create feat` equals
  `pierre repos:branches create --target-branch feat`.
- **The repository.** `-R` is the short form of `--repo-name`. Inside a clone with a Code Storage
  remote, `--repo-name` defaults to that repository, except for `repos delete`:

  ```sh
  pierre repos:branches create feat -R acme/web --base-ref main
  cd web && pierre repos:branches create feat --base-ref main
  ```

- **Flag values.** A boolean is `--force` or `--no-force`. An array takes its flag once for each
  item. An object takes JSON, `@file`, or `@-` for stdin, and each of its scalar fields also has a
  dotted flag: `--author.name A --author.email a@example.com`.
- **Content.** `pierre repos:commits create` takes `--file <path>` for each file to add or change,
  read from the same path under the current directory, and `--delete <path>` for each file to
  delete. `pierre repos:commits create-from-diff` takes `--diff <file>`, or `--diff -` for stdin.
- **Output.** `--json` prints the response body. Without it, an object prints one row for each
  field, and a list prints a table. A list prints one page: `--limit` and `--cursor` are the wire
  fields, and `--paginate` reads every page. A byte response, such as `pierre repos:files get`,
  writes to stdout or to `--output <file>`.
- **Status.** When an operation can answer with more than one success status, the output starts with
  the status. `pierre repos create` prints `201 Created` for a new repository, and `200 OK` for an
  existing one.
- **Confirmation.** `pierre repos delete` asks first. Pass `--yes` with no terminal.

### pierre api

`pierre api <catalog-id>` calls any operation through its SDK method, and prints the JSON response
body. As in `gh api`, path parameters are fields:

```sh
pierre api repos.branches.create -F repo_name=acme/web -F target_branch=feat -F base_ref=main
```

- `-F key=value` sends a typed value: `true`, `false`, `null`, an integer, `@file`, `@-`, or text.
  `-F key[name]=value` sets a field of an object. `-F key[]=value` adds an item to an array, and so
  does `-F key=value` for an array field. Give the flag once for each item.
- `-f key=value` sends a string.
- `--input <file>` (`-` for stdin) gives the body fields as one JSON object. Then `-F` and `-f` set
  only path, query, and header fields.
- A field that the operation does not have is a usage error.

## Helpers

```
pierre auth login [--hostname <host>] [--org <org>] [--api-url <url>] [--from-file <path>] [--no-verify] --with-key
pierre auth status [--hostname <host>] [--json]
pierre auth logout [--hostname <host>] [--yes]
pierre auth token [--repo <repo>] [--scope <scope>]... [--ttl <duration>] [--hostname <host>]
pierre auth setup-git [--hostname <host>] [--local] [--read-only] [--uninstall]
pierre auth git-credential <get|store|erase>          # called by Git
pierre api <catalog-id> [-F key=value]... [-f key=value]... [--input <file>]
pierre mcp [--json]
pierre version [--json]
```

- `pierre auth login` checks the key with `repos.list`, then stores it under
  `~/.config/pierre/keys/`. It prints the host, the organization, the key file, and the key ID.
- `pierre auth status` reports each host: the organization, the key source, the key ID, a live
  check, and the Git helper settings.
- `pierre auth token` prints a token from `createToken` of `@pierre/sdk/auth`. `--scope` takes a
  scope of `SCOPES` from `@pierre/sdk/auth`, and defaults to `git:read` and `git:write`. An unknown
  scope is a usage error that lists the scopes of `SCOPES`. A token whose scopes all cover the
  organization (`org:read`) has no `repo` claim. Another token needs `--repo`, which defaults to the
  Code Storage remote of the current repository. `--ttl` defaults to 15 minutes, up to 1 hour.
- `pierre auth setup-git` configures Git to get its credential from `pierre` (see
  [Git credential helper](#git-credential-helper)).
- `pierre mcp` prints the docs MCP server, the Markdown index, the auth note, and the skill command,
  and the organization and API URL of the selected host when they resolve. It reads the MCP server
  from `https://code.storage/.well-known/mcp.json`, with a 15-second timeout, and prints
  `https://code.storage/docs/mcp` when that request fails. `PIERRE_DASHBOARD_URL` replaces
  `https://code.storage`. `--json` prints a config block for an MCP client.

### Global flags

| Flag                | Meaning                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `--debug`           | Print diagnostics to stderr. Never prints a token                                                 |
| `-h`, `--help`      | Show help                                                                                         |
| `--hostname <host>` | Select a tenant by its Git host. Overrides `PIERRE_GIT_HOST` and the current repository's remote. |
| `--json`            | Print the JSON response body                                                                      |
| `--no-input`        | Fail instead of prompt                                                                            |
| `--quiet`           | Print only results and errors                                                                     |
| `-v`, `--version`   | Print the CLI version                                                                             |
| `--yes`             | Skip confirmations                                                                                |

### Exit codes

The exit code comes from the class of the SDK error, never from the message text.

| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 0    | Success                                                          |
| 1    | Another API error, such as a conflict or a 5xx, or no connection |
| 2    | Usage error                                                      |
| 3    | Credential problem: no key, a malformed key, 401, or 403         |
| 4    | Not found: 404                                                   |

An API error prints its status, its problem `code`, its detail, the request ID, and the docs of the
code. With `--json`, the CLI also prints the problem details body on stdout.

## Configuration

Configuration lives in `~/.config/pierre/`. When `XDG_CONFIG_HOME` is set, that directory replaces
`~/.config`. `PIERRE_CONFIG_DIR` replaces the whole path.

- `hosts.yml` holds one entry per Git host:

  ```yaml
  acme.code.storage:
    org: acme
    apiUrl: https://api.acme.code.storage/api/v1
    keyFile: /Users/me/.config/pierre/keys/acme.code.storage.pem
  git.example.com:
    org: acme
    apiUrl: https://api.example.com/api/v1
    keyFile: /Users/me/.config/pierre/keys/git.example.com.pem
  ```

- `keys/<host>.pem` holds the private key. The file has mode 600 and the directory has mode 700.

A host in the `<org>.code.storage` shape needs no `--org` and no `--api-url`. A host on another
domain needs both once, at login:

```sh
pierre auth login --hostname git.example.com --org acme --api-url https://api.example.com/api/v1 --with-key < key.pem
```

These values have separate roles:

| Flag         | Purpose                                                                                 | Example                   |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------- |
| `--hostname` | The Git host. It selects the saved configuration and the Git credential helper.         | `git.example.com`         |
| `--org`      | The organization that owns the key. The CLI puts this value in the token's `iss` claim. | `acme`                    |
| `--api-url`  | The REST API endpoint for the API commands, such as `repos list`.                       | `https://api.example.com` |

The hostname accepts an `http://` or `https://` prefix, but stores only the host. The API URL needs
a scheme because it sets the HTTP transport. The API URL accepts an origin or a base URL that ends
in `/api/v1`.

Several organizations can share one API URL. The server uses the signed token to identify the
organization. For example, `acme.example.com` and `beta.example.com` can both use
`https://api.example.com`, with separate organization names and keys. Get these values from the
service configuration; a custom Git hostname alone does not establish the organization or API URL.

Other clusters use a separate API URL for each tenant. Do not assume that an API URL which works for
one tenant also works for another.

Use `pierre auth status --hostname <host>` to inspect the saved organization and API URL. If you
repeat login for a custom host, pass `--org` and `--api-url` again.

### Environment variables

| Variable                  | Meaning                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `PIERRE_API_BASE_URL`     | The API base URL, for a host with no host entry. An origin or a URL that ends in `/api/v1`                                     |
| `PIERRE_CONFIG_DIR`       | Replaces `~/.config/pierre`                                                                                                    |
| `PIERRE_DASHBOARD_URL`    | The origin of the agent discovery documents for `mcp`. Default `https://code.storage`                                          |
| `PIERRE_DEBUG`            | Helper diagnostics to stderr                                                                                                   |
| `PIERRE_GIT_HOST`         | The Git host when no `--hostname` is given. It selects the host entry of that host, or else uses the variables, as the SDKs do |
| `PIERRE_ORG`              | The org, for an environment with no hosts table or a host outside the default shape                                            |
| `PIERRE_PRIVATE_KEY`      | The private key PEM itself, or the PEM on one line with a literal `\n` for each line break. Nothing is read from disk          |
| `PIERRE_PRIVATE_KEY_FILE` | A path to the private key                                                                                                      |
| `PIERRE_TOKEN`            | A JWT to send on each call. The CLI signs no token and needs no private key. The token's claims set its access                 |
| `PIERRE_TOKEN_TTL`        | Helper token lifetime in seconds, from 1 to 3600. Default 3600                                                                 |

Each token that the CLI signs has the key ID as its JWT `kid` header. The key ID is the hex SHA-256
of the public key, and `pierre auth status` shows it.

### Resolution rules

First match wins.

- **Host**, the Git host:
  1. `--hostname`.
  2. `PIERRE_GIT_HOST`.
  3. A remote of the current repository: first a remote whose host has a host entry, then a remote
     on an `<org>.code.storage` host. In each group, the remote named `storage` comes first. The CLI
     does not use a remote on another host.
  4. The only host entry, when `hosts.yml` has exactly one.
  5. `<org>.code.storage`, when `hosts.yml` has no entry, for the org from `PIERRE_ORG` or the `iss`
     claim of `PIERRE_TOKEN`.

  With several host entries and none of the first three, the command exits 2 and lists the hosts. A
  host with a host entry uses its org, its API URL, and its key file. Another host uses the
  variables.

- **Credential**: `PIERRE_TOKEN`, `PIERRE_PRIVATE_KEY`, `PIERRE_PRIVATE_KEY_FILE`, the host entry's
  key file.
- **Org**: the host entry, `PIERRE_ORG`, the `iss` claim of `PIERRE_TOKEN`, the subdomain of a
  `*.code.storage` host.
- **API URL**: the host entry, `PIERRE_API_BASE_URL`, `https://api.<org>.code.storage/api/v1`.

## Git credential helper

Code Storage Git remotes use HTTP Basic authentication: the username is the literal `t`, and the
password is a JWT that your private key signs. `pierre auth setup-git` writes these Git settings
once per host:

```ini
[credential "https://acme.code.storage"]
	helper =
	helper = !/usr/local/bin/pierre auth git-credential
	useHttpPath = true
```

The blank `helper` line stops Git from asking another helper, such as a keychain, for this host.
`useHttpPath` makes Git send the repository path, which the helper needs.

The helper command starts with an absolute path. `setup-git` selects it as follows:

- When a `pierre` on `PATH` starts this CLI, the helper is the path of that `pierre`. It is a link
  from `npm install -g`, `npm link`, or `bun add -g`, or the script that `pnpm add -g` writes, such
  as `~/Library/pnpm/bin/pierre`. The path stays the same when the CLI or Node.js changes version.
  This command runs `node` from the `PATH` that Git uses.
- Otherwise, the helper names the Node.js executable and the CLI script:
  `!<path of node> <path of dist/cli.js> auth git-credential`. For example, `npm install -g` under
  proto puts its link in a directory that is not on `PATH`. This command needs no `PATH`, but it
  names one Node.js version and one CLI location. Run `pierre auth setup-git` again after a change
  of either.

`npx` and `pnpm dlx` run the CLI from a cache that can change or expire. `setup-git` shows a warning
when the helper path is in one of these caches.

On each Git operation:

1. Git runs `pierre auth git-credential get` and writes the protocol, the host, and the path to its
   stdin.
2. The helper takes the repository from the path: it strips `.git`, strips a `+ephemeral` or
   `+import` suffix, and decodes each segment.
3. It resolves the org from the host and the credential by the
   [resolution rules](#resolution-rules). When `PIERRE_TOKEN` is set, it prints that token and skips
   the next step.
4. It signs a token with `git:read` and `git:write`, or `git:read` only in read-only mode, that
   lives for one hour by default. `PIERRE_TOKEN_TTL` sets another lifetime in seconds, up to one
   hour.
5. It prints `username=t` and `password=<token>`. It stores nothing.

On any failure the helper prints `quit=true`, so Git never falls through to a password prompt, and
one line to stderr that names the cause.

`store` and `erase` do nothing, because nothing is persisted.

Remove the settings with `pierre auth setup-git --uninstall`.

## Troubleshooting

| Message                                                 | Cause                                                                  | Fix                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `credential helper: Git sent no path`                   | `useHttpPath` is not set for the host                                  | Run `pierre auth setup-git`                                                                               |
| `credential helper: No private key is configured`       | No key file for the host and no `PIERRE_PRIVATE_KEY`                   | Run `pierre auth login --hostname <host> --with-key`                                                      |
| `credential helper: Cannot derive the organization`     | The host is outside `<org>.code.storage` and has no host entry         | Log in with `--org` and `--api-url`, or set `PIERRE_ORG`                                                  |
| `The private key is on one line` (exit 3)               | The paste lost its newlines, from a text selection or a password field | Use the dashboard copy button, and store the key in a multi-line field                                    |
| `401 unauthorized` or `403 insufficient_scope` (exit 3) | The server rejected the token or its permissions                       | Read the server's error detail. Check the organization, key, and permissions, then use the retry command. |
| `git push` fails with `403`                             | The machine is in read-only mode                                       | Run `pierre auth setup-git` without `--read-only`                                                         |
| `node: not found` or `env: node: No such file`          | Git has no `node` on its `PATH`, for example in an app from the Dock   | Start the Git app from a shell, or put `node` on the `PATH` of the app                                    |
| `Cannot find module` or `<path>/node: No such file`     | The helper names a Node.js or CLI path that an update removed          | Run `pierre auth setup-git` again                                                                         |

### Rotate a key

1. Create a new key on the dashboard **Keys** page.
2. Store it for the same host. This replaces the key file and the host entry, so no logout is
   needed:

   ```sh
   pierre auth login --hostname acme.code.storage --with-key < new-key.pem
   ```

3. Confirm with `pierre auth status`. The key ID changes and the live check passes.
4. Delete the old key on the dashboard.

`pierre auth logout` deletes the local key file only. Use it when a machine must stop using a key,
then revoke the key on the dashboard.

## License

Apache 2.0. See `LICENSE`. `dist/cli.js` bundles its dependencies, and
`dist/THIRD_PARTY_LICENSES.txt` gives the license of each bundled package.
