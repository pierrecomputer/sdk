import { type GetToken, type RefPolicy } from './credentials.ts';
import type { Runtime } from './runtime.ts';
export interface PierreOptions {
    /** The organization name. Default: `PIERRE_ORG`, or the `iss` claim of `token`. */
    org?: string;
    /** A PKCS #8 PEM private key. Default: `PIERRE_PRIVATE_KEY`, or the file at `PIERRE_PRIVATE_KEY_FILE`. */
    privateKey?: string;
    /** A fixed token. Default: `PIERRE_TOKEN`. */
    token?: string;
    /** A function that returns a token for each request, for a client with no private key. */
    getToken?: GetToken;
    /** The API base URL. Default: `PIERRE_API_BASE_URL`, or `https://api.{org}.code.storage`. */
    baseUrl?: string;
    /** The Git host. Default: `PIERRE_GIT_HOST`, or `{org}.code.storage`. */
    gitHost?: string;
    /** The timeout of each attempt, in milliseconds. Default: 60000. */
    timeout?: number;
    /** The number of retries of a transient failure. Default: 2. */
    maxRetries?: number;
    /** Headers for every request. */
    defaultHeaders?: Record<string, string>;
    fetch?: typeof fetch;
    /**
     * The `refs` claim of each request token, which limits the refs that a write can change. A
     * request option replaces it. A client with a fixed `token` cannot have it.
     */
    refPolicies?: readonly RefPolicy[];
}
/** The settings of a client. Read them on `pierre.options`. It holds no credential. */
export interface ClientOptions {
    /** The organization name, when the client knows it. */
    readonly org: string | undefined;
    readonly baseUrl: string;
    /** The Git host, when the client knows the organization or `gitHost` is set. */
    readonly gitHost: string | undefined;
    readonly timeout: number;
    readonly maxRetries: number;
    /** The ref policies of each request token, when the client has them. */
    readonly refPolicies: readonly RefPolicy[] | undefined;
}
/** The transport of a client. The generated namespaces call it. */
export declare function runtimeOf(client: PierreCore): Runtime;
/**
 * The core client, with no namespaces. Give it to a namespace from a subpath, for example
 * `new ReposNamespace(new PierreCore())` from `@pierre/sdk/repos`, so a bundle loads only that
 * namespace. `new Pierre()` has every namespace.
 */
export declare class PierreCore {
    /**
     * The settings of the client. Every top-level name other than `options` and `withOptions` is
     * free for an API namespace.
     */
    readonly options: ClientOptions;
    constructor(options?: PierreOptions);
    /**
     * Returns a copy of the client with changed options. The copy keeps every option that
     * `changes` does not set, including the `org` of `options`, and does not read the environment
     * again. It keeps the credential, unless `changes` gives one. When `org` changes, the default
     * hosts follow it.
     */
    withOptions(changes?: PierreOptions): this;
}
//# sourceMappingURL=client.d.ts.map