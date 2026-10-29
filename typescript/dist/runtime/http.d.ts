import { APIPromise } from './api-promise.ts';
import { type Credentials, type RefPolicy } from './credentials.ts';
import type { OperationSpec } from './operation.ts';
import { PagePromise } from './page.ts';
import type { RequestOptions, Runtime } from './runtime.ts';
export interface HttpConfig {
    baseUrl: string;
    credentials: Credentials;
    fetch: typeof fetch;
    /** The `Pierre-Client` header. */
    client: string;
    defaultHeaders: Record<string, string>;
    /** The timeout of each attempt, in milliseconds. */
    timeout: number;
    maxRetries: number;
    /** The ref policies of the client, which a request option replaces. */
    refPolicies?: readonly RefPolicy[] | undefined;
}
export declare class HttpRuntime implements Runtime {
    #private;
    constructor(config: HttpConfig);
    request<Data, DeclaredHeaders = Record<string, never>>(operation: OperationSpec, params: object | Promise<object>, options?: RequestOptions): APIPromise<Data, DeclaredHeaders>;
    list<Item, Body, DeclaredHeaders = Record<string, never>>(operation: OperationSpec, params: object, options?: RequestOptions): PagePromise<Item, Body, DeclaredHeaders>;
    readToken(repo: string, options?: RequestOptions): Promise<string>;
}
export declare function checkTimeout(timeout: number): number;
export declare function checkMaxRetries(maxRetries: number): number;
//# sourceMappingURL=http.d.ts.map