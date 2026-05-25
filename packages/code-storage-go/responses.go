package storage

type treeEntryRaw struct {
	Path string `json:"path"`
	Type string `json:"type"`
	Mode string `json:"mode"`
}

type listFilesResponse struct {
	Paths      []string       `json:"paths"`
	Ref        string         `json:"ref"`
	Entries    []treeEntryRaw `json:"entries"`
	NextCursor string         `json:"next_cursor"`
	HasMore    bool           `json:"has_more"`
}

type listFilesWithMetadataResponse struct {
	Files      []fileWithMetadataRaw        `json:"files"`
	Commits    map[string]commitMetadataRaw `json:"commits"`
	Ref        string                       `json:"ref"`
	NextCursor string                       `json:"next_cursor"`
	HasMore    bool                         `json:"has_more"`
}

type fileWithMetadataRaw struct {
	Path          string `json:"path"`
	Mode          string `json:"mode"`
	Size          int64  `json:"size"`
	LastCommitSHA string `json:"last_commit_sha"`
	Type          string `json:"type,omitempty"`
}

type commitMetadataRaw struct {
	Author  string `json:"author"`
	Date    string `json:"date"`
	Message string `json:"message"`
}

type listBranchesResponse struct {
	Branches   []branchInfoRaw `json:"branches"`
	NextCursor string          `json:"next_cursor"`
	HasMore    bool            `json:"has_more"`
}

type branchInfoRaw struct {
	Cursor    string `json:"cursor"`
	Name      string `json:"name"`
	HeadSHA   string `json:"head_sha"`
	CreatedAt string `json:"created_at"`
}

type listCommitsResponse struct {
	Commits    []commitInfoRaw `json:"commits"`
	NextCursor string          `json:"next_cursor"`
	HasMore    bool            `json:"has_more"`
}

type getCommitResponse struct {
	Commit commitInfoRaw `json:"commit"`
}

type blameResponse struct {
	Ref       string         `json:"ref"`
	Path      string         `json:"path"`
	CommitSHA string         `json:"commit_sha"`
	Lines     []blameLineRaw `json:"lines"`
}

type blameLineRaw struct {
	LineNumber         int32  `json:"line_number"`
	CommitSHA          string `json:"commit_sha"`
	OriginalLineNumber int32  `json:"original_line_number"`
	OriginalPath       string `json:"original_path"`
	PreviousCommitSHA  string `json:"previous_commit_sha,omitempty"`
	AuthorName         string `json:"author_name"`
	AuthorEmail        string `json:"author_email"`
	AuthorTime         string `json:"author_time"`
	CommitterName      string `json:"committer_name"`
	CommitterEmail     string `json:"committer_email"`
	CommitterTime      string `json:"committer_time"`
	Summary            string `json:"summary"`
}

type commitInfoRaw struct {
	SHA            string `json:"sha"`
	Message        string `json:"message"`
	AuthorName     string `json:"author_name"`
	AuthorEmail    string `json:"author_email"`
	CommitterName  string `json:"committer_name"`
	CommitterEmail string `json:"committer_email"`
	Date           string `json:"date"`
}

type listReposResponse struct {
	Repos      []repoInfoRaw `json:"repos"`
	NextCursor string        `json:"next_cursor"`
	HasMore    bool          `json:"has_more"`
}

type repoInfoRaw struct {
	RepoID        string        `json:"repo_id"`
	URL           string        `json:"url"`
	DefaultBranch string        `json:"default_branch"`
	CreatedAt     string        `json:"created_at"`
	BaseRepo      *repoBaseInfo `json:"base_repo"`
}

type repoBaseInfo struct {
	Provider string `json:"provider"`
	Owner    string `json:"owner"`
	Name     string `json:"name"`
}

type noteReadResponse struct {
	SHA    string `json:"sha"`
	Note   string `json:"note"`
	RefSHA string `json:"ref_sha"`
}

type noteWriteResponse struct {
	SHA        string     `json:"sha"`
	TargetRef  string     `json:"target_ref"`
	BaseCommit string     `json:"base_commit"`
	NewRefSHA  string     `json:"new_ref_sha"`
	Result     noteResult `json:"result"`
}

type noteResult struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type diffStatsRaw struct {
	Files     int `json:"files"`
	Additions int `json:"additions"`
	Deletions int `json:"deletions"`
	Changes   int `json:"changes"`
}

type fileDiffRaw struct {
	Path      string `json:"path"`
	State     string `json:"state"`
	OldPath   string `json:"old_path"`
	Raw       string `json:"raw"`
	Bytes     int    `json:"bytes"`
	IsEOF     bool   `json:"is_eof"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

type filteredFileRaw struct {
	Path    string `json:"path"`
	State   string `json:"state"`
	OldPath string `json:"old_path"`
	Bytes   int    `json:"bytes"`
	IsEOF   bool   `json:"is_eof"`
}

type branchDiffResponse struct {
	Branch        string            `json:"branch"`
	Base          string            `json:"base"`
	Stats         diffStatsRaw      `json:"stats"`
	Files         []fileDiffRaw     `json:"files"`
	FilteredFiles []filteredFileRaw `json:"filtered_files"`
}

type commitDiffResponse struct {
	SHA           string            `json:"sha"`
	Stats         diffStatsRaw      `json:"stats"`
	Files         []fileDiffRaw     `json:"files"`
	FilteredFiles []filteredFileRaw `json:"filtered_files"`
}

type createBranchResponse struct {
	Message           string `json:"message"`
	TargetBranch      string `json:"target_branch"`
	TargetIsEphemeral bool   `json:"target_is_ephemeral"`
	CommitSHA         string `json:"commit_sha"`
}

type mergeResponse struct {
	Result          string         `json:"result"`
	CommitSHA       string         `json:"commit_sha"`
	TreeSHA         string         `json:"tree_sha"`
	Source          mergeSourceRaw `json:"source"`
	Target          mergeTargetRaw `json:"target"`
	MergeBaseSHA    string         `json:"merge_base_sha,omitempty"`
	PromotedCommits int            `json:"promoted_commits"`
}

type mergeSourceRaw struct {
	Branch    string `json:"branch"`
	Ephemeral bool   `json:"ephemeral"`
	SHA       string `json:"sha"`
}

type mergeTargetRaw struct {
	Branch    string `json:"branch"`
	Ephemeral bool   `json:"ephemeral"`
	OldSHA    string `json:"old_sha"`
	NewSHA    string `json:"new_sha"`
}

type listTagsResponse struct {
	Tags       []tagInfoRaw `json:"tags"`
	NextCursor string       `json:"next_cursor"`
	HasMore    bool         `json:"has_more"`
}

type tagInfoRaw struct {
	Cursor string `json:"cursor"`
	Name   string `json:"name"`
	SHA    string `json:"sha"`
}

type createTagResponse struct {
	Name    string `json:"name"`
	SHA     string `json:"sha"`
	Message string `json:"message"`
}

type deleteTagResponse struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

type deleteBranchResponse struct {
	Name      string `json:"name"`
	Message   string `json:"message"`
	Ephemeral bool   `json:"ephemeral"`
}

type grepResponse struct {
	Query struct {
		Pattern       string `json:"pattern"`
		CaseSensitive bool   `json:"case_sensitive"`
	} `json:"query"`
	Repo struct {
		Ref    string `json:"ref"`
		Commit string `json:"commit"`
	} `json:"repo"`
	Matches    []grepFileMatchRaw `json:"matches"`
	NextCursor string             `json:"next_cursor"`
	HasMore    bool               `json:"has_more"`
}

type grepFileMatchRaw struct {
	Path  string        `json:"path"`
	Lines []grepLineRaw `json:"lines"`
}

type grepLineRaw struct {
	LineNumber int    `json:"line_number"`
	Text       string `json:"text"`
	Type       string `json:"type"`
}

type restoreCommitAck struct {
	Commit struct {
		CommitSHA    string `json:"commit_sha"`
		TreeSHA      string `json:"tree_sha"`
		TargetBranch string `json:"target_branch"`
		PackBytes    int    `json:"pack_bytes"`
	} `json:"commit"`
	Result struct {
		Branch  string `json:"branch"`
		OldSHA  string `json:"old_sha"`
		NewSHA  string `json:"new_sha"`
		Success bool   `json:"success"`
		Status  string `json:"status"`
		Message string `json:"message"`
	} `json:"result"`
}

type restoreCommitResponse struct {
	Commit *struct {
		CommitSHA    string `json:"commit_sha"`
		TreeSHA      string `json:"tree_sha"`
		TargetBranch string `json:"target_branch"`
		PackBytes    int    `json:"pack_bytes"`
	} `json:"commit"`
	Result struct {
		Branch  string `json:"branch"`
		OldSHA  string `json:"old_sha"`
		NewSHA  string `json:"new_sha"`
		Success *bool  `json:"success"`
		Status  string `json:"status"`
		Message string `json:"message"`
	} `json:"result"`
}
