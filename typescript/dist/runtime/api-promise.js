// The result of every method: a promise of the result that also gives the
// platform response, as in the OpenAI and Anthropic SDKs.
/**
 * The result of a method. `await` gives the result. `withResponse()` also gives the response,
 * and `asResponse()` gives the response without a read of the body. The request starts when the
 * method is called, and every use reads that one request.
 */
export class APIPromise extends Promise {
    // `finally` makes its promise with this constructor, which must take an executor.
    static get [Symbol.species]() {
        return Promise;
    }
    #call;
    #received;
    #use;
    #result;
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
    constructor(call) {
        // The base promise stays pending, because `then` reads the call.
        super(() => undefined);
        this.#call = call;
        this.#received = call.send(() => this.#use);
    }
    /**
     * The platform response, when its headers arrive. The SDK does not read the body, so the
     * timeout ends with the headers, and no retry covers the body. An error status rejects with
     * the `APIError`. After `await` or `withResponse()`, the body is already read. When the
     * response arrives before any use, the SDK reads a copy of the body, so the body stays
     * readable.
     */
    asResponse() {
        this.#use ??= 'response';
        return this.#received.then((received) => received.response);
    }
    /** The result, with the platform response, the declared headers, and the request ID. */
    async withResponse() {
        const { data, response } = await this.#data();
        return {
            data,
            response,
            // The generated method declares the header type from the SDK model.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            headers: this.#call.headers(response),
            request_id: response.headers.get('x-request-id'),
        };
    }
    // oxlint-disable-next-line unicorn/no-thenable -- the result is awaitable on purpose.
    then(onfulfilled, 
    // `any`, as in `Promise.then`, so a handler such as `(error: Error) => ...` still fits.
    onrejected) {
        return this.#data()
            .then((result) => result.data)
            .then(onfulfilled, onrejected);
    }
    #data() {
        this.#use ??= 'data';
        this.#result ??= this.#received.then(async (received) => ({
            data: await this.#call.data(received),
            response: received.response,
        }));
        return this.#result;
    }
}
//# sourceMappingURL=api-promise.js.map