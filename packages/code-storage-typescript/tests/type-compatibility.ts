import {
  type CreateGitCredentialOptions,
  type GitStorage,
} from '../src/index';

interface ExtendedLegacyCredentialOptions extends CreateGitCredentialOptions {
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
