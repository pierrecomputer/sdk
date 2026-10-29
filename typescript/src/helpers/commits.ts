// The public form of the streaming commit writes. The wire form sends a
// metadata line, then the content of each file as base64 chunk lines. These helpers take the
// content itself and write the chunks.

import type {
	ReposCommitsCreateFromDiffWireParams,
	ReposCommitsCreateWireParams,
} from '../generated/operations/repos.ts';
import type * as schemas from '../generated/schemas.ts';
import type { APIPromise } from '../runtime/api-promise.ts';
import { chunkBytes, chunks, type Content } from '../runtime/bytes.ts';
import { base64 } from '../runtime/credentials.ts';
import { PierreError } from '../runtime/errors.ts';
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

export interface ReposCommitsCreateParams extends Omit<
	ReposCommitsCreateWireParams,
	'files' | 'chunks'
> {
	/** An array, or an async iterable that yields the files. */
	files: Iterable<CommitFile> | AsyncIterable<CommitFile>;
}

export interface ReposCommitsCreateFromDiffParams extends Omit<
	ReposCommitsCreateFromDiffWireParams,
	'chunks'
> {
	/** The diff text, in the form that `git apply` reads. */
	diff: Content;
}

export function createCommit(
	runtime: Runtime,
	operation: OperationSpec,
	params: ReposCommitsCreateParams,
	options?: RequestOptions,
): APIPromise<schemas.CommitWriteResponse> {
	return runtime.request(operation, commitWireParams(params), options);
}

/** The wire params of a commit. The SDK reads all of `files` before the request. */
async function commitWireParams(
	params: ReposCommitsCreateParams,
): Promise<ReposCommitsCreateWireParams> {
	const { files, ...metadata } = params;
	// The metadata line names every file, so the SDK reads all of `files` first. Each content
	// streams later, and a content function runs only when the SDK sends its file.
	const entries: { file: CommitFile; contentId: string }[] = [];
	for await (const file of files) {
		const operationName = file.operation ?? 'upsert';
		if (operationName === 'upsert' && file.content === undefined) {
			throw new PierreError(`The file ${file.path} needs \`content\`.`);
		}
		if (operationName === 'delete' && file.content !== undefined) {
			throw new PierreError(`The delete of ${file.path} must not have \`content\`.`);
		}
		entries.push({ file: { ...file, ...copyBytes(file.content) }, contentId: crypto.randomUUID() });
	}
	const wireFiles: schemas.FileOperation[] = entries.map(({ file, contentId }) => {
		const operationName = file.operation ?? 'upsert';
		return {
			path: file.path,
			content_id: contentId,
			operation: operationName,
			...(operationName === 'upsert' ? { mode: file.mode ?? '100644' } : {}),
		};
	});
	async function* blobChunks(): AsyncIterable<{ blob_chunk: schemas.BlobChunk }> {
		for (const { file, contentId } of entries) {
			if (file.content === undefined) continue;
			const content = typeof file.content === 'function' ? await file.content() : file.content;
			for await (const chunk of chunks(content)) {
				yield { blob_chunk: { content_id: contentId, data: base64(chunk.bytes), eof: chunk.eof } };
			}
		}
	}
	return { ...metadata, files: wireFiles, chunks: blobChunks() };
}

/** A copy of byte-array content, which the caller can change after it yields the file. */
function copyBytes(content: FileContent | undefined): { content?: Content } {
	if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
		return { content: chunkBytes(content).slice() };
	}
	return {};
}

export function createCommitFromDiff(
	runtime: Runtime,
	operation: OperationSpec,
	params: ReposCommitsCreateFromDiffParams,
	options?: RequestOptions,
): APIPromise<schemas.CommitWriteResponse> {
	const { diff, ...metadata } = params;
	async function* diffChunks(): AsyncIterable<{ diff_chunk: schemas.DiffChunk }> {
		for await (const chunk of chunks(diff)) {
			yield { diff_chunk: { data: base64(chunk.bytes), eof: chunk.eof } };
		}
	}
	const wire: ReposCommitsCreateFromDiffWireParams = { ...metadata, chunks: diffChunks() };
	return runtime.request(operation, wire, options);
}
