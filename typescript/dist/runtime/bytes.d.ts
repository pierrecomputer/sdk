/** One piece of content: text, which the SDK sends as UTF-8, or bytes. */
type ContentChunk = string | ArrayBuffer | ArrayBufferView;
/** Content of a file or a diff: one chunk, a `Blob`, or a stream or an iterable of chunks. */
export type Content = ContentChunk | Blob | ReadableStream<ContentChunk> | Iterable<ContentChunk> | AsyncIterable<ContentChunk>;
/** The gateway limits a decoded chunk to 4 MiB. */
export declare const MAX_CHUNK_BYTES: number;
/**
 * The bytes of one chunk of content. A string gives its UTF-8 bytes. A chunk of another type
 * throws, because JavaScript code and loosely typed streams can yield one.
 */
export declare function chunkBytes(chunk: unknown): Uint8Array;
/**
 * Splits content into chunks of at most `MAX_CHUNK_BYTES`, and joins small pieces up to that
 * size. The last chunk has `eof: true`, and empty content gives one empty chunk.
 */
export declare function chunks(content: Content): AsyncIterable<{
    bytes: Uint8Array;
    eof: boolean;
}>;
export {};
//# sourceMappingURL=bytes.d.ts.map