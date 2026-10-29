import { type WebhookEvents } from './generated/webhooks.ts';
export { WEBHOOK_EVENT_TYPES, type WebhookEvents } from './generated/webhooks.ts';
export { WebhookVerificationError, type WebhookVerificationFailure } from './runtime/errors.ts';
/** An event of a type that this SDK version knows. `type` is always set. */
export type KnownWebhookEvent = {
    [Type in keyof WebhookEvents]: WebhookEvents[Type] & {
        type: Type;
    };
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
/**
 * Checks the `X-Pierre-Signature` header of a delivery: an HMAC-SHA256 of `<t>.<payload>` with
 * the secret, and a timestamp `t` within `tolerance_seconds` of now. Returns the event, a union
 * on `type`. Throws `WebhookVerificationError` when the check fails.
 *
 * Docs: search for `verifyWebhook` in the docs MCP server, https://code.storage/docs/mcp.
 */
export declare function verifyWebhook(params: VerifyWebhookParams): Promise<KnownWebhookEvent | UnknownWebhookEvent>;
//# sourceMappingURL=webhooks.d.ts.map