package pierre

import (
	"encoding/json"
	"net/http"
	"net/url"
	"reflect"
	"strconv"
	"strings"

	"github.com/pierrecomputer/sdk/go/internal/segment"
)

// wire is a params struct in the form of a request. The tags of a params field give its
// location: path:"name", query:"name", or header:"name". Each other field with a JSON name is a
// field of the JSON body, or of the first NDJSON line.
type wire struct {
	path   map[string]string
	query  url.Values
	header http.Header
	// body is the JSON object of the body fields, or nil when the operation sends no body.
	body []byte
	// repo is the value of repo_name, in the path or in the body, or empty.
	repo string
}

// encode reads a pointer to a params struct. extra holds body fields that a helper fills.
func encode(op *operation, params any, extra map[string]any) (wire, error) {
	w := wire{path: map[string]string{}, query: url.Values{}, header: http.Header{}}
	value := reflect.ValueOf(params)
	for value.Kind() == reflect.Pointer {
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return w, newError(nil, "%s: the params must be a struct", op.id)
	}
	fields := value.Type()
	for index := range fields.NumField() {
		field := fields.Field(index)
		if !field.IsExported() {
			continue
		}
		item := value.Field(index)
		if name, ok := field.Tag.Lookup("path"); ok {
			text, set, err := scalarText(op, name, item)
			if err != nil {
				return w, err
			}
			if set {
				w.path[name] = text
			}
			continue
		}
		if name, ok := field.Tag.Lookup("query"); ok {
			texts, err := queryTexts(op, name, item)
			if err != nil {
				return w, err
			}
			for _, text := range texts {
				w.query.Add(name, text)
			}
			continue
		}
		if name, ok := field.Tag.Lookup("header"); ok {
			text, set, err := scalarText(op, name, item)
			if err != nil {
				return w, err
			}
			if set {
				w.header.Set(name, text)
			}
			continue
		}
		if jsonName(field) == "repo_name" && w.repo == "" {
			w.repo, _, _ = scalarText(op, "repo_name", item)
		}
	}
	if repo, ok := w.path["repo_name"]; ok {
		w.repo = repo
	}
	if op.body == bodyNone {
		return w, nil
	}
	body, err := json.Marshal(params)
	if err != nil {
		return w, newError(err, "%s: the SDK cannot encode the body: %v", op.id, err)
	}
	if len(extra) > 0 {
		var merged map[string]json.RawMessage
		if err := json.Unmarshal(body, &merged); err != nil {
			return w, newError(err, "%s: the SDK cannot encode the body: %v", op.id, err)
		}
		for name, value := range extra {
			raw, err := json.Marshal(value)
			if err != nil {
				return w, newError(err, "%s: the SDK cannot encode %s: %v", op.id, name, err)
			}
			merged[name] = raw
		}
		if body, err = json.Marshal(merged); err != nil {
			return w, newError(err, "%s: the SDK cannot encode the body: %v", op.id, err)
		}
	}
	// An optional JSON body with no field set is not sent.
	if op.body == bodyJSON && !op.bodyRequired && string(body) == "{}" {
		return w, nil
	}
	w.body = body
	return w, nil
}

func jsonName(field reflect.StructField) string {
	tag := field.Tag.Get("json")
	if tag == "-" {
		return ""
	}
	name, _, _ := strings.Cut(tag, ",")
	return name
}

// scalarText is the text of a path, query, or header value. It is not set for an omitted Opt.
func scalarText(op *operation, name string, item reflect.Value) (string, bool, error) {
	if opt, ok := item.Interface().(optional); ok {
		value, state := opt.wireValue()
		switch state {
		case omitted:
			return "", false, nil
		case null:
			return "", false, newError(nil, "%s: %s cannot be null", op.id, name)
		}
		item = reflect.ValueOf(value)
	}
	text, ok := textOf(item)
	if !ok {
		return "", false, newError(nil, "%s: %s must be a string, a number, or a boolean", op.id, name)
	}
	return text, true, nil
}

// queryTexts gives one text for each value of a query param: one for a scalar, and one for each
// item of a list.
func queryTexts(op *operation, name string, item reflect.Value) ([]string, error) {
	if opt, ok := item.Interface().(optional); ok {
		value, state := opt.wireValue()
		switch state {
		case omitted:
			return nil, nil
		case null:
			return nil, newError(nil, "%s: %s cannot be null", op.id, name)
		}
		item = reflect.ValueOf(value)
	}
	if item.Kind() != reflect.Slice {
		text, ok := textOf(item)
		if !ok {
			return nil, newError(nil, "%s: %s must be a string, a number, or a boolean", op.id, name)
		}
		return []string{text}, nil
	}
	texts := make([]string, 0, item.Len())
	for index := range item.Len() {
		text, ok := textOf(item.Index(index))
		if !ok {
			return nil, newError(nil, "%s: each item of %s must be a string, a number, or a boolean", op.id, name)
		}
		texts = append(texts, text)
	}
	return texts, nil
}

func textOf(item reflect.Value) (string, bool) {
	switch item.Kind() {
	case reflect.String:
		return item.String(), true
	case reflect.Bool:
		return strconv.FormatBool(item.Bool()), true
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(item.Int(), 10), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return strconv.FormatUint(item.Uint(), 10), true
	case reflect.Float32, reflect.Float64:
		return strconv.FormatFloat(item.Float(), 'g', -1, 64), true
	}
	return "", false
}

// expandPath puts the path params in the path. Each value is one segment, so / is %2F.
func expandPath(op *operation, values map[string]string) (string, error) {
	var out strings.Builder
	rest := op.path
	for {
		start := strings.IndexByte(rest, '{')
		if start < 0 {
			out.WriteString(rest)
			return out.String(), nil
		}
		end := strings.IndexByte(rest[start:], '}')
		if end < 0 {
			return "", newError(nil, "%s: the path template has no closing brace", op.id)
		}
		name := rest[start+1 : start+end]
		value := values[name]
		if value == "" {
			return "", newError(nil, "%s needs %s", op.id, name)
		}
		escaped := segment.Escape(value)
		// The URL parser resolves . and .., which would send the request to another route.
		if escaped == "." || escaped == ".." {
			return "", newError(nil, "%s: %s cannot be %s", op.id, name, escaped)
		}
		out.WriteString(rest[:start])
		out.WriteString(escaped)
		rest = rest[start+end+1:]
	}
}

// fillHeaders sets each field of a declared headers struct from its header:"name" tag. A field
// holds the header text, and the values of a repeated header are joined with ", ".
func fillHeaders(target any, header http.Header) {
	value := reflect.ValueOf(target).Elem()
	fields := value.Type()
	for index := range fields.NumField() {
		name, ok := fields.Field(index).Tag.Lookup("header")
		if !ok || value.Field(index).Kind() != reflect.String {
			continue
		}
		value.Field(index).SetString(strings.Join(header.Values(name), ", "))
	}
}
