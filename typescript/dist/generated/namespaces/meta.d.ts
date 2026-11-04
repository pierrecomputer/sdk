import type { APIPromise } from '../../runtime/api-promise.ts';
import { type PierreCore } from '../../runtime/client.ts';
import type { RequestOptions } from '../../runtime/runtime.ts';
import type * as schemas from '../schemas.ts';
/**
 * The `meta` namespace. `new Pierre()` has it as `pierre.meta`. To load only this namespace, build it on a core client: `new MetaNamespace(new PierreCore())`.
 */
export declare class MetaNamespace {
    #private;
    constructor(client: PierreCore);
    /**
     * Get Organization Metadata
     *
     * Return the cloud provider, region, and public inbound IP addresses of the Code Storage cluster that serves the current organisation. Addresses are listed separately for Git over HTTPS and for the HTTP API; allow them in firewall rules that restrict outbound traffic to Code Storage. The lists change when the cluster's ingress changes, so poll this endpoint rather than copying them once.
     *
     * Scope: `org:read`.
     *
     * Catalog ID `meta.get`: `GET /api/meta`.
     *
     * Docs: search for `meta.get` in the docs MCP server, https://code.storage/docs/mcp.
     */
    get(params?: Record<string, never>, options?: RequestOptions): APIPromise<schemas.Meta>;
}
//# sourceMappingURL=meta.d.ts.map