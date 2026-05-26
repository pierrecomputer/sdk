package storage

// encodeRefsClaim builds the JWT `refs` claim as an array of [pattern, ops] tuples.
func encodeRefsClaim(refs RefPolicyList) []any {
	out := make([]any, len(refs))
	for i, rule := range refs {
		opList := []string(rule.Ops)
		if opList == nil {
			opList = []string{}
		}
		out[i] = []any{rule.Pattern, opList}
	}
	return out
}
