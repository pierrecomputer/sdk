"""Tests for the deprecated REST route boundary."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIRECTORY = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS_DIRECTORY))

from check_legacy_routes import ALLOWED_LINES, find_violations  # noqa: E402


class LegacyRouteCheckTest(unittest.TestCase):
    """Keep deprecated route strings in the three named helpers."""

    def setUp(self) -> None:
        """Create a minimal source tree with each allowed helper."""
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        for path, line in ALLOWED_LINES.items():
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"{line}\n", encoding="utf-8")

    def tearDown(self) -> None:
        """Remove the source fixture."""
        self.temporary_directory.cleanup()

    def test_named_helpers_are_allowed(self) -> None:
        """Accept exactly one compatibility route in each SDK helper file."""
        self.assertEqual(find_violations(self.root), [])

    def test_scattered_legacy_route_is_rejected(self) -> None:
        """Reject a deprecated route in another production source file."""
        path = self.root / "packages/code-storage-go/repo.go"
        path.write_text('const route = "v1/repos/branches"\n', encoding="utf-8")

        violations = find_violations(self.root)

        self.assertEqual(len(violations), 1)
        self.assertIn("packages/code-storage-go/repo.go:1", violations[0])

    def test_missing_helper_is_rejected(self) -> None:
        """Require each language to keep its named compatibility route."""
        path = self.root / "packages/code-storage-go/client.go"
        path.write_text("", encoding="utf-8")

        violations = find_violations(self.root)

        self.assertEqual(
            violations,
            [
                "packages/code-storage-go/client.go: expected one named "
                "compatibility route, found 0"
            ],
        )


if __name__ == "__main__":
    unittest.main()
