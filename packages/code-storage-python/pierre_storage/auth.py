"""JWT authentication utilities for Pierre Git Storage SDK."""

import time
from typing import Any, List, Optional, Union, cast

import jwt
from cryptography.hazmat.primitives import serialization

from pierre_storage.types import Refs


def encode_refs_claim(refs: Refs) -> List[List[Union[str, List[str]]]]:
    """Encode per-ref policy rules for the JWT ``refs`` claim."""
    out: List[List[Union[str, List[str]]]] = []
    for rule in refs:
        pattern = rule["pattern"]
        ops = rule.get("ops")
        out.append([pattern, list(ops) if ops is not None else []])
    return out


def generate_jwt(
    key_pem: str,
    issuer: str,
    repo_id: str,
    scopes: Optional[List[str]] = None,
    ttl: int = 31536000,  # 1 year default
    ops: Optional[List[str]] = None,
    refs: Optional[Refs] = None,
) -> str:
    """Generate a JWT token for Git storage authentication.

    Args:
        key_pem: Private key in PEM format (PKCS8)
        issuer: Token issuer (customer name)
        repo_id: Repository identifier
        scopes: List of permission scopes (defaults to ['git:write', 'git:read'])
        ttl: Time-to-live in seconds (defaults to 1 year)
        ops: List of policy operations (e.g., ['no-force-push'])
        refs: Ordered per-ref policy rules (first match wins)

    Returns:
        Signed JWT token string

    Raises:
        ValueError: If key is invalid or cannot be loaded
    """
    if not scopes:
        scopes = ["git:write", "git:read"]

    now = int(time.time())
    payload = {
        "iss": issuer,
        "sub": "@pierre/storage",
        "repo": repo_id,
        "scopes": scopes,
        "iat": now,
        "exp": now + ttl,
    }
    if refs:
        payload["refs"] = encode_refs_claim(refs)
    if ops:
        payload["ops"] = ops

    # Load the private key and determine algorithm
    try:
        private_key = serialization.load_pem_private_key(
            key_pem.encode("utf-8"),
            password=None,
        )
    except Exception as e:
        raise ValueError(f"Failed to load private key: {e}") from e

    # Determine algorithm based on key type
    key_type = type(private_key).__name__
    if "RSA" in key_type:
        algorithm = "RS256"
    elif "EC" in key_type or "Elliptic" in key_type:
        algorithm = "ES256"
    elif "Ed25519" in key_type or "Ed448" in key_type:
        algorithm = "EdDSA"
    else:
        # Try ES256 as default (most common for Pierre)
        algorithm = "ES256"

    # Sign the JWT
    try:
        token = jwt.encode(
            payload,
            cast(Any, private_key),
            algorithm=algorithm,
            headers={"alg": algorithm, "typ": "JWT"},
        )
    except Exception as e:
        raise ValueError(f"Failed to sign JWT: {e}") from e

    return token
