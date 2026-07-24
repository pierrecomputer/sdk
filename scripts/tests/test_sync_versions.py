"""Tests for the repository version sync tool."""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "sync_versions.py"
TARGETS = (
    "packages/code-storage-typescript/package.json",
    "packages/code-storage-python/pyproject.toml",
    "packages/code-storage-python/pierre_storage/version.py",
    "packages/code-storage-python/uv.lock",
    "packages/code-storage-go/version.go",
)


class SyncVersionsTest(unittest.TestCase):
    """Test version checks and updates."""

    def setUp(self) -> None:
        """Create a repository fixture."""
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.write(".version", "2.3.4\n")
        self.write(
            "packages/code-storage-typescript/package.json",
            '{\n  "name": "@pierre/storage",\n  "version": "1.0.0",\n'
            '  "dependencyVersion": "9.9.9"\n}\n',
        )
        self.write(
            "packages/code-storage-python/pyproject.toml",
            '[build-system]\nrequires = ["setuptools>=61.0"]\n\n'
            '[project]\nname = "pierre-storage"\nversion = "1.0.0"\n'
            'requires-python = ">=3.9"\n',
        )
        self.write(
            "packages/code-storage-python/pierre_storage/version.py",
            'PACKAGE_NAME = "code-storage-py-sdk"\nPACKAGE_VERSION = "1.0.0"\n',
        )
        self.write(
            "packages/code-storage-python/uv.lock",
            "version = 1\nrevision = 3\n\n"
            '[[package]]\nname = "httpx"\nversion = "0.28.1"\n'
            'source = { registry = "https://pypi.org/simple" }\n\n'
            '[[package]]\nname = "pierre-storage"\nversion = "1.0.0"\n'
            'source = { virtual = "." }\n\n'
            '[[package]]\nname = "pytest"\nversion = "8.4.2"\n'
            'source = { registry = "https://pypi.org/simple" }\n',
        )
        self.write(
            "packages/code-storage-go/version.go",
            'package storage\n\nconst (\n\tPackageName = "code-storage-go-sdk"\n'
            '\tPackageVersion = "1.0.0"\n)\n',
        )

    def tearDown(self) -> None:
        """Remove the repository fixture."""
        self.temporary_directory.cleanup()

    def write(self, relative_path: str, content: str) -> None:
        """Write a fixture file."""
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def run_tool(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        """Run the version sync tool."""
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(self.root), *arguments],
            check=False,
            capture_output=True,
            text=True,
        )

    def test_check_reports_each_out_of_sync_file(self) -> None:
        """Report each version field that differs from .version."""
        result = self.run_tool("--check")

        self.assertEqual(result.returncode, 1)
        for target in TARGETS:
            self.assertIn(target, result.stderr)

    def test_sync_updates_each_version_field(self) -> None:
        """Set each package version from .version."""
        result = self.run_tool()

        self.assertEqual(result.returncode, 0, result.stderr)
        for target in TARGETS:
            content = (self.root / target).read_text(encoding="utf-8")
            self.assertIn("2.3.4", content)
            self.assertNotIn("1.0.0", content)
        self.assertIn(
            '"dependencyVersion": "9.9.9"', (self.root / TARGETS[0]).read_text()
        )
        self.assertIn('requires-python = ">=3.9"', (self.root / TARGETS[1]).read_text())
        self.assertEqual(self.run_tool("--check").returncode, 0)

    def test_sync_keeps_each_other_lock_version(self) -> None:
        """Change only the pierre-storage version in the lock file."""
        result = self.run_tool()

        self.assertEqual(result.returncode, 0, result.stderr)
        lock = (self.root / "packages/code-storage-python/uv.lock").read_text()
        self.assertIn('name = "pierre-storage"\nversion = "2.3.4"', lock)
        self.assertIn('name = "httpx"\nversion = "0.28.1"', lock)
        self.assertIn('name = "pytest"\nversion = "8.4.2"', lock)

    def test_invalid_canonical_version_fails(self) -> None:
        """Reject a canonical version that is not a release version."""
        self.write(".version", "release-latest\n")

        result = self.run_tool("--check")

        self.assertEqual(result.returncode, 2)
        self.assertIn("Invalid version in .version", result.stderr)

    def test_prerelease_and_build_metadata_versions_fail(self) -> None:
        """Reject a version that npm, PyPI, and Go do not accept together."""
        for version in ("2.3.4-rc.1", "2.3.4+build.5", "v2.3.4", "2.3.4.5"):
            with self.subTest(version=version):
                self.write(".version", f"{version}\n")

                result = self.run_tool("--check")

                self.assertEqual(result.returncode, 2)
                self.assertIn("Use MAJOR.MINOR.PATCH", result.stderr)

    def test_version_below_the_previous_version_fails(self) -> None:
        """Reject a canonical version that goes backward."""
        result = self.run_tool("--check", "--not-below", "2.3.5")

        self.assertEqual(result.returncode, 2)
        self.assertIn("Version goes backward", result.stderr)

    def test_version_at_or_above_the_previous_version_passes(self) -> None:
        """Accept an unchanged or higher canonical version."""
        for baseline in ("2.3.4", "2.3.3", "1.9.9", ""):
            with self.subTest(baseline=baseline):
                result = self.run_tool("--check", "--not-below", baseline)

                # Exit code 1 reports the drift in the fixture. The forward-only
                # check rejects a version with exit code 2.
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertNotIn("Version goes backward", result.stderr)

    def test_invalid_previous_version_fails(self) -> None:
        """Reject a previous version that the tool cannot compare."""
        result = self.run_tool("--check", "--not-below", "latest")

        self.assertEqual(result.returncode, 2)
        self.assertIn("Invalid version in --not-below", result.stderr)

    def test_print_writes_only_the_canonical_version(self) -> None:
        """Print the canonical version for the release tag."""
        self.write(".version", "  2.3.4  \n")

        result = self.run_tool("--print")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "2.3.4\n")

    def test_print_rejects_an_invalid_canonical_version(self) -> None:
        """Print nothing when .version is not a release version."""
        self.write(".version", "2.3.4+build.5\n")

        result = self.run_tool("--print")

        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
