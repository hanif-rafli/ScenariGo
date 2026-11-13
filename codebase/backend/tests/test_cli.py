"""Unit and integration tests for the ScenariGo Command-Line Interface (app.cli)."""

import json
from pathlib import Path

import pytest

from app.cli import main


def test_cli_simulate_baseline_feasible_exits_0(capsys: pytest.CaptureFixture[str]) -> None:
    """Verifies that running 'simulate --scenario bob-stationery' succeeds with exit code 0."""
    exit_code = main(["simulate", "--scenario", "bob-stationery"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "[VERIFIED: FEASIBLE]" in captured.out
    assert "A4 Copy Paper Ream Box" in captured.out
    assert "Kuala Lumpur Hub" in captured.out
    assert "[VERIFIED: WITHIN BUDGET]" in captured.out


def test_cli_simulate_deficit_exits_1(capsys: pytest.CaptureFixture[str]) -> None:
    """Verifies that running 'simulate --scenario deficit-sample' exits with 1 and prints deficit tokens."""
    exit_code = main(["simulate", "--scenario", "deficit-sample"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "[FAIL: INFEASIBLE]" in captured.out
    assert "[FAIL: INVENTORY DEFICIT]" in captured.out
    assert "Laser Toner Cartridge Crate" in captured.out


def test_cli_simulate_overbudget_override_exits_1(capsys: pytest.CaptureFixture[str]) -> None:
    """Verifies that overriding '--budget 500' triggers a Stage 4 budget failure and exits with 1."""
    exit_code = main(["simulate", "--scenario", "bob-stationery", "--budget", "500"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "[FAIL: OVERBUDGET]" in captured.out
    assert "OVERAGE" in captured.out


def test_cli_simulate_json_output_and_csv_export(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    """Verifies '--json' machine-readable output and '--export-csv' manifest generation."""
    csv_file = tmp_path / "dispatch_manifest.csv"
    exit_code = main(
        [
            "simulate",
            "--scenario",
            "air-freight",
            "--json",
            "--export-csv",
            str(csv_file),
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    payload = json.loads(captured.out)
    assert payload["is_overall_feasible"] is True
    assert payload["stage1"]["is_feasible"] is True
    assert payload["stage3"]["is_flow_feasible"] is True
    assert payload["stage4"]["is_budget_feasible"] is True
    assert "total_ms" in payload["timing_ms"]

    assert csv_file.exists()
    csv_text = csv_file.read_text(encoding="utf-8")
    assert "allocation_id,product_name,quantity_units" in csv_text
    assert "A4 Copy Paper Ream Box" in csv_text


def test_cli_sweep_budget_and_fuel_price(capsys: pytest.CaptureFixture[str]) -> None:
    """Verifies parametric sensitivity sweeps on budget and fuel_price."""
    exit_code = main(
        [
            "sweep",
            "--scenario",
            "bob-stationery",
            "--param",
            "budget",
            "--min",
            "500",
            "--max",
            "3500",
            "--step",
            "1500",
            "--json",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    data = json.loads(captured.out)
    assert data["parameter"] == "budget"
    rows = data["sweep_results"]
    assert len(rows) == 3
    # At MYR 500 budget cap, it must fail; at MYR 3500 budget cap, it must succeed
    assert rows[0]["is_feasible"] is False
    assert rows[-1]["is_feasible"] is True

    # Verify ASCII table mode for fuel_price sweep
    exit_code_ascii = main(
        [
            "sweep",
            "--scenario",
            "bob-stationery",
            "--param",
            "fuel_price",
            "--min",
            "2.00",
            "--max",
            "3.00",
            "--step",
            "0.50",
        ]
    )
    captured_ascii = capsys.readouterr()
    assert exit_code_ascii == 0
    assert "PARAMETRIC SENSITIVITY SWEEP" in captured_ascii.out


def test_cli_scenarios_list_show_activate_reset(
    capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Verifies SQLite scenario subcommands (list, show, activate, reset)."""
    db_file = tmp_path / "cli_test.db"
    monkeypatch.setenv("SCENARIGO_DB_PATH", str(db_file))

    # 1. list
    assert main(["scenarios", "list"]) == 0
    out_list = capsys.readouterr().out
    assert "bob-stationery" in out_list
    assert "tri-port" in out_list

    # 2. show
    assert main(["scenarios", "show", "tri-port"]) == 0
    out_show = capsys.readouterr().out
    assert "Port Klang Gateway" in out_show
    assert "A4 Copy Paper Ream Box" in out_show

    # 3. activate
    assert main(["scenarios", "activate", "air-freight"]) == 0
    out_act = capsys.readouterr().out
    assert "[OK] Activated scenario" in out_act

    # 4. reset
    assert main(["scenarios", "reset", "bob-stationery"]) == 0
    out_rst = capsys.readouterr().out
    assert "[OK] Reset factory preset" in out_rst
