// Package bridge gives the packages auth and git the credentials of a client. A client has no
// exported member for them, because its other exported names are API namespaces.
package bridge

import (
	"github.com/pierrecomputer/sdk/go/internal/config"
	"github.com/pierrecomputer/sdk/go/internal/credentials"
)

// ClientKey is the signing key and the token source of a client.
type ClientKey struct {
	// Org is the organization name, or empty when the client does not know it.
	Org string
	// Signer is nil when the client has a fixed token or a function of option.WithGetToken.
	Signer *credentials.Signer
	Source credentials.Source
	// GitHost is the Git host, or empty when the client does not know it.
	GitHost string
	// RefPolicies are the ref policies of the client, or nil.
	RefPolicies []config.RefPolicy
}

// KeyOf returns the key of a *pierre.Client. Package pierre sets it when it loads.
var KeyOf func(client any) (*ClientKey, bool)
