#!/usr/bin/env node
/**
 * Live ref-policy smoke test against a running local git3p stack.
 * Patches JWT signing for RS256 dev keys (same as full-workflow.js).
 */

import { SignJWT, importPKCS8 } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeRefsClaim } from '../src/jwt_claims.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultKeyPath = path.resolve(
  __dirname,
  '../../../git3p-backend/hack/test-scripts/dev-keys/private.pem'
);
const monorepoKeyPath = path.resolve(
  __dirname,
  '../../../../monorepo/git3p-backend/hack/test-scripts/dev-keys/private.pem'
);

const keyPath = process.env.GIT3P_KEY_PATH
  ? path.resolve(process.env.GIT3P_KEY_PATH)
  : existsSync(defaultKeyPath)
    ? defaultKeyPath
    : monorepoKeyPath;

const apiBaseUrl = process.env.GIT3P_API_URL ?? 'http://127.0.0.1:8081';
const storageBaseUrl = (process.env.GIT3P_GIT_URL ?? '127.0.0.1:8080')
  .replace(/^https?:\/\//, '');
const issuer = process.env.GIT3P_ISSUER ?? 'local';
const keyId = process.env.GIT3P_KEY_ID ?? 'dev-key-001';

function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function resolveSigningKey(pem) {
  const keyObject = createPrivateKey({ key: pem, format: 'pem' });
  const alg = keyObject.asymmetricKeyType === 'rsa' ? 'RS256' : 'ES256';
  return { key: await importPKCS8(pem, alg), alg };
}

function patchGitStorage(GitStorage) {
  GitStorage.prototype.generateJWT = async function patchedGenerateJWT(
    repoId,
    options
  ) {
    const permissions = options?.permissions ?? ['git:write', 'git:read'];
    const ttl = options?.ttl ?? 365 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.options.name,
      sub: '@pierre/storage',
      repo: repoId,
      scopes: permissions,
      iat: now,
      exp: now + ttl,
      ...(options?.refs?.length ? { refs: encodeRefsClaim(options.refs) } : {}),
      ...(options?.ops?.length ? { ops: options.ops } : {}),
    };
    const { key, alg } = await resolveSigningKey(this.options.key);
    const header = { alg, typ: 'JWT', kid: keyId };
    return new SignJWT(payload).setProtectedHeader(header).sign(key);
  };
}

function git(args, { cwd }) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      HOME: cwd,
    },
  });
}

function gitAllowFail(args, { cwd }) {
  try {
    const stdout = git(args, { cwd });
    return { code: 0, output: stdout };
  } catch (err) {
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

function tokenFromRemoteUrl(url) {
  const afterScheme = url.split('://', 2)[1];
  const at = afterScheme.lastIndexOf('@');
  const userinfo = afterScheme.slice(0, at);
  return userinfo.slice(userinfo.indexOf(':') + 1);
}

function buildGitRemote(repoId, token) {
  const host = storageBaseUrl;
  const base =
    host.includes('://')
      ? host.replace(/\/$/, '')
      : host.startsWith('127.0.0.1') || host.startsWith('localhost')
        ? `http://${host}`
        : `https://${host}`;
  return `${base}/${repoId}.git`.replace('://', `://t:${token}@`);
}

async function loadGitStorage() {
  const candidates = [
    path.resolve(__dirname, '../dist/index.js'),
    path.resolve(__dirname, '../dist/index.mjs'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const mod = await import(pathToFileURL(candidate).href);
      return mod.GitStorage ?? mod.default;
    }
  }
  const mod = await import('../src/index.ts');
  return mod.GitStorage;
}

async function main() {
  if (!existsSync(keyPath)) {
    console.error(`FAIL: signing key not found at ${keyPath}`);
    process.exit(1);
  }

  const key = readFileSync(keyPath, 'utf8');
  const repoId = `sdk-refpol-ts-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const GitStorage = await loadGitStorage();
  patchGitStorage(GitStorage);

  const store = new GitStorage({
    name: issuer,
    key,
    apiBaseUrl,
    storageBaseUrl,
  });

  console.log(`▶ TypeScript ref-policy live test (repo=${repoId})`);

  const repo = await store.createRepo({ id: repoId, defaultBranch: 'main' });
  console.log('  ✓ repo created');

  const openUrl = await repo.getRemoteURL({
    permissions: ['git:read', 'git:write'],
    ttl: 1800,
  });
  const restrictedUrl = await repo.getRemoteURL({
    permissions: ['git:read', 'git:write'],
    ttl: 600,
    refs: [{ pattern: 'refs/heads/main', ops: ['no-push'] }],
  });

  const openToken = tokenFromRemoteUrl(openUrl);
  const restrictedToken = tokenFromRemoteUrl(restrictedUrl);
  const refsClaim = decodeJwtPayload(restrictedToken).refs;
  const expected = [['refs/heads/main', ['no-push']]];
  if (JSON.stringify(refsClaim) !== JSON.stringify(expected)) {
    console.error(`FAIL: unexpected refs claim: ${JSON.stringify(refsClaim)}`);
    process.exit(1);
  }
  console.log(`  ✓ JWT refs claim: ${JSON.stringify(refsClaim)}`);

  const work = mkdtempSync(path.join(os.tmpdir(), 'refpol-ts-'));
  git(['init', '-b', 'main'], { cwd: work });
  git(['config', 'user.email', 'refpol@pierre.invalid'], { cwd: work });
  git(['config', 'user.name', 'RefPol Live'], { cwd: work });
  git(['config', 'commit.gpgsign', 'false'], { cwd: work });
  writeFileSync(path.join(work, 'README.md'), 'hello\n');
  git(['add', 'README.md'], { cwd: work });
  git(['commit', '-m', 'initial'], { cwd: work });

  git(['remote', 'add', 'origin', buildGitRemote(repo.id, openToken)], { cwd: work });
  git(['push', '-u', 'origin', 'main'], { cwd: work });
  console.log('  ✓ seeded main via open token');

  git(['checkout', '-b', 'feature/allowed'], { cwd: work });
  writeFileSync(path.join(work, 'README.md'), 'hello\nfeature\n');
  git(['add', 'README.md'], { cwd: work });
  git(['commit', '-m', 'feature commit'], { cwd: work });

  git(['remote', 'set-url', 'origin', buildGitRemote(repo.id, restrictedToken)], {
    cwd: work,
  });
  git(['push', '-u', 'origin', 'feature/allowed'], { cwd: work });
  console.log('  ✓ feature branch push allowed');

  git(['checkout', 'main'], { cwd: work });
  writeFileSync(path.join(work, 'README.md'), 'hello\nblocked\n');
  git(['add', 'README.md'], { cwd: work });
  git(['commit', '-m', 'main blocked attempt'], { cwd: work });
  const mainPush = gitAllowFail(['push', 'origin', 'main'], { cwd: work });
  if (mainPush.code === 0) {
    console.error('FAIL: push to main should be denied by no-push policy');
    process.exit(1);
  }
  if (!mainPush.output.includes('denied by policy')) {
    console.error(
      `FAIL: expected 'denied by policy' in push output:\n${mainPush.output}`
    );
    process.exit(1);
  }
  console.log('  ✓ main push denied by policy');

  try {
    await store.deleteRepo({ id: repoId });
    console.log('  ✓ repo deleted');
  } catch (err) {
    console.log(`  (cleanup warning: ${err.message})`);
  }

  console.log('✅ TypeScript ref-policy live test passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
