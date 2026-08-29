import { exportPKCS8, generateKeyPair } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, GitStorage } from '../src/index';

let key: string;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function decodeToken(value: string): Record<string, unknown> {
  const token = value.replace(/^Bearer\s+/i, '');
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

function repo() {
  const store = new GitStorage({
    name: 'test',
    key,
    apiBaseUrl: 'https://api.test.code.storage',
    storageBaseUrl: 'test.code.storage',
  });
  return store.repo({ id: 'owner/repo' });
}

describe('named ref lookup', () => {
  beforeAll(async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    key = await exportPKCS8(privateKey);
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('gets one branch on the preferred route with git:read scope', async () => {
    const testRepo = repo();
    const listBranches = vi.spyOn(testRepo, 'listBranches');

    mockFetch.mockImplementationOnce((input, init) => {
      const url = new URL(input as string);
      expect(url.pathname).toBe('/api/repos/owner%2Frepo/branch');
      expect(url.search).toBe('?name=attempt%2F7&ephemeral=true');
      expect(decodeToken((init?.headers as Record<string, string>).Authorization).scopes).toEqual([
        'git:read',
      ]);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            branch: {
              name: 'attempt/7',
              head_sha: 'abc123',
              created_at: '2026-08-29T10:00:00Z',
              cursor: 'private-cursor',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    await expect(
      testRepo.getBranch({ name: 'attempt/7', ephemeral: true })
    ).resolves.toEqual({
      name: 'attempt/7',
      headSha: 'abc123',
      createdAt: '2026-08-29T10:00:00Z',
    });
    expect(listBranches).not.toHaveBeenCalled();
  });

  it.each([
    { ephemeral: false, search: '?name=feature%2Ffalse&ephemeral=false' },
    { ephemeral: undefined, search: '?name=feature%2Fomitted' },
  ])('preserves the branch ephemeral value', async ({ ephemeral, search }) => {
    const testRepo = repo();
    mockFetch.mockImplementationOnce((input) => {
      expect(new URL(input as string).search).toBe(search);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            branch: {
              name: ephemeral === false ? 'feature/false' : 'feature/omitted',
              head_sha: 'abc123',
              created_at: '2026-08-29T10:00:00Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    await testRepo.getBranch({
      name: ephemeral === false ? 'feature/false' : 'feature/omitted',
      ephemeral,
    });
  });

  it('gets one tag without private list fields', async () => {
    const testRepo = repo();
    const listTags = vi.spyOn(testRepo, 'listTags');

    mockFetch.mockImplementationOnce((input, init) => {
      const url = new URL(input as string);
      expect(url.pathname).toBe('/api/repos/owner%2Frepo/tag');
      expect(url.search).toBe('?name=releases%2Fv1.4.0');
      expect(decodeToken((init?.headers as Record<string, string>).Authorization).scopes).toEqual([
        'git:read',
      ]);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            tag: {
              name: 'releases/v1.4.0',
              sha: 'commit123',
              object_sha: 'tag-object-123',
              cursor: 'private-cursor',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    await expect(testRepo.getTag({ name: 'releases/v1.4.0' })).resolves.toEqual({
      name: 'releases/v1.4.0',
      sha: 'commit123',
    });
    expect(listTags).not.toHaveBeenCalled();
  });

  it.each(['getBranch', 'getTag'] as const)(
    'uses the normal not-found error for %s',
    async (method) => {
      const testRepo = repo();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'ref not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
        })
      );

      const promise = testRepo[method]({ name: 'missing/ref' });
      await expect(promise).rejects.toMatchObject<ApiError>({
        name: 'ApiError',
        status: 404,
        message: 'ref not found',
      });
    }
  );
});
