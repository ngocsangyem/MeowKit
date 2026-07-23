#!/usr/bin/env python3
"""Validate deterministic Figma Evidence Packet fixture contracts offline."""

from __future__ import annotations

import copy
import sys
from pathlib import Path, PurePosixPath

import yaml

ROOT = Path(__file__).resolve().parent / "fixtures"
BASE_KEYS = {
    "schema_version", "source", "scope", "intent_summary", "prototype_flow_summary",
    "implementation_hints", "validation_contract", "risks", "provenance", "artifact_policy",
}
PACKET_KEYS = {
    "source": {"figma_url", "file_key", "node_ids", "figma_version_or_last_modified", "extracted_at"},
    "scope": {"target_frames", "frame_sizes"},
    "intent_summary": {"hierarchy", "layout_constraints", "tokens", "assets", "variants_and_states"},
    "prototype_flow_summary": {
        "availability", "confidence", "flow_starting_points", "critical_actions_count",
        "blocked_or_needs_answer_count", "prototype_flow_artifacts",
    },
    "implementation_hints": {"component_candidates", "code_connect_refs"},
    "validation_contract": {"required_viewports", "required_states", "pixel_tolerance", "a11y_expectations"},
    "risks": {"ambiguity", "missing_states", "permission_limits"},
    "provenance": {"generated_by", "tool_surface", "artifact_paths"},
    "artifact_policy": {"active_plan_location", "standalone_location", "artifact_paths_only_in_context"},
}
TASK_PATH_PREFIXES = ("tasks/plans/<active-plan>/research/", "tasks/reports/")


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def exact_keys(value: dict, keys: set[str], label: str) -> None:
    missing, extra = keys - value.keys(), value.keys() - keys
    expect(not missing and not extra, f"{label}: missing={sorted(missing)} extra={sorted(extra)}")


def strings(value: object, label: str, nonempty: bool = False) -> None:
    expect(isinstance(value, list) and all(isinstance(item, str) for item in value), f"{label} must be a list of strings")
    expect(not nonempty or bool(value), f"{label} must not be empty")


def validate_paths(packet: dict) -> None:
    policy = packet["artifact_policy"]
    expect(policy["active_plan_location"] == TASK_PATH_PREFIXES[0], "invalid active-plan artifact path")
    expect(policy["standalone_location"] == TASK_PATH_PREFIXES[1], "invalid standalone artifact path")
    expect(policy["artifact_paths_only_in_context"] is True, "artifact paths must stay contextual")
    for path in packet["provenance"]["artifact_paths"]:
        validate_task_path(path)


def validate_task_path(path: object) -> None:
    expect(isinstance(path, str), "artifact path must be a string")
    candidate = PurePosixPath(path)
    expect(not candidate.is_absolute() and ".." not in candidate.parts, f"unsafe artifact path: {path}")
    expect(path.startswith(TASK_PATH_PREFIXES) and path not in TASK_PATH_PREFIXES, f"invalid artifact path: {path}")


def validate_flow(packet: dict) -> None:
    flow = packet["prototype_flow_summary"]
    expect(flow["availability"] in {"unavailable", "partial", "extracted", "user_supplied"}, "invalid flow availability")
    expect(flow["confidence"] in {"unknown", "low", "medium", "high"}, "invalid flow confidence")
    expect(isinstance(flow["critical_actions_count"], int) and flow["critical_actions_count"] >= 0, "invalid critical action count")
    expect(isinstance(flow["blocked_or_needs_answer_count"], int) and flow["blocked_or_needs_answer_count"] >= 0, "invalid blocked count")
    artifacts = flow["prototype_flow_artifacts"]
    if flow["availability"] in {"unavailable", "user_supplied"}:
        expect(artifacts is None, "unavailable flow must not carry artifacts")
        if flow["availability"] == "unavailable":
            expect(not flow["flow_starting_points"], "unavailable flow must have no starting points")
        return
    expect(isinstance(artifacts, dict), "available flow requires artifact metadata")
    expect({"report_md", "graph_json"} <= artifacts.keys(), "flow artifacts missing report or graph")
    for key in ("report_md", "graph_json"):
        validate_task_path(artifacts[key])


def validate_packet(packet: dict, fixture: str) -> None:
    exact_keys(packet, BASE_KEYS | ({"flow_ambiguity_ledger"} if fixture == "spec-conflict" else set()), fixture)
    expect(packet["schema_version"] == "figma-evidence-packet/v1", "unsupported packet schema")
    for section, keys in PACKET_KEYS.items():
        expect(isinstance(packet[section], dict), f"{section} must be a mapping")
        exact_keys(packet[section], keys, section)
    source = packet["source"]
    expect(all(isinstance(source[key], str) for key in {"figma_url", "file_key", "figma_version_or_last_modified", "extracted_at"}), "invalid source metadata")
    expect(source["figma_url"].startswith("https://www.figma.com/"), "invalid Figma URL")
    strings(source["node_ids"], "node IDs", nonempty=True)
    scope = packet["scope"]
    strings(scope["target_frames"], "target frames", nonempty=True)
    expect(isinstance(scope["frame_sizes"], list) and scope["frame_sizes"], "frame sizes required")
    for frame in scope["frame_sizes"]:
        expect(isinstance(frame, dict) and isinstance(frame.get("node_id"), str), "invalid frame size node")
        expect(isinstance(frame.get("width"), int) and isinstance(frame.get("height"), int), "invalid frame size dimensions")
    intent = packet["intent_summary"]
    strings(intent["hierarchy"], "hierarchy", nonempty=True)
    strings(intent["layout_constraints"], "layout constraints", nonempty=True)
    expect(isinstance(intent["assets"], list), "assets must be a list")
    for asset in intent["assets"]:
        expect(isinstance(asset, dict), "asset must be a mapping")
        exact_keys(asset, {"name", "node_id", "export_path_or_status"}, "asset")
        expect(all(isinstance(value, str) for value in asset.values()), "invalid asset metadata")
    expect(all(isinstance(intent[key], str) for key in {"tokens", "variants_and_states"}), "invalid intent metadata")
    hints, risks = packet["implementation_hints"], packet["risks"]
    strings(hints["component_candidates"], "component candidates", nonempty=True)
    strings(hints["code_connect_refs"], "code connect references")
    strings(risks["ambiguity"], "ambiguity")
    strings(risks["missing_states"], "missing states")
    strings(risks["permission_limits"], "permission limits")
    contract = packet["validation_contract"]
    strings(contract["required_viewports"], "viewport matrix", nonempty=True)
    strings(contract["required_states"], "state matrix", nonempty=True)
    expect(isinstance(contract["pixel_tolerance"], str) and isinstance(contract["a11y_expectations"], str), "invalid validation contract")
    validate_paths(packet)
    validate_flow(packet)
    validate_fixture_case(packet, fixture)


def validate_fixture_case(packet: dict, fixture: str) -> None:
    flow, contract = packet["prototype_flow_summary"], packet["validation_contract"]
    if fixture == "static-card":
        expect(flow["availability"] == "unavailable" and contract["required_states"] == ["default"], "static-card contract drift")
    elif fixture == "responsive-grid":
        expect(contract["required_viewports"] == ["desktop", "tablet", "mobile"], "responsive grid viewport matrix drift")
    elif fixture == "interaction-modal":
        expect(flow["availability"] == "partial" and flow["critical_actions_count"] == 1 and flow["blocked_or_needs_answer_count"] == 1, "interaction flow contract drift")
    elif fixture == "spec-conflict":
        ledger = packet["flow_ambiguity_ledger"]
        expect(flow["availability"] == "extracted" and flow["blocked_or_needs_answer_count"] == 1, "spec-conflict flow drift")
        ledger_keys = {"id", "source", "action", "ambiguity", "risk_level", "evidence_sources", "inferred_flow", "decision_needed", "phase_impact", "status"}
        expect(isinstance(ledger, list) and len(ledger) == 1 and isinstance(ledger[0], dict), "spec-conflict ledger shape drift")
        exact_keys(ledger[0], ledger_keys, "spec-conflict ledger")
        expect(all(isinstance(ledger[0][key], str) for key in ledger_keys - {"evidence_sources", "inferred_flow"}), "spec-conflict ledger text drift")
        strings(ledger[0]["evidence_sources"], "spec-conflict evidence sources", nonempty=True)
        expect(ledger[0]["inferred_flow"] is None or isinstance(ledger[0]["inferred_flow"], str), "spec-conflict inferred flow drift")
        expect(ledger[0]["risk_level"] in {"low", "medium", "high"} and ledger[0]["status"] == "needs-answer", "spec-conflict ledger status drift")
    else:
        raise ValueError(f"unknown fixture: {fixture}")


def validate_negative_cases(packet: dict) -> None:
    valid_asset = copy.deepcopy(packet)
    valid_asset["intent_summary"]["assets"] = [{"name": "avatar", "node_id": "10:3", "export_path_or_status": "exported"}]
    validate_packet(valid_asset, "static-card")
    user_supplied = copy.deepcopy(packet)
    user_supplied["prototype_flow_summary"]["availability"] = "user_supplied"
    validate_flow(user_supplied)
    missing_source = copy.deepcopy(packet)
    del missing_source["source"]
    try:
        validate_packet(missing_source, "static-card")
    except ValueError:
        pass
    else:
        raise ValueError("negative test: missing source was accepted")
    unavailable_with_artifact = copy.deepcopy(packet)
    unavailable_with_artifact["prototype_flow_summary"]["availability"] = "unavailable"
    unavailable_with_artifact["prototype_flow_summary"]["prototype_flow_artifacts"] = {"report_md": "tasks/reports/x.md", "graph_json": "tasks/reports/x.json"}
    try:
        validate_packet(unavailable_with_artifact, "static-card")
    except ValueError:
        pass
    else:
        raise ValueError("negative test: unavailable flow artifacts were accepted")
    invalid_node_ids = copy.deepcopy(packet)
    invalid_node_ids["source"]["node_ids"] = "10:2"
    try:
        validate_packet(invalid_node_ids, "static-card")
    except ValueError:
        pass
    else:
        raise ValueError("negative test: invalid node IDs were accepted")
    invalid_asset = copy.deepcopy(packet)
    invalid_asset["intent_summary"]["assets"] = [{"name": "avatar"}]
    try:
        validate_packet(invalid_asset, "static-card")
    except ValueError:
        pass
    else:
        raise ValueError("negative test: invalid asset was accepted")
    traversal = copy.deepcopy(packet)
    traversal["provenance"]["artifact_paths"] = ["tasks/reports/../../.env"]
    try:
        validate_packet(traversal, "static-card")
    except ValueError:
        pass
    else:
        raise ValueError("negative test: traversal artifact path was accepted")


def main() -> int:
    packets = {}
    for packet_path in sorted(ROOT.glob("*/expected-packet.yaml")):
        with packet_path.open(encoding="utf-8") as handle:
            packet = yaml.safe_load(handle)
        validate_packet(packet, packet_path.parent.name)
        packets[packet_path.parent.name] = packet
        print(f"PASS {packet_path.parent.name}")
    expect(len(packets) == 4, "expected four evidence packet fixtures")
    validate_negative_cases(packets["static-card"])
    print("PASS negative structural cases")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, yaml.YAMLError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        raise SystemExit(1)
