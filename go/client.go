// Package pierre is the Go SDK of the Pierre API. pierre.NewClient gives a
// client whose namespace path is the catalog ID of each operation: repos.branches.create is
// client.Repos.Branches.Create. Each method takes a context.Context, a params struct with the
// wire names of the API in its JSON tags, and request options from package option.
//
// The local utilities are in their own packages: auth.CreateToken, git.RemoteURL, and
// webhooks.VerifyWebhook.
//
// Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
// https://code.storage/docs/llms.txt.
package pierre

import (
	"net/http"
	"net/url"
	"os"
	"regexp"
	"time"

	"github.com/pierrecomputer/sdk/go/internal/bridge"
	"github.com/pierrecomputer/sdk/go/internal/config"
	"github.com/pierrecomputer/sdk/go/internal/credentials"
	"github.com/pierrecomputer/sdk/go/option"
)

const (
	defaultTimeout    = 60 * time.Second
	defaultMaxRetries = 2
)

// hostLabel is a DNS label: the form of an organization name in its default hosts.
var hostLabel = regexp.MustCompile(`(?i)^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

// ClientOptions are the settings of a client. Read them with client.Options. They hold no
// credential.
type ClientOptions struct {
	// Org is the organization name, or empty when the client does not know it.
	Org     string
	BaseURL string
	// GitHost is the Git host, or empty when the client does not know the organization and no
	// option sets it.
	GitHost    string
	Timeout    time.Duration
	MaxRetries int
	// RefPolicies are the ref policies of each request token, or nil when the client has none.
	RefPolicies []option.RefPolicy
}

type credentialKind uint8

const (
	privateKeyCredential credentialKind = iota
	tokenCredential
	getTokenCredential
)

type credential struct {
	kind     credentialKind
	signer   *credentials.Signer
	token    string
	getToken config.GetToken
}

// settings are the options of a client after the environment, before the defaults.
// client.WithOptions starts from them.
type settings struct {
	org         string
	baseURL     string
	gitHost     string
	timeout     time.Duration
	maxRetries  int
	headers     http.Header
	httpClient  *http.Client
	refPolicies []config.RefPolicy
	credential  credential
}

// core is the state of a client that the namespaces share.
type core struct {
	settings    settings
	org         string
	baseURL     string
	gitHost     string
	timeout     time.Duration
	maxRetries  int
	headers     http.Header
	httpClient  *http.Client
	refPolicies []config.RefPolicy
	source      credentials.Source
	signer      *credentials.Signer
	clientName  string
}

func init() {
	bridge.KeyOf = func(value any) (*bridge.ClientKey, bool) {
		client, ok := value.(*Client)
		if !ok || client == nil || client.core == nil {
			return nil, false
		}
		c := client.core
		return &bridge.ClientKey{
			Org:         c.org,
			Signer:      c.signer,
			Source:      c.source,
			GitHost:     c.gitHost,
			RefPolicies: c.refPolicies,
		}, true
	}
}

// NewClient makes a client. With no options, it reads PIERRE_ORG and PIERRE_PRIVATE_KEY, or the
// other variables of the docs: PIERRE_PRIVATE_KEY_FILE, PIERRE_TOKEN, PIERRE_API_BASE_URL, and
// PIERRE_GIT_HOST. A credential option replaces every credential of the environment.
func NewClient(opts ...option.RequestOption) (*Client, error) {
	options := config.Options{}
	if err := config.Apply(&options, opts); err != nil {
		return nil, newError(nil, "%s", err.Error())
	}
	s, err := fromEnvironment(&options)
	if err != nil {
		return nil, err
	}
	return build(s)
}

// Options returns the settings of the client. Every exported name of a client other than
// Options and WithOptions is an API namespace.
func (c *Client) Options() ClientOptions {
	core := c.core
	return ClientOptions{
		Org:         core.org,
		BaseURL:     core.baseURL,
		GitHost:     core.gitHost,
		Timeout:     core.timeout,
		MaxRetries:  core.maxRetries,
		RefPolicies: copyPolicies(core.refPolicies),
	}
}

// WithOptions returns a copy of the client with changed options. The copy keeps each option that
// opts does not set, including the organization, and does not read the environment again. It
// keeps the credential, unless opts gives one. When the organization changes, the default hosts
// follow it. option.WithHeader adds a header to the default headers of the client, or replaces
// the header of that name; withOptions in TypeScript replaces all of defaultHeaders.
func (c *Client) WithOptions(opts ...option.RequestOption) (*Client, error) {
	options := config.Options{}
	if err := config.Apply(&options, opts); err != nil {
		return nil, newError(nil, "%s", err.Error())
	}
	s, err := withChanges(c.core.settings, &options)
	if err != nil {
		return nil, err
	}
	return build(s)
}

func build(s settings) (*Client, error) {
	org := s.org
	if org == "" && s.credential.kind == tokenCredential {
		org = credentials.TokenIssuer(s.credential.token)
	}
	// The SDK does not verify a token, so its iss can name any host. A default host uses only a
	// host label, and so stays under code.storage.
	label := ""
	if hostLabel.MatchString(org) {
		label = org
	}
	if s.baseURL == "" && label == "" {
		if org == "" {
			return nil, newError(nil, "Set option.WithOrg or PIERRE_ORG, or give option.WithBaseURL.")
		}
		return nil, newError(nil, "The organization name is not a host label, so give option.WithBaseURL.")
	}
	// The SDK cannot change the claims of a fixed token, so the limit would not apply.
	if s.credential.kind == tokenCredential && len(s.refPolicies) > 0 {
		return nil, newError(nil, "A client with a fixed token cannot have ref policies. Give option.WithPrivateKey or option.WithGetToken.")
	}
	baseURL := s.baseURL
	if baseURL == "" {
		baseURL = "https://api." + label + ".code.storage"
	}
	if parsed, err := url.Parse(baseURL); err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return nil, newError(nil, "option.WithBaseURL must be an absolute https URL, for example https://api.acme.code.storage.")
	}
	gitHost := s.gitHost
	if gitHost == "" && label != "" {
		gitHost = label + ".code.storage"
	}

	c := &core{
		org:         org,
		baseURL:     baseURL,
		gitHost:     gitHost,
		timeout:     s.timeout,
		maxRetries:  s.maxRetries,
		headers:     s.headers,
		httpClient:  s.httpClient,
		refPolicies: s.refPolicies,
		clientName:  "pierre-sdk-go/" + Version,
	}
	switch s.credential.kind {
	case privateKeyCredential:
		// The gateway finds the public keys of the organization by the iss claim.
		if org == "" {
			return nil, newError(nil, "A private key needs option.WithOrg or PIERRE_ORG.")
		}
		c.signer = s.credential.signer
		c.source = &credentials.SignerSource{Org: org, Signer: s.credential.signer}
	case tokenCredential:
		c.source = &credentials.FixedSource{Value: s.credential.token}
	default:
		c.source = &credentials.GetTokenSource{GetToken: s.credential.getToken}
	}
	// A copy keeps the organization of Options, also when it came from the token.
	s.org = org
	c.settings = s
	client := &Client{core: c}
	client.setNamespaces()
	return client, nil
}

// variables are the Pierre variables of the process. An empty value counts as not set.
func variables() map[string]string {
	env := map[string]string{}
	for _, name := range []string{
		"PIERRE_ORG",
		"PIERRE_PRIVATE_KEY",
		"PIERRE_PRIVATE_KEY_FILE",
		"PIERRE_TOKEN",
		"PIERRE_API_BASE_URL",
		"PIERRE_GIT_HOST",
	} {
		if value := os.Getenv(name); value != "" {
			env[name] = value
		}
	}
	return env
}

func fromEnvironment(options *config.Options) (settings, error) {
	env := variables()
	s := settings{
		org:        env["PIERRE_ORG"],
		baseURL:    env["PIERRE_API_BASE_URL"],
		gitHost:    env["PIERRE_GIT_HOST"],
		timeout:    defaultTimeout,
		maxRetries: defaultMaxRetries,
		headers:    http.Header{},
		httpClient: http.DefaultClient,
	}
	s = changed(s, options)
	cred, ok, err := credentialOf(options)
	if err != nil {
		return s, err
	}
	if !ok {
		// A credential in the options replaces every credential in the environment.
		if cred, err = environmentCredential(env); err != nil {
			return s, err
		}
	}
	s.credential = cred
	return s, nil
}

func withChanges(parent settings, options *config.Options) (settings, error) {
	s := changed(parent, options)
	s.headers = parent.headers.Clone()
	for name, values := range options.Headers {
		s.headers[name] = append([]string{}, values...)
	}
	cred, ok, err := credentialOf(options)
	if err != nil {
		return s, err
	}
	if ok {
		s.credential = cred
	}
	return s, nil
}

// changed applies the options that are not credentials.
func changed(s settings, options *config.Options) settings {
	if options.Org != nil {
		s.org = *options.Org
	}
	if options.BaseURL != nil {
		s.baseURL = *options.BaseURL
	}
	if options.GitHost != nil {
		s.gitHost = *options.GitHost
	}
	if options.Timeout != nil {
		s.timeout = *options.Timeout
	}
	if options.MaxRetries != nil {
		s.maxRetries = *options.MaxRetries
	}
	if options.HTTPClient != nil {
		s.httpClient = options.HTTPClient
	}
	if options.RefPolicies != nil {
		s.refPolicies = *options.RefPolicies
	}
	if options.Headers != nil {
		s.headers = options.Headers.Clone()
	}
	return s
}

// credentialOf returns the credential of the options. More than one is an error.
func credentialOf(options *config.Options) (credential, bool, error) {
	count := 0
	for _, set := range []bool{options.PrivateKey != nil, options.Token != nil, options.GetToken != nil} {
		if set {
			count++
		}
	}
	switch {
	case count > 1:
		return credential{}, false, newError(nil, "Give only one of option.WithPrivateKey, option.WithToken, and option.WithGetToken.")
	case options.PrivateKey != nil:
		signer, err := credentials.ParsePrivateKey(*options.PrivateKey)
		if err != nil {
			return credential{}, false, sdkError(err)
		}
		return credential{kind: privateKeyCredential, signer: signer}, true, nil
	case options.Token != nil:
		return credential{kind: tokenCredential, token: *options.Token}, true, nil
	case options.GetToken != nil:
		return credential{kind: getTokenCredential, getToken: options.GetToken}, true, nil
	}
	return credential{}, false, nil
}

func environmentCredential(env map[string]string) (credential, error) {
	if token, ok := env["PIERRE_TOKEN"]; ok {
		return credential{kind: tokenCredential, token: token}, nil
	}
	pem, ok := env["PIERRE_PRIVATE_KEY"]
	if !ok {
		path, ok := env["PIERRE_PRIVATE_KEY_FILE"]
		if !ok {
			return credential{}, newError(nil, "Give option.WithPrivateKey, option.WithToken, or option.WithGetToken, or set PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN.")
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return credential{}, newError(err, "Cannot read PIERRE_PRIVATE_KEY_FILE (%s).", path)
		}
		pem = string(data)
	}
	signer, err := credentials.ParsePrivateKey(pem)
	if err != nil {
		return credential{}, sdkError(err)
	}
	return credential{kind: privateKeyCredential, signer: signer}, nil
}

func copyPolicies(policies []config.RefPolicy) []option.RefPolicy {
	if policies == nil {
		return nil
	}
	copied, _ := config.CheckRefPolicies(policies, "")
	return copied
}
