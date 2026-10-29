"""Credentials and token signing."""

import asyncio
import base64
import hashlib
import inspect
import json
import re
import time
from dataclasses import dataclass
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from pierre._errors import PierreError
from pierre._types import RefPolicy, TokenRequest

# A token that the SDK signs for one request lives 5 minutes.
REQUEST_TOKEN_SECONDS = 5 * 60
# The longest token lifetime that the SDK signs.
MAX_TOKEN_SECONDS = 60 * 60
# The `sub` claim of the tokens that the SDK signs.
SUBJECT = "pierre-sdk-python"

# Ref policies after the check: `(pattern, ops)` pairs, with `None` for a rule with no `ops`.
Rules = Tuple[Tuple[str, Optional[Tuple[str, ...]]], ...]

GetToken = Callable[[TokenRequest], Union[str, Awaitable[str]]]

_PEM = re.compile(r"-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----")

# The signing algorithm and hash of each EC curve.
_CURVES: Dict[str, Tuple[str, hashes.HashAlgorithm]] = {
    "secp256r1": ("ES256", hashes.SHA256()),
    "secp384r1": ("ES384", hashes.SHA384()),
    "secp521r1": ("ES512", hashes.SHA512()),
}


def check_ref_policies(policies: object, name: str) -> Optional[Rules]:
    """Checks the shape of ref policies. The gateway checks the pattern forms and the ops."""
    if policies is None:
        return None
    if isinstance(policies, (str, bytes)) or not isinstance(policies, Sequence):
        raise PierreError(f"`{name}` must be a list of rules.")
    rules: List[Tuple[str, Optional[Tuple[str, ...]]]] = []
    for index, policy in enumerate(policies):
        at = f"`{name}[{index}]`"
        if not isinstance(policy, Mapping):
            raise PierreError(f"{at} must be a dict with `pattern` and `ops`.")
        pattern = policy.get("pattern")
        if not isinstance(pattern, str) or pattern == "":
            raise PierreError(f"{at}.pattern must be a non-empty string.")
        ops = policy.get("ops")
        if ops is None:
            rules.append((pattern, None))
            continue
        if (
            isinstance(ops, (str, bytes))
            or not isinstance(ops, Sequence)
            or any(not isinstance(op, str) or op == "" for op in ops)
        ):
            raise PierreError(f"{at}.ops must be a list of op names.")
        rules.append((pattern, tuple(ops)))
    return tuple(rules)


def copy_ref_policies(policies: object) -> object:
    """A copy of ref policies and their ops, so that a later change by the caller does not change
    a request. The check runs later, so a value of another type stays as it is."""
    if not isinstance(policies, (list, tuple)):
        return policies
    copied: List[object] = []
    for policy in policies:
        if isinstance(policy, Mapping):
            rule = dict(policy)
            if isinstance(rule.get("ops"), (list, tuple)):
                rule["ops"] = list(rule["ops"])
            copied.append(rule)
        else:
            copied.append(policy)
    return copied


def policies_of(rules: Rules) -> List[RefPolicy]:
    """The rules as new `RefPolicy` dicts."""
    policies: List[RefPolicy] = []
    for pattern, ops in rules:
        policies.append(
            {"pattern": pattern} if ops is None else {"pattern": pattern, "ops": list(ops)}
        )
    return policies


def refs_claim(rules: Rules) -> Optional[List[List[Any]]]:
    """The `refs` claim of the rules, or `None` for no rule."""
    if len(rules) == 0:
        return None
    return [[pattern, list(ops or ())] for pattern, ops in rules]


def check_ttl(ttl: object, name: str) -> int:
    """Checks a token lifetime: a whole number of seconds from 1 to 3600."""
    if isinstance(ttl, bool) or not isinstance(ttl, int) or ttl < 1 or ttl > MAX_TOKEN_SECONDS:
        raise PierreError(
            f"`{name}` must be a whole number of seconds from 1 to {MAX_TOKEN_SECONDS}."
        )
    return ttl


@dataclass(frozen=True)
class Claims:
    """The claims of a token that the SDK signs."""

    iss: str
    sub: str
    repo: Optional[str]
    scopes: Tuple[str, ...]
    # The lifetime in seconds: `exp` is `iat` plus this value.
    ttl: int
    rules: Rules


@dataclass(frozen=True)
class TokenNeeds:
    """The token that a request needs."""

    scopes: Tuple[str, ...]
    repo: Optional[str]
    ttl: int
    rules: Rules

    def request(self) -> TokenRequest:
        """The request that `get_token` receives."""
        request: TokenRequest = {"scopes": list(self.scopes), "ttl": self.ttl}
        if self.repo is not None:
            request["repo"] = self.repo
        if len(self.rules) > 0:
            request["ref_policies"] = policies_of(self.rules)
        return request


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _json(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True)
class _SigningKey:
    key: Union[ec.EllipticCurvePrivateKey, rsa.RSAPrivateKey]
    alg: str
    # The lowercase hex SHA-256 of the SPKI DER of the public key.
    kid: str


def _load_signing_key(pem: str) -> _SigningKey:
    """Loads a PKCS #8 PEM private key, and finds its algorithm and key ID."""
    match = _PEM.search(pem)
    if match is None:
        raise PierreError('The private key must be a PEM block of type "PRIVATE KEY" (PKCS #8).')
    try:
        key = serialization.load_pem_private_key(match.group(0).encode("ascii"), password=None)
    except (TypeError, ValueError, UnicodeEncodeError):
        key = None
    if isinstance(key, ec.EllipticCurvePrivateKey) and key.curve.name in _CURVES:
        alg = _CURVES[key.curve.name][0]
    elif isinstance(key, rsa.RSAPrivateKey):
        alg = "RS256"
    else:
        raise PierreError(
            "The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form."
        )
    spki = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return _SigningKey(key=key, alg=alg, kid=hashlib.sha256(spki).hexdigest())


class Signer:
    """A private key that signs tokens. It loads the key on the first signature, and loads it
    again after a failure, for example when the key file appears later."""

    def __init__(self, load: Callable[[], str]) -> None:
        self._load = load
        self._key: Optional[_SigningKey] = None

    def sign(self, claims: Claims) -> str:
        if self._key is None:
            self._key = _load_signing_key(self._load())
        signing = self._key
        now = int(time.time())
        header = {"alg": signing.alg, "typ": "JWT", "kid": signing.kid}
        payload: Dict[str, Any] = {"iss": claims.iss, "sub": claims.sub}
        if claims.repo is not None:
            payload["repo"] = claims.repo
        payload["scopes"] = list(claims.scopes)
        payload["iat"] = now
        payload["exp"] = now + claims.ttl
        refs = refs_claim(claims.rules)
        if refs is not None:
            payload["refs"] = refs
        signing_input = f"{_base64url(_json(header))}.{_base64url(_json(payload))}".encode("ascii")
        if isinstance(signing.key, ec.EllipticCurvePrivateKey):
            hash_algorithm = _CURVES[signing.key.curve.name][1]
            der = signing.key.sign(signing_input, ec.ECDSA(hash_algorithm))
            r, s = decode_dss_signature(der)
            size = (signing.key.curve.key_size + 7) // 8
            signature = r.to_bytes(size, "big") + s.to_bytes(size, "big")
        else:
            signature = signing.key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
        return f"{signing_input.decode('ascii')}.{_base64url(signature)}"


class Credentials:
    """The source of the token of each request: a private key, a fixed token, or `get_token`."""

    def __init__(
        self,
        kind: Literal["private_key", "token", "get_token"],
        *,
        org: Optional[str] = None,
        signer: Optional[Signer] = None,
        token: Optional[str] = None,
        get_token: Optional[GetToken] = None,
    ) -> None:
        self.kind = kind
        self.org = org
        self.signer = signer
        self._token = token
        self._get_token = get_token

    @property
    def fixed(self) -> bool:
        """Whether the token is fixed, so the SDK cannot set its claims."""
        return self.kind == "token"

    def sign(self, needs: TokenNeeds, subject: str = SUBJECT) -> str:
        if self.signer is None or self.org is None:
            raise PierreError("The client has no private key.")
        return self.signer.sign(
            Claims(
                iss=self.org,
                sub=subject,
                repo=needs.repo,
                scopes=needs.scopes,
                ttl=needs.ttl,
                rules=needs.rules,
            )
        )

    def token(self, needs: TokenNeeds) -> str:
        """The token of a request in `Pierre`."""
        if self.kind == "private_key":
            return self.sign(needs)
        if self.kind == "token":
            return self._token or ""
        result = self._call_get_token(needs)
        if inspect.isawaitable(result):
            if inspect.iscoroutine(result):
                result.close()
            raise PierreError(
                "`Pierre` needs a `get_token` that returns a token string. "
                "Give an async `get_token` to `AsyncPierre`."
            )
        return _checked_token(result)

    async def async_token(self, needs: TokenNeeds) -> str:
        """The token of a request in `AsyncPierre`. `get_token` can be sync or async. A sync
        `get_token` runs in a thread, so that it does not block the event loop and the timeout
        can stop the wait."""
        if self.kind != "get_token":
            return self.token(needs)
        if inspect.iscoroutinefunction(self._get_token):
            result = self._call_get_token(needs)
        else:
            result = await asyncio.to_thread(self._call_get_token, needs)
        if inspect.isawaitable(result):
            result = await result
        return _checked_token(result)

    def _call_get_token(self, needs: TokenNeeds) -> object:
        if self._get_token is None:
            raise PierreError("The client has no `get_token`.")
        return self._get_token(needs.request())


def _checked_token(token: object) -> str:
    if not isinstance(token, str) or token == "":
        raise PierreError("`get_token` must return a token string.")
    return token


def token_issuer(token: str) -> Optional[str]:
    """The `iss` claim of a token, or `None`. The SDK does not verify the token."""
    parts = token.split(".")
    if len(parts) < 2:
        return None
    payload = parts[1]
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (ValueError, TypeError):
        return None
    issuer = claims.get("iss") if isinstance(claims, dict) else None
    return issuer if isinstance(issuer, str) and issuer != "" else None
