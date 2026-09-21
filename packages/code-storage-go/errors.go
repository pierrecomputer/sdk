package storage

import (
	"net/http"
	"strings"
)

// APIError describes HTTP errors for non-commit endpoints.
type APIError struct {
	Message    string
	Status     int
	StatusText string
	Method     string
	URL        string
	Body       interface{}
}

func (e *APIError) Error() string {
	return e.Message
}

// RefUpdateReason describes a ref update failure reason.
type RefUpdateReason string

const (
	RefUpdateReasonPreconditionFailed RefUpdateReason = "precondition_failed"
	RefUpdateReasonConflict           RefUpdateReason = "conflict"
	RefUpdateReasonNotFound           RefUpdateReason = "not_found"
	RefUpdateReasonInvalid            RefUpdateReason = "invalid"
	RefUpdateReasonTimeout            RefUpdateReason = "timeout"
	RefUpdateReasonUnauthorized       RefUpdateReason = "unauthorized"
	RefUpdateReasonForbidden          RefUpdateReason = "forbidden"
	RefUpdateReasonUnavailable        RefUpdateReason = "unavailable"
	RefUpdateReasonInternal           RefUpdateReason = "internal"
	RefUpdateReasonFailed             RefUpdateReason = "failed"
	RefUpdateReasonUnknown            RefUpdateReason = "unknown"
)

// MergeGuard identifies the ref protected by a failed merge guard.
type MergeGuard string

const (
	MergeGuardTarget MergeGuard = "target"
	MergeGuardSource MergeGuard = "source"
)

// RefUpdateError describes failed ref updates.
type RefUpdateError struct {
	Message       string
	Status        string
	Reason        RefUpdateReason
	RefUpdate     *RefUpdate
	Guard         MergeGuard
	ExpectedSHA   string
	ActualSHA     string
	ConflictPaths []string
	MergeBaseSHA  string
}

func parseMergeRefUpdateError(apiErr *APIError) *RefUpdateError {
	if apiErr == nil || apiErr.Status != http.StatusConflict {
		return nil
	}
	body, ok := apiErr.Body.(map[string]interface{})
	if !ok {
		return nil
	}
	code, ok := body["code"].(string)
	if !ok {
		return nil
	}

	switch code {
	case "merge_conflict":
		paths, ok := mergeErrorStringSlice(body, "conflict_paths")
		if !ok {
			return nil
		}
		mergeBaseSHA, ok := mergeErrorOptionalString(body, "merge_base_sha")
		if !ok {
			return nil
		}
		return &RefUpdateError{
			Message:       apiErr.Message,
			Status:        code,
			Reason:        RefUpdateReasonConflict,
			ConflictPaths: paths,
			MergeBaseSHA:  mergeBaseSHA,
		}
	case "precondition_failed":
		guard, ok := body["guard"].(string)
		if !ok || (guard != string(MergeGuardTarget) && guard != string(MergeGuardSource)) {
			return nil
		}
		expectedSHA, expectedOK := body["expected_sha"].(string)
		actualSHA, actualOK := body["actual_sha"].(string)
		if !expectedOK || !actualOK {
			return nil
		}
		return &RefUpdateError{
			Message:     apiErr.Message,
			Status:      code,
			Reason:      RefUpdateReasonPreconditionFailed,
			Guard:       MergeGuard(guard),
			ExpectedSHA: expectedSHA,
			ActualSHA:   actualSHA,
		}
	default:
		return nil
	}
}

func mergeErrorStringSlice(body map[string]interface{}, key string) ([]string, bool) {
	value, exists := body[key]
	if !exists {
		return []string{}, true
	}
	items, ok := value.([]interface{})
	if !ok {
		return nil, false
	}
	result := make([]string, len(items))
	for i, item := range items {
		result[i], ok = item.(string)
		if !ok {
			return nil, false
		}
	}
	return result, true
}

func mergeErrorOptionalString(body map[string]interface{}, key string) (string, bool) {
	value, exists := body[key]
	if !exists {
		return "", true
	}
	result, ok := value.(string)
	return result, ok
}

func (e *RefUpdateError) Error() string {
	return e.Message
}

func inferRefUpdateReason(status string) RefUpdateReason {
	if strings.TrimSpace(status) == "" {
		return RefUpdateReasonUnknown
	}

	switch strings.ToLower(strings.TrimSpace(status)) {
	case "precondition_failed":
		return RefUpdateReasonPreconditionFailed
	case "conflict":
		return RefUpdateReasonConflict
	case "not_found":
		return RefUpdateReasonNotFound
	case "invalid":
		return RefUpdateReasonInvalid
	case "timeout":
		return RefUpdateReasonTimeout
	case "unauthorized":
		return RefUpdateReasonUnauthorized
	case "forbidden":
		return RefUpdateReasonForbidden
	case "unavailable":
		return RefUpdateReasonUnavailable
	case "internal":
		return RefUpdateReasonInternal
	case "failed":
		return RefUpdateReasonFailed
	case "ok":
		return RefUpdateReasonUnknown
	default:
		return RefUpdateReasonUnknown
	}
}

func newRefUpdateError(message string, status string, refUpdate *RefUpdate) *RefUpdateError {
	return &RefUpdateError{
		Message:   message,
		Status:    status,
		Reason:    inferRefUpdateReason(status),
		RefUpdate: refUpdate,
	}
}
