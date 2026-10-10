import importlib.util
import json
import shutil
import subprocess
import sys
import zipfile
from argparse import Namespace
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("rdh_release", Path(__file__).parents[1] / "scripts/release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def test_same_version_is_immutable(tmp_path):
    artifact = tmp_path / "artifact.zip"
    release.immutable_write(artifact, b"same")
    release.immutable_write(artifact, b"same")
    with pytest.raises(ValueError):
        release.immutable_write(artifact, b"changed")


@pytest.mark.parametrize("reference", ["./../secret", "./state/private.json", "/secret"])
def test_asset_paths_are_contained(tmp_path, reference):
    with pytest.raises(ValueError):
        release.contained_file(tmp_path, reference)


def test_profiles_have_distinct_contracts():
    source = Path(__file__).parents[1] / "plugins/remote-device-hub"
    standalone, files = release.plugin_files(source, "standalone")
    assert standalone["version"] == "1.2.0"
    assert ".app.json" not in files and "apps" not in standalone["extensions"]["com.openai"]
    assert json.loads(files["mcp.json"])["mcpServers"]["remote-device-hub"]["type"] == "streamable-http"
    connected, connected_files = release.plugin_files(source, "connected")
    assert connected["extensions"]["com.openai"]["apps"] == "./.app.json"
    assert ".app.json" in connected_files and "mcp.json" not in connected_files
    assert ".mcp.json" not in connected_files
    assert connected["extensions"]["com.openai"]["requires_local_executor"] is False
    assert json.loads(connected_files[".codex-plugin/plugin.json"])["requires_local_executor"] is False
    for name in release.SKILL_FILES:
        assert files[name] == connected_files[name]


def test_connected_and_public_skills_match():
    root = Path(__file__).parents[1]
    _, files = release.plugin_files(root / "plugins/remote-device-hub", "connected")
    for name in release.SKILL_FILES:
        assert files[name] == (root / "public/remote-device-hub" / name).read_bytes()


def test_extra_private_and_symlink_files_are_not_packaged(tmp_path):
    source = Path(__file__).parents[1] / "plugins/remote-device-hub"
    manifest, expected = release.plugin_files(source)
    target = tmp_path / manifest["name"]
    for name, data in expected.items():
        path = target / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
    (target / "owner-password.local.txt").write_text("secret")
    assert release.plugin_files(target)[1] == expected
    link = target / "assets" / "linked.png"; link.symlink_to(target / "owner-password.local.txt")
    with pytest.raises(ValueError, match="symlinks"):
        release.contained_file(target, "./assets/linked.png")


def test_build_is_deterministic_and_reads_archive(tmp_path, monkeypatch):
    source = Path(__file__).parents[1] / "plugins/remote-device-hub"
    shutil.copytree(source, tmp_path / "plugins/remote-device-hub")
    shutil.copytree(Path(__file__).parents[1] / "integrations", tmp_path / "integrations")
    (tmp_path / ".build").mkdir()
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(release, "PLUGIN", tmp_path / "plugins/remote-device-hub")
    first = release.build_plugin("standalone", "fixture")
    first_bytes = (tmp_path / "dist/remote-device-hub-plugin-standalone-1.2.0.zip").read_bytes()
    assert release._archive_contents(tmp_path / "dist/remote-device-hub-plugin-standalone-1.2.0.zip")["mcp.json"]
    assert release.build_plugin("standalone", "fixture") == first
    assert (tmp_path / "dist/remote-device-hub-plugin-standalone-1.2.0.zip").read_bytes() == first_bytes


def test_renderer_change_cannot_reuse_version(tmp_path, monkeypatch):
    source = Path(__file__).parents[1] / "plugins/remote-device-hub"
    shutil.copytree(source, tmp_path / "plugins/remote-device-hub")
    shutil.copytree(Path(__file__).parents[1] / "integrations", tmp_path / "integrations")
    (tmp_path / ".build").mkdir(); monkeypatch.setattr(release, "ROOT", tmp_path); monkeypatch.setattr(release, "PLUGIN", tmp_path / "plugins/remote-device-hub")
    release.build_plugin("standalone", "fixture")
    original = release.plugin_files
    def changed(source, profile="standalone"):
        manifest, files = original(source, profile); value = json.loads(files["plugin.json"]); value["description"] = "changed"; files["plugin.json"] = release.canonical_json(value); return manifest, files
    monkeypatch.setattr(release, "plugin_files", changed)
    with pytest.raises(ValueError, match="renderer changed"):
        release.build_plugin("standalone", "fixture")


def test_archive_rejects_duplicate_normalized_entries(tmp_path):
    archive = tmp_path / "duplicate.zip"
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr("remote-device-hub/plugin.json", b"one")
        output.writestr("remote-device-hub/plugin.json", b"two")
    with pytest.raises(ValueError, match="Duplicate"):
        release._archive_contents(archive)


def test_cli_check_uses_release_record_path():
    root = Path(__file__).parents[1]
    record = root / "releases" / "plugin-cli-test-1.2.0.json"
    artifact = root / "dist" / "remote-device-hub-plugin-standalone-1.2.0.zip"
    artifact_sha = artifact.with_suffix(artifact.suffix + ".sha256")
    existed = artifact.exists(), artifact_sha.exists()
    try:
        built = subprocess.run([sys.executable, "scripts/release.py", "build", "plugin", "--profile", "standalone", "--channel", "cli-test"],
                               cwd=root, capture_output=True, text=True)
        assert built.returncode == 0, built.stderr
        result = subprocess.run([sys.executable, "scripts/release.py", "check", str(record.relative_to(root))],
                                cwd=root, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert "Checksum OK" in result.stdout
    finally:
        record.unlink(missing_ok=True)
        if not existed[0]: artifact.unlink(missing_ok=True)
        if not existed[1]: artifact_sha.unlink(missing_ok=True)


def test_record_requires_checks_and_evidence(tmp_path, monkeypatch):
    monkeypatch.setattr(release, "ROOT", tmp_path)
    artifact = tmp_path / "dist/a.zip"; artifact.parent.mkdir(); artifact.write_bytes(b"artifact")
    record = release.save_prepared("1.2.0", artifact, {"plugin.json": b"source"}, "fixture", "standalone")
    evidence = tmp_path / "proof.txt"; evidence.write_text("proof")
    args = Namespace(record=str(record.relative_to(tmp_path)), stage="published", host="local", evidence=["proof.txt"], check=[], note="")
    release.record_result(args)
    args.stage = "verified"
    with pytest.raises(ValueError, match="Required checks"):
        release.record_result(args)
    args.check = [f"{key}=passed" for key in release.REQUIRED_CHECKS]
    release.record_result(args)
    assert json.loads(record.read_text())["stage"] == "verified"
