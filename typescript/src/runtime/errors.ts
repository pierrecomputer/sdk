// The errors of the SDK.

import type {
	NotesWriteResult,
	RefUpdateResult,
	RestoredCommit,
	WrittenCommit,
} from '../generated/schemas.ts';

/** The docs page with the table of problem codes, in the Markdown form for agents. */
export const ERROR_CODES_DOC_URL = 'https://code.storage/docs/api/overview.md#error-codes';

/** The base class of every error that the SDK raises. */
export class PierreError extends Error {
	override name = 'PierreError';
}

/** The request got no response. */
export class APIConnectionError extends PierreError {
	override name = 'APIConnectionError';
}

/** The request got no response before its timeout. */
export class APITimeoutError extends APIConnectionError {
	override name = 'APITimeoutError';
}

type ProblemBody = Record<string, unknown>;

/** An HTTP error response. Branch on `code`, not on the message. */
export class APIError extends PierreError {
	override name = 'APIError';
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
	readonly doc_url: string = ERROR_CODES_DOC_URL;

	constructor(status: number, body: unknown, headers: Headers = new Headers()) {
		const problem: ProblemBody = isRecord(body) ? body : {};
		const code = text(problem.code);
		const title = text(problem.title);
		const detail = text(problem.detail) ?? text(problem.error) ?? text(problem.message);
		super(
			`${status}${code === undefined ? '' : ` ${code}`}: ${detail ?? title ?? 'request failed'}`,
		);
		this.status = status;
		this.code = code;
		this.title = title;
		this.detail = detail;
		this.request_id = headers.get('x-request-id');
		this.headers = headers;
		this.body = body;
	}
}

export class BadRequestError extends APIError {
	override name = 'BadRequestError';
}
export class AuthenticationError extends APIError {
	override name = 'AuthenticationError';
}
export class PermissionDeniedError extends APIError {
	override name = 'PermissionDeniedError';
}
export class NotFoundError extends APIError {
	override name = 'NotFoundError';
}
export class ConflictError extends APIError {
	override name = 'ConflictError';
}
export class RateLimitError extends APIError {
	override name = 'RateLimitError';
}
export class InternalServerError extends APIError {
	override name = 'InternalServerError';
}

/** A merge conflict. It carries the conflict fields of the response. */
export class MergeConflictError extends ConflictError {
	override name = 'MergeConflictError';
	readonly conflict_type: string | undefined;
	readonly conflict_paths: unknown;
	readonly merge_base_sha: string | undefined;

	constructor(status: number, body: unknown, headers?: Headers) {
		super(status, body, headers);
		const problem: ProblemBody = isRecord(body) ? body : {};
		this.conflict_type = text(problem.conflict_type);
		this.conflict_paths = problem.conflict_paths;
		this.merge_base_sha = text(problem.merge_base_sha);
	}
}

/**
 * A Git write whose ref guard failed: a response with the code `ref_guard_failed`. `guard` names the
 * request field of the guard, for example `expected_target_sha`. `current_sha` is the commit of the
 * guarded ref, or 40 zeros when the ref does not exist; send it as the guard of the next attempt.
 * The body of a commit write, a restore, or a notes write also keeps `result`, which `body` gives.
 */
export class RefGuardError extends ConflictError {
	override name = 'RefGuardError';
	readonly guard: string | undefined;
	readonly current_sha: string | undefined;

	constructor(status: number, body: unknown, headers?: Headers) {
		super(status, body, headers);
		const problem: ProblemBody = isRecord(body) ? body : {};
		this.guard = text(problem.guard);
		this.current_sha = text(problem.current_sha);
	}
}

/**
 * A Git write whose ref update failed: an error response whose body has `result`. It carries
 * `result` and `commit`. A Git write method returns only when the ref update succeeded.
 */
export class RefUpdateError extends APIError {
	override name = 'RefUpdateError';
	/**
	 * The result of the ref update. `status` gives the reason, for example `conflict` or
	 * `precondition_failed`. A notes write sends a `NotesWriteResult`, which has only `success`,
	 * `status`, and `message`.
	 */
	readonly result: RefUpdateResult | NotesWriteResult;
	/** The commit of the write, or `null` when the response has none. A restore has no `blob_count`. */
	readonly commit: WrittenCommit | RestoredCommit | null;

	constructor(status: number, body: unknown, headers?: Headers) {
		super(status, body, headers);
		const problem: ProblemBody = isRecord(body) ? body : {};
		// The schemas of the SDK model give the types, as for a 2xx body; the runtime does not
		// check the response against them. `apiError` picks this class only when `result` is an
		// object.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		this.result = problem.result as RefUpdateResult | NotesWriteResult;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		this.commit = (problem.commit ?? null) as WrittenCommit | RestoredCommit | null;
	}
}

export type WebhookVerificationFailure =
	| 'missing_signature'
	| 'malformed_signature'
	| 'signature_mismatch'
	| 'timestamp_out_of_range'
	| 'invalid_payload';

/** `verifyWebhook` rejected the delivery. */
export class WebhookVerificationError extends PierreError {
	override name = 'WebhookVerificationError';
	readonly reason: WebhookVerificationFailure;

	constructor(reason: WebhookVerificationFailure, message: string) {
		super(message);
		this.reason = reason;
	}
}

const BY_STATUS: Record<number, typeof APIError> = {
	400: BadRequestError,
	401: AuthenticationError,
	403: PermissionDeniedError,
	404: NotFoundError,
	409: ConflictError,
	429: RateLimitError,
};

/** The codes of a merge conflict. Today the conflict body can also have `conflict_type` only. */
const MERGE_CONFLICT_CODES = new Set(['merge_conflict']);

/** The code of a failed ref guard. Its body can also have `result`, so it is read first. */
const REF_GUARD_FAILED = 'ref_guard_failed';

/** Picks the error class of an error response from the status and the body. */
export function apiError(status: number, body: unknown, headers: Headers): APIError {
	const problem: ProblemBody = isRecord(body) ? body : {};
	const code = text(problem.code);
	if (code === REF_GUARD_FAILED) return new RefGuardError(status, body, headers);
	if (isRecord(problem.result)) return new RefUpdateError(status, body, headers);
	if (
		(code !== undefined && MERGE_CONFLICT_CODES.has(code)) ||
		typeof problem.conflict_type === 'string'
	) {
		return new MergeConflictError(status, body, headers);
	}
	const ErrorClass = BY_STATUS[status] ?? (status >= 500 ? InternalServerError : APIError);
	return new ErrorClass(status, body, headers);
}

/** The problem `code` of a parsed body, or `undefined`. */
export function problemCode(body: unknown): string | undefined {
	return isRecord(body) ? text(body.code) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}
