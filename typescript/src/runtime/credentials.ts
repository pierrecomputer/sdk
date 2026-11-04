// Credentials and token signing. Web Crypto only, so the
// code runs in Node, in a browser, and in an edge runtime. This module loads no client code,
// because `@pierre/sdk/auth` imports it.

import { PierreError } from './errors.ts';

/**
 * One ordered rule of the `refs` claim. The first rule whose pattern matches a
 * ref applies.
 */
export interface RefPolicy {
	/**
	 * A full ref name (`refs/heads/main`), a branch name (`main`), a prefix that ends with `/*`
	 * (`refs/heads/feature/*`), or `*` for every ref. The gateway rejects a token with another form.
	 */
	pattern: string;
	/** The policy operations. The gateway rejects a token with an op that it does not know. */
	ops?: readonly ('no-push' | 'no-force-push' | 'verify-sig' | (string & {}))[];
}

/** The token that a request needs. */
export interface TokenRequest {
	/** The scopes of the operation. */
	scopes: readonly string[];
	/** The `repo` claim, for a repository-scoped operation. */
	repo?: string | undefined;
	/** The lifetime of the token, in seconds. */
	ttl: number;
	/** The rules of the `refs` claim. Absent when the call has none. */
	ref_policies?: readonly RefPolicy[];
	/** Aborts when the caller stops the call or the attempt times out. Pass it on to `fetch`. */
	signal?: AbortSignal;
}

/** Returns a token for a request, for a client without a private key. */
export type GetToken = (request: TokenRequest) => Promise<string>;

/** The source of the token of each request. */
export interface Credentials {
	/** Whether the token is fixed, so the SDK cannot set its claims. */
	readonly fixed: boolean;
	token(request: TokenRequest): Promise<string>;
}

/** The claims of a token that the SDK signs. */
export interface Claims {
	iss: string;
	sub: string;
	repo?: string | undefined;
	scopes: readonly string[];
	/** The lifetime in seconds: `exp` is `iat` plus this value. */
	ttl: number;
	/** The `refs` claim: ordered `[pattern, ops]` rules. */
	refs?: readonly (readonly [string, readonly string[]])[] | undefined;
}

/** A private key that signs tokens. It loads the key on the first use. */
export interface Signer {
	sign(claims: Claims): Promise<string>;
}

/** A token that the SDK signs for one request lives 5 minutes. */
export const REQUEST_TOKEN_SECONDS = 5 * 60;
/** The longest token lifetime that the SDK signs. */
export const MAX_TOKEN_SECONDS = 60 * 60;
/** The `sub` claim of the tokens that the SDK signs. */
export const SUBJECT = 'pierre-sdk-typescript';

interface SigningKey {
	key: CryptoKey;
	alg: 'ES256' | 'ES384' | 'ES512' | 'RS256';
	/** The lowercase hex SHA-256 of the SPKI DER of the public key. */
	kid: string;
}

const KEY_TYPES = [
	{ alg: 'ES256', importParams: { name: 'ECDSA', namedCurve: 'P-256' }, hash: 'SHA-256' },
	{ alg: 'ES384', importParams: { name: 'ECDSA', namedCurve: 'P-384' }, hash: 'SHA-384' },
	{ alg: 'ES512', importParams: { name: 'ECDSA', namedCurve: 'P-521' }, hash: 'SHA-512' },
	{ alg: 'RS256', importParams: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, hash: 'SHA-256' },
] as const;

/**
 * Checks the shape of ref policies, and returns a frozen copy. The gateway checks the pattern
 * forms and the ops.
 */
export function checkRefPolicies(
	policies: readonly RefPolicy[] | undefined,
	name: string,
): readonly RefPolicy[] | undefined {
	if (policies === undefined) return undefined;
	if (!Array.isArray(policies)) throw new PierreError(`\`${name}\` must be a list of rules.`);
	return Object.freeze(
		policies.map((policy: unknown, index): RefPolicy => {
			const at = `\`${name}[${index}]\``;
			if (typeof policy !== 'object' || policy === null) {
				throw new PierreError(`${at} must be an object with \`pattern\` and \`ops\`.`);
			}
			const { pattern, ops } = policy as { pattern?: unknown; ops?: unknown };
			if (typeof pattern !== 'string' || pattern === '') {
				throw new PierreError(`${at}.pattern must be a non-empty string.`);
			}
			if (ops === undefined) return Object.freeze({ pattern });
			if (!Array.isArray(ops) || ops.some((op) => typeof op !== 'string' || op === '')) {
				throw new PierreError(`${at}.ops must be a list of op names.`);
			}
			return Object.freeze({ pattern, ops: Object.freeze(ops.map(String)) });
		}),
	);
}

/** The `refs` claim of ref policies, or `undefined` for no rule. */
export function refsClaim(policies: readonly RefPolicy[] | undefined): Claims['refs'] {
	if (policies === undefined || policies.length === 0) return undefined;
	return policies.map(({ pattern, ops }) => [pattern, ops ?? []] as const);
}

/** Checks a token lifetime: a whole number of seconds from 1 to 3600. */
export function checkTtl(ttl: number, name: string): number {
	if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TOKEN_SECONDS) {
		throw new PierreError(
			`\`${name}\` must be a whole number of seconds from 1 to ${MAX_TOKEN_SECONDS}.`,
		);
	}
	return ttl;
}

/** A signer for a PKCS #8 PEM private key. `load` runs once, on the first signature. */
export function keySigner(load: () => Promise<string>): Signer {
	let signingKey: Promise<SigningKey> | undefined;
	return {
		async sign(claims) {
			signingKey ??= load().then(importSigningKey);
			let loaded: SigningKey;
			try {
				loaded = await signingKey;
			} catch (error) {
				// The next call tries again, for example after the key file appears.
				signingKey = undefined;
				throw error;
			}
			const { key, alg, kid } = loaded;
			const now = Math.floor(Date.now() / 1000);
			const header = { alg, typ: 'JWT', kid };
			const payload = {
				iss: claims.iss,
				sub: claims.sub,
				...(claims.repo === undefined ? {} : { repo: claims.repo }),
				scopes: [...claims.scopes],
				iat: now,
				exp: now + claims.ttl,
				...(claims.refs === undefined ? {} : { refs: claims.refs }),
			};
			const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
			const type = KEY_TYPES.find((entry) => entry.alg === alg);
			const algorithm =
				type?.importParams.name === 'ECDSA'
					? { name: 'ECDSA', hash: type.hash }
					: { name: 'RSASSA-PKCS1-v1_5' };
			const signature = await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(input));
			return `${input}.${base64Url(new Uint8Array(signature))}`;
		},
	};
}

/** Signs a token for each request with the operation's scopes and repository claim. */
export function signerCredentials(org: string, signer: Signer): Credentials {
	return {
		fixed: false,
		token: (request) =>
			signer.sign({
				iss: org,
				sub: SUBJECT,
				repo: request.repo,
				scopes: request.scopes,
				ttl: request.ttl,
				refs: refsClaim(request.ref_policies),
			}),
	};
}

/** A fixed token. The server checks its scopes. */
export function tokenCredentials(token: string): Credentials {
	return { fixed: true, token: () => Promise.resolve(token) };
}

/** Asks the caller's function for the token of each request. */
export function getTokenCredentials(getToken: GetToken): Credentials {
	return {
		fixed: false,
		async token(request) {
			const refPolicies = request.ref_policies ?? [];
			const token: unknown = await getToken({
				scopes: [...request.scopes],
				...(request.repo === undefined ? {} : { repo: request.repo }),
				ttl: request.ttl,
				...(refPolicies.length === 0 ? {} : { ref_policies: refPolicies }),
				...(request.signal === undefined ? {} : { signal: request.signal }),
			});
			if (typeof token !== 'string' || token === '') {
				throw new PierreError('`getToken` must return a token string.');
			}
			return token;
		},
	};
}

/** The private key and the credentials of a client, for `createToken` and `remoteUrl`. */
export interface ClientKey {
	org: string | undefined;
	/** `undefined` when the client has a fixed token or `getToken`. */
	signer: Signer | undefined;
	credentials: Credentials;
}

// A module-private registry, so the key of a client is not a property of the client.
const clientKeys = new WeakMap<object, ClientKey>();

export function registerClientKey(client: object, key: ClientKey): void {
	clientKeys.set(client, key);
}

export function clientKey(client: object): ClientKey | undefined {
	return clientKeys.get(client);
}

/** Imports a PKCS #8 PEM private key, and finds its algorithm and key ID. */
async function importSigningKey(pem: string): Promise<SigningKey> {
	const der = pemToDer(pem);
	for (const type of KEY_TYPES) {
		let key: CryptoKey;
		try {
			key = await crypto.subtle.importKey('pkcs8', der, type.importParams, true, ['sign']);
		} catch {
			continue;
		}
		return { key, alg: type.alg, kid: await keyId(key, type.importParams) };
	}
	throw new PierreError(
		'The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.',
	);
}

/** The key ID: the lowercase hex SHA-256 of the SPKI DER of the public key. */
async function keyId(
	privateKey: CryptoKey,
	params: (typeof KEY_TYPES)[number]['importParams'],
): Promise<string> {
	// The public part of the key: the private JWK without `d` and the other private members.
	const { kty, crv, x, y, n, e } = await crypto.subtle.exportKey('jwk', privateKey);
	const members = kty === 'EC' ? { kty, crv, x, y } : { kty, n, e };
	const publicJwk: JsonWebKey = Object.fromEntries(
		Object.entries(members).filter(([, value]) => value !== undefined),
	);
	const publicKey = await crypto.subtle.importKey('jwk', publicJwk, params, true, ['verify']);
	const spki = await crypto.subtle.exportKey('spki', publicKey);
	const digest = await crypto.subtle.digest('SHA-256', spki);
	return hex(new Uint8Array(digest));
}

function pemToDer(pem: string): ArrayBuffer {
	const match = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/.exec(pem);
	if (match?.[1] === undefined) {
		throw new PierreError('The private key must be a PEM block of type "PRIVATE KEY" (PKCS #8).');
	}
	const binary = atob(match[1].replaceAll(/\s+/g, ''));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

export function hex(bytes: Uint8Array): string {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function base64(bytes: Uint8Array): string {
	let binary = '';
	const step = 0x8000;
	for (let index = 0; index < bytes.length; index += step) {
		binary += String.fromCharCode(...bytes.subarray(index, index + step));
	}
	return btoa(binary);
}

function base64Url(bytes: Uint8Array): string {
	return base64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlJson(value: unknown): string {
	return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** The `iss` claim of a token, or `undefined`. The SDK does not verify the token. */
export function tokenIssuer(token: string): string | undefined {
	const payload = token.split('.')[1];
	if (payload === undefined) return undefined;
	try {
		const json: unknown = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
		return typeof json === 'object' &&
			json !== null &&
			'iss' in json &&
			typeof json.iss === 'string' &&
			json.iss !== ''
			? json.iss
			: undefined;
	} catch {
		return undefined;
	}
}
