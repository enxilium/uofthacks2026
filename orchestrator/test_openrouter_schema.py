#!/usr/bin/env python3
"""
Test script for OpenRouter structured outputs.
Calls the model and validates the response against the schema.
"""

import argparse
import json
import os
from typing import Any, Dict, List, Tuple

import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-3-flash-preview")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

ANALYSIS_SCHEMA = {
    "name": "behavior_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "thinking": {"type": "string"},
            "reasoning": {"type": "string"},
            "anomalies": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": [
                                "rage_click",
                                "slow_interaction",
                                "abandonment",
                                "confusion",
                                "form_frustration",
                            ],
                        },
                        "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                        "description": {"type": "string"},
                        "affected_element": {"type": "string"},
                    },
                    "required": ["type", "severity", "description", "affected_element"],
                    "additionalProperties": False,
                },
            },
            "action_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "change_description": {"type": "string"},
                        "file_path": {"type": "string"},
                        "prompt": {"type": "string"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                        "expected_improvement": {"type": "string"},
                    },
                    "required": [
                        "change_description",
                        "file_path",
                        "prompt",
                        "priority",
                        "expected_improvement",
                    ],
                    "additionalProperties": False,
                },
            },
            "summary": {"type": "string"},
        },
        "required": ["thinking", "reasoning", "anomalies", "action_items", "summary"],
        "additionalProperties": False,
    },
}

EVALUATION_SCHEMA = {
    "name": "experiment_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "thinking": {"type": "string"},
            "reasoning": {"type": "string"},
            "verdict": {"type": "string", "enum": ["good_change", "useless_change"]},
            "metrics": {
                "type": "object",
                "properties": {
                    "before": {
                        "type": "object",
                        "properties": {
                            "rage_click_rate": {"type": "number"},
                            "completion_rate": {"type": "number"},
                        },
                        "required": ["rage_click_rate", "completion_rate"],
                        "additionalProperties": False,
                    },
                    "after": {
                        "type": "object",
                        "properties": {
                            "rage_click_rate": {"type": "number"},
                            "completion_rate": {"type": "number"},
                        },
                        "required": ["rage_click_rate", "completion_rate"],
                        "additionalProperties": False,
                    },
                },
                "required": ["before", "after"],
                "additionalProperties": False,
            },
            "improvement_summary": {"type": "string"},
        },
        "required": ["thinking", "reasoning", "verdict", "metrics", "improvement_summary"],
        "additionalProperties": False,
    },
}


def _type_ok(value: Any, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    return True


def validate_schema(value: Any, schema: Dict[str, Any], path: str = "$") -> List[str]:
    errors: List[str] = []
    expected_type = schema.get("type")
    if expected_type and not _type_ok(value, expected_type):
        errors.append(f"{path}: expected {expected_type}, got {type(value).__name__}")
        return errors

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value '{value}' not in enum {schema['enum']}")

    if expected_type == "object":
        props = schema.get("properties", {})
        required = schema.get("required", [])
        additional = schema.get("additionalProperties", True)

        for key in required:
            if key not in value:
                errors.append(f"{path}.{key}: missing required property")

        for key, val in value.items():
            if key in props:
                errors.extend(validate_schema(val, props[key], f"{path}.{key}"))
            elif additional is False:
                errors.append(f"{path}.{key}: additional property not allowed")

    if expected_type == "array":
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(value):
                errors.extend(validate_schema(item, item_schema, f"{path}[{i}]"))

    return errors


def build_prompt(schema_name: str) -> Tuple[str, str]:
    if schema_name == "analysis":
        system_prompt = "You are a test harness. Respond ONLY with valid JSON matching the schema."
        user_prompt = "Return a minimal, valid analysis response JSON that matches the schema."
        return system_prompt, user_prompt

    system_prompt = "You are a test harness. Respond ONLY with valid JSON matching the schema."
    user_prompt = "Return a minimal, valid evaluation response JSON that matches the schema."
    return system_prompt, user_prompt


def main() -> None:
    parser = argparse.ArgumentParser(description="Test OpenRouter structured outputs.")
    parser.add_argument("--schema", choices=["analysis", "evaluation"], default="analysis")
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args()

    if not OPENROUTER_API_KEY:
        raise SystemExit("OPENROUTER_API_KEY is not set")

    response_schema = ANALYSIS_SCHEMA if args.schema == "analysis" else EVALUATION_SCHEMA
    system_prompt, user_prompt = build_prompt(args.schema)

    payload = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 1024,
        "response_format": {
            "type": "json_schema",
            "json_schema": response_schema,
        },
        "provider": {"require_parameters": True},
    }

    with httpx.Client(timeout=args.timeout) as client:
        resp = client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Fluxor Schema Test",
            },
            json=payload,
        )

    if resp.status_code >= 400:
        raise SystemExit(f"OpenRouter error {resp.status_code}: {resp.text}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON returned: {exc}\nRaw: {content}")

    errors = validate_schema(parsed, response_schema["schema"])
    if errors:
        raise SystemExit("Schema validation failed:\n" + "\n".join(errors))

    print("✅ Schema validation passed")


if __name__ == "__main__":
    main()
