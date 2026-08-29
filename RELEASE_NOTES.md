# Release notes

## Unreleased

### Ephemeral merge previews

- Added source and target ephemeral namespace flags to merge previews in the TypeScript, Python, and Go SDKs.
- Kept both flags optional. Existing calls omit both query parameters.

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
