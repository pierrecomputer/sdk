// Package retry holds the retry rules: which results are transient, and how long to wait before
// the next attempt.
package retry

import (
	"context"
	"math/rand/v2"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	// initialDelay is the first backoff delay.
	initialDelay = 500 * time.Millisecond
	// maxBackoff is the longest backoff delay.
	maxBackoff = 8 * time.Second
	// maxRetryAfter is the longest Retry-After that the SDK waits. A longer value falls back to
	// the backoff.
	maxRetryAfter = 60 * time.Second
)

// Transient reports whether an error status can succeed on a repeat: 408, 429, 5xx, or a 409
// with the code of a condition that ends by itself.
func Transient(status int, code string) bool {
	return status == http.StatusRequestTimeout ||
		status == http.StatusTooManyRequests ||
		status >= 500 ||
		(status == http.StatusConflict && (code == "repository_thawing" || code == "sync_in_progress"))
}

// seconds is the form of a Retry-After value in seconds.
var seconds = regexp.MustCompile(`^\d+(\.\d+)?$`)

// httpDate is the IMF-fixdate form that servers send (RFC 9110), for example
// Sun, 06 Nov 1994 08:49:37 GMT.
var httpDate = regexp.MustCompile(`^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$`)

// Delay is the wait before retry number attempt+1: the Retry-After value when it is 60 seconds or
// less, or else an exponential backoff from 0.5 seconds, up to 8 seconds, less up to 25% jitter.
func Delay(retryAfter string, attempt int, now time.Time) time.Duration {
	if after, ok := retryAfterDelay(retryAfter, now); ok && after <= maxRetryAfter {
		return after
	}
	backoff := maxBackoff
	if attempt < 5 {
		backoff = min(initialDelay<<attempt, maxBackoff)
	}
	return time.Duration(float64(backoff) * (1 - rand.Float64()*0.25))
}

func retryAfterDelay(value string, now time.Time) (time.Duration, bool) {
	text := strings.TrimSpace(value)
	if seconds.MatchString(text) {
		parsed, err := strconv.ParseFloat(text, 64)
		if err != nil {
			return 0, false
		}
		// A long value only falls back to the backoff, so it needs no exact duration.
		if parsed > maxRetryAfter.Seconds() {
			return maxRetryAfter + time.Second, true
		}
		return time.Duration(parsed * float64(time.Second)), true
	}
	if !httpDate.MatchString(text) {
		return 0, false
	}
	date, err := http.ParseTime(text)
	if err != nil {
		return 0, false
	}
	return max(0, date.Sub(now)), true
}

// Sleep waits d, or returns the cause of ctx when it ends first.
func Sleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}
