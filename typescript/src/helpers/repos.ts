// The repository create. A copy reads its source with a token, and the SDK
// adds that token when the caller gives none.

import type { ReposCreateParams } from '../generated/operations/repos.ts';
import type * as schemas from '../generated/schemas.ts';
import type { APIPromise } from '../runtime/api-promise.ts';
import type { OperationSpec } from '../runtime/operation.ts';
import type { RequestOptions, Runtime } from '../runtime/runtime.ts';

export function createRepo(
	runtime: Runtime,
	operation: OperationSpec,
	params: ReposCreateParams,
	options?: RequestOptions,
): APIPromise<schemas.ReposCreateResponse> {
	const source = params.base_repo;
	// The deprecated sync form, with `provider`, reads no Code Storage repository.
	if (source === undefined || source.provider !== undefined || source.auth?.token !== undefined) {
		return runtime.request(operation, params, options);
	}
	return runtime.request(operation, withSourceToken(runtime, params, source, options), options);
}

/** The params with a `git:read` token for the source repository of a copy. */
async function withSourceToken(
	runtime: Runtime,
	params: ReposCreateParams,
	source: schemas.BaseRepo,
	options: RequestOptions | undefined,
): Promise<ReposCreateParams> {
	const token = await runtime.readToken(source.name, options);
	return { ...params, base_repo: { ...source, auth: { ...source.auth, token } } };
}
