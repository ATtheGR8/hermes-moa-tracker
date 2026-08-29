"""Read-only dashboard API for sanitized MoA advisor metrics."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter

try:
    from ..store import history as load_history
    from ..store import snapshot as load_snapshot
except ImportError:  # Dashboard modules can be loaded as standalone files.
    _PLUGIN_ROOT = Path(__file__).resolve().parents[1]
    if str(_PLUGIN_ROOT) not in sys.path:
        sys.path.insert(0, str(_PLUGIN_ROOT))
    from store import history as load_history
    from store import snapshot as load_snapshot

router = APIRouter()


def _home():
    from hermes_constants import get_hermes_home

    return get_hermes_home()


@router.get("/current")
def current(session_id: str = ""):
    """Return a single session's sanitized advisor metrics; never advisor text."""
    try:
        return load_snapshot(_home(), session_id)
    except Exception:
        return {"session_id": session_id, "runs": []}


@router.get("/history")
def history(limit: int = 10):
    """Return newest-first sanitized advisor metrics; this router never listens."""
    try:
        return load_history(_home(), limit)
    except Exception:
        return []
