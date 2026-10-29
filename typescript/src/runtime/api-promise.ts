// The result of every method: a promise of the result that also gives the
// platform response, as in the OpenAI and Anthropic SDKs.

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
export type Received =
	| { response: Response; read: true; body: unknown }
	| { response: Response; read: false };

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
export class APIPromise<Data, DeclaredHeaders = Record<string, never>> extends Promise<Data> {
	// `finally` makes its promise with this constructor, which must take an executor.
	static override get [Symbol.species](): PromiseConstructor {
		return Promise;
	}

	readonly #call: Call<Data>;
	readonly #received: Promise<Received>;
	#use: FirstUse;
	#result: Promise<{ data: Data; response: Response }> | undefined;

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
	constructor(call: Call<Data>) {
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
	asResponse(): Promise<Response> {
		this.#use ??= 'response';
		return this.#received.then((received) => received.response);
	}

	/** The result, with the platform response, the declared headers, and the request ID. */
	async withResponse(): Promise<WithResponse<Data, DeclaredHeaders>> {
		const { data, response } = await this.#data();
		return {
			data,
			response,
			// The generated method declares the header type from the SDK model.
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			headers: this.#call.headers(response) as DeclaredHeaders,
			request_id: response.headers.get('x-request-id'),
		};
	}

	// oxlint-disable-next-line unicorn/no-thenable -- the result is awaitable on purpose.
	override then<Result1 = Data, Result2 = never>(
		onfulfilled?: ((value: Data) => Result1 | PromiseLike<Result1>) | null,
		// `any`, as in `Promise.then`, so a handler such as `(error: Error) => ...` still fits.
		onrejected?: ((reason: any) => Result2 | PromiseLike<Result2>) | null,
	): Promise<Result1 | Result2> {
		return this.#data()
			.then((result) => result.data)
			.then(onfulfilled, onrejected);
	}

	#data(): Promise<{ data: Data; response: Response }> {
		this.#use ??= 'data';
		this.#result ??= this.#received.then(async (received) => ({
			data: await this.#call.data(received),
			response: received.response,
		}));
		return this.#result;
	}
}
