import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, CodeStorage, GitStorage, createClient } from '../src/index';

const options = {
  name: 'custom-fetch',
  token: 'test-token',
  apiBaseUrl: 'https://api.example.test',
};
const emptyRepos = { repos: [], has_more: false };

describe('custom fetch', () => {
  const globalFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    globalFetch.mockReset();
    globalFetch.mockRejectedValue(new Error('Unexpected global fetch'));
    vi.stubGlobal('fetch', globalFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses global fetch when no implementation is supplied', async () => {
    globalFetch.mockResolvedValueOnce(Response.json(emptyRepos));
    const store = new GitStorage(options);

    expect((await store.listRepos()).repos).toEqual([]);
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps custom and default clients isolated at the same API URL', async () => {
    const firstFetch = vi.fn<typeof fetch>(async () =>
      Response.json(emptyRepos)
    );
    const secondFetch = vi.fn<typeof fetch>(async () =>
      Response.json(emptyRepos)
    );
    const defaultStore = new GitStorage(options);
    const first = new GitStorage({ ...options, fetch: firstFetch });
    const second = new GitStorage({ ...options, fetch: secondFetch });
    globalFetch.mockResolvedValueOnce(Response.json(emptyRepos));

    await first.listRepos();
    await second.listRepos();
    await first.listRepos();
    await defaultStore.listRepos();

    expect(firstFetch).toHaveBeenCalledTimes(2);
    expect(secondFetch).toHaveBeenCalledTimes(1);
    expect(globalFetch).toHaveBeenCalledTimes(1);
    expect(first.getConfig().fetch).toBe(firstFetch);
  });

  it.each(['factory', 'alias'] as const)(
    'supports the %s entry point without global fetch',
    async (entry) => {
      vi.stubGlobal('fetch', undefined);
      const customFetch = vi.fn<typeof fetch>(async () =>
        Response.json(emptyRepos)
      );
      const config = { ...options, fetch: customFetch };
      const store =
        entry === 'factory' ? createClient(config) : new CodeStorage(config);

      expect((await store.listRepos()).repos).toEqual([]);
      expect(customFetch).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['repo', 'createRepo', 'findOne'] as const)(
    'passes fetch to handles from %s',
    async (method) => {
      const customFetch = vi.fn<typeof fetch>();
      const store = new GitStorage({ ...options, fetch: customFetch });
      customFetch.mockResolvedValueOnce(Response.json({ repo_id: 'repo-id' }));
      const repo =
        method === 'repo'
          ? store.repo({ id: 'repo-id' })
          : await store[method]({ id: 'repo-id' });
      customFetch.mockReset();
      customFetch.mockResolvedValueOnce(
        Response.json({ paths: ['hello.txt'], ref: 'main' })
      );

      expect((await repo!.listFiles()).paths).toEqual(['hello.txt']);
      const [url, init] = customFetch.mock.calls[0];
      expect(String(url)).toContain('/api/repos/repo-id/files');
      expect(init?.method).toBe('GET');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer test-token'
      );
      expect(globalFetch).not.toHaveBeenCalled();
    }
  );

  it.each(['file', 'archive'] as const)(
    'returns the custom fetch %s response stream unchanged',
    async (kind) => {
      const response = new Response('stream contents');
      const customFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
      const repo = new GitStorage({ ...options, fetch: customFetch }).repo({
        id: 'repo-id',
      });

      const result =
        kind === 'file'
          ? await repo.getFileStream({ path: 'hello.txt' })
          : await repo.getArchiveStream();

      expect(result).toBe(response);
      expect(await result.text()).toBe('stream contents');
      expect(globalFetch).not.toHaveBeenCalled();
    }
  );

  it.each(['commit-pack', 'diff-commit'] as const)(
    'passes streaming %s uploads and abort signals to custom fetch',
    async (endpoint) => {
      const signal = new AbortController().signal;
      const customFetch = vi.fn<typeof fetch>(async (url, init) => {
        expect(url).toBe(`${options.apiBaseUrl}/api/repos/repo-id/${endpoint}`);
        expect(init?.method).toBe('POST');
        expect(init?.signal).toBe(signal);
        expect((init as RequestInit & { duplex: string }).duplex).toBe('half');
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer test-token');
        expect(headers.get('Content-Type')).toBe('application/x-ndjson');
        expect(headers.get('Code-Storage-Agent')).toContain(
          'code-storage-sdk/'
        );
        const body = await new Response(init?.body).text();
        const frames = body
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        expect(frames[0].metadata.commit_message).toBe('Custom transport');
        const chunk =
          endpoint === 'commit-pack'
            ? frames[1].blob_chunk
            : frames[1].diff_chunk;
        expect(Buffer.from(chunk.data, 'base64').toString()).toBe(
          'test content'
        );
        return Response.json({
          commit: {
            commit_sha: 'abc123',
            tree_sha: 'def456',
            target_branch: 'main',
            pack_bytes: 42,
            blob_count: 1,
          },
          result: {
            branch: 'main',
            old_sha: '',
            new_sha: 'abc123',
            success: true,
            status: 'ok',
          },
        });
      });
      const repo = new GitStorage({ ...options, fetch: customFetch }).repo({
        id: 'repo-id',
      });
      const commitOptions = {
        targetBranch: 'main',
        commitMessage: 'Custom transport',
        author: { name: 'Test', email: 'test@example.com' },
        signal,
      };

      const result =
        endpoint === 'commit-pack'
          ? await repo
              .createCommit(commitOptions)
              .addFile('hello.txt', 'test content')
              .send()
          : await repo.createCommitFromDiff({
              ...commitOptions,
              diff: 'test content',
            });

      expect(result.commitSha).toBe('abc123');
      expect(customFetch).toHaveBeenCalledTimes(1);
      expect(globalFetch).not.toHaveBeenCalled();
    }
  );

  it('lets a caller retry a response before SDK error handling', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(Response.json(emptyRepos));
    const retryFetch: typeof fetch = async (input, init) => {
      const response = await transport(input, init);
      if (response.status === 503 && init?.method === 'GET') {
        await response.body?.cancel();
        return transport(input, init);
      }
      return response;
    };
    const store = new GitStorage({ ...options, fetch: retryFetch });

    expect((await store.listRepos()).repos).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('preserves HTTP errors without adding automatic retries', async () => {
    const customFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: 'Unavailable' }, { status: 503 })
      );
    const store = new GitStorage({ ...options, fetch: customFetch });

    await expect(store.listRepos()).rejects.toMatchObject({
      name: ApiError.name,
      status: 503,
      message: 'Unavailable',
    });
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it('propagates custom fetch rejections unchanged', async () => {
    const error = new Error('Transport failed');
    const customFetch = vi.fn<typeof fetch>().mockRejectedValueOnce(error);
    const store = new GitStorage({ ...options, fetch: customFetch });

    await expect(store.listRepos()).rejects.toBe(error);
    expect(customFetch).toHaveBeenCalledTimes(1);
  });
});
