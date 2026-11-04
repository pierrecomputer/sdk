import { PierreCore, type PierreOptions } from '../runtime/client.ts';
import { MetaNamespace } from './namespaces/meta.ts';
import { ReposNamespace } from './namespaces/repos.ts';
/** The core client with every top-level namespace. */
export declare class PierreNamespaces extends PierreCore {
    readonly meta: MetaNamespace;
    readonly repos: ReposNamespace;
    constructor(options?: PierreOptions);
}
//# sourceMappingURL=client.d.ts.map