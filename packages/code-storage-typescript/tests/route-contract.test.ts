import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitStorage } from '../src/index';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

type RouteCase = {
  name: string;
  method: string;
  path: string;
  invoke: () => Promise<unknown>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  noBody?: boolean;
};

describe('preferred REST route contract', () => {
  const store = new GitStorage({
    name: 'route-contract',
    token: 'test-token',
    apiBaseUrl: 'https://api.example.test',
  });
  const repo = store.repo({ id: 'owner/name' });
  const signature = { name: 'Route Test', email: 'route@example.test' };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  const cases: RouteCase[] = [
    {
      name: 'createRepo',
      method: 'POST',
      path: '/api/repos',
      invoke: () => store.createRepo({ id: 'owner/name' }),
    },
    {
      name: 'listRepos',
      method: 'GET',
      path: '/api/repos',
      invoke: () => store.listRepos(),
    },
    {
      name: 'findOne',
      method: 'GET',
      path: '/api/repos/owner%2Fname',
      invoke: () => store.findOne({ id: 'owner/name' }),
    },
    {
      name: 'deleteRepo',
      method: 'DELETE',
      path: '/api/repos/owner%2Fname',
      invoke: () => store.deleteRepo({ id: 'owner/name' }),
    },
    {
      name: 'createGitCredential',
      method: 'POST',
      path: '/api/repos/owner%2Fname/git-credentials',
      invoke: () =>
        store.createGitCredential({ repoName: 'owner/name', password: 'secret' }),
    },
    {
      name: 'updateGitCredential',
      method: 'PUT',
      path: '/api/repos/owner%2Fname/git-credentials/credential%2Fid',
      invoke: () =>
        store.updateGitCredential({
          repoName: 'owner/name',
          id: 'credential/id',
          password: 'secret',
        }),
    },
    {
      name: 'deleteGitCredential',
      method: 'DELETE',
      path: '/api/repos/owner%2Fname/git-credentials/credential%2Fid',
      invoke: () =>
        store.deleteGitCredential({
          repoName: 'owner/name',
          id: 'credential/id',
        }),
      noBody: true,
    },
    {
      name: 'getFileStream',
      method: 'GET',
      path: '/api/repos/owner%2Fname/file',
      invoke: () => repo.getFileStream({ path: 'README.md' }),
    },
    {
      name: 'headFile',
      method: 'HEAD',
      path: '/api/repos/owner%2Fname/file',
      invoke: () => repo.headFile({ path: 'README.md' }),
    },
    {
      name: 'getArchiveStream',
      method: 'POST',
      path: '/api/repos/owner%2Fname/archive',
      invoke: () => repo.getArchiveStream(),
    },
    {
      name: 'listFiles',
      method: 'GET',
      path: '/api/repos/owner%2Fname/files',
      invoke: () => repo.listFiles(),
    },
    {
      name: 'listFilesWithMetadata',
      method: 'GET',
      path: '/api/repos/owner%2Fname/files/metadata',
      invoke: () => repo.listFilesWithMetadata(),
    },
    {
      name: 'listBranches',
      method: 'GET',
      path: '/api/repos/owner%2Fname/branches',
      invoke: () => repo.listBranches(),
    },
    {
      name: 'listTags',
      method: 'GET',
      path: '/api/repos/owner%2Fname/tags',
      invoke: () => repo.listTags(),
    },
    {
      name: 'listCommits',
      method: 'GET',
      path: '/api/repos/owner%2Fname/commits',
      invoke: () => repo.listCommits(),
    },
    {
      name: 'getCommit',
      method: 'GET',
      path: '/api/repos/owner%2Fname/commit',
      invoke: () => repo.getCommit({ ref: 'main' }),
    },
    {
      name: 'getBlame',
      method: 'GET',
      path: '/api/repos/owner%2Fname/blame',
      invoke: () => repo.getBlame({ path: 'README.md' }),
    },
    {
      name: 'getNote',
      method: 'GET',
      path: '/api/repos/owner%2Fname/notes',
      invoke: () => repo.getNote({ objectRef: 'main' }),
    },
    {
      name: 'createNote',
      method: 'POST',
      path: '/api/repos/owner%2Fname/notes',
      invoke: () => repo.createNote({ objectRef: 'main', note: 'note' }),
    },
    {
      name: 'appendNote',
      method: 'POST',
      path: '/api/repos/owner%2Fname/notes',
      invoke: () => repo.appendNote({ objectRef: 'main', note: 'note' }),
    },
    {
      name: 'deleteNote',
      method: 'DELETE',
      path: '/api/repos/owner%2Fname/notes',
      invoke: () => repo.deleteNote({ objectRef: 'main' }),
    },
    {
      name: 'listNotesRefs',
      method: 'GET',
      path: '/api/repos/owner%2Fname/notes/refs',
      invoke: () => repo.listNotesRefs(),
    },
    {
      name: 'getBranchDiff',
      method: 'GET',
      path: '/api/repos/owner%2Fname/branches/diff',
      query: { branch: 'feature', base: 'main' },
      invoke: () => repo.getBranchDiff({ branch: 'feature', base: 'main' }),
    },
    {
      name: 'getCommitDiff',
      method: 'GET',
      path: '/api/repos/owner%2Fname/diff',
      invoke: () => repo.getCommitDiff({ ref: 'main' }),
    },
    {
      name: 'grep',
      method: 'POST',
      path: '/api/repos/owner%2Fname/grep',
      invoke: () => repo.grep({ query: { pattern: 'TODO' } }),
    },
    {
      name: 'pullUpstream',
      method: 'POST',
      path: '/api/repos/owner%2Fname/pull-upstream',
      body: { ref: 'main' },
      invoke: () => repo.pullUpstream({ ref: 'main' }),
    },
    {
      name: 'createBranch',
      method: 'POST',
      path: '/api/repos/owner%2Fname/branches/create',
      invoke: () => repo.createBranch({ baseRef: 'main', targetBranch: 'next' }),
    },
    {
      name: 'deleteBranch',
      method: 'DELETE',
      path: '/api/repos/owner%2Fname/branches',
      invoke: () => repo.deleteBranch({ targetBranch: 'next' }),
    },
    {
      name: 'previewMerge',
      method: 'GET',
      path: '/api/repos/owner%2Fname/merge/preview',
      invoke: () =>
        repo.previewMerge({ sourceBranch: 'feature', targetBranch: 'main' }),
    },
    {
      name: 'merge',
      method: 'POST',
      path: '/api/repos/owner%2Fname/merge',
      invoke: () =>
        repo.merge({
          sourceRef: 'feature',
          targetBranch: 'main',
          strategy: 'ff_only',
        }),
    },
    {
      name: 'createTag',
      method: 'POST',
      path: '/api/repos/owner%2Fname/tags',
      invoke: () => repo.createTag({ name: 'v1', ref: 'main' }),
    },
    {
      name: 'deleteTag',
      method: 'DELETE',
      path: '/api/repos/owner%2Fname/tags/release%2Fv1',
      invoke: () => repo.deleteTag({ name: 'release/v1' }),
      noBody: true,
    },
    {
      name: 'restoreCommit',
      method: 'POST',
      path: '/api/repos/owner%2Fname/restore-commit',
      invoke: () =>
        repo.restoreCommit({
          targetBranch: 'main',
          baseRef: 'HEAD~1',
          author: signature,
        }),
    },
    {
      name: 'createCommit',
      method: 'POST',
      path: '/api/repos/owner%2Fname/commit-pack',
      invoke: () =>
        repo
          .createCommit({
            targetBranch: 'main',
            commitMessage: 'test route',
            author: signature,
          })
          .addFileFromString('README.md', 'content')
          .send(),
    },
    {
      name: 'createCommitFromDiff',
      method: 'POST',
      path: '/api/repos/owner%2Fname/diff-commit',
      invoke: () =>
        repo.createCommitFromDiff({
          targetBranch: 'main',
          commitMessage: 'test route',
          author: signature,
          diff: 'diff --git a/README.md b/README.md',
        }),
    },
  ];

  it.each(cases)('$name uses $method $path', async (testCase) => {
    let captured: { url: URL; init?: RequestInit } | undefined;
    mockFetch.mockImplementationOnce(
      async (input: string | URL | Request, init?: RequestInit) => {
        captured = { url: new URL(String(input)), init };
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    try {
      await testCase.invoke();
    } catch {
      // Most response schemas reject the generic body after the request is sent.
    }

    expect(captured, `${testCase.name} did not send a request`).toBeDefined();
    expect(captured!.init?.method ?? 'GET').toBe(testCase.method);
    expect(captured!.url.pathname).toBe(testCase.path);
    for (const [name, value] of Object.entries(testCase.query ?? {})) {
      expect(captured!.url.searchParams.get(name)).toBe(value);
    }
    if (testCase.body) {
      expect(JSON.parse(String(captured!.init?.body))).toMatchObject(testCase.body);
    }
    if (testCase.noBody) {
      expect(captured!.init?.body).toBeUndefined();
    }
  });
});
