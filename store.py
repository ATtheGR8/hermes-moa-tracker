"""Fail-open, sanitized persistence for MoA agent metrics."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

_MAX_RUNS = 50
_MAX_REFS = 32
_MAX_TEXT = 256
_USAGE_KEYS = (
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "reasoning_tokens",
)
_REF_KEYS = (
    "label",
    "model",
    "provider",
    "usage",
    "cost_usd",
    "cost_status",
    "cost_source",
    "temperature",
)


def _path(home: Any) -> Path:
    """Return the sole persistence location for a supplied Hermes home."""
    return Path(home) / "moa-tracker" / "runs.jsonl"


def _number(value: Any, default: float = 0) -> float | int:
    """Accept finite scalar metrics only, defaulting invalid values to zero."""
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        if value < 0 or value != value or value in (float("inf"), float("-inf")):
            return default
        return value
    return default


def _usage(value: Any, failed: bool = False) -> Dict[str, float | int]:
    if failed or not isinstance(value, dict):
        return {key: 0 for key in _USAGE_KEYS}
    return {key: _number(value.get(key, 0)) for key in _USAGE_KEYS}


def _text(value: Any, default: str = "") -> str:
    return value[:_MAX_TEXT] if isinstance(value, str) else default[:_MAX_TEXT]


def _failed(reference: Dict[str, Any]) -> bool:
    """Treat explicit failure markers and absent usage as failed agent slots."""
    status = _text(reference.get("status")).lower()
    return bool(reference.get("failed") or reference.get("error") or status in {"failed", "error"} or reference.get("usage") is None)


def _sanitize_reference(reference: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(reference, dict):
        return None
    failed = _failed(reference)
    # Deliberately construct the allow-list; agent output and prompts never enter disk.
    return {
        "label": _text(reference.get("label"), "agent"),
        "model": _text(reference.get("model")),
        "provider": _text(reference.get("provider"), "moa"),
        "usage": _usage(reference.get("usage"), failed),
        "cost_usd": _number(reference.get("cost_usd", 0)),
        "cost_status": _text(reference.get("cost_status")),
        "cost_source": _text(reference.get("cost_source")),
        "temperature": _number(reference.get("temperature", 0)),
    }


def _sanitize_references(references: Any) -> List[Dict[str, Any]]:
    if not isinstance(references, (list, tuple)):
        return []
    return [clean for item in references[:_MAX_REFS] if (clean := _sanitize_reference(item)) is not None]


def _read_runs(home: Any) -> List[Dict[str, Any]]:
    try:
        path = _path(home)
        if not path.exists():
            return []
        runs: List[Dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                decoded = json.loads(line)
                if isinstance(decoded, dict):
                    runs.append(decoded)
            except (TypeError, ValueError):
                continue
        return runs[-_MAX_RUNS:]
    except Exception:
        return []


def _identity(session_id: str, turn_id: str, references: List[Dict[str, Any]], api_request_id: Any) -> str:
    if isinstance(api_request_id, str) and api_request_id:
        payload: Any = ("request", api_request_id)
    else:
        fingerprint = [(ref["label"], ref["model"], ref["usage"]["output_tokens"]) for ref in references]
        payload = ("fingerprint", session_id, turn_id, fingerprint)
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def _public_run(run: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(run, dict):
        return None
    session_id = run.get("session_id")
    turn_id = run.get("turn_id")
    if not isinstance(session_id, str) or not isinstance(turn_id, str):
        return None
    references = _sanitize_references(run.get("references"))
    if not references:
        return None
    # This is a second allow-list for reads, including any old/corrupt JSONL entries.
    return {
        "session_id": session_id,
        "turn_id": turn_id,
        "provider": "moa",
        "model": _text(run.get("model")),
        "references": references,
    }


def _merge_coalesced_references(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    positions: Dict[tuple[str, str], int] = {}
    for row in rows:
        for reference in row["references"]:
            key = (reference["label"], reference["model"])
            if key not in positions:
                positions[key] = len(merged)
                merged.append({**reference, "usage": dict(reference["usage"])})
                continue
            target = merged[positions[key]]
            target["usage"] = {
                usage_key: target["usage"][usage_key] + reference["usage"][usage_key]
                for usage_key in _USAGE_KEYS
            }
            target["cost_usd"] += reference["cost_usd"]
    return merged


def _fingerprint(run: Dict[str, Any]) -> str:
    references = [(reference["label"], reference["model"], reference["usage"]) for reference in run["references"]]
    return json.dumps(references, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _coalesce(runs: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Coalesce public non-empty turns, preserving their last-seen order."""
    indexed_runs = list(enumerate(runs))
    groups: Dict[tuple[str, str], List[tuple[int, Dict[str, Any]]]] = {}
    singles: List[tuple[int, Dict[str, Any]]] = []
    for index, run in indexed_runs:
        turn_id = run["turn_id"]
        if not turn_id:
            singles.append((index, {**run, "fanouts": 1}))
            continue
        groups.setdefault((run["session_id"], turn_id), []).append((index, run))

    coalesced = singles[:]
    for rows in groups.values():
        unique: List[Dict[str, Any]] = []
        fingerprints = set()
        for _, row in rows:
            fingerprint = _fingerprint(row)
            if fingerprint not in fingerprints:
                fingerprints.add(fingerprint)
                unique.append(row)
        last_seen, _ = rows[-1]
        last_unique = unique[-1]
        coalesced.append((
            last_seen,
            {
                **last_unique,
                "references": _merge_coalesced_references(unique),
                "fanouts": len(unique),
            },
        ))
    return [run for _, run in sorted(coalesced, key=lambda item: item[0])]


def _write_runs(home: Any, runs: Iterable[Dict[str, Any]]) -> None:
    path = _path(home)
    if path.is_symlink():
        raise OSError("refusing to write symlinked runs file")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.parent.chmod(0o700)
    kept = list(runs)[-_MAX_RUNS:]
    payload = "".join(json.dumps(run, separators=(",", ":"), ensure_ascii=True) + "\n" for run in kept)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".runs.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
        if path.is_symlink():
            raise OSError("refusing to replace symlinked runs file")
        os.replace(temporary_name, path)
        path.chmod(0o600)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def apply_metrics(
    home: Any,
    session_id: Any,
    turn_id: Any,
    provider: Any,
    model: Any,
    moa_references: Any,
    api_request_id: Any = None,
) -> Optional[Dict[str, Any]]:
    """Persist one sanitized MoA run, returning it, or None for no-op/failure.

    This hook boundary is deliberately fail-open: malformed hook payloads and I/O
    failures never propagate into an API request.
    """
    try:
        if not isinstance(session_id, str) or not session_id or not isinstance(turn_id, str) or not turn_id:
            return None
        if not isinstance(provider, str) or provider.lower() != "moa":
            return None
        references = _sanitize_references(moa_references)
        if not references:
            return None

        identity = _identity(session_id, turn_id, references, api_request_id)
        runs = _read_runs(home)
        if any(run.get("_identity") == identity for run in runs if isinstance(run, dict)):
            return None

        stored = {
            "session_id": session_id,
            "turn_id": turn_id,
            "provider": "moa",
            "model": _text(model),
            "references": references,
            "_identity": identity,
        }
        runs.append(stored)
        _write_runs(home, runs)
        return _public_run(stored)
    except Exception:
        return None


def snapshot(home: Any, session_id: Any) -> Dict[str, Any]:
    """Return sanitized runs for a session in their stored (oldest-first) order."""
    safe_session = session_id if isinstance(session_id, str) else ""
    try:
        runs = _coalesce([public for run in _read_runs(home) if run.get("session_id") == safe_session if (public := _public_run(run))])
        return {"session_id": safe_session, "runs": runs}
    except Exception:
        return {"session_id": safe_session, "runs": []}


def history(home: Any, limit: Any = 10) -> List[Dict[str, Any]]:
    """Return sanitized persisted runs newest-first, never exceeding the cap."""
    try:
        requested = int(limit)
        if requested < 0:
            requested = 0
        requested = min(requested, _MAX_RUNS)
        public = _coalesce([item for run in _read_runs(home) if (item := _public_run(run))])
        return list(reversed(public))[:requested]
    except Exception:
        return []
