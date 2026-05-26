package storage

import "testing"

func TestEncodeRefsClaim(t *testing.T) {
	encoded := encodeRefsClaim(RefPolicyList{
		{Pattern: "refs/heads/main", Ops: Ops{OpNoPush}},
		{Pattern: "refs/heads/release/*", Ops: nil},
		{Pattern: "*", Ops: Ops{OpNoForcePush}},
	})

	if len(encoded) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(encoded))
	}

	mainRule, ok := encoded[0].([]any)
	if !ok {
		t.Fatalf("unexpected rule type: %T", encoded[0])
	}
	if mainRule[0] != "refs/heads/main" {
		t.Fatalf("unexpected pattern: %v", mainRule[0])
	}
	mainOps, ok := mainRule[1].([]string)
	if !ok || len(mainOps) != 1 || mainOps[0] != OpNoPush {
		t.Fatalf("unexpected ops: %v", mainRule[1])
	}

	releaseRule, ok := encoded[1].([]any)
	if !ok {
		t.Fatalf("unexpected rule type: %T", encoded[1])
	}
	releaseOps, ok := releaseRule[1].([]string)
	if !ok || len(releaseOps) != 0 {
		t.Fatalf("expected empty ops slice, got %v", releaseRule[1])
	}
}
