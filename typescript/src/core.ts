// `@pierre/sdk/core`: the core client with no namespaces, and the errors.

export { APIPromise, type WithResponse } from './runtime/api-promise.ts';
export { PierreCore, type ClientOptions, type PierreOptions } from './runtime/client.ts';
export type { GetToken, RefPolicy, TokenRequest } from './runtime/credentials.ts';
export {
	APIConnectionError,
	APIError,
	APITimeoutError,
	AuthenticationError,
	BadRequestError,
	ConflictError,
	InternalServerError,
	MergeConflictError,
	NotFoundError,
	PermissionDeniedError,
	PierreError,
	RateLimitError,
	RefGuardError,
	RefUpdateError,
	WebhookVerificationError,
	type WebhookVerificationFailure,
} from './runtime/errors.ts';
export { Page, PagePromise } from './runtime/page.ts';
export type { HeadersResult, RequestOptions } from './runtime/runtime.ts';
export { VERSION } from './version.ts';
