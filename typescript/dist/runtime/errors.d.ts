import type { NotesWriteResult, RefUpdateResult, RestoredCommit, WrittenCommit } from '../generated/schemas.ts';
/** The docs page with the table of problem codes, in the Markdown form for agents. */
export declare const ERROR_CODES_DOC_URL = "https://code.storage/docs/api/overview.md#error-codes";
/** The base class of every error that the SDK raises. */
export declare class PierreError extends Error {
    name: string;
}
/** The request got no response. */
export declare class APIConnectionError extends PierreError {
    name: string;
}
/** The request got no response before its timeout. */
export declare class APITimeoutError extends APIConnectionError {
    name: string;
}
/** An HTTP error response. Branch on `code`, not on the message. */
export declare class APIError extends PierreError {
    name: string;
    readonly status: number;
    /** The problem `code`, for example `repository_not_found`. */
    readonly code: string | undefined;
    readonly title: string | undefined;
    readonly detail: string | undefined;
    /** The `X-Request-Id` response header, or `null` when the server does not send it. */
    readonly request_id: string | null;
    /** The headers of the error response, for example `retry-after`. */
    readonly headers: Headers;
    /** The parsed response body, with any extension members. */
    readonly body: unknown;
    /** The docs page that explains the codes. */
    readonly doc_url: string;
    constructor(status: number, body: unknown, headers?: Headers);
}
export declare class BadRequestError extends APIError {
    name: string;
}
export declare class AuthenticationError extends APIError {
    name: string;
}
export declare class PermissionDeniedError extends APIError {
    name: string;
}
export declare class NotFoundError extends APIError {
    name: string;
}
export declare class ConflictError extends APIError {
    name: string;
}
export declare class RateLimitError extends APIError {
    name: string;
}
export declare class InternalServerError extends APIError {
    name: string;
}
/** A merge conflict. It carries the conflict fields of the response. */
export declare class MergeConflictError extends ConflictError {
    name: string;
    readonly conflict_type: string | undefined;
    readonly conflict_paths: unknown;
    readonly merge_base_sha: string | undefined;
    constructor(status: number, body: unknown, headers?: Headers);
}
/**
 * A Git write whose ref guard failed: a response with the code `ref_guard_failed`. `guard` names the
 * request field of the guard, for example `expected_target_sha`. `current_sha` is the commit of the
 * guarded ref, or 40 zeros when the ref does not exist; send it as the guard of the next attempt.
 * The body of a commit write, a restore, or a notes write also keeps `result`, which `body` gives.
 */
export declare class RefGuardError extends ConflictError {
    name: string;
    readonly guard: string | undefined;
    readonly current_sha: string | undefined;
    constructor(status: number, body: unknown, headers?: Headers);
}
/**
 * A Git write whose ref update failed: an error response whose body has `result`. It carries
 * `result` and `commit`. A Git write method returns only when the ref update succeeded.
 */
export declare class RefUpdateError extends APIError {
    name: string;
    /**
     * The result of the ref update. `status` gives the reason, for example `conflict` or
     * `precondition_failed`. A notes write sends a `NotesWriteResult`, which has only `success`,
     * `status`, and `message`.
     */
    readonly result: RefUpdateResult | NotesWriteResult;
    /** The commit of the write, or `null` when the response has none. A restore has no `blob_count`. */
    readonly commit: WrittenCommit | RestoredCommit | null;
    constructor(status: number, body: unknown, headers?: Headers);
}
export type WebhookVerificationFailure = 'missing_signature' | 'malformed_signature' | 'signature_mismatch' | 'timestamp_out_of_range' | 'invalid_payload';
/** `verifyWebhook` rejected the delivery. */
export declare class WebhookVerificationError extends PierreError {
    name: string;
    readonly reason: WebhookVerificationFailure;
    constructor(reason: WebhookVerificationFailure, message: string);
}
/** Picks the error class of an error response from the status and the body. */
export declare function apiError(status: number, body: unknown, headers: Headers): APIError;
/** The problem `code` of a parsed body, or `undefined`. */
export declare function problemCode(body: unknown): string | undefined;
//# sourceMappingURL=errors.d.ts.map