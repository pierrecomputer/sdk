// `@pierre/sdk/webhooks`: verifies a webhook delivery and returns the typed event. It loads no
// client code.

import { WEBHOOK_EVENT_TYPES, type WebhookEvents } from './generated/webhooks.ts';
import { PierreError, WebhookVerificationError } from './runtime/errors.ts';

export { WEBHOOK_EVENT_TYPES, type WebhookEvents } from './generated/webhooks.ts';
export { WebhookVerificationError, type WebhookVerificationFailure } from './runtime/errors.ts';

/** An event of a type that this SDK version knows. `type` is always set. */
export type KnownWebhookEvent = {
	[Type in keyof WebhookEvents]: WebhookEvents[Type] & { type: Type };
}[keyof WebhookEvents];

/**
 * An event of a type that this SDK version does not know. Handle it in a default branch.
 *
 * `type` is `unknown`, not the type that Pierre sent: a member whose `type` is any string stops
 * TypeScript from narrowing the union on `type`. No Pierre event has the type `unknown`, because
 * each type has the form `<resource>.<subject>.<verb>`, or is `push`.
 */
export interface UnknownWebhookEvent {
	readonly type: 'unknown';
	/** The event type that Pierre sent, for example a type from a newer API version. */
	readonly event_type: string;
	/** The parsed payload, a JSON object. */
	readonly body: Readonly<Record<string, unknown>>;
}

export interface VerifyWebhookParams {
	/** The raw request body, before a JSON parse changes its bytes. */
	payload: string | Uint8Array | ArrayBuffer;
	/** The request headers: a Fetch `Headers` object, or a record such as Node's request headers. */
	headers: Headers | Record<string, string | readonly string[] | undefined>;
	/** The secret of the webhook subscription. */
	secret: string;
	/** The largest difference between the delivery time and now, in seconds. Default: 300. */
	tolerance_seconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const KNOWN_TYPES: ReadonlySet<string> = new Set(WEBHOOK_EVENT_TYPES);
const encoder = new TextEncoder();

/**
 * Checks the `X-Pierre-Signature` header of a delivery: an HMAC-SHA256 of `<t>.<payload>` with
 * the secret, and a timestamp `t` within `tolerance_seconds` of now. Returns the event, a union
 * on `type`. Throws `WebhookVerificationError` when the check fails.
 *
 * Docs: search for `verifyWebhook` in the docs MCP server, https://code.storage/docs/mcp.
 */
export async function verifyWebhook(
	params: VerifyWebhookParams,
): Promise<KnownWebhookEvent | UnknownWebhookEvent> {
	const tolerance = params.tolerance_seconds ?? DEFAULT_TOLERANCE_SECONDS;
	if (!(tolerance >= 0)) throw new PierreError('`tolerance_seconds` must be 0 or more.');
	if (params.secret === '') throw new PierreError('`secret` must not be empty.');

	const header = headerValue(params.headers, 'x-pierre-signature');
	if (header === undefined) {
		throw new WebhookVerificationError(
			'missing_signature',
			'The request has no X-Pierre-Signature header.',
		);
	}
	const { timestamp, signatures } = parseSignature(header);
	const payload = bytesOf(params.payload);
	const prefix = encoder.encode(`${timestamp}.`);
	const signed = new Uint8Array(prefix.length + payload.length);
	signed.set(prefix);
	signed.set(payload, prefix.length);
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(params.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	);
	let valid = false;
	// `verify` compares in constant time.
	for (const signature of signatures) {
		if (await crypto.subtle.verify('HMAC', key, signature, signed)) valid = true;
	}
	if (!valid) {
		throw new WebhookVerificationError(
			'signature_mismatch',
			'The signature does not match the payload and the secret.',
		);
	}
	const age = Math.floor(Date.now() / 1000) - Number(timestamp);
	if (Math.abs(age) > tolerance) {
		throw new WebhookVerificationError(
			'timestamp_out_of_range',
			`The delivery is ${age} seconds old, and the tolerance is ${tolerance} seconds.`,
		);
	}

	let body: unknown;
	try {
		body = JSON.parse(new TextDecoder().decode(payload));
	} catch {
		throw new WebhookVerificationError('invalid_payload', 'The payload is not JSON.');
	}
	if (!isRecord(body)) {
		throw new WebhookVerificationError('invalid_payload', 'The payload is not a JSON object.');
	}
	// Older push deliveries have no `type`. The `X-Pierre-Event` header is not signed, so the SDK
	// uses it only to name such a push.
	const bodyType = typeof body.type === 'string' ? body.type : undefined;
	const type =
		bodyType ?? (headerValue(params.headers, 'x-pierre-event') === 'push' ? 'push' : undefined);
	if (type === undefined || type === '') {
		throw new WebhookVerificationError('invalid_payload', 'The payload has no event type.');
	}
	if (KNOWN_TYPES.has(type)) {
		// The type is a key of `WebhookEvents`, and the payload follows its schema.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return { ...body, type } as KnownWebhookEvent;
	}
	return { type: 'unknown', event_type: type, body };
}

/** The timestamp and the signatures of `t=<unix seconds>,sha256=<hex>[,sha256=<hex>...]`. */
function parseSignature(header: string): {
	timestamp: string;
	signatures: Uint8Array<ArrayBuffer>[];
} {
	let timestamp: string | undefined;
	const signatures: Uint8Array<ArrayBuffer>[] = [];
	for (const element of header.split(',')) {
		const [name, value] = splitOnce(element.trim(), '=');
		if (name === 't' && /^\d+$/.test(value)) timestamp = value;
		if (name === 'sha256' && /^[0-9a-fA-F]{64}$/.test(value)) signatures.push(hexBytes(value));
	}
	if (timestamp === undefined || signatures.length === 0) {
		throw new WebhookVerificationError(
			'malformed_signature',
			'X-Pierre-Signature must have the form `t=<unix seconds>,sha256=<hex>`.',
		);
	}
	return { timestamp, signatures };
}

function splitOnce(text: string, separator: string): [string, string] {
	const index = text.indexOf(separator);
	return index === -1 ? [text, ''] : [text.slice(0, index), text.slice(index + 1)];
}

function hexBytes(text: string): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(text.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function bytesOf(payload: VerifyWebhookParams['payload']): Uint8Array {
	if (typeof payload === 'string') return encoder.encode(payload);
	return payload instanceof Uint8Array ? payload : new Uint8Array(payload);
}

function headerValue(headers: VerifyWebhookParams['headers'], name: string): string | undefined {
	if (isFetchHeaders(headers)) return headers.get(name) ?? undefined;
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== name) continue;
		return typeof value === 'string' ? value : value?.[0];
	}
	return undefined;
}

function isFetchHeaders(headers: VerifyWebhookParams['headers']): headers is Headers {
	return 'get' in headers && typeof headers.get === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
