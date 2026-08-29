# Release notes

## Unreleased

### Preferred REST routes

- Changed preferred SDK calls to use the unversioned `/api` collection and
  repository-scoped `/api/repos/{repo_name}/*` routes.
- Added `repoName`, `repo_name`, and `RepoName` options to Git credential
  methods. Preferred requests omit legacy identifier fields from their bodies.
- Kept create-only `repoId`, `repo_id`, and `RepoID` options as deprecated
  internal repository IDs. These calls keep their exact `/api/v1` request.
- Kept update and delete calls without a repository name compatible with their
  exact old request. Preferred create input wins when callers pass both names.
- Deprecated `apiVersion`, `api_version`, and `APIVersion`. These options remain
  accepted but no longer control preferred request routes.
- Repository and credential names are encoded as one path segment. JWT `repo`
  claims keep the raw repository name.

### Standard API vocabulary

- Added preferred revision and ref names across the TypeScript, Python, and Go
  SDKs. Requests now send only the standard HTTP fields.
- Added `repo_name`, diff `base_sha`, branch `target_branch`, merge source `ref`,
  note `notes_ref`, and ref-update `target_branch` results.
- Kept the old public fields as deprecated aliases. Python emits
  `DeprecationWarning`; TypeScript and Go mark the fields in API documentation.
  Preferred values win when callers or responses contain both forms.
- Kept parsers compatible with clusters that still return the old response
  fields. A later major release can remove the deprecated public aliases.
