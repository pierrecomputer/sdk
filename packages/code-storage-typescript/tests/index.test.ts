import { importPKCS8, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodeStorage, GitStorage, createClient } from '../src/index';

// Mock fetch globally if it is not already stubbed
const existingFetch = globalThis.fetch as unknown;
const mockFetch =
  existingFetch &&
  typeof existingFetch === 'function' &&
  'mock' in (existingFetch as any)
    ? (existingFetch as ReturnType<typeof vi.fn>)
    : vi.fn();

if (
  !(
    existingFetch &&
    typeof existingFetch === 'function' &&
    'mock' in (existingFetch as any)
  )
) {
  vi.stubGlobal('fetch', mockFetch);
}

const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgy3DPdzzsP6tOOvmo
rjbx6L7mpFmKKL2hNWNW3urkN8ehRANCAAQ7/DPhGH3kaWl0YEIO+W9WmhyCclDG
yTh6suablSura7ZDG8hpm3oNsq/ykC3Scfsw6ZTuuVuLlXKV/be/Xr0d
-----END PRIVATE KEY-----`;

const decodeJwtPayload = (jwt: string) => {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
};

const stripBearer = (value: string): string => value.replace(/^Bearer\s+/i, '');

describe('GitStorage', () => {
  beforeEach(() => {
    // Reset mock before each test
    mockFetch.mockReset();
    // Default successful response for createRepo
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        repo_id: 'test-repo-id',
        url: 'https://test.code.storage/repo.git',
      }),
    });
  });
  describe('constructor', () => {
    it('should create an instance with required options', () => {
      const store = new GitStorage({ name: 'v0', key });
      expect(store).toBeInstanceOf(GitStorage);
    });

    it('should store the provided key', () => {
      const store = new GitStorage({ name: 'v0', key });
      const config = store.getConfig();
      expect(config.key).toBe(key);
    });

    it('should throw error when key is missing', () => {
      expect(() => {
        // @ts-expect-error - Testing missing key
        new GitStorage({});
      }).toThrow(
        'GitStorage requires a name and key. Please check your configuration and try again.'
      );
    });

    it('should throw error when name or key is null or undefined', () => {
      expect(() => {
        // @ts-expect-error - Testing null key
        new GitStorage({ name: 'v0', key: null });
      }).toThrow(
        'GitStorage requires a name and key. Please check your configuration and try again.'
      );

      expect(() => {
        // @ts-expect-error - Testing undefined key
        new GitStorage({ name: 'v0', key: undefined });
      }).toThrow(
        'GitStorage requires a name and key. Please check your configuration and try again.'
      );

      expect(() => {
        // @ts-expect-error - Testing null name
        new GitStorage({ name: null, key: 'test-key' });
      }).toThrow(
        'GitStorage requires a name and key. Please check your configuration and try again.'
      );

      expect(() => {
        // @ts-expect-error - Testing undefined name
        new GitStorage({ name: undefined, key: 'test-key' });
      }).toThrow(
        'GitStorage requires a name and key. Please check your configuration and try again.'
      );
    });

    it('should throw error when key is empty string', () => {
      expect(() => {
        new GitStorage({ name: 'v0', key: '' });
      }).toThrow('GitStorage key must be a non-empty string.');
    });

    it('should throw error when name is empty string', () => {
      expect(() => {
        new GitStorage({ name: '', key: 'test-key' });
      }).toThrow('GitStorage name must be a non-empty string.');
    });

    it('should throw error when key is only whitespace', () => {
      expect(() => {
        new GitStorage({ name: 'v0', key: '   ' });
      }).toThrow('GitStorage key must be a non-empty string.');
    });

    it('should throw error when name is only whitespace', () => {
      expect(() => {
        new GitStorage({ name: '   ', key: 'test-key' });
      }).toThrow('GitStorage name must be a non-empty string.');
    });

    it('should throw error when key is not a string', () => {
      expect(() => {
        // @ts-expect-error - Testing non-string key
        new GitStorage({ name: 'v0', key: 123 });
      }).toThrow('GitStorage key must be a non-empty string.');

      expect(() => {
        // @ts-expect-error - Testing non-string key
        new GitStorage({ name: 'v0', key: {} });
      }).toThrow('GitStorage key must be a non-empty string.');
    });

    it('should throw error when name is not a string', () => {
      expect(() => {
        // @ts-expect-error - Testing non-string name
        new GitStorage({ name: 123, key: 'test-key' });
      }).toThrow('GitStorage name must be a non-empty string.');

      expect(() => {
        // @ts-expect-error - Testing non-string name
        new GitStorage({ name: {}, key: 'test-key' });
      }).toThrow('GitStorage name must be a non-empty string.');
    });
  });

  it('parses commit dates into Date instances', async () => {
    const store = new GitStorage({ name: 'v0', key });

    const repo = await store.createRepo({ id: 'repo-dates' });

    const rawCommits = {
      commits: [
        {
          sha: 'abc123',
          message: 'feat: add endpoint',
          author_name: 'Jane Doe',
          author_email: 'jane@example.com',
          committer_name: 'Jane Doe',
          committer_email: 'jane@example.com',
          date: '2024-01-15T14:32:18Z',
        },
      ],
      next_cursor: undefined,
      has_more: false,
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => rawCommits,
      })
    );

    const commits = await repo.listCommits();
    expect(commits.commits[0].rawDate).toBe('2024-01-15T14:32:18Z');
    expect(commits.commits[0].date).toBeInstanceOf(Date);
    expect(commits.commits[0].date.toISOString()).toBe(
      '2024-01-15T14:32:18.000Z'
    );
  });

  it('fetches git notes with getNote', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-notes-read' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/notes')).toBe(true);
      expect(requestUrl.searchParams.get('sha')).toBe('abc123');
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          sha: 'abc123',
          note: 'hello notes',
          ref_sha: 'def456',
        }),
      } as any);
    });

    const result = await repo.getNote({ sha: 'abc123' });
    expect(result).toEqual({
      sha: 'abc123',
      note: 'hello notes',
      refSha: 'def456',
    });
  });

  it('fetches a single commit with getCommit', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-get-commit' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/commit')).toBe(true);
      expect(requestUrl.searchParams.get('sha')).toBe('abc123');

      const headers = (init?.headers ?? {}) as Record<string, string>;
      const payload = decodeJwtPayload(stripBearer(headers.Authorization));
      expect(payload.scopes).toEqual(['git:read']);
      expect(payload.repo).toBe('repo-get-commit');

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          commit: {
            sha: 'abc123',
            message: 'feat: add endpoint',
            author_name: 'Jane Doe',
            author_email: 'jane@example.com',
            committer_name: 'Jane Doe',
            committer_email: 'jane@example.com',
            date: '2024-01-15T14:32:18Z',
          },
        }),
      } as any);
    });

    const result = await repo.getCommit({ sha: 'abc123' });
    expect(result.commit.sha).toBe('abc123');
    expect(result.commit.message).toBe('feat: add endpoint');
    expect(result.commit.authorName).toBe('Jane Doe');
    expect(result.commit.authorEmail).toBe('jane@example.com');
    expect(result.commit.committerName).toBe('Jane Doe');
    expect(result.commit.committerEmail).toBe('jane@example.com');
    expect(result.commit.rawDate).toBe('2024-01-15T14:32:18Z');
    expect(result.commit.date).toBeInstanceOf(Date);
    expect(result.commit.date.toISOString()).toBe('2024-01-15T14:32:18.000Z');
  });

  it('trims sha and honors ttl override on getCommit', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-get-commit-ttl' });

    mockFetch.mockImplementationOnce((url, init) => {
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/commit')).toBe(true);
      expect(requestUrl.searchParams.get('sha')).toBe('abc123');

      const headers = (init?.headers ?? {}) as Record<string, string>;
      const payload = decodeJwtPayload(stripBearer(headers.Authorization));
      expect(payload.scopes).toEqual(['git:read']);
      expect(payload.exp - payload.iat).toBe(600);

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          commit: {
            sha: 'abc123',
            message: 'msg',
            author_name: 'A',
            author_email: 'a@example.com',
            committer_name: 'A',
            committer_email: 'a@example.com',
            date: '2024-01-15T14:32:18Z',
          },
        }),
      } as any);
    });

    const result = await repo.getCommit({ sha: '  abc123  ', ttl: 600 });
    expect(result.commit.sha).toBe('abc123');
  });

  it('rejects getCommit when sha is missing or blank', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-get-commit-validation' });

    await expect(
      // @ts-expect-error - exercising runtime validation when sha is omitted
      repo.getCommit({})
    ).rejects.toThrow('getCommit sha is required');

    await expect(repo.getCommit({ sha: '' })).rejects.toThrow(
      'getCommit sha is required'
    );

    await expect(repo.getCommit({ sha: '   ' })).rejects.toThrow(
      'getCommit sha is required'
    );
  });

  it('blames a file with full options', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-blame' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/blame')).toBe(true);
      expect(requestUrl.searchParams.get('path')).toBe('src/x.go');
      expect(requestUrl.searchParams.get('ref')).toBe('main');
      expect(requestUrl.searchParams.getAll('range')).toEqual(['10,20', '/getUser/,+30']);
      expect(requestUrl.searchParams.get('detect_moves')).toBe('true');

      const headers = (init?.headers ?? {}) as Record<string, string>;
      const payload = decodeJwtPayload(stripBearer(headers.Authorization));
      expect(payload.scopes).toEqual(['git:read']);
      expect(payload.repo).toBe('repo-blame');

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ref: 'main',
          path: 'src/x.go',
          commit_sha: 'aaa111',
          lines: [
            {
              line_number: 10,
              commit_sha: 'bbb222',
              original_line_number: 5,
              original_path: 'src/x.go',
              previous_commit_sha: 'zzz000',
              author_name: 'Alice',
              author_email: 'alice@example.com',
              author_time: '2024-01-15T14:32:18Z',
              committer_name: 'Alice',
              committer_email: 'alice@example.com',
              committer_time: '2024-01-15T14:32:18Z',
              summary: 'init',
            },
            {
              line_number: 11,
              commit_sha: 'ccc333',
              original_line_number: 11,
              original_path: 'src/old.go',
              author_name: 'Bob',
              author_email: 'bob@example.com',
              author_time: '2024-02-20T09:00:00Z',
              committer_name: 'Bob',
              committer_email: 'bob@example.com',
              committer_time: '2024-02-20T09:00:00Z',
              summary: 'fix',
            },
          ],
        }),
      } as any);
    });

    const result = await repo.getBlame({
      path: 'src/x.go',
      ref: 'main',
      ranges: ['10,20', '/getUser/,+30'],
      detectMoves: true,
    });

    expect(result.ref).toBe('main');
    expect(result.path).toBe('src/x.go');
    expect(result.commitSha).toBe('aaa111');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].commitSha).toBe('bbb222');
    expect(result.lines[0].authorName).toBe('Alice');
    expect(result.lines[0].previousCommitSha).toBe('zzz000');
    expect(result.lines[0].rawAuthorTime).toBe('2024-01-15T14:32:18Z');
    expect(result.lines[0].authorTime).toBeInstanceOf(Date);
    expect(result.lines[0].authorTime.toISOString()).toBe('2024-01-15T14:32:18.000Z');
    expect(result.lines[1].originalPath).toBe('src/old.go');
    expect(result.lines[1].previousCommitSha).toBeUndefined();
    expect(result.lines[1].authorName).toBe('Bob');
  });

  it('omits optional blame params when not provided', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-blame-defaults' });

    mockFetch.mockImplementationOnce((url) => {
      const requestUrl = new URL(url as string);
      expect(requestUrl.searchParams.get('path')).toBe('src/x.go');
      for (const key of [
        'ref',
        'ephemeral',
        'range',
        'detect_moves',
      ]) {
        expect(requestUrl.searchParams.has(key)).toBe(false);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ref: 'main',
          path: 'src/x.go',
          commit_sha: 'sha',
          lines: [],
        }),
      } as any);
    });

    const result = await repo.getBlame({ path: 'src/x.go' });
    expect(result.commitSha).toBe('sha');
    expect(result.lines).toEqual([]);
  });

  it('rejects blame when path is missing or blank', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-blame-validation' });

    await expect(
      // @ts-expect-error - exercising runtime validation when path is omitted
      repo.getBlame({})
    ).rejects.toThrow('getBlame path is required');

    await expect(repo.getBlame({ path: '' })).rejects.toThrow(
      'getBlame path is required'
    );

    await expect(repo.getBlame({ path: '   ' })).rejects.toThrow(
      'getBlame path is required'
    );
  });

  it('sends note payloads with createNote, appendNote, and deleteNote', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-notes-write' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('POST');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/notes')).toBe(true);
      expect(init?.body).toBeDefined();
      const payload = JSON.parse(init?.body as string);
      expect(payload).toEqual({
        sha: 'abc123',
        action: 'add',
        note: 'note content',
      });
      return Promise.resolve({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: { get: () => 'application/json' } as any,
        json: async () => ({
          sha: 'abc123',
          target_ref: 'refs/notes/commits',
          new_ref_sha: 'def456',
          result: { success: true, status: 'ok' },
        }),
      } as any);
    });

    const createResult = await repo.createNote({
      sha: 'abc123',
      note: 'note content',
    });
    expect(createResult.targetRef).toBe('refs/notes/commits');

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('POST');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/notes')).toBe(true);
      expect(init?.body).toBeDefined();
      const payload = JSON.parse(init?.body as string);
      expect(payload).toEqual({
        sha: 'abc123',
        action: 'append',
        note: 'note append',
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' } as any,
        json: async () => ({
          sha: 'abc123',
          target_ref: 'refs/notes/commits',
          new_ref_sha: 'def789',
          result: { success: true, status: 'ok' },
        }),
      } as any);
    });

    const appendResult = await repo.appendNote({
      sha: 'abc123',
      note: 'note append',
    });
    expect(appendResult.targetRef).toBe('refs/notes/commits');

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('DELETE');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/notes')).toBe(true);
      expect(init?.body).toBeDefined();
      const payload = JSON.parse(init?.body as string);
      expect(payload).toEqual({ sha: 'abc123' });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' } as any,
        json: async () => ({
          sha: 'abc123',
          target_ref: 'refs/notes/commits',
          new_ref_sha: 'def456',
          result: { success: true, status: 'ok' },
        }),
      } as any);
    });

    const deleteResult = await repo.deleteNote({ sha: 'abc123' });
    expect(deleteResult.targetRef).toBe('refs/notes/commits');
  });

  it('passes ephemeral flag to getFileStream', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-ephemeral-file' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/file')).toBe(true);
      expect(requestUrl.searchParams.get('path')).toBe('docs/readme.md');
      expect(requestUrl.searchParams.get('ref')).toBe('feature/demo');
      expect(requestUrl.searchParams.get('ephemeral')).toBe('true');
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({}),
        text: async () => '',
      } as any);
    });

    const response = await repo.getFileStream({
      path: 'docs/readme.md',
      ref: 'feature/demo',
      ephemeral: true,
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('posts archive requests with globs and prefix', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-archive' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('POST');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/archive')).toBe(true);
      const payload = JSON.parse(init?.body as string);
      expect(payload).toEqual({
        ref: 'main',
        include_globs: ['README.md'],
        exclude_globs: ['vendor/**'],
        max_blob_size: 1024,
        archive: { prefix: 'repo/' },
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({}),
        text: async () => '',
      } as any);
    });

    const response = await repo.getArchiveStream({
      ref: 'main',
      includeGlobs: ['README.md'],
      excludeGlobs: ['vendor/**'],
      maxBlobSize: 1024,
      archivePrefix: 'repo/',
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('passes ephemeral flag to listFiles', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-ephemeral-list' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/files')).toBe(true);
      expect(requestUrl.searchParams.get('ref')).toBe('feature/demo');
      expect(requestUrl.searchParams.get('ephemeral')).toBe('true');
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({
          paths: ['docs/readme.md'],
          ref: 'refs/namespaces/ephemeral/refs/heads/feature/demo',
        }),
        text: async () => '',
      } as any);
    });

    const result = await repo.listFiles({
      ref: 'feature/demo',
      ephemeral: true,
    });

    expect(result.paths).toEqual(['docs/readme.md']);
    expect(result.ref).toBe(
      'refs/namespaces/ephemeral/refs/heads/feature/demo'
    );
  });

  it('passes ephemeral flag to listFilesWithMetadata and parses commit dates', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-ephemeral-list-meta' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('GET');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/files/metadata')).toBe(true);
      expect(requestUrl.searchParams.get('ref')).toBe('feature/demo');
      expect(requestUrl.searchParams.get('ephemeral')).toBe('true');
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({
          files: [
            {
              path: 'docs/readme.md',
              mode: '100644',
              size: 12,
              last_commit_sha: 'deadbeef',
            },
          ],
          commits: {
            deadbeef: {
              author: 'Test User',
              date: '2026-02-19T12:00:00Z',
              message: 'initial commit',
            },
          },
          ref: 'refs/namespaces/ephemeral/refs/heads/feature/demo',
        }),
        text: async () => '',
      } as any);
    });

    const result = await repo.listFilesWithMetadata({
      ref: 'feature/demo',
      ephemeral: true,
    });

    expect(result.files).toEqual([
      {
        path: 'docs/readme.md',
        mode: '100644',
        size: 12,
        lastCommitSha: 'deadbeef',
      },
    ]);
    expect(result.commits.deadbeef.author).toBe('Test User');
    expect(result.commits.deadbeef.rawDate).toBe('2026-02-19T12:00:00Z');
    expect(result.commits.deadbeef.date).toBeInstanceOf(Date);
    expect(result.commits.deadbeef.date.toISOString()).toBe(
      '2026-02-19T12:00:00.000Z'
    );
    expect(result.ref).toBe(
      'refs/namespaces/ephemeral/refs/heads/feature/demo'
    );
  });

  it('posts grep request body and parses response', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-grep' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('POST');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/grep')).toBe(true);

      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body).toEqual({
        ref: 'main',
        paths: ['src/'],
        query: { pattern: 'SEARCHME', case_sensitive: false },
        context: { before: 1, after: 2 },
        limits: { max_lines: 5, max_matches_per_file: 7 },
        pagination: { cursor: 'abc', limit: 3 },
        file_filters: {
          include_globs: ['**/*.ts'],
          exclude_globs: ['**/vendor/**'],
        },
      });

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({
          query: { pattern: 'SEARCHME', case_sensitive: false },
          repo: { ref: 'main', commit: 'deadbeef' },
          matches: [
            {
              path: 'src/a.ts',
              lines: [{ line_number: 12, text: 'SEARCHME', type: 'match' }],
            },
          ],
          next_cursor: null,
          has_more: false,
        }),
        text: async () => '',
      } as any);
    });

    const result = await repo.grep({
      ref: 'main',
      paths: ['src/'],
      query: { pattern: 'SEARCHME', caseSensitive: false },
      fileFilters: {
        includeGlobs: ['**/*.ts'],
        excludeGlobs: ['**/vendor/**'],
      },
      context: { before: 1, after: 2 },
      limits: { maxLines: 5, maxMatchesPerFile: 7 },
      pagination: { cursor: 'abc', limit: 3 },
    });

    expect(result.query).toEqual({ pattern: 'SEARCHME', caseSensitive: false });
    expect(result.repo).toEqual({ ref: 'main', commit: 'deadbeef' });
    expect(result.matches).toEqual([
      {
        path: 'src/a.ts',
        lines: [{ lineNumber: 12, text: 'SEARCHME', type: 'match' }],
      },
    ]);
    expect(result.nextCursor).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });

  it('supports legacy grep rev option', async () => {
    const store = new GitStorage({ name: 'v0', key });
    const repo = await store.createRepo({ id: 'repo-grep-legacy' });

    mockFetch.mockImplementationOnce((url, init) => {
      expect(init?.method).toBe('POST');
      const requestUrl = new URL(url as string);
      expect(requestUrl.pathname.endsWith('/repos/grep')).toBe(true);

      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body).toEqual({
        ref: 'main',
        query: { pattern: 'SEARCHME' },
      });

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null } as any,
        json: async () => ({
          query: { pattern: 'SEARCHME', case_sensitive: true },
          repo: { ref: 'main', commit: 'deadbeef' },
          matches: [],
          next_cursor: null,
          has_more: false,
        }),
        text: async () => '',
      } as any);
    });

    const result = await repo.grep({
      rev: 'main',
      query: { pattern: 'SEARCHME' },
    });

    expect(result.query.pattern).toBe('SEARCHME');
    expect(result.repo.ref).toBe('main');
  });

  describe('createRepo', () => {
    it('should return a repo with id and getRemoteURL function', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      expect(repo).toBeDefined();
      expect(repo.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ); // UUID format
      expect(repo.getRemoteURL).toBeInstanceOf(Function);

      const url = await repo.getRemoteURL();
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\.git$`
        )
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
    });

    it('should accept options for getRemoteURL', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      // Test with permissions and ttl
      const url = await repo.getRemoteURL({
        permissions: ['git:write', 'git:read'],
        ttl: 3600,
      });
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\.git$`
        )
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
    });

    it('should return ephemeral remote URL with +ephemeral suffix', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      const url = await repo.getEphemeralRemoteURL();
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\+ephemeral\\.git$`
        )
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
      expect(url).toContain('+ephemeral.git');
    });

    it('should accept options for getEphemeralRemote', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      // Test with permissions and ttl
      const url = await repo.getEphemeralRemoteURL({
        permissions: ['git:write', 'git:read'],
        ttl: 3600,
      });
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\+ephemeral\\.git$`
        )
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
    });

    it('should return import remote URL with +import suffix', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      const url = await repo.getImportRemoteURL();
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\+import\\.git$`
        )
      );
      expect(url).toContain('eyJ');
      expect(url).toContain('+import.git');
    });

    it('should accept options for getImportRemoteURL', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      const url = await repo.getImportRemoteURL({
        permissions: ['git:write'],
        ttl: 3600,
      });
      expect(url).toMatch(
        new RegExp(
          `^https:\\/\\/t:.+@v0\\.3p\\.pierre\\.rip\\/${repo.id}\\+import\\.git$`
        )
      );
      expect(url).toContain('eyJ');
    });

    it('getRemoteURL and getEphemeralRemote should return different URLs', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      const defaultURL = await repo.getRemoteURL();
      const ephemeralURL = await repo.getEphemeralRemoteURL();

      expect(defaultURL).not.toBe(ephemeralURL);
      expect(defaultURL).toContain(`${repo.id}.git`);
      expect(ephemeralURL).toContain(`${repo.id}+ephemeral.git`);
      expect(ephemeralURL).not.toContain(`${repo.id}.git`);
    });

    it('should set createdAt on newly created repos', async () => {
      const before = new Date().toISOString();
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-created-at' });

      expect(repo.createdAt).toBeDefined();
      expect(typeof repo.createdAt).toBe('string');
      expect(repo.createdAt.length).toBeGreaterThan(0);
      // Should be a valid ISO date string close to now
      const after = new Date().toISOString();
      expect(repo.createdAt >= before).toBe(true);
      expect(repo.createdAt <= after).toBe(true);
    });

    it('should use provided id instead of generating UUID', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const customName = 'my-custom-repo-name';
      const repo = await store.createRepo({ id: customName });

      expect(repo.id).toBe(customName);

      const url = await repo.getRemoteURL();
      expect(url).toContain(`/${customName}.git`);
    });

    it('should send baseRepo configuration with default defaultBranch when only baseRepo is provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const baseRepo = {
        provider: 'github' as const,
        owner: 'octocat',
        name: 'hello-world',
        defaultBranch: 'main',
      };

      await store.createRepo({ baseRepo });

      // Check that fetch was called with baseRepo and default defaultBranch
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            base_repo: {
              provider: 'github',
              owner: 'octocat',
              name: 'hello-world',
              default_branch: 'main',
            },
            default_branch: 'main',
          }),
        })
      );
    });

    it('should send both baseRepo and custom defaultBranch when both are provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const baseRepo = {
        provider: 'github' as const,
        owner: 'octocat',
        name: 'hello-world',
      };
      const defaultBranch = 'develop';

      await store.createRepo({ baseRepo, defaultBranch });

      // Check that fetch was called with the correct body
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            base_repo: {
              provider: 'github',
              owner: 'octocat',
              name: 'hello-world',
            },
            default_branch: defaultBranch,
          }),
        })
      );
    });

    it('should send public GitHub baseRepo auth mode when provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const baseRepo = {
        owner: 'octocat',
        name: 'Hello-World',
        auth: { authType: 'public' as const },
      };

      await store.createRepo({ baseRepo });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            base_repo: {
              provider: 'github',
              owner: 'octocat',
              name: 'Hello-World',
              auth: { auth_type: 'public' },
            },
            default_branch: 'main',
          }),
        })
      );
    });

    it('should send fork baseRepo configuration with auth token', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const baseRepo = {
        id: 'template-repo',
        ref: 'develop',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: 'forked-repo',
          url: 'https://test.code.storage/repo.git',
        }),
      });

      const repo = await store.createRepo({ baseRepo });

      expect(repo.defaultBranch).toBe('main');

      const requestBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(requestBody.default_branch).toBeUndefined();
      expect(requestBody.base_repo).toEqual(
        expect.objectContaining({
          provider: 'code',
          owner: 'v0',
          name: 'template-repo',
          operation: 'fork',
          ref: 'develop',
        })
      );
      expect(requestBody.base_repo.auth?.token).toBeTruthy();

      const payload = decodeJwtPayload(requestBody.base_repo.auth.token);
      expect(payload.repo).toBe('template-repo');
      expect(payload.scopes).toEqual(['git:read']);
    });

    it('should default defaultBranch to "main" when not provided', async () => {
      const store = new GitStorage({ name: 'v0', key });

      await store.createRepo({});

      // Check that fetch was called with default defaultBranch of 'main'
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            default_branch: 'main',
          }),
        })
      );
    });

    it('should use custom defaultBranch when explicitly provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const customBranch = 'develop';

      await store.createRepo({ defaultBranch: customBranch });

      // Check that fetch was called with the custom defaultBranch
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            default_branch: customBranch,
          }),
        })
      );
    });

    it('should handle repository already exists error', async () => {
      const store = new GitStorage({ name: 'v0', key });

      // Mock a 409 Conflict response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      await expect(store.createRepo({ id: 'existing-repo' })).rejects.toThrow(
        'Repository already exists'
      );
    });
  });

  describe('listRepos', () => {
    it('should fetch repositories with org:read scope', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockImplementationOnce((url, init) => {
        expect(init?.method).toBe('GET');
        expect(url).toBe('https://api.v0.3p.pierre.rip/api/v1/repos');

        const headers = init?.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['org:read']);
        expect(payload.repo).toBe('org');

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            repos: [
              {
                repo_id: 'repo-1',
                url: 'owner/repo-1',
                default_branch: 'main',
                created_at: '2024-01-01T00:00:00Z',
                base_repo: {
                  provider: 'github',
                  owner: 'owner',
                  name: 'repo-1',
                },
              },
            ],
            next_cursor: null,
            has_more: false,
          }),
        });
      });

      const result = await store.listRepos();
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].repoId).toBe('repo-1');
      expect(result.hasMore).toBe(false);
    });

    it('should pass cursor and limit params', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockImplementationOnce((url) => {
        const requestUrl = new URL(url as string);
        expect(requestUrl.pathname.endsWith('/api/v1/repos')).toBe(true);
        expect(requestUrl.searchParams.get('cursor')).toBe('cursor-1');
        expect(requestUrl.searchParams.get('limit')).toBe('25');

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            repos: [],
            next_cursor: null,
            has_more: false,
          }),
        });
      });

      await store.listRepos({ cursor: 'cursor-1', limit: 25 });
    });
  });

  describe('repo', () => {
    it('should create repo metadata without making HTTP requests', async () => {
      const store = new GitStorage({ name: 'v0', key });

      const repo = store.repo({
        id: 'known-repo-id',
        defaultBranch: 'develop',
        createdAt: '2024-06-15T12:00:00Z',
      });

      expect(repo.id).toBe('known-repo-id');
      expect(repo.defaultBranch).toBe('develop');
      expect(repo.createdAt).toBe('2024-06-15T12:00:00Z');
      expect(mockFetch).not.toHaveBeenCalled();

      const url = await repo.getRemoteURL({ permissions: ['git:read'] });
      expect(url).toMatch(
        /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/known-repo-id\.git$/
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should default repo metadata fields when omitted', () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = store.repo({ id: 'known-repo-id' });

      expect(repo.id).toBe('known-repo-id');
      expect(repo.defaultBranch).toBe('main');
      expect(repo.createdAt).toBe('');
    });

    it('should reject repo when id is empty', () => {
      const store = new GitStorage({ name: 'v0', key });

      expect(() => store.repo({ id: '' })).toThrow(
        'repo requires a non-empty repository id.'
      );
      expect(() => store.repo({ id: '   ' })).toThrow(
        'repo requires a non-empty repository id.'
      );
    });

  });

  describe('findOne', () => {
    it('should return a repo with getRemoteURL function when found', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repoId = 'test-repo-id';
      const repo = await store.findOne({ id: repoId });

      expect(repo).toBeDefined();
      expect(repo?.id).toBe(repoId);
      expect(repo?.getRemoteURL).toBeInstanceOf(Function);

      const url = await repo?.getRemoteURL();
      expect(url).toMatch(
        /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo-id\.git$/
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
    });

    it('should expose createdAt from API response', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          default_branch: 'main',
          created_at: '2024-06-15T12:00:00Z',
        }),
      });

      const repo = await store.findOne({ id: 'test-repo-id' });
      expect(repo).toBeDefined();
      expect(repo?.createdAt).toBe('2024-06-15T12:00:00Z');
    });

    it('should default createdAt to empty string when not in response', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          default_branch: 'main',
        }),
      });

      const repo = await store.findOne({ id: 'test-repo-id' });
      expect(repo).toBeDefined();
      expect(repo?.createdAt).toBe('');
    });

    it('should handle getRemoteURL with options', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.findOne({ id: 'test-repo-id' });

      expect(repo).toBeDefined();
      const url = await repo?.getRemoteURL({
        permissions: ['git:read'],
        ttl: 7200,
      });
      expect(url).toMatch(
        /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo-id\.git$/
      );
      expect(url).toContain('eyJ'); // JWT should contain base64 encoded content
    });
  });

  describe('deleteRepo', () => {
    it('should delete a repository and return the result', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repoId = 'test-repo-to-delete';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: repoId,
          message: `Repository ${repoId} deletion initiated. Physical storage cleanup will complete asynchronously.`,
        }),
      } as any);

      const result = await store.deleteRepo({ id: repoId });

      expect(result.repoId).toBe(repoId);
      expect(result.message).toContain('deletion initiated');
    });

    it('should send DELETE request with repo:write scope', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repoId = 'test-repo-delete-scope';

      mockFetch.mockImplementationOnce((url, init) => {
        expect(init?.method).toBe('DELETE');
        expect(url).toBe('https://api.v0.3p.pierre.rip/api/v1/repos/delete');

        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toMatch(/^Bearer /);

        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['repo:write']);
        expect(payload.repo).toBe(repoId);

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            repo_id: repoId,
            message: 'Repository deletion initiated.',
          }),
        });
      });

      await store.deleteRepo({ id: repoId });
    });

    it('should throw error when repository not found', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      await expect(
        store.deleteRepo({ id: 'non-existent-repo' })
      ).rejects.toThrow('Repository not found');
    });

    it('should throw error when repository already deleted', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      } as any);

      await expect(
        store.deleteRepo({ id: 'already-deleted-repo' })
      ).rejects.toThrow('Repository already deleted');
    });

    it('should honor ttl option', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const customTTL = 300;

      mockFetch.mockImplementationOnce((_url, init) => {
        const headers = init?.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.exp - payload.iat).toBe(customTTL);

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            repo_id: 'test-repo',
            message: 'Repository deletion initiated.',
          }),
        });
      });

      await store.deleteRepo({ id: 'test-repo', ttl: customTTL });
    });
  });

  describe('Repo createBranch', () => {
    it('posts baseRef to create branch endpoint and returns parsed result', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-create-branch' });

      mockFetch.mockImplementationOnce((url, init) => {
        expect(url).toBe(
          'https://api.v0.3p.pierre.rip/api/v1/repos/branches/create'
        );

        const requestInit = init as RequestInit;
        expect(requestInit.method).toBe('POST');

        const headers = requestInit.headers as Record<string, string>;
        expect(headers.Authorization).toMatch(/^Bearer /);
        expect(headers['Content-Type']).toBe('application/json');

        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({
          base_ref: 'refs/heads/main',
          base_is_ephemeral: true,
          target_branch: 'feature/demo',
          target_is_ephemeral: true,
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: 'branch created',
            target_branch: 'feature/demo',
            target_is_ephemeral: true,
            commit_sha: 'abc123',
          }),
        } as any);
      });

      const result = await repo.createBranch({
        baseRef: ' refs/heads/main ',
        targetBranch: ' feature/demo ',
        baseIsEphemeral: true,
        targetIsEphemeral: true,
      });

      expect(result).toEqual({
        message: 'branch created',
        targetBranch: 'feature/demo',
        targetIsEphemeral: true,
        commitSha: 'abc123',
      });
    });

    it('falls back to deprecated baseBranch when baseRef is absent', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-create-branch-fallback' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body).toEqual({
          base_branch: 'main',
          target_branch: 'feature/demo',
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: 'branch created',
            target_branch: 'feature/demo',
            target_is_ephemeral: false,
          }),
        } as any);
      });

      await repo.createBranch({
        baseBranch: ' main ',
        targetBranch: 'feature/demo',
      });
    });

    it('prefers baseRef when both baseRef and baseBranch are provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-create-branch-precedence' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body).toEqual({
          base_ref: 'refs/heads/main',
          target_branch: 'feature/demo',
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: 'branch created',
            target_branch: 'feature/demo',
            target_is_ephemeral: false,
          }),
        } as any);
      });

      await repo.createBranch({
        baseRef: 'refs/heads/main',
        baseBranch: 'main',
        targetBranch: 'feature/demo',
      });
    });

    it('honors ttl override when creating a branch', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-create-branch-ttl' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const requestInit = init as RequestInit;
        const headers = requestInit.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['git:write']);
        expect(payload.exp - payload.iat).toBe(600);

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: 'branch created',
            target_branch: 'feature/demo',
            target_is_ephemeral: false,
          }),
        } as any);
      });

      const result = await repo.createBranch({
        baseRef: 'refs/heads/main',
        targetBranch: 'feature/demo',
        ttl: 600,
      });

      expect(result).toEqual({
        message: 'branch created',
        targetBranch: 'feature/demo',
        targetIsEphemeral: false,
        commitSha: undefined,
      });
    });

    it('requires an effective base source and target branch', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({
        id: 'repo-create-branch-validation',
      });

      await expect(
        repo.createBranch({ baseRef: '', targetBranch: 'feature/demo' })
      ).rejects.toThrow('createBranch baseRef or baseBranch is required');

      await expect(
        repo.createBranch({
          baseRef: '   ',
          baseBranch: ' ',
          targetBranch: 'feature/demo',
        })
      ).rejects.toThrow('createBranch baseRef or baseBranch is required');

      await expect(
        repo.createBranch({ baseRef: 'refs/heads/main', targetBranch: '' })
      ).rejects.toThrow('createBranch targetBranch is required');
    });
  });

  describe('Repo merge', () => {
    it('posts merge request and returns transformed response', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = store.repo({ id: 'repo-merge' });

      mockFetch.mockImplementationOnce((url, init) => {
        const requestUrl = new URL(url as string);
        expect(requestUrl.pathname).toBe('/api/v1/repos/merge');

        const requestInit = init as RequestInit;
        expect(requestInit.method).toBe('POST');

        const headers = requestInit.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['git:write']);

        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({
          source_branch: 'feature',
          source_is_ephemeral: true,
          target_branch: 'main',
          target_is_ephemeral: false,
          expected_target_sha: 'abc123',
          commit_message: 'Merge feature',
          author: { name: 'Bot', email: 'bot@example.com' },
          committer: { name: 'Committer', email: 'committer@example.com' },
          strategy: 'merge',
          allow_unrelated_histories: false,
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            result: 'merge_commit',
            commit_sha: 'merge-sha',
            tree_sha: 'tree-sha',
            source: { branch: 'feature', ephemeral: true, sha: 'source-sha' },
            target: {
              branch: 'main',
              ephemeral: false,
              old_sha: 'abc123',
              new_sha: 'merge-sha',
            },
            merge_base_sha: 'base-sha',
            promoted_commits: 2,
          }),
        } as any);
      });

      const result = await repo.merge({
        sourceBranch: ' feature ',
        sourceIsEphemeral: true,
        targetBranch: ' main ',
        targetIsEphemeral: false,
        expectedTargetSha: ' abc123 ',
        commitMessage: ' Merge feature ',
        author: { name: ' Bot ', email: ' bot@example.com ' },
        committer: { name: ' Committer ', email: ' committer@example.com ' },
        strategy: 'merge',
        allowUnrelatedHistories: false,
      });

      expect(result).toEqual({
        result: 'merge_commit',
        commitSha: 'merge-sha',
        treeSha: 'tree-sha',
        source: { branch: 'feature', ephemeral: true, sha: 'source-sha' },
        target: {
          branch: 'main',
          ephemeral: false,
          oldSha: 'abc123',
          newSha: 'merge-sha',
        },
        mergeBaseSha: 'base-sha',
        promotedCommits: 2,
      });
    });

    it('omits blank optional string fields from merge request', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = store.repo({ id: 'repo-merge-minimal' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body).toEqual({
          source_branch: 'feature',
          target_branch: 'main',
          strategy: 'ff_prefer',
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            result: 'fast_forward',
            commit_sha: 'target-sha',
            tree_sha: 'tree-sha',
            source: { branch: 'feature', ephemeral: false, sha: 'target-sha' },
            target: {
              branch: 'main',
              ephemeral: false,
              old_sha: 'old-sha',
              new_sha: 'target-sha',
            },
            promoted_commits: 1,
          }),
        } as any);
      });

      await repo.merge({
        sourceBranch: 'feature',
        targetBranch: 'main',
        expectedTargetSha: ' ',
        commitMessage: '',
        strategy: 'ff_prefer',
      });
    });

    it('validates merge inputs locally', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = store.repo({ id: 'repo-merge-validation' });

      await expect(
        repo.merge({ sourceBranch: '', targetBranch: 'main', strategy: 'merge' })
      ).rejects.toThrow('merge sourceBranch is required');
      await expect(
        repo.merge({ sourceBranch: 'feature', targetBranch: '', strategy: 'merge' })
      ).rejects.toThrow('merge targetBranch is required');
      await expect(
        repo.merge({ sourceBranch: 'feature', targetBranch: 'main', strategy: '' as any })
      ).rejects.toThrow('merge strategy is required');
      await expect(
        repo.merge({
          sourceBranch: 'feature',
          targetBranch: 'main',
          strategy: 'squash' as any,
        })
      ).rejects.toThrow('merge strategy must be merge, ff_only, or ff_prefer');
      await expect(
        repo.merge({
          sourceBranch: 'feature',
          targetBranch: 'main',
          strategy: 'merge',
          author: { name: '', email: 'bot@example.com' },
        })
      ).rejects.toThrow('merge author name and email are required when provided');
      await expect(
        repo.merge({
          sourceBranch: 'feature',
          targetBranch: 'main',
          strategy: 'merge',
          committer: { name: 'Bot', email: ' ' },
        })
      ).rejects.toThrow(
        'merge committer name and email are required when provided'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Repo tags', () => {
    it('lists tags with pagination', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-list-tags' });

      mockFetch.mockImplementationOnce((url, init) => {
        const requestUrl = new URL(url as string);
        expect(requestUrl.pathname).toBe('/api/v1/repos/tags');
        expect(requestUrl.searchParams.get('cursor')).toBe('start');
        expect(requestUrl.searchParams.get('limit')).toBe('17');

        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toMatch(/^Bearer /);

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            tags: [
              { cursor: 'c1', name: 'v1.0.0', sha: 'abc123' },
              { cursor: 'c2', name: 'v1.0.1', sha: 'def456' },
            ],
            next_cursor: 'next',
            has_more: true,
          }),
        } as any);
      });

      const result = await repo.listTags({ cursor: 'start', limit: 17 });

      expect(result).toEqual({
        tags: [
          { cursor: 'c1', name: 'v1.0.0', sha: 'abc123' },
          { cursor: 'c2', name: 'v1.0.1', sha: 'def456' },
        ],
        nextCursor: 'next',
        hasMore: true,
      });
    });

    it('creates and deletes tags with expected scopes', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-tags-write' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const requestInit = init as RequestInit;
        expect(requestInit.method).toBe('POST');

        const headers = requestInit.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['git:write']);

        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({
          name: 'v1.0.0',
          target: '0123456789abcdef0123456789abcdef01234567',
        });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            name: 'v1.0.0',
            sha: '0123456789abcdef0123456789abcdef01234567',
            message: 'tag created',
          }),
        } as any);
      });

      const createResult = await repo.createTag({
        name: 'v1.0.0',
        target: '0123456789abcdef0123456789abcdef01234567',
      });

      expect(createResult).toEqual({
        name: 'v1.0.0',
        sha: '0123456789abcdef0123456789abcdef01234567',
        message: 'tag created',
      });

      mockFetch.mockImplementationOnce((_url, init) => {
        const requestInit = init as RequestInit;
        expect(requestInit.method).toBe('DELETE');

        const headers = requestInit.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['git:read', 'git:write']);

        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({ name: 'v1.0.0' });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            name: 'v1.0.0',
            message: 'tag deleted',
          }),
        } as any);
      });

      const deleteResult = await repo.deleteTag({ name: 'v1.0.0' });
      expect(deleteResult).toEqual({
        name: 'v1.0.0',
        message: 'tag deleted',
      });
    });

    it('validates tag names', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-tag-validation' });

      await expect(
        repo.createTag({ name: '', target: 'abc' })
      ).rejects.toThrow('createTag name is required');
      await expect(
        repo.createTag({ name: 'refs/tags/v1.0.0', target: 'abc' })
      ).rejects.toThrow('createTag name must not start with refs/');
      await expect(repo.deleteTag({ name: '' })).rejects.toThrow(
        'deleteTag name is required'
      );
    });
  });

  describe('Repo deleteBranch', () => {
    it('sends DELETE with git:write scope and parses the response', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-delete-branch' });

      mockFetch.mockImplementationOnce((_url, init) => {
        const requestInit = init as RequestInit;
        expect(requestInit.method).toBe('DELETE');

        const headers = requestInit.headers as Record<string, string>;
        const payload = decodeJwtPayload(stripBearer(headers.Authorization));
        expect(payload.scopes).toEqual(['git:write']);

        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({ name: 'feature/old-onboarding' });

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            name: 'feature/old-onboarding',
            message: 'branch deleted',
          }),
        } as any);
      });

      const result = await repo.deleteBranch({
        name: 'feature/old-onboarding',
      });
      expect(result).toEqual({
        name: 'feature/old-onboarding',
        message: 'branch deleted',
      });
    });

    it('validates branch names', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'repo-delete-branch-validation' });

      await expect(repo.deleteBranch({ name: '' })).rejects.toThrow(
        'deleteBranch name is required'
      );
      await expect(
        repo.deleteBranch({ name: 'refs/heads/feature/demo' })
      ).rejects.toThrow('deleteBranch name must not start with refs/');
    });
  });

  describe('Repo getBranchDiff', () => {
    it('forwards ephemeralBase flag to the API params', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({
        id: 'repo-branch-diff-ephemeral-base',
      });

      mockFetch.mockImplementationOnce((url) => {
        const requestUrl = new URL(url as string);
        expect(requestUrl.searchParams.get('branch')).toBe(
          'refs/heads/feature/demo'
        );
        expect(requestUrl.searchParams.get('base')).toBe('refs/heads/main');
        expect(requestUrl.searchParams.get('ephemeral_base')).toBe('true');

        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            branch: 'refs/heads/feature/demo',
            base: 'refs/heads/main',
            stats: { files: 1, additions: 1, deletions: 0, changes: 1 },
            files: [
              {
                path: 'README.md',
                state: 'modified',
                old_path: null,
                raw: '@@',
                bytes: 10,
                is_eof: true,
                additions: 3,
                deletions: 1,
              },
            ],
            filtered_files: [],
          }),
        } as any);
      });

      const result = await repo.getBranchDiff({
        branch: 'refs/heads/feature/demo',
        base: 'refs/heads/main',
        ephemeralBase: true,
      });

      expect(result.branch).toBe('refs/heads/feature/demo');
      expect(result.base).toBe('refs/heads/main');
      expect(result.files[0]?.additions).toBe(3);
      expect(result.files[0]?.deletions).toBe(1);
    });
  });

  describe('Repo restoreCommit', () => {
    it('should post metadata to the restore endpoint and return the response', async () => {
      const store = new GitStorage({ name: 'v0', key });

      const createRepoResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: 'test-repo-id',
          url: 'https://test.code.storage/repo.git',
        }),
      };

      const restoreResponse = {
        commit: {
          commit_sha: 'abcdef0123456789abcdef0123456789abcdef01',
          tree_sha: 'fedcba9876543210fedcba9876543210fedcba98',
          target_branch: 'main',
          pack_bytes: 1024,
        },
        result: {
          branch: 'main',
          old_sha: '0123456789abcdef0123456789abcdef01234567',
          new_sha: '89abcdef0123456789abcdef0123456789abcdef',
          success: true,
          status: 'ok',
        },
      };

      mockFetch.mockResolvedValueOnce(createRepoResponse as any);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        json: async () => restoreResponse,
      } as any);

      const repo = await store.createRepo({});
      const response = await repo.restoreCommit({
        targetBranch: 'main',
        expectedHeadSha: 'main',
        targetCommitSha: '0123456789abcdef0123456789abcdef01234567',
        commitMessage: 'Restore "feature"',
        author: {
          name: 'Author Name',
          email: 'author@example.com',
        },
        committer: {
          name: 'Committer Name',
          email: 'committer@example.com',
        },
      });

      expect(response).toEqual({
        commitSha: 'abcdef0123456789abcdef0123456789abcdef01',
        treeSha: 'fedcba9876543210fedcba9876543210fedcba98',
        targetBranch: 'main',
        packBytes: 1024,
        refUpdate: {
          branch: 'main',
          oldSha: '0123456789abcdef0123456789abcdef01234567',
          newSha: '89abcdef0123456789abcdef0123456789abcdef',
        },
      });

      const [, restoreCall] = mockFetch.mock.calls;
      expect(restoreCall[0]).toBe(
        'https://api.v0.3p.pierre.rip/api/v1/repos/restore-commit'
      );
      const requestInit = restoreCall[1] as RequestInit;
      expect(requestInit.method).toBe('POST');
      expect(requestInit.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Bearer\s.+/),
        'Content-Type': 'application/json',
      });

      const parsedBody = JSON.parse(requestInit.body as string);
      expect(parsedBody).toEqual({
        metadata: {
          target_branch: 'main',
          expected_head_sha: 'main',
          target_commit_sha: '0123456789abcdef0123456789abcdef01234567',
          commit_message: 'Restore "feature"',
          author: {
            name: 'Author Name',
            email: 'author@example.com',
          },
          committer: {
            name: 'Committer Name',
            email: 'committer@example.com',
          },
        },
      });
    });

    it('throws RefUpdateError when restore fails with a conflict response', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: 'test-repo-id',
          url: 'https://test.code.storage/repo.git',
        }),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          commit: {
            commit_sha: 'cafefeedcafefeedcafefeedcafefeedcafefeed',
            tree_sha: 'feedfacefeedfacefeedfacefeedfacefeedface',
            target_branch: 'main',
            pack_bytes: 0,
          },
          result: {
            branch: 'main',
            old_sha: '0123456789abcdef0123456789abcdef01234567',
            new_sha: 'cafefeedcafefeedcafefeedcafefeedcafefeed',
            success: false,
            status: 'precondition_failed',
            message: 'branch moved',
          },
        }),
      } as any);

      const repo = await store.createRepo({});

      await expect(
        repo.restoreCommit({
          targetBranch: 'main',
          expectedHeadSha: 'main',
          targetCommitSha: '0123456789abcdef0123456789abcdef01234567',
          author: { name: 'Author Name', email: 'author@example.com' },
        })
      ).rejects.toMatchObject({
        name: 'RefUpdateError',
        message: 'branch moved',
        status: 'precondition_failed',
        reason: 'precondition_failed',
      });
    });

    it('throws RefUpdateError when restore returns an error payload without commit data', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: 'test-repo-id',
          url: 'https://test.code.storage/repo.git',
        }),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 412,
        statusText: 'Precondition Failed',
        json: async () => ({
          commit: null,
          result: {
            success: false,
            status: 'precondition_failed',
            message: 'expected head SHA mismatch',
          },
        }),
      } as any);

      const repo = await store.createRepo({});

      await expect(
        repo.restoreCommit({
          targetBranch: 'main',
          expectedHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          targetCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          author: { name: 'Author', email: 'author@example.com' },
        })
      ).rejects.toMatchObject({
        name: 'RefUpdateError',
        message: 'expected head SHA mismatch',
        status: 'precondition_failed',
        reason: 'precondition_failed',
      });
    });

    it('surfaces 404 when restore-commit endpoint is unavailable', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          repo_id: 'test-repo-id',
          url: 'https://test.code.storage/repo.git',
        }),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'not found' }),
      } as any);

      const repo = await store.createRepo({});

      await expect(
        repo.restoreCommit({
          targetBranch: 'main',
          targetCommitSha: '0123456789abcdef0123456789abcdef01234567',
          author: {
            name: 'Author Name',
            email: 'author@example.com',
          },
        })
      ).rejects.toMatchObject({
        name: 'RefUpdateError',
        message: expect.stringContaining('HTTP 404'),
        status: expect.any(String),
      });
    });
  });

  describe('createClient', () => {
    it('should create a GitStorage instance', () => {
      const client = createClient({ name: 'v0', key });
      expect(client).toBeInstanceOf(GitStorage);
    });
  });

  describe('CodeStorage alias', () => {
    it('should be the same class as GitStorage', () => {
      expect(CodeStorage).toBe(GitStorage);
    });

    it('should create a CodeStorage instance', () => {
      const store = new CodeStorage({ name: 'v0', key });
      expect(store).toBeInstanceOf(CodeStorage);
      expect(store).toBeInstanceOf(GitStorage);
    });

    it('should work identically to GitStorage', async () => {
      const store = new CodeStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'test-repo' });

      expect(repo).toBeDefined();
      expect(repo.id).toBe('test-repo');

      const url = await repo.getRemoteURL();
      expect(url).toMatch(
        /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo\.git$/
      );
    });
  });

  describe('JWT Generation', () => {
    const extractJWT = (url: string): string => {
      const match = url.match(/https:\/\/t:(.+)@v0\.3p\.pierre\.rip\/.+\.git/);
      if (!match) throw new Error('JWT not found in URL');
      return match[1];
    };

    it('should generate JWT with correct payload structure', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const url = await repo.getRemoteURL();

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload).toHaveProperty('iss', 'v0');
      expect(payload).toHaveProperty('sub', '@pierre/storage');
      expect(payload).toHaveProperty('repo', repo.id);
      expect(payload).toHaveProperty('scopes');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should generate JWT with default permissions and TTL', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const url = await repo.getRemoteURL();

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload.scopes).toEqual(['git:write', 'git:read']);
      // Default TTL is 1 year (365 * 24 * 60 * 60 = 31536000 seconds)
      expect(payload.exp - payload.iat).toBe(31536000);
    });

    it('should generate JWT with custom permissions and TTL', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const customTTL = 7200; // 2 hours
      const customPermissions = ['git:read' as const];

      const url = await repo.getRemoteURL({
        permissions: customPermissions,
        ttl: customTTL,
      });

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload.scopes).toEqual(customPermissions);
      expect(payload.exp - payload.iat).toBe(customTTL);
    });

    it('respects ttl option for getRemoteURL', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const legacyTTL = 1800;

      const url = await repo.getRemoteURL({
        ttl: legacyTTL,
      });

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload.exp - payload.iat).toBe(legacyTTL);
    });

    it('should generate valid JWT signature that can be verified', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const url = await repo.getRemoteURL();

      const jwt = extractJWT(url);
      const importedKey = await importPKCS8(key, 'ES256');

      // This should not throw if the signature is valid
      const { payload } = await jwtVerify(jwt, importedKey);

      expect(payload.iss).toBe('v0');
      expect(payload.repo).toBe(repo.id);
    });

    it('should generate different JWTs for different repos', async () => {
      const store = new GitStorage({ name: 'v0', key });

      const repo1 = await store.findOne({ id: 'repo-1' });
      const repo2 = await store.findOne({ id: 'repo-2' });

      const url1 = await repo1?.getRemoteURL();
      const url2 = await repo2?.getRemoteURL();

      const jwt1 = extractJWT(url1!);
      const jwt2 = extractJWT(url2!);

      const payload1 = decodeJwtPayload(jwt1);
      const payload2 = decodeJwtPayload(jwt2);

      expect(payload1.repo).toBe('repo-1');
      expect(payload2.repo).toBe('repo-2');
      expect(jwt1).not.toBe(jwt2);
    });

    it('should include ops in JWT when provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});

      const url = await repo.getRemoteURL({
        ops: ['no-force-push'],
      });

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload.ops).toEqual(['no-force-push']);
    });

    it('should not include ops in JWT when not provided', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const url = await repo.getRemoteURL();

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload).not.toHaveProperty('ops');
    });

    it('should not include ops in JWT when empty array', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({});
      const url = await repo.getRemoteURL({ ops: [] });

      const jwt = extractJWT(url);
      const payload = decodeJwtPayload(jwt);

      expect(payload).not.toHaveProperty('ops');
    });

    it('should include repo ID in URL path and JWT payload', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const customRepoId = 'my-custom-repo';

      const repo = await store.findOne({ id: customRepoId });
      const url = await repo?.getRemoteURL();

      // Check URL contains repo ID
      expect(url).toContain(`/${customRepoId}.git`);

      // Check JWT payload contains repo ID
      const jwt = extractJWT(url!);
      const payload = decodeJwtPayload(jwt);
      expect(payload.repo).toBe(customRepoId);
    });
  });

  describe('API Methods', () => {
    describe('deprecated ttl support', () => {
      it('uses deprecated ttl when listing files', async () => {
        const store = new GitStorage({ name: 'v0', key });
        const legacyTTL = 900;

        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              repo_id: 'legacy-ttl',
              url: 'https://repo.git',
            }),
          })
        );

        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ paths: [], ref: 'main' }),
          })
        );

        const repo = await store.createRepo({ id: 'legacy-ttl' });
        await repo.listFiles({ ttl: legacyTTL });

        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const init = lastCall?.[1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.Authorization).toBeDefined();
        const payload = decodeJwtPayload(stripBearer(headers!.Authorization));
        expect(payload.exp - payload.iat).toBe(legacyTTL);
      });

      it('uses deprecated ttl when listing files with metadata', async () => {
        const store = new GitStorage({ name: 'v0', key });
        const legacyTTL = 900;

        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              repo_id: 'legacy-ttl-meta',
              url: 'https://repo.git',
            }),
          })
        );

        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              files: [],
              commits: {},
              ref: 'main',
            }),
          })
        );

        const repo = await store.createRepo({ id: 'legacy-ttl-meta' });
        await repo.listFilesWithMetadata({ ttl: legacyTTL });

        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const init = lastCall?.[1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.Authorization).toBeDefined();
        const payload = decodeJwtPayload(stripBearer(headers!.Authorization));
        expect(payload.exp - payload.iat).toBe(legacyTTL);
      });
    });
  });

  describe('Code-Storage-Agent Header', () => {
    it('should include Code-Storage-Agent header in createRepo API calls', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      mockFetch.mockImplementationOnce((_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            repo_id: 'test-repo-id',
            url: 'https://test.code.storage/repo.git',
          }),
        });
      });

      const store = new GitStorage({ name: 'v0', key });
      await store.createRepo({ id: 'test-repo' });

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toMatch(
        /code-storage-sdk\/\d+\.\d+\.\d+/
      );
    });

    it('should include Code-Storage-Agent header in listCommits API calls', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'test-commits' });

      let capturedHeaders: Record<string, string> | undefined;
      mockFetch.mockImplementationOnce((_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            commits: [],
            next_cursor: undefined,
            has_more: false,
          }),
        });
      });

      await repo.listCommits();

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toMatch(
        /code-storage-sdk\/\d+\.\d+\.\d+/
      );
    });

    it('should include Code-Storage-Agent header in createBranch API calls', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'test-branch' });

      let capturedHeaders: Record<string, string> | undefined;
      mockFetch.mockImplementationOnce((_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: 'branch created',
            target_branch: 'feature/test',
            target_is_ephemeral: false,
          }),
        } as any);
      });

      await repo.createBranch({
        baseBranch: 'main',
        targetBranch: 'feature/test',
      });

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toMatch(
        /code-storage-sdk\/\d+\.\d+\.\d+/
      );
    });

    it('should include Code-Storage-Agent header in listTags API calls', async () => {
      const store = new GitStorage({ name: 'v0', key });
      const repo = await store.createRepo({ id: 'test-tags' });

      let capturedHeaders: Record<string, string> | undefined;
      mockFetch.mockImplementationOnce((_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            tags: [],
            has_more: false,
          }),
        });
      });

      await repo.listTags();

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toBeDefined();
      expect(capturedHeaders?.['Code-Storage-Agent']).toMatch(
        /code-storage-sdk\/\d+\.\d+\.\d+/
      );
    });
  });

  describe('URL Generation', () => {
    describe('getDefaultAPIBaseUrl', () => {
      it('should insert name into API base URL', () => {
        // Assuming API_BASE_URL is 'https://api.3p.pierre.rip'
        const result = GitStorage.getDefaultAPIBaseUrl('v0');
        expect(result).toBe('https://api.v0.3p.pierre.rip');
      });

      it('should work with different names', () => {
        const result1 = GitStorage.getDefaultAPIBaseUrl('v1');
        expect(result1).toBe('https://api.v1.3p.pierre.rip');

        const result2 = GitStorage.getDefaultAPIBaseUrl('prod');
        expect(result2).toBe('https://api.prod.3p.pierre.rip');
      });
    });

    describe('getDefaultStorageBaseUrl', () => {
      it('should prepend name to storage base URL', () => {
        // Assuming STORAGE_BASE_URL is '3p.pierre.rip'
        const result = GitStorage.getDefaultStorageBaseUrl('v0');
        expect(result).toBe('v0.3p.pierre.rip');
      });

      it('should work with different names', () => {
        const result1 = GitStorage.getDefaultStorageBaseUrl('v1');
        expect(result1).toBe('v1.3p.pierre.rip');

        const result2 = GitStorage.getDefaultStorageBaseUrl('prod');
        expect(result2).toBe('prod.3p.pierre.rip');
      });
    });

    describe('URL construction with default values', () => {
      it('should use getDefaultAPIBaseUrl when apiBaseUrl is not provided', async () => {
        const store = new GitStorage({ name: 'v0', key });
        await store.createRepo({ id: 'test-repo' });

        // Check that the API calls use the default API base URL with name inserted
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.v0.3p.pierre.rip'),
          expect.any(Object)
        );
      });

      it('should use getDefaultStorageBaseUrl for remote URLs when storageBaseUrl is not provided', async () => {
        const store = new GitStorage({ name: 'v0', key });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo\.git$/
        );
      });

      it('should use getDefaultStorageBaseUrl for ephemeral remote URLs when storageBaseUrl is not provided', async () => {
        const store = new GitStorage({ name: 'v0', key });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getEphemeralRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo\+ephemeral\.git$/
        );
      });

      it('should use getDefaultStorageBaseUrl for import remote URLs when storageBaseUrl is not provided', async () => {
        const store = new GitStorage({ name: 'v0', key });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getImportRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@v0\.3p\.pierre\.rip\/test-repo\+import\.git$/
        );
      });
    });

    describe('URL construction with custom values', () => {
      it('should use custom apiBaseUrl when provided', async () => {
        const customApiBaseUrl = 'custom-api.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          apiBaseUrl: customApiBaseUrl,
        });
        await store.createRepo({ id: 'test-repo' });

        // Check that the API calls use the custom API base URL
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(customApiBaseUrl),
          expect.any(Object)
        );
      });

      it('should use custom storageBaseUrl for remote URLs when provided', async () => {
        const customStorageBaseUrl = 'custom-storage.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          storageBaseUrl: customStorageBaseUrl,
        });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@custom-storage\.example\.com\/test-repo\.git$/
        );
      });

      it('should use custom storageBaseUrl for ephemeral remote URLs when provided', async () => {
        const customStorageBaseUrl = 'custom-storage.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          storageBaseUrl: customStorageBaseUrl,
        });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getEphemeralRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@custom-storage\.example\.com\/test-repo\+ephemeral\.git$/
        );
      });

      it('should use custom storageBaseUrl for import remote URLs when provided', async () => {
        const customStorageBaseUrl = 'custom-storage.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          storageBaseUrl: customStorageBaseUrl,
        });
        const repo = await store.createRepo({ id: 'test-repo' });

        const url = await repo.getImportRemoteURL();
        expect(url).toMatch(
          /^https:\/\/t:.+@custom-storage\.example\.com\/test-repo\+import\.git$/
        );
      });

      it('should use custom apiBaseUrl in createCommit transport', async () => {
        const customApiBaseUrl = 'custom-api.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          apiBaseUrl: customApiBaseUrl,
        });
        const repo = await store.createRepo({ id: 'test-repo' });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            commit: {
              commit_sha: 'abc123',
              tree_sha: 'def456',
              target_branch: 'main',
              pack_bytes: 1024,
              blob_count: 1,
            },
            result: {
              branch: 'main',
              old_sha: 'old123',
              new_sha: 'new456',
              success: true,
              status: 'ok',
            },
          }),
        } as any);

        const builder = repo.createCommit({
          targetBranch: 'main',
          author: { name: 'Test', email: 'test@example.com' },
          commitMessage: 'Test commit',
        });

        await builder.addFileFromString('test.txt', 'test content').send();

        // Verify that the fetch was called with the custom API base URL
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain(customApiBaseUrl);
      });

      it('should use custom apiBaseUrl in createCommitFromDiff', async () => {
        const customApiBaseUrl = 'custom-api.example.com';
        const store = new GitStorage({
          name: 'v0',
          key,
          apiBaseUrl: customApiBaseUrl,
        });
        const repo = await store.createRepo({ id: 'test-repo' });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            commit: {
              commit_sha: 'abc123',
              tree_sha: 'def456',
              target_branch: 'main',
              pack_bytes: 1024,
              blob_count: 1,
            },
            result: {
              branch: 'main',
              old_sha: 'old123',
              new_sha: 'new456',
              success: true,
              status: 'ok',
            },
          }),
        } as any);

        await repo.createCommitFromDiff({
          targetBranch: 'main',
          author: { name: 'Test', email: 'test@example.com' },
          commitMessage: 'Test commit',
          diff: 'diff content',
        });

        // Verify that the fetch was called with the custom API base URL
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall[0]).toContain(customApiBaseUrl);
      });
    });

    describe('Different name values', () => {
      it('should generate correct URLs for different name values', async () => {
        const names = ['v0', 'v1', 'staging', 'prod'];

        for (const name of names) {
          mockFetch.mockReset();
          mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              repo_id: 'test-repo',
              url: 'https://test.code.storage/repo.git',
            }),
          });

          const store = new GitStorage({ name, key });
          const repo = await store.createRepo({ id: 'test-repo' });

          const remoteUrl = await repo.getRemoteURL();
          expect(remoteUrl).toMatch(
            new RegExp(
              `^https:\\/\\/t:.+@${name}\\.3p\\.pierre\\.rip\\/test-repo\\.git$`
            )
          );

          const ephemeralUrl = await repo.getEphemeralRemoteURL();
          expect(ephemeralUrl).toMatch(
            new RegExp(
              `^https:\\/\\/t:.+@${name}\\.3p\\.pierre\\.rip\\/test-repo\\+ephemeral\\.git$`
            )
          );

          const importUrl = await repo.getImportRemoteURL();
          expect(importUrl).toMatch(
            new RegExp(
              `^https:\\/\\/t:.+@${name}\\.3p\\.pierre\\.rip\\/test-repo\\+import\\.git$`
            )
          );

          // Check API calls use the correct URL
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`api.${name}.3p.pierre.rip`),
            expect.any(Object)
          );
        }
      });
    });
  });

  describe('generic git base repo in createRepo', () => {
    it('sends provider and upstream_host for generic git provider', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ repo_id: 'test-repo-id', url: 'https://test.git' }),
        });
      });

      await store.createRepo({
        baseRepo: {
          provider: 'gitlab',
          owner: 'myorg',
          name: 'myrepo',
          upstreamHost: 'gitlab.example.com',
        },
      });

      const baseRepo = capturedBody.base_repo as Record<string, unknown>;
      expect(baseRepo.provider).toBe('gitlab');
      expect(baseRepo.owner).toBe('myorg');
      expect(baseRepo.name).toBe('myrepo');
      expect(baseRepo.upstream_host).toBe('gitlab.example.com');
    });

    it('sends provider without upstream_host when omitted', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ repo_id: 'test-repo-id', url: 'https://test.git' }),
        });
      });

      await store.createRepo({
        baseRepo: {
          provider: 'gitlab',
          owner: 'myorg',
          name: 'myrepo',
        },
      });

      const baseRepo = capturedBody.base_repo as Record<string, unknown>;
      expect(baseRepo.provider).toBe('gitlab');
      expect(baseRepo.upstream_host).toBeUndefined();
    });

    it('defaults provider to github when not set on GitHubBaseRepo', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ repo_id: 'test-repo-id', url: 'https://test.git' }),
        });
      });

      await store.createRepo({
        baseRepo: { owner: 'octocat', name: 'hello-world' },
      });

      const baseRepo = capturedBody.base_repo as Record<string, unknown>;
      expect(baseRepo.provider).toBe('github');
    });
  });

  describe('git credential methods', () => {
    it('createGitCredential posts to repos/git-credentials', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedUrl = '';
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 201,
          statusText: 'Created',
          json: async () => ({ id: 'cred-abc' }),
        });
      });

      const result = await store.createGitCredential({
        repoId: 'repo-123',
        username: 'myuser',
        password: 'mypassword',
      });

      expect(capturedUrl).toContain('/repos/git-credentials');
      expect(capturedBody.repo_id).toBe('repo-123');
      expect(capturedBody.username).toBe('myuser');
      expect(capturedBody.password).toBe('mypassword');
      expect(result.id).toBe('cred-abc');
    });

    it('createGitCredential sends without username when omitted', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 201,
          statusText: 'Created',
          json: async () => ({ id: 'cred-abc' }),
        });
      });

      await store.createGitCredential({ repoId: 'repo-123', password: 'token' });

      expect(capturedBody.username).toBeUndefined();
    });

    it('createGitCredential throws on 409 conflict', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          statusText: 'Conflict',
          json: async () => ({}),
        })
      );

      await expect(
        store.createGitCredential({ repoId: 'repo-123', password: 'token' })
      ).rejects.toThrow('A credential already exists for this repository');
    });

    it('updateGitCredential puts to repos/git-credentials', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method as string;
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ id: 'cred-abc', created_at: '2025-01-01T00:00:00Z' }),
        });
      });

      const result = await store.updateGitCredential({
        id: 'cred-abc',
        username: 'newuser',
        password: 'newpassword',
      });

      expect(capturedMethod).toBe('PUT');
      expect(capturedUrl).toContain('/repos/git-credentials');
      expect(capturedBody.id).toBe('cred-abc');
      expect(capturedBody.username).toBe('newuser');
      expect(capturedBody.password).toBe('newpassword');
      expect(result.id).toBe('cred-abc');
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    it('updateGitCredential throws on 404 not found', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
        })
      );

      await expect(
        store.updateGitCredential({ id: 'cred-abc', password: 'new' })
      ).rejects.toThrow('Credential not found');
    });

    it('deleteGitCredential sends DELETE to repos/git-credentials', async () => {
      const store = new GitStorage({ name: 'v0', key });

      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementationOnce((url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method as string;
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          status: 204,
          statusText: 'No Content',
          json: async () => ({}),
        });
      });

      await store.deleteGitCredential({ id: 'cred-abc' });

      expect(capturedMethod).toBe('DELETE');
      expect(capturedUrl).toContain('/repos/git-credentials');
      expect(capturedBody.id).toBe('cred-abc');
    });

    it('deleteGitCredential throws on 404 not found', async () => {
      const store = new GitStorage({ name: 'v0', key });

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
        })
      );

      await expect(store.deleteGitCredential({ id: 'cred-abc' })).rejects.toThrow(
        'Credential not found'
      );
    });
  });
});
