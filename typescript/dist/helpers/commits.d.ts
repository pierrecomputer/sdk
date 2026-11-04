import type { ReposCommitsCreateFromDiffWireParams, ReposCommitsCreateWireParams } from '../generated/operations/repos.ts';
import type * as schemas from '../generated/schemas.ts';
import type { APIPromise } from '../runtime/api-promise.ts';
import { type Content } from '../runtime/bytes.ts';
import type { OperationSpec } from '../runtime/operation.ts';
import type { RequestOptions, Runtime } from '../runtime/runtime.ts';
export type { Content } from '../runtime/bytes.ts';
/** File content, or a function that returns it when the SDK sends the file. */
export type FileContent = Content | (() => Content | Promise<Content>);
/** One file of a commit. */
export interface CommitFile {
    /** The repository path of the file. */
    path: string;
    /** `upsert` by default. */
    operation?: 'upsert' | 'delete';
    /** The Git file mode. `100644` by default for an upsert. */
    mode?: string;
    /**
     * The file content. An upsert needs it, and a delete must not have it.
     *
     * The SDK reads all of `files` before it sends any content, because the first NDJSON line
     * names every file. To open only one file at a time, give a function, for example
     * `() => createReadStream(path)`. The SDK calls the function when it sends that file.
     * The SDK copies a byte array when it reads the entry, so a caller can reuse a buffer.
     */
    content?: FileContent;
}
export interface ReposCommitsCreateParams extends Omit<ReposCommitsCreateWireParams, 'files' | 'chunks'> {
    /** An array, or an async iterable that yields the files. */
    files: Iterable<CommitFile> | AsyncIterable<CommitFile>;
}
export interface ReposCommitsCreateFromDiffParams extends Omit<ReposCommitsCreateFromDiffWireParams, 'chunks'> {
    /** The diff text, in the form that `git apply` reads. */
    diff: Content;
}
export declare function createCommit(runtime: Runtime, operation: OperationSpec, params: ReposCommitsCreateParams, options?: RequestOptions): APIPromise<schemas.CommitWriteResponse>;
export declare function createCommitFromDiff(runtime: Runtime, operation: OperationSpec, params: ReposCommitsCreateFromDiffParams, options?: RequestOptions): APIPromise<schemas.CommitWriteResponse>;
//# sourceMappingURL=commits.d.ts.map