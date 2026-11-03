from collections import defaultdict
from app.models.entities import Warehouse, Store
from app.models.responses import FeasibilityStatus, FeasibilityToken, Stage1Result


def check_global_feasibility(
    warehouses: list[Warehouse],
    stores: list[Store],
) -> Stage1Result:
    """Stage 1: Global Inventory Feasibility Check (O(N) Early Cutoff).
    
    Verifies that aggregate warehouse inventory is greater than or equal to 
    aggregate store demand for every requested product:
        forall p in Products: sum(Inventory(w, p)) >= sum(Request(s, p))

    Returns:
        Stage1Result containing overall feasibility flag, summary token,
        and per-product actionable audit tokens.
    """
    total_supply: dict[str, int] = defaultdict(int)
    total_demand: dict[str, int] = defaultdict(int)

    # Aggregate warehouse supply: O(|Warehouses| * |Products|)
    for w in warehouses:
        for pid, qty in w.inventory.items():
            if qty > 0:
                total_supply[str(pid)] += qty

    # Aggregate store demand: O(|Stores| * |Products|)
    for s in stores:
        for pid, qty in s.requests.items():
            if qty > 0:
                total_demand[str(pid)] += qty

    tokens: list[FeasibilityToken] = []
    deficits_count = 0
    total_requested_units = sum(total_demand.values())
    total_available_units = sum(total_supply.values())

    # Sort product keys for deterministic reporting
    all_products = sorted(set(total_demand.keys()) | set(total_supply.keys()))

    for pid in all_products:
        req = total_demand.get(pid, 0)
        avail = total_supply.get(pid, 0)

        # Only evaluate products that were actually requested
        if req > 0:
            if avail < req:
                deficits_count += 1
                shortfall = req - avail
                status = FeasibilityStatus.UNSTOCKED if avail == 0 else FeasibilityStatus.DEFICIT
                token_msg = (
                    f"[FAIL: INVENTORY DEFICIT] Product P{pid} short by {shortfall} units. "
                    f"Requested = {req}, Available = {avail} [INFEASIBLE]"
                )
                tokens.append(
                    FeasibilityToken(
                        product_id=pid,
                        requested=req,
                        available=avail,
                        deficit=shortfall,
                        status=status,
                        token_text=token_msg,
                    )
                )
            else:
                surplus = avail - req
                tokens.append(
                    FeasibilityToken(
                        product_id=pid,
                        requested=req,
                        available=avail,
                        deficit=0,
                        status=FeasibilityStatus.FEASIBLE,
                        token_text=(
                            f"[OK: INVENTORY SATISFIED] Product P{pid}: "
                            f"Requested = {req}, Available = {avail} (Surplus = {surplus})"
                        ),
                    )
                )

    is_feasible = deficits_count == 0

    if is_feasible:
        summary = (
            f"[VERIFIED: FEASIBLE] Global inventory satisfied across {len(warehouses)} warehouses "
            f"for all {len(total_demand)} requested products."
        )
    else:
        summary = (
            f"[FAIL: INVENTORY DEFICIT] {deficits_count} product(s) exhibit global supply shortfalls. "
            f"Simulation aborted at Stage 1 early cutoff."
        )

    return Stage1Result(
        is_feasible=is_feasible,
        total_products_checked=len(total_demand),
        total_requested_units=total_requested_units,
        total_available_units=total_available_units,
        deficits_count=deficits_count,
        tokens=tokens,
        summary=summary,
    )
