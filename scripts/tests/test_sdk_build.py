"""Tests for the SDK release build check."""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parents[1]))

import sdk_build  # noqa: E402


class VersionTest(unittest.TestCase):
    """Test the release version forms and their order."""

    def test_canary_and_release_versions(self) -> None:
        """A canary gets the canary tag and a dev version; a release gets latest."""
        self.assertEqual(sdk_build.npm_tag("0.1.0-canary.4"), "canary")
        self.assertEqual(sdk_build.python_version("0.1.0-canary.4"), "0.1.0.dev4")
        self.assertEqual(sdk_build.npm_tag("0.1.0"), "latest")
        self.assertEqual(sdk_build.python_version("0.1.0"), "0.1.0")

    def test_other_version_forms_fail(self) -> None:
        """Each other version form fails."""
        for version in ("0.1.0-beta.1", "0.1", "01.0.0", "0.1.0-canary.04", "v0.1.0"):
            with self.subTest(version=version), self.assertRaises(sdk_build.BuildError):
                sdk_build.npm_tag(version)

    def test_semver_order(self) -> None:
        """Versions sort by SemVer precedence, with numeric prerelease parts."""
        versions = ["0.1.0", "0.1.0-canary.10", "0.0.0", "0.1.0-canary.3", "0.1.0-canary.4"]
        self.assertEqual(
            sorted(versions, key=sdk_build.semver_key),
            ["0.0.0", "0.1.0-canary.3", "0.1.0-canary.4", "0.1.0-canary.10", "0.1.0"],
        )


class RecordTest(unittest.TestCase):
    """Test the file checks against sdk-build.json."""

    def setUp(self) -> None:
        """Create a build with one file in each directory."""
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        for name in ("typescript/dist/index.js", "cli/dist/cli.js", "python/PKG-INFO", "go/go.mod"):
            self.write(name, f"{name}\n")
        self.write_record()

    def tearDown(self) -> None:
        """Remove the build."""
        self.temporary_directory.cleanup()

    def write(self, name: str, content: str) -> None:
        """Write a file of the build."""
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def write_record(self) -> None:
        """Record each file of the build in sdk-build.json."""
        files = {
            path.relative_to(self.root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for directory in sdk_build.DIRECTORIES
            for path in (self.root / directory).rglob("*")
            if path.is_file()
        }
        record = {
            "version": "0.1.0-canary.4",
            "python_version": "0.1.0.dev4",
            "npm_tag": "canary",
            "files": files,
        }
        (self.root / sdk_build.RECORD).write_text(json.dumps(record), encoding="utf-8")

    def check(self) -> None:
        """Load the record and check the files."""
        record = sdk_build.load_record(self.root)
        assert record is not None
        sdk_build.check_files(self.root, record)

    def test_recorded_build_passes(self) -> None:
        """A build that matches its record passes."""
        self.check()

    def test_changed_byte_fails(self) -> None:
        """A change of one byte fails and names the file."""
        self.write("typescript/dist/index.js", "typescript/dist/index.jS\n")
        with self.assertRaisesRegex(sdk_build.BuildError, "typescript/dist/index.js: the SHA-256"):
            self.check()

    def test_added_and_removed_files_fail(self) -> None:
        """A file that is not recorded, and a recorded file that is missing, fail."""
        self.write("go/extra.go", "package pierre\n")
        (self.root / "cli/dist/cli.js").unlink()
        with self.assertRaises(sdk_build.BuildError) as raised:
            self.check()
        self.assertIn("go/extra.go: not in", str(raised.exception))
        self.assertIn("cli/dist/cli.js: in sdk-build.json, but missing", str(raised.exception))

    def test_wrong_tag_fails(self) -> None:
        """A record whose npm tag does not agree with its version fails."""
        record = json.loads((self.root / sdk_build.RECORD).read_text(encoding="utf-8"))
        record["npm_tag"] = "latest"
        (self.root / sdk_build.RECORD).write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaisesRegex(sdk_build.BuildError, "npm_tag"):
            sdk_build.load_record(self.root)

    def test_npm_pack_files(self) -> None:
        """npm pack must pack exactly the recorded files, in the output of npm 11 and npm 12."""
        for name in ("LICENSE", "README.md", "package.json"):
            self.write(f"cli/{name}", f"{name}\n")
        self.write_record()
        files = [{"path": name} for name in ("LICENSE", "README.md", "package.json", "dist/cli.js")]
        for output in ([{"files": files}], {"@pierre/cli": {"files": files}}):
            with self.subTest(output=type(output).__name__):
                sdk_build.check_npm_files(self.root, "cli", json.dumps(output))
        with self.assertRaisesRegex(sdk_build.BuildError, "cli/dist/cli.js: in sdk-build.json"):
            sdk_build.check_npm_files(self.root, "cli", json.dumps([{"files": files[:3]}]))

    def test_no_record(self) -> None:
        """With no record and no build there is nothing to check; a build with no record fails."""
        (self.root / sdk_build.RECORD).unlink()
        with self.assertRaisesRegex(sdk_build.BuildError, "does not"):
            sdk_build.load_record(self.root)
        empty = tempfile.TemporaryDirectory()
        self.addCleanup(empty.cleanup)
        self.assertIsNone(sdk_build.load_record(Path(empty.name)))


class PullRequestTest(unittest.TestCase):
    """Test the rule that a release pull request needs a version that no registry has."""

    VERSION = "0.1.0-canary.6"

    def setUp(self) -> None:
        """Commit a build of canary 5, then of VERSION, and publish VERSION everywhere."""
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.git("init", "-q", "-b", "main")
        self.write_build("0.1.0-canary.5")
        self.previous = self.commit("Release v0.1.0-canary.5")
        self.write_build(self.VERSION)
        self.current = self.commit("Release v" + self.VERSION)
        for name, value in (
            ("npm_versions", lambda package: {self.VERSION}),
            ("pypi_has", lambda version: True),
            ("go_tag_exists", lambda root, version: True),
        ):
            patcher = mock.patch.object(sdk_build, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def plan(self, base: str | None) -> dict[str, str]:
        """Plan the publish of a pull request with a base commit, with no output."""
        with contextlib.redirect_stdout(io.StringIO()):
            return sdk_build.plan(self.root, pull_request=True, base=base)

    def git(self, *args: str) -> str:
        """Run git in the repository."""
        return subprocess.run(
            ["git", "-c", "user.name=test", "-c", "user.email=test@example.com", *args],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()

    def commit(self, message: str) -> str:
        """Commit every file, and return the commit."""
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD")

    def write_build(self, version: str) -> None:
        """Write the manifests of a build of a version, and record them in sdk-build.json."""
        python_version = sdk_build.python_version(version)
        manifests = {
            "typescript/package.json": {"name": "@pierre/sdk"},
            "cli/package.json": {"name": "@pierre/cli"},
        }
        for name, manifest in manifests.items():
            manifest.update(version=version, publishConfig={"tag": sdk_build.npm_tag(version)})
            (self.root / name).parent.mkdir(parents=True, exist_ok=True)
            (self.root / name).write_text(json.dumps(manifest), encoding="utf-8")
        (self.root / "python").mkdir(exist_ok=True)
        (self.root / "python/pyproject.toml").write_text(
            f'[project]\nname = "pierre-sdk"\nversion = "{python_version}"\n', encoding="utf-8"
        )
        (self.root / "python/PKG-INFO").write_text(
            f"Name: pierre-sdk\nVersion: {python_version}\n\nThe Pierre SDK.\n", encoding="utf-8"
        )
        (self.root / "go").mkdir(exist_ok=True)
        (self.root / "go/go.mod").write_text(f"module {sdk_build.GO_MODULE}\n", encoding="utf-8")
        (self.root / "go/version.go").write_text(
            f'package pierre\n\nconst Version = "{version}"\n', encoding="utf-8"
        )
        files = {
            path.relative_to(self.root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for directory in sdk_build.DIRECTORIES
            for path in (self.root / directory).rglob("*")
            if path.is_file()
        }
        record = {
            "version": version,
            "python_version": python_version,
            "npm_tag": sdk_build.npm_tag(version),
            "files": files,
        }
        (self.root / sdk_build.RECORD).write_text(json.dumps(record), encoding="utf-8")

    def test_a_pull_request_that_keeps_the_build_passes(self) -> None:
        """A pull request that does not change sdk-build.json passes, and publishes nothing."""
        (self.root / "AGENTS.md").write_text("Notes.\n", encoding="utf-8")
        self.commit("Change the notes")
        outputs = self.plan(self.current)
        self.assertEqual(outputs["publish_npm_sdk"], "false")
        self.assertEqual(outputs["publish_go"], "false")

    def test_a_release_pull_request_of_a_published_version_fails(self) -> None:
        """A pull request that changes sdk-build.json fails when a registry has its version."""
        with self.assertRaisesRegex(sdk_build.BuildError, "the registries already have"):
            self.plan(self.previous)

    def test_the_first_build_of_a_published_version_fails(self) -> None:
        """A build on a base with no sdk-build.json is a release pull request."""
        empty_tree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
        empty = self.git("commit-tree", empty_tree, "-m", "Empty")
        with self.assertRaisesRegex(sdk_build.BuildError, "the registries already have"):
            self.plan(empty)

    def test_without_a_base_a_published_version_fails(self) -> None:
        """With no base, each pull request is a release pull request."""
        with self.assertRaisesRegex(sdk_build.BuildError, "the registries already have"):
            self.plan(None)

    def test_an_unknown_base_fails(self) -> None:
        """A base commit that the checkout does not have fails and names the commit."""
        with self.assertRaisesRegex(sdk_build.BuildError, "0{40} is not in the checkout"):
            self.plan("0" * 40)


if __name__ == "__main__":
    unittest.main()
