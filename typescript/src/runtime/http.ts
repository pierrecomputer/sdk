// The one request function: it turns an operation spec and a params object into an HTTP
// request, and the response into the result of its encoding. It applies the timeout and the
// retries.

import { APIPromise, type Call, type FirstUse, type Received } from './api-promise.ts';
import {
	checkRefPolicies,
	checkTtl,
	REQUEST_TOKEN_SECONDS,
	type Credentials,
	type RefPolicy,
	type TokenRequest,
} from './credentials.ts';
import {
	APIConnectionError,
	apiError,
	APITimeoutError,
	PierreError,
	problemCode,
} from './errors.ts';
import type { OperationSpec } from './operation.ts';
import { Page, PagePromise, type FetchPage } from './page.ts';
import { retryDelay, sleep, transientStatus } from './retry.ts';
import type { HeadersResult, RequestOptions, Runtime } from './runtime.ts';

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

type Values = Record<string, unknown>;

/** A repeat of these methods is safe. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);

/** `setTimeout` fires at once above this value, so a longer timeout sets no timer. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** The largest `Idempotency-Key`, in UTF-8 bytes. */
const MAX_IDEMPOTENCY_KEY_BYTES = 255;

type Attempt =
	| { ok: true; received: Received }
	| { ok: false; error: PierreError; transient: boolean; retryAfter: string | null };

export class HttpRuntime implements Runtime {
	readonly #config: HttpConfig;

	constructor(config: HttpConfig) {
		this.#config = config;
	}

	request<Data, DeclaredHeaders = Record<string, never>>(
		operation: OperationSpec,
		params: object | Promise<object>,
		options?: RequestOptions,
	): APIPromise<Data, DeclaredHeaders> {
		// The generated method declares the result type from the SDK model; the runtime does
		// not check the response against it.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return new APIPromise(this.#call(operation, params, options, (value) => value as Data));
	}

	list<Item, Body, DeclaredHeaders = Record<string, never>>(
		operation: OperationSpec,
		params: object,
		options?: RequestOptions,
	): PagePromise<Item, Body, DeclaredHeaders> {
		const itemField = operation.pagination?.itemField;
		if (itemField === undefined) throw new PierreError(`${operation.id} is not a list`);
		// Each next page sends the params and the request options of this call.
		const first: Values = { ...params };
		const firstOptions = copyOptions(options);
		const page = (value: unknown, response: Response): Page<Item, Body> => {
			const body: Values = isRecord(value) ? value : {};
			const items = body[itemField];
			const nextCursor = body.next_cursor;
			// As in `request`, the generated method declares the item and body types.
			return new Page<Item, Body>(
				{
					// oxlint-disable-next-line typescript/no-unsafe-type-assertion
					data: Array.isArray(items) ? (items as Item[]) : [],
					has_more: body.has_more === true,
					next_cursor: typeof nextCursor === 'string' ? nextCursor : undefined,
					// oxlint-disable-next-line typescript/no-unsafe-type-assertion
					body: value as Body,
					response,
				},
				nextPage,
			);
		};
		const nextPage: FetchPage<Item, Body> = (cursor) =>
			new APIPromise(this.#call(operation, { ...first, cursor }, firstOptions, page));
		return new PagePromise(this.#call(operation, first, firstOptions, page));
	}

	async readToken(repo: string, options?: RequestOptions): Promise<string> {
		if (this.#config.credentials.fixed) {
			throw new PierreError(
				'A client with a fixed `token` cannot make a token for another repository. Give that token in the params.',
			);
		}
		const ttl = checkTtl(options?.tokenTtl ?? REQUEST_TOKEN_SECONDS, 'tokenTtl');
		const timeout = checkTimeout(options?.timeout ?? this.#config.timeout);
		// The timeout and the caller's signal cover this token, as they cover the token of an attempt.
		const timer = new AbortController();
		const handle =
			timeout <= MAX_TIMER_MS
				? setTimeout(() => {
						timer.abort();
					}, timeout)
				: undefined;
		const callerSignal = options?.signal;
		const signal =
			callerSignal === undefined ? timer.signal : AbortSignal.any([callerSignal, timer.signal]);
		try {
			return await untilAborted(
				this.#config.credentials.token({ scopes: ['git:read'], repo, ttl, signal }),
				signal,
			);
		} catch (error) {
			if (callerSignal?.aborted === true) throw callerSignal.reason;
			if (timer.signal.aborted) {
				throw new APITimeoutError(`no token for \`${repo}\` within ${timeout} ms`, {
					cause: error,
				});
			}
			throw error;
		} finally {
			clearTimeout(handle);
		}
	}

	/** One call, which an `APIPromise` sends once. `result` gives the result of the response. */
	#call<Data>(
		operation: OperationSpec,
		params: object | Promise<object>,
		options: RequestOptions | undefined,
		result: (value: unknown, response: Response) => Data,
	): Call<Data> {
		// Copies, so a later change to the caller's objects does not change the request.
		const values: Promise<Values> =
			params instanceof Promise
				? params.then((value: object): Values => ({ ...value }))
				: Promise.resolve({ ...params });
		const settings = copyOptions(options);
		return {
			send: async (firstUse) => this.#send(operation, await values, settings, firstUse),
			data: async (received) =>
				result(
					received.read
						? received.body
						: await decode(operation, received.response, settings?.signal),
					received.response,
				),
			headers: (response) => declaredHeaders(operation, response),
		};
	}

	/** Sends the request with its retries, and returns the response of the last attempt. */
	async #send(
		operation: OperationSpec,
		values: Values,
		options: RequestOptions | undefined,
		firstUse: () => FirstUse,
	): Promise<Received> {
		const ttl = checkTtl(options?.tokenTtl ?? REQUEST_TOKEN_SECONDS, 'tokenTtl');
		// A request option replaces the client option.
		const refPolicies =
			checkRefPolicies(options?.refPolicies, 'refPolicies') ?? this.#config.refPolicies ?? [];
		if (refPolicies.length > 0 && this.#config.credentials.fixed) {
			throw new PierreError(
				'A client with a fixed `token` cannot use `refPolicies`. Give `privateKey` or `getToken`.',
			);
		}
		const timeout = checkTimeout(options?.timeout ?? this.#config.timeout);
		const maxRetries = checkMaxRetries(options?.maxRetries ?? this.#config.maxRetries);
		const idempotencyKey = idempotencyKeyOf(operation, options?.idempotencyKey);

		// The SDK names a new repository when the caller does not.
		if (
			operation.repoClaim &&
			values.repo_name === undefined &&
			operation.body?.fields.includes('repo_name') === true
		) {
			values.repo_name = crypto.randomUUID();
		}

		const url = new URL(this.#config.baseUrl.replace(/\/+$/, '') + expandPath(operation, values));
		// The default headers come after `Pierre-Client`, so a client such as the CLI can name
		// itself. The token comes later, and the request headers come last (`#attempt`).
		const headers = new Headers({
			'Pierre-Client': this.#config.client,
			Accept: operation.response.encoding === 'json' ? 'application/json' : '*/*',
		});
		for (const [name, value] of Object.entries(this.#config.defaultHeaders)) {
			headers.set(name, value);
		}
		for (const parameter of operation.parameters) {
			const value = values[parameter.field];
			if (value === undefined || parameter.in === 'path') continue;
			if (parameter.in === 'query') {
				for (const item of Array.isArray(value) ? value : [value]) {
					url.searchParams.append(parameter.name, wireText(operation, parameter.field, item));
				}
			} else {
				headers.set(parameter.name, wireText(operation, parameter.field, value));
			}
		}
		let repo: string | undefined;
		if (operation.repoClaim) {
			if (typeof values.repo_name !== 'string') {
				throw new PierreError(`${operation.id} needs \`repo_name\``);
			}
			repo = values.repo_name;
		}
		if (idempotencyKey !== undefined) headers.set('Idempotency-Key', idempotencyKey);

		const { body } = operation;
		const fields = body === null ? {} : pick(values, body.fields);
		const bodyFailure: BodyFailure = {};
		let content: string | ReadableStream<Uint8Array> | undefined;
		if (body?.encoding === 'json' && (body.required || Object.keys(fields).length > 0)) {
			headers.set('Content-Type', 'application/json');
			content = JSON.stringify(fields);
		} else if (body?.encoding === 'ndjson') {
			headers.set('Content-Type', 'application/x-ndjson');
			content = ndjsonStream(ndjsonLines(body.first, fields, values.chunks), bodyFailure);
		}
		// The SDK cannot send a stream twice, so a streaming body never retries.
		const repeatable =
			!(content instanceof ReadableStream) &&
			(SAFE_METHODS.has(operation.method) || idempotencyKey !== undefined);

		const request: AttemptRequest = {
			operation,
			url,
			headers,
			content,
			bodyFailure,
			// Each attempt signs a new token with the same policies.
			token: {
				scopes: operation.scopes,
				repo,
				ttl,
				...(refPolicies.length > 0 ? { ref_policies: refPolicies } : {}),
			},
			requestHeaders: options?.headers ?? {},
			timeout,
			signal: options?.signal,
			firstUse,
		};
		for (let attempt = 0; ; attempt++) {
			const outcome = await this.#attempt(request);
			if (outcome.ok) return outcome.received;
			if (!(repeatable && outcome.transient && attempt < maxRetries)) throw outcome.error;
			await sleep(retryDelay(outcome.retryAfter, attempt), options?.signal);
		}
	}

	/**
	 * Gets the token and sends one attempt. The timeout and the caller's signal cover both steps.
	 * It throws only when the caller aborts, the token or the body content fails, or the response
	 * is not usable.
	 */
	async #attempt(request: AttemptRequest): Promise<Attempt> {
		const { operation, timeout, signal: callerSignal } = request;
		const timer = new AbortController();
		const handle =
			timeout <= MAX_TIMER_MS
				? setTimeout(() => {
						timer.abort();
					}, timeout)
				: undefined;
		const signal =
			callerSignal === undefined ? timer.signal : AbortSignal.any([callerSignal, timer.signal]);
		let sent = false;
		try {
			const token = await untilAborted(
				this.#config.credentials.token({ ...request.token, signal }),
				signal,
			);
			const headers = new Headers(request.headers);
			headers.set('Authorization', `Bearer ${token}`);
			for (const [name, value] of Object.entries(request.requestHeaders)) headers.set(name, value);
			const init: RequestInit & { duplex?: 'half' } = {
				method: operation.method,
				headers,
				signal,
			};
			if (request.content !== undefined) init.body = request.content;
			if (request.content instanceof ReadableStream) init.duplex = 'half';
			sent = true;
			const response = await this.#config.fetch(request.url, init);
			if (response.ok || (response.status === 304 && operation.notModified)) {
				// The timeout covers a JSON body that the SDK reads, so a failed read retries.
				// In every other case, it ends with the headers (`finally`).
				const use = request.firstUse();
				if (operation.response.encoding === 'json' && use !== 'response') {
					// Before any use, the SDK reads a copy, so a later `asResponse()` can read the body.
					const source = use === undefined ? response.clone() : response;
					return {
						ok: true,
						received: { response, read: true, body: await readJson(operation, source) },
					};
				}
				return { ok: true, received: { response, read: false } };
			}
			const body = await readBody(response);
			return {
				ok: false,
				error: apiError(response.status, body, response.headers),
				transient: transientStatus(response.status, problemCode(body)),
				retryAfter: response.headers.get('retry-after'),
			};
		} catch (error) {
			// The caller stopped the call: no retry.
			if (callerSignal?.aborted === true) throw callerSignal.reason;
			if (timer.signal.aborted) {
				return {
					ok: false,
					error: new APITimeoutError(`${operation.id}: no response within ${timeout} ms`, {
						cause: error,
					}),
					transient: true,
					retryAfter: null,
				};
			}
			// The caller's content or `getToken` failed, not the connection: give its own error.
			if (request.bodyFailure.error !== undefined) throw request.bodyFailure.error;
			if (!sent || error instanceof PierreError) throw error;
			return {
				ok: false,
				error: new APIConnectionError(`${operation.id}: ${String(error)}`, { cause: error }),
				transient: true,
				retryAfter: null,
			};
		} finally {
			clearTimeout(handle);
		}
	}
}

/** The first error of the body content, for example from a commit file's content function. */
interface BodyFailure {
	error?: unknown;
}

/** The parts of a call that each attempt uses. */
interface AttemptRequest {
	operation: OperationSpec;
	url: URL;
	/** The headers without the token and the request headers. */
	headers: Headers;
	content: string | ReadableStream<Uint8Array> | undefined;
	bodyFailure: BodyFailure;
	token: Omit<TokenRequest, 'signal'>;
	requestHeaders: Record<string, string>;
	timeout: number;
	signal: AbortSignal | undefined;
	/** The first use of the promise. A 2xx attempt reads a JSON body unless it is `response`. */
	firstUse: () => FirstUse;
}

/** A copy of the request options and their headers. */
/** A copy of the request options, their headers, and their ref policies. `#send` checks them. */
function copyOptions(options: RequestOptions | undefined): RequestOptions | undefined {
	if (options === undefined) return undefined;
	const copy: RequestOptions = { ...options };
	if (options.headers !== undefined) copy.headers = { ...options.headers };
	if (Array.isArray(options.refPolicies)) {
		copy.refPolicies = options.refPolicies.map(
			(rule: unknown) =>
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `#send` checks each rule.
				(typeof rule === 'object' && rule !== null ? copyRule(rule) : rule) as RefPolicy,
		);
	}
	return copy;
}

function copyRule(rule: object): object {
	const { ops } = rule as { ops?: unknown };
	return Array.isArray(ops) ? { ...rule, ops: [...ops] } : { ...rule };
}

/** The value of `promise`, or a rejection with the reason of `signal` when it aborts first. */
async function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	signal.throwIfAborted();
	let onAbort: (() => void) | undefined;
	const aborted = new Promise<never>((_resolve, reject) => {
		onAbort = () => {
			reject(signal.reason);
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
	try {
		return await Promise.race([promise, aborted]);
	} finally {
		if (onAbort !== undefined) signal.removeEventListener('abort', onAbort);
	}
}

export function checkTimeout(timeout: number): number {
	if (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout <= 0) {
		throw new PierreError('`timeout` must be a number of milliseconds greater than 0.');
	}
	return timeout;
}

export function checkMaxRetries(maxRetries: number): number {
	if (!Number.isInteger(maxRetries) || maxRetries < 0) {
		throw new PierreError('`maxRetries` must be a whole number, 0 or more.');
	}
	return maxRetries;
}

/** The `Idempotency-Key` of a call: the caller's key, or a new UUID for an operation that accepts one. */
function idempotencyKeyOf(operation: OperationSpec, key: string | undefined): string | undefined {
	if (key === undefined) return operation.idempotencyKey ? crypto.randomUUID() : undefined;
	// The server ignores a key that the operation does not accept, so a retry could repeat the write.
	if (!operation.idempotencyKey) {
		throw new PierreError(`${operation.id} does not accept an idempotency key.`);
	}
	const size = new TextEncoder().encode(key).length;
	if (size === 0 || size > MAX_IDEMPOTENCY_KEY_BYTES) {
		throw new PierreError(
			`\`idempotencyKey\` must have 1 to ${MAX_IDEMPOTENCY_KEY_BYTES} bytes of UTF-8.`,
		);
	}
	return key;
}

/** Puts the path parameters in the path. Each value is one segment, so `/` is `%2F`. */
function expandPath(operation: OperationSpec, values: Values): string {
	return operation.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
		const parameter = operation.parameters.find(
			(entry) => entry.in === 'path' && entry.name === name,
		);
		const value = parameter === undefined ? undefined : values[parameter.field];
		if (value === undefined || value === null || value === '') {
			throw new PierreError(`${operation.id} needs \`${parameter?.field ?? name}\``);
		}
		const segment = encodeURIComponent(wireText(operation, parameter?.field ?? name, value));
		// The URL parser resolves `.` and `..`, which would send the request to another route.
		if (segment === '.' || segment === '..') {
			throw new PierreError(
				`${operation.id}: \`${parameter?.field ?? name}\` cannot be \`${segment}\``,
			);
		}
		return segment;
	});
}

/** The text of a path, query, or header value. The model allows only scalar parameters. */
function wireText(operation: OperationSpec, field: string, value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	throw new PierreError(`${operation.id}: \`${field}\` must be a string, a number, or a boolean`);
}

/** The given fields. An `undefined` field is not sent, and `null` is. */
function pick(values: Values, fields: readonly string[]): Values {
	const result: Values = {};
	for (const field of fields) {
		if (values[field] !== undefined) result[field] = values[field];
	}
	return result;
}

async function* ndjsonLines(first: string, fields: Values, rest: unknown): AsyncIterable<unknown> {
	yield { [first]: fields };
	if (rest === undefined) return;
	if (!isIterable(rest)) throw new PierreError('`chunks` must be an iterable or an async iterable');
	yield* rest;
}

function isIterable(value: unknown): value is Iterable<unknown> | AsyncIterable<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		(Symbol.iterator in value || Symbol.asyncIterator in value)
	);
}

/** The lines as an NDJSON stream. It records an error of `lines` in `failure`. */
function ndjsonStream(
	lines: AsyncIterable<unknown>,
	failure: BodyFailure,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const iterator = lines[Symbol.asyncIterator]();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			let line: IteratorResult<unknown>;
			let text: string;
			try {
				line = await iterator.next();
				text = line.done === true ? '' : `${JSON.stringify(line.value)}\n`;
			} catch (error) {
				failure.error ??= error;
				throw error;
			}
			if (line.done === true) controller.close();
			else controller.enqueue(encoder.encode(text));
		},
		async cancel(reason) {
			await iterator.return?.(reason);
		},
	});
}

async function readJson(operation: OperationSpec, response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		const body: unknown = JSON.parse(text);
		return body;
	} catch (error) {
		throw new PierreError(`${operation.id}: the response body is not JSON`, { cause: error });
	}
}

/** The result of a response whose body the attempt did not read. */
async function decode(
	operation: OperationSpec,
	response: Response,
	signal: AbortSignal | undefined,
): Promise<unknown> {
	switch (operation.response.encoding) {
		case 'json':
			// After `asResponse()`: no timeout and no retry, because the caller can read the body.
			if (response.bodyUsed) {
				throw new PierreError(
					`${operation.id}: the caller read the body of the response, so the SDK cannot read the result`,
				);
			}
			try {
				return await readJson(operation, response);
			} catch (error) {
				if (signal?.aborted === true) throw signal.reason;
				if (error instanceof PierreError) throw error;
				throw new APIConnectionError(`${operation.id}: ${String(error)}`, { cause: error });
			}
		case 'bytes':
			// The platform stream type.
			return response;
		case 'none': {
			const result: HeadersResult<Record<string, string>> = {
				status: response.status,
				headers: declaredHeaders(operation, response),
			};
			return result;
		}
		default:
			throw new PierreError(`${operation.id}: NDJSON responses are not supported yet`);
	}
}

/** The declared response headers that the response has, by field. */
function declaredHeaders(operation: OperationSpec, response: Response): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const header of operation.response.headers) {
		const value = response.headers.get(header.name);
		if (value !== null) headers[header.field] = value;
	}
	return headers;
}

function isRecord(value: unknown): value is Values {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text().catch(() => '');
	if (text === '') return undefined;
	try {
		const body: unknown = JSON.parse(text);
		return body;
	} catch {
		return text;
	}
}
