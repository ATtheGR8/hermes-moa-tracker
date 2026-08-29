import json
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT))

from store import _text, apply_metrics, history, snapshot  # noqa: E402


def _ref(label="advisor-a", model="model-a", output=7, **extra):
    value = {
        "label": label,
        "model": model,
        "usage": {
            "input_tokens": 11,
            "output_tokens": output,
            "cache_read_tokens": 2,
            "cache_write_tokens": 3,
            "reasoning_tokens": 5,
        },
        "cost_usd": 0.12,
        "cost_status": "estimated",
        "cost_source": "provider",
        "temperature": 0.4,
        "output": "secret advisor output",
        "input_messages": [{"role": "user", "content": "secret prompt"}],
    }
    value.update(extra)
    return value


def _lines(home):
    path = home / "moa-tracker" / "runs.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def test_empty_snapshot(tmp_path):
    assert snapshot(tmp_path, "s1") == {"session_id": "s1", "runs": []}


def test_apply_sanitizes_and_drops_output(tmp_path):
    result = apply_metrics(tmp_path, "s1", "t1", "MoA", "top-model", [_ref()])
    assert result is not None
    run = snapshot(tmp_path, "s1")["runs"][0]
    assert run["provider"] == "moa"
    assert run["model"] == "top-model"
    assert set(run["references"][0]) == {
        "label", "model", "provider", "usage", "cost_usd", "cost_status",
        "cost_source", "temperature"
    }
    assert run["references"][0]["usage"] == {
        "input_tokens": 11, "output_tokens": 7, "cache_read_tokens": 2,
        "cache_write_tokens": 3, "reasoning_tokens": 5,
    }
    serialized = json.dumps(run)
    assert '"output":' not in serialized
    assert "input_messages" not in serialized


def test_non_moa_ignored(tmp_path):
    assert apply_metrics(tmp_path, "s1", "t1", "openai", "m", [_ref()]) is None
    assert _lines(tmp_path) == []


@pytest.mark.parametrize("refs", [None, [], "", {}])
def test_missing_or_empty_refs_ignored(tmp_path, refs):
    assert apply_metrics(tmp_path, "s1", "t1", "moa", "m", refs) is None
    assert _lines(tmp_path) == []


def test_identical_metrics_same_turn_not_double_counted(tmp_path):
    args = (tmp_path, "s1", "t1", "moa", "m", [_ref()])
    assert apply_metrics(*args) is not None
    assert apply_metrics(*args) is None
    assert len(_lines(tmp_path)) == 1


def test_different_metrics_same_turn_is_second_run(tmp_path):
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref(output=7)])
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref(output=8)])
    assert len(_lines(tmp_path)) == 2


def test_snapshot_coalesces_distinct_same_turn_rows(tmp_path):
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref(output=7)], api_request_id="request-1")
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref(output=8)], api_request_id="request-2")

    assert len(_lines(tmp_path)) == 2
    runs = snapshot(tmp_path, "s1")["runs"]
    assert len(runs) == 1
    assert runs[0]["fanouts"] == 2
    assert runs[0]["references"][0]["usage"]["input_tokens"] == 22
    assert runs[0]["references"][0]["usage"]["output_tokens"] == 15


def test_snapshot_dedups_identical_same_turn_fingerprints(tmp_path):
    args = (tmp_path, "s1", "t1", "moa", "m", [_ref()])
    apply_metrics(*args, api_request_id="request-1")
    apply_metrics(*args, api_request_id="request-2")

    assert len(_lines(tmp_path)) == 2
    runs = snapshot(tmp_path, "s1")["runs"]
    assert len(runs) == 1
    assert runs[0]["fanouts"] == 1
    assert runs[0]["references"][0]["usage"]["input_tokens"] == 11
    assert runs[0]["references"][0]["usage"]["output_tokens"] == 7


def test_empty_turn_id_rows_are_not_coalesced(tmp_path):
    path = tmp_path / "moa-tracker" / "runs.jsonl"
    path.parent.mkdir()
    path.write_text("".join([
        json.dumps({"session_id": "s1", "turn_id": "", "provider": "moa", "model": "m", "references": [_ref(output=7)]}) + "\n",
        json.dumps({"session_id": "s1", "turn_id": "", "provider": "moa", "model": "m", "references": [_ref(output=8)]}) + "\n",
    ]), encoding="utf-8")

    runs = snapshot(tmp_path, "s1")["runs"]
    assert len(runs) == 2
    assert [run["fanouts"] for run in runs] == [1, 1]


def test_same_metrics_different_request_id_is_second_run(tmp_path):
    args = (tmp_path, "s1", "t1", "moa", "m", [_ref()])
    apply_metrics(*args, api_request_id="request-1")
    apply_metrics(*args, api_request_id="request-2")
    assert len(_lines(tmp_path)) == 2


def test_new_turn_id_is_new_run(tmp_path):
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref()])
    apply_metrics(tmp_path, "s1", "t2", "moa", "m", [_ref()])
    assert len(_lines(tmp_path)) == 2


def test_failed_ref_is_kept_with_zero_usage_and_no_output(tmp_path):
    failed = _ref(label="failed", model="m-failed", output=99, error="timeout", output_text="hidden")
    failed["usage"] = None
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [failed])
    ref = snapshot(tmp_path, "s1")["runs"][0]["references"][0]
    assert ref["label"] == "failed"
    assert ref["usage"] == {
        "input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0,
        "cache_write_tokens": 0, "reasoning_tokens": 0,
    }
    assert "output" not in ref
    assert "output_text" not in ref


def test_history_newest_first_and_file_capped_at_50(tmp_path):
    for n in range(55):
        apply_metrics(tmp_path, "s1", f"t{n}", "moa", "m", [_ref(output=n)])
    assert len(_lines(tmp_path)) == 50
    runs = history(tmp_path, limit=100)
    assert len(runs) == 50
    assert runs[0]["turn_id"] == "t54"
    assert runs[-1]["turn_id"] == "t5"


def test_history_caps_after_coalesce_not_raw_rows(tmp_path):
    for n in range(12):
        apply_metrics(tmp_path, "s1", f"t{n}", "moa", "m", [_ref(output=n)], api_request_id=f"request-{n}-a")
        apply_metrics(tmp_path, "s1", f"t{n}", "moa", "m", [_ref(output=n + 100)], api_request_id=f"request-{n}-b")

    assert len(_lines(tmp_path)) == 24
    runs = history(tmp_path, limit=10)
    assert len(runs) == 10
    assert [run["turn_id"] for run in runs] == [f"t{n}" for n in range(11, 1, -1)]
    assert all(run["fanouts"] == 2 for run in runs)


def test_text_is_truncated_to_256_characters():
    assert _text("x" * 300) == "x" * 256


def test_references_per_run_are_capped_at_32(tmp_path):
    result = apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref(label=f"advisor-{n}") for n in range(40)])
    assert result is not None
    assert len(_lines(tmp_path)[0]["references"]) == 32


def test_symlinked_runs_file_is_not_written(tmp_path):
    path = tmp_path / "moa-tracker" / "runs.jsonl"
    path.parent.mkdir()
    target = tmp_path / "target.jsonl"
    target.write_text('{"sentinel":true}\n', encoding="utf-8")
    path.symlink_to(target)

    assert apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref()]) is None
    assert target.read_text(encoding="utf-8") == '{"sentinel":true}\n'


def test_runs_file_and_parent_are_private(tmp_path):
    assert apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref()]) is not None
    path = tmp_path / "moa-tracker" / "runs.jsonl"
    assert path.parent.stat().st_mode & 0o777 == 0o700
    assert path.stat().st_mode & 0o777 == 0o600


def test_snapshot_and_history_do_not_expose_disk_identity(tmp_path):
    assert apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref()]) is not None
    assert "_identity" not in json.dumps(snapshot(tmp_path, "s1"))
    assert "_identity" not in json.dumps(history(tmp_path))


def test_writes_stay_inside_isolated_home(tmp_path):
    apply_metrics(tmp_path, "s1", "t1", "moa", "m", [_ref()])
    assert (tmp_path / "moa-tracker" / "runs.jsonl").exists()
    assert not (Path.home() / ".hermes" / "moa-tracker" / "runs.jsonl").exists()


@pytest.mark.parametrize("args", [
    (None, "t1", "moa", "m", [_ref()]),
    ("s1", "t1", "moa", "m", [object()]),
    ("s1", "t1", "moa", "m", object()),
])
def test_hook_swallows_garbage(tmp_path, args):
    assert apply_metrics(tmp_path, *args) is None
