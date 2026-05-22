#!/usr/bin/env python3
"""Live ref-policy smoke test against a running local git3p stack."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

import jwt

from pierre_storage import OP_NO_PUSH, create_client

def _default_key_path() -> Path:
    if env := os.environ.get("GIT3P_KEY_PATH"):
        return Path(env)
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "git3p-backend/hack/test-scripts/dev-keys/private.pem",
        here.parents[4] / "monorepo/git3p-backend/hack/test-scripts/dev-keys/private.pem",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[-1]


KEY_PATH = _default_key_path()

API_BASE = os.environ.get("GIT3P_API_URL", "http://127.0.0.1:8081")
STORAGE_HOST = os.environ.get("GIT3P_GIT_URL", "127.0.0.1:8080").replace("http://", "").replace("https://", "")
ISSUER = os.environ.get("GIT3P_ISSUER", "local")


def git(*args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        env={
            **os.environ,
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_CONFIG_NOSYSTEM": "1",
            "HOME": str(cwd),
        },
        check=False,
    )


def build_git_remote(repo_id: str, token: str) -> str:
    """Build a Git remote URL (HTTP for local dev; JWT may contain '@')."""
    host = STORAGE_HOST
    if "://" in host:
        base = host.rstrip("/")
    elif host.startswith("127.0.0.1") or host.startswith("localhost"):
        base = f"http://{host}"
    else:
        base = f"https://{host}"
    return f"{base}/{repo_id}.git".replace("://", f"://t:{token}@", 1)


def decode_refs(token: str) -> list:
    payload = jwt.decode(token, options={"verify_signature": False})
    return payload.get("refs", [])


async def main() -> int:
    if not KEY_PATH.exists():
        print(f"FAIL: signing key not found at {KEY_PATH}", file=sys.stderr)
        return 1

    key_pem = KEY_PATH.read_text()
    repo_id = f"sdk-refpol-py-{int(time.time())}-{uuid.uuid4().hex[:6]}"

    client = create_client(
        {
            "name": ISSUER,
            "key": key_pem,
            "api_base_url": API_BASE,
            "storage_base_url": STORAGE_HOST,
        }
    )

    print(f"▶ Python ref-policy live test (repo={repo_id})")
    repo = await client.create_repo(id=repo_id, default_branch="main")
    print("  ✓ repo created")

    open_url = await repo.get_remote_url(permissions=["git:read", "git:write"], ttl=1800)
    restricted_url = await repo.get_remote_url(
        permissions=["git:read", "git:write"],
        ttl=600,
        refs=[
            {"pattern": "refs/heads/main", "ops": [OP_NO_PUSH]},
        ],
    )

    open_token = open_url.split("://", 1)[1].rsplit("@", 1)[0].split(":", 1)[1]
    restricted_token = restricted_url.split("://", 1)[1].rsplit("@", 1)[0].split(":", 1)[1]
    refs_claim = decode_refs(restricted_token)
    if refs_claim != [["refs/heads/main", ["no-push"]]]:
        print(f"FAIL: unexpected refs claim in JWT: {refs_claim}", file=sys.stderr)
        return 1
    print(f"  ✓ JWT refs claim: {refs_claim}")

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        for cmd in (
            ["init", "-b", "main"],
            ["config", "user.email", "refpol@pierre.invalid"],
            ["config", "user.name", "RefPol Live"],
            ["config", "commit.gpgsign", "false"],
        ):
            git(*cmd, cwd=work)

        (work / "README.md").write_text("hello\n")
        git("add", "README.md", cwd=work)
        git("commit", "-m", "initial", cwd=work)

        git("remote", "add", "origin", build_git_remote(repo.id, open_token), cwd=work)
        push = git("push", "-u", "origin", "main", cwd=work)
        if push.returncode != 0:
            print(f"FAIL: seed push failed:\n{push.stdout}{push.stderr}", file=sys.stderr)
            return 1
        print("  ✓ seeded main via open token")

        git("checkout", "-b", "feature/allowed", cwd=work)
        (work / "README.md").write_text("hello\nfeature\n")
        git("add", "README.md", cwd=work)
        git("commit", "-m", "feature commit", cwd=work)

        git("remote", "set-url", "origin", build_git_remote(repo.id, restricted_token), cwd=work)
        feature_push = git("push", "-u", "origin", "feature/allowed", cwd=work)
        if feature_push.returncode != 0:
            print(
                f"FAIL: feature push should succeed:\n{feature_push.stdout}{feature_push.stderr}",
                file=sys.stderr,
            )
            return 1
        print("  ✓ feature branch push allowed")

        git("checkout", "main", cwd=work)
        (work / "README.md").write_text("hello\nblocked\n")
        git("add", "README.md", cwd=work)
        git("commit", "-m", "main blocked attempt", cwd=work)
        main_push = git("push", "origin", "main", cwd=work)
        combined = f"{main_push.stdout}{main_push.stderr}"
        if main_push.returncode == 0:
            print("FAIL: push to main should be denied by no-push policy", file=sys.stderr)
            return 1
        if "denied by policy" not in combined:
            print(f"FAIL: expected 'denied by policy' in push output:\n{combined}", file=sys.stderr)
            return 1
        print("  ✓ main push denied by policy")

    try:
        await client.delete_repo(id=repo_id)
        print("  ✓ repo deleted")
    except Exception as exc:  # noqa: BLE001
        print(f"  (cleanup warning: {exc})")

    print("✅ Python ref-policy live test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
