// Package chunks splits upload content into the chunks of an NDJSON body.
package chunks

import (
	"bufio"
	"errors"
	"io"
)

// MaxBytes is the largest decoded chunk that the gateway accepts: 4 MiB.
const MaxBytes = 4 * 1024 * 1024

// Split reads content in chunks of at most size bytes, and calls yield for each one. The last
// chunk has eof set, and empty content gives one empty chunk. The bytes of a chunk are valid only
// during the call of yield. An error of the reader or of yield stops the split.
func Split(content io.Reader, size int, yield func(data []byte, eof bool) error) error {
	reader := bufio.NewReader(content)
	buffer := make([]byte, size)
	for {
		n, err := io.ReadFull(reader, buffer)
		switch {
		case errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF):
			return yield(buffer[:n], true)
		case err != nil:
			return err
		}
		// A full chunk is the last one only when no byte follows.
		if _, err := reader.Peek(1); errors.Is(err, io.EOF) {
			return yield(buffer[:n], true)
		} else if err != nil {
			return err
		}
		if err := yield(buffer[:n], false); err != nil {
			return err
		}
	}
}
