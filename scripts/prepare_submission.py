#!/usr/bin/env python3
"""Build the separate public upload source; never upload or change private releases."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "remote-device-hub"
URL_FIELDS = ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL")


def https_url(value):
    if not isinstance(value, str) or len(value) > 1024:
        raise ValueError("Expected an HTTPS URL of at most 1024 characters")
    p = urlsplit(value)
    if p.scheme != "https" or not p.hostname or p.username or p.password:
        raise ValueError("Expected a credential-free HTTPS URL")


def local_path(reference):
    if not isinstance(reference, str) or not reference.startswith("./"):
        raise ValueError("Asset references must begin with ./")
    path = Path(reference[2:])
    if not path.parts or path.is_absolute() or ".." in path.parts or "\\" in reference:
        raise ValueError("Asset reference escapes the plugin")
    return path.as_posix()


def check_forbidden(value):
    if isinstance(value, dict):
        for key, entry in value.items():
            if key in {"apps", "hooks"} and entry is not None:
                raise ValueError(f"Public uploads must not contain {key}")
            if key in {"clientSecret", "test_credentials", "reviewer_instructions"}:
                raise ValueError(f"Private submission field in ZIP: {key}")
            if key == "headers" and entry:
                raise ValueError("Public MCP configuration must not embed headers")
            check_forbidden(entry)
    elif isinstance(value, list):
        for entry in value:
            check_forbidden(entry)


def validate(files):
    """Check actual archive bytes. Missing factual materials remain explicit gaps."""
    for name in files:
        path = Path(name)
        if path.is_absolute() or ".." in path.parts or "\\" in name:
            raise ValueError("Unsafe archive path")
        if name == ".app.json" or any(p.startswith(".env") for p in path.parts):
            raise ValueError("Private file in public upload")
    manifest = json.loads(files["plugin.json"])
    mcp = json.loads(files["mcp.json"])
    check_forbidden(manifest)
    check_forbidden(mcp)
    if manifest.get("name") != "remote-device-hub":
        raise ValueError("Preserve the existing plugin name")
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest.get("version", "")):
        raise ValueError("Expected semantic version")
    ext = manifest["extensions"]["com.openai"]
    ui = ext["interface"]
    gaps = []
    for key, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000)):
        value = ui.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise ValueError(f"Invalid listing field: {key}")
        if key != "longDescription" and ("\n" in value or "\r" in value):
            raise ValueError(f"Listing field must be one line: {key}")
    publisher = ui.get("developerName")
    if not publisher or publisher == "App developer":
        gaps.append("verified_publisher_name")
    elif not isinstance(publisher, str) or len(publisher) > 80 or "\n" in publisher:
        raise ValueError("Invalid developerName")
    for key in URL_FIELDS:
        if not ui.get(key):
            gaps.append(key)
        else:
            https_url(ui[key])
    allowed = {"plugin.json", "mcp.json"}
    for key in ("logo", "composerIcon", "logoDark", "composerIconDark"):
        if key not in ui:
            if key in {"logo", "composerIcon"}:
                raise ValueError(f"Missing {key}")
            continue
        name = local_path(ui[key])
        allowed.add(name)
        data = files[name]
        if len(data) < 24 or len(data) > 5 * 1024 * 1024 or data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"Invalid PNG: {name}")
        width, height = struct.unpack(">II", data[16:24])
        minimum = 256 if key.startswith("logo") else 48
        if width != height or not minimum <= width <= 4096:
            raise ValueError(f"Invalid icon size: {name}")
    for name, data in files.items():
        if name.startswith("skills/"):
            if not name.endswith(".md"):
                raise ValueError(f"Unexpected skill asset: {name}")
            allowed.add(name)
            if name.endswith("/SKILL.md"):
                skill = Path(name).parent.name
                text = data.decode("utf-8")
                if not text.startswith("---\n") or f"\nname: {skill}\n" not in text or "\ndescription: " not in text:
                    raise ValueError(f"Invalid skill frontmatter: {name}")
    if set(files) != allowed:
        raise ValueError(f"Unexpected public files: {sorted(set(files) - allowed)}")
    servers = mcp.get("mcpServers", {})
    if list(servers) != ["remote-device-hub"]:
        raise ValueError("Expected the existing single Hub MCP server")
    server = servers["remote-device-hub"]
    https_url(server.get("url"))
    if server.get("type") != "streamable-http":
        raise ValueError("Expected remote Streamable HTTP transport")
    auth = server.get("extensions", {}).get("com.openai", {}).get("auth", {})
    if auth.get("type") != "oauth" or auth.get("client", {}).get("mode") != "dcr":
        raise ValueError("Preserve the Hub OAuth DCR configuration")
    if auth.get("baseScopes") != ["devices:control"]:
        raise ValueError("Use the Hub's supported authorization scope")
    review = ext.get("review", {})
    for kind, count in (("positive", 5), ("negative", 3)):
        cases = review.get("test_cases", {}).get(kind, [])
        if len(cases) != count:
            raise ValueError(f"Expected exactly {count} {kind} review cases")
        fields = ["description", "prompt"]
        if kind == "positive":
            fields += ["tools_triggered", "expected_behavior"]
        for case in cases:
            if any(not isinstance(case.get(k), str) or not case[k].strip() for k in fields):
                raise ValueError(f"Incomplete {kind} review case")
    if not review.get("demo_recording_url"):
        gaps.append("verified_demo_recording_url")
    else:
        https_url(review["demo_recording_url"])
    if "commerce" not in review:
        gaps.append("confirmed_commerce_declaration")
    elif not isinstance(review["commerce"], bool) or not review.get("commerce_description"):
        raise ValueError("Invalid commerce declaration")
    publication = ext.get("publication", {})
    if publication.get("countries") != []:
        raise ValueError("User selected all platform-permitted countries")
    if not publication.get("release_notes"):
        raise ValueError("Missing release notes")
    return manifest, gaps


def source_files(source):
    if source.is_symlink():
        raise ValueError("Source must not be a symlink")
    result = {}
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Source contains symlink: {path.name}")
        if path.is_file():
            result[path.relative_to(source).as_posix()] = path.read_bytes()
    return result


def build(source, destination, *, allow_incomplete=False):
    files = source_files(source)
    manifest, gaps = validate(files)
    if gaps and not allow_incomplete:
        raise ValueError("Incomplete submission materials: " + ", ".join(gaps))
    destination.mkdir(parents=True, exist_ok=True)
    suffix = "-draft" if gaps else ""
    archive = destination / f"remote-device-hub-public-{manifest['version']}{suffix}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo("remote-device-hub/" + name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None or len(z.namelist()) != len(set(z.namelist())):
            raise ValueError("Archive CRC or duplicate-entry check failed")
        actual = {n.removeprefix("remote-device-hub/"): z.read(n) for n in z.namelist()}
    validate(actual)
    if actual != files:
        raise ValueError("Archive content does not match source")
    sha = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{sha}  {archive.name}\n")
    report = {
        "archive": archive.name, "version": manifest["version"], "sha256": sha,
        "format_checks": "passed", "package_metadata_complete": not gaps,
        "missing_materials": gaps, "submission_ready": False,
        "note": "Local checks do not verify publication identity, policy content, demo playback, reviewer access, host behavior, deployment, or Portal scans.",
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())},
    }
    archive.with_suffix(".report.json").write_text(json.dumps(report, indent=2) + "\n")
    return archive, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-incomplete", action="store_true", help="Produce an explicitly marked draft with missing materials listed")
    args = parser.parse_args()
    try:
        archive, report = build(SOURCE, ROOT / "dist", allow_incomplete=args.allow_incomplete)
    except (ValueError, KeyError) as exc:
        parser.exit(1, str(exc) + "\n")
    print(json.dumps({"archive": str(archive), **report}, indent=2))


if __name__ == "__main__":
    main()
