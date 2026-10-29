/**
 * One ordered rule of the `refs` claim. The first rule whose pattern matches a
 * ref applies.
 */
export interface RefPolicy {
    /**
     * A full ref name (`refs/heads/main`), a branch name (`main`), a prefix that ends with `/*`
     * (`refs/heads/feature/*`), or `*` for every ref. The gateway rejects a token with another form.
     */
    pattern: string;
    /** The policy operations. The gateway rejects a token with an op that it does not know. */
    ops?: readonly ('no-push' | 'no-force-push' | 'verify-sig' | (string & {}))[];
}
/** The token that a request needs. */
export interface TokenRequest {
    /** The scopes of the operation. */
    scopes: readonly string[];
    /** The `repo` claim, for a repository-scoped operation. */
    repo?: string | undefined;
    /** The lifetime of the token, in seconds. */
    ttl: number;
    /** The rules of the `refs` claim. Absent when the call has none. */
    ref_policies?: readonly RefPolicy[];
    /** Aborts when the caller stops the call or the attempt times out. Pass it on to `fetch`. */
    signal?: AbortSignal;
}
/** Returns a token for a request, for a client without a private key. */
export type GetToken = (request: TokenRequest) => Promise<string>;
/** The source of the token of each request. */
export interface Credentials {
    /** Whether the token is fixed, so the SDK cannot set its claims. */
    readonly fixed: boolean;
    token(request: TokenRequest): Promise<string>;
}
/** The claims of a token that the SDK signs. */
export interface Claims {
    iss: string;
    sub: string;
    repo?: string | undefined;
    scopes: readonly string[];
    /** The lifetime in seconds: `exp` is `iat` plus this value. */
    ttl: number;
    /** The `refs` claim: ordered `[pattern, ops]` rules. */
    refs?: readonly (readonly [string, readonly string[]])[] | undefined;
}
/** A private key that signs tokens. It loads the key on the first use. */
export interface Signer {
    sign(claims: Claims): Promise<string>;
}
/** A token that the SDK signs for one request lives 5 minutes. */
export declare const REQUEST_TOKEN_SECONDS: number;
/** The longest token lifetime that the SDK signs. */
export declare const MAX_TOKEN_SECONDS: number;
/** The `sub` claim of the tokens that the SDK signs. */
export declare const SUBJECT = "pierre-sdk-typescript";
/**
 * Checks the shape of ref policies, and returns a frozen copy. The gateway checks the pattern
 * forms and the ops.
 */
export declare function checkRefPolicies(policies: readonly RefPolicy[] | undefined, name: string): readonly RefPolicy[] | undefined;
/** The `refs` claim of ref policies, or `undefined` for no rule. */
export declare function refsClaim(policies: readonly RefPolicy[] | undefined): Claims['refs'];
/** Checks a token lifetime: a whole number of seconds from 1 to 3600. */
export declare function checkTtl(ttl: number, name: string): number;
/** A signer for a PKCS #8 PEM private key. `load` runs once, on the first signature. */
export declare function keySigner(load: () => Promise<string>): Signer;
/** Signs a token for each request with the operation's scopes and repository claim. */
export declare function signerCredentials(org: string, signer: Signer): Credentials;
/** A fixed token. The server checks its scopes. */
export declare function tokenCredentials(token: string): Credentials;
/** Asks the caller's function for the token of each request. */
export declare function getTokenCredentials(getToken: GetToken): Credentials;
/** The private key and the credentials of a client, for `createToken` and `remoteUrl`. */
export interface ClientKey {
    org: string | undefined;
    /** `undefined` when the client has a fixed token or `getToken`. */
    signer: Signer | undefined;
    credentials: Credentials;
}
export declare function registerClientKey(client: object, key: ClientKey): void;
export declare function clientKey(client: object): ClientKey | undefined;
export declare function hex(bytes: Uint8Array): string;
export declare function base64(bytes: Uint8Array): string;
/** The `iss` claim of a token, or `undefined`. The SDK does not verify the token. */
export declare function tokenIssuer(token: string): string | undefined;
//# sourceMappingURL=credentials.d.ts.map