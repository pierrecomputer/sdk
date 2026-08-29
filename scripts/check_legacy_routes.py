"""Keep deprecated REST route strings inside named compatibility helpers."""

from __future__ import annotations

import sys
from pathlib import Path

SOURCE_ROOTS = (
    Path("packages/code-storage-typescript/src"),
    Path("packages/code-storage-python/pierre_storage"),
    Path("packages/code-storage-go"),
)
VERSION_SEGMENT = "v" + "1"
LEGACY_PATH = f"{VERSION_SEGMENT}/repos/git-credentials"
VERSIONED_API_MARKER = f"api/{VERSION_SEGMENT}"
VERSIONED_REPOS_MARKER = f"{VERSION_SEGMENT}/repos"
ALLOWED_LINES = {
    Path("packages/code-storage-typescript/src/index.ts"): f"return '{LEGACY_PATH}';",
    Path("packages/code-storage-python/pierre_storage/client.py"): (
        f'return f"{{api_base_url.rstrip(\'/\')}}/api/{LEGACY_PATH}"'
    ),
    Path("packages/code-storage-go/client.go"): f'return "{LEGACY_PATH}"',
}


def find_violations(root: Path) -> list[str]:
    """Return unexpected legacy route lines and missing compatibility helpers."""
    violations: list[str] = []
    allowed_counts = {path: 0 for path in ALLOWED_LINES}

    for source_root in SOURCE_ROOTS:
        for path in sorted((root / source_root).rglob("*")):
            if not path.is_file() or path.name.endswith("_test.go"):
                continue
            if path.suffix not in {".go", ".py", ".ts"}:
                continue
            relative = path.relative_to(root)
            for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if VERSIONED_API_MARKER not in line and VERSIONED_REPOS_MARKER not in line:
                    continue
                if relative in ALLOWED_LINES and line.strip() == ALLOWED_LINES[relative]:
                    allowed_counts[relative] += 1
                    continue
                violations.append(f"{relative}:{line_number}: {line.strip()}")

    for path, count in allowed_counts.items():
        if count != 1:
            violations.append(f"{path}: expected one named compatibility route, found {count}")
    return violations


def main() -> int:
    """Check the repository and report every violation."""
    root = Path(__file__).resolve().parents[1]
    violations = find_violations(root)
    if not violations:
        return 0
    print("Deprecated REST routes escaped their compatibility helpers:", file=sys.stderr)
    for violation in violations:
        print(f"- {violation}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
