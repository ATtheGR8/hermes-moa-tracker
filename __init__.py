"""Inert MoA metrics hook registration; all hook failures are ignored."""

from __future__ import annotations

try:
    from .store import apply_metrics
except ImportError:  # Supports plugin loaders which import this file directly.
    from store import apply_metrics


def _payload(args, kwargs):
    """Merge a conventional hook event mapping with explicit keyword values."""
    data = {}
    for value in args:
        if isinstance(value, dict):
            data.update(value)
    data.update(kwargs)
    return data


def handler(*args, **kwargs):
    """Persist only sanitized MoA advisor metrics and never affect requests."""
    try:
        from hermes_constants import get_hermes_home

        event = _payload(args, kwargs)
        apply_metrics(
            get_hermes_home(),
            event.get("session_id"),
            event.get("turn_id"),
            event.get("provider"),
            event.get("model"),
            event.get("moa_references"),
            api_request_id=event.get("api_request_id"),
        )
        return None
    except Exception:
        return None


def register(ctx):
    """Register the fail-open post-request hook without changing runtime config."""
    try:
        ctx.register_hook("post_api_request", handler)
    except Exception:
        return None
    return None
