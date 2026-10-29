// List pages.

import { APIPromise } from './api-promise.ts';
import { PierreError } from './errors.ts';

/** The fields of one page. */
export interface PageFields<Item, Body> {
	data: Item[];
	has_more: boolean;
	next_cursor: string | undefined;
	body: Body;
	response: Response;
}

/** Gets the page at a cursor, with the params and the request options of the first call. */
export type FetchPage<Item, Body> = (cursor: string) => Promise<Page<Item, Body>>;

/**
 * One page of a list. `body` is the full response, with the fields beside the items. `for await`
 * on a page iterates over the items of this page and of each next page.
 */
export class Page<Item, Body> implements AsyncIterable<Item> {
	readonly data: Item[];
	readonly has_more: boolean;
	readonly next_cursor: string | undefined;
	readonly body: Body;
	/** The platform response of this page. The SDK read its body. */
	readonly response: Response;
	readonly #fetch: FetchPage<Item, Body>;

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
	constructor(fields: PageFields<Item, Body>, fetch: FetchPage<Item, Body>) {
		this.data = fields.data;
		this.has_more = fields.has_more;
		this.next_cursor = fields.next_cursor;
		this.body = fields.body;
		this.response = fields.response;
		this.#fetch = fetch;
	}

	/** Whether a next page exists: `has_more` is true, and `next_cursor` is not empty. */
	hasNextPage(): boolean {
		return this.#nextCursor() !== undefined;
	}

	/** Gets the next page. Call `hasNextPage()` first: with no next page, it throws. */
	async getNextPage(): Promise<Page<Item, Body>> {
		const cursor = this.#nextCursor();
		if (cursor === undefined) {
			throw new PierreError('No next page. Call `hasNextPage()` before `getNextPage()`.');
		}
		return this.#fetch(cursor);
	}

	/** This page, then each next page. */
	async *iterPages(): AsyncGenerator<Page<Item, Body>, void, undefined> {
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
	toJSON(): Body {
		return this.body;
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Item> {
		for await (const page of this.iterPages()) yield* page.data;
	}

	#nextCursor(): string | undefined {
		return this.has_more && this.next_cursor !== undefined && this.next_cursor !== ''
			? this.next_cursor
			: undefined;
	}
}

/**
 * The result of a `list` method. `await` gives the first page, and `for await` iterates over the
 * items of every page.
 */
export class PagePromise<Item, Body, DeclaredHeaders = Record<string, never>>
	extends APIPromise<Page<Item, Body>, DeclaredHeaders>
	implements AsyncIterable<Item>
{
	async *[Symbol.asyncIterator](): AsyncIterator<Item> {
		yield* await this;
	}
}
