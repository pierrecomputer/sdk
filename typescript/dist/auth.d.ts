import type { PierreCore } from './runtime/client.ts';
import { type RefPolicy } from './runtime/credentials.ts';
export { SCOPES, type Scope } from './generated/scopes.ts';
export type { RefPolicy } from './runtime/credentials.ts';
export interface TokenParams {
    /** The scopes of the token, for example `['git:read']`. `SCOPES` lists the scopes of the API. */
    scopes: readonly string[];
    /** The `repo` claim. Leave it out for a token whose scopes are all organization-wide. */
    repo?: string;
    /** The lifetime in seconds, from 1 to 3600. Default: 900 (15 minutes). */
    ttl?: number;
    /**
     * The rules of the `refs` claim. Default: the `refPolicies` of a client, and none for
     * `{ org, privateKey }`. An empty list adds no claim.
     */
    ref_policies?: readonly RefPolicy[];
    /** The `sub` claim. Default: `pierre-sdk-typescript`. */
    subject?: string;
}
/** A private key and its organization, for code with no client. */
export interface KeyCredentials {
    org: string;
    /** A PKCS #8 PEM private key. */
    privateKey: string;
}
/**
 * Signs a token with a private key: the key of a client, or `{ org, privateKey }`. A token in a
 * URL or a config file is a bearer credential, so keep the lifetime short. The SDK rejects a
 * lifetime over 1 hour.
 *
 * Docs: search for `createToken` in the docs MCP server, https://code.storage/docs/mcp.
 */
export declare function createToken(credentials: PierreCore | KeyCredentials, params: TokenParams): Promise<string>;
//# sourceMappingURL=auth.d.ts.map