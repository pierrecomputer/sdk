// The `Pierre` client: the core client with every namespace.
import { PierreNamespaces } from './generated/client.js';
/**
 * The Pierre client. `new Pierre()` reads `PIERRE_ORG` and `PIERRE_PRIVATE_KEY`, or the other
 * variables in the docs. Each namespace path is a catalog ID, for example
 * `pierre.repos.branches.create()`.
 *
 * Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
 * https://code.storage/docs/llms.txt.
 */
export class Pierre extends PierreNamespaces {
}
//# sourceMappingURL=client.js.map