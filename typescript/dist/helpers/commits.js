// The public form of the streaming commit writes. The wire form sends a
// metadata line, then the content of each file as base64 chunk lines. These helpers take the
// content itself and write the chunks.
import { chunkBytes, chunks } from '../runtime/bytes.js';
import { base64 } from '../runtime/credentials.js';
import { PierreError } from '../runtime/errors.js';
export function createCommit(runtime, operation, params, options) {
    return runtime.request(operation, commitWireParams(params), options);
}
/** The wire params of a commit. The SDK reads all of `files` before the request. */
async function commitWireParams(params) {
    const { files, ...metadata } = params;
    // The metadata line names every file, so the SDK reads all of `files` first. Each content
    // streams later, and a content function runs only when the SDK sends its file.
    const entries = [];
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
    const wireFiles = entries.map(({ file, contentId }) => {
        const operationName = file.operation ?? 'upsert';
        return {
            path: file.path,
            content_id: contentId,
            operation: operationName,
            ...(operationName === 'upsert' ? { mode: file.mode ?? '100644' } : {}),
        };
    });
    async function* blobChunks() {
        for (const { file, contentId } of entries) {
            if (file.content === undefined)
                continue;
            const content = typeof file.content === 'function' ? await file.content() : file.content;
            for await (const chunk of chunks(content)) {
                yield { blob_chunk: { content_id: contentId, data: base64(chunk.bytes), eof: chunk.eof } };
            }
        }
    }
    return { ...metadata, files: wireFiles, chunks: blobChunks() };
}
/** A copy of byte-array content, which the caller can change after it yields the file. */
function copyBytes(content) {
    if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
        return { content: chunkBytes(content).slice() };
    }
    return {};
}
export function createCommitFromDiff(runtime, operation, params, options) {
    const { diff, ...metadata } = params;
    async function* diffChunks() {
        for await (const chunk of chunks(diff)) {
            yield { diff_chunk: { data: base64(chunk.bytes), eof: chunk.eof } };
        }
    }
    const wire = { ...metadata, chunks: diffChunks() };
    return runtime.request(operation, wire, options);
}
//# sourceMappingURL=commits.js.map