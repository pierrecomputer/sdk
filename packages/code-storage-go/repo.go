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
// 206, 304, 412 and 416 status codes pass through to the caller.
func (r *Repo) FileStream(ctx context.Context, options GetFileOptions) (*http.Response, error) {
	if strings.TrimSpace(options.Path) == "" {
		return nil, errors.New("getFileStream path is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return nil, fmt.Errorf("archive stream generate jwt: %w", err)
	}

	params := buildGetFileParams(options)
	reqOpts := buildFileRequestOptions(options.Headers)

	resp, err := r.client.api.get(ctx, "repos/file", params, jwtToken, reqOpts)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// HeadFile issues HEAD /repos/file and returns parsed response metadata.
func (r *Repo) HeadFile(ctx context.Context, options HeadFileOptions) (FileMetadata, error) {
	if strings.TrimSpace(options.Path) == "" {
		return FileMetadata{}, errors.New("headFile path is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return FileMetadata{}, fmt.Errorf("headFile generate jwt: %w", err)
	}

	params := buildGetFileParams(options)
	reqOpts := buildFileRequestOptions(options.Headers)

	resp, err := r.client.api.head(ctx, "repos/file", params, jwtToken, reqOpts)
	if err != nil {
		return FileMetadata{}, err
	}
	defer resp.Body.Close()

	return parseFileMetadataHeaders(resp), nil
}

func buildGetFileParams(options GetFileOptions) url.Values {
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
	return params
}

func buildFileRequestOptions(headers FileRequestHeaders) *requestOptions {
	extra := map[string]string{}
	if headers.Range != "" {
		extra["Range"] = headers.Range
	}
	if headers.IfMatch != "" {
		extra["If-Match"] = headers.IfMatch
	}
	if headers.IfNoneMatch != "" {
		extra["If-None-Match"] = headers.IfNoneMatch
	}
	if headers.IfModifiedSince != "" {
		extra["If-Modified-Since"] = headers.IfModifiedSince
	}
	if headers.IfUnmodifiedSince != "" {
		extra["If-Unmodified-Since"] = headers.IfUnmodifiedSince
	}
	if headers.IfRange != "" {
		extra["If-Range"] = headers.IfRange
	}

	allowed := map[int]bool{304: true, 412: true, 416: true}
	opts := &requestOptions{allowedStatus: allowed}
	if len(extra) > 0 {
		opts.extraHeaders = extra
	}
	return opts
}

func parseFileMetadataHeaders(resp *http.Response) FileMetadata {
	meta := FileMetadata{
		StatusCode:      resp.StatusCode,
		BlobSHA:         resp.Header.Get("X-Blob-Sha"),
		LastCommitSHA:   resp.Header.Get("X-Last-Commit-Sha"),
		ETag:            resp.Header.Get("ETag"),
		AcceptRanges:    resp.Header.Get("Accept-Ranges"),
		ContentRange:    resp.Header.Get("Content-Range"),
		ContentType:     resp.Header.Get("Content-Type"),
		RawLastModified: resp.Header.Get("Last-Modified"),
	}
	if v := resp.Header.Get("Content-Length"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			meta.Size = n
		}
	}
	if meta.RawLastModified != "" {
		if t, err := http.ParseTime(meta.RawLastModified); err == nil {
			meta.LastModified = t
		}
	}
	return meta
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
	if options.Path != "" {
		params.Set("path", options.Path)
	}
	if options.Recursive != nil {
		params.Set("recursive", strconv.FormatBool(*options.Recursive))
	}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
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

	result := ListFilesResult{
		Paths:      payload.Paths,
		Ref:        payload.Ref,
		NextCursor: payload.NextCursor,
		HasMore:    payload.HasMore,
	}
	if len(payload.Entries) > 0 {
		result.Entries = make([]TreeEntry, 0, len(payload.Entries))
		for _, entry := range payload.Entries {
			result.Entries = append(result.Entries, TreeEntry{
				Path: entry.Path,
				Type: TreeEntryType(entry.Type),
				Mode: entry.Mode,
			})
		}
	}
	return result, nil
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
	if options.Path != "" {
		params.Set("path", options.Path)
	}
	if options.Recursive != nil {
		params.Set("recursive", strconv.FormatBool(*options.Recursive))
	}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
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
		Ref:        payload.Ref,
		Commits:    make(map[string]CommitMetadata, len(payload.Commits)),
		NextCursor: payload.NextCursor,
		HasMore:    payload.HasMore,
	}
	for _, file := range payload.Files {
		result.Files = append(result.Files, FileWithMetadata{
			Path:          file.Path,
			Mode:          file.Mode,
			Size:          file.Size,
			LastCommitSHA: file.LastCommitSHA,
			Type:          TreeEntryType(file.Type),
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
	if ref := preferredString(options.Ref, options.Branch); ref != "" {
		params.Set("ref", ref)
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
	if options.Path != "" {
		params.Set("path", options.Path)
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
			ParentSHAs:     commit.ParentSHAs,
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
	ref := preferredString(options.Ref, options.SHA)
	if ref == "" {
		return GetCommitResult{}, errors.New("getCommit ref is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetCommitResult{}, err
	}

	params := url.Values{}
	params.Set("ref", ref)

	resp, err := r.client.api.get(ctx, "repos/commit", params, jwtToken, nil)
	if err != nil {
		return GetCommitResult{}, err
	}
	defer resp.Body.Close()

	var payload getCommitResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return GetCommitResult{}, err
	}

	commit := CommitInfo{
		SHA:            payload.Commit.SHA,
		ParentSHAs:     payload.Commit.ParentSHAs,
		Message:        payload.Commit.Message,
		AuthorName:     payload.Commit.AuthorName,
		AuthorEmail:    payload.Commit.AuthorEmail,
		CommitterName:  payload.Commit.CommitterName,
		CommitterEmail: payload.Commit.CommitterEmail,
		Date:           parseTime(payload.Commit.Date),
		RawDate:        payload.Commit.Date,
	}
	// Only surface these for signed commits, which carry both the armored
	// signature and the signed payload. If either is missing the commit is
	// treated as unsigned and neither field is set.
	if payload.Commit.Signature != "" && payload.Commit.Payload != "" {
		commit.Signature = payload.Commit.Signature
		commit.Payload = payload.Commit.Payload
	}

	return GetCommitResult{Commit: commit}, nil
}

// GetBlame returns per-line authorship for a file at a ref.
func (r *Repo) GetBlame(ctx context.Context, options BlameOptions) (BlameResult, error) {
	if strings.TrimSpace(options.Path) == "" {
		return BlameResult{}, errors.New("getBlame path is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return BlameResult{}, err
	}

	params := url.Values{}
	params.Set("path", options.Path)
	if ref := strings.TrimSpace(options.Ref); ref != "" {
		params.Set("ref", ref)
	}
	if options.Ephemeral {
		params.Set("ephemeral", "true")
	}
	for _, spec := range options.Ranges {
		params.Add("range", spec)
	}
	if options.DetectMoves {
		params.Set("detect_moves", "true")
	}

	resp, err := r.client.api.get(ctx, "repos/blame", params, jwtToken, nil)
	if err != nil {
		return BlameResult{}, err
	}
	defer resp.Body.Close()

	var payload blameResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return BlameResult{}, err
	}

	result := BlameResult{
		Ref:       payload.Ref,
		Path:      payload.Path,
		CommitSHA: payload.CommitSHA,
		Lines:     make([]BlameLine, len(payload.Lines)),
	}
	for i, line := range payload.Lines {
		result.Lines[i] = BlameLine{
			LineNumber:         line.LineNumber,
			CommitSHA:          line.CommitSHA,
			OriginalLineNumber: line.OriginalLineNumber,
			OriginalPath:       line.OriginalPath,
			PreviousCommitSHA:  line.PreviousCommitSHA,
			AuthorName:         line.AuthorName,
			AuthorEmail:        line.AuthorEmail,
			AuthorTime:         parseTime(line.AuthorTime),
			RawAuthorTime:      line.AuthorTime,
			CommitterName:      line.CommitterName,
			CommitterEmail:     line.CommitterEmail,
			CommitterTime:      parseTime(line.CommitterTime),
			RawCommitterTime:   line.CommitterTime,
			Summary:            line.Summary,
		}
	}

	return result, nil
}

// GetNote reads a git note.
func (r *Repo) GetNote(ctx context.Context, options GetNoteOptions) (GetNoteResult, error) {
	objectRef := preferredString(options.ObjectRef, options.SHA)
	if objectRef == "" {
		return GetNoteResult{}, errors.New("getNote objectRef is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetNoteResult{}, err
	}

	params := url.Values{}
	params.Set("object_ref", objectRef)
	if notesRef := preferredString(options.NotesRef, options.Ref); notesRef != "" {
		params.Set("notes_ref", notesRef)
	}

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
	return r.writeNote(ctx, options.InvocationOptions, "add", preferredString(options.ObjectRef, options.SHA), options.Note, preferredString(options.ExpectedNotesRefSHA, options.ExpectedRefSHA), preferredString(options.NotesRef, options.Ref), options.Author, options.RefPolicies)
}

// AppendNote appends to a git note.
func (r *Repo) AppendNote(ctx context.Context, options AppendNoteOptions) (NoteWriteResult, error) {
	return r.writeNote(ctx, options.InvocationOptions, "append", preferredString(options.ObjectRef, options.SHA), options.Note, preferredString(options.ExpectedNotesRefSHA, options.ExpectedRefSHA), preferredString(options.NotesRef, options.Ref), options.Author, options.RefPolicies)
}

// DeleteNote deletes a git note.
func (r *Repo) DeleteNote(ctx context.Context, options DeleteNoteOptions) (NoteWriteResult, error) {
	objectRef := preferredString(options.ObjectRef, options.SHA)
	if objectRef == "" {
		return NoteWriteResult{}, errors.New("deleteNote objectRef is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
	if err != nil {
		return NoteWriteResult{}, err
	}

	body := &noteWriteRequest{ObjectRef: objectRef}
	if expectedNotesRefSHA := preferredString(options.ExpectedNotesRefSHA, options.ExpectedRefSHA); expectedNotesRefSHA != "" {
		body.ExpectedNotesRefSHA = expectedNotesRefSHA
	}
	if notesRef := preferredString(options.NotesRef, options.Ref); notesRef != "" {
		body.NotesRef = notesRef
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
			partialRefUpdate(result.NotesRef, result.BaseCommit, result.NewRefSHA),
		)
	}
	return result, nil
}

func (r *Repo) writeNote(ctx context.Context, invocation InvocationOptions, action string, objectRef string, note string, expectedNotesRefSHA string, notesRef string, author *NoteAuthor, refPolicies RefPolicyList) (NoteWriteResult, error) {
	objectRef = strings.TrimSpace(objectRef)
	if objectRef == "" {
		return NoteWriteResult{}, errors.New("note objectRef is required")
	}

	note = strings.TrimSpace(note)
	if note == "" {
		return NoteWriteResult{}, errors.New("note content is required")
	}

	ttl := resolveInvocationTTL(invocation, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: refPolicies})
	if err != nil {
		return NoteWriteResult{}, err
	}

	body := &noteWriteRequest{
		ObjectRef: objectRef,
		Action:    action,
		Note:      note,
	}
	if strings.TrimSpace(expectedNotesRefSHA) != "" {
		body.ExpectedNotesRefSHA = expectedNotesRefSHA
	}
	if notesRef := strings.TrimSpace(notesRef); notesRef != "" {
		body.NotesRef = notesRef
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
			partialRefUpdate(result.NotesRef, result.BaseCommit, result.NewRefSHA),
		)
	}
	return result, nil
}

// ListNotesRefs lists git notes refs under a prefix, with cursor pagination.
// Use it to discover custom notes namespaces before reading individual notes.
// It requires the custom notes refs feature to be enabled server-side; when it
// is not, the request fails with an *APIError (HTTP 400).
func (r *Repo) ListNotesRefs(ctx context.Context, options ListNotesRefsOptions) (ListNotesRefsResult, error) {
	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return ListNotesRefsResult{}, err
	}

	params := url.Values{}
	if prefix := strings.TrimSpace(options.Prefix); prefix != "" {
		params.Set("prefix", prefix)
	}
	if options.Cursor != "" {
		params.Set("cursor", options.Cursor)
	}
	if options.Limit > 0 {
		params.Set("limit", itoa(options.Limit))
	}
	if len(params) == 0 {
		params = nil
	}

	resp, err := r.client.api.get(ctx, "repos/notes/refs", params, jwtToken, nil)
	if err != nil {
		return ListNotesRefsResult{}, err
	}
	defer resp.Body.Close()

	var payload listNotesRefsResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return ListNotesRefsResult{}, err
	}

	result := ListNotesRefsResult{HasMore: payload.HasMore, Prefix: payload.Prefix}
	if payload.NextCursor != "" {
		result.NextCursor = payload.NextCursor
	}
	for _, ref := range payload.Refs {
		result.Refs = append(result.Refs, NotesRefInfo{
			Cursor: ref.Cursor,
			Ref:    ref.Ref,
			SHA:    ref.SHA,
		})
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
	ref := preferredString(options.Ref, options.SHA)
	if ref == "" {
		return GetCommitDiffResult{}, errors.New("getCommitDiff ref is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return GetCommitDiffResult{}, err
	}

	params := url.Values{}
	params.Set("ref", ref)
	if baseRef := preferredString(options.BaseRef, options.BaseSHA); baseRef != "" {
		params.Set("base_ref", baseRef)
	}
	if options.RefIsEphemeral != nil {
		params.Set("ref_is_ephemeral", strconv.FormatBool(*options.RefIsEphemeral))
	}
	if options.BaseIsEphemeral != nil {
		params.Set("base_is_ephemeral", strconv.FormatBool(*options.BaseIsEphemeral))
	}
	if options.GitApplyCompatible {
		params.Set("git_apply_compatible", "true")
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
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
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
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
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
	targetBranch := preferredString(options.TargetBranch, options.Name)
	if targetBranch == "" {
		return DeleteBranchResult{}, errors.New("deleteBranch targetBranch is required")
	}
	if strings.HasPrefix(targetBranch, "refs/") {
		return DeleteBranchResult{}, errors.New("deleteBranch targetBranch must not start with refs/")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
	if err != nil {
		return DeleteBranchResult{}, err
	}

	body := &deleteBranchRequest{TargetBranch: targetBranch, Ephemeral: options.Ephemeral}
	resp, err := r.client.api.delete(ctx, "repos/branches", nil, body, jwtToken, nil)
	if err != nil {
		return DeleteBranchResult{}, err
	}
	defer resp.Body.Close()

	var payload deleteBranchResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return DeleteBranchResult{}, err
	}

	resultBranch := preferredResponseString(payload.TargetBranch, payload.Name)
	return DeleteBranchResult{
		TargetBranch: resultBranch,
		Name:         resultBranch,
		Message:      payload.Message,
		Ephemeral:    payload.Ephemeral,
	}, nil
}

// Merge merges a source branch into a target branch.
// Set ExpectedTargetSHA to require the target branch to still point at that commit.
// The server returns 409 if it moved. Leave ExpectedTargetSHA empty to merge into the
// current target tip. Native Code Storage targets may retry stale target/repository
// movement while preserving the resolved source commit.
func (r *Repo) Merge(ctx context.Context, options MergeOptions) (MergeResult, error) {
	sourceRef := preferredString(options.SourceRef, options.SourceBranch)
	if sourceRef == "" {
		return MergeResult{}, errors.New("merge sourceRef is required")
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
	if options.Squash && strategy == MergeStrategyFFOnly {
		return MergeResult{}, errors.New("merge squash is incompatible with the ff_only strategy")
	}

	body := &mergeRequest{
		SourceRef:               sourceRef,
		SourceIsEphemeral:       options.SourceIsEphemeral,
		TargetBranch:            targetBranch,
		TargetIsEphemeral:       options.TargetIsEphemeral,
		Strategy:                string(strategy),
		AllowUnrelatedHistories: options.AllowUnrelatedHistories,
		Squash:                  options.Squash,
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
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
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

	resultSourceRef := preferredResponseString(payload.Source.Ref, payload.Source.Branch)
	return MergeResult{
		Result:    MergeResultStatus(payload.Result),
		CommitSHA: payload.CommitSHA,
		TreeSHA:   payload.TreeSHA,
		Source: MergeRef{
			Ref:       resultSourceRef,
			Branch:    resultSourceRef,
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

// PreviewMerge previews a branch merge without creating commits or updating refs.
func (r *Repo) PreviewMerge(ctx context.Context, options PreviewMergeOptions) (PreviewMergeResult, error) {
	sourceBranch := strings.TrimSpace(options.SourceBranch)
	if sourceBranch == "" {
		return PreviewMergeResult{}, errors.New("previewMerge sourceBranch is required")
	}
	targetBranch := strings.TrimSpace(options.TargetBranch)
	if targetBranch == "" {
		return PreviewMergeResult{}, errors.New("previewMerge targetBranch is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead}, TTL: ttl})
	if err != nil {
		return PreviewMergeResult{}, err
	}

	params := url.Values{}
	params.Set("source_branch", sourceBranch)
	params.Set("target_branch", targetBranch)
	if options.SourceIsEphemeral != nil {
		params.Set("source_is_ephemeral", strconv.FormatBool(*options.SourceIsEphemeral))
	}
	if options.TargetIsEphemeral != nil {
		params.Set("target_is_ephemeral", strconv.FormatBool(*options.TargetIsEphemeral))
	}
	if options.IncludeContent != nil {
		params.Set("include_content", strconv.FormatBool(*options.IncludeContent))
	}

	resp, err := r.client.api.get(ctx, "repos/merge/preview", params, jwtToken, nil)
	if err != nil {
		return PreviewMergeResult{}, err
	}
	defer resp.Body.Close()

	var payload previewMergeResponse
	if err := decodeJSON(resp, &payload); err != nil {
		return PreviewMergeResult{}, err
	}

	result := PreviewMergeResult{
		Status:            PreviewMergeStatus(payload.Status),
		Result:            PreviewMergeResultStatus(payload.Result),
		SourceBranch:      payload.SourceBranch,
		TargetBranch:      payload.TargetBranch,
		SourceTipSHA:      payload.SourceTipSHA,
		TargetTipSHA:      payload.TargetTipSHA,
		MergeBaseSHA:      payload.MergeBaseSHA,
		ConflictPaths:     payload.ConflictPaths,
		FilteredConflicts: make([]PreviewMergeFilteredConflict, 0, len(payload.FilteredConflicts)),
		Conflicts:         make([]PreviewMergeConflict, 0, len(payload.Conflicts)),
	}
	for _, conflict := range payload.Conflicts {
		result.Conflicts = append(result.Conflicts, PreviewMergeConflict{
			Path:   conflict.Path,
			Result: previewMergeBlobResult(conflict.Result),
			Base:   previewMergeBlobResult(conflict.Base),
			Ours:   previewMergeBlobResult(conflict.Ours),
			Theirs: previewMergeBlobResult(conflict.Theirs),
		})
	}
	for _, conflict := range payload.FilteredConflicts {
		result.FilteredConflicts = append(result.FilteredConflicts, PreviewMergeFilteredConflict{
			Path:   conflict.Path,
			Reason: conflict.Reason,
		})
	}

	return result, nil
}

func previewMergeBlobResult(raw previewMergeBlob) PreviewMergeBlob {
	return PreviewMergeBlob{
		OID:       raw.OID,
		Content:   raw.Content,
		Truncated: raw.Truncated,
		Binary:    raw.Binary,
	}
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

	ref := preferredString(options.Ref, options.Target)
	if ref == "" {
		return CreateTagResult{}, errors.New("createTag ref is required")
	}

	ttl := resolveInvocationTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
	if err != nil {
		return CreateTagResult{}, err
	}

	body := &createTagRequest{Name: name, Ref: ref}
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
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitRead, PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
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

	baseRef := preferredString(options.BaseRef, options.TargetCommitSHA)
	if baseRef == "" {
		return RestoreCommitResult{}, errors.New("restoreCommit baseRef is required")
	}

	if strings.TrimSpace(options.Author.Name) == "" || strings.TrimSpace(options.Author.Email) == "" {
		return RestoreCommitResult{}, errors.New("restoreCommit author name and email are required")
	}

	ttl := resolveCommitTTL(options.InvocationOptions, defaultTokenTTL)
	jwtToken, err := r.client.generateJWT(r.ID, RemoteURLOptions{Permissions: []Permission{PermissionGitWrite}, TTL: ttl, RefPolicies: options.RefPolicies})
	if err != nil {
		return RestoreCommitResult{}, err
	}

	metadata := &restoreCommitMetadata{
		TargetBranch: targetBranch,
		BaseRef:      baseRef,
		Author: authorInfo{
			Name:  strings.TrimSpace(options.Author.Name),
			Email: strings.TrimSpace(options.Author.Email),
		},
	}

	if strings.TrimSpace(options.CommitMessage) != "" {
		metadata.CommitMessage = options.CommitMessage
	}
	if expectedTargetSHA := preferredString(options.ExpectedTargetSHA, options.ExpectedHeadSHA); expectedTargetSHA != "" {
		metadata.ExpectedTargetSHA = expectedTargetSHA
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
