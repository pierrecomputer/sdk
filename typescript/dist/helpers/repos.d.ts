import type { ReposCreateParams } from '../generated/operations/repos.ts';
import type * as schemas from '../generated/schemas.ts';
import type { APIPromise } from '../runtime/api-promise.ts';
import type { OperationSpec } from '../runtime/operation.ts';
import type { RequestOptions, Runtime } from '../runtime/runtime.ts';
export declare function createRepo(runtime: Runtime, operation: OperationSpec, params: ReposCreateParams, options?: RequestOptions): APIPromise<schemas.ReposCreateResponse>;
//# sourceMappingURL=repos.d.ts.map