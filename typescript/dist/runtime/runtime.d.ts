import type { APIPromise } from './api-promise.ts';
import type { RefPolicy } from './credentials.ts';
import type { OperationSpec } from './operation.ts';
import type { PagePromise } from './page.ts';
/** The options of one call. */
export interface RequestOptions {
    signal?: AbortSignal;
    /**
     * The timeout of each attempt, in milliseconds. It runs until the response headers arrive,
     * and for a JSON response until the body is read, except with `asResponse()`. It includes the upload time of a commit,
     * so give a larger value for a large commit. Default: the client `timeout`.
     */
    timeout?: number;
    /** The number of retries. Default: the client `maxRetries`. */
    maxRetries?: number;
    /**
     * The `Idempotency-Key` of a create that accepts one. The SDK sends the same key on each
     * retry. Default: a new UUID for each call.
     */
    idempotencyKey?: string;
    /** More request headers. A header that the operation declares is a typed param instead. */
    headers?: Record<string, string>;
    /**
     * The lifetime of the request token, in seconds, from 1 to 3600. Default: 300. The SDK
     * ignores it for a fixed `token`.
     */
    tokenTtl?: number;
    /**
     * The `refs` claim of the request token, which limits the refs that a write can change. It
     * replaces the client option for this call, and `[]` removes it. A client with a fixed
     * `token` cannot use it.
     */
    refPolicies?: readonly RefPolicy[];
}
/**
 * The result of an operation whose response has no body. `headers` holds the declared response
 * headers, and is `{}` when the document declares none.
 */
export interface HeadersResult<Headers> {
    status: number;
    headers: Headers;
}
export interface Runtime {
    /**
     * Sends one request, and returns the response in the form of its encoding. A helper that
     * prepares its params with async work gives a promise of them.
     */
    request<Data, DeclaredHeaders = Record<string, never>>(operation: OperationSpec, params: object | Promise<object>, options?: RequestOptions): APIPromise<Data, DeclaredHeaders>;
    /** Sends a list request, and returns the first page, which also iterates over every item. */
    list<Item, Body, DeclaredHeaders = Record<string, never>>(operation: OperationSpec, params: object, options?: RequestOptions): PagePromise<Item, Body, DeclaredHeaders>;
    /**
     * A token with `git:read` on another repository, for example the source of a copy, with the
     * lifetime of a request token. A client with a fixed `token` cannot make one.
     */
    readToken(repo: string, options?: RequestOptions): Promise<string>;
}
//# sourceMappingURL=runtime.d.ts.map