package pierre

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/pierrecomputer/sdk/go/internal/config"
	"github.com/pierrecomputer/sdk/go/internal/credentials"
	"github.com/pierrecomputer/sdk/go/internal/retry"
	"github.com/pierrecomputer/sdk/go/option"
)

// The facts of one operation, from the SDK model. The generated layer defines one for each
// operation, and the runtime reads it to send the request.

type bodyKind uint8

const (
	bodyNone bodyKind = iota
	bodyJSON
	bodyNDJSON
)

type responseKind uint8

const (
	responseJSON responseKind = iota
	responseBytes
	responseNone
)

type operation struct {
	id     string
	method string
	path   string
	body   bodyKind
	// bodyRequired is false for an optional JSON body, which the SDK sends only with a field.
	bodyRequired bool
	// firstLine is the key of the first NDJSON line, for example metadata.
	firstLine string
	response  responseKind
	// notModified is true when a 304 response is a result, not an error.
	notModified bool
	scopes      []string
	// repoClaim is true when the token needs a repo claim.
	repoClaim bool
	// itemField is the response field of the items of a list, or empty.
	itemField      string
	idempotencyKey bool
}

// input is the params of a call, with the parts that a helper adds.
type input struct {
	// params is a pointer to the params struct.
	params any
	// extra holds body fields that a helper fills, for example the wire files of a commit.
	extra map[string]any
	// lines gives each NDJSON line after the first line.
	lines iter.Seq2[any, error]
}

// safeMethods are the methods that the SDK can repeat.
var safeMethods = map[string]bool{"GET": true, "HEAD": true, "PUT": true, "DELETE": true}

// errAttemptTimeout is the cause of the context of an attempt that passed its timeout.
var errAttemptTimeout = errors.New("pierre: the attempt timed out")

// call is a prepared request, which each attempt sends.
type call struct {
	op  *operation
	url *url.URL
	// headers are the headers without the token and the request headers.
	headers http.Header
	// body is the JSON body, which each attempt can send again.
	body []byte
	// first is the first NDJSON line, and lines gives the next lines. An NDJSON body is a stream,
	// so it is sent once.
	first          []byte
	lines          iter.Seq2[any, error]
	token          config.TokenRequest
	requestHeaders http.Header
	timeout        time.Duration
	maxRetries     int
	repeatable     bool
	responseInto   **http.Response
	// generatedKey is true when the SDK made the Idempotency-Key, so each request gets its own.
	generatedKey bool
}

// received is the response of the last attempt.
type received struct {
	response *http.Response
	// body is the body of a JSON response.
	body []byte
}

// requestOptions applies the options of one call.
func requestOptions(opts []option.RequestOption) (config.Options, error) {
	options := config.Options{Request: true}
	if err := config.Apply(&options, opts); err != nil {
		return options, newError(nil, "%s", err.Error())
	}
	return options, nil
}

// prepare checks the options and the params of a call, and builds its request.
func (c *core) prepare(op *operation, in input, opts []option.RequestOption) (*call, error) {
	options, err := requestOptions(opts)
	if err != nil {
		return nil, err
	}
	ttl := credentials.RequestTokenTTL
	if options.TokenTTL != nil {
		ttl = *options.TokenTTL
	}
	// A request option replaces the client option.
	refPolicies := c.refPolicies
	if options.RefPolicies != nil {
		refPolicies = *options.RefPolicies
	}
	if len(refPolicies) > 0 && c.source.Fixed() {
		return nil, newError(nil, "A client with a fixed token cannot use ref policies. Give option.WithPrivateKey or option.WithGetToken.")
	}
	timeout := c.timeout
	if options.Timeout != nil {
		timeout = *options.Timeout
	}
	maxRetries := c.maxRetries
	if options.MaxRetries != nil {
		maxRetries = *options.MaxRetries
	}
	var idempotencyKey string
	if options.IdempotencyKey != nil {
		// The server ignores a key that the operation does not accept, so a retry could repeat the
		// write.
		if !op.idempotencyKey {
			return nil, newError(nil, "%s does not accept an idempotency key.", op.id)
		}
		idempotencyKey = *options.IdempotencyKey
	} else if op.idempotencyKey {
		idempotencyKey = newUUID()
	}

	w, err := encode(op, in.params, in.extra)
	if err != nil {
		return nil, err
	}
	if op.repoClaim && w.repo == "" {
		return nil, newError(nil, "%s needs repo_name", op.id)
	}
	path, err := expandPath(op, w.path)
	if err != nil {
		return nil, err
	}
	target, err := url.Parse(strings.TrimRight(c.baseURL, "/") + path)
	if err != nil {
		return nil, newError(err, "%s: the SDK cannot build the URL: %v", op.id, err)
	}
	target.RawQuery = w.query.Encode()

	// The default headers come after Pierre-Client, so a client such as the CLI can name itself.
	// The token comes later, and the request headers come last (attempt).
	headers := http.Header{}
	headers.Set("Pierre-Client", c.clientName)
	if op.response == responseJSON {
		headers.Set("Accept", "application/json")
	} else {
		headers.Set("Accept", "*/*")
	}
	for name, values := range c.headers {
		headers[name] = append([]string{}, values...)
	}
	for name, values := range w.header {
		headers[name] = values
	}
	if idempotencyKey != "" {
		headers.Set("Idempotency-Key", idempotencyKey)
	}

	request := &call{
		op:             op,
		url:            target,
		headers:        headers,
		requestHeaders: options.Headers,
		timeout:        timeout,
		maxRetries:     maxRetries,
		responseInto:   options.ResponseInto,
		generatedKey:   op.idempotencyKey && options.IdempotencyKey == nil,
		// Each attempt signs a new token with the same policies.
		token: config.TokenRequest{Scopes: op.scopes, TTL: ttl, RefPolicies: nonEmpty(refPolicies)},
	}
	if op.repoClaim {
		request.token.Repo = w.repo
	}
	switch {
	case op.body == bodyNDJSON:
		headers.Set("Content-Type", "application/x-ndjson")
		first, err := json.Marshal(map[string]json.RawMessage{op.firstLine: w.body})
		if err != nil {
			return nil, newError(err, "%s: the SDK cannot encode the first line: %v", op.id, err)
		}
		request.first = append(first, '\n')
		request.lines = in.lines
	case w.body != nil:
		headers.Set("Content-Type", "application/json")
		request.body = w.body
	}
	// The SDK cannot send a stream twice, so a streaming body never retries.
	request.repeatable = request.first == nil && (safeMethods[op.method] || idempotencyKey != "")
	return request, nil
}

func nonEmpty(policies []config.RefPolicy) []config.RefPolicy {
	if len(policies) == 0 {
		return nil
	}
	return policies
}

// send sends the request with its retries, and returns the response of the last attempt.
func (c *core) send(ctx context.Context, request *call) (*received, error) {
	for attempt := 0; ; attempt++ {
		outcome := c.attempt(ctx, request)
		// The destination holds the response of the last attempt, or nil when it got none.
		if request.responseInto != nil {
			*request.responseInto = nil
			if outcome.received != nil {
				*request.responseInto = outcome.received.response
			}
		}
		if outcome.err == nil {
			return outcome.received, nil
		}
		if !request.repeatable || !outcome.transient || attempt >= request.maxRetries {
			return nil, outcome.err
		}
		if err := retry.Sleep(ctx, retry.Delay(outcome.retryAfter, attempt, time.Now())); err != nil {
			return nil, err
		}
	}
}

type outcome struct {
	received   *received
	err        error
	transient  bool
	retryAfter string
}

// bodyFailure records the first error of the caller's content, for example of a file reader.
type bodyFailure struct {
	mu  sync.Mutex
	err error
}

func (f *bodyFailure) set(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err == nil {
		f.err = err
	}
}

func (f *bodyFailure) get() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.err
}

// attempt gets the token and sends one attempt. The timeout and the context of the call cover
// both steps.
func (c *core) attempt(ctx context.Context, request *call) outcome {
	op := request.op
	attemptCtx, cancel := context.WithCancelCause(ctx)
	timer := time.AfterFunc(request.timeout, func() { cancel(errAttemptTimeout) })
	// A byte stream keeps the context until the caller closes the body.
	keep := false
	defer func() {
		if !keep {
			timer.Stop()
			cancel(nil)
		}
	}()
	failure := &bodyFailure{}
	// stopped classifies an error after the context of the attempt can have ended.
	timedOut := func(err error) outcome {
		return outcome{
			err:       &APITimeoutError{&APIConnectionError{newError(err, "%s: no response within %s", op.id, request.timeout)}},
			transient: true,
		}
	}
	stopped := func(err error) outcome {
		if ctx.Err() != nil {
			// The caller stopped the call: no retry.
			return outcome{err: context.Cause(ctx)}
		}
		if errors.Is(context.Cause(attemptCtx), errAttemptTimeout) {
			return timedOut(err)
		}
		// The caller's content failed, not the connection: give its own error.
		if content := failure.get(); content != nil {
			return outcome{err: content}
		}
		return outcome{err: &APIConnectionError{newError(err, "%s: %v", op.id, err)}, transient: true}
	}

	token, err := c.source.Token(attemptCtx, request.token)
	if err != nil {
		if ctx.Err() != nil || errors.Is(context.Cause(attemptCtx), errAttemptTimeout) {
			return stopped(err)
		}
		return outcome{err: sdkError(err)}
	}

	var body io.Reader
	switch {
	case request.first != nil:
		reader, writer := io.Pipe()
		go writeLines(writer, request.first, request.lines, failure)
		// Closing the reader ends the writer when the transport stops early.
		defer reader.Close()
		body = reader
	case request.body != nil:
		body = bytes.NewReader(request.body)
	}
	httpRequest, err := http.NewRequestWithContext(attemptCtx, op.method, request.url.String(), body)
	if err != nil {
		return outcome{err: newError(err, "%s: the SDK cannot build the request: %v", op.id, err)}
	}
	httpRequest.Header = request.headers.Clone()
	httpRequest.Header.Set("Authorization", "Bearer "+token)
	for name, values := range request.requestHeaders {
		httpRequest.Header[name] = append([]string{}, values...)
	}

	response, err := c.httpClient.Do(httpRequest)
	if err != nil {
		return stopped(err)
	}
	status := response.StatusCode
	if (status >= 200 && status < 300) || (status == http.StatusNotModified && op.notModified) {
		switch op.response {
		case responseJSON:
			// The timeout covers a JSON body that the SDK reads, so a failed read retries.
			data, err := io.ReadAll(response.Body)
			response.Body.Close()
			// The response arrived, so option.WithResponseInto gets it also when its body fails.
			response.Body = io.NopCloser(bytes.NewReader(data))
			got := &received{response: response, body: data}
			if err != nil {
				failed := stopped(err)
				failed.received = got
				return failed
			}
			if !json.Valid(data) {
				return outcome{received: got, err: newError(nil, "%s: the response body is not JSON", op.id)}
			}
			return outcome{received: got}
		case responseBytes:
			// The timeout ends with the headers, so the caller can read a slow body.
			if !timer.Stop() {
				// The timer fired, also when its function has not cancelled the context yet.
				response.Body.Close()
				if ctx.Err() != nil {
					return outcome{err: context.Cause(ctx)}
				}
				return timedOut(errAttemptTimeout)
			}
			keep = true
			response.Body = &streamBody{ReadCloser: response.Body, done: func() { cancel(nil) }}
			return outcome{received: &received{response: response}}
		default:
			_, _ = io.Copy(io.Discard, response.Body)
			response.Body.Close()
			response.Body = http.NoBody
			return outcome{received: &received{response: response}}
		}
	}
	data, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil {
		return stopped(err)
	}
	response.Body = io.NopCloser(bytes.NewReader(data))
	p, _ := problemOf(data)
	return outcome{
		received:   &received{response: response},
		err:        apiError(status, data, response.Header),
		transient:  retry.Transient(status, text(p.Code)),
		retryAfter: response.Header.Get("Retry-After"),
	}
}

// streamBody ends the context of its attempt when the caller closes it.
type streamBody struct {
	io.ReadCloser
	once sync.Once
	done func()
}

func (b *streamBody) Close() error {
	err := b.ReadCloser.Close()
	b.once.Do(b.done)
	return err
}

// writeLines writes the NDJSON body: the first line, then each line of lines.
func writeLines(writer *io.PipeWriter, first []byte, lines iter.Seq2[any, error], failure *bodyFailure) {
	if _, err := writer.Write(first); err != nil {
		writer.CloseWithError(err)
		return
	}
	if lines != nil {
		for line, err := range lines {
			if err != nil {
				failure.set(err)
				writer.CloseWithError(err)
				return
			}
			data, err := json.Marshal(line)
			if err != nil {
				failure.set(err)
				writer.CloseWithError(err)
				return
			}
			if _, err := writer.Write(append(data, '\n')); err != nil {
				writer.CloseWithError(err)
				return
			}
		}
	}
	writer.Close()
}

// sdkError gives a failure of the SDK as a PierreError, and any other error as it is.
func sdkError(err error) error {
	var failure *credentials.Error
	if errors.As(err, &failure) {
		return newError(failure.Err, "%s", failure.Message)
	}
	return err
}

// readToken returns a token with git:read on another repository, for example the source of a
// copy, with the lifetime of a request token. The timeout and the context cover it.
func (c *core) readToken(ctx context.Context, repo string, opts []option.RequestOption) (string, error) {
	if c.source.Fixed() {
		return "", newError(nil, "A client with a fixed token cannot make a token for another repository. Give that token in the params.")
	}
	options, err := requestOptions(opts)
	if err != nil {
		return "", err
	}
	ttl := credentials.RequestTokenTTL
	if options.TokenTTL != nil {
		ttl = *options.TokenTTL
	}
	timeout := c.timeout
	if options.Timeout != nil {
		timeout = *options.Timeout
	}
	tokenCtx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	timer := time.AfterFunc(timeout, func() { cancel(errAttemptTimeout) })
	defer timer.Stop()
	token, err := c.source.Token(tokenCtx, config.TokenRequest{Scopes: []string{"git:read"}, Repo: repo, TTL: ttl})
	if err != nil {
		if ctx.Err() != nil {
			return "", context.Cause(ctx)
		}
		if errors.Is(context.Cause(tokenCtx), errAttemptTimeout) {
			return "", &APITimeoutError{&APIConnectionError{newError(err, "no token for %s within %s", repo, timeout)}}
		}
		return "", sdkError(err)
	}
	return token, nil
}

// newUUID returns a random UUID, version 4.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// The entry points of the generated methods. Each one sends one call and gives the result in
// the form of the response encoding.

func requestJSON[T any](ctx context.Context, c *core, op *operation, in input, opts []option.RequestOption) (*T, error) {
	request, err := c.prepare(op, in, opts)
	if err != nil {
		return nil, err
	}
	got, err := c.send(ctx, request)
	if err != nil {
		return nil, err
	}
	var result T
	if err := json.Unmarshal(got.body, &result); err != nil {
		return nil, newError(err, "%s: the SDK cannot decode the response body: %v", op.id, err)
	}
	return &result, nil
}

// requestBytes gives the response body as a stream. The caller closes it.
func requestBytes(ctx context.Context, c *core, op *operation, in input, opts []option.RequestOption) (io.ReadCloser, error) {
	request, err := c.prepare(op, in, opts)
	if err != nil {
		return nil, err
	}
	got, err := c.send(ctx, request)
	if err != nil {
		return nil, err
	}
	return got.response.Body, nil
}

// HeadersResult is the result of an operation whose response has no body: the status and the
// response headers that the document declares. Headers has a field for each declared header,
// and is an empty struct when the document declares none.
type HeadersResult[H any] struct {
	Status  int
	Headers H
}

func requestHeaders[H any](ctx context.Context, c *core, op *operation, in input, opts []option.RequestOption) (*HeadersResult[H], error) {
	request, err := c.prepare(op, in, opts)
	if err != nil {
		return nil, err
	}
	got, err := c.send(ctx, request)
	if err != nil {
		return nil, err
	}
	result := &HeadersResult[H]{Status: got.response.StatusCode}
	fillHeaders(&result.Headers, got.response.Header)
	return result, nil
}

// requestList gives the first page of a list. Each next page sends the params and the request
// options of the first call, with the next cursor.
func requestList[Item, Body any](ctx context.Context, c *core, op *operation, in input, opts []option.RequestOption) (*Page[Item, Body], error) {
	request, err := c.prepare(op, in, opts)
	if err != nil {
		return nil, err
	}
	var fetch func(ctx context.Context, request *call) (*Page[Item, Body], error)
	fetch = func(ctx context.Context, request *call) (*Page[Item, Body], error) {
		got, err := c.send(ctx, request)
		if err != nil {
			return nil, err
		}
		page, err := decodePage[Item, Body](op, got)
		if err != nil {
			return nil, err
		}
		page.next = func(ctx context.Context, cursor string) (*Page[Item, Body], error) {
			return fetch(ctx, request.withCursor(cursor))
		}
		return page, nil
	}
	return fetch(ctx, request)
}

// withCursor is a copy of a list call with another cursor.
func (request *call) withCursor(cursor string) *call {
	copied := *request
	target := *request.url
	query := target.Query()
	query.Set("cursor", cursor)
	target.RawQuery = query.Encode()
	copied.url = &target
	// option.WithResponseInto gives the response of the first page. Each page
	// holds its own response in Page.Response.
	copied.responseInto = nil
	// A page is a new request, so it gets a new key, as each call does. Its retries keep the key.
	if request.generatedKey {
		copied.headers = request.headers.Clone()
		copied.headers.Set("Idempotency-Key", newUUID())
	}
	return &copied
}

// lineSeq gives the Chunks of a params struct as the NDJSON lines of the runtime.
func lineSeq[T any](chunks iter.Seq[T]) iter.Seq2[any, error] {
	if chunks == nil {
		return nil
	}
	return func(yield func(any, error) bool) {
		for chunk := range chunks {
			if !yield(chunk, nil) {
				return
			}
		}
	}
}
