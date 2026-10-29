// Upload content in each form that the SDK accepts, as byte chunks.
import { PierreError } from './errors.js';
/** The gateway limits a decoded chunk to 4 MiB. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
/**
 * The bytes of one chunk of content. A string gives its UTF-8 bytes. A chunk of another type
 * throws, because JavaScript code and loosely typed streams can yield one.
 */
export function chunkBytes(chunk) {
    if (typeof chunk === 'string')
        return new TextEncoder().encode(chunk);
    if (chunk instanceof ArrayBuffer)
        return new Uint8Array(chunk);
    // A plain `Uint8Array`, so that `slice` copies also the bytes of a Node `Buffer`.
    if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    throw new PierreError(`Each chunk of \`content\` must be a string, an ArrayBuffer, or an ArrayBufferView, not ${typeName(chunk)}.`);
}
function typeName(value) {
    if (value === null)
        return 'null';
    // An object from `Object.create(null)` has no constructor.
    if (typeof value === 'object')
        return value.constructor?.name ?? 'object';
    return typeof value;
}
async function* pieces(content) {
    if (typeof content === 'string' ||
        content instanceof ArrayBuffer ||
        ArrayBuffer.isView(content)) {
        yield chunkBytes(content);
    }
    else if (content instanceof Blob) {
        yield* pieces(content.stream());
    }
    else if (content instanceof ReadableStream) {
        const reader = content.getReader();
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    return;
                let bytes;
                try {
                    bytes = chunkBytes(value);
                }
                catch (error) {
                    // A released lock does not close the source, for example a file, so cancel it.
                    await reader.cancel(error);
                    throw error;
                }
                yield bytes;
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    else if (typeof content === 'object' &&
        content !== null &&
        (Symbol.iterator in content || Symbol.asyncIterator in content)) {
        for await (const chunk of content)
            yield chunkBytes(chunk);
    }
    else {
        throw new PierreError(`\`content\` must be a string, an ArrayBuffer, an ArrayBufferView, a Blob, a ReadableStream, or an iterable of chunks, not ${typeName(content)}.`);
    }
}
/**
 * Splits content into chunks of at most `MAX_CHUNK_BYTES`, and joins small pieces up to that
 * size. The last chunk has `eof: true`, and empty content gives one empty chunk.
 */
export async function* chunks(content) {
    let parts = [];
    let size = 0;
    const take = () => {
        const [only] = parts;
        const bytes = parts.length === 1 && only !== undefined ? only : join(parts, size);
        parts = [];
        size = 0;
        return bytes;
    };
    for await (const piece of pieces(content)) {
        let offset = 0;
        while (offset < piece.length) {
            // A full chunk goes out only when more bytes follow, so the last chunk has `eof`.
            if (size === MAX_CHUNK_BYTES)
                yield { bytes: take(), eof: false };
            const length = Math.min(piece.length - offset, MAX_CHUNK_BYTES - size);
            // A copy, because a source can reuse its buffer for the next piece.
            parts.push(piece.slice(offset, offset + length));
            size += length;
            offset += length;
        }
    }
    yield { bytes: take(), eof: true };
}
function join(parts, size) {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
    }
    return bytes;
}
//# sourceMappingURL=bytes.js.map