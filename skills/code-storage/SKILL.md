---
name: code-storage
description: Use when you work with Code Storage (code.storage) through its HTTP API, SDKs, or CLI. This skill is replaced by the `pierre` and `pierre-migrate` skills, and it tells you how to install them.
---

# Code Storage

The `pierre` and `pierre-migrate` skills replace this skill.
Install them:

```sh
npx skills add pierrecomputer/skills
```

- `pierre`: use the Code Storage HTTP API, the SDKs, and the `pierre` CLI. The SDKs are `@pierre/sdk` (TypeScript), `pierre-sdk` (Python), and `github.com/pierrecomputer/sdk/go` (Go).
- `pierre-migrate`: move code from the earlier SDKs (`@pierre/storage`, `pierre-storage`, and `code-storage-go`) and from deprecated HTTP routes to the current SDKs and routes.

Then remove this skill:

```sh
npx skills remove code-storage
```

Until you install them, read the docs index: `https://code.storage/docs/llms.txt`.
Pages accept a `.md` suffix, for example `https://code.storage/docs/sdks/typescript.md`.
The pages of the earlier SDKs start at `https://code.storage/docs/sdk/overview.md`.
