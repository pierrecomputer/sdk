import type * as schemas from './schemas.ts';
/** The payload of each webhook event, by event type. */
export interface WebhookEvents {
    /**
     * Git ref updated
     *
     * Sent when a Git ref is updated in a repository. Each updated ref produces a separate event.
     */
    push: schemas.GitPushEvent;
    /**
     * Repository sync failed
     *
     * Sent when a repository sync run fails, including failures after retries are exhausted and infrastructure failures. Internal cancellations do not produce this event. run_count includes the run that just finished.
     */
    'repo.sync.failed': schemas.GitSyncFailedEvent;
    /**
     * Repository sync started
     *
     * Sent when a repository sync run begins, before the upstream fetch starts. run_count counts previously completed runs.
     */
    'repo.sync.started': schemas.GitSyncStartedEvent;
    /**
     * Repository sync succeeded
     *
     * Sent when a repository sync run completes successfully. run_count includes the run that just finished.
     */
    'repo.sync.succeeded': schemas.GitSyncSucceededEvent;
}
/** A webhook event that this SDK version knows. */
export type WebhookEvent = WebhookEvents[keyof WebhookEvents];
export declare const WEBHOOK_EVENT_TYPES: readonly ['push', 'repo.sync.failed', 'repo.sync.started', 'repo.sync.succeeded'];
//# sourceMappingURL=webhooks.d.ts.map