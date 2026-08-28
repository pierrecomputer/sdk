import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitStorage } from '../src/index';

type MockFetch = ReturnType<typeof vi.fn>;

const mockFetch = vi.fn() as MockFetch;
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRepo() {
  const store = new GitStorage({ name: 'v0', token: 'header.payload.signature' });
  return store.repo({ id: 'repo' });
}

function commitInfo() {
  return {
    sha: 'subject-sha',
    parent_shas: [],
    message: 'message',
    author_name: 'Author',
    author_email: 'author@example.com',
    committer_name: 'Committer',
    committer_email: 'committer@example.com',
    date: '2026-08-28T00:00:00Z',
  };
}

function diffResponse(extra: Record<string, unknown> = {}) {
  return {
    sha: 'subject-sha',
    stats: { files: 0, additions: 0, deletions: 0, changes: 0 },
    files: [],
    filtered_files: [],
    ...extra,
  };
}

function mergeResponse(source: Record<string, unknown>) {
  return {
    result: 'fast_forward',
    commit_sha: 'new-sha',
    tree_sha: 'tree-sha',
    source: { ...source, ephemeral: false, sha: 'source-sha' },
    target: {
      branch: 'main',
      ephemeral: false,
      old_sha: 'old-sha',
      new_sha: 'new-sha',
    },
    promoted_commits: 1,
  };
}

function noteResponse(refs: Record<string, unknown>) {
  return {
    sha: 'object-sha',
    ...refs,
    new_ref_sha: 'notes-sha',
    result: { success: true, status: 'ok' },
  };
}

function commitResponse(branches: Record<string, unknown>) {
  return {
    commit: {
      commit_sha: 'new-sha',
      tree_sha: 'tree-sha',
      target_branch: 'main',
      pack_bytes: 1,
      blob_count: 0,
    },
    result: {
      ...branches,
      old_sha: 'old-sha',
      new_sha: 'new-sha',
      success: true,
      status: 'ok',
    },
  };
}

async function readRequestBody(body: unknown): Promise<string> {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (
    typeof body === 'object' &&
    body !== null &&
    'getReader' in body
  ) {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(result);
  }
  return '';
}

describe('standard API vocabulary', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends ref for getCommit and prefers it to sha', async () => {
    mockFetch.mockImplementationOnce((url) => {
      const params = new URL(String(url)).searchParams;
      expect(params.get('ref')).toBe('preferred');
      expect(params.has('sha')).toBe(false);
      return Promise.resolve(jsonResponse({ commit: commitInfo() }));
    });

    await makeRepo().getCommit({ ref: 'preferred', sha: 'legacy' });
  });

  it('sends ref for listCommits and prefers it to branch', async () => {
    mockFetch.mockImplementationOnce((url) => {
      const params = new URL(String(url)).searchParams;
      expect(params.get('ref')).toBe('preferred');
      expect(params.has('branch')).toBe(false);
      return Promise.resolve(
        jsonResponse({ commits: [], has_more: false })
      );
    });

    await makeRepo().listCommits({ ref: 'preferred', branch: 'legacy' });
  });

  it('sends standard commit diff query names', async () => {
    mockFetch.mockImplementationOnce((url) => {
      const params = new URL(String(url)).searchParams;
      expect(params.get('ref')).toBe('preferred');
      expect(params.get('base_ref')).toBe('preferred-base');
      expect(params.get('ref_is_ephemeral')).toBe('false');
      expect(params.get('base_is_ephemeral')).toBe('false');
      expect(params.get('git_apply_compatible')).toBe('true');
      expect(params.has('sha')).toBe(false);
      expect(params.has('baseSha')).toBe(false);
      expect(params.has('gitApplyCompatible')).toBe(false);
      return Promise.resolve(jsonResponse(diffResponse({ base_sha: 'base-sha' })));
    });

    await makeRepo().getCommitDiff({
      ref: 'preferred',
      sha: 'legacy',
      baseRef: 'preferred-base',
      baseSha: 'legacy-base',
      refIsEphemeral: false,
      baseIsEphemeral: false,
      gitApplyCompatible: true,
    });
  });

  it('sends source_ref for merge and prefers it to sourceBranch', async () => {
    mockFetch.mockImplementationOnce((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.source_ref).toBe('preferred');
      expect(body).not.toHaveProperty('source_branch');
      return Promise.resolve(jsonResponse(mergeResponse({ ref: 'preferred' })));
    });

    await makeRepo().merge({
      sourceRef: 'preferred',
      sourceBranch: 'legacy',
      targetBranch: 'main',
      strategy: 'ff_only',
    });
  });

  it('sends ref for createTag and prefers it to target', async () => {
    mockFetch.mockImplementationOnce((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.ref).toBe('preferred');
      expect(body).not.toHaveProperty('target');
      return Promise.resolve(
        jsonResponse({ name: 'v1', sha: 'tag-sha', message: 'created' })
      );
    });

    await makeRepo().createTag({ name: 'v1', ref: 'preferred', target: 'legacy' });
  });

  it('sends target_branch for deleteBranch and prefers it to name', async () => {
    mockFetch.mockImplementationOnce((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.target_branch).toBe('preferred');
      expect(body).not.toHaveProperty('name');
      return Promise.resolve(
        jsonResponse({ target_branch: 'preferred', ephemeral: false, message: 'deleted' })
      );
    });

    await makeRepo().deleteBranch({ targetBranch: 'preferred', name: 'legacy' });
  });

  it('sends standard note query names and prefers them to aliases', async () => {
    mockFetch.mockImplementationOnce((url) => {
      const params = new URL(String(url)).searchParams;
      expect(params.get('object_ref')).toBe('preferred-object');
      expect(params.get('notes_ref')).toBe('preferred-notes');
      expect(params.has('sha')).toBe(false);
      expect(params.has('ref')).toBe(false);
      return Promise.resolve(
        jsonResponse({ sha: 'object-sha', note: 'note', ref_sha: 'notes-sha' })
      );
    });

    await makeRepo().getNote({
      objectRef: 'preferred-object',
      sha: 'legacy-object',
      notesRef: 'preferred-notes',
      ref: 'legacy-notes',
    });
  });

  it('sends standard note write fields and prefers them to aliases', async () => {
    mockFetch.mockImplementationOnce((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.object_ref).toBe('preferred-object');
      expect(body.notes_ref).toBe('preferred-notes');
      expect(body.expected_notes_ref_sha).toBe('preferred-guard');
      expect(body).not.toHaveProperty('sha');
      expect(body).not.toHaveProperty('ref');
      expect(body).not.toHaveProperty('expected_ref_sha');
      return Promise.resolve(
        jsonResponse(noteResponse({ notes_ref: 'preferred-notes' }))
      );
    });

    await makeRepo().createNote({
      objectRef: 'preferred-object',
      sha: 'legacy-object',
      note: 'note',
      notesRef: 'preferred-notes',
      ref: 'legacy-notes',
      expectedNotesRefSha: 'preferred-guard',
      expectedRefSha: 'legacy-guard',
    });
  });

  it('sends standard restore fields and prefers them to aliases', async () => {
    mockFetch.mockImplementationOnce((_url, init) => {
      const body = JSON.parse(String(init?.body)).metadata;
      expect(body.base_ref).toBe('preferred-base');
      expect(body.expected_target_sha).toBe('preferred-guard');
      expect(body).not.toHaveProperty('target_commit_sha');
      expect(body).not.toHaveProperty('expected_head_sha');
      return Promise.resolve(jsonResponse(commitResponse({ target_branch: 'main' })));
    });

    await makeRepo().restoreCommit({
      targetBranch: 'main',
      baseRef: 'preferred-base',
      targetCommitSha: 'legacy-base',
      expectedTargetSha: 'preferred-guard',
      expectedHeadSha: 'legacy-guard',
      author: { name: 'Author', email: 'author@example.com' },
    });
  });

  it('sends standard fields for createCommit and prefers explicit false', async () => {
    mockFetch.mockImplementationOnce(async (_url, init) => {
      const line = (await readRequestBody(init?.body)).trim().split('\n')[0];
      const metadata = JSON.parse(line).metadata;
      expect(metadata.expected_target_sha).toBe('preferred-guard');
      expect(metadata.target_is_ephemeral).toBe(false);
      expect(metadata.base_is_ephemeral).toBe(false);
      expect(metadata).not.toHaveProperty('expected_head_sha');
      expect(metadata).not.toHaveProperty('ephemeral');
      expect(metadata).not.toHaveProperty('ephemeral_base');
      return jsonResponse(commitResponse({ target_branch: 'main' }));
    });

    await makeRepo()
      .createCommit({
        targetBranch: 'main',
        commitMessage: 'message',
        expectedTargetSha: 'preferred-guard',
        expectedHeadSha: 'legacy-guard',
        targetIsEphemeral: false,
        ephemeral: true,
        baseBranch: 'base',
        baseIsEphemeral: false,
        ephemeralBase: true,
        author: { name: 'Author', email: 'author@example.com' },
      })
      .send();
  });

  it('sends standard fields for createCommitFromDiff', async () => {
    mockFetch.mockImplementationOnce(async (_url, init) => {
      const line = (await readRequestBody(init?.body)).trim().split('\n')[0];
      const metadata = JSON.parse(line).metadata;
      expect(metadata.expected_target_sha).toBe('preferred-guard');
      expect(metadata.target_is_ephemeral).toBe(false);
      expect(metadata.base_is_ephemeral).toBe(false);
      expect(metadata).not.toHaveProperty('expected_head_sha');
      expect(metadata).not.toHaveProperty('ephemeral');
      expect(metadata).not.toHaveProperty('ephemeral_base');
      return jsonResponse(commitResponse({ target_branch: 'main' }));
    });

    await makeRepo().createCommitFromDiff({
      targetBranch: 'main',
      commitMessage: 'message',
      diff: '',
      expectedTargetSha: 'preferred-guard',
      expectedHeadSha: 'legacy-guard',
      targetIsEphemeral: false,
      ephemeral: true,
      baseBranch: 'base',
      baseIsEphemeral: false,
      ephemeralBase: true,
      author: { name: 'Author', email: 'author@example.com' },
    });
  });

  it('parses standard-only response fields and populates deprecated aliases', async () => {
    const repo = makeRepo();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        repos: [{
          repo_id: 'repo-id',
          repo_name: 'preferred-repo',
          default_branch: 'main',
          created_at: '2026-08-28T00:00:00Z',
        }],
        has_more: false,
      })
    );
    const store = new GitStorage({ name: 'v0', token: 'header.payload.signature' });
    const repos = await store.listRepos();
    expect(repos.repos[0].repoName).toBe('preferred-repo');
    expect(repos.repos[0].url).toBe('preferred-repo');

    mockFetch.mockResolvedValueOnce(jsonResponse(diffResponse({ base_sha: 'base-sha' })));
    expect((await repo.getCommitDiff({ ref: 'main' })).baseSha).toBe('base-sha');

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ target_branch: 'preferred-branch', ephemeral: false, message: 'deleted' })
    );
    const deleted = await repo.deleteBranch({ targetBranch: 'preferred-branch' });
    expect(deleted.targetBranch).toBe('preferred-branch');
    expect(deleted.name).toBe('preferred-branch');

    mockFetch.mockResolvedValueOnce(jsonResponse(commitResponse({ target_branch: 'preferred-branch' })));
    const committed = await repo.createCommitFromDiff({
      targetBranch: 'main',
      commitMessage: 'message',
      diff: '',
      author: { name: 'Author', email: 'author@example.com' },
    });
    expect(committed.refUpdate.targetBranch).toBe('preferred-branch');
    expect(committed.refUpdate.branch).toBe('preferred-branch');

    mockFetch.mockResolvedValueOnce(jsonResponse(mergeResponse({ ref: 'preferred-source' })));
    const merged = await repo.merge({ sourceRef: 'source', targetBranch: 'main', strategy: 'ff_only' });
    expect(merged.source.ref).toBe('preferred-source');
    expect(merged.source.branch).toBe('preferred-source');

    mockFetch.mockResolvedValueOnce(jsonResponse(noteResponse({ notes_ref: 'preferred-notes' })));
    const note = await repo.createNote({ objectRef: 'object', note: 'note' });
    expect(note.notesRef).toBe('preferred-notes');
    expect(note.targetRef).toBe('preferred-notes');
  });

  it('accepts deprecated-only response fields', async () => {
    const repo = makeRepo();
    const store = new GitStorage({ name: 'v0', token: 'header.payload.signature' });

    mockFetch.mockResolvedValueOnce(jsonResponse({
      repos: [{ repo_id: 'repo-id', url: 'legacy-repo', default_branch: 'main', created_at: '' }],
      has_more: false,
    }));
    expect((await store.listRepos()).repos[0].repoName).toBe('legacy-repo');

    mockFetch.mockResolvedValueOnce(jsonResponse({ name: 'legacy-branch', ephemeral: false, message: 'deleted' }));
    expect((await repo.deleteBranch({ targetBranch: 'main' })).targetBranch).toBe('legacy-branch');

    mockFetch.mockResolvedValueOnce(jsonResponse(commitResponse({ branch: 'legacy-branch' })));
    expect((await repo.createCommitFromDiff({
      targetBranch: 'main', commitMessage: 'message', diff: '',
      author: { name: 'Author', email: 'author@example.com' },
    })).refUpdate.targetBranch).toBe('legacy-branch');

    mockFetch.mockResolvedValueOnce(jsonResponse(mergeResponse({ branch: 'legacy-source' })));
    expect((await repo.merge({ sourceRef: 'source', targetBranch: 'main', strategy: 'ff_only' })).source.ref).toBe('legacy-source');

    mockFetch.mockResolvedValueOnce(jsonResponse(noteResponse({ target_ref: 'legacy-notes' })));
    expect((await repo.createNote({ objectRef: 'object', note: 'note' })).notesRef).toBe('legacy-notes');
  });

  it('prefers standard response fields when both names differ', async () => {
    const repo = makeRepo();
    const store = new GitStorage({ name: 'v0', token: 'header.payload.signature' });

    mockFetch.mockResolvedValueOnce(jsonResponse({
      repos: [{ repo_id: 'repo-id', repo_name: 'preferred-repo', url: 'legacy-repo', default_branch: 'main', created_at: '' }],
      has_more: false,
    }));
    const listed = (await store.listRepos()).repos[0];
    expect([listed.repoName, listed.url]).toEqual(['preferred-repo', 'preferred-repo']);

    mockFetch.mockResolvedValueOnce(jsonResponse({ target_branch: 'preferred-branch', name: 'legacy-branch', ephemeral: false, message: 'deleted' }));
    const deleted = await repo.deleteBranch({ targetBranch: 'main' });
    expect([deleted.targetBranch, deleted.name]).toEqual(['preferred-branch', 'preferred-branch']);

    mockFetch.mockResolvedValueOnce(jsonResponse(commitResponse({ target_branch: 'preferred-branch', branch: 'legacy-branch' })));
    const committed = await repo.createCommitFromDiff({
      targetBranch: 'main', commitMessage: 'message', diff: '',
      author: { name: 'Author', email: 'author@example.com' },
    });
    expect([committed.refUpdate.targetBranch, committed.refUpdate.branch]).toEqual(['preferred-branch', 'preferred-branch']);

    mockFetch.mockResolvedValueOnce(jsonResponse(mergeResponse({ ref: 'preferred-source', branch: 'legacy-source' })));
    const merged = await repo.merge({ sourceRef: 'source', targetBranch: 'main', strategy: 'ff_only' });
    expect([merged.source.ref, merged.source.branch]).toEqual(['preferred-source', 'preferred-source']);

    mockFetch.mockResolvedValueOnce(jsonResponse(noteResponse({ notes_ref: 'preferred-notes', target_ref: 'legacy-notes' })));
    const note = await repo.createNote({ objectRef: 'object', note: 'note' });
    expect([note.notesRef, note.targetRef]).toEqual(['preferred-notes', 'preferred-notes']);
  });
});
