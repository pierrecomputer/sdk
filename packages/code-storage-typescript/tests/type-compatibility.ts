import {
  type CreateCommitRefOptions,
  type CreateGitCredentialOptions,
  type GitStorage,
  type LegacyCreateCommitOptions,
  type Repo,
} from '../src/index';

interface ExtendedLegacyCredentialOptions extends CreateGitCredentialOptions {
  auditLabel: string;
}

interface ExtendedTargetRefOptions extends CreateCommitRefOptions {
  auditLabel: string;
}

export function exerciseCredentialOptionCompatibility(client: GitStorage): void {
  const legacyOptions: ExtendedLegacyCredentialOptions = {
    repoId: 'internal-repository-id',
    password: 'token',
    auditLabel: 'legacy-call',
  };

  void client.createGitCredential(legacyOptions);
  void client.createGitCredential({
    repoName: 'team/project',
    password: 'token',
  });
}

export function exerciseTargetRefCompatibility(repo: Repo): void {
  const targetRefOptions: ExtendedTargetRefOptions = {
    targetRef: 'refs/heads/main',
    commitMessage: 'Update docs',
    author: { name: 'Docs Bot', email: 'docs@example.com' },
    auditLabel: 'supported-target-ref',
  };
  const publishedType: LegacyCreateCommitOptions = targetRefOptions;

  repo.createCommit(targetRefOptions);
  repo.createCommit(publishedType);
}
