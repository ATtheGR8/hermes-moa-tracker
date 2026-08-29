import importlib.util
import sys
import types
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def _load_handler_module():
    spec = importlib.util.spec_from_file_location(
        "moa_tracker_handler_under_test", PLUGIN_ROOT / "__init__.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(PLUGIN_ROOT))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.pop(0)
    return module


def test_handler_returns_none_when_metrics_returns_a_dict(monkeypatch, tmp_path):
    module = _load_handler_module()
    monkeypatch.setitem(
        sys.modules,
        "hermes_constants",
        types.SimpleNamespace(get_hermes_home=lambda: tmp_path),
    )
    metrics_calls = []

    def apply_metrics(*args, **kwargs):
        metrics_calls.append((args, kwargs))
        return {"persisted": True}

    monkeypatch.setattr(module, "apply_metrics", apply_metrics)

    assert module.handler(
        session_id="session-1",
        turn_id="turn-1",
        provider="moa",
        model="model-1",
        moa_references=[],
        api_request_id="request-1",
    ) is None
    assert metrics_calls == [
        (
            (tmp_path, "session-1", "turn-1", "moa", "model-1", []),
            {"api_request_id": "request-1"},
        )
    ]
