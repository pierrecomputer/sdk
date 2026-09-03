"""Set each package version from the repository .version file."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from re import Pattern

# npm and Go use SemVer prereleases while Python uses PEP 440, so .version uses
# SemVer and Python targets translate X.Y.Z-beta.N to X.Y.ZbN.
VERSION_PATTERN = re.compile(r"(\d+)\.(\d+)\.(\d+)(?:-beta\.(0|[1-9]\d*))?")
PYTHON_TARGET_PATHS = {
    Path("packages/code-storage-python/pyproject.toml"),
    Path("packages/code-storage-python/pierre_storage/version.py"),
    Path("packages/code-storage-python/uv.lock"),
}


@dataclass(frozen=True)
class VersionTarget:
    """Describe one generated package version field."""

    path: Path
    pattern: Pattern[str]


@dataclass(frozen=True)
class TargetState:
    """Store a target file and its current version."""

    target: VersionTarget
    content: str
    version: str


TARGETS = (
    VersionTarget(
        Path("packages/code-storage-typescript/package.json"),
        re.compile(
            r'(?P<prefix>^\s*"version"\s*:\s*")'
            r'(?P<version>[^"]+)'
            r'(?P<suffix>"\s*,?\s*$)',
            re.MULTILINE,
        ),
    ),
    VersionTarget(
        Path("packages/code-storage-python/pyproject.toml"),
        re.compile(
            r'(?P<prefix>^\[project\][\s\S]*?^version\s*=\s*")'
            r'(?P<version>[^"]+)'
            r'(?P<suffix>")',
            re.MULTILINE,
        ),
    ),
    VersionTarget(
        Path("packages/code-storage-python/pierre_storage/version.py"),
        re.compile(
            r'(?P<prefix>^PACKAGE_VERSION\s*=\s*")'
            r'(?P<version>[^"]+)'
            r'(?P<suffix>"\s*$)',
            re.MULTILINE,
        ),
    ),
    VersionTarget(
        Path("packages/code-storage-python/uv.lock"),
        re.compile(
            r"(?P<prefix>^\[\[package\]\]\s*\n"
            r'(?:(?!^\[\[package\]\]).)*?^name\s*=\s*"pierre-storage"\s*\n'
            r'(?:(?!^\[\[package\]\]).)*?^version\s*=\s*")'
            r'(?P<version>[^"]+)'
            r'(?P<suffix>")',
            re.MULTILINE | re.DOTALL,
        ),
    ),
    VersionTarget(
        Path("packages/code-storage-go/version.go"),
        re.compile(
            r'(?P<prefix>^\s*PackageVersion\s*=\s*")'
            r'(?P<version>[^"]+)'
            r'(?P<suffix>"\s*$)',
            re.MULTILINE,
        ),
    ),
)


class VersionSyncError(Exception):
    """Report an invalid canonical file or package file."""


def parse_version(value: str, source: str) -> tuple[int, ...]:
    """Validate one version and return its comparable parts."""
    version = value.strip()
    match = VERSION_PATTERN.fullmatch(version)
    if match is None:
        raise VersionSyncError(
            f"Invalid version in {source}: {version!r}. Use MAJOR.MINOR.PATCH "
            "or MAJOR.MINOR.PATCH-beta.NUMBER."
        )
    release = tuple(int(part) for part in match.groups()[:3])
    beta = match.group(4)
    return (*release, 1, 0) if beta is None else (*release, 0, int(beta))


def target_version(target: VersionTarget, version: str) -> str:
    """Render the canonical version for one package ecosystem."""
    if target.path in PYTHON_TARGET_PATHS:
        return re.sub(r"-beta\.(\d+)$", r"b\1", version)
    return version


def read_canonical_version(root: Path) -> str:
    """Read and validate the canonical package version."""
    path = root / ".version"
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise VersionSyncError("Missing canonical version file: .version") from error

    version = content.strip()
    parse_version(version, ".version")
    return version


def check_not_below(version: str, baseline: str) -> None:
    """Reject a canonical version below the previous version."""
    if parse_version(version, ".version") < parse_version(baseline, "--not-below"):
        raise VersionSyncError(
            f"Version goes backward: .version is {version}, "
            f"below {baseline.strip()}. Set .version to a higher version."
        )


def check_channel(version: str, channel: str) -> None:
    """Require a stable or beta canonical version."""
    is_beta = "-beta." in version
    if channel == "beta" and not is_beta:
        raise VersionSyncError(
            f"Beta releases require MAJOR.MINOR.PATCH-beta.NUMBER, got {version}."
        )
    if channel == "stable" and is_beta:
        raise VersionSyncError(f"Stable releases require MAJOR.MINOR.PATCH, got {version}.")


def read_target_states(root: Path) -> list[TargetState]:
    """Read each generated package version field."""
    states = []
    for target in TARGETS:
        path = root / target.path
        try:
            content = path.read_text(encoding="utf-8")
        except FileNotFoundError as error:
            raise VersionSyncError(f"Missing version target: {target.path}") from error

        matches = list(target.pattern.finditer(content))
        if len(matches) != 1:
            raise VersionSyncError(
                f"Expected one version field in {target.path}, found {len(matches)}"
            )
        states.append(TargetState(target, content, matches[0].group("version")))
    return states


def replace_version(state: TargetState, version: str) -> str:
    """Replace one generated package version field."""

    def replacement(match: re.Match[str]) -> str:
        return f"{match.group('prefix')}{version}{match.group('suffix')}"

    return state.target.pattern.sub(replacement, state.content, count=1)


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Set each package version from the repository .version file."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report version differences without file changes.",
    )
    parser.add_argument(
        "--print",
        action="store_true",
        dest="print_version",
        help="Print the canonical version from .version.",
    )
    parser.add_argument(
        "--not-below",
        metavar="VERSION",
        default="",
        help="Reject a canonical version below VERSION. An empty value skips it.",
    )
    parser.add_argument(
        "--require-channel",
        choices=("stable", "beta"),
        help="Reject a canonical version for the other release channel.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def main() -> int:
    """Check or update package versions."""
    arguments = parse_arguments()
    root = arguments.root.resolve()

    try:
        version = read_canonical_version(root)
        if arguments.not_below.strip():
            check_not_below(version, arguments.not_below)
        if arguments.require_channel:
            check_channel(version, arguments.require_channel)
        if arguments.print_version:
            print(version)
            return 0
        states = read_target_states(root)
    except VersionSyncError as error:
        print(error, file=sys.stderr)
        return 2

    mismatches = [
        state for state in states if state.version != target_version(state.target, version)
    ]
    if arguments.check:
        if not mismatches:
            print(f"All package versions match .version ({version}).")
            return 0

        print(f"Package versions do not match .version ({version}):", file=sys.stderr)
        for state in mismatches:
            print(
                f"- {state.target.path}: {state.version}",
                file=sys.stderr,
            )
        print("Run python3 scripts/sync_versions.py.", file=sys.stderr)
        return 1

    for state in mismatches:
        path = root / state.target.path
        expected = target_version(state.target, version)
        path.write_text(replace_version(state, expected), encoding="utf-8")
        print(f"Updated {state.target.path}: {state.version} -> {expected}")

    if not mismatches:
        print(f"All package versions match .version ({version}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
