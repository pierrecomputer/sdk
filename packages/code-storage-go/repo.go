package storage

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

var restoreCommitAllowedStatus = map[int]bool{
	400: true,
	401: true,
	403: true,
	404: true,
	408: true,
	409: true,
	412: true,
	422: true,
	429: true,
	499: true,
	500: true,
	502: true,
	503: true,
	504: true,
}

var noteWriteAllowedStatus = map[int]bool{
	400: true,
	401: true,
	403: true,
	404: true,
	408: true,
	409: true,
	412: true,
	422: true,
	429: true,
	499: true,
	500: true,
	502: true,
	503: true,
	504: true,
}

// RemoteURL returns an authenticated remote URL.
func (r *Repo) RemoteURL(ctx context.Context, options RemoteURLOptions) (string, error) {
	jwtToken, err := r.client.generateJWT(r.ID, options)
	if err != nil {
		return "", err
	}

	u := url.URL{
		Scheme: "https",
		Host:   r.client.options.StorageBaseURL,
		Path:   "/" + r.ID + ".git",
	}
	u.User = url.UserPassword("t", jwtToken)
	return u.String(), nil
}

// EphemeralRemoteURL returns the ephemeral remote URL.
func (r *Repo) EphemeralRemoteURL(ctx context.Context, options RemoteURLOptions) (string, error) {
	jwtToken, err := r.client.generateJWT(r.ID, options)
	if err != nil {
		return "", err
	}

	u := url.URL{
		Scheme: "https",
		Host:   r.client.options.StorageBaseURL,
		Path:   "/" + r.ID + "+ephemeral.git",
	}
	u.User = url.UserPassword("t", jwtToken)
	return u.String(), nil
}

// ImportRemoteURL returns the import remote URL.
func (r *Repo) ImportRemoteURL(ctx context.Context, options RemoteURLOptions) (string, error) {
	jwtToken, err := r.client.generateJWT(r.ID, options)
	if err != nil {
		return "", err
	}

	u := url.URL{
		Scheme: "https",
		Host:   r.client.options.StorageBaseURL,
		Path:   "/" + r.ID + "+import.git",
	}
	u.User = url.UserPassword("t", jwtToken)
	return u.String(), nil
}

// FileStream returns the raw response for streaming file contents.
func (r *Repo) FileStream(ctx context.Context, options GetFileOptions) (*http.Response, error) {
	if strings.TrimSpace(options.Path) == "" {
		return nil, errors.New("getFileStream path is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return nil, fmt.Errorf("archive stream generate jwt: %w", err)
	}

	params := url.Values{}
	params.Set("path", options.Path)
	if options.Ref != "" {
		params.Set("ref", options.Ref)
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if options.EphemeralBase != nil {
		params.Set("ephemeral_base", strconv.FormatBool(*options.EphemeralBase))
	}

	resp, err := r.client.api.get(ctx, "repos/file", params, jwtToken, nil)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// ArchiveStream returns the raw response for streaming repository archives.
func (r *Repo) ArchiveStream(ctx context.Context, options ArchiveOptions) (*http.Response, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return nil, err
	}

	req := archiveRequest{}
	if ref := strings.TrimSpace(options.Ref); ref != "" {
		req.Ref = ref
	}
	if len(options.IncludeGlobs) > 0 {
		req.IncludeGlobs = options.IncludeGlobs
	}
	if len(options.ExcludeGlobs) > 0 {
		req.ExcludeGlobs = options.ExcludeGlobs
	}
	if options.MaxBlobSize != nil {
		req.MaxBlobSize = options.MaxBlobSize
	}
	if prefix := strings.TrimSpace(options.ArchivePrefix); prefix != "" {
		req.Archive = &archiveOptions{Prefix: prefix}
	}

	var body interface{}
	if req.Ref != "" || len(req.IncludeGlobs) > 0 || len(req.ExcludeGlobs) > 0 || req.MaxBlobSize != nil || req.Archive != nil {
		body = req
	}

	resp, err := r.client.api.post(ctx, "repos/archive", nil, body, jwtToken, nil)
	if err != nil {
		return nil, fmt.Errorf("archive stream request: %w", err)
	}

	return resp, nil
}

// ListFiles lists file paths.
func (r *Repo) ListFiles(ctx context.Context, options ListFilesOptions) (ListFilesResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListFilesResult{}, err
	}

	params := url.Values{}
	if options.Ref != "" {
		params.Set("ref", options.Ref)
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/files", params, jwtToken, nil)
	if err != nil {
		return ListFilesResult{}, err
	}
	defer resp.Body.Close()

	var payload listFilesResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListFilesResult{}, err
	}

	return ListFilesResult{Paths: payload.Paths, Ref: payload.Ref}, nil
}

// ListFilesWithMetadata lists files with mode/size and last commit metadata.
func (r *Repo) ListFilesWithMetadata(ctx context.Context, options ListFilesWithMetadataOptions) (ListFilesWithMetadataResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListFilesWithMetadataResult{}, err
	}

	params := url.Values{}
	if options.Ref != "" {
		params.Set("ref", options.Ref)
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/files/metadata", params, jwtToken, nil)
	if err != nil {
		return ListFilesWithMetadataResult{}, err
	}
	defer resp.Body.Close()

	var payload listFilesWithMetadataResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListFilesWithMetadataResult{}, err
	}

	result := ListFilesWithMetadataResult{
		Ref:     payload.Ref,
		Commits: make(map[string]CommitMetadata, len(payload.Commits)),
	}
	for _, file := range payload.Files {
		result.Files = append(result.Files, FileWithMetadata{
			Path:          file.Path,
			Mode:          file.Mode,
			Size:          file.Size,
			LastCommitSHA: file.LastCommitSHA,
		})
	}
	for sha, commit := range payload.Commits {
		result.Commits[sha] = CommitMetadata{
			Author:  commit.Author,
			Date:    parseTime(commit.Date),
			RawDate: commit.Date,
			Message: commit.Message,
		}
	}

	return result, nil
}

// ListBranches lists branches.
func (r *Repo) ListBranches(ctx context.Context, options ListBranchesOptions) (ListBranchesResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListBranchesResult{}, err
	}

	params := url.Values{}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/branches", params, jwtToken, nil)
	if err != nil {
		return ListBranchesResult{}, err
	}
	defer resp.Body.Close()

	var payload listBranchesResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListBranchesResult{}, err
	}

	result := ListBranchesResult{HasMore: payload.HasMore}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, branch := range payload.Branches {
		result.Branches = append(result.Branches, BranchInfo{
			Cursor:    branch.Cursor,
			Name:      branch.Name,
			HeadSHA:   branch.HeadSHA,
			CreatedAt: branch.CreatedAt,
		})
	}
	return result, nil
}

// ListTags lists tags.
func (r *Repo) ListTags(ctx context.Context, options ListTagsOptions) (ListTagsResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListTagsResult{}, err
	}

	params := url.Values{}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/tags", params, jwtToken, nil)
	if err != nil {
		return ListTagsResult{}, err
	}
	defer resp.Body.Close()

	var payload listTagsResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListTagsResult{}, err
	}

	result := ListTagsResult{HasMore: payload.HasMore}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, tag := range payload.Tags {
		result.Tags = append(result.Tags, TagInfo{
			Cursor: tag.Cursor,
			Name:   tag.Name,
			SHA:    tag.SHA,
		})
	}
	return result, nil
}

// ListCommits lists commits.
func (r *Repo) ListCommits(ctx context.Context, options ListCommitsOptions) (ListCommitsResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListCommitsResult{}, err
	}

	params := url.Values{}
	if options.Branch != "" {
		params.Set("branch", options.Branch)
	}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/commits", params, jwtToken, nil)
	if err != nil {
		return ListCommitsResult{}, err
	}
	defer resp.Body.Close()

	var payload listCommitsResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListCommitsResult{}, err
	}

	result := ListCommitsResult{HasMore: payload.HasMore}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, commit := range payload.Commits {
		result.Commits = append(result.Commits, CommitInfo{
			SHA:            commit.SHA,
			Message:        commit.Message,
			AuthorName:     commit.AuthorName,
			AuthorEmail:    commit.AuthorEmail,
			CommitterName:  commit.CommitterName,
			CommitterEmail: commit.CommitterEmail,
			Date:           parseTime(commit.Date),
			RawDate:        commit.Date,
		})
	}

	return result, nil
}

// GetCommit returns metadata for a single commit without computing its diff.
func (r *Repo) GetCommit(ctx context.Context, options GetCommitOptions) (GetCommitResult, error) {
	sha := strings.TrimSpace(options.SHA)
	if sha == "" {
		return GetCommitResult{}, errors.New("getCommit sha is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetCommitResult{}, err
	}

	params := url.Values{}
	params.Set("sha", sha)

	resp, err := r.client.api.get(ctx, "repos/commit", params, jwtToken, nil)
	if err != nil {
		return GetCommitResult{}, err
	}
	defer resp.Body.Close()

	var payload getCommitResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GetCommitResult{}, err
	}

	return GetCommitResult{
		Commit: CommitInfo{
			SHA:            payload.Commit.SHA,
			Message:        payload.Commit.Message,
			AuthorName:     payload.Commit.AuthorName,
			AuthorEmail:    payload.Commit.AuthorEmail,
			CommitterName:  payload.Commit.CommitterName,
			CommitterEmail: payload.Commit.CommitterEmail,
			Date:           parseTime(payload.Commit.Date),
			RawDate:        payload.Commit.Date,
		},
	}, nil
}

// GetNote reads a git note.
func (r *Repo) GetNote(ctx context.Context, options GetNoteOptions) (GetNoteResult, error) {
	sha := strings.TrimSpace(options.SHA)
	if sha == "" {
		return GetNoteResult{}, errors.New("getNote sha is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetNoteResult{}, err
	}

	params := url.Values{}
	params.Set("sha", sha)

	resp, err := r.client.api.get(ctx, "repos/notes", params, jwtToken, nil)
	if err != nil {
		return GetNoteResult{}, err
	}
	defer resp.Body.Close()

	var payload noteReadResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GetNoteResult{}, err
	}

	return GetNoteResult{SHA: payload.SHA, Note: payload.Note, RefSHA: payload.RefSHA}, nil
}

// CreateNote adds a git note.
func (r *Repo) CreateNote(ctx context.Context, options CreateNoteOptions) (NoteWriteResult, error) {
	return r.writeNote(ctx, options.InvocationOptions, "add", options.SHA, options.Note, options.ExpectedRefSHA, options.Author)
}

// AppendNote appends to a git note.
func (r *Repo) AppendNote(ctx context.Context, options AppendNoteOptions) (NoteWriteResult, error) {
	return r.writeNote(ctx, options.InvocationOptions, "append", options.SHA, options.Note, options.ExpectedRefSHA, options.Author)
}

// DeleteNote deletes a git note.
func (r *Repo) DeleteNote(ctx context.Context, options DeleteNoteOptions) (NoteWriteResult, error) {
	sha := strings.TrimSpace(options.SHA)
	if sha == "" {
		return NoteWriteResult{}, errors.New("deleteNote sha is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return NoteWriteResult{}, err
	}

	body := &noteWriteRequest{SHA: sha}
	if strings.TrimSpace(options.ExpectedRefSHA) != "" {
		body.ExpectedRefSHA = options.ExpectedRefSHA
	}
	if options.Author != nil {
		if strings.TrimSpace(options.Author.Name) == "" || strings.TrimSpace(options.Author.Email) == "" {
			return NoteWriteResult{}, errors.New("deleteNote author name and email are required when provided")
		}
		body.Author = &authorInfo{Name: options.Author.Name, Email: options.Author.Email}
	}

	resp, err := r.client.api.delete(ctx, "repos/notes", nil, body, jwtToken, &requestOptions{allowedStatus: noteWriteAllowedStatus})
	if err != nil {
		return NoteWriteResult{}, err
	}
	defer resp.Body.Close()

	result, err := parseNoteWriteResponse(resp, "DELETE")
	if err != nil {
		return NoteWriteResult{}, err
	}
	if !result.Result.Success {
		message := result.Result.Message
		if strings.TrimSpace(message) == "" {
			message = "deleteNote failed with status " + result.Result.Status
		}
		return NoteWriteResult{}, newRefUpdateError(
			message,
			result.Result.Status,
			partialRefUpdate(result.TargetRef, result.BaseCommit, result.NewRefSHA),
		)
	}
	return result, nil
}

func (r *Repo) writeNote(ctx context.Context, invocation InvocationOptions, action string, sha string, note string, expectedRefSHA string, author *NoteAuthor) (NoteWriteResult, error) {
	sha = strings.TrimSpace(sha)
	if sha == "" {
		return NoteWriteResult{}, errors.New("note sha is required")
	}

	note = strings.TrimSpace(note)
	if note == "" {
		return NoteWriteResult{}, errors.New("note content is required")
	}

	ttl := resolveInvocationTTL(invocation, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return NoteWriteResult{}, err
	}

	body := &noteWriteRequest{
		SHA:    sha,
		Action: action,
		Note:   note,
	}
	if strings.TrimSpace(expectedRefSHA) != "" {
		body.ExpectedRefSHA = expectedRefSHA
	}
	if author != nil {
		if strings.TrimSpace(author.Name) == "" || strings.TrimSpace(author.Email) == "" {
			return NoteWriteResult{}, errors.New("note author name and email are required when provided")
		}
		body.Author = &authorInfo{Name: author.Name, Email: author.Email}
	}

	resp, err := r.client.api.post(ctx, "repos/notes", nil, body, jwtToken, &requestOptions{allowedStatus: noteWriteAllowedStatus})
	if err != nil {
		return NoteWriteResult{}, err
	}
	defer resp.Body.Close()

	result, err := parseNoteWriteResponse(resp, "POST")
	if err != nil {
		return NoteWriteResult{}, err
	}
	if !result.Result.Success {
		message := result.Result.Message
		if strings.TrimSpace(message) == "" {
			if action == "append" {
				message = "appendNote failed with status " + result.Result.Status
			} else {
				message = "createNote failed with status " + result.Result.Status
			}
		}
		return NoteWriteResult{}, newRefUpdateError(
			message,
			result.Result.Status,
			partialRefUpdate(result.TargetRef, result.BaseCommit, result.NewRefSHA),
		)
	}
	return result, nil
}

// GetBranchDiff returns a diff for a branch.
func (r *Repo) GetBranchDiff(ctx context.Context, options GetBranchDiffOptions) (GetBranchDiffResult, error) {
	if strings.TrimSpace(options.Branch) == "" {
		return GetBranchDiffResult{}, errors.New("getBranchDiff branch is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetBranchDiffResult{}, err
	}

	params := url.Values{}
	params.Set("branch", options.Branch)
	if strings.TrimSpace(options.Base) != "" {
		params.Set("base", options.Base)
	}
	if options.Ephemeral != nil {
		params.Set("ephemeral", strconv.FormatBool(*options.Ephemeral))
	}
	if options.EphemeralBase != nil {
		params.Set("ephemeral_base", strconv.FormatBool(*options.EphemeralBase))
	}
	for _, path := range options.Paths {
		if strings.TrimSpace(path) != "" {
			params.Add("path", path)
		}
	}

	resp, err := r.client.api.get(ctx, "repos/branches/diff", params, jwtToken, nil)
	if err != nil {
		return GetBranchDiffResult{}, err
	}
	defer resp.Body.Close()

	var payload branchDiffResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GetBranchDiffResult{}, err
	}

	return transformBranchDiff(payload), nil
}

// GetCommitDiff returns a diff for a commit.
func (r *Repo) GetCommitDiff(ctx context.Context, options GetCommitDiffOptions) (GetCommitDiffResult, error) {
	if strings.TrimSpace(options.SHA) == "" {
		return GetCommitDiffResult{}, errors.New("getCommitDiff sha is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetCommitDiffResult{}, err
	}

	params := url.Values{}
	params.Set("sha", options.SHA)
	if strings.TrimSpace(options.BaseSHA) != "" {
		params.Set("baseSha", options.BaseSHA)
	}
	for _, path := range options.Paths {
		if strings.TrimSpace(path) != "" {
			params.Add("path", path)
		}
	}

	resp, err := r.client.api.get(ctx, "repos/diff", params, jwtToken, nil)
	if err != nil {
		return GetCommitDiffResult{}, err
	}
	defer resp.Body.Close()

	var payload commitDiffResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GetCommitDiffResult{}, err
	}

	return transformCommitDiff(payload), nil
}

// Grep runs a grep query.
func (r *Repo) Grep(ctx context.Context, options GrepOptions) (GrepResult, error) {
	pattern := strings.TrimSpace(options.Query.Pattern)
	if pattern == "" {
		return GrepResult{}, errors.New("grep query.pattern is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GrepResult{}, err
	}

	body := &grepRequest{
		Query: grepQueryPayload{
			Pattern:       pattern,
			CaseSensitive: options.Query.CaseSensitive,
		},
	}
	ref := strings.TrimSpace(options.Ref)
	if ref == "" {
		ref = strings.TrimSpace(options.Rev)
	}
	if ref != "" {
		body.Ref = ref
	}
	if options.Ephemeral != nil {
		body.Ephemeral = options.Ephemeral
	}
	if len(options.Paths) > 0 {
		body.Paths = options.Paths
	}
	if options.FileFilters != nil {
		filters := &grepFileFilterPayload{}
		hasFilters := false
		if len(options.FileFilters.IncludeGlobs) > 0 {
			filters.IncludeGlobs = options.FileFilters.IncludeGlobs
			hasFilters = true
		}
		if len(options.FileFilters.ExcludeGlobs) > 0 {
			filters.ExcludeGlobs = options.FileFilters.ExcludeGlobs
			hasFilters = true
		}
		if len(options.FileFilters.ExtensionFilters) > 0 {
			filters.ExtensionFilters = options.FileFilters.ExtensionFilters
			hasFilters = true
		}
		if hasFilters {
			body.FileFilters = filters
		}
	}
	if options.Context != nil {
		contextPayload := &grepContextPayload{}
		hasCtx := false
		if options.Context.Before != nil {
			contextPayload.Before = options.Context.Before
			hasCtx = true
		}
		if options.Context.After != nil {
			contextPayload.After = options.Context.After
			hasCtx = true
		}
		if hasCtx {
			body.Context = contextPayload
		}
	}
	if options.Limits != nil {
		limits := &grepLimitsPayload{}
		hasLimits := false
		if options.Limits.MaxLines != nil {
			limits.MaxLines = options.Limits.MaxLines
			hasLimits = true
		}
		if options.Limits.MaxMatchesPerFile != nil {
			limits.MaxMatchesPerFile = options.Limits.MaxMatchesPerFile
			hasLimits = true
		}
		if hasLimits {
			body.Limits = limits
		}
	}
	if options.Pagination != nil {
		pagination := &grepPaginationPayload{}
		hasPagination := false
		if strings.TrimSpace(options.Pagination.Cursor) != "" {
			pagination.Cursor = options.Pagination.Cursor
			hasPagination = true
		}
		if options.Pagination.Limit != nil {
			pagination.Limit = options.Pagination.Limit
			hasPagination = true
		}
		if hasPagination {
			body.Pagination = pagination
		}
	}

	resp, err := r.client.api.post(ctx, "repos/grep", nil, body, jwtToken, nil)
	if err != nil {
		return GrepResult{}, err
	}
	defer resp.Body.Close()

	var payload grepResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GrepResult{}, err
	}

	result := GrepResult{
		Query:   GrepQuery{Pattern: payload.Query.Pattern, CaseSensitive: &payload.Query.CaseSensitive},
		Repo:    GrepRepo{Ref: payload.Repo.Ref, Commit: payload.Repo.Commit},
		HasMore: payload.HasMore,
	}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, match := range payload.Matches {
		entry := GrepFileMatch{Path: match.Path}
		for _, line := range match.Lines {
			entry.Lines = append(entry.Lines, GrepLine{LineNumber: line.LineNumber, Text: line.Text, Type: line.Type})
		}
		result.Matches = append(result.Matches, entry)
	}

	return result, nil
}

// PullUpstream triggers a pull-upstream operation.
func (r *Repo) PullUpstream(ctx context.Context, options PullUpstreamOptions) error {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return err
	}

	body := &pullUpstreamRequest{}
	if strings.TrimSpace(options.Ref) != "" {
		body.Ref = options.Ref
	}

	resp, err := r.client.api.post(ctx, "repos/pull-upstream", nil, body, jwtToken, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 202 {
		return errors.New("pull upstream failed: " + resp.Status)
	}
	return nil
}

// CreateBranch creates a new branch.
func (r *Repo) CreateBranch(ctx context.Context, options CreateBranchOptions) (CreateBranchResult, error) {
	baseRef := strings.TrimSpace(options.BaseRef)
	baseBranch := strings.TrimSpace(options.BaseBranch)
	targetBranch := strings.TrimSpace(options.TargetBranch)
	if baseRef == "" && baseBranch == "" {
		return CreateBranchResult{}, errors.New("createBranch baseRef or baseBranch is required")
	}
	if targetBranch == "" {
		return CreateBranchResult{}, errors.New("createBranch targetBranch is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return CreateBranchResult{}, err
	}

	body := &createBranchRequest{
		TargetBranch:      targetBranch,
		BaseIsEphemeral:   options.BaseIsEphemeral,
		TargetIsEphemeral: options.TargetIsEphemeral,
	}
	if baseRef != "" {
		body.BaseRef = baseRef
	} else {
		body.BaseBranch = baseBranch
	}

	resp, err := r.client.api.post(ctx, "repos/branches/create", nil, body, jwtToken, nil)
	if err != nil {
		return CreateBranchResult{}, err
	}
	defer resp.Body.Close()

	var payload createBranchResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return CreateBranchResult{}, err
	}

	result := CreateBranchResult{
		Message:           payload.Message,
		TargetBranch:      payload.TargetBranch,
		TargetIsEphemeral: payload.TargetIsEphemeral,
		CommitSHA:         payload.CommitSHA,
	}
	return result, nil
}

// DeleteBranch deletes a branch.
func (r *Repo) DeleteBranch(ctx context.Context, options DeleteBranchOptions) (DeleteBranchResult, error) {
	name := strings.TrimSpace(options.Name)
	if name == "" {
		return DeleteBranchResult{}, errors.New("deleteBranch name is required")
	}
	if strings.HasPrefix(name, "refs/") {
		return DeleteBranchResult{}, errors.New("deleteBranch name must not start with refs/")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return DeleteBranchResult{}, err
	}

	body := &deleteBranchRequest{Name: name}
	resp, err := r.client.api.delete(ctx, "repos/branches", nil, body, jwtToken, nil)
	if err != nil {
		return DeleteBranchResult{}, err
	}
	defer resp.Body.Close()

	var payload deleteBranchResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return DeleteBranchResult{}, err
	}

	return DeleteBranchResult{
		Name:    payload.Name,
		Message: payload.Message,
	}, nil
}

// Merge merges a source branch into a target branch.
func (r *Repo) Merge(ctx context.Context, options MergeOptions) (MergeResult, error) {
	sourceBranch := strings.TrimSpace(options.SourceBranch)
	if sourceBranch == "" {
		return MergeResult{}, errors.New("merge sourceBranch is required")
	}
	targetBranch := strings.TrimSpace(options.TargetBranch)
	if targetBranch == "" {
		return MergeResult{}, errors.New("merge targetBranch is required")
	}
	strategy := MergeStrategy(strings.TrimSpace(string(options.Strategy)))
	if strategy == "" {
		return MergeResult{}, errors.New("merge strategy is required")
	}
	if strategy != MergeStrategyMerge && strategy != MergeStrategyFFOnly && strategy != MergeStrategyFFPrefer {
		return MergeResult{}, errors.New("merge strategy is invalid")
	}

	body := &mergeRequest{
		SourceBranch:            sourceBranch,
		SourceIsEphemeral:       options.SourceIsEphemeral,
		TargetBranch:            targetBranch,
		TargetIsEphemeral:       options.TargetIsEphemeral,
		Strategy:                string(strategy),
		AllowUnrelatedHistories: options.AllowUnrelatedHistories,
	}
	if expectedTargetSHA := strings.TrimSpace(options.ExpectedTargetSHA); expectedTargetSHA != "" {
		body.ExpectedTargetSHA = expectedTargetSHA
	}
	if commitMessage := strings.TrimSpace(options.CommitMessage); commitMessage != "" {
		body.CommitMessage = commitMessage
	}
	if options.Author != nil {
		author, err := mergeSignaturePayload("author", options.Author)
		if err != nil {
			return MergeResult{}, err
		}
		body.Author = author
	}
	if options.Committer != nil {
		committer, err := mergeSignaturePayload("committer", options.Committer)
		if err != nil {
			return MergeResult{}, err
		}
		body.Committer = committer
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return MergeResult{}, err
	}

	resp, err := r.client.api.post(ctx, "repos/merge", nil, body, jwtToken, nil)
	if err != nil {
		return MergeResult{}, err
	}
	defer resp.Body.Close()

	var payload mergeResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return MergeResult{}, err
	}

	return MergeResult{
		Result:    MergeResultStatus(payload.Result),
		CommitSHA: payload.CommitSHA,
		TreeSHA:   payload.TreeSHA,
		Source: MergeRef{
			Branch:    payload.Source.Branch,
			Ephemeral: payload.Source.Ephemeral,
			SHA:       payload.Source.SHA,
		},
		Target: MergeTargetRef{
			Branch:    payload.Target.Branch,
			Ephemeral: payload.Target.Ephemeral,
			OldSHA:    payload.Target.OldSHA,
			NewSHA:    payload.Target.NewSHA,
		},
		MergeBaseSHA:    payload.MergeBaseSHA,
		PromotedCommits: payload.PromotedCommits,
	}, nil
}

func mergeSignaturePayload(field string, signature *CommitSignature) (*authorInfo, error) {
	name := strings.TrimSpace(signature.Name)
	email := strings.TrimSpace(signature.Email)
	if name == "" || email == "" {
		return nil, errors.New("merge " + field + " name and email are required when provided")
	}
	return &authorInfo{Name: name, Email: email}, nil
}

// CreateTag creates a tag.
func (r *Repo) CreateTag(ctx context.Context, options CreateTagOptions) (CreateTagResult, error) {
	name := strings.TrimSpace(options.Name)
	if name == "" {
		return CreateTagResult{}, errors.New("createTag name is required")
	}
	if strings.HasPrefix(name, "refs/") {
		return CreateTagResult{}, errors.New("createTag name must not start with refs/")
	}

	target := strings.TrimSpace(options.Target)
	if target == "" {
		return CreateTagResult{}, errors.New("createTag target is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return CreateTagResult{}, err
	}

	body := &createTagRequest{Name: name, Target: target}
	resp, err := r.client.api.post(ctx, "repos/tags", nil, body, jwtToken, nil)
	if err != nil {
		return CreateTagResult{}, err
	}
	defer resp.Body.Close()

	var payload createTagResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return CreateTagResult{}, err
	}

	return CreateTagResult{
		Name:    payload.Name,
		SHA:     payload.SHA,
		Message: payload.Message,
	}, nil
}

// DeleteTag deletes a tag.
func (r *Repo) DeleteTag(ctx context.Context, options DeleteTagOptions) (DeleteTagResult, error) {
	name := strings.TrimSpace(options.Name)
	if name == "" {
		return DeleteTagResult{}, errors.New("deleteTag name is required")
	}
	if strings.HasPrefix(name, "refs/") {
		return DeleteTagResult{}, errors.New("deleteTag name must not start with refs/")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead, PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return DeleteTagResult{}, err
	}

	body := &deleteTagRequest{Name: name}
	resp, err := r.client.api.delete(ctx, "repos/tags", nil, body, jwtToken, nil)
	if err != nil {
		return DeleteTagResult{}, err
	}
	defer resp.Body.Close()

	var payload deleteTagResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return DeleteTagResult{}, err
	}

	return DeleteTagResult{
		Name:    payload.Name,
		Message: payload.Message,
	}, nil
}

// RestoreCommit restores a commit into a branch.
func (r *Repo) RestoreCommit(ctx context.Context, options RestoreCommitOptions) (RestoreCommitResult, error) {
	targetBranch := strings.TrimSpace(options.TargetBranch)
	if targetBranch == "" {
		return RestoreCommitResult{}, errors.New("restoreCommit targetBranch is required")
	}
	if strings.HasPrefix(targetBranch, "refs/") {
		return RestoreCommitResult{}, errors.New("restoreCommit targetBranch must not include refs/ prefix")
	}

	targetSHA := strings.TrimSpace(options.TargetCommitSHA)
	if targetSHA == "" {
		return RestoreCommitResult{}, errors.New("restoreCommit targetCommitSha is required")
	}

	if strings.TrimSpace(options.Author.Name) == "" || strings.TrimSpace(options.Author.Email) == "" {
		return RestoreCommitResult{}, errors.New("restoreCommit author name and email are required")
	}

	ttl := resolveCommitTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl})
	if err != nil {
		return RestoreCommitResult{}, err
	}

	metadata := &restoreCommitMetadata{
		TargetBranch:    targetBranch,
		TargetCommitSHA: targetSHA,
		Author: authorInfo{
			Name:  strings.TrimSpace(options.Author.Name),
			Email: strings.TrimSpace(options.Author.Email),
		},
	}

	if strings.TrimSpace(options.CommitMessage) != "" {
		metadata.CommitMessage = options.CommitMessage
	}
	if strings.TrimSpace(options.ExpectedHeadSHA) != "" {
		metadata.ExpectedHeadSHA = options.ExpectedHeadSHA
	}
	if options.Committer != nil {
		if strings.TrimSpace(options.Committer.Name) == "" || strings.TrimSpace(options.Committer.Email) == "" {
			return RestoreCommitResult{}, errors.New("restoreCommit committer name and email are required when provided")
		}
		metadata.Committer = &authorInfo{
			Name:  strings.TrimSpace(options.Committer.Name),
			Email: strings.TrimSpace(options.Committer.Email),
		}
	}

	resp, err := r.client.api.post(ctx, "repos/restore-commit", nil, &metadataEnvelope{Metadata: metadata}, jwtToken, &requestOptions{allowedStatus: restoreCommitAllowedStatus})
	if err != nil {
		return RestoreCommitResult{}, err
	}
	defer resp.Body.Close()

	payloadBytes, err := readAll(resp)
	if err != nil {
		return RestoreCommitResult{}, err
	}

	ack, failure := parseRestoreCommitPayload(payloadBytes)
	if ack != nil {
		return buildRestoreCommitResult(*ack)
	}

	status := ""
	message := ""
	var refUpdate *RefUpdate
	if failure != nil {
		status = failure.Status
		message = failure.Message
		refUpdate = failure.RefUpdate
	}
	if status == "" {
		status = httpStatusToRestoreStatus(resp.StatusCode)
	}
	if message == "" {
		message = "restore commit failed with HTTP " + itoa(resp.StatusCode)
	}

	return RestoreCommitResult{}, newRefUpdateError(message, status, refUpdate)
}

// CreateCommit starts a commit builder.
func (r *Repo) CreateCommit(options CommitOptions) (*CommitBuilder, error) {
	builder := &CommitBuilder{options: options, client: r.client, repoID: r.ID}
	if err := builder.normalize(); err != nil {
		return nil, err
	}
	return builder, nil
}

// CreateCommitFromDiff applies a pre-generated diff.
func (r *Repo) CreateCommitFromDiff(ctx context.Context, options CommitFromDiffOptions) (CommitResult, error) {
	exec := diffCommitExecutor{options: options, client: r.client}
	return exec.send(ctx, r.ID)
}
