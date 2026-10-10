#!/usr/bin/env python3
"""Build and record standalone or connected Remote Device Hub plugins."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "remote-device-hub"
REQUIRED_CHECKS = {"archive-readback", "detail-icon", "composer-icon", "reload-persistence", "account-reuse"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SKILL_FILES = (
    "skills/remote-device-operations/SKILL.md",
    "skills/remote-device-operations/references/files.md",
    "skills/remote-device-operations/references/processes.md",
    "skills/remote-device-operations/references/recovery.md",
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def canonical_json(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def fingerprint(files: dict[str, bytes]) -> str:
    return digest(canonical_json({name: digest(data) for name, data in sorted(files.items())}))


def immutable_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.is_symlink() or path.read_bytes() != data:
            raise ValueError(f"Refusing to replace {path.name}; increase the plugin version")
        return
    with path.open("xb") as stream:
        stream.write(data)


def private_path(name: str) -> bool:
    return any(part in {".venv", ".build", "state", "workspace", "node_modules", "__pycache__"}
               or ".local." in part or part.startswith(".env") for part in Path(name).parts)


def contained_file(base: Path, reference: str) -> tuple[str, bytes]:
    if not isinstance(reference, str) or not reference.startswith("./"):
        raise ValueError("Component paths must begin with ./")
    relative = Path(reference[2:])
    if not relative.parts or relative.is_absolute() or ".." in relative.parts or private_path(str(relative)):
        raise ValueError("Unsafe or private component path")
    current = base
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise ValueError("Referenced assets may not be symlinks")
    if not current.is_file():
        raise ValueError(f"Missing component: {reference}")
    return relative.as_posix(), current.read_bytes()


def validate_mcp(data: dict) -> None:
    servers = data.get("mcpServers")
    if not isinstance(servers, dict) or not servers:
        raise ValueError("Standalone plugin requires named MCP servers")
    for server in servers.values():
        if not isinstance(server, dict):
            raise ValueError("MCP server entry must be an object")
        parsed = urlsplit(server.get("url", ""))
        if (server.get("type") != "streamable-http" or parsed.scheme != "https" or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment):
            raise ValueError("Use credential-free HTTPS Streamable HTTP MCP URLs")


def validate_png(key: str, data: bytes) -> None:
    if len(data) > 5 * 1024 * 1024 or len(data) < 24 or data[:8] != PNG_SIGNATURE:
        raise ValueError(f"Invalid PNG icon: {key}")
    width, height = struct.unpack(">II", data[16:24])
    if width != height or not 48 <= width <= 4096:
        raise ValueError(f"Invalid icon dimensions: {key}")


def _manifest(source: Path) -> tuple[dict, dict | None]:
    if source.is_symlink():
        raise ValueError("Plugin source may not be a symlink")
    manifest = json.loads((source / "plugin.json").read_text())
    name, version = manifest.get("name"), manifest.get("version")
    if source.name != name or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", str(name)):
        raise ValueError("Plugin directory and manifest name must match")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(version)):
        raise ValueError("Use a numeric semantic version")
    interface = manifest["extensions"]["com.openai"]["interface"]
    if len(interface["shortDescription"]) > 30:
        raise ValueError("Plugin shortDescription exceeds 30 characters")
    if "apps" in manifest["extensions"]["com.openai"] or (source / ".app.json").exists():
        raise ValueError("Canonical plugin source must not depend on a registered App identity")
    overlay_path = source / ".codex-plugin" / "plugin.json"
    overlay = json.loads(overlay_path.read_text()) if overlay_path.is_file() else None
    if overlay is not None and (overlay.get("name"), overlay.get("version"), overlay.get("interface")) != (name, version, interface):
        raise ValueError("Root and compatibility manifests differ")
    if overlay is not None and "apps" in overlay:
        raise ValueError("Canonical compatibility manifest must not bind an App identity")
    if any(key in manifest["extensions"]["com.openai"] for key in ("hooks", "skills", "onboardingSkill")):
        raise ValueError("Only the explicit plugin allowlist is supported")
    return manifest, overlay


def plugin_files(source: Path = PLUGIN, profile: str = "standalone") -> tuple[dict, dict[str, bytes]]:
    """Render only the plugin files; never include unrelated source files."""
    manifest, overlay = _manifest(source)
    interface = manifest["extensions"]["com.openai"]["interface"]
    files: dict[str, bytes] = {}
    if (source / "skills").exists():
        for name in SKILL_FILES:
            relative, data = contained_file(source, "./" + name)
            data.decode("utf-8")
            files[relative] = data
        skill = files[SKILL_FILES[0]].decode("utf-8")
        if not skill.startswith("---\nname: remote-device-operations\ndescription: "):
            raise ValueError("Invalid operations skill frontmatter")
    for key in ("composerIcon", "composerIconDark", "logo", "logoDark"):
        if key in interface:
            relative, data = contained_file(source, interface[key])
            validate_png(key, data)
            files[relative] = data
    if profile == "standalone":
        relative, data = contained_file(source, "./mcp.json")
        validate_mcp(json.loads(data))
        files[relative] = data
    elif profile == "connected":
        app_path = ROOT / "integrations" / "chatgpt" / "connected-app.json"
        relative, data = contained_file(ROOT, "./integrations/chatgpt/connected-app.json")
        app = json.loads(data)
        if not isinstance(app.get("apps"), dict) or not app["apps"] or any(
            not isinstance(item, dict) or not re.fullmatch(r"(?:asdk_app_|connector_|templated_apps_).+", item.get("id", ""))
            for item in app["apps"].values()):
            raise ValueError("Connected profile requires verified existing App IDs")
        files[".app.json"] = data
        manifest["extensions"]["com.openai"]["apps"] = "./.app.json"
        manifest["extensions"]["com.openai"]["requires_local_executor"] = False
        if overlay is not None:
            overlay = dict(overlay)
            overlay["apps"] = "./.app.json"
            overlay["requires_local_executor"] = False
    else:
        raise ValueError("Unknown plugin profile")
    files["plugin.json"] = canonical_json(manifest)
    if overlay is not None:
        files[".codex-plugin/plugin.json"] = canonical_json(overlay)
    return manifest, files


def render_icons(source: Path = PLUGIN) -> dict[str, bytes]:
    """Validate and return the manifest-referenced icon set without generating assets."""
    _, files = plugin_files(source, "standalone")
    return {name: data for name, data in files.items() if name.startswith("assets/")}


def _git_value(*args: str) -> str | None:
    try:
        result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False)
        return result.stdout.strip() if result.returncode == 0 else None
    except OSError:
        return None


def source_state(files: dict[str, bytes]) -> dict:
    head = _git_value("rev-parse", "HEAD")
    status = _git_value("status", "--porcelain", "--", *sorted(files)) if head else None
    return {"git_commit": head, "git_tree": _git_value("rev-parse", "HEAD^{tree}"),
            "working_tree": "unversioned" if head is None else ("clean" if not status else "dirty"),
            "sha256": fingerprint(files), "files": {name: digest(data) for name, data in sorted(files.items())}}


def build_environment() -> dict:
    import platform
    return {"python": platform.python_version(), "builder": "scripts/release.py",
            "builder_sha256": digest(Path(__file__).read_bytes())}


def record_path(version: str, channel: str) -> Path:
    if not re.fullmatch(r"[a-z][a-z0-9-]*", channel):
        raise ValueError("Channel must be a lowercase identifier")
    return ROOT / "releases" / f"plugin-{channel}-{version}.json"


def save_prepared(version: str, artifact: Path, source_files: dict[str, bytes], channel: str, profile: str) -> Path:
    path = record_path(version, channel)
    artifact_sha = digest(artifact.read_bytes())
    source_sha = fingerprint(source_files)
    immutable_write(artifact.with_suffix(artifact.suffix + ".sha256"), f"{artifact_sha}  {artifact.name}\n".encode())
    if path.exists():
        existing = json.loads(path.read_text())
        if (existing["artifact"]["sha256"], existing["source"]["sha256"], existing["build"].get("profile")) != (artifact_sha, source_sha, profile):
            raise ValueError("Release record differs; increase the plugin version")
        return path
    record = {"schema_version": 2, "component": "plugin", "channel": channel, "version": version,
              "created_at": now(), "stage": "prepared", "source": source_state(source_files),
              "build": {**build_environment(), "profile": profile},
              "artifact": {"path": artifact.relative_to(ROOT).as_posix(), "sha256": artifact_sha, "bytes": artifact.stat().st_size},
              "identities": {}, "checks": {}, "events": [{"stage": "prepared", "at": now()}]}
    immutable_write(path, canonical_json(record))
    return path


def _archive_contents(artifact: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(artifact) as archive:
        if archive.testzip() is not None:
            raise ValueError("Plugin archive checksum/readback failed")
        result = {}
        for info in archive.infolist():
            if info.is_dir() or not info.filename.startswith("remote-device-hub/") or ".." in Path(info.filename).parts:
                raise ValueError("Unexpected plugin archive entry")
            normalized = info.filename.removeprefix("remote-device-hub/")
            if normalized in result:
                raise ValueError("Duplicate plugin archive entry")
            result[normalized] = archive.read(info)
        return result


def build_plugin(profile: str = "standalone", channel: str | None = None) -> Path:
    manifest, files = plugin_files(PLUGIN, profile)
    inputs = {f"plugins/remote-device-hub/{name}": data for name, data in files.items() if name != ".app.json"}
    if profile == "connected":
        inputs["integrations/chatgpt/connected-app.json"] = files[".app.json"]
    channel = channel or profile
    record = record_path(manifest["version"], channel)
    if record.exists():
        _, existing = load_record(str(record.relative_to(ROOT)))
        if existing.get("component") != "plugin" or existing.get("build", {}).get("profile") != profile:
            raise ValueError("Use a distinct channel for each plugin profile")
        if existing.get("source", {}).get("sha256") != fingerprint(inputs):
            raise ValueError("Plugin renderer changed the recorded artifact; increase the plugin version")
        expected = {name: data for name, data in files.items()}
        actual = _archive_contents(ROOT / existing["artifact"]["path"])
        if actual != expected:
            raise ValueError("Plugin renderer changed the recorded artifact; increase the plugin version")
        return record
    with tempfile.TemporaryDirectory(dir=ROOT / ".build") as temp:
        candidate = Path(temp) / "plugin.zip"
        with zipfile.ZipFile(candidate, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(f"remote-device-hub/{name}", date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
        artifact = ROOT / "dist" / f"remote-device-hub-plugin-{profile}-{manifest['version']}.zip"
        immutable_write(artifact, candidate.read_bytes())
    return save_prepared(manifest["version"], artifact, inputs, channel, profile)


def load_record(reference: str) -> tuple[Path, dict]:
    raw_path = ROOT / reference
    releases = (ROOT / "releases").resolve()
    if raw_path.is_symlink():
        raise ValueError("Record must be directly under releases/")
    path = raw_path.resolve()
    if path.parent != releases:
        raise ValueError("Record must be directly under releases/")
    record = json.loads(path.read_text())
    artifact = ROOT / record["artifact"]["path"]
    if artifact.parent.resolve() != (ROOT / "dist").resolve() or artifact.is_symlink():
        raise ValueError("Artifact must be directly under dist/")
    if digest(artifact.read_bytes()) != record["artifact"]["sha256"]:
        raise ValueError("Artifact checksum no longer matches its release")
    return path, record


def record_result(args) -> None:
    path, record = load_record(args.record)
    transitions = {"prepared": {"prepared", "uploaded", "published"}, "uploaded": {"uploaded", "published", "verified"},
                   "published": {"published", "verified"}, "failed": {"uploaded", "published"}, "verified": {"verified"}}
    if args.stage != "failed" and args.stage not in transitions.get(record["stage"], set()):
        raise ValueError("Unsupported or backwards release transition")
    if not args.host or not args.evidence:
        raise ValueError("Specify the actual host and attach evidence")
    checks = dict(record["checks"])
    for item in args.check:
        key, value = item.split("=", 1)
        if value not in {"passed", "failed", "unverified"}:
            raise ValueError("Check result must be passed, failed, or unverified")
        checks[key] = value
    if args.stage == "verified" and any(checks.get(key) != "passed" for key in REQUIRED_CHECKS):
        raise ValueError("Required checks have not all passed")
    evidence = []
    for reference in args.evidence:
        raw_entry = ROOT / reference
        if raw_entry.is_symlink():
            raise ValueError("Evidence must be an existing file within this project")
        entry = raw_entry.resolve()
        if not entry.is_file() or not entry.is_relative_to(ROOT):
            raise ValueError("Evidence must be an existing file within this project")
        evidence.append({"path": entry.relative_to(ROOT).as_posix(), "sha256": digest(entry.read_bytes())})
    record["stage"], record["checks"] = args.stage, checks
    record["events"].append({"stage": args.stage, "at": now(), "host": args.host, "checks": checks, "evidence": evidence, "note": args.note})
    temporary = path.with_suffix(".tmp")
    with temporary.open("xb") as stream:
        stream.write(canonical_json(record))
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build"); build.add_argument("component", choices=("plugin",)); build.add_argument("--profile", choices=("standalone", "connected"), default="standalone"); build.add_argument("--channel")
    check = sub.add_parser("check"); check.add_argument("record")
    result = sub.add_parser("record"); result.add_argument("record"); result.add_argument("--stage", choices=("prepared", "uploaded", "published", "verified", "failed"), required=True); result.add_argument("--host", required=True); result.add_argument("--evidence", action="append", default=[]); result.add_argument("--check", action="append", default=[]); result.add_argument("--note", default="")
    args = parser.parse_args()
    (ROOT / ".build").mkdir(exist_ok=True); (ROOT / "dist").mkdir(exist_ok=True)
    try:
        if args.command == "build": print(f"Prepared: {build_plugin(args.profile, args.channel).relative_to(ROOT)}")
        elif args.command == "check":
            _, record = load_record(args.record); print(f"Checksum OK; stage={record['stage']}; artifact={record['artifact']['path']}")
        else: record_result(args)
    except (ValueError, KeyError, OSError) as exc:
        parser.exit(1, f"Release rejected: {exc}\n")


if __name__ == "__main__":
    main()
