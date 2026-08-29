import {
  type CreateCommitRefOptions,
  type LegacyCreateCommitOptions,
  type Repo,
} from '../src/index';

interface ExtendedTargetRefOptions extends CreateCommitRefOptions {
  auditLabel: string;
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
