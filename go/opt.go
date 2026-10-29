package pierre

import (
	"bytes"
	"encoding/json"
)

type optState uint8

const (
	omitted optState = iota
	present
	null
)

// Opt is an optional field. Its zero value is omitted: a request does not send
// it, so the server keeps the stored value. Value gives a value, and Null gives null, which
// resets the stored value. In a response, an absent field is omitted, and null is null.
type Opt[T any] struct {
	value T
	state optState
}

// Value returns an Opt that holds v.
func Value[T any](v T) Opt[T] {
	return Opt[T]{value: v, state: present}
}

// Null returns an Opt that holds null.
func Null[T any]() Opt[T] {
	return Opt[T]{state: null}
}

// String returns an Opt that holds v.
func String(v string) Opt[string] { return Value(v) }

// Int returns an Opt that holds v. Each integer field of the API is an int64.
func Int(v int64) Opt[int64] { return Value(v) }

// Float returns an Opt that holds v. Each number field of the API is a float64.
func Float(v float64) Opt[float64] { return Value(v) }

// Bool returns an Opt that holds v.
func Bool(v bool) Opt[bool] { return Value(v) }

// Get returns the value, and true when the Opt holds a value. It returns the zero value of T,
// and false, when the Opt is omitted or null.
func (o Opt[T]) Get() (T, bool) {
	return o.value, o.state == present
}

// IsNull reports whether the Opt holds null.
func (o Opt[T]) IsNull() bool {
	return o.state == null
}

// IsZero reports whether the Opt is omitted. The omitzero option of encoding/json reads it.
func (o Opt[T]) IsZero() bool {
	return o.state == omitted
}

// MarshalJSON gives the value, or null for an Opt that is null or omitted.
func (o Opt[T]) MarshalJSON() ([]byte, error) {
	if o.state != present {
		return []byte("null"), nil
	}
	return json.Marshal(o.value)
}

// UnmarshalJSON reads null as null, and any other value as a value.
func (o *Opt[T]) UnmarshalJSON(data []byte) error {
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		*o = Null[T]()
		return nil
	}
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	*o = Value(v)
	return nil
}

// wireValue gives the value of an Opt to the encoder of path, query, and header params.
func (o Opt[T]) wireValue() (any, optState) {
	return o.value, o.state
}

// optional is an Opt of any type.
type optional interface {
	wireValue() (any, optState)
}
