import json
import re
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def test_release_versions_match():
    plugin_yaml = (PLUGIN_ROOT / "plugin.yaml").read_text(encoding="utf-8")
    plugin_version = re.search(r"^version:\s*(\S+)\s*$", plugin_yaml, re.MULTILINE)
    manifest_version = json.loads(
        (PLUGIN_ROOT / "dashboard" / "manifest.json").read_text(encoding="utf-8")
    )["version"]
    changes = (PLUGIN_ROOT / "CHANGES.md").read_text(encoding="utf-8")
    changes_version = re.search(r"^##\s+(.+?)\s*$", changes, re.MULTILINE)

    assert plugin_version is not None
    assert changes_version is not None
    assert plugin_version.group(1) == manifest_version == changes_version.group(1)
