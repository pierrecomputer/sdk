import { readFileSync } from 'node:fs';

import { GitStorage } from './index';

/**
 * Default TTL for credentials minted by the helper. Git requests a fresh
 * credential for every operation, so the token only needs to outlive a single
 * fetch or push. Override with PIERRE_TOKEN_TTL (seconds).
 */
const DEFAULT_CREDENTIAL_TTL_SECONDS = 60 * 60;

interface GitCredentialInput {
  protocol?: string;
  host?: string;
  path?: string;
}

type CredentialLog = (message: string) => void;

const noLog: CredentialLog = () => {};

/**
 * Builds a logger that writes diagnostic lines to stderr when PIERRE_DEBUG is
 * set (to anything except '0' or 'false'). stdout carries the credential
 * protocol Git reads, so logs must never be written there. Minted tokens are
 * never logged.
 */
function createCredentialLogger(
  env: NodeJS.ProcessEnv,
  stderr: NodeJS.WriteStream
): CredentialLog {
  const flag = env.PIERRE_DEBUG?.trim().toLowerCase();
  if (!flag || flag === '0' || flag === 'false') {
    return noLog;
  }
  return (message) => {
    stderr.write(`git-credential-code-storage: ${message}\n`);
  };
}

/**
 * Resolves a Git credential for a Code Storage HTTPS remote.
 *
 * Returns null when the request is not for a `*.code.storage` host so Git
 * falls through to the next configured helper. Throws when the request is for
 * Code Storage but cannot be served (missing path or signing key), since
 * silently declining would make Git prompt for a password that does not exist.
 */
export async function getCodeStorageCredential(
  input: GitCredentialInput,
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
  log: CredentialLog = noLog
): Promise<{ username: string; password: string } | null> {
  if (input.protocol !== 'https' || !input.host) {
    log('declining request: not an HTTPS remote with a host');
    return null;
  }

  const name = parseOrganization(input.host);
  if (!name) {
    log(`declining request for ${input.host}: not a *.code.storage host`);
    return null;
  }
  if (!input.path) {
    throw new Error(
      'Code Storage credential helper requires credential.useHttpPath=true'
    );
  }

  const repoId = parseRepoId(input.path);
  if (!repoId) {
    throw new Error(`Could not determine a repository id from path: ${input.path}`);
  }
  log(
    env.PIERRE_PRIVATE_KEY
      ? 'signing with private key from PIERRE_PRIVATE_KEY'
      : `signing with private key from ${env.PIERRE_PRIVATE_KEY_FILE ?? '(unset)'}`
  );

  const keyFile = env.PIERRE_PRIVATE_KEY_FILE;
  const key =
    env.PIERRE_PRIVATE_KEY ??
    (keyFile && keyFile.trim() !== '' ? readFile(keyFile) : undefined);
  if (!key || key.trim() === '') {
    throw new Error(
      'Set PIERRE_PRIVATE_KEY_FILE or PIERRE_PRIVATE_KEY before using the Code Storage credential helper'
    );
  }

  const ttl = parsePositiveInteger(env.PIERRE_TOKEN_TTL, DEFAULT_CREDENTIAL_TTL_SECONDS);
  log(`acquiring git:write+git:read token for repo ${repoId} (org ${name}, ttl ${ttl}s)`);
  const storage = new GitStorage({ name, key });
  const remoteURL = await storage.repo({ id: repoId }).getRemoteURL({
    permissions: ['git:write', 'git:read'],
    ttl,
  });
  const url = new URL(remoteURL);
  log(`token acquired for ${url.host}${url.pathname}`);
  return {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export async function runGitCredentialCodeStorage(
  argv: string[],
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
  stderr: NodeJS.WriteStream = process.stderr
): Promise<number> {
  const log = createCredentialLogger(env, stderr);
  // Git writes the credential description for every operation, so drain stdin
  // before deciding anything to avoid EPIPE on the Git side.
  const description = await readStdin(stdin);

  // 'store' and 'erase' are no-ops: credentials are minted on demand and
  // never persisted.
  if (argv[2] !== 'get') {
    log(`ignoring '${argv[2] ?? ''}' operation: only 'get' mints credentials`);
    return 0;
  }

  const credential = await getCodeStorageCredential(
    parseCredentialInput(description),
    env,
    undefined,
    log
  );
  if (!credential) {
    return 0;
  }

  stdout.write(`username=${credential.username}\npassword=${credential.password}\n\n`);
  return 0;
}

/** Parses the `key=value` credential description Git writes to stdin. */
export function parseCredentialInput(input: string): GitCredentialInput {
  const credential: GitCredentialInput = {};
  for (const line of input.split(/\r?\n/)) {
    if (line === '') {
      break;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (key === 'protocol' || key === 'host' || key === 'path') {
      credential[key] = value;
    }
  }
  return credential;
}

/**
 * Extracts the organization from a `<org>.code.storage` host, tolerating an
 * explicit port. Returns null for any other host.
 */
function parseOrganization(host: string): string | null {
  const match = /^(.+)\.code\.storage(?::\d+)?$/i.exec(host);
  return match ? match[1] : null;
}

/**
 * Derives the repository id from the URL path of an authenticated Code
 * Storage HTTPS remote. Ephemeral (`+ephemeral`) and import (`+import`)
 * remotes use the base repository's credentials, so their suffixes are
 * stripped.
 */
function parseRepoId(path: string): string {
  let repoPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (repoPath.endsWith('.git')) {
    repoPath = repoPath.slice(0, -'.git'.length);
  }
  repoPath = repoPath.replace(/\+(ephemeral|import)$/, '');
  return repoPath
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readStdin(stdin: NodeJS.ReadStream): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  let input = '';
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => {
    input += chunk;
  });
  stdin.on('end', () => {
    resolve(input);
  });
  stdin.on('error', reject);
  return promise;
}
