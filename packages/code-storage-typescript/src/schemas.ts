import { z } from 'zod';

export const treeEntryTypeSchema = z.enum([
  'blob',
  'tree',
  'symlink',
  'submodule',
]);

export const treeEntryRawSchema = z.object({
  path: z.string(),
  type: treeEntryTypeSchema,
  mode: z.string(),
});

export const listFilesResponseSchema = z.object({
  paths: z.array(z.string()),
  ref: z.string(),
  entries: z.array(treeEntryRawSchema).optional(),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean().optional(),
});

export const fileWithMetadataRawSchema = z.object({
  path: z.string(),
  mode: z.string(),
  size: z.number(),
  last_commit_sha: z.string(),
  type: treeEntryTypeSchema.optional(),
});

export const commitMetadataRawSchema = z.object({
  author: z.string(),
  date: z.string(),
  message: z.string(),
});

export const listFilesWithMetadataResponseSchema = z.object({
  files: z.array(fileWithMetadataRawSchema),
  commits: z.record(commitMetadataRawSchema),
  ref: z.string(),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean().optional(),
});

export const branchInfoSchema = z.object({
  cursor: z.string(),
  name: z.string(),
  head_sha: z.string(),
  created_at: z.string(),
});

export const listBranchesResponseSchema = z.object({
  branches: z.array(branchInfoSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const commitInfoRawSchema = z.object({
  sha: z.string(),
  parent_shas: z.array(z.string()),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  date: z.string(),
});

export const listCommitsResponseSchema = z.object({
  commits: z.array(commitInfoRawSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const commitInfoWithSignatureRawSchema = commitInfoRawSchema.extend({
  signature: z.string().optional(),
  payload: z.string().optional(),
});

export const getCommitResponseSchema = z.object({
  commit: commitInfoWithSignatureRawSchema,
});

export const blameLineRawSchema = z.object({
  line_number: z.number(),
  commit_sha: z.string(),
  original_line_number: z.number(),
  original_path: z.string(),
  previous_commit_sha: z.string().optional(),
  author_name: z.string(),
  author_email: z.string(),
  author_time: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  committer_time: z.string(),
  summary: z.string(),
});

export const blameResponseSchema = z.object({
  ref: z.string(),
  path: z.string(),
  commit_sha: z.string(),
  lines: z.array(blameLineRawSchema),
});

export const repoBaseInfoSchema = z.object({
  provider: z.string(),
  owner: z.string(),
  name: z.string(),
});

export const repoInfoSchema = z.object({
  repo_id: z.string(),
  url: z.string(),
  default_branch: z.string(),
  created_at: z.string(),
  base_repo: repoBaseInfoSchema.optional().nullable(),
});

export const listReposResponseSchema = z.object({
  repos: z.array(repoInfoSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const updateRepoResponseSchema = z.object({
  repo_name: z.string(),
  default_branch: z.string(),
});

export const deploymentTargetSchema = z.enum(['preview', 'production']);

export const deploymentResponseSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  target: deploymentTargetSchema,
  ref: z.string(),
  commit_sha: z.string(),
  // Tolerate statuses this SDK version does not know about yet.
  status: z.string(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listDeploymentsResponseSchema = z.object({
  deployments: z.array(deploymentResponseSchema),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export const noteReadResponseSchema = z.object({
  sha: z.string(),
  note: z.string(),
  ref_sha: z.string(),
});

export const noteResultSchema = z.object({
  success: z.boolean(),
  status: z.string(),
  message: z.string().optional(),
});

export const noteWriteResponseSchema = z.object({
  sha: z.string(),
  target_ref: z.string(),
  base_commit: z.string().optional(),
  new_ref_sha: z.string(),
  result: noteResultSchema,
});

export const notesRefInfoSchema = z.object({
  cursor: z.string(),
  ref: z.string(),
  sha: z.string(),
});

export const listNotesRefsResponseSchema = z.object({
  refs: z.array(notesRefInfoSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
  prefix: z.string(),
});

export const diffStatsSchema = z.object({
  files: z.number(),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
});

export const diffFileRawSchema = z.object({
  path: z.string(),
  state: z.string(),
  old_path: z.string().nullable().optional(),
  raw: z.string(),
  bytes: z.number(),
  is_eof: z.boolean(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
});

export const filteredFileRawSchema = z.object({
  path: z.string(),
  state: z.string(),
  old_path: z.string().nullable().optional(),
  bytes: z.number(),
  is_eof: z.boolean(),
});

export const branchDiffResponseSchema = z.object({
  branch: z.string(),
  base: z.string(),
  stats: diffStatsSchema,
  files: z.array(diffFileRawSchema),
  filtered_files: z.array(filteredFileRawSchema),
});

export const commitDiffResponseSchema = z.object({
  sha: z.string(),
  stats: diffStatsSchema,
  files: z.array(diffFileRawSchema),
  filtered_files: z.array(filteredFileRawSchema),
});

export const createBranchResponseSchema = z.object({
  message: z.string(),
  target_branch: z.string(),
  target_is_ephemeral: z.boolean(),
  commit_sha: z.string().nullable().optional(),
});

export const mergeRefSchema = z.object({
  branch: z.string(),
  ephemeral: z.boolean(),
  sha: z.string(),
});

export const mergeTargetSchema = z.object({
  branch: z.string(),
  ephemeral: z.boolean(),
  old_sha: z.string(),
  new_sha: z.string(),
});

export const mergeResponseSchema = z.object({
  result: z.enum(['merge_commit', 'fast_forward', 'no_op', 'squash', 'unknown']),
  commit_sha: z.string(),
  tree_sha: z.string(),
  source: mergeRefSchema,
  target: mergeTargetSchema,
  merge_base_sha: z.string().optional(),
  promoted_commits: z.number(),
});

export const previewMergeBlobSchema = z.object({
  oid: z.string().optional(),
  content: z.string().optional(),
  truncated: z.boolean(),
  binary: z.boolean(),
});

export const previewMergeConflictSchema = z.object({
  path: z.string(),
  result: previewMergeBlobSchema,
  base: previewMergeBlobSchema,
  ours: previewMergeBlobSchema,
  theirs: previewMergeBlobSchema,
});

export const previewMergeFilteredConflictSchema = z.object({
  path: z.string(),
  reason: z.string(),
});

export const previewMergeResponseSchema = z.object({
  status: z.enum(['clean', 'conflicted']),
  result: z.enum(['merge_commit', 'fast_forward', 'no_op']),
  source_branch: z.string(),
  target_branch: z.string(),
  source_tip_sha: z.string(),
  target_tip_sha: z.string(),
  merge_base_sha: z.string().optional(),
  conflict_paths: z.array(z.string()).optional().default([]),
  conflicts: z.array(previewMergeConflictSchema).optional().default([]),
  filtered_conflicts: z.array(previewMergeFilteredConflictSchema).optional().default([]),
});

export const tagInfoSchema = z.object({
  cursor: z.string(),
  name: z.string(),
  sha: z.string(),
});

export const listTagsResponseSchema = z.object({
  tags: z.array(tagInfoSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const createTagResponseSchema = z.object({
  name: z.string(),
  sha: z.string(),
  message: z.string(),
});

export const deleteTagResponseSchema = z.object({
  name: z.string(),
  message: z.string(),
});

export const deleteBranchResponseSchema = z.object({
  name: z.string(),
  message: z.string(),
  ephemeral: z.boolean().optional(),
});

export const refUpdateResultSchema = z.object({
  branch: z.string(),
  old_sha: z.string(),
  new_sha: z.string(),
  success: z.boolean(),
  status: z.string(),
  message: z.string().optional(),
});

export const commitPackCommitSchema = z.object({
  commit_sha: z.string(),
  tree_sha: z.string(),
  target_branch: z.string(),
  pack_bytes: z.number(),
  blob_count: z.number(),
});

export const restoreCommitCommitSchema = commitPackCommitSchema.omit({
  blob_count: true,
});

export const refUpdateResultWithOptionalsSchema = z.object({
  branch: z.string().optional(),
  old_sha: z.string().optional(),
  new_sha: z.string().optional(),
  success: z.boolean().optional(),
  status: z.string(),
  message: z.string().optional(),
});

export const commitPackAckSchema = z.object({
  commit: commitPackCommitSchema,
  result: refUpdateResultSchema,
});

export const restoreCommitAckSchema = z.object({
  commit: restoreCommitCommitSchema,
  result: refUpdateResultSchema.extend({ success: z.literal(true) }),
});

export const commitPackResponseSchema = z.object({
  commit: commitPackCommitSchema.partial().optional().nullable(),
  result: refUpdateResultWithOptionalsSchema,
});

export const restoreCommitResponseSchema = z.object({
  commit: restoreCommitCommitSchema.partial().optional().nullable(),
  result: refUpdateResultWithOptionalsSchema,
});

export const grepLineSchema = z.object({
  line_number: z.number(),
  text: z.string(),
  type: z.string(),
});

export const grepFileMatchSchema = z.object({
  path: z.string(),
  lines: z.array(grepLineSchema),
});

export const grepResponseSchema = z.object({
  query: z.object({
    pattern: z.string(),
    case_sensitive: z.boolean(),
  }),
  repo: z.object({
    ref: z.string(),
    commit: z.string(),
  }),
  matches: z.array(grepFileMatchSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const errorEnvelopeSchema = z.object({
  error: z.string(),
});

export type ListFilesResponseRaw = z.infer<typeof listFilesResponseSchema>;
export type RawTreeEntry = z.infer<typeof treeEntryRawSchema>;
export type TreeEntryTypeRaw = z.infer<typeof treeEntryTypeSchema>;
export type RawFileWithMetadata = z.infer<typeof fileWithMetadataRawSchema>;
export type RawCommitMetadata = z.infer<typeof commitMetadataRawSchema>;
export type ListFilesWithMetadataResponseRaw = z.infer<
  typeof listFilesWithMetadataResponseSchema
>;
export type RawBranchInfo = z.infer<typeof branchInfoSchema>;
export type ListBranchesResponseRaw = z.infer<
  typeof listBranchesResponseSchema
>;
export type RawCommitInfo = z.infer<typeof commitInfoRawSchema>;
export type RawCommitInfoWithSignature = z.infer<
  typeof commitInfoWithSignatureRawSchema
>;
export type ListCommitsResponseRaw = z.infer<typeof listCommitsResponseSchema>;
export type GetCommitResponseRaw = z.infer<typeof getCommitResponseSchema>;
export type BlameLineRaw = z.infer<typeof blameLineRawSchema>;
export type BlameResponseRaw = z.infer<typeof blameResponseSchema>;
export type RawRepoBaseInfo = z.infer<typeof repoBaseInfoSchema>;
export type RawRepoInfo = z.infer<typeof repoInfoSchema>;
export type ListReposResponseRaw = z.infer<typeof listReposResponseSchema>;
export type UpdateRepoResponseRaw = z.infer<typeof updateRepoResponseSchema>;
export type DeploymentResponseRaw = z.infer<typeof deploymentResponseSchema>;
export type ListDeploymentsResponseRaw = z.infer<
  typeof listDeploymentsResponseSchema
>;
export type NoteReadResponseRaw = z.infer<typeof noteReadResponseSchema>;
export type NoteWriteResponseRaw = z.infer<typeof noteWriteResponseSchema>;
export type RawNotesRefInfo = z.infer<typeof notesRefInfoSchema>;
export type ListNotesRefsResponseRaw = z.infer<
  typeof listNotesRefsResponseSchema
>;
export type RawFileDiff = z.infer<typeof diffFileRawSchema>;
export type RawFilteredFile = z.infer<typeof filteredFileRawSchema>;
export type GetBranchDiffResponseRaw = z.infer<typeof branchDiffResponseSchema>;
export type GetCommitDiffResponseRaw = z.infer<typeof commitDiffResponseSchema>;
export type CreateBranchResponseRaw = z.infer<
  typeof createBranchResponseSchema
>;
export type MergeResponseRaw = z.infer<typeof mergeResponseSchema>;
export type PreviewMergeBlobRaw = z.infer<typeof previewMergeBlobSchema>;
export type PreviewMergeConflictRaw = z.infer<
  typeof previewMergeConflictSchema
>;
export type PreviewMergeFilteredConflictRaw = z.infer<
  typeof previewMergeFilteredConflictSchema
>;
export type PreviewMergeResponseRaw = z.infer<
  typeof previewMergeResponseSchema
>;
export type RawTagInfo = z.infer<typeof tagInfoSchema>;
export type ListTagsResponseRaw = z.infer<typeof listTagsResponseSchema>;
export type CreateTagResponseRaw = z.infer<typeof createTagResponseSchema>;
export type DeleteTagResponseRaw = z.infer<typeof deleteTagResponseSchema>;
export type DeleteBranchResponseRaw = z.infer<
  typeof deleteBranchResponseSchema
>;
export type CommitPackAckRaw = z.infer<typeof commitPackAckSchema>;
export type RestoreCommitAckRaw = z.infer<typeof restoreCommitAckSchema>;
export type GrepResponseRaw = z.infer<typeof grepResponseSchema>;
