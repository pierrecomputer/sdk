"""Check the SDK release build and plan its publish.

A release pull request writes the builds of one version to typescript/, cli/,
python/, and go/, and records them in sdk-build.json: the version, the Python
version, the npm tag, and the SHA-256 of each file in the four directories.

    python3 scripts/sdk_build.py plan
        Checks the build and asks each registry for the version. Fails when
        the version is below the highest version on npm. Writes one publish
        output for each package to $GITHUB_OUTPUT. publish-sdk.yml runs it.
    python3 scripts/sdk_build.py check
        Runs the checks of plan, and also fails when a registry has the
        version. check-sdk-build.yml runs it on each pull request.
    python3 scripts/sdk_build.py npm-files <directory>
        Reads the output of `npm pack --dry-run --json` on stdin. Fails when
        the packed files are not the files of <directory> in sdk-build.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORD = "sdk-build.json"
DIRECTORIES = ("typescript", "cli", "python", "go")
NPM_PACKAGES = {"typescript": "@pierre/sdk", "cli": "@pierre/cli"}
PYTHON_PACKAGE = "pierre-sdk"
GO_MODULE = "github.com/pierrecomputer/sdk/go"

# A release version is X.Y.Z or X.Y.Z-canary.N. npm and Go use it as is, and
# Python uses X.Y.Z.devN for X.Y.Z-canary.N.
VERSION_PATTERN = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-canary\.(0|[1-9]\d*))?")
SEMVER_PATTERN = re.compile(r"(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


class BuildError(Exception):
    """A check of the build or of a registry failed."""


@dataclass(frozen=True)
class Record:
    """The content of sdk-build.json."""

    version: str
    python_version: str
    npm_tag: str
    files: dict[str, str]


def npm_tag(version: str) -> str:
    """Return the npm dist-tag of a release version."""
    match = VERSION_PATTERN.fullmatch(version)
    if match is None:
        raise BuildError(f"the version {version!r} is not X.Y.Z or X.Y.Z-canary.N")
    return "latest" if match.group(4) is None else "canary"


def python_version(version: str) -> str:
    """Return the Python version of a release version."""
    npm_tag(version)
    base, _, canary = version.partition("-canary.")
    return f"{base}.dev{canary}" if canary else base


SemverKey = tuple[int, int, int, int, tuple[tuple[int, int, str], ...]]


def semver_key(version: str) -> SemverKey | None:
    """Return a key that sorts SemVer versions by precedence, or None for another form."""
    match = SEMVER_PATTERN.fullmatch(version)
    if match is None:
        return None
    major, minor, patch, prerelease = match.groups()
    if prerelease is None:
        return (int(major), int(minor), int(patch), 1, ())
    identifiers = tuple(
        (0, int(part), "") if part.isdigit() else (1, 0, part) for part in prerelease.split(".")
    )
    return (int(major), int(minor), int(patch), 0, identifiers)


def read_text(root: Path, name: str) -> str:
    """Read a file of the build, or fail with its name."""
    try:
        return (root / name).read_text(encoding="utf-8")
    except FileNotFoundError:
        raise BuildError(f"{name} is missing") from None


def load_record(root: Path) -> Record | None:
    """Read and check sdk-build.json. Return None when there is no build."""
    if not (root / RECORD).exists():
        present = [f"{directory}/" for directory in DIRECTORIES if (root / directory).exists()]
        if present:
            raise BuildError(f"{', '.join(present)} exist, but {RECORD} does not")
        return None
    try:
        record = json.loads(read_text(root, RECORD))
    except json.JSONDecodeError as error:
        raise BuildError(f"{RECORD} is not JSON: {error}") from None
    keys = {"version", "python_version", "npm_tag", "files"}
    if not isinstance(record, dict) or set(record) != keys:
        raise BuildError(f"{RECORD} must have exactly the keys {', '.join(sorted(keys))}")
    version = record["version"]
    if not isinstance(version, str):
        raise BuildError(f"version in {RECORD} is not a string")
    if record["npm_tag"] != npm_tag(version):
        raise BuildError(f"npm_tag in {RECORD} must be {npm_tag(version)!r} for {version}")
    if record["python_version"] != python_version(version):
        raise BuildError(
            f"python_version in {RECORD} must be {python_version(version)!r} for {version}"
        )
    files = record["files"]
    if not isinstance(files, dict):
        raise BuildError(f"files in {RECORD} is not an object")
    for name, digest in files.items():
        if name.split("/", 1)[0] not in DIRECTORIES or ".." in name.split("/"):
            raise BuildError(f"{name} in {RECORD} is outside {', '.join(DIRECTORIES)}")
        if not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest):
            raise BuildError(f"{name} in {RECORD} has no SHA-256")
    return Record(version, record["python_version"], record["npm_tag"], files)


def tree_files(root: Path) -> dict[str, Path]:
    """Return each file of the four directories by its path from the root."""
    files: dict[str, Path] = {}
    for directory in DIRECTORIES:
        for current, directories, names in os.walk(root / directory):
            for name in directories + names:
                path = Path(current, name)
                if path.is_symlink() or not (path.is_dir() or path.is_file()):
                    raise BuildError(f"{path.relative_to(root)} is not a regular file")
            for name in names:
                path = Path(current, name)
                files[path.relative_to(root).as_posix()] = path
    return files


def check_files(root: Path, record: Record) -> None:
    """Fail when a file of the four directories differs from sdk-build.json."""
    recorded = record.files
    tree = tree_files(root)
    errors = [f"{name}: in {RECORD}, but missing" for name in sorted(recorded.keys() - tree.keys())]
    errors += [f"{name}: not in {RECORD}" for name in sorted(tree.keys() - recorded.keys())]
    for name in sorted(recorded.keys() & tree.keys()):
        if hashlib.sha256(tree[name].read_bytes()).hexdigest() != recorded[name]:
            errors.append(f"{name}: the SHA-256 differs from {RECORD}")
    if errors:
        raise BuildError("the files differ from the build record:\n  " + "\n  ".join(errors))


def check_manifests(root: Path, record: Record) -> None:
    """Fail when a package manifest does not have the name and the version of the record."""
    import tomllib  # Python 3.11 or later.

    version = record.version
    errors: list[str] = []

    def expect(name: str, field: str, actual: object, expected: object) -> None:
        if actual != expected:
            errors.append(f"{name}: {field} is {actual!r}, not {expected!r}")

    for directory, package in NPM_PACKAGES.items():
        name = f"{directory}/package.json"
        manifest = json.loads(read_text(root, name))
        expect(name, "name", manifest.get("name"), package)
        expect(name, "version", manifest.get("version"), version)
        tag = manifest.get("publishConfig", {}).get("tag", "latest")
        expect(name, "publishConfig.tag", tag, record.npm_tag)

    project = tomllib.loads(read_text(root, "python/pyproject.toml")).get("project", {})
    expect("python/pyproject.toml", "name", project.get("name"), PYTHON_PACKAGE)
    expect("python/pyproject.toml", "version", project.get("version"), record.python_version)
    headers = read_text(root, "python/PKG-INFO").split("\n\n", 1)[0]
    metadata = dict(line.split(": ", 1) for line in headers.splitlines() if ": " in line)
    expect("python/PKG-INFO", "Name", metadata.get("Name"), PYTHON_PACKAGE)
    expect("python/PKG-INFO", "Version", metadata.get("Version"), record.python_version)

    module = re.search(r"^module (\S+)$", read_text(root, "go/go.mod"), re.MULTILINE)
    expect("go/go.mod", "module", module and module.group(1), GO_MODULE)
    constant = re.search(
        r'^const Version = "(.*)"$', read_text(root, "go/version.go"), re.MULTILINE
    )
    expect("go/version.go", "Version", constant and constant.group(1), version)

    if errors:
        raise BuildError("the manifests differ from the build record:\n  " + "\n  ".join(errors))


def fetch_json(url: str, accept: str = "application/json") -> object | None:
    """Return the JSON at a URL, or None for HTTP 404."""
    request = urllib.request.Request(url, headers={"Accept": accept})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise BuildError(f"{url}: HTTP {error.code}") from None
    except urllib.error.URLError as error:
        raise BuildError(f"{url}: {error.reason}") from None


def npm_versions(package: str) -> set[str]:
    """Return each version of a package on npm."""
    url = "https://registry.npmjs.org/" + package.replace("/", "%2F")
    document = fetch_json(url, "application/vnd.npm.install-v1+json")
    return set() if not isinstance(document, dict) else set(document.get("versions", {}))


def pypi_has(version: str) -> bool:
    """Return whether PyPI has a version of the Python package."""
    return fetch_json(f"https://pypi.org/pypi/{PYTHON_PACKAGE}/{version}/json") is not None


def go_tag_exists(root: Path, version: str) -> bool:
    """Return whether the repository has the tag of a Go version."""
    result = subprocess.run(
        ["git", "ls-remote", "--tags", "origin", f"refs/tags/go/v{version}"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise BuildError(f"git ls-remote failed: {result.stderr.strip()}")
    return bool(result.stdout.strip())


def plan(root: Path, *, pull_request: bool) -> dict[str, str]:
    """Check the build and the registries, and return the outputs of the plan."""
    record = load_record(root)
    if record is None:
        print(f"No {RECORD}: nothing to check or publish.")
        return {"build": "false"}
    check_files(root, record)
    check_manifests(root, record)
    version, pyversion = record.version, record.python_version

    versions = {package: npm_versions(package) for package in NPM_PACKAGES.values()}
    published = {
        f"pierre-sdk {pyversion} on PyPI": pypi_has(pyversion),
        f"@pierre/sdk@{version} on npm": version in versions["@pierre/sdk"],
        f"@pierre/cli@{version} on npm": version in versions["@pierre/cli"],
        f"the tag go/v{version}": go_tag_exists(root, version),
    }
    for name, present in published.items():
        print(f"{name}: {'published' if present else 'not published'}")

    keys = {v: key for v in set().union(*versions.values()) if (key := semver_key(v)) is not None}
    highest = max(keys, key=keys.__getitem__, default=None)
    current = semver_key(version)
    if highest is not None and current is not None and current < keys[highest]:
        raise BuildError(
            f"{version} is below {highest}, the highest version on npm. "
            "Publish a new version instead, so that no npm tag moves back."
        )
    if pull_request and any(published.values()):
        names = ", ".join(name for name, present in published.items() if present)
        raise BuildError(f"the registries already have {version}: {names}")

    pypi, npm_sdk, npm_cli, go = (str(not present).lower() for present in published.values())
    return {
        "build": "true",
        "version": version,
        "python_version": pyversion,
        "npm_tag": record.npm_tag,
        "publish_pypi": pypi,
        "publish_npm_sdk": npm_sdk,
        "publish_npm_cli": npm_cli,
        "publish_go": go,
    }


def check_npm_files(root: Path, directory: str, pack_output: str) -> None:
    """Fail when `npm pack` of a directory does not pack exactly its recorded files."""
    record = load_record(root)
    if record is None:
        raise BuildError(f"there is no {RECORD}")
    # npm 11 prints a list of packages, and npm 12 an object keyed by package name.
    output = json.loads(pack_output)
    packages = output if isinstance(output, list) else list(output.values())
    if len(packages) != 1:
        raise BuildError(f"npm pack of {directory}/ gave {len(packages)} packages, not 1")
    packed = {f"{directory}/{entry['path']}" for entry in packages[0]["files"]}
    recorded = {name for name in record.files if name.startswith(f"{directory}/")}
    errors = [f"{name}: packed, but not in {RECORD}" for name in sorted(packed - recorded)]
    errors += [f"{name}: in {RECORD}, but not packed" for name in sorted(recorded - packed)]
    errors += [
        f"{directory}/{name}: not packed"
        for name in ("LICENSE", "README.md", "package.json")
        if f"{directory}/{name}" not in packed
    ]
    if errors:
        raise BuildError(f"npm pack of {directory}/ differs:\n  " + "\n  ".join(errors))
    print(f"npm pack of {directory}/: {len(packed)} files, as recorded")


def main(argv: list[str] | None = None) -> int:
    """Run the command line."""
    parser = argparse.ArgumentParser(description="Check the SDK release build.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("plan", help="check the build and plan the publish")
    commands.add_parser("check", help="check the build of a pull request")
    npm_files = commands.add_parser("npm-files", help="check the output of npm pack")
    npm_files.add_argument("directory", choices=sorted(NPM_PACKAGES))
    args = parser.parse_args(argv)

    try:
        if args.command == "npm-files":
            check_npm_files(ROOT, args.directory, sys.stdin.read())
            return 0
        outputs = plan(ROOT, pull_request=args.command == "check")
    except BuildError as error:
        print(f"sdk_build: {error}", file=sys.stderr)
        return 1

    lines = "".join(f"{key}={value}\n" for key, value in outputs.items())
    print(lines, end="")
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
