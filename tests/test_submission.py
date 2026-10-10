import importlib.util
import json
import shutil
import zipfile
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("submission", Path(__file__).parents[1] / "scripts/prepare_submission.py")
submission = importlib.util.module_from_spec(spec)
spec.loader.exec_module(submission)


def files():
    return submission.source_files(submission.SOURCE)


@pytest.mark.parametrize("size", [9_999, 10_000, 10_001])
def test_icon_byte_limit(size):
    source = files()
    manifest = json.loads(source["plugin.json"])
    name = submission.local_path(manifest["extensions"]["com.openai"]["interface"]["logo"])
    source[name] += b"\0" * (size - len(source[name]))
    if size < 10_000:
        submission.validate(source)
    else:
        with pytest.raises(ValueError, match="below 10000 bytes"):
            submission.validate(source)


@pytest.mark.parametrize("field,value", [("apps", "./.app.json"), ("hooks", {}), ("clientSecret", "do-not-package")])
def test_rejects_private_bindings_and_secrets(field, value):
    source = files()
    manifest = json.loads(source["plugin.json"])
    manifest["extensions"]["com.openai"][field] = value
    source["plugin.json"] = json.dumps(manifest).encode()
    with pytest.raises(ValueError):
        submission.validate(source)


def test_rejects_mcp_credential_header():
    source = files()
    mcp = json.loads(source["mcp.json"])
    mcp["mcpServers"]["remote-device-hub"]["headers"] = {"Authorization": "Bearer fixture"}
    source["mcp.json"] = json.dumps(mcp).encode()
    with pytest.raises(ValueError, match="headers"):
        submission.validate(source)


def test_rejects_unreferenced_files_and_escaping_icon():
    source = files()
    source["owner-password.local.txt"] = b"not a secret"
    with pytest.raises(ValueError, match="Unexpected public files"):
        submission.validate(source)
    with pytest.raises(ValueError, match="escapes"):
        submission.local_path("./../private.png")


def test_incomplete_draft_never_claims_submission_ready(tmp_path):
    source = tmp_path / "remote-device-hub"
    shutil.copytree(submission.SOURCE, source)
    manifest = json.loads((source / "plugin.json").read_text())
    manifest["extensions"]["com.openai"]["review"].pop("demo_recording_url", None)
    (source / "plugin.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="Incomplete"):
        submission.build(source, tmp_path / "dist")
    archive, report = submission.build(source, tmp_path / "dist", allow_incomplete=True)
    assert archive.name.endswith("-draft.zip")
    assert report["submission_ready"] is False
    assert "verified_demo_recording_url" in report["missing_materials"]
    original = archive.read_bytes()
    submission.build(source, tmp_path / "dist", allow_incomplete=True)
    assert archive.read_bytes() == original
    with zipfile.ZipFile(archive) as z:
        assert "remote-device-hub/skills/remote-device-operations/SKILL.md" in z.namelist()
        assert not any(".app.json" in n for n in z.namelist())


def test_symlinks_never_read_into_public_bundle(tmp_path):
    source = tmp_path / "remote-device-hub"
    shutil.copytree(submission.SOURCE, source)
    (source / "leak.md").symlink_to(tmp_path / "private")
    with pytest.raises(ValueError, match="symlink"):
        submission.source_files(source)


def test_review_cases_require_observable_positive_results():
    source = files()
    manifest = json.loads(source["plugin.json"])
    manifest["extensions"]["com.openai"]["review"]["test_cases"]["positive"][0].pop("expected_behavior")
    source["plugin.json"] = json.dumps(manifest).encode()
    with pytest.raises(ValueError, match="Incomplete positive"):
        submission.validate(source)
