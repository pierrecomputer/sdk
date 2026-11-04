/** Whether an error status can succeed on a repeat. */
export declare function transientStatus(status: number, code: string | undefined): boolean;
/**
 * The wait before retry number `attempt + 1`: the `Retry-After` value when it is 60 seconds or
 * less, or else an exponential backoff from 0.5 seconds, up to 8 seconds, less up to 25% jitter.
 */
export declare function retryDelay(retryAfter: string | null, attempt: number, now?: number): number;
/** Waits `ms`, or rejects with the reason of `signal` when it aborts. */
export declare function sleep(ms: number, signal: AbortSignal | undefined): Promise<void>;
//# sourceMappingURL=retry.d.ts.map