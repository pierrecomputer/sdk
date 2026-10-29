package pierre

import (
	"context"
	"encoding/json"
	"iter"
	"net/http"
)

// Page is one page of a list. Body is the full response, with the fields
// beside the items. All iterates over the items of this page and of each next page.
type Page[Item, Body any] struct {
	Data       []Item
	HasMore    bool
	NextCursor string
	Body       Body
	// Response is the HTTP response of this page. The SDK has read its body.
	Response *http.Response

	next func(ctx context.Context, cursor string) (*Page[Item, Body], error)
}

// MarshalJSON encodes the page as Body, the response that the API sent, with the items one time
// and without Response. It has a value receiver, so a Page and a *Page encode the same.
func (p Page[Item, Body]) MarshalJSON() ([]byte, error) {
	return json.Marshal(p.Body)
}

// HasNextPage reports whether a next page exists: HasMore is true, and NextCursor is not empty.
func (p *Page[Item, Body]) HasNextPage() bool {
	return p.HasMore && p.NextCursor != ""
}

// GetNextPage gets the next page, with the params and the request options of the first call.
// Call HasNextPage first: with no next page, it returns an error.
func (p *Page[Item, Body]) GetNextPage(ctx context.Context) (*Page[Item, Body], error) {
	if !p.HasNextPage() || p.next == nil {
		return nil, newError(nil, "No next page. Call HasNextPage before GetNextPage.")
	}
	return p.next(ctx, p.NextCursor)
}

// IterPages iterates over this page, then each next page. It stops after the first error.
func (p *Page[Item, Body]) IterPages(ctx context.Context) iter.Seq2[*Page[Item, Body], error] {
	return func(yield func(*Page[Item, Body], error) bool) {
		page := p
		for {
			if !yield(page, nil) || !page.HasNextPage() {
				return
			}
			next, err := page.GetNextPage(ctx)
			if err != nil {
				yield(nil, err)
				return
			}
			page = next
		}
	}
}

// All iterates over the items of this page and of each next page. It stops after the first error.
func (p *Page[Item, Body]) All(ctx context.Context) iter.Seq2[Item, error] {
	return func(yield func(Item, error) bool) {
		for page, err := range p.IterPages(ctx) {
			if err != nil {
				var zero Item
				yield(zero, err)
				return
			}
			for _, item := range page.Data {
				if !yield(item, nil) {
					return
				}
			}
		}
	}
}

// decodePage reads a list response: the body, the items of the item field, has_more, and
// next_cursor.
func decodePage[Item, Body any](op *operation, got *received) (*Page[Item, Body], error) {
	page := &Page[Item, Body]{Response: got.response}
	if err := json.Unmarshal(got.body, &page.Body); err != nil {
		return nil, newError(err, "%s: the SDK cannot decode the response body: %v", op.id, err)
	}
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(got.body, &fields)
	if raw, ok := fields[op.itemField]; ok {
		if err := json.Unmarshal(raw, &page.Data); err != nil {
			return nil, newError(err, "%s: the SDK cannot decode %s: %v", op.id, op.itemField, err)
		}
	}
	if page.Data == nil {
		page.Data = []Item{}
	}
	_ = json.Unmarshal(fields["has_more"], &page.HasMore)
	_ = json.Unmarshal(fields["next_cursor"], &page.NextCursor)
	return page, nil
}
