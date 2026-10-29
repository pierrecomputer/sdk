// `@pierre/sdk/git`: builds a Git remote URL with a token in it. It
// loads no client code: it reads the credentials of a client from the registry in
// `credentials.ts`.
import { checkRefPolicies, checkTtl, clientKey } from './runtime/credentials.js';
import { PierreError } from './runtime/errors.js';
const SUFFIXES = {
    default: '',
    ephemeral: '+ephemeral',
    import: '+import',
};
const DEFAULT_SCOPES = ['git:read', 'git:write'];
/** A token in a remote URL lives 15 minutes by default. */
const DEFAULT_TTL_SECONDS = 15 * 60;
/**
 * Builds `https://t:<token>@{gitHost}/{repo_name}.git` for `git clone`, `git fetch`, and
 * `git push`. The token is a bearer credential that Git copies into `.git/config`, so keep the
 * lifetime short. Longer work uses the credential helper (`pierre auth setup-git`).
 *
 * The client signs the token with its private key, or gets it from `getToken`. A client with a
 * fixed `token` cannot set the claims of its token, so it raises `PierreError`.
 *
 * Docs: search for `remoteUrl` in the docs MCP server, https://code.storage/docs/mcp.
 */
export async function remoteUrl(client, params) {
    const key = clientKey(client);
    if (key === undefined) {
        throw new PierreError('Give a client from `new PierreCore()` or `new Pierre()`.');
    }
    if (key.credentials.fixed) {
        throw new PierreError('`remoteUrl` needs a client with `privateKey` or `getToken`. A client with a fixed `token` cannot set the claims of its token.');
    }
    const gitHost = hostOf(client.options.gitHost);
    const path = repositoryPath(params.repo_name);
    const kind = params.kind ?? 'default';
    const suffix = Object.hasOwn(SUFFIXES, kind) ? SUFFIXES[kind] : undefined;
    if (suffix === undefined) {
        throw new PierreError('`kind` must be `default`, `ephemeral`, or `import`.');
    }
    const scopes = params.scopes ?? DEFAULT_SCOPES;
    if (scopes.length === 0)
        throw new PierreError('`scopes` must name at least one scope.');
    const ttl = checkTtl(params.ttl ?? DEFAULT_TTL_SECONDS, 'ttl');
    const refPolicies = checkRefPolicies(params.ref_policies, 'ref_policies') ?? client.options.refPolicies ?? [];
    const token = await key.credentials.token({
        scopes,
        // An ephemeral or import remote uses the token of its repository.
        repo: params.repo_name,
        ttl,
        ...(refPolicies.length > 0 ? { ref_policies: refPolicies } : {}),
    });
    const url = new URL(`https://${gitHost}/${path}${suffix}.git`);
    url.username = 't';
    url.password = token;
    return url.toString();
}
/**
 * The Git host of the client: a host name with an optional port. A scheme, a path, or another URL
 * part would send the token to another host.
 */
function hostOf(gitHost) {
    if (gitHost === undefined) {
        throw new PierreError('`remoteUrl` needs the Git host. Set `org` or `gitHost`.');
    }
    let url;
    try {
        url = new URL(`https://${gitHost}`);
    }
    catch {
        url = undefined;
    }
    if (url === undefined ||
        // The parser drops the default port.
        url.host !== gitHost.toLowerCase().replace(/:443$/, '') ||
        url.pathname !== '/' ||
        url.username !== '' ||
        url.password !== '') {
        throw new PierreError('`gitHost` must be a host name with an optional port, for example `acme.code.storage`.');
    }
    return url.host;
}
/** The URL path of a repository name: each segment percent-encoded, with `/` between them. */
function repositoryPath(name) {
    if (typeof name !== 'string' || name === '') {
        throw new PierreError('`repo_name` must be a non-empty string.');
    }
    const segments = name.split('/');
    // The URL parser resolves `.` and `..`, which would name another repository.
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        throw new PierreError(`\`repo_name\` cannot have an empty, \`.\`, or \`..\` segment: ${name}`);
    }
    return segments.map(encodeURIComponent).join('/');
}
//# sourceMappingURL=git.js.map