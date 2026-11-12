"""SQLite Database Persistence Layer for ScenariGo Scenarios & Master Data."""

import json
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.data.presets import (
    get_air_freight_preset,
    get_bobs_stationery_preset,
    get_deficit_preset,
    get_tri_port_preset,
)
from app.models.responses import ScenarioSummary, SimulationRequest


def get_db_path() -> str:
    """Returns the absolute or configured path to the SQLite database file."""
    env_path = os.getenv("SCENARIGO_DB_PATH")
    if env_path:
        return env_path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    return str(backend_dir / "scenarigo.db")


def get_connection() -> sqlite3.Connection:
    """Creates a new SQLite connection with foreign keys and dict-like row factory."""
    db_path = get_db_path()
    # Support in-memory databases for tests (e.g. ":memory:")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Initializes schema and seeds baseline presets if not present."""
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scenarios (
                    scenario_id TEXT PRIMARY KEY,
                    scenario_name TEXT NOT NULL,
                    is_preset INTEGER NOT NULL DEFAULT 0,
                    is_modified INTEGER NOT NULL DEFAULT 0,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    current_json TEXT NOT NULL,
                    baseline_json TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )

            # Check if presets need to be seeded
            cursor = conn.execute("SELECT scenario_id FROM scenarios WHERE is_preset = 1")
            existing_presets = {row["scenario_id"] for row in cursor.fetchall()}

            presets_to_seed = [
                ("bob-stationery", get_bobs_stationery_preset(), True),
                ("deficit-sample", get_deficit_preset(), False),
                ("air-freight", get_air_freight_preset(), False),
                ("tri-port", get_tri_port_preset(), False),
            ]

            now_iso = datetime.now(UTC).isoformat()

            # If no active scenario exists at all, make the first one active
            active_count = conn.execute(
                "SELECT COUNT(*) as c FROM scenarios WHERE is_active = 1"
            ).fetchone()["c"]

            for pid, preset_obj, default_active in presets_to_seed:
                if pid not in existing_presets:
                    preset_obj.scenario_id = pid
                    preset_obj.is_preset = True
                    preset_obj.is_modified = False
                    raw_json = json.dumps(preset_obj.model_dump())
                    is_active = 1 if (active_count == 0 and default_active) else 0

                    conn.execute(
                        """
                        INSERT INTO scenarios (
                            scenario_id, scenario_name, is_preset, is_modified, is_active,
                            current_json, baseline_json, updated_at
                        ) VALUES (?, ?, 1, 0, ?, ?, ?, ?)
                        """,
                        (pid, preset_obj.scenario_name, is_active, raw_json, raw_json, now_iso),
                    )
                    if is_active:
                        active_count += 1
    finally:
        conn.close()


def list_scenarios() -> list[ScenarioSummary]:
    """Returns summary cards of all saved scenarios."""
    init_db()
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT scenario_id, scenario_name, is_preset, is_modified, is_active, current_json, updated_at
            FROM scenarios
            ORDER BY is_active DESC, is_preset DESC, updated_at DESC
            """
        )
        summaries: list[ScenarioSummary] = []
        for row in cursor.fetchall():
            try:
                data = json.loads(row["current_json"])
                wh_count = len(data.get("warehouses", []))
                st_count = len(data.get("stores", []))
                budget = float(data.get("budget_cap_myr") or 7000.0)
            except Exception:
                wh_count, st_count, budget = 0, 0, 7000.0

            summaries.append(
                ScenarioSummary(
                    scenario_id=row["scenario_id"],
                    scenario_name=row["scenario_name"],
                    is_preset=bool(row["is_preset"]),
                    is_modified=bool(row["is_modified"]),
                    is_active=bool(row["is_active"]),
                    updated_at=row["updated_at"],
                    warehouse_count=wh_count,
                    store_count=st_count,
                    budget_cap_myr=budget,
                )
            )
        return summaries
    finally:
        conn.close()


def get_scenario(scenario_id: str) -> SimulationRequest | None:
    """Fetches a scenario by ID."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT current_json, is_preset, is_modified FROM scenarios WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
        if not row:
            return None
        data = json.loads(row["current_json"])
        obj = SimulationRequest.model_validate(data)
        obj.scenario_id = scenario_id
        obj.is_preset = bool(row["is_preset"])
        obj.is_modified = bool(row["is_modified"])
        return obj
    finally:
        conn.close()


def get_active_scenario() -> SimulationRequest:
    """Returns the currently active scenario (or falls back to Bob's Stationery)."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT scenario_id, current_json, is_preset, is_modified FROM scenarios WHERE is_active = 1 LIMIT 1"
        ).fetchone()
        if row:
            data = json.loads(row["current_json"])
            obj = SimulationRequest.model_validate(data)
            obj.scenario_id = row["scenario_id"]
            obj.is_preset = bool(row["is_preset"])
            obj.is_modified = bool(row["is_modified"])
            return obj
        # Fallback to Bob's preset
        return get_bobs_stationery_preset()
    finally:
        conn.close()


def create_scenario(scenario: SimulationRequest) -> SimulationRequest:
    """Creates a new custom scenario and marks it active."""
    init_db()
    conn = get_connection()
    try:
        scen_id = scenario.scenario_id or f"custom-{int(datetime.now(UTC).timestamp())}"
        scenario.scenario_id = scen_id
        scenario.is_preset = False
        scenario.is_modified = False

        raw_json = json.dumps(scenario.model_dump())
        now_iso = datetime.now(UTC).isoformat()

        with conn:
            # Set all other scenarios inactive
            conn.execute("UPDATE scenarios SET is_active = 0")
            conn.execute(
                """
                INSERT INTO scenarios (
                    scenario_id, scenario_name, is_preset, is_modified, is_active,
                    current_json, baseline_json, updated_at
                ) VALUES (?, ?, 0, 0, 1, ?, ?, ?)
                """,
                (scen_id, scenario.scenario_name, raw_json, raw_json, now_iso),
            )
        return scenario
    finally:
        conn.close()


def update_scenario(scenario_id: str, updated: SimulationRequest) -> SimulationRequest:
    """Updates an existing scenario's attributes and marks modified if it is a preset."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT is_preset, baseline_json FROM scenarios WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()

        is_preset = bool(row["is_preset"]) if row else False
        is_mod = is_preset  # If a preset is updated, flag as modified

        updated.scenario_id = scenario_id
        updated.is_preset = is_preset
        updated.is_modified = is_mod

        raw_json = json.dumps(updated.model_dump())
        now_iso = datetime.now(UTC).isoformat()

        with conn:
            conn.execute(
                """
                UPDATE scenarios
                SET scenario_name = ?,
                    is_modified = ?,
                    current_json = ?,
                    updated_at = ?
                WHERE scenario_id = ?
                """,
                (updated.scenario_name, 1 if is_mod else 0, raw_json, now_iso, scenario_id),
            )
        return updated
    finally:
        conn.close()


def activate_scenario(scenario_id: str) -> SimulationRequest:
    """Activates a specific scenario and deactivates all others."""
    init_db()
    conn = get_connection()
    try:
        with conn:
            conn.execute("UPDATE scenarios SET is_active = 0")
            conn.execute("UPDATE scenarios SET is_active = 1 WHERE scenario_id = ?", (scenario_id,))
        scen = get_scenario(scenario_id)
        if not scen:
            raise ValueError(f"Scenario '{scenario_id}' not found.")
        return scen
    finally:
        conn.close()


def reset_preset_scenario(scenario_id: str) -> SimulationRequest:
    """Restores a factory preset back to its immutable baseline_json snapshot."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT baseline_json, is_preset FROM scenarios WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
        if not row:
            raise ValueError(f"Scenario '{scenario_id}' not found.")
        if not row["is_preset"]:
            raise ValueError(f"Scenario '{scenario_id}' is not a preset; cannot reset.")

        baseline = row["baseline_json"]
        now_iso = datetime.now(UTC).isoformat()
        with conn:
            conn.execute(
                """
                UPDATE scenarios
                SET current_json = baseline_json,
                    is_modified = 0,
                    updated_at = ?
                WHERE scenario_id = ?
                """,
                (now_iso, scenario_id),
            )
        data = json.loads(baseline)
        obj = SimulationRequest.model_validate(data)
        obj.scenario_id = scenario_id
        obj.is_preset = True
        obj.is_modified = False
        return obj
    finally:
        conn.close()


def delete_scenario(scenario_id: str) -> bool:
    """Deletes a custom scenario. Built-in presets are protected from deletion."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT is_preset, is_active FROM scenarios WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
        if not row:
            return False
        if row["is_preset"]:
            raise ValueError("Factory presets cannot be deleted.")

        was_active = bool(row["is_active"])

        with conn:
            conn.execute("DELETE FROM scenarios WHERE scenario_id = ?", (scenario_id,))
            if was_active:
                # Fall back to activating Bob's stationery
                conn.execute(
                    "UPDATE scenarios SET is_active = 1 WHERE scenario_id = 'bob-stationery'"
                )
        return True
    finally:
        conn.close()
