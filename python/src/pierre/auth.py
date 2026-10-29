"""`pierre.auth`: signs a token locally, with no HTTP call, and lists
the scopes of the API."""

from typing import Optional, Sequence, Union

from pierre._client import AsyncPierre, Pierre
from pierre._compat import TypedDict
from pierre._credentials import (
    SUBJECT,
    Credentials,
    Signer,
    TokenNeeds,
    check_ref_policies,
    check_ttl,
)
from pierre._errors import PierreError
from pierre._generated.scopes import SCOPES, Scope
from pierre._types import RefPolicy

__all__ = ["SCOPES", "KeyCredentials", "RefPolicy", "Scope", "create_token"]

# A token from `create_token` lives 15 minutes by default.
_DEFAULT_TTL_SECONDS = 15 * 60


class KeyCredentials(TypedDict):
    """A private key and its organization, for code with no client."""

    org: str
    # A PKCS #8 PEM private key.
    private_key: str


def _signing_credentials(credentials: Union[Pierre, AsyncPierre, KeyCredentials]) -> Credentials:
    if isinstance(credentials, (Pierre, AsyncPierre)):
        signing = credentials._resolved.credentials
        if signing.kind != "private_key":
            raise PierreError(
                "`create_token` needs a client with a private key. "
                "A client with `token` or `get_token` cannot sign."
            )
        return signing
    if isinstance(credentials, dict):
        org = credentials.get("org")
        private_key = credentials.get("private_key")
        if isinstance(org, str) and org != "" and isinstance(private_key, str):
            return Credentials("private_key", org=org, signer=Signer(lambda: private_key))
    raise PierreError('Give a client, or `{"org": ..., "private_key": ...}`.')


def create_token(
    credentials: Union[Pierre, AsyncPierre, KeyCredentials],
    *,
    scopes: Sequence[str],
    repo: Optional[str] = None,
    ttl: int = _DEFAULT_TTL_SECONDS,
    ref_policies: Optional[Sequence[RefPolicy]] = None,
    subject: Optional[str] = None,
) -> str:
    """Signs a token with a private key: the key of a client, or `{"org": ..., "private_key":
    ...}`. A token in a URL or a config file is a bearer credential, so keep the lifetime short.

    Args:
        credentials: A client with a private key, or a `KeyCredentials` dict.
        scopes: The scopes of the token, for example `["git:read"]`. `SCOPES` lists the scopes of
            the API.
        repo: The `repo` claim. Leave it out for a token whose scopes are all organization-wide.
        ttl: The lifetime in seconds, from 1 to 3600. Default: 900 (15 minutes).
        ref_policies: The rules of the `refs` claim. Default: the `ref_policies` of a client, and
            none for a `KeyCredentials` dict. An empty list adds no claim.
        subject: The `sub` claim. Default: `pierre-sdk-python`.

    Docs: search for `createToken` in the docs MCP server, https://code.storage/docs/mcp.
    """
    signing = _signing_credentials(credentials)
    if isinstance(scopes, str) or len(scopes) == 0:
        raise PierreError("`scopes` must name at least one scope.")
    rules = check_ref_policies(ref_policies, "ref_policies")
    if rules is None and isinstance(credentials, (Pierre, AsyncPierre)):
        rules = credentials._resolved.settings.rules
    needs = TokenNeeds(
        scopes=tuple(scopes), repo=repo, ttl=check_ttl(ttl, "ttl"), rules=rules or ()
    )
    return signing.sign(needs, SUBJECT if subject is None else subject)
