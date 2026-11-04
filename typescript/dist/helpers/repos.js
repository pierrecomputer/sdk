// The repository create. A copy reads its source with a token, and the SDK
// adds that token when the caller gives none.
export function createRepo(runtime, operation, params, options) {
    const source = params.base_repo;
    // The deprecated sync form, with `provider`, reads no Code Storage repository.
    if (source === undefined || source.provider !== undefined || source.auth?.token !== undefined) {
        return runtime.request(operation, params, options);
    }
    return runtime.request(operation, withSourceToken(runtime, params, source, options), options);
}
/** The params with a `git:read` token for the source repository of a copy. */
async function withSourceToken(runtime, params, source, options) {
    const token = await runtime.readToken(source.name, options);
    return { ...params, base_repo: { ...source, auth: { ...source.auth, token } } };
}
//# sourceMappingURL=repos.js.map