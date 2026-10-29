package pierre

import (
	"context"
	"encoding/base64"
	"io"
	"iter"

	"github.com/pierrecomputer/sdk/go/internal/chunks"
	"github.com/pierrecomputer/sdk/go/option"
)

// The public form of the streaming commit writes. The wire form sends a
// metadata line, then the content of each file as base64 chunk lines. These helpers take the
// content itself and write the chunks.

// CommitFile is one file of a commit.
type CommitFile struct {
	// Path is the repository path of the file.
	Path string
	// Operation is upsert or delete. Default: upsert.
	Operation string
	// Mode is the Git file mode. Default: 100644 for an upsert.
	Mode string
	// Content is the file content. An upsert needs Content or Open, and a delete has neither.
	// The SDK reads it when it sends the file, so do not change it before the call returns. The
	// SDK reads it on its own goroutine, so a panic in Read stops the process.
	Content io.Reader
	// Open returns the file content when the SDK sends the file, and the SDK closes it after.
	// The SDK reads every file entry before it sends any content, because the first NDJSON line
	// names every file. So Open keeps only one file open at a time, for example
	// func() (io.ReadCloser, error) { return os.Open(path) }. The SDK calls it on its own
	// goroutine, so a panic in it stops the process.
	Open func() (io.ReadCloser, error)
}

const (
	upsert = "upsert"
	remove = "delete"
)

func createCommit(ctx context.Context, c *core, op *operation, params ReposCommitsCreateParams, opts []option.RequestOption) (*CommitWriteResponse, error) {
	if params.Files != nil && params.FileSeq != nil {
		return nil, newError(nil, "%s: give Files or FileSeq, not both", op.id)
	}
	files := params.Files
	if params.FileSeq != nil {
		// The metadata line names every file, so the SDK reads all of FileSeq first. Each content
		// streams later, and an Open function runs only when the SDK sends its file.
		for file := range params.FileSeq {
			files = append(files, file)
		}
	}
	type entry struct {
		file      CommitFile
		contentID string
	}
	entries := make([]entry, 0, len(files))
	wireFiles := make([]FileOperation, 0, len(files))
	for _, file := range files {
		operationName := file.Operation
		if operationName == "" {
			operationName = upsert
		}
		hasContent := file.Content != nil || file.Open != nil
		if operationName == upsert && !hasContent {
			return nil, newError(nil, "The file %s needs Content or Open.", file.Path)
		}
		if operationName == remove && hasContent {
			return nil, newError(nil, "The delete of %s must not have Content or Open.", file.Path)
		}
		if file.Content != nil && file.Open != nil {
			return nil, newError(nil, "The file %s needs Content or Open, not both.", file.Path)
		}
		contentID := newUUID()
		entries = append(entries, entry{file, contentID})
		wire := FileOperation{Path: file.Path, ContentID: String(contentID), Operation: String(operationName)}
		if operationName == upsert {
			mode := file.Mode
			if mode == "" {
				mode = "100644"
			}
			wire.Mode = String(mode)
		}
		wireFiles = append(wireFiles, wire)
	}
	lines := func(yield func(any, error) bool) {
		for _, e := range entries {
			// A delete has no content.
			content := e.file.Content
			if content == nil && e.file.Open == nil {
				continue
			}
			var closer io.Closer
			if e.file.Open != nil {
				opened, err := e.file.Open()
				if err != nil {
					yield(nil, err)
					return
				}
				content, closer = opened, opened
			}
			stopped := false
			err := chunks.Split(content, chunks.MaxBytes, func(data []byte, eof bool) error {
				line := ReposCommitsCreateLine{BlobChunk: BlobChunk{
					ContentID: e.contentID,
					Data:      base64.StdEncoding.EncodeToString(data),
					EOF:       eof,
				}}
				if !yield(line, nil) {
					stopped = true
					return errStopped
				}
				return nil
			})
			if closer != nil {
				_ = closer.Close()
			}
			if stopped {
				return
			}
			if err != nil {
				yield(nil, err)
				return
			}
		}
	}
	params.Files, params.FileSeq = nil, nil
	return requestJSON[CommitWriteResponse](ctx, c, op, input{
		params: &params,
		extra:  map[string]any{"files": wireFiles},
		lines:  iter.Seq2[any, error](lines),
	}, opts)
}

func createCommitFromDiff(ctx context.Context, c *core, op *operation, params ReposCommitsCreateFromDiffParams, opts []option.RequestOption) (*CommitWriteResponse, error) {
	diff := params.Diff
	if diff == nil {
		return nil, newError(nil, "%s needs Diff", op.id)
	}
	lines := func(yield func(any, error) bool) {
		stopped := false
		err := chunks.Split(diff, chunks.MaxBytes, func(data []byte, eof bool) error {
			line := ReposCommitsCreateFromDiffLine{DiffChunk: DiffChunk{
				Data: base64.StdEncoding.EncodeToString(data),
				EOF:  eof,
			}}
			if !yield(line, nil) {
				stopped = true
				return errStopped
			}
			return nil
		})
		if err != nil && !stopped {
			yield(nil, err)
		}
	}
	params.Diff = nil
	return requestJSON[CommitWriteResponse](ctx, c, op, input{params: &params, lines: lines}, opts)
}

// errStopped ends a split when the transport stops reading the lines.
var errStopped = newError(nil, "the upload stopped")
