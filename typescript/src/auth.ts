// `@pierre/sdk/auth`: signs a token locally, with no HTTP call, and
// lists the scopes of the API. It loads no client code: it reads the key of a client from the
// registry in `credentials.ts`.

import type { PierreCore } from './runtime/client.ts';
import {
	checkRefPolicies,
	checkTtl,
	clientKey,
	keySigner,
	refsClaim,
	SUBJECT,
	type RefPolicy,
	type Signer,
} from './runtime/credentials.ts';
import { PierreError } from './runtime/errors.ts';

export { SCOPES, type Scope } from './generated/scopes.ts';
export type { RefPolicy } from './runtime/credentials.ts';

export interface TokenParams {
	/** The scopes of the token, for example `['git:read']`. `SCOPES` lists the scopes of the API. */
	scopes: readonly string[];
	/** The `repo` claim. Leave it out for a token whose scopes are all organization-wide. */
	repo?: string;
	/** The lifetime in seconds, from 1 to 3600. Default: 900 (15 minutes). */
	ttl?: number;
	/**
	 * The rules of the `refs` claim. Default: the `refPolicies` of a client, and none for
	 * `{ org, privateKey }`. An empty list adds no claim.
	 */
	ref_policies?: readonly RefPolicy[];
	/** The `sub` claim. Default: `pierre-sdk-typescript`. */
	subject?: string;
}

/** A private key and its organization, for code with no client. */
export interface KeyCredentials {
	org: string;
	/** A PKCS #8 PEM private key. */
	privateKey: string;
}

/** A token from `createToken` lives 15 minutes by default. */
const DEFAULT_TTL_SECONDS = 15 * 60;

/**
 * Signs a token with a private key: the key of a client, or `{ org, privateKey }`. A token in a
 * URL or a config file is a bearer credential, so keep the lifetime short. The SDK rejects a
 * lifetime over 1 hour.
 *
 * Docs: search for `createToken` in the docs MCP server, https://code.storage/docs/mcp.
 */
export async function createToken(
	credentials: PierreCore | KeyCredentials,
	params: TokenParams,
): Promise<string> {
	const { org, signer } = signingKeyOf(credentials);
	if (params.scopes.length === 0) throw new PierreError('`scopes` must name at least one scope.');
	return signer.sign({
		iss: org,
		sub: params.subject ?? SUBJECT,
		repo: params.repo,
		scopes: params.scopes,
		ttl: checkTtl(params.ttl ?? DEFAULT_TTL_SECONDS, 'ttl'),
		refs: refsClaim(
			checkRefPolicies(params.ref_policies, 'ref_policies') ??
				('options' in credentials ? credentials.options.refPolicies : undefined),
		),
	});
}

function signingKeyOf(credentials: PierreCore | KeyCredentials): { org: string; signer: Signer } {
	const registered = clientKey(credentials);
	if (registered !== undefined) {
		if (registered.signer === undefined || registered.org === undefined) {
			throw new PierreError(
				'`createToken` needs a client with a private key. A client with `token` or `getToken` cannot sign.',
			);
		}
		return { org: registered.org, signer: registered.signer };
	}
	if (
		'privateKey' in credentials &&
		typeof credentials.privateKey === 'string' &&
		typeof credentials.org === 'string' &&
		credentials.org !== ''
	) {
		const { privateKey } = credentials;
		return { org: credentials.org, signer: keySigner(() => Promise.resolve(privateKey)) };
	}
	throw new PierreError('Give a client, or `{ org, privateKey }`.');
}
