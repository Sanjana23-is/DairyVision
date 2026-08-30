"""Utilities for locating project-root resources.

The ML configuration (`config.py`) and trained model artifacts live at the
project root, one level above `backend/`. That's outside the `app` package,
so a plain `from config import ...` only resolves if the project root
happens to already be on `sys.path` -- which depends entirely on the
working directory the process was launched from (e.g. it may work when
pytest is invoked from the project root, but fail when the server is
started from `backend/`).

`ensure_project_root_on_path()` makes this resolution independent of the
working directory by anchoring the lookup to this file's own location on
disk, not to `cwd`. It does not copy or duplicate `config.py` -- it only
makes the existing root-level module importable.
"""

from __future__ import annotations

import sys
from pathlib import Path


def _project_root() -> Path:
    # backend/app/core/project_paths.py -> backend/app/core -> backend/app -> backend -> <project root>
    return Path(__file__).resolve().parents[3]


def ensure_project_root_on_path() -> None:
    """Add the project root to sys.path if it isn't already there."""
    root_str = str(_project_root())
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
