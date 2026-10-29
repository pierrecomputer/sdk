"""Tests for the SDK release build check."""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
