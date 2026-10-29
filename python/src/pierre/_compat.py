"""Typing names that `typing` has only in newer Python versions."""

import sys

if sys.version_info >= (3, 11):
    from typing import NotRequired as NotRequired
    from typing import ParamSpec as ParamSpec
    from typing import Self as Self
    from typing import TypedDict as TypedDict
else:
    from typing_extensions import NotRequired as NotRequired
    from typing_extensions import ParamSpec as ParamSpec
    from typing_extensions import Self as Self
    from typing_extensions import TypedDict as TypedDict
