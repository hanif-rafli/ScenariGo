from app.core.stage1_feasibility import check_global_feasibility
from app.models.entities import Store, Warehouse
from app.models.responses import FeasibilityStatus, SimulationRequest


def test_baseline_scenario_is_feasible(baseline_scenario: SimulationRequest):
    result = check_global_feasibility(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )
    assert result.is_feasible is True
    assert result.deficits_count == 0
    assert result.total_products_checked == 3
    assert result.total_requested_units == 80  # P0: 40, P1: 30, P2: 10
    assert result.total_available_units == 155  # P0: 70, P1: 45, P2: 40
    assert "[VERIFIED: FEASIBLE]" in result.summary
    for token in result.tokens:
        assert token.status == FeasibilityStatus.FEASIBLE
        assert "[OK: INVENTORY SATISFIED]" in token.token_text


def test_deficit_scenario_halts_with_tokens(deficit_scenario: SimulationRequest):
    result = check_global_feasibility(
        warehouses=deficit_scenario.warehouses,
        stores=deficit_scenario.stores,
    )
    assert result.is_feasible is False
    assert result.deficits_count == 1
    assert "[FAIL: INVENTORY DEFICIT]" in result.summary

    # Find the deficit token for P1
    p1_token = next(t for t in result.tokens if t.product_id == "1")
    assert p1_token.status == FeasibilityStatus.DEFICIT
    assert p1_token.deficit == 15  # Total avail 45, req 60 (10 + 50)
    assert "[FAIL: INVENTORY DEFICIT]" in p1_token.token_text
    assert "[INFEASIBLE]" in p1_token.token_text


def test_unstocked_product_reports_unstocked_status():
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="KL Warehouse",
            latitude=3.13,
            longitude=101.68,
            inventory={"0": 10},
        )
    ]
    stores = [
        Store(
            store_id=0,
            name="Ipoh Store",
            latitude=4.59,
            longitude=101.09,
            requests={"99": 5},  # P99 not stocked anywhere
        )
    ]

    result = check_global_feasibility(warehouses, stores)
    assert result.is_feasible is False
    assert result.deficits_count == 1
    token = result.tokens[0]
    assert token.product_id == "99"
    assert token.status == FeasibilityStatus.UNSTOCKED
    assert token.available == 0
    assert token.requested == 5
    assert token.deficit == 5


def test_empty_requests_is_feasible():
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="KL Warehouse",
            latitude=3.13,
            longitude=101.68,
            inventory={"0": 100},
        )
    ]
    stores = [
        Store(
            store_id=0,
            name="Empty Store",
            latitude=4.59,
            longitude=101.09,
            requests={},
        )
    ]

    result = check_global_feasibility(warehouses, stores)
    assert result.is_feasible is True
    assert result.deficits_count == 0
    assert result.total_requested_units == 0
