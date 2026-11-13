#!/usr/bin/env python3
"""Preview and safely apply the init-ghp-labels preset with GitHub CLI."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


PRESET = (
    ("area: ai", "Artificial intelligence, machine learning, or AI integrations.", "D8B0E1"),
    ("area: api", "APIs, data exchange, or external service integrations.", "D8B0E1"),
    ("area: ci-cd", "Continuous integration, delivery, deployment, or automation.", "D8B0E1"),
    ("area: cms", "Content management, content modeling, or editorial workflows.", "D8B0E1"),
    ("area: database", "Data storage, schemas, queries, or migrations.", "D8B0E1"),
    ("area: frontend", "User interfaces, client-side behavior, or presentation.", "D8B0E1"),
    ("area: testing", "Automated tests, test tooling, or quality assurance.", "D8B0E1"),
    ("workflow: blocked", "Blocked by an unresolved dependency or external constraint.", "D93F0B"),
    (
        "workflow: deploy-preview",
        "Enables opt-in Vercel preview deployments for the pull request.",
        "D93F0B",
    ),
    ("workflow: needs-info", "Waiting for required information or clarification.", "D93F0B"),
    ("outcome: duplicate", "The same work is tracked in another linked issue.", "6E7781"),
    ("outcome: cannot-reproduce", "The reported behavior could not be reproduced.", "6E7781"),
)

MAX_LABELS = 10_000


@dataclass(frozen=True)
class Label:
    name: str
    description: str
    color: str

    @classmethod
    def from_json(cls, value: dict[str, Any]) -> "Label":
        return cls(
            name=str(value["name"]),
            description=str(value.get("description") or ""),
            color=normalize_color(str(value["color"])),
        )

    def as_dict(self) -> dict[str, str]:
        return {"name": self.name, "description": self.description, "color": self.color}


@dataclass(frozen=True)
class Repository:
    canonical: str
    name_with_owner: str
    url: str


def normalize_color(color: str) -> str:
    return color.removeprefix("#").upper()


def run_gh(*arguments: str) -> str:
    try:
        result = subprocess.run(
            ["gh", *arguments],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError:
        raise RuntimeError("GitHub CLI (`gh`) is not installed or is not on PATH.") from None
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or error.stdout.strip() or "unknown GitHub CLI error"
        raise RuntimeError(detail) from None
    return result.stdout


def resolve_repository(requested: str | None) -> Repository:
    arguments = ["repo", "view"]
    if requested:
        arguments.append(requested)
    arguments.extend(["--json", "nameWithOwner,url"])
    value = json.loads(run_gh(*arguments))
    name_with_owner = str(value["nameWithOwner"])
    url = str(value["url"])
    host = urlparse(url).hostname or "github.com"
    canonical = name_with_owner if host.lower() == "github.com" else f"{host}/{name_with_owner}"
    return Repository(canonical=canonical, name_with_owner=name_with_owner, url=url)


def list_labels(repository: Repository) -> list[Label]:
    raw = run_gh(
        "label",
        "list",
        "--repo",
        repository.canonical,
        "--limit",
        str(MAX_LABELS),
        "--json",
        "name,description,color",
    )
    values = json.loads(raw)
    if len(values) >= MAX_LABELS:
        raise RuntimeError(
            f"The repository has at least {MAX_LABELS} labels; aborting to avoid a truncated plan."
        )
    return sorted((Label.from_json(value) for value in values), key=lambda label: label.name.lower())


def preset_labels() -> list[Label]:
    return [Label(name, description, color) for name, description, color in PRESET]


def build_plan(existing: list[Label], mode: str) -> dict[str, list[Any]]:
    existing_by_name = {label.name.casefold(): label for label in existing}
    preset = preset_labels()
    preset_by_name = {label.name.casefold(): label for label in preset}

    create = [label for label in preset if label.name.casefold() not in existing_by_name]
    update = [
        {"before": existing_by_name[label.name.casefold()], "after": label}
        for label in preset
        if label.name.casefold() in existing_by_name
        and existing_by_name[label.name.casefold()] != label
    ]
    unchanged = [
        label
        for label in preset
        if label.name.casefold() in existing_by_name
        and existing_by_name[label.name.casefold()] == label
    ]
    delete = (
        [label for label in existing if label.name.casefold() not in preset_by_name]
        if mode == "replace"
        else []
    )
    kept = (
        [label for label in existing if label.name.casefold() not in preset_by_name]
        if mode == "add"
        else []
    )
    return {
        "create": create,
        "update": update,
        "delete": delete,
        "unchanged": unchanged,
        "kept": kept,
    }


def serializable_plan(
    repository: Repository,
    mode: str,
    existing: list[Label],
    plan: dict[str, list[Any]],
) -> dict[str, Any]:
    return {
        "repository": repository.canonical,
        "repository_url": repository.url,
        "mode": mode,
        "existing": [label.as_dict() for label in existing],
        "create": [label.as_dict() for label in plan["create"]],
        "update": [
            {"before": item["before"].as_dict(), "after": item["after"].as_dict()}
            for item in plan["update"]
        ],
        "delete": [label.as_dict() for label in plan["delete"]],
        "unchanged": [label.as_dict() for label in plan["unchanged"]],
        "kept": [label.as_dict() for label in plan["kept"]],
    }


def plan_id(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def display_text(label: Label) -> str:
    description = label.description or "(no description)"
    return f"- `{label.name}` — {description} — `#{label.color}`"


def print_plan(
    repository: Repository,
    mode: str,
    existing: list[Label],
    plan: dict[str, list[Any]],
    identifier: str,
) -> None:
    print(f"Repository: {repository.canonical}")
    print(f"Repository URL: {repository.url}")
    print(f"Integration mode: {mode}")
    print(f"Plan ID: {identifier}")
    print()
    print(f"Existing labels ({len(existing)}):")
    if existing:
        for label in existing:
            print(display_text(label))
    else:
        print("- None")

    print()
    preset = preset_labels()
    print(f"Preset labels to install ({len(preset)}):")
    for label in preset:
        print(display_text(label))

    print()
    print("Final changes:")
    sections = (
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("unchanged", "Unchanged"),
    )
    for key, title in sections:
        items = plan[key]
        print(f"{title} ({len(items)}):")
        if not items:
            print("- None")
        elif key == "update":
            for item in items:
                before = item["before"]
                after = item["after"]
                print(f"- `{after.name}`")
                print(f"  - Before: {before.description or '(no description)'} — `#{before.color}`")
                print(f"  - After: {after.description} — `#{after.color}`")
        else:
            for label in items:
                print(display_text(label))
    if mode == "add":
        print(f"Other existing labels kept ({len(plan['kept'])}).")


def apply_plan(repository: Repository, plan: dict[str, list[Any]]) -> None:
    for label in plan["create"]:
        create_label(repository, label)
    for item in plan["update"]:
        update_label(repository, item["before"], item["after"])
    for label in plan["delete"]:
        run_gh("label", "delete", label.name, "--repo", repository.canonical, "--yes")


def create_label(repository: Repository, label: Label) -> None:
    run_gh(
        "label",
        "create",
        label.name,
        "--repo",
        repository.canonical,
        "--description",
        label.description,
        "--color",
        label.color,
    )


def update_label(repository: Repository, before: Label, after: Label) -> None:
    run_gh(
        "label",
        "edit",
        before.name,
        "--repo",
        repository.canonical,
        "--name",
        after.name,
        "--description",
        after.description,
        "--color",
        after.color,
    )


def verify(repository: Repository, mode: str) -> None:
    actual = list_labels(repository)
    actual_by_name = {label.name: label for label in actual}
    expected = preset_labels()
    mismatches = [label.name for label in expected if actual_by_name.get(label.name) != label]
    extras = [label.name for label in actual if label.name not in {item.name for item in expected}]
    if mismatches or (mode == "replace" and extras):
        detail = []
        if mismatches:
            detail.append("incorrect preset labels: " + ", ".join(mismatches))
        if mode == "replace" and extras:
            detail.append("unexpected remaining labels: " + ", ".join(extras))
        raise RuntimeError("Verification failed: " + "; ".join(detail))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        help="Target repository as [HOST/]OWNER/REPO; defaults to the current repository",
    )
    parser.add_argument("--mode", choices=("add", "replace"), required=True)
    parser.add_argument("--apply", action="store_true", help="Apply the currently calculated plan")
    parser.add_argument("--confirm-repository", help="Required with --apply; must exactly match the resolved repository")
    parser.add_argument("--approve", help="Required with --apply; must exactly match the previewed plan ID")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        repository = resolve_repository(args.repo)
        existing = list_labels(repository)
        plan = build_plan(existing, args.mode)
        payload = serializable_plan(repository, args.mode, existing, plan)
        identifier = plan_id(payload)
        print_plan(repository, args.mode, existing, plan, identifier)

        if not args.apply:
            print()
            print("Preview only. No labels were changed.")
            return 0

        if args.confirm_repository != repository.canonical:
            raise RuntimeError(
                "Repository confirmation does not match. "
                f"Expected `--confirm-repository {repository.canonical}`."
            )
        if args.approve != identifier:
            raise RuntimeError(
                "Plan approval does not match the current repository state. "
                f"Review and approve the new plan ID `{identifier}`."
            )

        apply_plan(repository, plan)
        verify(repository, args.mode)
        print()
        print(
            "Applied and verified: "
            f"created {len(plan['create'])}, updated {len(plan['update'])}, "
            f"deleted {len(plan['delete'])}, unchanged {len(plan['unchanged'])}."
        )
        return 0
    except (RuntimeError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
