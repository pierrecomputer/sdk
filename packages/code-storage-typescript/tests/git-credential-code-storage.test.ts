import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  getCodeStorageCredential,
  parseCredentialInput,
  runGitCredentialCodeStorage,
} from '../src/credential-helper';

const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgy3DPdzzsP6tOOvmo
rjbx6L7mpFmKKL2hNWNW3urkN8ehRANCAAQ7/DPhGH3kaWl0YEIO+W9WmhyCclDG
yTh6suablSura7ZDG8hpm3oNsq/ykC3Scfsw6ZTuuVuLlXKV/be/Xr0d
-----END PRIVATE KEY-----`;

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
}

describe('git-credential-code-storage', () => {
  it('parses Git credential helper input', () => {
    expect(
      parseCredentialInput(
        'protocol=https\nhost=pierre.code.storage\npath=team/project.git\n\n'
      )
    ).toEqual({
      protocol: 'https',
      host: 'pierre.code.storage',
      path: 'team/project.git',
    });
  });

  it('returns a username and JWT password for Code Storage HTTPS credentials', async () => {
    const credential = await getCodeStorageCredential(
      {
        protocol: 'https',
        host: 'pierre.code.storage',
        path: 'team/project.git',
      },
      {
        PIERRE_PRIVATE_KEY: key,
        PIERRE_TOKEN_TTL: '900',
      }
    );

    expect(credential?.username).toBe('t');
    expect(credential?.password).toBeTruthy();
    const payload = decodeJwtPayload(credential!.password);
    expect(payload.iss).toBe('pierre');
    expect(payload.repo).toBe('team/project');
    expect(payload.scopes).toEqual(['git:write', 'git:read']);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(900);
  });

  it('uses the base repo id for ephemeral and import HTTPS paths', async () => {
    const ephemeral = await getCodeStorageCredential(
      {
        protocol: 'https',
        host: 'pierre.code.storage',
        path: 'project+ephemeral.git',
      },
      { PIERRE_PRIVATE_KEY: key }
    );
    const imported = await getCodeStorageCredential(
      {
        protocol: 'https',
        host: 'pierre.code.storage',
        path: 'project+import.git',
      },
      { PIERRE_PRIVATE_KEY: key }
    );

    expect(decodeJwtPayload(ephemeral!.password).repo).toBe('project');
    expect(decodeJwtPayload(imported!.password).repo).toBe('project');
  });

  it('ignores non-Code Storage credential requests', async () => {
    await expect(
      getCodeStorageCredential({
        protocol: 'https',
        host: 'example.com',
        path: 'repo.git',
      })
    ).resolves.toBeNull();
  });

  it('requires useHttpPath so the repo id is available', async () => {
    await expect(
      getCodeStorageCredential(
        {
          protocol: 'https',
          host: 'pierre.code.storage',
        },
        { PIERRE_PRIVATE_KEY: key }
      )
    ).rejects.toThrow('credential.useHttpPath=true');
  });

  it('strips an explicit port from the host', async () => {
    const credential = await getCodeStorageCredential(
      {
        protocol: 'https',
        host: 'pierre.code.storage:8443',
        path: 'project.git',
      },
      { PIERRE_PRIVATE_KEY: key }
    );

    expect(decodeJwtPayload(credential!.password).iss).toBe('pierre');
  });

  it('reads the private key from PIERRE_PRIVATE_KEY_FILE', async () => {
    const credential = await getCodeStorageCredential(
      {
        protocol: 'https',
        host: 'pierre.code.storage',
        path: 'project.git',
      },
      { PIERRE_PRIVATE_KEY_FILE: '/key.pem' },
      (path) => {
        expect(path).toBe('/key.pem');
        return key;
      }
    );

    expect(credential?.password).toBeTruthy();
  });

  it('fails loudly when no signing key is configured', async () => {
    await expect(
      getCodeStorageCredential(
        {
          protocol: 'https',
          host: 'pierre.code.storage',
          path: 'project.git',
        },
        {}
      )
    ).rejects.toThrow('PIERRE_PRIVATE_KEY_FILE or PIERRE_PRIVATE_KEY');
  });
});

function makeStdin(description: string): NodeJS.ReadStream {
  const stream = new PassThrough();
  stream.end(description);
  return stream as unknown as NodeJS.ReadStream;
}

function captureStream(): { stream: NodeJS.WriteStream; chunks: string[] } {
  const chunks: string[] = [];
  const stream = {
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  } as unknown as NodeJS.WriteStream;
  return { stream, chunks };
}

describe('credential helper debug logging', () => {
  const description =
    'protocol=https\nhost=pierre.code.storage\npath=project.git\n\n';

  it('logs token acquisition to stderr when PIERRE_DEBUG is set', async () => {
    const stdout = captureStream();
    const stderr = captureStream();

    const code = await runGitCredentialCodeStorage(
      ['node', 'git-credential-code-storage', 'get'],
      makeStdin(description),
      stdout.stream,
      { PIERRE_PRIVATE_KEY: key, PIERRE_DEBUG: '1' },
      stderr.stream
    );

    expect(code).toBe(0);
    const logs = stderr.chunks.join('');
    expect(logs).toContain(
      'acquiring git:write+git:read token for repo project (org pierre'
    );
    expect(logs).toContain('token acquired');

    // The minted token goes to stdout for Git; it must never be logged.
    const password = /password=(\S+)/.exec(stdout.chunks.join(''))?.[1];
    expect(password).toBeTruthy();
    expect(logs).not.toContain(password!);
  });

  it('logs skipped non-get operations', async () => {
    const stderr = captureStream();

    const code = await runGitCredentialCodeStorage(
      ['node', 'git-credential-code-storage', 'store'],
      makeStdin(description),
      captureStream().stream,
      { PIERRE_DEBUG: '1' },
      stderr.stream
    );

    expect(code).toBe(0);
    expect(stderr.chunks.join('')).toContain("ignoring 'store' operation");
  });

  it('stays silent when PIERRE_DEBUG is unset, "0", or "false"', async () => {
    for (const env of [{}, { PIERRE_DEBUG: '0' }, { PIERRE_DEBUG: 'false' }]) {
      const stderr = captureStream();

      await runGitCredentialCodeStorage(
        ['node', 'git-credential-code-storage', 'get'],
        makeStdin(description),
        captureStream().stream,
        { PIERRE_PRIVATE_KEY: key, ...env },
        stderr.stream
      );

      expect(stderr.chunks).toEqual([]);
    }
  });
});
