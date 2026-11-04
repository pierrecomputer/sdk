// The core client: options, environment variables, credentials, and the transport, with no
// namespaces. `Pierre` adds every namespace, and a subpath such as
// `@pierre/sdk/repos` builds one namespace on a core client.
import { VERSION } from '../version.js';
import { checkRefPolicies, getTokenCredentials, keySigner, registerClientKey, signerCredentials, tokenCredentials, tokenIssuer, } from './credentials.js';
import { PierreError } from './errors.js';
import { checkMaxRetries, checkTimeout, HttpRuntime } from './http.js';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
/** A DNS label: the form of an organization name in its default hosts. */
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const VARIABLES = [
    'PIERRE_ORG',
    'PIERRE_PRIVATE_KEY',
    'PIERRE_PRIVATE_KEY_FILE',
    'PIERRE_TOKEN',
    'PIERRE_API_BASE_URL',
    'PIERRE_GIT_HOST',
];
// Module-private state, so that the only own names of a client are `options` and `withOptions`.
const runtimes = new WeakMap();
const clientSettings = new WeakMap();
/** The settings that `withOptions` gives to the copy, by the options object of the copy. */
const inherited = new WeakMap();
/** The transport of a client. The generated namespaces call it. */
export function runtimeOf(client) {
    const runtime = runtimes.get(client);
    if (runtime === undefined) {
        throw new PierreError('Give a client from `new PierreCore()` or `new Pierre()`.');
    }
    return runtime;
}
/**
 * The core client, with no namespaces. Give it to a namespace from a subpath, for example
 * `new ReposNamespace(new PierreCore())` from `@pierre/sdk/repos`, so a bundle loads only that
 * namespace. `new Pierre()` has every namespace.
 */
export class PierreCore {
    /**
     * The settings of the client. Every top-level name other than `options` and `withOptions` is
     * free for an API namespace.
     */
    options;
    constructor(options = {}) {
        const parent = inherited.get(options);
        const settings = parent === undefined ? fromEnvironment(options) : withChanges(parent, options);
        const { credential } = settings;
        const org = settings.org ?? (credential.kind === 'token' ? tokenIssuer(credential.token) : undefined);
        // The SDK does not verify a token, so its `iss` can name any host. A default host uses only
        // a host label, and so stays under `code.storage`.
        const label = org !== undefined && HOST_LABEL.test(org) ? org : undefined;
        if (settings.baseUrl === undefined && label === undefined) {
            throw new PierreError(org === undefined
                ? 'Set `org` or PIERRE_ORG, or give `baseUrl`.'
                : 'The organization name is not a host label, so give `baseUrl`.');
        }
        const { refPolicies } = settings;
        // The SDK cannot change the claims of a fixed token, so the limit would not apply.
        if (credential.kind === 'token' && refPolicies !== undefined && refPolicies.length > 0) {
            throw new PierreError('A client with a fixed `token` cannot have `refPolicies`. Give `privateKey` or `getToken`.');
        }
        const baseUrl = checkBaseUrl(settings.baseUrl ?? `https://api.${label}.code.storage`);
        const gitHost = settings.gitHost ?? (label === undefined ? undefined : `${label}.code.storage`);
        let credentials;
        if (credential.kind === 'privateKey') {
            // The gateway finds the public keys of the organization by the `iss` claim.
            if (org === undefined)
                throw new PierreError('A private key needs `org` or PIERRE_ORG.');
            credentials = signerCredentials(org, credential.signer);
        }
        else if (credential.kind === 'token') {
            credentials = tokenCredentials(credential.token);
        }
        else {
            credentials = getTokenCredentials(credential.getToken);
        }
        const fetchFunction = settings.fetch ?? globalThis.fetch.bind(globalThis);
        runtimes.set(this, new HttpRuntime({
            baseUrl,
            credentials,
            fetch: fetchFunction,
            client: `pierre-sdk-typescript/${VERSION}`,
            defaultHeaders: settings.defaultHeaders,
            timeout: settings.timeout,
            maxRetries: settings.maxRetries,
            refPolicies,
        }));
        // A copy keeps the organization of `options`, also when it came from the token.
        clientSettings.set(this, { ...settings, org });
        registerClientKey(this, {
            org,
            signer: credential.kind === 'privateKey' ? credential.signer : undefined,
            credentials,
        });
        this.options = Object.freeze({
            org,
            baseUrl,
            gitHost,
            timeout: settings.timeout,
            maxRetries: settings.maxRetries,
            refPolicies,
        });
    }
    /**
     * Returns a copy of the client with changed options. The copy keeps every option that
     * `changes` does not set, including the `org` of `options`, and does not read the environment
     * again. It keeps the credential, unless `changes` gives one. When `org` changes, the default
     * hosts follow it.
     */
    withOptions(changes = {}) {
        const settings = clientSettings.get(this);
        if (settings === undefined)
            throw new PierreError('The client is not initialized.');
        const options = { ...changes };
        inherited.set(options, settings);
        // A subclass, such as `Pierre`, takes the same options as `PierreCore`.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const Client = this.constructor;
        return new Client(options);
    }
}
/** Checks that the base URL is an absolute `https` or `http` URL. */
function checkBaseUrl(baseUrl) {
    let protocol;
    try {
        protocol = new URL(baseUrl).protocol;
    }
    catch {
        protocol = undefined;
    }
    if (protocol !== 'https:' && protocol !== 'http:') {
        throw new PierreError('`baseUrl` must be an absolute https URL, for example https://api.acme.code.storage.');
    }
    return baseUrl;
}
function fromEnvironment(options) {
    const env = environment();
    return {
        org: options.org ?? env.PIERRE_ORG,
        baseUrl: options.baseUrl ?? env.PIERRE_API_BASE_URL,
        gitHost: options.gitHost ?? env.PIERRE_GIT_HOST,
        timeout: checkTimeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
        maxRetries: checkMaxRetries(options.maxRetries ?? DEFAULT_MAX_RETRIES),
        defaultHeaders: options.defaultHeaders ?? {},
        fetch: options.fetch,
        refPolicies: checkRefPolicies(options.refPolicies, 'refPolicies'),
        // A credential in the options replaces every credential in the environment.
        credential: credentialOf(options) ?? environmentCredential(env),
    };
}
function withChanges(parent, changes) {
    return {
        org: changes.org ?? parent.org,
        baseUrl: changes.baseUrl ?? parent.baseUrl,
        gitHost: changes.gitHost ?? parent.gitHost,
        timeout: checkTimeout(changes.timeout ?? parent.timeout),
        maxRetries: checkMaxRetries(changes.maxRetries ?? parent.maxRetries),
        defaultHeaders: changes.defaultHeaders ?? parent.defaultHeaders,
        fetch: changes.fetch ?? parent.fetch,
        refPolicies: checkRefPolicies(changes.refPolicies, 'refPolicies') ?? parent.refPolicies,
        credential: credentialOf(changes) ?? parent.credential,
    };
}
/** The credential in the options, or `undefined`. More than one is an error. */
function credentialOf(options) {
    const { privateKey, token, getToken } = options;
    const count = [privateKey, token, getToken].filter((value) => value !== undefined).length;
    if (count > 1)
        throw new PierreError('Give only one of `privateKey`, `token`, and `getToken`.');
    if (privateKey !== undefined) {
        return { kind: 'privateKey', signer: keySigner(() => Promise.resolve(privateKey)) };
    }
    if (token !== undefined) {
        if (token === '')
            throw new PierreError('`token` must not be empty.');
        return { kind: 'token', token };
    }
    if (getToken !== undefined) {
        if (typeof getToken !== 'function')
            throw new PierreError('`getToken` must be a function.');
        return { kind: 'getToken', getToken };
    }
    return undefined;
}
function environmentCredential(env) {
    const { PIERRE_TOKEN: token, PIERRE_PRIVATE_KEY: privateKey } = env;
    const keyFile = env.PIERRE_PRIVATE_KEY_FILE;
    if (token !== undefined)
        return { kind: 'token', token };
    if (privateKey !== undefined) {
        return { kind: 'privateKey', signer: keySigner(() => Promise.resolve(privateKey)) };
    }
    if (keyFile !== undefined) {
        return { kind: 'privateKey', signer: keySigner(() => readKeyFile(keyFile)) };
    }
    throw new PierreError('Give `privateKey`, `token`, or `getToken`, or set PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN.');
}
/** The Pierre variables of the process. An empty value counts as not set. */
function environment() {
    const process = globalThis
        .process;
    const env = process?.env ?? {};
    const result = {};
    for (const name of VARIABLES) {
        const value = env[name];
        if (value !== undefined && value !== '')
            result[name] = value;
    }
    return result;
}
function isKeyFileReader(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'readFile' in value &&
        typeof value.readFile === 'function');
}
/**
 * Reads the key file through `process.getBuiltinModule`, so the package has no `node:` import
 * and a browser or edge bundle stays free of Node code.
 */
async function readKeyFile(path) {
    const process = globalThis
        .process;
    const fs = process?.getBuiltinModule?.('node:fs/promises');
    if (!isKeyFileReader(fs)) {
        throw new PierreError('PIERRE_PRIVATE_KEY_FILE needs a runtime with `node:fs`. Set PIERRE_PRIVATE_KEY instead.');
    }
    try {
        return await fs.readFile(path, 'utf8');
    }
    catch (error) {
        throw new PierreError(`Cannot read PIERRE_PRIVATE_KEY_FILE (${path}).`, { cause: error });
    }
}
//# sourceMappingURL=client.js.map