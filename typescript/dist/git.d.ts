import type { PierreCore } from './runtime/client.ts';
import { type RefPolicy } from './runtime/credentials.ts';
export type { RefPolicy } from './runtime/credentials.ts';
export interface RemoteUrlParams {
    /** The repository name, for example `acme/web`. */
    repo_name: string;
    /** The scopes of the token. Default: `git:read` and `git:write`. */
    scopes?: readonly string[];
    /** The lifetime of the token in seconds, from 1 to 3600. Default: 900 (15 minutes). */
    ttl?: number;
    /**
     * The rules of the `refs` claim. Default: the client's `refPolicies`, so a confined client stays
     * confined through Git. An empty list adds no claim.
     */
    ref_policies?: readonly RefPolicy[];
    /**
     * The form of the remote: `default`, `ephemeral` (`+ephemeral`, refs apart from the default
     * namespace), or `import` (`+import`). Default: `default`.
     */
    kind?: 'default' | 'ephemeral' | 'import';
}
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
export declare function remoteUrl(client: PierreCore, params: RemoteUrlParams): Promise<string>;
//# sourceMappingURL=git.d.ts.map