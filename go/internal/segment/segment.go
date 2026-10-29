// Package segment encodes one segment of a URL path.
package segment

import (
	"fmt"
	"strings"
)

// Escape percent-encodes each byte except A-Z, a-z, 0-9, and - _ . ! ~ * ' ( ), as the
// encodeURIComponent function of JavaScript does. So / becomes %2F, and the value stays one
// segment.
func Escape(value string) string {
	var out strings.Builder
	for index := range len(value) {
		c := value[index]
		if 'A' <= c && c <= 'Z' || 'a' <= c && c <= 'z' || '0' <= c && c <= '9' || strings.IndexByte("-_.!~*'()", c) >= 0 {
			out.WriteByte(c)
			continue
		}
		fmt.Fprintf(&out, "%%%02X", c)
	}
	return out.String()
}
