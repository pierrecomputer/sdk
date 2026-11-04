// The core client: options, environment variables, credentials, and the transport, with no
// namespaces. `Pierre` adds every namespace, and a subpath such as
// `@pierre/sdk/repos` builds one namespace on a core client.

import { VERSION } from '../version.ts';
import {
	checkRefPolicies,
	getTokenCredentials,
	keySigner,
	registerClientKey,
	signerCredentials,
	tokenCredentials,
	tokenIssuer,
	type Credentials,
	type GetToken,
	type RefPolicy,
	type Signer,
} from './credentials.ts';
import { PierreError } from './errors.ts';
import { checkMaxRetries, checkTimeout, HttpRuntime } from './http.ts';
import type { Runtime } from './runtime.ts';

export interface PierreOptions {
	/** The organization name. Default: `PIERRE_ORG`, or the `iss` claim of `token`. */
	org?: string;
	/** A PKCS #8 PEM private key. Default: `PIERRE_PRIVATE_KEY`, or the file at `PIERRE_PRIVATE_KEY_FILE`. */
	privateKey?: string;
	/** A fixed token. Default: `PIERRE_TOKEN`. */
	token?: string;
	/** A function that returns a token for each request, for a client with no private key. */
	getToken?: GetToken;
	/** The API base URL. Default: `PIERRE_API_BASE_URL`, or `https://api.{org}.code.storage`. */
	baseUrl?: string;
	/** The Git host. Default: `PIERRE_GIT_HOST`, or `{org}.code.storage`. */
	gitHost?: string;
	/** The timeout of each attempt, in milliseconds. Default: 60000. */
	timeout?: number;
	/** The number of retries of a transient failure. Default: 2. */
	maxRetries?: number;
	/** Headers for every request. */
	defaultHeaders?: Record<string, string>;
	fetch?: typeof fetch;
	/**
	 * The `refs` claim of each request token, which limits the refs that a write can change. A
	 * request option replaces it. A client with a fixed `token` cannot have it.
	 */
	refPolicies?: readonly RefPolicy[];
}

/** The settings of a client. Read them on `pierre.options`. It holds no credential. */
export interface ClientOptions {
	/** The organization name, when the client knows it. */
	readonly org: string | undefined;
	readonly baseUrl: string;
	/** The Git host, when the client knows the organization or `gitHost` is set. */
	readonly gitHost: string | undefined;
	readonly timeout: number;
	readonly maxRetries: number;
	/** The ref policies of each request token, when the client has them. */
	readonly refPolicies: readonly RefPolicy[] | undefined;
}

type Credential =
	| { kind: 'privateKey'; signer: Signer }
	| { kind: 'token'; token: string }
	| { kind: 'getToken'; getToken: GetToken };

/** The settings after the options and the environment, before the defaults. */
interface Settings {
	org: string | undefined;
	baseUrl: string | undefined;
	gitHost: string | undefined;
	timeout: number;
	maxRetries: number;
	defaultHeaders: Record<string, string>;
	fetch: typeof fetch | undefined;
	refPolicies: readonly RefPolicy[] | undefined;
	credential: Credential;
}

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
] as const;

type Environment = Partial<Record<(typeof VARIABLES)[number], string>>;

// Module-private state, so that the only own names of a client are `options` and `withOptions`.
const runtimes = new WeakMap<PierreCore, Runtime>();
const clientSettings = new WeakMap<PierreCore, Settings>();
/** The settings that `withOptions` gives to the copy, by the options object of the copy. */
const inherited = new WeakMap<PierreOptions, Settings>();

/** The transport of a client. The generated namespaces call it. */
export function runtimeOf(client: PierreCore): Runtime {
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
	readonly options: ClientOptions;

	constructor(options: PierreOptions = {}) {
		const parent = inherited.get(options);
		const settings = parent === undefined ? fromEnvironment(options) : withChanges(parent, options);
		const { credential } = settings;
		const org =
			settings.org ?? (credential.kind === 'token' ? tokenIssuer(credential.token) : undefined);
		// The SDK does not verify a token, so its `iss` can name any host. A default host uses only
		// a host label, and so stays under `code.storage`.
		const label = org !== undefined && HOST_LABEL.test(org) ? org : undefined;
		if (settings.baseUrl === undefined && label === undefined) {
			throw new PierreError(
				org === undefined
					? 'Set `org` or PIERRE_ORG, or give `baseUrl`.'
					: 'The organization name is not a host label, so give `baseUrl`.',
			);
		}
		const { refPolicies } = settings;
		// The SDK cannot change the claims of a fixed token, so the limit would not apply.
		if (credential.kind === 'token' && refPolicies !== undefined && refPolicies.length > 0) {
			throw new PierreError(
				'A client with a fixed `token` cannot have `refPolicies`. Give `privateKey` or `getToken`.',
			);
		}
		const baseUrl = checkBaseUrl(settings.baseUrl ?? `https://api.${label}.code.storage`);
		const gitHost = settings.gitHost ?? (label === undefined ? undefined : `${label}.code.storage`);

		let credentials: Credentials;
		if (credential.kind === 'privateKey') {
			// The gateway finds the public keys of the organization by the `iss` claim.
			if (org === undefined) throw new PierreError('A private key needs `org` or PIERRE_ORG.');
			credentials = signerCredentials(org, credential.signer);
		} else if (credential.kind === 'token') {
			credentials = tokenCredentials(credential.token);
		} else {
			credentials = getTokenCredentials(credential.getToken);
		}
		const fetchFunction = settings.fetch ?? globalThis.fetch.bind(globalThis);

		runtimes.set(
			this,
			new HttpRuntime({
				baseUrl,
				credentials,
				fetch: fetchFunction,
				client: `pierre-sdk-typescript/${VERSION}`,
				defaultHeaders: settings.defaultHeaders,
				timeout: settings.timeout,
				maxRetries: settings.maxRetries,
				refPolicies,
			}),
		);
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
	withOptions(changes: PierreOptions = {}): this {
		const settings = clientSettings.get(this);
		if (settings === undefined) throw new PierreError('The client is not initialized.');
		const options: PierreOptions = { ...changes };
		inherited.set(options, settings);
		// A subclass, such as `Pierre`, takes the same options as `PierreCore`.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		const Client = this.constructor as new (options: PierreOptions) => this;
		return new Client(options);
	}
}

/** Checks that the base URL is an absolute `https` or `http` URL. */
function checkBaseUrl(baseUrl: string): string {
	let protocol: string | undefined;
	try {
		protocol = new URL(baseUrl).protocol;
	} catch {
		protocol = undefined;
	}
	if (protocol !== 'https:' && protocol !== 'http:') {
		throw new PierreError(
			'`baseUrl` must be an absolute https URL, for example https://api.acme.code.storage.',
		);
	}
	return baseUrl;
}

function fromEnvironment(options: PierreOptions): Settings {
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

function withChanges(parent: Settings, changes: PierreOptions): Settings {
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
function credentialOf(options: PierreOptions): Credential | undefined {
	const { privateKey, token, getToken } = options;
	const count = [privateKey, token, getToken].filter((value) => value !== undefined).length;
	if (count > 1) throw new PierreError('Give only one of `privateKey`, `token`, and `getToken`.');
	if (privateKey !== undefined) {
		return { kind: 'privateKey', signer: keySigner(() => Promise.resolve(privateKey)) };
	}
	if (token !== undefined) {
		if (token === '') throw new PierreError('`token` must not be empty.');
		return { kind: 'token', token };
	}
	if (getToken !== undefined) {
		if (typeof getToken !== 'function') throw new PierreError('`getToken` must be a function.');
		return { kind: 'getToken', getToken };
	}
	return undefined;
}

function environmentCredential(env: Environment): Credential {
	const { PIERRE_TOKEN: token, PIERRE_PRIVATE_KEY: privateKey } = env;
	const keyFile = env.PIERRE_PRIVATE_KEY_FILE;
	if (token !== undefined) return { kind: 'token', token };
	if (privateKey !== undefined) {
		return { kind: 'privateKey', signer: keySigner(() => Promise.resolve(privateKey)) };
	}
	if (keyFile !== undefined) {
		return { kind: 'privateKey', signer: keySigner(() => readKeyFile(keyFile)) };
	}
	throw new PierreError(
		'Give `privateKey`, `token`, or `getToken`, or set PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN.',
	);
}

/** The Pierre variables of the process. An empty value counts as not set. */
function environment(): Environment {
	const process = (globalThis as { process?: { env?: Record<string, string | undefined> } })
		.process;
	const env = process?.env ?? {};
	const result: Environment = {};
	for (const name of VARIABLES) {
		const value = env[name];
		if (value !== undefined && value !== '') result[name] = value;
	}
	return result;
}

interface KeyFileReader {
	readFile(path: string, encoding: 'utf8'): Promise<string>;
}

function isKeyFileReader(value: unknown): value is KeyFileReader {
	return (
		typeof value === 'object' &&
		value !== null &&
		'readFile' in value &&
		typeof value.readFile === 'function'
	);
}

/**
 * Reads the key file through `process.getBuiltinModule`, so the package has no `node:` import
 * and a browser or edge bundle stays free of Node code.
 */
async function readKeyFile(path: string): Promise<string> {
	const process = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
		.process;
	const fs = process?.getBuiltinModule?.('node:fs/promises');
	if (!isKeyFileReader(fs)) {
		throw new PierreError(
			'PIERRE_PRIVATE_KEY_FILE needs a runtime with `node:fs`. Set PIERRE_PRIVATE_KEY instead.',
		);
	}
	try {
		return await fs.readFile(path, 'utf8');
	} catch (error) {
		throw new PierreError(`Cannot read PIERRE_PRIVATE_KEY_FILE (${path}).`, { cause: error });
	}
}
