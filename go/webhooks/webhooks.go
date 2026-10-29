// Package webhooks verifies a webhook delivery and returns the typed event. It makes no HTTP
// call.
package webhooks

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	pierre "github.com/pierrecomputer/sdk/go"
)

// Event is a webhook event: a pointer to the payload type of an event type of EventTypes, such as
// *pierre.GitPushEvent, or an *UnknownEvent. Branch on its type with a type switch, and handle
// *UnknownEvent in a default branch.
type Event interface {
	// EventType returns the event type, for example repo.sync.failed.
	EventType() string
}

// UnknownEvent is an event of a type that this SDK version does not know, for example a type
// from a newer API version.
type UnknownEvent struct {
	// Type is the event type that Pierre sent.
	Type string
	// Body is the parsed payload, with each number as a json.Number, so a large number keeps its
	// digits. VerifyWebhookParams.Payload holds its bytes.
	Body map[string]any
}

// EventType returns the event type that Pierre sent.
func (e *UnknownEvent) EventType() string { return e.Type }

// VerifyWebhookParams are the parts of a delivery.
type VerifyWebhookParams struct {
	// Payload is the raw request body, before a JSON decode changes its bytes.
	Payload []byte
	// Header holds the request headers. The names do not depend on case.
	Header http.Header
	// Secret is the secret of the webhook subscription.
	Secret string
	// Tolerance is the largest difference between the delivery time and now, 0 or more. Default:
	// 5 minutes. pierre.Value(time.Duration(0)) accepts only a delivery of this second.
	Tolerance pierre.Opt[time.Duration]
}

const defaultTolerance = 300 * time.Second

var (
	digits    = regexp.MustCompile(`^\d+$`)
	hexDigest = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)
)

func reject(reason pierre.WebhookVerificationFailure, format string, args ...any) error {
	return &pierre.WebhookVerificationError{
		PierreError: &pierre.PierreError{Message: fmt.Sprintf(format, args...)},
		Reason:      reason,
	}
}

// VerifyWebhook checks the X-Pierre-Signature header of a delivery: an HMAC-SHA256 of
// <t>.<payload> with the secret, and a timestamp t within the tolerance of now. It returns the
// event, or a *pierre.WebhookVerificationError when the check fails.
//
// The payload of a known type must decode into the Go type of that event. When it does not, for
// example when a field has another JSON type, VerifyWebhook returns invalid_payload. The
// TypeScript SDK does not check the fields, and returns the event.
//
// Docs: search for verifyWebhook in the docs MCP server, https://code.storage/docs/mcp.
func VerifyWebhook(params VerifyWebhookParams) (Event, error) {
	tolerance, given := params.Tolerance.Get()
	if !given {
		tolerance = defaultTolerance
	}
	if tolerance < 0 {
		return nil, &pierre.PierreError{Message: "webhooks.VerifyWebhook: the tolerance must be 0 or more."}
	}
	if params.Secret == "" {
		return nil, &pierre.PierreError{Message: "webhooks.VerifyWebhook: the secret must not be empty."}
	}
	header := headerValue(params.Header, "X-Pierre-Signature")
	if header == "" {
		return nil, reject(pierre.WebhookMissingSignature, "The request has no X-Pierre-Signature header.")
	}
	timestamp, signatures := parseSignature(header)
	if timestamp == "" || len(signatures) == 0 {
		return nil, reject(pierre.WebhookMalformedSignature, "X-Pierre-Signature must have the form t=<unix seconds>,sha256=<hex>.")
	}
	mac := hmac.New(sha256.New, []byte(params.Secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(params.Payload)
	expected := mac.Sum(nil)
	valid := false
	// hmac.Equal compares in constant time.
	for _, signature := range signatures {
		if hmac.Equal(signature, expected) {
			valid = true
		}
	}
	if !valid {
		return nil, reject(pierre.WebhookSignatureMismatch, "The signature does not match the payload and the secret.")
	}
	sent, err := strconv.ParseInt(timestamp, 10, 64)
	age := time.Now().Unix() - sent
	if err != nil || age > int64(tolerance/time.Second) || -age > int64(tolerance/time.Second) {
		return nil, reject(pierre.WebhookTimestampOutOfRange, "The delivery is %d seconds old, and the tolerance is %d seconds.", age, int64(tolerance/time.Second))
	}

	body, ok := decodeObject(params.Payload)
	if !ok {
		return nil, reject(pierre.WebhookInvalidPayload, "The payload is not a JSON object.")
	}
	// A type that is a string, also an empty one, is the type. Older push deliveries have no
	// type. The X-Pierre-Event header is not signed, so the SDK uses it only to name such a push.
	eventType, typed := body["type"].(string)
	if !typed && headerValue(params.Header, "X-Pierre-Event") == "push" {
		eventType = "push"
	}
	if eventType == "" {
		return nil, reject(pierre.WebhookInvalidPayload, "The payload has no event type.")
	}
	event := newEvent(eventType)
	if event == nil {
		return &UnknownEvent{Type: eventType, Body: body}, nil
	}
	if err := json.Unmarshal(params.Payload, event); err != nil {
		return nil, reject(pierre.WebhookInvalidPayload, "The payload of %s does not match its schema: %v", eventType, err)
	}
	return event, nil
}

// decodeObject decodes a JSON object with each number as a json.Number. A float64 would round a
// large integer and reject a number such as 1e400.
func decodeObject(payload []byte) (map[string]any, bool) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()
	var body map[string]any
	if decoder.Decode(&body) != nil || body == nil {
		return nil, false
	}
	// json.Unmarshal rejects data after the value, and Decode does not.
	if _, err := decoder.Token(); err != io.EOF {
		return nil, false
	}
	return body, true
}

// parseSignature reads t=<unix seconds>,sha256=<hex>[,sha256=<hex>...].
func parseSignature(header string) (string, [][]byte) {
	timestamp := ""
	var signatures [][]byte
	for _, element := range strings.Split(header, ",") {
		name, value, _ := strings.Cut(strings.TrimSpace(element), "=")
		if name == "t" && digits.MatchString(value) {
			timestamp = value
		}
		if name == "sha256" && hexDigest.MatchString(value) {
			signature, _ := hex.DecodeString(value)
			signatures = append(signatures, signature)
		}
	}
	return timestamp, signatures
}

// headerValue finds a header with any case of its name, also in a map that a caller built by
// hand.
func headerValue(header http.Header, name string) string {
	if value := header.Get(name); value != "" {
		return value
	}
	for key, values := range header {
		if strings.EqualFold(key, name) && len(values) > 0 {
			return values[0]
		}
	}
	return ""
}
