"""
ml_engine
=========
DairyVision AI Machine Learning, Explainability & Digital Twin Analytics Engine.
"""

from __future__ import annotations

import sys
import os

_pkg_dir = os.path.dirname(os.path.abspath(__file__))
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

from . import config

__all__ = ["config"]
