package pierre

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// errorCodesDocURL is the docs page with the table of problem codes, in the Markdown form for
// agents.
const errorCodesDocURL = "https://code.storage/docs/api/overview.md#error-codes"

// PierreError is the base of every error that the SDK returns. Each error type
// of the SDK unwraps to it, so errors.As with a *PierreError matches each one. A failure of the
// caller's own function, such as a content reader, and the end of the caller's context reach the
// caller as they are.
type PierreError struct {
	Message string
	// Err is the cause, or nil.
	Err error
}

func (e *PierreError) Error() string { return e.Message }

func (e *PierreError) Unwrap() error { return e.Err }

func newError(cause error, format string, args ...any) *PierreError {
	return &PierreError{Message: fmt.Sprintf(format, args...), Err: cause}
}

// APIConnectionError means that the request got no response.
type APIConnectionError struct{ *PierreError }

func (e *APIConnectionError) Unwrap() error { return e.PierreError }

// APITimeoutError means that the request got no response before the timeout of the attempt. It
// unwraps to an *APIConnectionError.
type APITimeoutError struct{ *APIConnectionError }

func (e *APITimeoutError) Unwrap() error { return e.APIConnectionError }

// APIError is an HTTP error response. Branch on Code, not on the message. A status family has its
// own type, which unwraps to the *APIError: BadRequestError, AuthenticationError,
// PermissionDeniedError, NotFoundError, ConflictError, RateLimitError, and InternalServerError.
type APIError struct {
	*PierreError
	Status int
	// Code is the problem code, for example repository_not_found.
	Code   string
	Title  string
	Detail string
	// RequestID is the X-Request-Id response header, or empty when the server does not send it.
	RequestID string
	// Headers are the headers of the error response, for example Retry-After.
	Headers http.Header
	// Body is the response body as it arrived: the problem object with its extension members.
	Body json.RawMessage
	// DocURL is the docs page that explains the codes.
	DocURL string
}

func (e *APIError) Unwrap() error { return e.PierreError }

// BadRequestError is a 400 response.
type BadRequestError struct{ *APIError }

func (e *BadRequestError) Unwrap() error { return e.APIError }

// AuthenticationError is a 401 response.
type AuthenticationError struct{ *APIError }

func (e *AuthenticationError) Unwrap() error { return e.APIError }

// PermissionDeniedError is a 403 response.
type PermissionDeniedError struct{ *APIError }

func (e *PermissionDeniedError) Unwrap() error { return e.APIError }

// NotFoundError is a 404 response.
type NotFoundError struct{ *APIError }

func (e *NotFoundError) Unwrap() error { return e.APIError }

// ConflictError is a 409 response.
type ConflictError struct{ *APIError }

func (e *ConflictError) Unwrap() error { return e.APIError }

// RateLimitError is a 429 response.
type RateLimitError struct{ *APIError }

func (e *RateLimitError) Unwrap() error { return e.APIError }

// InternalServerError is a 5xx response.
type InternalServerError struct{ *APIError }

func (e *InternalServerError) Unwrap() error { return e.APIError }

// MergeConflictError is a merge conflict. It carries the conflict fields of the response, and
// unwraps to a *ConflictError.
type MergeConflictError struct {
	*ConflictError
	ConflictType  string
	ConflictPaths []string
	MergeBaseSHA  string
}

func (e *MergeConflictError) Unwrap() error { return e.ConflictError }

// RefGuardError is a Git write whose ref guard failed: a response with the code ref_guard_failed.
// Guard names the request field of the guard, for example expected_target_sha. CurrentSHA is the
// commit of the guarded ref, or 40 zeros when the ref does not exist; send it as the guard of the
// next attempt. The body of a commit write, a restore, or a notes write also keeps result, which
// Body holds. It unwraps to a *ConflictError.
type RefGuardError struct {
	*ConflictError
	Guard      string
	CurrentSHA string
}

func (e *RefGuardError) Unwrap() error { return e.ConflictError }

// RefUpdateError is a Git write whose ref update failed: an error response whose body has
// result. A Git write method returns only when the ref update succeeded. Body holds the response
// as it arrived.
type RefUpdateError struct {
	*APIError
	// Result is the result of the ref update. Status gives the reason, for example conflict or
	// precondition_failed. A notes write sends only Success, Status, and Message.
	Result RefUpdateResult
	// Commit is the commit of the write, or nil when the response has none. A restore sends no
	// BlobCount.
	Commit *WrittenCommit
}

func (e *RefUpdateError) Unwrap() error { return e.APIError }

// WebhookVerificationFailure is the reason that webhooks.VerifyWebhook rejected a delivery.
type WebhookVerificationFailure string

const (
	WebhookMissingSignature    WebhookVerificationFailure = "missing_signature"
	WebhookMalformedSignature  WebhookVerificationFailure = "malformed_signature"
	WebhookSignatureMismatch   WebhookVerificationFailure = "signature_mismatch"
	WebhookTimestampOutOfRange WebhookVerificationFailure = "timestamp_out_of_range"
	WebhookInvalidPayload      WebhookVerificationFailure = "invalid_payload"
)

// WebhookVerificationError means that webhooks.VerifyWebhook rejected a delivery.
type WebhookVerificationError struct {
	*PierreError
	Reason WebhookVerificationFailure
}

func (e *WebhookVerificationError) Unwrap() error { return e.PierreError }

// mergeConflictCodes are the codes of a merge conflict. Today the conflict body can also have
// conflict_type only.
var mergeConflictCodes = map[string]bool{"merge_conflict": true}

// refGuardFailed is the code of a failed ref guard. Its body can also have result, so it is read
// first.
const refGuardFailed = "ref_guard_failed"

// problem is the part of a problem details body that the error types read.
type problem struct {
	Code          any             `json:"code"`
	Title         any             `json:"title"`
	Detail        any             `json:"detail"`
	Error         any             `json:"error"`
	Message       any             `json:"message"`
	Result        json.RawMessage `json:"result"`
	Commit        json.RawMessage `json:"commit"`
	ConflictType  any             `json:"conflict_type"`
	ConflictPaths []string        `json:"conflict_paths"`
	MergeBaseSHA  any             `json:"merge_base_sha"`
	Guard         any             `json:"guard"`
	CurrentSHA    any             `json:"current_sha"`
}

func text(value any) string {
	s, _ := value.(string)
	return s
}

// problemOf reads the problem object of a body. A body that is not a JSON object gives no field.
func problemOf(body []byte) (problem, bool) {
	var p problem
	ok := decodeMembers(body, &p)
	return p, ok
}

// decodeMembers decodes each member of a JSON object into v on its own, so that a member of
// another type, such as a number code, gives only an empty field. It is false when raw is not a
// JSON object.
func decodeMembers(raw []byte, v any) bool {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return false
	}
	for name, member := range fields {
		single, _ := json.Marshal(map[string]json.RawMessage{name: member})
		_ = json.Unmarshal(single, v)
	}
	return true
}

// apiError picks the error type of an error response from the status and the body.
func apiError(status int, body []byte, headers http.Header) error {
	p, _ := problemOf(body)
	code := text(p.Code)
	detail := text(p.Detail)
	if detail == "" {
		detail = text(p.Error)
	}
	if detail == "" {
		detail = text(p.Message)
	}
	summary := detail
	if summary == "" {
		summary = text(p.Title)
	}
	if summary == "" {
		summary = "request failed"
	}
	message := fmt.Sprintf("%d: %s", status, summary)
	if code != "" {
		message = fmt.Sprintf("%d %s: %s", status, code, summary)
	}
	if headers == nil {
		headers = http.Header{}
	}
	base := &APIError{
		PierreError: newError(nil, "%s", message),
		Status:      status,
		Code:        code,
		Title:       text(p.Title),
		Detail:      detail,
		RequestID:   headers.Get("X-Request-Id"),
		Headers:     headers,
		Body:        json.RawMessage(body),
		DocURL:      errorCodesDocURL,
	}
	if code == refGuardFailed {
		return &RefGuardError{
			ConflictError: &ConflictError{base},
			Guard:         text(p.Guard),
			CurrentSHA:    text(p.CurrentSHA),
		}
	}
	var result RefUpdateResult
	if decodeMembers(p.Result, &result) {
		update := &RefUpdateError{APIError: base, Result: result}
		var commit WrittenCommit
		if decodeMembers(p.Commit, &commit) {
			update.Commit = &commit
		}
		return update
	}
	if mergeConflictCodes[code] || text(p.ConflictType) != "" {
		return &MergeConflictError{
			ConflictError: &ConflictError{base},
			ConflictType:  text(p.ConflictType),
			ConflictPaths: p.ConflictPaths,
			MergeBaseSHA:  text(p.MergeBaseSHA),
		}
	}
	switch {
	case status == http.StatusBadRequest:
		return &BadRequestError{base}
	case status == http.StatusUnauthorized:
		return &AuthenticationError{base}
	case status == http.StatusForbidden:
		return &PermissionDeniedError{base}
	case status == http.StatusNotFound:
		return &NotFoundError{base}
	case status == http.StatusConflict:
		return &ConflictError{base}
	case status == http.StatusTooManyRequests:
		return &RateLimitError{base}
	case status >= 500:
		return &InternalServerError{base}
	}
	return base
}
