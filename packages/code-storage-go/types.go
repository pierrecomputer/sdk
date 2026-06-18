package storage

import (
	"crypto/ecdsa"
	"io"
	"net/http"
	"time"
)

const DefaultAPIVersion = 1

// Permission defines JWT scopes supported by the API.
type Permission string

const (
	PermissionGitRead   Permission = "git:read"
	PermissionGitWrite  Permission = "git:write"
	PermissionRepoWrite Permission = "repo:write"
	PermissionOrgRead   Permission = "org:read"
)

// Options configure the Git storage client.
type Options struct {
	Name           string
	Key            string
	APIBaseURL     string
	StorageBaseURL string
	APIVersion     int
	DefaultTTL     time.Duration
	HTTPClient     *http.Client
}

// Op is a policy operation included in the JWT.
type Op = string

const (
	OpNoForcePush Op = "no-force-push"
	OpNoPush      Op = "no-push"
	// OpVerifySig requires every commit introduced by a push to a matching ref
	// to carry a valid signature from a registered signing key.
	OpVerifySig Op = "verify-sig"
)

// Ops is a list of policy operations.
type Ops []Op

// RefPolicy is a single ordered ref-matching policy rule (first match wins).
type RefPolicy struct {
	Pattern string
	Ops     Ops
}

// RefPolicyList is an ordered list of per-ref policy rules for the JWT `refs` claim.
type RefPolicyList []RefPolicy

// RemoteURLOptions configure token generation for remote URLs.
type RemoteURLOptions struct {
	Permissions []Permission
	TTL         time.Duration
	// Ops is a repo-wide policy ops list.
	//
	// Deprecated: Use RefPolicies instead.
	Ops Ops
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// InvocationOptions holds common request options.
type InvocationOptions struct {
	TTL time.Duration
}

// FindOneOptions identifies a repository by ID.
type FindOneOptions struct {
	ID string
}

// RepoOptions creates a repository handle from known metadata.
type RepoOptions struct {
	ID            string
	DefaultBranch string
	CreatedAt     string
}

// SupportedRepoProvider lists base repo providers.
type SupportedRepoProvider string

const (
	RepoProviderGitHub    SupportedRepoProvider = "github"
	RepoProviderGitLab    SupportedRepoProvider = "gitlab"
	RepoProviderBitbucket SupportedRepoProvider = "bitbucket"
	RepoProviderGitea     SupportedRepoProvider = "gitea"
	RepoProviderForgejo   SupportedRepoProvider = "forgejo"
	RepoProviderCodeberg  SupportedRepoProvider = "codeberg"
	RepoProviderSourceHut SupportedRepoProvider = "sr.ht"
)

// BaseRepo is a base repository definition for create repo.
type BaseRepo interface {
	isBaseRepo()
}

// GitHubBaseRepoAuthType enumerates GitHub base repo auth modes.
type GitHubBaseRepoAuthType string

const (
	GitHubBaseRepoAuthTypePublic GitHubBaseRepoAuthType = "public"
)

// GitHubBaseRepoAuth configures GitHub base repo authentication.
type GitHubBaseRepoAuth struct {
	AuthType GitHubBaseRepoAuthType
}

// GitHubBaseRepo references a GitHub repository.
type GitHubBaseRepo struct {
	Provider      SupportedRepoProvider
	Owner         string
	Name          string
	DefaultBranch string
	Auth          *GitHubBaseRepoAuth
}

func (GitHubBaseRepo) isBaseRepo() {}

// ForkBaseRepo references an existing Pierre repository to fork.
type ForkBaseRepo struct {
	ID  string
	Ref string
	SHA string
}

func (ForkBaseRepo) isBaseRepo() {}

// GenericGitBaseRepo references a repository on a generic git host
// (GitLab, Bitbucket, Gitea, Forgejo, Codeberg, sr.ht, etc.)
type GenericGitBaseRepo struct {
	Provider      SupportedRepoProvider
	Owner         string
	Name          string
	DefaultBranch string
	// UpstreamHost is the bare hostname for self-hosted instances
	// (e.g. "gitlab.example.com"). Falls back to the provider default if empty.
	UpstreamHost string
}

func (GenericGitBaseRepo) isBaseRepo() {}

// RepoBaseInfo describes a base repo on list results.
type RepoBaseInfo struct {
	Provider string
	Owner    string
	Name     string
}

// RepoInfo describes a repo in list results.
type RepoInfo struct {
	RepoID        string
	URL           string
	DefaultBranch string
	CreatedAt     string
	BaseRepo      *RepoBaseInfo
}

// ListReposOptions controls list repos.
type ListReposOptions struct {
	InvocationOptions
	Cursor string
	Limit  int
	// Q is a case-insensitive substring matched against the repository URL.
	// Trimmed before matching; empty after trim is treated as omitted.
	Q string
}

// ListReposResult returns paginated repos.
type ListReposResult struct {
	Repos      []RepoInfo
	NextCursor string
	HasMore    bool
}

// CreateRepoOptions controls repo creation.
type CreateRepoOptions struct {
	InvocationOptions
	ID            string
	BaseRepo      BaseRepo
	DefaultBranch string
}

// DeleteRepoOptions controls repo deletion.
type DeleteRepoOptions struct {
	InvocationOptions
	ID string
}

// DeleteRepoResult describes deletion result.
type DeleteRepoResult struct {
	RepoID  string
	Message string
}

// CreateGitCredentialOptions controls git credential creation.
type CreateGitCredentialOptions struct {
	InvocationOptions
	RepoID   string
	Username string
	Password string
}

// UpdateGitCredentialOptions controls git credential updates.
type UpdateGitCredentialOptions struct {
	InvocationOptions
	ID       string
	Username string
	Password string
}

// DeleteGitCredentialOptions controls git credential deletion.
type DeleteGitCredentialOptions struct {
	InvocationOptions
	ID string
}

// GitCredential describes a git credential.
type GitCredential struct {
	ID        string
	CreatedAt string
}

// FileRequestHeaders carries Range / conditional headers forwarded to /repos/file.
type FileRequestHeaders struct {
	Range             string
	IfMatch           string
	IfNoneMatch       string
	IfModifiedSince   string
	IfUnmodifiedSince string
	IfRange           string
}

// GetFileOptions configures file download.
type GetFileOptions struct {
	InvocationOptions
	Path          string
	Ref           string
	Ephemeral     *bool
	EphemeralBase *bool
	Headers       FileRequestHeaders
}

// HeadFileOptions configures a HEAD request against /repos/file.
type HeadFileOptions = GetFileOptions

// FileMetadata is the parsed result of a HEAD /repos/file request.
type FileMetadata struct {
	StatusCode      int
	BlobSHA         string
	LastCommitSHA   string
	Size            int64
	ETag            string
	LastModified    time.Time
	RawLastModified string
	AcceptRanges    string
	ContentRange    string
	ContentType     string
}

// ArchiveOptions configures repository archive download.
type ArchiveOptions struct {
	InvocationOptions
	Ref           string
	IncludeGlobs  []string
	ExcludeGlobs  []string
	MaxBlobSize   *int64
	ArchivePrefix string
}

// PullUpstreamOptions configures pull-upstream.
type PullUpstreamOptions struct {
	InvocationOptions
	Ref string
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// TreeEntryType identifies the kind of object at a tree entry.
type TreeEntryType string

const (
	TreeEntryBlob      TreeEntryType = "blob"
	TreeEntryTree      TreeEntryType = "tree"
	TreeEntrySymlink   TreeEntryType = "symlink"
	TreeEntrySubmodule TreeEntryType = "submodule"
)

// TreeEntry is a structured entry returned by ListFiles.
type TreeEntry struct {
	Path string
	Type TreeEntryType
	Mode string
}

// ListFilesOptions configures list files.
type ListFilesOptions struct {
	InvocationOptions
	Ref       string
	Ephemeral *bool
	Path      string
	// Recursive uses a pointer to distinguish unset from explicit false.
	Recursive *bool
	Cursor    string
	Limit     int
}

// ListFilesResult describes file list.
type ListFilesResult struct {
	Paths      []string
	Ref        string
	Entries    []TreeEntry
	NextCursor string
	HasMore    bool
}

// ListFilesWithMetadataOptions configures list files with metadata.
type ListFilesWithMetadataOptions struct {
	InvocationOptions
	Ref       string
	Ephemeral *bool
	Path      string
	// Recursive is accepted for symmetry with ListFiles; listings are always recursive.
	Recursive *bool
	Cursor    string
	Limit     int
}

// FileWithMetadata describes a file metadata entry.
type FileWithMetadata struct {
	Path          string
	Mode          string
	Size          int64
	LastCommitSHA string
	Type          TreeEntryType
}

// CommitMetadata describes commit metadata for the files metadata response.
type CommitMetadata struct {
	Author  string
	Date    time.Time
	RawDate string
	Message string
}

// ListFilesWithMetadataResult describes files metadata response.
type ListFilesWithMetadataResult struct {
	Files      []FileWithMetadata
	Commits    map[string]CommitMetadata
	Ref        string
	NextCursor string
	HasMore    bool
}

// ListBranchesOptions configures list branches.
type ListBranchesOptions struct {
	InvocationOptions
	Cursor    string
	Limit     int
	Ephemeral *bool
}

// BranchInfo describes a branch.
type BranchInfo struct {
	Cursor    string
	Name      string
	HeadSHA   string
	CreatedAt string
}

// ListBranchesResult describes branches list.
type ListBranchesResult struct {
	Branches   []BranchInfo
	NextCursor string
	HasMore    bool
}

// CreateBranchOptions configures branch creation.
type CreateBranchOptions struct {
	InvocationOptions
	BaseRef string
	// Deprecated: use BaseRef instead.
	BaseBranch        string
	TargetBranch      string
	BaseIsEphemeral   bool
	TargetIsEphemeral bool
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// CreateBranchResult describes branch creation result.
type CreateBranchResult struct {
	Message           string
	TargetBranch      string
	TargetIsEphemeral bool
	CommitSHA         string
}

// DeleteBranchOptions configures branch deletion.
type DeleteBranchOptions struct {
	InvocationOptions
	Name      string
	Ephemeral *bool
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// DeleteBranchResult describes branch deletion result.
type DeleteBranchResult struct {
	Name      string
	Message   string
	Ephemeral bool
}

// MergeStrategy selects how Repo.Merge reconciles source into target.
type MergeStrategy string

const (
	MergeStrategyMerge    MergeStrategy = "merge"
	MergeStrategyFFOnly   MergeStrategy = "ff_only"
	MergeStrategyFFPrefer MergeStrategy = "ff_prefer"
)

// MergeOptions configures branch merge operations.
type MergeOptions struct {
	InvocationOptions
	SourceBranch      string
	SourceIsEphemeral bool
	TargetBranch      string
	TargetIsEphemeral bool
	// ExpectedTargetSHA, when non-empty, requires the target branch to still point at
	// that commit. Leave empty to merge into the current target tip.
	ExpectedTargetSHA       string
	CommitMessage           string
	Author                  *CommitSignature
	Committer               *CommitSignature
	Strategy                MergeStrategy
	AllowUnrelatedHistories bool
	// Squash is incompatible with MergeStrategyFFOnly.
	Squash bool
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// MergeResultStatus describes a merge operation outcome.
type MergeResultStatus string

const (
	MergeResultMergeCommit MergeResultStatus = "merge_commit"
	MergeResultFastForward MergeResultStatus = "fast_forward"
	MergeResultNoOp        MergeResultStatus = "no_op"
	MergeResultSquash      MergeResultStatus = "squash"
	MergeResultUnknown     MergeResultStatus = "unknown"
)

// MergeRef describes a merge source ref.
type MergeRef struct {
	Branch    string
	Ephemeral bool
	SHA       string
}

// MergeTargetRef describes a merge target ref update.
type MergeTargetRef struct {
	Branch    string
	Ephemeral bool
	OldSHA    string
	NewSHA    string
}

// MergeResult describes merge results.
type MergeResult struct {
	Result          MergeResultStatus
	CommitSHA       string
	TreeSHA         string
	Source          MergeRef
	Target          MergeTargetRef
	MergeBaseSHA    string
	PromotedCommits int
}

// ListTagsOptions configures list tags.
type ListTagsOptions struct {
	InvocationOptions
	Cursor string
	Limit  int
}

// TagInfo describes a tag.
type TagInfo struct {
	Cursor string
	Name   string
	SHA    string
}

// ListTagsResult describes tags list.
type ListTagsResult struct {
	Tags       []TagInfo
	NextCursor string
	HasMore    bool
}

// CreateTagOptions configures tag creation.
type CreateTagOptions struct {
	InvocationOptions
	Name   string
	Target string
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// CreateTagResult describes tag creation result.
type CreateTagResult struct {
	Name    string
	SHA     string
	Message string
}

// DeleteTagOptions configures tag deletion.
type DeleteTagOptions struct {
	InvocationOptions
	Name string
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// DeleteTagResult describes tag deletion result.
type DeleteTagResult struct {
	Name    string
	Message string
}

// ListCommitsOptions configures list commits.
type ListCommitsOptions struct {
	InvocationOptions
	Branch    string
	Cursor    string
	Limit     int
	Ephemeral *bool
	Path      string
}

// CommitInfo describes a commit entry.
type CommitInfo struct {
	SHA            string
	Message        string
	AuthorName     string
	AuthorEmail    string
	CommitterName  string
	CommitterEmail string
	Date           time.Time
	RawDate        string
	// Signature is the armored OpenPGP/SSH signature from the commit's gpgsig
	// header. Only populated by GetCommit for signed commits. Always empty for
	// ListCommits entries and unsigned commits.
	Signature string
	// Payload is the exact bytes the signature is computed over (the raw commit
	// object with the gpgsig header removed). Only populated by GetCommit for
	// signed commits. Always empty for ListCommits entries and unsigned
	// commits.
	Payload string
}

// ListCommitsResult describes commits list.
type ListCommitsResult struct {
	Commits    []CommitInfo
	NextCursor string
	HasMore    bool
}

// GetCommitOptions configures a single-commit metadata lookup.
type GetCommitOptions struct {
	InvocationOptions
	SHA string
}

// GetCommitResult is the result returned by Repo.GetCommit. For signed commits
// the returned CommitInfo carries the armored Signature and signed Payload.
type GetCommitResult struct {
	Commit CommitInfo
}

// BlameOptions configures a per-line blame lookup.
type BlameOptions struct {
	InvocationOptions
	Path        string
	Ref         string
	Ephemeral   bool
	Ranges      []string
	DetectMoves bool
}

// BlameLine describes blame attribution for a single line in a file.
type BlameLine struct {
	LineNumber         int32
	CommitSHA          string
	OriginalLineNumber int32
	OriginalPath       string
	PreviousCommitSHA  string
	AuthorName         string
	AuthorEmail        string
	AuthorTime         time.Time
	RawAuthorTime      string
	CommitterName      string
	CommitterEmail     string
	CommitterTime      time.Time
	RawCommitterTime   string
	Summary            string
}

// BlameResult is the result returned by Repo.GetBlame.
type BlameResult struct {
	Ref       string
	Path      string
	CommitSHA string
	Lines     []BlameLine
}

// NoteAuthor identifies note author.
type NoteAuthor struct {
	Name  string
	Email string
}

// GetNoteOptions configures get note.
type GetNoteOptions struct {
	InvocationOptions
	SHA string
}

// GetNoteResult describes note read.
type GetNoteResult struct {
	SHA    string
	Note   string
	RefSHA string
}

// CreateNoteOptions configures note creation.
type CreateNoteOptions struct {
	InvocationOptions
	SHA            string
	Note           string
	ExpectedRefSHA string
	Author         *NoteAuthor
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// AppendNoteOptions configures note append.
type AppendNoteOptions struct {
	InvocationOptions
	SHA            string
	Note           string
	ExpectedRefSHA string
	Author         *NoteAuthor
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// DeleteNoteOptions configures note delete.
type DeleteNoteOptions struct {
	InvocationOptions
	SHA            string
	ExpectedRefSHA string
	Author         *NoteAuthor
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// NoteWriteResult describes note write response.
type NoteWriteResult struct {
	SHA        string
	TargetRef  string
	BaseCommit string
	NewRefSHA  string
	Result     NoteResult
}

// NoteResult describes note write status.
type NoteResult struct {
	Success bool
	Status  string
	Message string
}

// DiffFileState normalizes diff status.
type DiffFileState string

const (
	DiffStateAdded       DiffFileState = "added"
	DiffStateModified    DiffFileState = "modified"
	DiffStateDeleted     DiffFileState = "deleted"
	DiffStateRenamed     DiffFileState = "renamed"
	DiffStateCopied      DiffFileState = "copied"
	DiffStateTypeChanged DiffFileState = "type_changed"
	DiffStateUnmerged    DiffFileState = "unmerged"
	DiffStateUnknown     DiffFileState = "unknown"
)

// DiffStats describes diff stats.
type DiffStats struct {
	Files     int
	Additions int
	Deletions int
	Changes   int
}

// FileDiff describes a diffed file.
type FileDiff struct {
	Path      string
	State     DiffFileState
	RawState  string
	OldPath   string
	Raw       string
	Bytes     int
	IsEOF     bool
	Additions int
	Deletions int
}

// FilteredFile describes a filtered diff file.
type FilteredFile struct {
	Path     string
	State    DiffFileState
	RawState string
	OldPath  string
	Bytes    int
	IsEOF    bool
}

// GetBranchDiffOptions configures branch diff.
type GetBranchDiffOptions struct {
	InvocationOptions
	Branch        string
	Base          string
	Ephemeral     *bool
	EphemeralBase *bool
	Paths         []string
}

// GetBranchDiffResult describes branch diff.
type GetBranchDiffResult struct {
	Branch        string
	Base          string
	Stats         DiffStats
	Files         []FileDiff
	FilteredFiles []FilteredFile
}

// GetCommitDiffOptions configures commit diff.
type GetCommitDiffOptions struct {
	InvocationOptions
	SHA     string
	BaseSHA string
	Paths   []string
}

// GetCommitDiffResult describes commit diff.
type GetCommitDiffResult struct {
	SHA           string
	Stats         DiffStats
	Files         []FileDiff
	FilteredFiles []FilteredFile
}

// GrepOptions configures grep.
type GrepOptions struct {
	InvocationOptions
	Ref string
	// Deprecated: use Ref instead.
	Rev         string
	Ephemeral   *bool
	Query       GrepQuery
	Paths       []string
	FileFilters *GrepFileFilters
	Context     *GrepContext
	Limits      *GrepLimits
	Pagination  *GrepPagination
}

// GrepQuery describes grep query.
type GrepQuery struct {
	Pattern       string
	CaseSensitive *bool
}

// GrepFileFilters describes file filters for grep.
type GrepFileFilters struct {
	IncludeGlobs     []string
	ExcludeGlobs     []string
	ExtensionFilters []string
}

// GrepContext configures context lines.
type GrepContext struct {
	Before *int
	After  *int
}

// GrepLimits configures grep limits.
type GrepLimits struct {
	MaxLines          *int
	MaxMatchesPerFile *int
}

// GrepPagination configures grep pagination.
type GrepPagination struct {
	Cursor string
	Limit  *int
}

// GrepLine describes a grep line match.
type GrepLine struct {
	LineNumber int
	Text       string
	Type       string
}

// GrepFileMatch describes matches in a file.
type GrepFileMatch struct {
	Path  string
	Lines []GrepLine
}

// GrepResult describes grep results.
type GrepResult struct {
	Query      GrepQuery
	Repo       GrepRepo
	Matches    []GrepFileMatch
	NextCursor string
	HasMore    bool
}

// GrepRepo describes grep repo info.
type GrepRepo struct {
	Ref    string
	Commit string
}

// CommitSignature identifies an author/committer.
type CommitSignature struct {
	Name  string
	Email string
}

// GitFileMode describes git file mode.
type GitFileMode string

const (
	GitFileModeRegular    GitFileMode = "100644"
	GitFileModeExecutable GitFileMode = "100755"
	GitFileModeSymlink    GitFileMode = "120000"
	GitFileModeSubmodule  GitFileMode = "160000"
)

// CommitFileOptions configures file operations.
type CommitFileOptions struct {
	Mode GitFileMode
}

// CommitTextFileOptions configures text files.
type CommitTextFileOptions struct {
	CommitFileOptions
	Encoding string
}

// CommitResult describes commit results.
type CommitResult struct {
	CommitSHA    string
	TreeSHA      string
	TargetBranch string
	PackBytes    int
	BlobCount    int
	RefUpdate    RefUpdate
}

// RefUpdate describes ref update details.
type RefUpdate struct {
	Branch string
	OldSHA string
	NewSHA string
}

// CommitBuilder queues commit operations.
type CommitBuilder struct {
	options CommitOptions
	ops     []commitOperation
	client  *Client
	repoID  string
	sent    bool
	err     error
}

// CommitOptions configures commit operations.
type CommitOptions struct {
	InvocationOptions
	TargetBranch    string
	TargetRef       string
	CommitMessage   string
	ExpectedHeadSHA string
	BaseBranch      string
	Ephemeral       bool
	EphemeralBase   bool
	Author          CommitSignature
	Committer       *CommitSignature
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// CommitFromDiffOptions configures diff commit.
type CommitFromDiffOptions struct {
	InvocationOptions
	TargetBranch    string
	CommitMessage   string
	Diff            io.Reader
	ExpectedHeadSHA string
	BaseBranch      string
	Ephemeral       bool
	EphemeralBase   bool
	Author          CommitSignature
	Committer       *CommitSignature
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// RestoreCommitOptions configures restore commit.
type RestoreCommitOptions struct {
	InvocationOptions
	TargetBranch    string
	TargetCommitSHA string
	CommitMessage   string
	ExpectedHeadSHA string
	Author          CommitSignature
	Committer       *CommitSignature
	// RefPolicies is evaluated in declaration order. The first matching rule wins.
	RefPolicies RefPolicyList
}

// RestoreCommitResult describes restore commit.
type RestoreCommitResult struct {
	CommitSHA    string
	TreeSHA      string
	TargetBranch string
	PackBytes    int
	RefUpdate    RefUpdate
}

// WebhookValidationOptions controls webhook validation.
type WebhookValidationOptions struct {
	MaxAgeSeconds int
}

// WebhookValidationResult describes signature validation.
type WebhookValidationResult struct {
	Valid     bool
	Error     string
	Timestamp int64
	EventType string
}

// WebhookValidation includes parsed payload when available.
type WebhookValidation struct {
	WebhookValidationResult
	Payload *WebhookEventPayload
}

// ParsedWebhookSignature represents parsed signature header.
type ParsedWebhookSignature struct {
	Timestamp string
	Signature string
}

// WebhookPushEvent describes a push webhook.
type WebhookPushEvent struct {
	Type        string
	Repository  WebhookRepository
	Ref         string
	Before      string
	After       string
	CustomerID  string
	PushedAt    time.Time
	RawPushedAt string
}

// WebhookRepository describes webhook repo.
type WebhookRepository struct {
	ID  string
	URL string
}

// WebhookUnknownEvent is a fallback for unknown events.
type WebhookUnknownEvent struct {
	Type string
	Raw  []byte
}

// WebhookEventPayload represents a validated event.
type WebhookEventPayload struct {
	Push    *WebhookPushEvent
	Unknown *WebhookUnknownEvent
}

// Repo represents a repository handle.
type Repo struct {
	ID            string
	DefaultBranch string
	CreatedAt     string
	client        *Client
}

// Client is the main Git Storage client.
type Client struct {
	options    Options
	api        *apiFetcher
	privateKey *ecdsa.PrivateKey
}
