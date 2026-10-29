// Credentials and token signing. Web Crypto only, so the
// code runs in Node, in a browser, and in an edge runtime. This module loads no client code,
// because `@pierre/sdk/auth` imports it.
import { PierreError } from './errors.js';
/** A token that the SDK signs for one request lives 5 minutes. */
export const REQUEST_TOKEN_SECONDS = 5 * 60;
/** The longest token lifetime that the SDK signs. */
export const MAX_TOKEN_SECONDS = 60 * 60;
/** The `sub` claim of the tokens that the SDK signs. */
export const SUBJECT = 'pierre-sdk-typescript';
const KEY_TYPES = [
    { alg: 'ES256', importParams: { name: 'ECDSA', namedCurve: 'P-256' }, hash: 'SHA-256' },
    { alg: 'ES384', importParams: { name: 'ECDSA', namedCurve: 'P-384' }, hash: 'SHA-384' },
    { alg: 'ES512', importParams: { name: 'ECDSA', namedCurve: 'P-521' }, hash: 'SHA-512' },
    { alg: 'RS256', importParams: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, hash: 'SHA-256' },
];
/**
 * Checks the shape of ref policies, and returns a frozen copy. The gateway checks the pattern
 * forms and the ops.
 */
export function checkRefPolicies(policies, name) {
    if (policies === undefined)
        return undefined;
    if (!Array.isArray(policies))
        throw new PierreError(`\`${name}\` must be a list of rules.`);
    return Object.freeze(policies.map((policy, index) => {
        const at = `\`${name}[${index}]\``;
        if (typeof policy !== 'object' || policy === null) {
            throw new PierreError(`${at} must be an object with \`pattern\` and \`ops\`.`);
        }
        const { pattern, ops } = policy;
        if (typeof pattern !== 'string' || pattern === '') {
            throw new PierreError(`${at}.pattern must be a non-empty string.`);
        }
        if (ops === undefined)
            return Object.freeze({ pattern });
        if (!Array.isArray(ops) || ops.some((op) => typeof op !== 'string' || op === '')) {
            throw new PierreError(`${at}.ops must be a list of op names.`);
        }
        return Object.freeze({ pattern, ops: Object.freeze(ops.map(String)) });
    }));
}
/** The `refs` claim of ref policies, or `undefined` for no rule. */
export function refsClaim(policies) {
    if (policies === undefined || policies.length === 0)
        return undefined;
    return policies.map(({ pattern, ops }) => [pattern, ops ?? []]);
}
/** Checks a token lifetime: a whole number of seconds from 1 to 3600. */
export function checkTtl(ttl, name) {
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TOKEN_SECONDS) {
        throw new PierreError(`\`${name}\` must be a whole number of seconds from 1 to ${MAX_TOKEN_SECONDS}.`);
    }
    return ttl;
}
/** A signer for a PKCS #8 PEM private key. `load` runs once, on the first signature. */
export function keySigner(load) {
    let signingKey;
    return {
        async sign(claims) {
            signingKey ??= load().then(importSigningKey);
            let loaded;
            try {
                loaded = await signingKey;
            }
            catch (error) {
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
            const algorithm = type?.importParams.name === 'ECDSA'
                ? { name: 'ECDSA', hash: type.hash }
                : { name: 'RSASSA-PKCS1-v1_5' };
            const signature = await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(input));
            return `${input}.${base64Url(new Uint8Array(signature))}`;
        },
    };
}
/** Signs a token for each request with the operation's scopes and repository claim. */
export function signerCredentials(org, signer) {
    return {
        fixed: false,
        token: (request) => signer.sign({
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
export function tokenCredentials(token) {
    return { fixed: true, token: () => Promise.resolve(token) };
}
/** Asks the caller's function for the token of each request. */
export function getTokenCredentials(getToken) {
    return {
        fixed: false,
        async token(request) {
            const refPolicies = request.ref_policies ?? [];
            const token = await getToken({
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
// A module-private registry, so the key of a client is not a property of the client.
const clientKeys = new WeakMap();
export function registerClientKey(client, key) {
    clientKeys.set(client, key);
}
export function clientKey(client) {
    return clientKeys.get(client);
}
/** Imports a PKCS #8 PEM private key, and finds its algorithm and key ID. */
async function importSigningKey(pem) {
    const der = pemToDer(pem);
    for (const type of KEY_TYPES) {
        let key;
        try {
            key = await crypto.subtle.importKey('pkcs8', der, type.importParams, true, ['sign']);
        }
        catch {
            continue;
        }
        return { key, alg: type.alg, kid: await keyId(key, type.importParams) };
    }
    throw new PierreError('The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.');
}
/** The key ID: the lowercase hex SHA-256 of the SPKI DER of the public key. */
async function keyId(privateKey, params) {
    // The public part of the key: the private JWK without `d` and the other private members.
    const { kty, crv, x, y, n, e } = await crypto.subtle.exportKey('jwk', privateKey);
    const members = kty === 'EC' ? { kty, crv, x, y } : { kty, n, e };
    const publicJwk = Object.fromEntries(Object.entries(members).filter(([, value]) => value !== undefined));
    const publicKey = await crypto.subtle.importKey('jwk', publicJwk, params, true, ['verify']);
    const spki = await crypto.subtle.exportKey('spki', publicKey);
    const digest = await crypto.subtle.digest('SHA-256', spki);
    return hex(new Uint8Array(digest));
}
function pemToDer(pem) {
    const match = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/.exec(pem);
    if (match?.[1] === undefined) {
        throw new PierreError('The private key must be a PEM block of type "PRIVATE KEY" (PKCS #8).');
    }
    const binary = atob(match[1].replaceAll(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
}
export function hex(bytes) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function base64(bytes) {
    let binary = '';
    const step = 0x8000;
    for (let index = 0; index < bytes.length; index += step) {
        binary += String.fromCharCode(...bytes.subarray(index, index + step));
    }
    return btoa(binary);
}
function base64Url(bytes) {
    return base64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function base64UrlJson(value) {
    return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}
/** The `iss` claim of a token, or `undefined`. The SDK does not verify the token. */
export function tokenIssuer(token) {
    const payload = token.split('.')[1];
    if (payload === undefined)
        return undefined;
    try {
        const json = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
        return typeof json === 'object' &&
            json !== null &&
            'iss' in json &&
            typeof json.iss === 'string' &&
            json.iss !== ''
            ? json.iss
            : undefined;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=credentials.js.map