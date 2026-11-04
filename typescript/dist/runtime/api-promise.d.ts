/** The result of `withResponse()`. */
export interface WithResponse<Data, DeclaredHeaders> {
    /** What `await` gives. */
    data: Data;
    /** The platform response of the last attempt. */
    response: Response;
    /** The response headers that the document declares, by the wire form of each name. */
    headers: DeclaredHeaders;
    /** The `X-Request-Id` header, or `null` when the server does not send it. */
    request_id: string | null;
}
/** The response of the last attempt, with the parsed body when the attempt read it. */
export type Received = {
    response: Response;
    read: true;
    body: unknown;
} | {
    response: Response;
    read: false;
};
/**
 * The first use of an `APIPromise`: `response` for `asResponse()`, and `data` for `await` and
 * `withResponse()`. It is `undefined` before the caller uses the promise.
 */
export type FirstUse = 'response' | 'data' | undefined;
/** One call of the runtime. An `APIPromise` sends it once, and every use reads that call. */
export interface Call<Data> {
    /**
     * Sends the request with its retries. A 2xx attempt reads `firstUse()` to find whether it
     * reads a JSON body inside the attempt, with the timeout and the retries.
     */
    send(firstUse: () => FirstUse): Promise<Received>;
    /** The result of the response. It reads the body when the attempt did not. */
    data(received: Received): Promise<Data>;
    /** The declared response headers. */
    headers(response: Response): unknown;
}
/**
 * The result of a method. `await` gives the result. `withResponse()` also gives the response,
 * and `asResponse()` gives the response without a read of the body. The request starts when the
 * method is called, and every use reads that one request.
 */
export declare class APIPromise<Data, DeclaredHeaders = Record<string, never>> extends Promise<Data> {
    #private;
    static get [Symbol.species](): PromiseConstructor;
    /**
     * A method makes it. A test can also make one, to mock a method. When the code under test only
     * uses `await`, a plain promise is enough. When it calls `withResponse()` or `asResponse()`,
     * make an `APIPromise` from a call that gives the response and the data.
     *
     * ```ts
     * const response = Response.json(data);
     * const promise = new APIPromise({
     * 	send: async () => ({ response, read: true, body: data }),
     * 	data: async () => data,
     * 	headers: () => ({}),
     * });
     * ```
     */
    constructor(call: Call<Data>);
    /**
     * The platform response, when its headers arrive. The SDK does not read the body, so the
     * timeout ends with the headers, and no retry covers the body. An error status rejects with
     * the `APIError`. After `await` or `withResponse()`, the body is already read. When the
     * response arrives before any use, the SDK reads a copy of the body, so the body stays
     * readable.
     */
    asResponse(): Promise<Response>;
    /** The result, with the platform response, the declared headers, and the request ID. */
    withResponse(): Promise<WithResponse<Data, DeclaredHeaders>>;
    then<Result1 = Data, Result2 = never>(onfulfilled?: ((value: Data) => Result1 | PromiseLike<Result1>) | null, onrejected?: ((reason: any) => Result2 | PromiseLike<Result2>) | null): Promise<Result1 | Result2>;
}
//# sourceMappingURL=api-promise.d.ts.map