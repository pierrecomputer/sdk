// `@pierre/sdk/webhooks`: verifies a webhook delivery and returns the typed event. It loads no
// client code.
import { WEBHOOK_EVENT_TYPES } from './generated/webhooks.js';
import { PierreError, WebhookVerificationError } from './runtime/errors.js';
export { WEBHOOK_EVENT_TYPES } from './generated/webhooks.js';
export { WebhookVerificationError } from './runtime/errors.js';
const DEFAULT_TOLERANCE_SECONDS = 300;
const KNOWN_TYPES = new Set(WEBHOOK_EVENT_TYPES);
const encoder = new TextEncoder();
/**
 * Checks the `X-Pierre-Signature` header of a delivery: an HMAC-SHA256 of `<t>.<payload>` with
 * the secret, and a timestamp `t` within `tolerance_seconds` of now. Returns the event, a union
 * on `type`. Throws `WebhookVerificationError` when the check fails.
 *
 * Docs: search for `verifyWebhook` in the docs MCP server, https://code.storage/docs/mcp.
 */
export async function verifyWebhook(params) {
    const tolerance = params.tolerance_seconds ?? DEFAULT_TOLERANCE_SECONDS;
    if (!(tolerance >= 0))
        throw new PierreError('`tolerance_seconds` must be 0 or more.');
    if (params.secret === '')
        throw new PierreError('`secret` must not be empty.');
    const header = headerValue(params.headers, 'x-pierre-signature');
    if (header === undefined) {
        throw new WebhookVerificationError('missing_signature', 'The request has no X-Pierre-Signature header.');
    }
    const { timestamp, signatures } = parseSignature(header);
    const payload = bytesOf(params.payload);
    const prefix = encoder.encode(`${timestamp}.`);
    const signed = new Uint8Array(prefix.length + payload.length);
    signed.set(prefix);
    signed.set(payload, prefix.length);
    const key = await crypto.subtle.importKey('raw', encoder.encode(params.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    let valid = false;
    // `verify` compares in constant time.
    for (const signature of signatures) {
        if (await crypto.subtle.verify('HMAC', key, signature, signed))
            valid = true;
    }
    if (!valid) {
        throw new WebhookVerificationError('signature_mismatch', 'The signature does not match the payload and the secret.');
    }
    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (Math.abs(age) > tolerance) {
        throw new WebhookVerificationError('timestamp_out_of_range', `The delivery is ${age} seconds old, and the tolerance is ${tolerance} seconds.`);
    }
    let body;
    try {
        body = JSON.parse(new TextDecoder().decode(payload));
    }
    catch {
        throw new WebhookVerificationError('invalid_payload', 'The payload is not JSON.');
    }
    if (!isRecord(body)) {
        throw new WebhookVerificationError('invalid_payload', 'The payload is not a JSON object.');
    }
    // Older push deliveries have no `type`. The `X-Pierre-Event` header is not signed, so the SDK
    // uses it only to name such a push.
    const bodyType = typeof body.type === 'string' ? body.type : undefined;
    const type = bodyType ?? (headerValue(params.headers, 'x-pierre-event') === 'push' ? 'push' : undefined);
    if (type === undefined || type === '') {
        throw new WebhookVerificationError('invalid_payload', 'The payload has no event type.');
    }
    if (KNOWN_TYPES.has(type)) {
        // The type is a key of `WebhookEvents`, and the payload follows its schema.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return { ...body, type };
    }
    return { type: 'unknown', event_type: type, body };
}
/** The timestamp and the signatures of `t=<unix seconds>,sha256=<hex>[,sha256=<hex>...]`. */
function parseSignature(header) {
    let timestamp;
    const signatures = [];
    for (const element of header.split(',')) {
        const [name, value] = splitOnce(element.trim(), '=');
        if (name === 't' && /^\d+$/.test(value))
            timestamp = value;
        if (name === 'sha256' && /^[0-9a-fA-F]{64}$/.test(value))
            signatures.push(hexBytes(value));
    }
    if (timestamp === undefined || signatures.length === 0) {
        throw new WebhookVerificationError('malformed_signature', 'X-Pierre-Signature must have the form `t=<unix seconds>,sha256=<hex>`.');
    }
    return { timestamp, signatures };
}
function splitOnce(text, separator) {
    const index = text.indexOf(separator);
    return index === -1 ? [text, ''] : [text.slice(0, index), text.slice(index + 1)];
}
function hexBytes(text) {
    const bytes = new Uint8Array(text.length / 2);
    for (let index = 0; index < bytes.length; index++) {
        bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}
function bytesOf(payload) {
    if (typeof payload === 'string')
        return encoder.encode(payload);
    return payload instanceof Uint8Array ? payload : new Uint8Array(payload);
}
function headerValue(headers, name) {
    if (isFetchHeaders(headers))
        return headers.get(name) ?? undefined;
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() !== name)
            continue;
        return typeof value === 'string' ? value : value?.[0];
    }
    return undefined;
}
function isFetchHeaders(headers) {
    return 'get' in headers && typeof headers.get === 'function';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=webhooks.js.map