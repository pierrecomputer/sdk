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
)

// Ops is a list of policy operations.
type Ops []Op

// RemoteURLOptions configure token generation for remote URLs.
type RemoteURLOptions struct {
	Permissions []Permission
	TTL         time.Duration
	Ops         Ops
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

// GetFileOptions configures file download.
type GetFileOptions struct {
	InvocationOptions
	Path          string
	Ref           string
	Ephemeral     *bool
	EphemeralBase *bool
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
}

// ListFilesOptions configures list files.
type ListFilesOptions struct {
	InvocationOptions
	Ref       string
	Ephemeral *bool
}

// ListFilesResult describes file list.
type ListFilesResult struct {
	Paths []string
	Ref   string
}

// ListFilesWithMetadataOptions configures list files with metadata.
type ListFilesWithMetadataOptions struct {
	InvocationOptions
	Ref       string
	Ephemeral *bool
}

// FileWithMetadata describes a file metadata entry.
type FileWithMetadata struct {
	Path          string
	Mode          string
	Size          int64
	LastCommitSHA string
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
	Files   []FileWithMetadata
	Commits map[string]CommitMetadata
	Ref     string
}

// ListBranchesOptions configures list branches.
type ListBranchesOptions struct {
	InvocationOptions
	Cursor string
	Limit  int
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
	Name string
}

// DeleteBranchResult describes branch deletion result.
type DeleteBranchResult struct {
	Name    string
	Message string
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
}

// DeleteTagResult describes tag deletion result.
type DeleteTagResult struct {
	Name    string
	Message string
}

// ListCommitsOptions configures list commits.
type ListCommitsOptions struct {
	InvocationOptions
	Branch string
	Cursor string
	Limit  int
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
}

// ListCommitsResult describes commits list.
type ListCommitsResult struct {
	Commits    []CommitInfo
	NextCursor string
	HasMore    bool
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
}

// AppendNoteOptions configures note append.
type AppendNoteOptions struct {
	InvocationOptions
	SHA            string
	Note           string
	ExpectedRefSHA string
	Author         *NoteAuthor
}

// DeleteNoteOptions configures note delete.
type DeleteNoteOptions struct {
	InvocationOptions
	SHA            string
	ExpectedRefSHA string
	Author         *NoteAuthor
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
