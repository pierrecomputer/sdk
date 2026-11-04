// The retry rules: which results are transient, and how long to wait.

/** The 409 codes of a condition that ends by itself. */
const RETRYABLE_CONFLICT_CODES = new Set(['repository_thawing', 'sync_in_progress']);

/** The first backoff delay. */
const INITIAL_DELAY_MS = 500;
/** The longest backoff delay. */
const MAX_BACKOFF_MS = 8000;
/** The longest `Retry-After` that the SDK waits. A longer value falls back to the backoff. */
const MAX_RETRY_AFTER_MS = 60_000;

/** Whether an error status can succeed on a repeat. */
export function transientStatus(status: number, code: string | undefined): boolean {
	return (
		status === 408 ||
		status === 429 ||
		status >= 500 ||
		(status === 409 && code !== undefined && RETRYABLE_CONFLICT_CODES.has(code))
	);
}

/**
 * The wait before retry number `attempt + 1`: the `Retry-After` value when it is 60 seconds or
 * less, or else an exponential backoff from 0.5 seconds, up to 8 seconds, less up to 25% jitter.
 */
export function retryDelay(retryAfter: string | null, attempt: number, now = Date.now()): number {
	const after = retryAfterMs(retryAfter, now);
	if (after !== undefined && after <= MAX_RETRY_AFTER_MS) return after;
	const backoff = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_BACKOFF_MS);
	return backoff * (1 - Math.random() * 0.25);
}

/**
 * The HTTP date form that servers send (IMF-fixdate, RFC 9110), for example
 * `Sun, 06 Nov 1994 08:49:37 GMT`. `Date.parse` alone accepts other text, such as `-1`, in a
 * different way in each engine.
 */
const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** A `Retry-After` value in seconds or as an HTTP date, in milliseconds from `now`. */
function retryAfterMs(value: string | null, now: number): number | undefined {
	if (value === null) return undefined;
	const text = value.trim();
	if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 1000;
	if (!HTTP_DATE.test(text)) return undefined;
	const date = Date.parse(text);
	return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/** Waits `ms`, or rejects with the reason of `signal` when it aborts. */
export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted === true) {
			reject(signal.reason);
			return;
		}
		let handle: ReturnType<typeof setTimeout> | undefined;
		const onAbort = (): void => {
			clearTimeout(handle);
			reject(signal?.reason);
		};
		handle = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
