#!/usr/bin/env node
// Bin entry for the Git credential helper. This module is never imported —
// it runs unconditionally; the implementation lives in credential-helper.ts.
import { runGitCredentialCodeStorage } from './credential-helper';

runGitCredentialCodeStorage(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`git-credential-code-storage: ${message}`);
    process.exitCode = 1;
  });
