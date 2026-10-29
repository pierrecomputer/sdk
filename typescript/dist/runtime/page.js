// List pages.
import { APIPromise } from './api-promise.js';
import { PierreError } from './errors.js';
/**
 * One page of a list. `body` is the full response, with the fields beside the items. `for await`
 * on a page iterates over the items of this page and of each next page.
 */
export class Page {
    data;
    has_more;
    next_cursor;
    body;
    /** The platform response of this page. The SDK read its body. */
    response;
    #fetch;
    /**
     * A list method makes a page. A test can also make one, to mock a list method. Return the page
     * itself, not a promise of it, so that `await` and `for await` both work. `fetch` gets the page
     * at a cursor. A page with `has_more` false never calls it.
     *
     * ```ts
     * const fields = { data, has_more: false, next_cursor: undefined, body, response: new Response() };
     * const page = new Page(fields, () => Promise.reject(new Error('no next page')));
     * ```
     */
    constructor(fields, fetch) {
        this.data = fields.data;
        this.has_more = fields.has_more;
        this.next_cursor = fields.next_cursor;
        this.body = fields.body;
        this.response = fields.response;
        this.#fetch = fetch;
    }
    /** Whether a next page exists: `has_more` is true, and `next_cursor` is not empty. */
    hasNextPage() {
        return this.#nextCursor() !== undefined;
    }
    /** Gets the next page. Call `hasNextPage()` first: with no next page, it throws. */
    async getNextPage() {
        const cursor = this.#nextCursor();
        if (cursor === undefined) {
            throw new PierreError('No next page. Call `hasNextPage()` before `getNextPage()`.');
        }
        return this.#fetch(cursor);
    }
    /** This page, then each next page. */
    async *iterPages() {
        yield this;
        let cursor = this.#nextCursor();
        while (cursor !== undefined) {
            const page = await this.#fetch(cursor);
            yield page;
            cursor = page.#nextCursor();
        }
    }
    /**
     * The response body of this page. So `JSON.stringify(page)` gives the response that the API
     * sent, with the items one time and without the platform response.
     */
    toJSON() {
        return this.body;
    }
    async *[Symbol.asyncIterator]() {
        for await (const page of this.iterPages())
            yield* page.data;
    }
    #nextCursor() {
        return this.has_more && this.next_cursor !== undefined && this.next_cursor !== ''
            ? this.next_cursor
            : undefined;
    }
}
/**
 * The result of a `list` method. `await` gives the first page, and `for await` iterates over the
 * items of every page.
 */
export class PagePromise extends APIPromise {
    async *[Symbol.asyncIterator]() {
        yield* await this;
    }
}
//# sourceMappingURL=page.js.map