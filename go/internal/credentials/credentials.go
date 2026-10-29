// Package credentials signs tokens and gives the token of each request. It uses the standard
// library only.
package credentials

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"strings"
	"time"

	"github.com/pierrecomputer/sdk/go/internal/config"
)

// RequestTokenTTL is the lifetime of a token that the SDK signs for one request.
const RequestTokenTTL = 5 * time.Minute

// Subject is the sub claim of the tokens that the SDK signs.
const Subject = "pierre-sdk-go"

// Error is a failure of the SDK itself, not of a function of the caller. The SDK packages give
// it to the caller as a PierreError.
type Error struct {
	Message string
	Err     error
}

func (e *Error) Error() string { return e.Message }

func (e *Error) Unwrap() error { return e.Err }

func errorf(cause error, message string) *Error {
	return &Error{Message: message, Err: cause}
}

// Claims are the claims of a token that the SDK signs.
type Claims struct {
	Issuer  string
	Subject string
	// Repo is the repo claim, or empty for none.
	Repo   string
	Scopes []string
	TTL    time.Duration
	// RefPolicies are the rules of the refs claim, or none.
	RefPolicies []config.RefPolicy
}

// Signer signs tokens with a private key.
type Signer struct {
	key crypto.Signer
	alg string
	// hash is the digest of the signature input.
	hash crypto.Hash
	// size is the byte length of each of r and s in an ECDSA signature.
	size int
	// KeyID is the lowercase hex SHA-256 of the SPKI DER of the public key.
	KeyID string
}

// ParsePrivateKey reads a PKCS #8 PEM private key: EC (P-256, P-384, or P-521) or RSA. The text
// can hold other PEM blocks and other text, as the TypeScript SDK accepts; the first block of
// type PRIVATE KEY is the key.
func ParsePrivateKey(text string) (*Signer, error) {
	var block *pem.Block
	for rest := []byte(text); ; {
		block, rest = pem.Decode(rest)
		if block == nil || block.Type == "PRIVATE KEY" {
			break
		}
	}
	if block == nil {
		return nil, errorf(nil, `The private key must be a PEM block of type "PRIVATE KEY" (PKCS #8).`)
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, errorf(err, "The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.")
	}
	signer := &Signer{}
	switch key := parsed.(type) {
	case *ecdsa.PrivateKey:
		switch key.Curve {
		case elliptic.P256():
			signer.alg, signer.hash, signer.size = "ES256", crypto.SHA256, 32
		case elliptic.P384():
			signer.alg, signer.hash, signer.size = "ES384", crypto.SHA384, 48
		case elliptic.P521():
			signer.alg, signer.hash, signer.size = "ES512", crypto.SHA512, 66
		default:
			return nil, errorf(nil, "The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.")
		}
		signer.key = key
	case *rsa.PrivateKey:
		signer.alg, signer.hash = "RS256", crypto.SHA256
		signer.key = key
	default:
		return nil, errorf(nil, "The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.")
	}
	spki, err := x509.MarshalPKIXPublicKey(signer.key.Public())
	if err != nil {
		return nil, errorf(err, "The SDK cannot read the public key of the private key.")
	}
	digest := sha256.Sum256(spki)
	signer.KeyID = hex.EncodeToString(digest[:])
	return signer, nil
}

// Sign returns a JWT with the claims, the key ID as kid, and iat and exp from now.
func (s *Signer) Sign(claims Claims) (string, error) {
	header, err := json.Marshal(struct {
		Alg string `json:"alg"`
		Typ string `json:"typ"`
		Kid string `json:"kid"`
	}{s.alg, "JWT", s.KeyID})
	if err != nil {
		return "", err
	}
	now := time.Now().Unix()
	payload, err := json.Marshal(struct {
		Issuer  string   `json:"iss"`
		Subject string   `json:"sub"`
		Repo    string   `json:"repo,omitempty"`
		Scopes  []string `json:"scopes"`
		Issued  int64    `json:"iat"`
		Expires int64    `json:"exp"`
		Refs    [][]any  `json:"refs,omitempty"`
	}{
		Issuer:  claims.Issuer,
		Subject: claims.Subject,
		Repo:    claims.Repo,
		Scopes:  append([]string{}, claims.Scopes...),
		Issued:  now,
		Expires: now + int64(claims.TTL/time.Second),
		Refs:    RefsClaim(claims.RefPolicies),
	})
	if err != nil {
		return "", err
	}
	input := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	signature, err := s.signature([]byte(input))
	if err != nil {
		return "", errorf(err, "The SDK cannot sign the token.")
	}
	return input + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func (s *Signer) signature(input []byte) ([]byte, error) {
	var digest []byte
	switch s.hash {
	case crypto.SHA384:
		sum := sha512.Sum384(input)
		digest = sum[:]
	case crypto.SHA512:
		sum := sha512.Sum512(input)
		digest = sum[:]
	default:
		sum := sha256.Sum256(input)
		digest = sum[:]
	}
	switch key := s.key.(type) {
	case *ecdsa.PrivateKey:
		// JWS gives r and s as fixed-length big-endian values, not as ASN.1.
		r, sig, err := ecdsa.Sign(rand.Reader, key, digest)
		if err != nil {
			return nil, err
		}
		out := make([]byte, 2*s.size)
		r.FillBytes(out[:s.size])
		sig.FillBytes(out[s.size:])
		return out, nil
	default:
		return s.key.Sign(rand.Reader, digest, s.hash)
	}
}

// RefsClaim is the refs claim of ref policies: ordered [pattern, ops] pairs, or nil for no rule.
func RefsClaim(policies []config.RefPolicy) [][]any {
	if len(policies) == 0 {
		return nil
	}
	claim := make([][]any, 0, len(policies))
	for _, policy := range policies {
		ops := policy.Ops
		if ops == nil {
			ops = []string{}
		}
		claim = append(claim, []any{policy.Pattern, ops})
	}
	return claim
}

// TokenIssuer returns the iss claim of a token, or empty. The SDK does not verify the token.
func TokenIssuer(token string) string {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return ""
	}
	var claims struct {
		Issuer any `json:"iss"`
	}
	if json.Unmarshal(payload, &claims) != nil {
		return ""
	}
	issuer, _ := claims.Issuer.(string)
	return issuer
}

// Source gives the token of each request.
type Source interface {
	// Fixed reports whether the token is fixed, so the SDK cannot set its claims.
	Fixed() bool
	// Token returns the token for a request. An error of a function of the caller is returned as
	// it is. A failure of the SDK is an *Error.
	Token(ctx context.Context, request config.TokenRequest) (string, error)
}

// SignerSource signs a token for each request with the scopes and the repo claim of the operation.
type SignerSource struct {
	Org    string
	Signer *Signer
}

func (s *SignerSource) Fixed() bool { return false }

func (s *SignerSource) Token(ctx context.Context, request config.TokenRequest) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", context.Cause(ctx)
	}
	return s.Signer.Sign(Claims{
		Issuer:      s.Org,
		Subject:     Subject,
		Repo:        request.Repo,
		Scopes:      request.Scopes,
		TTL:         request.TTL,
		RefPolicies: request.RefPolicies,
	})
}

// FixedSource gives a fixed token. The server checks its scopes.
type FixedSource struct {
	Value string
}

func (s *FixedSource) Fixed() bool { return true }

func (s *FixedSource) Token(ctx context.Context, _ config.TokenRequest) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", context.Cause(ctx)
	}
	return s.Value, nil
}

// GetTokenSource asks the caller's function for the token of each request.
type GetTokenSource struct {
	GetToken config.GetToken
}

func (s *GetTokenSource) Fixed() bool { return false }

// Token calls the function with the context of the attempt. When the context ends first, it
// returns the cause of the context, also when the function does not stop.
func (s *GetTokenSource) Token(ctx context.Context, request config.TokenRequest) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", context.Cause(ctx)
	}
	type result struct {
		token string
		err   error
	}
	// The channel has room for the result, so the goroutine ends when the function returns.
	done := make(chan result, 1)
	go func() {
		token, err := s.GetToken(ctx, copyRequest(request))
		done <- result{token, err}
	}()
	select {
	case got := <-done:
		if got.err != nil {
			return "", got.err
		}
		if got.token == "" {
			return "", errorf(nil, "The function of option.WithGetToken must return a token.")
		}
		return got.token, nil
	case <-ctx.Done():
		return "", context.Cause(ctx)
	}
}

// copyRequest is a copy that the function can change with no effect on the call.
func copyRequest(request config.TokenRequest) config.TokenRequest {
	copied := request
	copied.Scopes = append([]string{}, request.Scopes...)
	if len(request.RefPolicies) == 0 {
		copied.RefPolicies = nil
	} else {
		copied.RefPolicies, _ = config.CheckRefPolicies(request.RefPolicies, "")
	}
	return copied
}
