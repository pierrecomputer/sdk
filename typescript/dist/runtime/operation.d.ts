export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface ParameterSpec {
    readonly in: 'path' | 'query' | 'header';
    /** The wire name. */
    readonly name: string;
    /** The field of the params object. */
    readonly field: string;
}
/**
 * A JSON body: the runtime sends these fields of the params object. When the body is optional
 * and the params set none of the fields, the runtime sends no body.
 */
export interface JsonBodySpec {
    readonly encoding: 'json';
    readonly required: boolean;
    readonly fields: readonly string[];
}
/**
 * An NDJSON body: the first line is `{ [first]: <these fields of the params object> }`, and
 * `params.chunks` gives each later line when `rest` is true.
 */
export interface NdjsonBodySpec {
    readonly encoding: 'ndjson';
    readonly first: string;
    readonly fields: readonly string[];
    readonly rest: boolean;
}
export interface OperationSpec {
    readonly id: string;
    readonly method: HttpMethod;
    readonly path: string;
    readonly parameters: readonly ParameterSpec[];
    readonly body: JsonBodySpec | NdjsonBodySpec | null;
    readonly response: {
        readonly encoding: 'json' | 'ndjson' | 'bytes' | 'none';
        readonly headers: readonly {
            readonly name: string;
            readonly field: string;
        }[];
    };
    /** Whether a 304 response is a result, not an error. */
    readonly notModified: boolean;
    readonly scopes: readonly string[];
    /** Whether the token needs a `repo` claim. */
    readonly repoClaim: boolean;
    readonly pagination: {
        readonly itemField: string;
    } | null;
    readonly idempotencyKey: boolean;
}
//# sourceMappingURL=operation.d.ts.map